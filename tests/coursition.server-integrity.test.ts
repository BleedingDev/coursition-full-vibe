import { afterEach, beforeEach, describe, expect, test } from '@rstest/core';
import { Effect, Schema } from 'effect';
import { CoursitionWorkflowConflict } from '../shared/api.ts';
import type { CoursePreparation, LearningBlueprint } from '../shared/api.ts';
import type { CourseDraft } from '../shared/coursition/workflow.ts';
import type * as AiProviderModule from '../server/coursition/ai-provider.ts';
import type { DraftRepository } from '../server/coursition/draft-repository.ts';
import { inMemoryDraftRepository } from '../server/coursition/local-draft-repository.ts';
import { inMemorySourceBlobStore } from '../server/coursition/source-blob-store.ts';
import {
  applyWorkflowAction,
  resetAiProviderModuleLoaderForTests,
  resetStorageAdapters,
  setAiProviderModuleLoaderForTests,
  setStorageAdapters,
} from '../server/coursition/store.ts';

const ownerId = 'server_integrity_owner';
let repository: DraftRepository;
let operationSequence = 0;

const operationId = () => {
  operationSequence += 1;
  return `server_integrity_operation_${operationSequence}`;
};

const preparation = (audience: string): CoursePreparation => ({
  activityMixPreference: 'scenarios and practice',
  audience,
  constraints: 'browser only',
  depth: 'practical',
  desiredOutcome: 'Apply the source safely',
  language: 'en',
  languagePreference: 'source',
  priorKnowledge: 'basic terminology',
  sourceStrictness: 'standard',
  tone: 'direct',
});

const generatedBlueprint = (draft: CourseDraft): LearningBlueprint => {
  const timestamp = '2026-07-15T12:30:00.000Z';
  return {
    activityBriefs: [],
    assumptions: ['Generated assumption'],
    coursePreparation: preparation('provider-captured audience'),
    createdAt: timestamp,
    generatedActivities: [],
    objectives: [
      {
        capability: 'Apply the source rule',
        id: `objective_${draft.id}`,
        sourceConfidence: 'high',
        sourceSupport: 'source_backed',
        status: 'generated',
        title: 'Source-backed objective',
        topicName: 'Source rule',
        updatedAt: timestamp,
      },
    ],
    sourceCoverage: 'source_backed',
    updatedAt: timestamp,
  };
};

const createPreparedDraft = async () => {
  const created = await applyWorkflowAction(ownerId, {
    action: 'createDraft',
    language: 'en',
    operationId: operationId(),
    title: 'Initial title',
  });
  const draftId = created.draft?.id ?? '';
  const sourced = await applyWorkflowAction(ownerId, {
    action: 'addSource',
    draftId,
    expectedRevision: created.draft?.revision ?? 1,
    operationId: operationId(),
    source: {
      content: 'The source says to verify evidence before taking action.',
      name: 'Source notes',
      type: 'notes',
    },
  });
  const prepared = await applyWorkflowAction(ownerId, {
    action: 'updateCoursePreparation',
    draftId,
    expectedRevision: sourced.draft?.revision ?? 2,
    preparation: preparation('original audience'),
  });
  if (prepared.draft === null) {
    throw new Error('Expected a prepared draft.');
  }
  return prepared.draft;
};

const delayedLearningProvider = () => {
  const result =
    Promise.withResolvers<
      Awaited<ReturnType<typeof AiProviderModule.generateLearningPlanWithAi>>
    >();
  const started = Promise.withResolvers<CourseDraft>();
  let calls = 0;
  setAiProviderModuleLoaderForTests(async () => {
    const module = await import('../server/coursition/ai-provider.ts');
    return {
      ...module,
      generateLearningPlanWithAi: (draft: CourseDraft) => {
        calls += 1;
        started.resolve(draft);
        return result.promise;
      },
    };
  });
  return { calls: () => calls, result, started: started.promise };
};

const expectResolvedFindingToSurviveUnrelatedEdit = async (
  draftId: string,
  expectedRevision: number,
) => {
  const staled = await applyWorkflowAction(ownerId, {
    action: 'addSource',
    draftId,
    expectedRevision,
    operationId: operationId(),
    source: {
      content: 'A later source makes generated learning output stale.',
      name: 'Later source',
      type: 'notes',
    },
  });
  const staleFinding = staled.draft?.findings.find((finding) =>
    finding.fingerprint.includes('stale-generated-learning'),
  );
  const resolved = await applyWorkflowAction(ownerId, {
    action: 'setFindingStatus',
    draftId,
    expectedRevision: staled.draft?.revision ?? 0,
    findingId: staleFinding?.id ?? '',
    status: 'resolved',
  });
  const afterUnrelatedEdit = await applyWorkflowAction(ownerId, {
    action: 'updateDraftTitle',
    draftId,
    expectedRevision: resolved.draft?.revision ?? 0,
    title: 'Unrelated title after resolving finding',
  });
  expect(
    afterUnrelatedEdit.draft?.findings.find(
      (finding) => finding.fingerprint === staleFinding?.fingerprint,
    )?.status,
  ).toBe('resolved');
};

beforeEach(() => {
  operationSequence = 0;
  repository = inMemoryDraftRepository();
  setStorageAdapters(repository, inMemorySourceBlobStore());
});

afterEach(() => {
  resetAiProviderModuleLoaderForTests();
  resetStorageAdapters();
});

describe('Coursition server workflow integrity', () => {
  test('merges delayed AI output into the latest draft and executes one operation once', async () => {
    const draft = await createPreparedDraft();
    const provider = delayedLearningProvider();
    const generationOperationId = operationId();
    const generationAction = {
      action: 'generateLearningBlueprint' as const,
      draftId: draft.id,
      expectedRevision: draft.revision,
      operationId: generationOperationId,
    };

    const generation = applyWorkflowAction(ownerId, generationAction);
    const providerDraft = await provider.started;
    expect(providerDraft.revision).toBeGreaterThan(draft.revision);

    const duplicate = await applyWorkflowAction(ownerId, generationAction);
    expect(duplicate.draft?.aiRuns.some((run) => run.status === 'running')).toBe(true);
    expect(provider.calls()).toBe(1);

    const whileRunning = await applyWorkflowAction(ownerId, { action: 'getState' });
    const titled = await applyWorkflowAction(ownerId, {
      action: 'updateDraftTitle',
      draftId: draft.id,
      expectedRevision: whileRunning.draft?.revision ?? 0,
      title: 'Title written while AI was running',
    });
    const prepared = await applyWorkflowAction(ownerId, {
      action: 'updateCoursePreparation',
      draftId: draft.id,
      expectedRevision: titled.draft?.revision ?? 0,
      preparation: preparation('latest concurrent audience'),
    });
    const extraSource = await applyWorkflowAction(ownerId, {
      action: 'addSource',
      draftId: draft.id,
      expectedRevision: prepared.draft?.revision ?? 0,
      operationId: operationId(),
      source: {
        content: 'A second source added while generation is running.',
        name: 'Concurrent source',
        type: 'notes',
      },
    });

    provider.result.resolve({
      model: 'delayed-test-model',
      provider: 'delayed-test-provider',
      text: 'generated blueprint',
      value: generatedBlueprint(providerDraft),
    });
    const generated = await generation;

    expect(generated.draft?.revision).toBeGreaterThan(extraSource.draft?.revision ?? 0);
    expect(generated.draft?.title).toBe('Title written while AI was running');
    expect(generated.draft?.learningBlueprint.coursePreparation.audience).toBe(
      'latest concurrent audience',
    );
    expect(generated.draft?.sources.map((source) => source.name)).toContain('Concurrent source');
    expect(generated.draft?.learningBlueprint.objectives[0]?.title).toBe('Source-backed objective');
    expect(provider.calls()).toBe(1);

    await expectResolvedFindingToSurviveUnrelatedEdit(draft.id, generated.draft?.revision ?? 0);
  });

  test('persists provider failure on the latest draft without restoring captured edits', async () => {
    const draft = await createPreparedDraft();
    const provider = delayedLearningProvider();
    const generation = applyWorkflowAction(ownerId, {
      action: 'generateLearningBlueprint',
      draftId: draft.id,
      expectedRevision: draft.revision,
      operationId: operationId(),
    });
    await provider.started;
    const running = await applyWorkflowAction(ownerId, { action: 'getState' });
    await applyWorkflowAction(ownerId, {
      action: 'updateDraftTitle',
      draftId: draft.id,
      expectedRevision: running.draft?.revision ?? 0,
      title: 'Concurrent title survives provider failure',
    });
    provider.result.reject(new Error('Delayed provider failed'));

    await expect(generation).rejects.toThrow('Delayed provider failed');
    const failed = await applyWorkflowAction(ownerId, { action: 'getState' });
    expect(failed.draft?.title).toBe('Concurrent title survives provider failure');
    expect(
      failed.draft?.aiRuns.some(
        (run) => run.status === 'failed' && run.failureReason?.includes('Delayed provider failed'),
      ),
    ).toBe(true);
  });

  test('recovers an interrupted run and retries it without duplicating applied output', async () => {
    const draft = await createPreparedDraft();
    const interrupted = await Effect.runPromise(
      repository.update(
        {
          ...draft,
          aiRuns: [
            {
              createdAt: '2020-01-01T00:00:00.000Z',
              draftId: draft.id,
              id: `interrupted_${draft.id}`,
              inputSummary: 'Interrupted learning blueprint generation',
              model: 'interrupted-model',
              provider: 'interrupted-provider',
              status: 'running',
              type: 'learning_blueprint_generation',
              updatedAt: '2020-01-01T00:00:00.000Z',
            },
          ],
        },
        draft.revision,
      ),
    );

    const recovered = await applyWorkflowAction(ownerId, { action: 'getState' });
    const recoveredRun = recovered.draft?.aiRuns.find(
      (run) => run.id === `interrupted_${draft.id}`,
    );
    expect(recovered.draft?.revision).toBeGreaterThan(interrupted.revision);
    expect(recoveredRun?.status).toBe('failed');
    expect(recoveredRun?.failureReason).toContain('interrupted');

    let calls = 0;
    setAiProviderModuleLoaderForTests(async () => {
      const module = await import('../server/coursition/ai-provider.ts');
      return {
        ...module,
        generateLearningPlanWithAi: (current: CourseDraft) => {
          calls += 1;
          return Promise.resolve({
            model: 'retry-model',
            provider: 'retry-provider',
            text: 'retry output',
            value: generatedBlueprint(current),
          });
        },
      };
    });
    const retryAction = {
      action: 'retryAiRun' as const,
      draftId: draft.id,
      expectedRevision: recovered.draft?.revision ?? 0,
      operationId: operationId(),
      runId: recoveredRun?.id ?? '',
    };
    const retried = await applyWorkflowAction(ownerId, retryAction);
    const duplicate = await applyWorkflowAction(ownerId, retryAction);

    expect(calls).toBe(1);
    expect(
      retried.draft?.aiRuns.filter(
        (run) => run.type === 'learning_blueprint_generation' && run.status === 'applied',
      ),
    ).toHaveLength(1);
    expect(duplicate.draft?.revision).toBe(retried.draft?.revision);
  });

  test('returns a typed authoritative conflict and rejects missing child IDs without mutation', async () => {
    const draft = await createPreparedDraft();
    const titled = await applyWorkflowAction(ownerId, {
      action: 'updateDraftTitle',
      draftId: draft.id,
      expectedRevision: draft.revision,
      title: 'Authoritative title',
    });

    await expect(
      applyWorkflowAction(ownerId, {
        action: 'updateDraftTitle',
        draftId: draft.id,
        expectedRevision: draft.revision,
        title: 'Stale title',
      }),
    ).rejects.toSatisfy(
      (error: unknown) =>
        Schema.is(CoursitionWorkflowConflict)(error) &&
        error.currentSnapshot.draft?.title === 'Authoritative title',
    );

    const beforeInvalidChild = await applyWorkflowAction(ownerId, { action: 'getState' });
    await expect(
      applyWorkflowAction(ownerId, {
        action: 'updateLearningObjective',
        capability: 'Missing',
        draftId: draft.id,
        expectedRevision: titled.draft?.revision ?? 0,
        objectiveId: 'missing-objective',
        title: 'Missing',
      }),
    ).rejects.toThrow('no longer available');
    const afterInvalidChild = await applyWorkflowAction(ownerId, { action: 'getState' });
    expect(afterInvalidChild.draft?.revision).toBe(beforeInvalidChild.draft?.revision);
  });
});
