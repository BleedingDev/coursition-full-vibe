/* eslint-disable promise/avoid-new, unicorn/consistent-function-scoping -- Deterministic deferred promises let tests release responses in an exact out-of-order sequence. */
import { describe, expect, test } from '@rstest/core';
import * as Schema from 'effect/Schema';

import { workflowSnapshotSchema } from '../shared/api.ts';
import { emptyCourseContent, emptyLearningBlueprint } from '../shared/coursition/workflow.ts';
import {
  initialSessionStateFor,
  shouldRevalidateWorkflow,
  WorkflowRequestCoordinator,
  WorkflowTransportError,
  workflowInvalidationKindForSession,
} from '../src/features/coursition/workflow-request-coordinator.ts';
import type { WorkflowRequestTransport } from '../src/features/coursition/workflow-request-coordinator.ts';

const decodeSnapshot = Schema.decodeUnknownSync(workflowSnapshotSchema);

const summary = (id: string, revision: number) => ({
  activityCount: 0,
  id,
  language: 'en',
  mode: 'assist',
  objectiveCount: 0,
  revision,
  sectionCount: 0,
  sourceCount: 0,
  step: 'sources',
  title: id,
  updatedAt: `2026-07-15T00:00:0${revision}.000Z`,
});

const snapshot = (revision: number, summaries = [summary('course_1', revision)]) =>
  decodeSnapshot({
    config: {
      aiProviderConfigured: false,
      auth: 'better-auth',
      deepgramConfigured: false,
      llamaParseConfigured: false,
      storage: 'cloudflare-d1-r2',
      webExtractionConfigured: false,
    },
    draft: null,
    drafts: summaries,
    revision,
  });

const snapshotWithDraft = (
  revision: number,
  step: 'mode' | 'sources',
  mode: 'assist' | 'generate' = 'assist',
) => {
  const timestamp = `2026-07-15T00:00:0${revision}.000Z`;
  return decodeSnapshot({
    config: {
      aiProviderConfigured: false,
      auth: 'better-auth',
      deepgramConfigured: false,
      llamaParseConfigured: false,
      storage: 'cloudflare-d1-r2',
      webExtractionConfigured: false,
    },
    draft: {
      aiRuns: [],
      courseContent: emptyCourseContent(),
      createdAt: timestamp,
      derivedSourceDocuments: [],
      findings: [],
      id: 'course_1',
      knowledgeChunks: [],
      language: 'en',
      learningBlueprint: emptyLearningBlueprint('en'),
      mode,
      ownerId: 'owner_1',
      revision,
      sourceProcessingIncomplete: false,
      sources: [],
      step,
      title: 'course_1',
      updatedAt: timestamp,
    },
    drafts: [{ ...summary('course_1', revision), mode, step }],
    revision,
  });
};

interface Deferred<Value> {
  readonly promise: Promise<Value>;
  readonly reject: (reason: unknown) => void;
  readonly resolve: (value: Value) => void;
}

const deferred = <Value>(): Deferred<Value> => {
  let rejectPromise = (_reason: unknown) => {};
  let resolvePromise = (_value: Value) => {};
  const promise = new Promise<Value>((resolve, reject) => {
    rejectPromise = reject;
    resolvePromise = resolve;
  });
  return { promise, reject: rejectPromise, resolve: resolvePromise };
};

const flushMutationQueue = () =>
  Promise.resolve()
    .then(() => {})
    .then(() => {})
    .then(() => {});

const transportHarness = () => {
  const calls: {
    readonly action: Parameters<WorkflowRequestTransport['request']>[0];
    readonly deferred: Deferred<ReturnType<typeof snapshot>>;
    readonly signal: AbortSignal | undefined;
  }[] = [];
  const transport: WorkflowRequestTransport = {
    request: (action, options) => {
      const pending = deferred<ReturnType<typeof snapshot>>();
      calls.push({ action, deferred: pending, signal: options.signal });
      return pending.promise;
    },
  };
  return { calls, transport };
};

describe('Coursition client request coordinator', () => {
  test('ignores a delayed route response after a newer URL request wins', async () => {
    const harness = transportHarness();
    const coordinator = new WorkflowRequestCoordinator({
      initialRouteKey: 'course_1:sources',
      initialSessionId: 'owner_1',
      initialSnapshot: snapshot(1),
      transport: harness.transport,
    });

    const first = coordinator.read(
      { action: 'getRouteState', draftId: 'course_1', step: 'sources' },
      'course_1:sources',
    );
    const second = coordinator.read(
      { action: 'getRouteState', draftId: 'course_1', step: 'objectives' },
      'course_1:objectives',
    );

    expect(harness.calls[0]?.signal?.aborted).toBe(true);
    harness.calls[1]?.deferred.resolve(snapshot(3));
    const secondOutcome = await second;
    expect(secondOutcome.kind).toBe('applied');
    harness.calls[0]?.deferred.resolve(snapshot(2));
    const firstOutcome = await first;
    expect(firstOutcome.kind).toBe('ignored');
    expect(coordinator.snapshot?.revision).toBe(3);
  });

  test('suppresses intentional read cancellation but preserves real transport failures', async () => {
    const cancellation = deferred<ReturnType<typeof snapshot>>();
    const transportFailure = new Error('transport failed');
    let requestCount = 0;
    const coordinator = new WorkflowRequestCoordinator({
      initialRouteKey: 'course_1:sources',
      initialSessionId: 'owner_1',
      initialSnapshot: snapshot(1),
      transport: {
        request: (_action, { signal }) => {
          requestCount += 1;
          if (requestCount === 1) {
            signal?.addEventListener('abort', () => cancellation.reject(signal.reason), {
              once: true,
            });
            return cancellation.promise;
          }
          return Promise.reject(transportFailure);
        },
      },
    });

    const cancelledRead = coordinator.read(
      { action: 'getRouteState', draftId: 'course_1', step: 'sources' },
      'course_1:sources',
    );
    const failedRead = coordinator.read(
      { action: 'getRouteState', draftId: 'course_1', step: 'objectives' },
      'course_1:objectives',
    );

    await expect(cancelledRead).resolves.toMatchObject({ kind: 'ignored' });
    await expect(failedRead).rejects.toBe(transportFailure);
  });

  test('keeps locale-only navigation on the same route generation', () => {
    const harness = transportHarness();
    const coordinator = new WorkflowRequestCoordinator({
      initialRouteKey: 'course_1:sources',
      initialSessionId: 'owner_1',
      initialSnapshot: snapshot(1),
      transport: harness.transport,
    });
    const generation = coordinator.routeGeneration;

    coordinator.setRoute('course_1:sources');

    expect(coordinator.routeGeneration).toBe(generation);
    expect(harness.calls).toHaveLength(0);
  });

  test('serializes a draft queue and injects the revision current at execution time', async () => {
    const harness = transportHarness();
    const operationIds = ['operation_1', 'operation_2'];
    const coordinator = new WorkflowRequestCoordinator({
      initialRouteKey: 'course_1:sources',
      initialSessionId: 'owner_1',
      initialSnapshot: snapshot(2),
      operationId: () => operationIds.shift() ?? 'unexpected_operation',
      transport: harness.transport,
    });

    const first = coordinator.mutate({ action: 'generateCourse', draftId: 'course_1' });
    const second = coordinator.mutate({ action: 'generateCourse', draftId: 'course_1' });
    await flushMutationQueue();

    expect(harness.calls).toHaveLength(1);
    expect(harness.calls[0]?.action).toMatchObject({
      expectedRevision: 2,
      operationId: 'operation_1',
    });
    harness.calls[0]?.deferred.resolve(snapshot(3));
    await first;
    await flushMutationQueue();
    expect(harness.calls).toHaveLength(2);
    expect(harness.calls[1]?.action).toMatchObject({
      expectedRevision: 3,
      operationId: 'operation_2',
    });
    harness.calls[1]?.deferred.resolve(snapshot(4));
    await second;
  });

  test('merges mutation summaries instead of deleting unrelated drafts', async () => {
    const harness = transportHarness();
    const coordinator = new WorkflowRequestCoordinator({
      initialRouteKey: 'dashboard',
      initialSessionId: 'owner_1',
      initialSnapshot: snapshot(5, [summary('course_1', 2), summary('course_2', 5)]),
      transport: harness.transport,
    });
    const mutation = coordinator.mutate({
      action: 'updateDraftTitle',
      draftId: 'course_1',
      title: 'Changed',
    });
    await flushMutationQueue();
    harness.calls[0]?.deferred.resolve(snapshot(6, [summary('course_1', 3)]));

    await mutation;

    expect(coordinator.snapshot?.drafts.map(({ id }) => id).toSorted()).toEqual([
      'course_1',
      'course_2',
    ]);
  });

  test('keeps non-navigation mutations projected onto the current URL step', async () => {
    const harness = transportHarness();
    const coordinator = new WorkflowRequestCoordinator({
      initialRouteKey: 'course_1:mode',
      initialSessionId: 'owner_1',
      initialSnapshot: snapshotWithDraft(1, 'mode'),
      transport: harness.transport,
    });
    const mutation = coordinator.mutate({
      action: 'setMode',
      draftId: 'course_1',
      mode: 'generate',
    });
    await flushMutationQueue();
    harness.calls[0]?.deferred.resolve(snapshotWithDraft(2, 'sources', 'generate'));

    const outcome = await mutation;

    expect(outcome).toMatchObject({ kind: 'applied' });
    expect(coordinator.snapshot?.draft).toMatchObject({
      mode: 'generate',
      revision: 2,
      step: 'mode',
    });
    expect(coordinator.snapshot?.drafts[0]).toMatchObject({
      mode: 'generate',
      revision: 2,
      step: 'sources',
    });
  });

  test('accepts the persisted step for explicit navigation mutations', async () => {
    const harness = transportHarness();
    const coordinator = new WorkflowRequestCoordinator({
      initialRouteKey: 'course_1:mode',
      initialSessionId: 'owner_1',
      initialSnapshot: snapshotWithDraft(1, 'mode'),
      transport: harness.transport,
    });
    const mutation = coordinator.mutate({
      action: 'goToStep',
      draftId: 'course_1',
      step: 'sources',
    });
    await flushMutationQueue();
    harness.calls[0]?.deferred.resolve(snapshotWithDraft(2, 'sources'));

    await mutation;

    expect(coordinator.snapshot?.draft).toMatchObject({ revision: 2, step: 'sources' });
  });

  test('adopts an authoritative conflict snapshot without retrying the side effect', async () => {
    const harness = transportHarness();
    const currentSnapshot = snapshot(8);
    const coordinator = new WorkflowRequestCoordinator({
      initialRouteKey: 'course_1:sources',
      initialSessionId: 'owner_1',
      initialSnapshot: snapshot(7),
      transport: harness.transport,
    });
    const mutation = coordinator.mutate({ action: 'generateCourse', draftId: 'course_1' });
    await flushMutationQueue();
    harness.calls[0]?.deferred.reject(
      new WorkflowTransportError({
        conflict: {
          currentRevision: 8,
          currentSnapshot,
          draftId: 'course_1',
          expectedRevision: 7,
          message: 'Conflict',
        },
        message: 'Conflict',
        status: 409,
      }),
    );

    const outcome = await mutation;

    expect(outcome.kind).toBe('conflict');
    expect(coordinator.snapshot?.revision).toBe(8);
    expect(harness.calls).toHaveLength(1);
  });

  test('ignores a delayed conflict from an earlier authenticated session', async () => {
    const harness = transportHarness();
    const coordinator = new WorkflowRequestCoordinator({
      initialRouteKey: 'course_1:sources',
      initialSessionId: 'owner_1',
      initialSnapshot: snapshot(7),
      transport: harness.transport,
    });
    const mutation = coordinator.mutate({ action: 'generateCourse', draftId: 'course_1' });
    await flushMutationQueue();

    coordinator.invalidateSession();
    const ownerTwoSnapshot = snapshot(2, [summary('owner_2_course', 2)]);
    coordinator.setSession('owner_2', ownerTwoSnapshot);
    harness.calls[0]?.deferred.reject(
      new WorkflowTransportError({
        conflict: {
          currentRevision: 8,
          currentSnapshot: snapshot(8),
          draftId: 'course_1',
          expectedRevision: 7,
          message: 'Conflict from owner 1',
        },
        message: 'Conflict from owner 1',
        status: 409,
      }),
    );

    const outcome = await mutation;

    expect(outcome.kind).toBe('ignored');
    expect(outcome.snapshot).toBe(ownerTwoSnapshot);
    expect(coordinator.snapshot).toBe(ownerTwoSnapshot);
    expect(coordinator.snapshot?.drafts.map(({ id }) => id)).toEqual(['owner_2_course']);
  });

  test('invalidates the session and ignores later work after a 401', async () => {
    const harness = transportHarness();
    const coordinator = new WorkflowRequestCoordinator({
      initialRouteKey: 'course_1:sources',
      initialSessionId: 'owner_1',
      initialSnapshot: snapshot(2),
      transport: harness.transport,
    });
    const mutation = coordinator.mutate({
      action: 'updateDraftTitle',
      draftId: 'course_1',
      title: 'Changed',
    });
    await flushMutationQueue();
    harness.calls[0]?.deferred.reject(
      new WorkflowTransportError({ conflict: null, message: 'Unauthorized', status: 401 }),
    );

    const unauthorizedOutcome = await mutation;
    expect(unauthorizedOutcome.kind).toBe('unauthorized');
    expect(coordinator.snapshot).toBeNull();
    const laterOutcome = await coordinator.mutate({
      action: 'updateDraftTitle',
      draftId: 'course_1',
      title: 'Later',
    });
    expect(laterOutcome.kind).toBe('unauthorized');
    expect(harness.calls).toHaveLength(1);
  });

  test('does not let an older dashboard read remove a newly created draft', async () => {
    const harness = transportHarness();
    const coordinator = new WorkflowRequestCoordinator({
      initialRouteKey: 'dashboard',
      initialSessionId: 'owner_1',
      initialSnapshot: snapshot(1, []),
      operationId: () => 'create_operation',
      transport: harness.transport,
    });
    const backgroundRead = coordinator.read({ action: 'getState' }, 'dashboard');
    const create = coordinator.mutate({ action: 'createDraft', language: 'en', title: 'New' });
    await flushMutationQueue();
    expect(harness.calls).toHaveLength(2);

    harness.calls[1]?.deferred.resolve(snapshot(3, [summary('new_course', 1)]));
    await create;
    harness.calls[0]?.deferred.resolve(snapshot(2, []));
    await backgroundRead;

    expect(coordinator.snapshot?.drafts.map(({ id }) => id)).toEqual(['new_course']);
    expect(coordinator.snapshot?.revision).toBe(3);
  });

  test('deduplicates warm revalidation without changing the URL generation', () => {
    const harness = transportHarness();
    const coordinator = new WorkflowRequestCoordinator({
      initialRouteKey: 'dashboard',
      initialSessionId: 'owner_1',
      initialSnapshot: snapshot(1),
      transport: harness.transport,
    });
    const { routeGeneration } = coordinator;
    void coordinator.read({ action: 'getState' }, 'dashboard');

    expect(
      shouldRevalidateWorkflow({
        isReading: coordinator.isReadingRoute('dashboard'),
        isVisible: true,
        routeKey: 'dashboard',
        sessionId: 'owner_1',
      }),
    ).toBe(false);
    expect(coordinator.routeGeneration).toBe(routeGeneration);
    expect(
      workflowInvalidationKindForSession(
        { clientId: 'other_tab', kind: 'mutation-committed', ownerId: 'owner_1' },
        { clientId: 'this_tab', ownerId: 'owner_1' },
      ),
    ).toBe('mutation-committed');
    expect(
      workflowInvalidationKindForSession(
        { clientId: 'this_tab', kind: 'mutation-committed', ownerId: 'owner_1' },
        { clientId: 'this_tab', ownerId: 'owner_1' },
      ),
    ).toBeNull();
  });

  test('lets an explicit anonymous loader result override cached authentication', () => {
    const cachedUser = { email: 'cached@example.test', id: 'cached_owner' };

    expect(
      initialSessionStateFor({
        cachedSessionUser: cachedUser,
        initialSessionUser: null,
        sessionProvided: true,
      }),
    ).toEqual({ isResolved: true, user: null });
    expect(
      initialSessionStateFor({
        cachedSessionUser: cachedUser,
        initialSessionUser: undefined,
        sessionProvided: false,
      }),
    ).toEqual({ isResolved: true, user: cachedUser });
  });
});
