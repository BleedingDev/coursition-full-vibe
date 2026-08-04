import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test } from '@rstest/core';
import { Effect, Option, Schema } from 'effect';
import { Miniflare } from 'miniflare';
import { MAX_SOURCE_FILE_BYTES, workflowActionSchema } from '../shared/api.ts';
import type { CourseDraft } from '../shared/coursition/workflow.ts';
import { emptyCourseContent, emptyLearningBlueprint } from '../shared/coursition/workflow.ts';
import { d1DraftRepository } from '../server/coursition/d1-draft-repository.ts';
import { DraftRevisionConflict } from '../server/coursition/draft-repository.ts';
import { inMemoryDraftRepository } from '../server/coursition/local-draft-repository.ts';
import {
  deleteSourceBlobOrSchedule,
  d1SourceCleanupRepository,
  drainSourceCleanup,
} from '../server/coursition/source-cleanup.ts';
import type { SourceBlobStore } from '../server/coursition/source-blob-store.ts';
import {
  cloudflareSourceBlobStore,
  inMemorySourceBlobStore,
  localSourceBlobStore,
  SourceBlobStoreError,
} from '../server/coursition/source-blob-store.ts';
import {
  convertDocumentWithCloudflare,
  decodeFileDataUrl,
  processSource,
} from '../server/coursition/source-processing.ts';
import {
  applyWorkflowAction,
  applyWorkflowActionWithCleanup,
  resetStorageAdapters,
  setStorageAdapters,
} from '../server/coursition/store.ts';

const runtimes: Miniflare[] = [];
const temporaryDirectories: string[] = [];

afterEach(async () => {
  resetStorageAdapters();
  await Promise.all([
    ...runtimes.splice(0).map((runtime) => runtime.dispose()),
    ...temporaryDirectories
      .splice(0)
      .map((directory) => fs.rm(directory, { force: true, recursive: true })),
  ]);
});

const createRuntime = async () => {
  const runtime = new Miniflare({
    d1Databases: { DB: crypto.randomUUID() },
    modules: true,
    script: "export default { fetch() { return new Response('ok') } }",
  });
  runtimes.push(runtime);
  const database = await runtime.getD1Database('DB');
  const migrations = await Promise.all(
    ['0001_warm_miss_america.sql', '0002_ancient_inertia.sql'].map((migrationName) =>
      fs.readFile(`drizzle/${migrationName}`, 'utf-8'),
    ),
  );
  await Effect.runPromise(
    Effect.forEach(
      migrations.flatMap((migration) => migration.split('--> statement-breakpoint')),
      (statement) => Effect.promise(() => database.prepare(statement).run()),
      { concurrency: 1, discard: true },
    ),
  );
  return database;
};

const createR2Bucket = () => {
  const runtime = new Miniflare({
    modules: true,
    r2Buckets: { BUCKET: crypto.randomUUID() },
    script: "export default { fetch() { return new Response('ok') } }",
  });
  runtimes.push(runtime);
  return runtime.getR2Bucket('BUCKET');
};

const draft = (): CourseDraft => {
  const timestamp = '2026-07-15T12:00:00.000Z';
  return {
    aiRuns: [],
    courseContent: emptyCourseContent(),
    createdAt: timestamp,
    derivedSourceDocuments: [],
    findings: [],
    id: 'course_source_lifecycle',
    knowledgeChunks: [],
    language: 'en',
    learningBlueprint: emptyLearningBlueprint('en'),
    mode: 'assist',
    ownerId: 'owner_source_lifecycle',
    revision: 0,
    sourceProcessingIncomplete: false,
    sources: [],
    step: 'sources',
    title: 'Source lifecycle',
    updatedAt: timestamp,
  };
};

describe('Coursition source lifecycle', () => {
  test('converts PDF sources through the Cloudflare Workers AI binding', async () => {
    const bytes = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55]);
    let receivedBlob: Blob | undefined;
    let receivedName = '';
    let receivedOptions: unknown;
    const converted = await Effect.runPromise(
      convertDocumentWithCloudflare('guide.pdf', { bytes, mimeType: 'application/pdf' }, () =>
        Promise.resolve({
          toMarkdown: (document, options) => {
            receivedBlob = document.blob;
            receivedName = document.name;
            receivedOptions = options;
            return Promise.resolve({
              data: '  Converted guide text  ',
              format: 'text' as const,
              id: 'conversion-1',
              mimetype: 'application/pdf',
              name: document.name,
              tokens: 3,
            });
          },
        }),
      ),
    );

    expect(receivedName).toBe('guide.pdf');
    expect(receivedBlob?.type).toBe('application/pdf');
    expect(new Uint8Array(await receivedBlob?.arrayBuffer())).toEqual(bytes);
    expect(receivedOptions).toEqual({
      conversionOptions: {
        output: { format: 'text' },
        pdf: { metadata: false },
      },
    });
    expect(converted).toEqual({
      content: 'Converted guide text',
      mimeType: 'application/pdf',
      processor: 'cloudflare_markdown',
      providerJobId: 'conversion-1',
    });
  });

  test('uses an injected document converter for provider-backed files', async () => {
    const converted = await Effect.runPromise(
      processSource(
        {
          convertDocument: (_sourceName, binary) =>
            Effect.succeed({
              content: 'Injected document content',
              mimeType: binary.mimeType,
              processor: 'injected_document_converter',
              providerJobId: 'injected-1',
            }),
          deleteSourceBlob: () => Effect.void,
          newSourceId: () => 'source_injected_document',
          now: () => '2026-07-15T12:00:00.000Z',
          writeSourceBlob: () => Effect.succeed('r2:source-assets/course/guide.pdf'),
        },
        'course_injected_document',
        {
          content: 'data:application/pdf;base64,JVBERi0xLjc=',
          name: 'guide.pdf',
          type: 'file',
        },
      ),
    );

    expect(converted.status).toBe('processed');
    expect(converted.content).toBe('Injected document content');
    expect(converted.processor).toBe('injected_document_converter');
    expect(converted.providerJobId).toBe('injected-1');
  });

  test('deletes source bytes idempotently from the in-memory adapter', async () => {
    const store = inMemorySourceBlobStore();
    const reference = await Effect.runPromise(
      store.write('course_one', 'source_one', new Uint8Array([1, 2, 3])),
    );
    expect(Option.isSome(await Effect.runPromise(store.read(reference)))).toBe(true);
    await Effect.runPromise(store.delete(reference));
    await Effect.runPromise(store.delete(reference));
    expect(Option.isNone(await Effect.runPromise(store.read(reference)))).toBe(true);
  });

  test('writes, reads, and idempotently deletes bytes from the local adapter', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'coursition-source-'));
    temporaryDirectories.push(directory);
    const store = localSourceBlobStore(directory);
    const bytes = new Uint8Array([4, 5, 6]);
    const reference = await Effect.runPromise(store.write('course_local', 'source_local', bytes));
    const stored = await Effect.runPromise(store.read(reference));
    expect([...Option.getOrThrow(stored)]).toEqual([...bytes]);
    await Effect.runPromise(store.delete(reference));
    await Effect.runPromise(store.delete(reference));
    expect(Option.isNone(await Effect.runPromise(store.read(reference)))).toBe(true);
  });

  test('writes, reads, and idempotently deletes bytes from the R2 adapter', async () => {
    const bucket = await createR2Bucket();
    const store = cloudflareSourceBlobStore(bucket);
    const bytes = new Uint8Array([7, 8, 9]);
    const reference = await Effect.runPromise(store.write('course_r2', 'source_r2', bytes));
    const stored = await Effect.runPromise(store.read(reference));
    expect(Option.getOrThrow(stored)).toEqual(bytes);
    await Effect.runPromise(store.delete(reference));
    await Effect.runPromise(store.delete(reference));
    expect(Option.isNone(await Effect.runPromise(store.read(reference)))).toBe(true);
  });

  test('workflow source and draft deletion remove committed local blobs', async () => {
    const repository = inMemoryDraftRepository();
    const blobStore = inMemorySourceBlobStore();
    setStorageAdapters(repository, blobStore);
    const sourceReference = await Effect.runPromise(
      blobStore.write(draft().id, 'source_local_cleanup', new Uint8Array([1, 2, 3])),
    );
    const created = await Effect.runPromise(
      repository.create({
        ...draft(),
        sources: [
          {
            content: 'Local source bytes',
            createdAt: '2026-07-15T12:00:00.000Z',
            id: 'source_local_cleanup',
            mimeType: 'text/plain',
            name: 'local.txt',
            processor: 'local',
            sizeLabel: '3 B',
            status: 'processed',
            storageReference: sourceReference,
            type: 'file',
          },
        ],
      }),
    );

    const afterSourceDelete = await applyWorkflowAction(created.ownerId, {
      action: 'deleteSource',
      draftId: created.id,
      expectedRevision: created.revision,
      operationId: 'operation_delete_local_source',
      sourceId: 'source_local_cleanup',
    });
    expect(Option.isNone(await Effect.runPromise(blobStore.read(sourceReference)))).toBe(true);

    const draftReference = await Effect.runPromise(
      blobStore.write(
        'course_local_draft_cleanup',
        'source_local_draft',
        new Uint8Array([4, 5, 6]),
      ),
    );
    const draftWithBlob = await Effect.runPromise(
      repository.create({
        ...draft(),
        id: 'course_local_draft_cleanup',
        sources: [
          {
            content: 'Local draft bytes',
            createdAt: '2026-07-15T12:00:00.000Z',
            id: 'source_local_draft',
            mimeType: 'text/plain',
            name: 'draft.txt',
            processor: 'local',
            sizeLabel: '3 B',
            status: 'processed',
            storageReference: draftReference,
            type: 'file',
          },
        ],
      }),
    );
    await applyWorkflowAction(draftWithBlob.ownerId, {
      action: 'deleteDraft',
      confirm: true,
      draftId: draftWithBlob.id,
      expectedRevision: draftWithBlob.revision,
      operationId: 'operation_delete_local_draft',
    });
    expect(Option.isNone(await Effect.runPromise(blobStore.read(draftReference)))).toBe(true);
    expect(afterSourceDelete.draft?.sources[0]?.status).toBe('deleted');
  });

  test('rejects an oversized file before writing source bytes', async () => {
    let writes = 0;
    await expect(
      Effect.runPromise(
        processSource(
          {
            deleteSourceBlob: () => Effect.void,
            newSourceId: () => 'source_oversized',
            now: () => '2026-07-15T12:00:00.000Z',
            writeSourceBlob: () => {
              writes += 1;
              return Effect.succeed('r2:source-assets/course/source.bin');
            },
          },
          'course_oversized',
          {
            content: '',
            filePayload: {
              bytes: new Uint8Array(MAX_SOURCE_FILE_BYTES + 1),
              declaredMimeType: 'application/pdf',
            },
            name: 'oversized.pdf',
            type: 'file',
          },
        ),
      ),
    ).rejects.toThrow(/limited/u);
    expect(writes).toBe(0);
  });

  test('rejects an oversized encoded file at the workflow schema boundary', () => {
    const encoded = `data:application/pdf;base64,${Buffer.alloc(MAX_SOURCE_FILE_BYTES + 1).toString(
      'base64',
    )}`;
    expect(() =>
      Schema.decodeUnknownSync(workflowActionSchema)({
        action: 'addSource',
        draftId: 'course_schema_limit',
        expectedRevision: 1,
        operationId: 'operation_schema_limit',
        source: { content: encoded, name: 'oversized.pdf', type: 'file' },
      }),
    ).toThrow();
  });

  test('decodes a large FileReader data URL without the general-purpose URL parser', () => {
    const bytes = Buffer.alloc(2 * 1024 * 1024, 65);
    const decoded = decodeFileDataUrl(`data:text/plain;base64,${bytes.toString('base64')}`);

    expect(decoded?.declaredMimeType).toBe('text/plain');
    expect(decoded?.bytes.byteLength).toBe(bytes.byteLength);
    expect(decoded?.bytes[0]).toBe(65);
    expect(decoded?.bytes.at(-1)).toBe(65);
  });

  test('stores a bounded file-operation fingerprint while preserving request identity', async () => {
    const database = await createRuntime();
    const repository = d1DraftRepository(database);
    const blobStore = inMemorySourceBlobStore();
    setStorageAdapters(repository, blobStore);
    const created = await Effect.runPromise(repository.create(draft()));
    const action = {
      action: 'addSource' as const,
      draftId: created.id,
      expectedRevision: created.revision,
      operationId: 'operation_bounded_file_fingerprint',
      source: {
        content: 'data:text/plain;base64,SGVsbG8=',
        name: 'hello.txt',
        type: 'file' as const,
      },
    };

    const added = await applyWorkflowAction(created.ownerId, action);
    const repeated = await applyWorkflowAction(created.ownerId, action);
    const row = await database
      .prepare(
        'SELECT request_fingerprint FROM coursition_operation WHERE owner_id = ? AND operation_id = ?',
      )
      .bind(created.ownerId, action.operationId)
      .first<{ request_fingerprint: string }>();

    expect(added.draft?.sources).toHaveLength(1);
    expect(repeated.draft?.sources).toHaveLength(1);
    expect(row?.request_fingerprint.length).toBeLessThan(1024);
    expect(row?.request_fingerprint).toContain('sha256:');
    expect(row?.request_fingerprint).not.toContain(action.source.content);
    await expect(
      applyWorkflowAction(created.ownerId, {
        ...action,
        source: { ...action.source, content: 'data:text/plain;base64,V29ybGQ=' },
      }),
    ).rejects.toThrow('Operation identity was reused for a different request.');
  });

  test('atomically schedules cleanup only when the draft CAS succeeds', async () => {
    const database = await createRuntime();
    const repository = d1DraftRepository(database);
    const created = await Effect.runPromise(repository.create(draft()));
    const updated = await Effect.runPromise(
      repository.update({ ...created, title: 'updated' }, created.revision, undefined, [
        {
          reference: 'r2:source-assets/course_source_lifecycle/source_one.bin',
          sourceId: 'source_one',
        },
      ]),
    );
    await expect(
      Effect.runPromise(
        repository.update({ ...created, title: 'stale' }, created.revision, undefined, [
          {
            reference: 'r2:source-assets/course_source_lifecycle/stale.bin',
            sourceId: 'source_stale',
          },
        ]),
      ),
    ).rejects.toBeInstanceOf(DraftRevisionConflict);
    const afterConflict = await database
      .prepare('SELECT reference FROM coursition_source_cleanup ORDER BY reference')
      .all<{ reference: string }>();
    expect(afterConflict.results.map(({ reference }) => reference)).toEqual([
      'r2:source-assets/course_source_lifecycle/source_one.bin',
    ]);

    await Effect.runPromise(
      repository.delete(updated.ownerId, updated.id, updated.revision, undefined, [
        {
          reference: 'r2:source-assets/course_source_lifecycle/source_two.bin',
          sourceId: 'source_two',
        },
      ]),
    );
    const afterDelete = await database
      .prepare('SELECT reference FROM coursition_source_cleanup ORDER BY reference')
      .all<{ reference: string }>();
    expect(afterDelete.results.map(({ reference }) => reference)).toEqual([
      'r2:source-assets/course_source_lifecycle/source_one.bin',
      'r2:source-assets/course_source_lifecycle/source_two.bin',
    ]);
  });

  test('retains failed cleanup for retry and removes it after success', async () => {
    const database = await createRuntime();
    const repository = d1SourceCleanupRepository(database);
    const reference = 'r2:source-assets/course_cleanup/source_cleanup.bin';
    await Effect.runPromise(
      repository.schedule({
        draftId: 'course_cleanup',
        ownerId: 'owner_cleanup',
        reference,
        sourceId: 'source_cleanup',
      }),
    );
    let shouldFail = true;
    const blobStore: SourceBlobStore = {
      delete: () =>
        shouldFail
          ? Effect.fail(new SourceBlobStoreError({ message: 'simulated deletion failure' }))
          : Effect.void,
      exists: () => Effect.succeed(shouldFail),
      read: () => Effect.succeed(Option.none()),
      write: () => Effect.succeed(reference),
    };
    const firstAttemptAt = Number.MAX_SAFE_INTEGER - 4 * 60 * 60 * 1000;

    const failed = await Effect.runPromise(
      drainSourceCleanup(repository, blobStore, { timestamp: firstAttemptAt }),
    );
    expect(failed).toEqual({ completed: 0, failed: 1, processed: 1 });
    const pending = await Effect.runPromise(repository.listDue(Number.MAX_SAFE_INTEGER, 10));
    expect(pending[0]?.attempts).toBe(1);

    shouldFail = false;
    const completed = await Effect.runPromise(
      drainSourceCleanup(repository, blobStore, { timestamp: Number.MAX_SAFE_INTEGER }),
    );
    expect(completed).toEqual({ completed: 1, failed: 0, processed: 1 });
    expect(await Effect.runPromise(repository.listDue(Number.MAX_SAFE_INTEGER, 10))).toEqual([]);
  });

  test('retains cleanup when blob deletion resolves but the object still exists', async () => {
    const database = await createRuntime();
    const repository = d1SourceCleanupRepository(database);
    const reference = 'r2:source-assets/course_silent_delete/source_silent_delete.bin';
    await Effect.runPromise(
      repository.schedule({
        draftId: 'course_silent_delete',
        ownerId: 'owner_silent_delete',
        reference,
        sourceId: 'source_silent_delete',
      }),
    );
    let objectExists = true;
    const blobStore: SourceBlobStore = {
      delete: () => Effect.void,
      exists: () => Effect.succeed(objectExists),
      read: () =>
        Effect.succeed(
          objectExists ? Option.some(new Uint8Array([1, 2, 3])) : Option.none<Uint8Array>(),
        ),
      write: () => Effect.succeed(reference),
    };

    const retained = await Effect.runPromise(
      drainSourceCleanup(repository, blobStore, {
        timestamp: Number.MAX_SAFE_INTEGER - 4 * 60 * 60 * 1000,
      }),
    );
    expect(retained).toEqual({ completed: 0, failed: 1, processed: 1 });
    const deferred = await database
      .prepare('SELECT attempts, last_error FROM coursition_source_cleanup WHERE reference = ?')
      .bind(reference)
      .first<{ attempts: number; last_error: string | null }>();
    expect(deferred).toEqual({ attempts: 1, last_error: 'blob_delete_unverified' });

    objectExists = false;
    const completed = await Effect.runPromise(
      drainSourceCleanup(repository, blobStore, { timestamp: Number.MAX_SAFE_INTEGER }),
    );
    expect(completed).toEqual({ completed: 1, failed: 0, processed: 1 });
    expect(await Effect.runPromise(repository.listDue(Number.MAX_SAFE_INTEGER, 10))).toEqual([]);
  });

  test('API workflow deletion drains cleanup without falsifying a committed delete', async () => {
    const database = await createRuntime();
    const draftRepository = d1DraftRepository(database);
    const cleanupRepository = d1SourceCleanupRepository(database);
    const reference = 'r2:source-assets/course_api_cleanup/source_api_cleanup.bin';
    const blobStore: SourceBlobStore = {
      delete: () => Effect.fail(new SourceBlobStoreError({ message: 'simulated R2 outage' })),
      exists: () => Effect.succeed(true),
      read: () => Effect.succeed(Option.none()),
      write: () => Effect.succeed(reference),
    };
    setStorageAdapters(draftRepository, blobStore, cleanupRepository);
    const created = await Effect.runPromise(
      draftRepository.create({
        ...draft(),
        id: 'course_api_cleanup',
        sources: [
          {
            content: '',
            createdAt: '2026-07-15T12:00:00.000Z',
            failureReason: 'Document conversion failed.',
            id: 'source_api_cleanup',
            mimeType: 'application/pdf',
            name: 'source.pdf',
            processor: 'local',
            sizeLabel: '10 B',
            status: 'failed',
            storageReference: reference,
            type: 'file',
          },
        ],
      }),
    );

    const snapshot = await applyWorkflowActionWithCleanup(created.ownerId, {
      action: 'deleteDraft',
      confirm: true,
      draftId: created.id,
      expectedRevision: created.revision,
      operationId: 'operation_api_cleanup',
    });

    expect(snapshot.draft).toBeNull();
    const ownerState = await Effect.runPromise(draftRepository.readOwnerState(created.ownerId));
    expect(ownerState.drafts).toEqual([]);
    const pending = await Effect.runPromise(cleanupRepository.listDue(Number.MAX_SAFE_INTEGER, 10));
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ attempts: 1, reference });
  });

  test('workflow draft deletion removes a failed source blob before completing cleanup', async () => {
    const database = await createRuntime();
    const draftRepository = d1DraftRepository(database);
    const cleanupRepository = d1SourceCleanupRepository(database);
    const blobStore = cloudflareSourceBlobStore(await createR2Bucket());
    const reference = await Effect.runPromise(
      blobStore.write('course_failed_source', 'source_failed', new Uint8Array([37, 80, 68, 70])),
    );
    setStorageAdapters(draftRepository, blobStore, cleanupRepository);
    const created = await Effect.runPromise(
      draftRepository.create({
        ...draft(),
        id: 'course_failed_source',
        sources: [
          {
            content: '',
            createdAt: '2026-07-15T12:00:00.000Z',
            failureReason: 'Document conversion failed.',
            id: 'source_failed',
            mimeType: 'application/pdf',
            name: 'failed.pdf',
            processor: 'cloudflare_markdown',
            sizeLabel: '4 B',
            status: 'failed',
            storageReference: reference,
            type: 'file',
          },
        ],
      }),
    );

    const snapshot = await applyWorkflowActionWithCleanup(created.ownerId, {
      action: 'deleteDraft',
      confirm: true,
      draftId: created.id,
      expectedRevision: created.revision,
      operationId: 'operation_delete_failed_source',
    });

    expect(snapshot.draft).toBeNull();
    expect(await Effect.runPromise(blobStore.exists(reference))).toBe(false);
    expect(await Effect.runPromise(cleanupRepository.listDue(Number.MAX_SAFE_INTEGER, 10))).toEqual(
      [],
    );
  });

  test('durably schedules rollback when immediate blob deletion fails', async () => {
    const database = await createRuntime();
    const repository = d1SourceCleanupRepository(database);
    const reference = 'r2:source-assets/course_rollback/source_rollback.bin';
    const blobStore: SourceBlobStore = {
      delete: () => Effect.fail(new SourceBlobStoreError({ message: 'simulated R2 outage' })),
      exists: () => Effect.succeed(true),
      read: () => Effect.succeed(Option.none()),
      write: () => Effect.succeed(reference),
    };

    await Effect.runPromise(
      deleteSourceBlobOrSchedule(repository, blobStore, {
        draftId: 'course_rollback',
        ownerId: 'owner_rollback',
        reference,
        sourceId: 'source_rollback',
      }),
    );

    const pending = await Effect.runPromise(repository.listDue(Number.MAX_SAFE_INTEGER, 10));
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({
      draftId: 'course_rollback',
      ownerId: 'owner_rollback',
      reference,
      sourceId: 'source_rollback',
    });
  });

  test('drains source and draft deletion without leaving blob or outbox orphans', async () => {
    const database = await createRuntime();
    const draftRepository = d1DraftRepository(database);
    const cleanupRepository = d1SourceCleanupRepository(database);
    const blobStore = cloudflareSourceBlobStore(await createR2Bucket());
    const removedSourceReference = await Effect.runPromise(
      blobStore.write('course_source_lifecycle', 'source_removed', new Uint8Array([10, 11])),
    );
    const remainingSourceReference = await Effect.runPromise(
      blobStore.write('course_source_lifecycle', 'source_remaining', new Uint8Array([12, 13])),
    );
    const created = await Effect.runPromise(draftRepository.create(draft()));
    const updated = await Effect.runPromise(
      draftRepository.update(created, created.revision, undefined, [
        { reference: removedSourceReference, sourceId: 'source_removed' },
      ]),
    );

    const sourceSummary = await Effect.runPromise(
      drainSourceCleanup(cleanupRepository, blobStore, { timestamp: Number.MAX_SAFE_INTEGER }),
    );
    expect(sourceSummary).toEqual({ completed: 1, failed: 0, processed: 1 });
    expect(Option.isNone(await Effect.runPromise(blobStore.read(removedSourceReference)))).toBe(
      true,
    );
    expect(Option.isSome(await Effect.runPromise(blobStore.read(remainingSourceReference)))).toBe(
      true,
    );

    await Effect.runPromise(
      draftRepository.delete(updated.ownerId, updated.id, updated.revision, undefined, [
        { reference: remainingSourceReference, sourceId: 'source_remaining' },
      ]),
    );

    const draftSummary = await Effect.runPromise(
      drainSourceCleanup(cleanupRepository, blobStore, { timestamp: Number.MAX_SAFE_INTEGER }),
    );
    expect(draftSummary).toEqual({ completed: 1, failed: 0, processed: 1 });
    expect(Option.isNone(await Effect.runPromise(blobStore.read(remainingSourceReference)))).toBe(
      true,
    );
    expect(await Effect.runPromise(cleanupRepository.listDue(Number.MAX_SAFE_INTEGER, 10))).toEqual(
      [],
    );
  });
});
