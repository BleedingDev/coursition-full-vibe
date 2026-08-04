import fs from 'node:fs/promises';
import { afterEach, describe, expect, test } from '@rstest/core';
import { Effect } from 'effect';
import { Miniflare } from 'miniflare';
import type { CourseDraft } from '../shared/coursition/workflow.ts';
import { emptyCourseContent, emptyLearningBlueprint } from '../shared/coursition/workflow.ts';
import { d1DraftRepository } from '../server/coursition/d1-draft-repository.ts';
import {
  DraftOperationReuse,
  DraftRevisionConflict,
} from '../server/coursition/draft-repository.ts';
import type {
  DraftRepository,
  ReserveDraftOperation,
} from '../server/coursition/draft-repository.ts';
import { inMemoryDraftRepository } from '../server/coursition/local-draft-repository.ts';

const runtimes: Miniflare[] = [];

afterEach(async () => {
  await Promise.all(runtimes.splice(0).map((runtime) => runtime.dispose()));
});

const draft = (id: string, ownerId: string): CourseDraft => {
  const timestamp = '2026-07-15T12:00:00.000Z';
  return {
    aiRuns: [],
    courseContent: emptyCourseContent(),
    createdAt: timestamp,
    derivedSourceDocuments: [],
    findings: [],
    id,
    knowledgeChunks: [],
    language: 'en',
    learningBlueprint: emptyLearningBlueprint('en'),
    mode: 'assist',
    ownerId,
    revision: 0,
    sourceProcessingIncomplete: false,
    sources: [],
    step: 'mode',
    title: id,
    updatedAt: timestamp,
  };
};

const operation = (ownerId: string, draftId: string): ReserveDraftOperation => ({
  action: 'generateCourse',
  draftId,
  expectedRevision: 1,
  leaseDurationMs: 60_000,
  leaseToken: 'lease_one',
  operationId: 'operation_one',
  ownerId,
  requestFingerprint: 'fingerprint_one',
});

const expectStaleCasIsolation = async (
  repositoryOne: DraftRepository,
  repositoryTwo: DraftRepository,
) => {
  const created = await Effect.runPromise(repositoryOne.create(draft('course_one', 'owner_one')));
  const first = await Effect.runPromise(
    repositoryOne.update({ ...created, title: 'first writer' }, created.revision),
  );

  await expect(
    Effect.runPromise(
      repositoryTwo.update({ ...created, title: 'stale writer' }, created.revision),
    ),
  ).rejects.toBeInstanceOf(DraftRevisionConflict);

  const state = await Effect.runPromise(repositoryTwo.readOwnerState('owner_one'));
  expect(state.revision).toBe(2);
  expect(state.drafts).toHaveLength(1);
  expect(state.drafts[0]?.revision).toBe(2);
  expect(state.drafts[0]?.title).toBe(first.title);
};

const d1Repositories = async () => {
  const runtime = new Miniflare({
    d1Databases: { DB: crypto.randomUUID() },
    modules: true,
    script: "export default { fetch() { return new Response('ok') } }",
  });
  runtimes.push(runtime);
  const database = await runtime.getD1Database('DB');
  const migration = await fs.readFile('drizzle/0001_warm_miss_america.sql', 'utf-8');
  await database.exec(
    migration.replaceAll('--> statement-breakpoint', '').replaceAll(/\s+/gu, ' '),
  );
  return [d1DraftRepository(database), d1DraftRepository(database)] as const;
};

describe('Draft repository contract', () => {
  test('keeps stale in-memory writes from changing the draft or owner revision', async () => {
    const repository = inMemoryDraftRepository();
    await expectStaleCasIsolation(repository, repository);
  });

  test('keeps two owners isolated in one D1 database', async () => {
    const [repositoryOne, repositoryTwo] = await d1Repositories();
    await Promise.all([
      Effect.runPromise(repositoryOne.create(draft('course_one', 'owner_one'))),
      Effect.runPromise(repositoryTwo.create(draft('course_two', 'owner_two'))),
    ]);
    const [ownerOne, ownerTwo] = await Promise.all([
      Effect.runPromise(repositoryOne.readOwnerState('owner_one')),
      Effect.runPromise(repositoryTwo.readOwnerState('owner_two')),
    ]);
    expect(ownerOne.drafts.map((candidate) => candidate.id)).toEqual(['course_one']);
    expect(ownerTwo.drafts.map((candidate) => candidate.id)).toEqual(['course_two']);
  });

  test('enforces D1 CAS across independent repository instances', async () => {
    const [repositoryOne, repositoryTwo] = await d1Repositories();
    await expectStaleCasIsolation(repositoryOne, repositoryTwo);
  });

  test('allows exactly one concurrent D1 operation reservation', async () => {
    const [repositoryOne, repositoryTwo] = await d1Repositories();
    const reservationInput = operation('owner_reservation', 'course_reservation');
    const [first, second] = await Promise.all([
      Effect.runPromise(
        repositoryOne.reserveOperation({ ...reservationInput, leaseToken: 'lease_first' }),
      ),
      Effect.runPromise(
        repositoryTwo.reserveOperation({ ...reservationInput, leaseToken: 'lease_second' }),
      ),
    ]);

    expect([first.kind, second.kind].toSorted()).toEqual(['acquired', 'pending']);
    const acquired = first.kind === 'acquired' ? first : second;
    const pending = first.kind === 'pending' ? first : second;
    expect(pending.operation.leaseToken).toBe(acquired.operation.leaseToken);
  });

  test('rejects reusing a D1 operation id for different input', async () => {
    const [repository] = await d1Repositories();
    const reservationInput = operation('owner_reuse', 'course_reuse');
    await Effect.runPromise(repository.reserveOperation(reservationInput));

    await expect(
      Effect.runPromise(
        repository.reserveOperation({
          ...reservationInput,
          requestFingerprint: 'different_fingerprint',
        }),
      ),
    ).rejects.toBeInstanceOf(DraftOperationReuse);
  });

  test('returns a committed D1 operation without applying its create twice', async () => {
    const [repositoryOne, repositoryTwo] = await d1Repositories();
    const inputDraft = draft('course_idempotent', 'owner_idempotent');
    const reservationInput: ReserveDraftOperation = {
      action: 'createDraft',
      draftId: inputDraft.id,
      leaseDurationMs: 60_000,
      leaseToken: 'lease_create',
      operationId: 'operation_create',
      ownerId: inputDraft.ownerId,
      requestFingerprint: 'fingerprint_create',
    };
    const reservation = await Effect.runPromise(repositoryOne.reserveOperation(reservationInput));
    expect(reservation.kind).toBe('acquired');
    if (reservation.kind !== 'acquired') {
      throw new Error('Expected the first operation reservation to be acquired.');
    }
    const created = await Effect.runPromise(
      repositoryOne.create(inputDraft, {
        leaseToken: reservation.operation.leaseToken,
        operationId: reservation.operation.operationId,
      }),
    );

    const duplicate = await Effect.runPromise(repositoryTwo.reserveOperation(reservationInput));
    const state = await Effect.runPromise(repositoryTwo.readOwnerState(inputDraft.ownerId));
    expect(duplicate.kind).toBe('committed');
    expect(duplicate.operation.resultRevision).toBe(created.revision);
    expect(state.revision).toBe(1);
    expect(state.drafts.map((candidate) => candidate.id)).toEqual([inputDraft.id]);
  });

  test('does not commit an operation or bump owner state when D1 CAS is stale', async () => {
    const [repositoryOne, repositoryTwo] = await d1Repositories();
    const created = await Effect.runPromise(
      repositoryOne.create(draft('course_operation', 'owner_operation')),
    );
    const reservationInput = operation(created.ownerId, created.id);
    const reservation = await Effect.runPromise(repositoryOne.reserveOperation(reservationInput));
    expect(reservation.kind).toBe('acquired');

    await Effect.runPromise(
      repositoryTwo.update({ ...created, title: 'new authority' }, created.revision),
    );
    await expect(
      Effect.runPromise(
        repositoryOne.update(
          { ...created, title: 'stale operation' },
          created.revision,
          reservation.kind === 'acquired'
            ? {
                leaseToken: reservation.operation.leaseToken,
                operationId: reservation.operation.operationId,
              }
            : undefined,
        ),
      ),
    ).rejects.toBeInstanceOf(DraftRevisionConflict);

    const repeated = await Effect.runPromise(repositoryTwo.reserveOperation(reservationInput));
    const state = await Effect.runPromise(repositoryTwo.readOwnerState(created.ownerId));
    expect(repeated.kind).toBe('pending');
    expect(state.revision).toBe(2);
    expect(state.drafts[0]?.title).toBe('new authority');
  });

  test('does not commit a delete operation or bump owner state when D1 CAS is stale', async () => {
    const [repositoryOne, repositoryTwo] = await d1Repositories();
    const created = await Effect.runPromise(
      repositoryOne.create(draft('course_delete', 'owner_delete')),
    );
    const reservationInput: ReserveDraftOperation = {
      ...operation(created.ownerId, created.id),
      action: 'deleteDraft',
    };
    const reservation = await Effect.runPromise(repositoryOne.reserveOperation(reservationInput));
    await Effect.runPromise(
      repositoryTwo.update({ ...created, title: 'new authority' }, created.revision),
    );

    await expect(
      Effect.runPromise(
        repositoryOne.delete(
          created.ownerId,
          created.id,
          created.revision,
          reservation.kind === 'acquired'
            ? {
                leaseToken: reservation.operation.leaseToken,
                operationId: reservation.operation.operationId,
              }
            : undefined,
        ),
      ),
    ).rejects.toBeInstanceOf(DraftRevisionConflict);

    const repeated = await Effect.runPromise(repositoryTwo.reserveOperation(reservationInput));
    const state = await Effect.runPromise(repositoryTwo.readOwnerState(created.ownerId));
    expect(repeated.kind).toBe('pending');
    expect(state.revision).toBe(2);
    expect(state.drafts).toHaveLength(1);
  });
});
