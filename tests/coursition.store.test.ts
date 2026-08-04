import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from '@rstest/core';
import type { CoursePreparation } from '../shared/coursition/workflow.ts';
import {
  inMemoryDraftRepository,
  jsonFileDraftRepository,
} from '../server/coursition/local-draft-repository.ts';
import { inMemorySourceBlobStore } from '../server/coursition/source-blob-store.ts';
import {
  applyWorkflowAction,
  learningBlueprintAfterPlanning,
  resetStorageAdapters,
  setStorageAdapters,
} from '../server/coursition/store.ts';

/*
 * These tests exercise the real Course Draft store through the in-memory
 * StoreBackend adapter. They run in-process with no filesystem, no
 * process.chdir, and no AI provider, which is the whole point of the storage
 * seam: the interface is the test surface.
 */

const owner = 'owner_alpha';
let operationSequence = 0;
const operationId = () => {
  operationSequence += 1;
  return `operation_${operationSequence}`;
};

const createDraft = (ownerId: string, title: string) =>
  applyWorkflowAction(ownerId, {
    action: 'createDraft',
    language: 'en',
    operationId: operationId(),
    title,
  });

const preparation = (): CoursePreparation => ({
  activityMixPreference: 'retrieval checks',
  audience: 'new analysts',
  constraints: 'no tooling setup',
  depth: 'practical',
  desiredOutcome: 'run a repeatable review',
  language: 'en',
  languagePreference: 'source',
  priorKnowledge: 'basic vocabulary',
  sourceStrictness: 'standard',
  tone: 'clear',
});

describe('Course Draft store (in-memory backend)', () => {
  beforeEach(() => {
    operationSequence = 0;
    setStorageAdapters(inMemoryDraftRepository(), inMemorySourceBlobStore());
  });

  afterEach(() => {
    resetStorageAdapters();
  });

  test('creates a draft and lists it back with no disk access', async () => {
    const created = await createDraft(owner, 'Incident response');

    expect(created.draft?.title).toBe('Incident response');
    expect(created.draft?.mode).toBe('assist');
    expect(created.draft?.step).toBe('mode');

    const state = await applyWorkflowAction(owner, { action: 'getState' });
    expect(state.drafts).toHaveLength(1);
    expect(state.drafts[0]?.title).toBe('Incident response');
  });

  test('uses AI course preparation only for full generate mode', async () => {
    const created = await createDraft(owner, 'Generated preparation');
    const { draft } = created;
    if (draft === null) {
      throw new Error('Expected a created draft.');
    }
    const generatedPreparation = preparation();
    const generatedBlueprint = {
      ...draft.learningBlueprint,
      coursePreparation: generatedPreparation,
    };

    expect(
      learningBlueprintAfterPlanning({ ...draft, mode: 'generate' }, generatedBlueprint)
        .coursePreparation,
    ).toEqual(generatedPreparation);
    expect(learningBlueprintAfterPlanning(draft, generatedBlueprint).coursePreparation).toEqual(
      draft.learningBlueprint.coursePreparation,
    );
  });

  test('resolves a URL route without mutating the persisted workflow step', async () => {
    const created = await createDraft(owner, 'Deep-linked course');
    const draftId = created.draft?.id ?? '';

    const blockedRoute = await applyWorkflowAction(owner, {
      action: 'getRouteState',
      draftId,
      step: 'preview',
    });
    expect(blockedRoute.draft?.step).toBe('sources');

    const persisted = await applyWorkflowAction(owner, { action: 'getState' });
    expect(persisted.draft?.step).toBe('mode');
  });

  test('processes a notes source locally into processed, grounded content', async () => {
    const created = await createDraft(owner, 'From notes');
    const draftId = created.draft?.id ?? '';

    const withSource = await applyWorkflowAction(owner, {
      action: 'addSource',
      draftId,
      expectedRevision: created.draft?.revision ?? 1,
      operationId: operationId(),
      source: {
        content: 'Containment precedes eradication.\n\nDocument every decision.',
        name: 'Runbook notes',
        type: 'notes',
      },
    });

    const sources = withSource.draft?.sources ?? [];
    expect(sources).toHaveLength(1);
    expect(sources[0]?.status).toBe('processed');
    expect(sources[0]?.content).toContain('Containment precedes eradication.');
    // Derivation still runs behind the seam: chunks are produced from the source.
    expect((withSource.draft?.knowledgeChunks ?? []).length).toBeGreaterThan(0);
  });

  test('persists edited course preparation', async () => {
    const created = await createDraft(owner, 'Preparation edits');
    const draftId = created.draft?.id ?? '';

    const updated = await applyWorkflowAction(owner, {
      action: 'updateCoursePreparation',
      draftId,
      expectedRevision: created.draft?.revision ?? 1,
      preparation: preparation(),
    });

    const saved = updated.draft?.learningBlueprint.coursePreparation;
    expect(saved?.audience).toBe('new analysts');
    expect(saved?.desiredOutcome).toBe('run a repeatable review');
  });

  test('isolates drafts per owner', async () => {
    await createDraft('owner_one', 'Owned by one');
    await createDraft('owner_two', 'Owned by two');

    const oneState = await applyWorkflowAction('owner_one', { action: 'getState' });
    const twoState = await applyWorkflowAction('owner_two', { action: 'getState' });

    expect(oneState.drafts).toHaveLength(1);
    expect(oneState.drafts[0]?.title).toBe('Owned by one');
    expect(twoState.drafts).toHaveLength(1);
    expect(twoState.drafts[0]?.title).toBe('Owned by two');
  });

  test('deletes a draft', async () => {
    const created = await createDraft(owner, 'Throwaway');
    const draftId = created.draft?.id ?? '';

    const afterDelete = await applyWorkflowAction(owner, {
      action: 'deleteDraft',
      confirm: true,
      draftId,
      expectedRevision: created.draft?.revision ?? 1,
      operationId: operationId(),
    });

    expect(afterDelete.draft).toBeNull();
    expect(afterDelete.drafts).toHaveLength(0);
  });

  test('two in-memory backends hold independent state (the seam is substitutable)', async () => {
    await createDraft(owner, 'Lives in first backend');
    const firstState = await applyWorkflowAction(owner, { action: 'getState' });
    expect(firstState.drafts).toHaveLength(1);

    // Swapping in a fresh adapter proves state lived in the adapter, not on disk.
    setStorageAdapters(inMemoryDraftRepository(), inMemorySourceBlobStore());
    const secondState = await applyWorkflowAction(owner, { action: 'getState' });
    expect(secondState.drafts).toHaveLength(0);
  });

  test('rejects persisted draft data that does not match the current Effect schema', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'coursition-store-'));

    try {
      await fs.writeFile(
        path.join(tempRoot, 'workflow.json'),
        '{"drafts":[{"id":"legacy","title":"Old draft"}]}',
        'utf-8',
      );
      setStorageAdapters(jsonFileDraftRepository(tempRoot), inMemorySourceBlobStore());

      await expect(applyWorkflowAction(owner, { action: 'getState' })).rejects.toThrow(
        'Stored course draft data does not match the current schema.',
      );
    } finally {
      await fs.rm(tempRoot, { force: true, recursive: true });
    }
  });
});
