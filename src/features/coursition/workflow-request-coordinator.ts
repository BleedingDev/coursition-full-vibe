import * as Schema from 'effect/Schema';
/* eslint-disable promise/prefer-await-to-callbacks -- Promise chaining keeps the coordinator compatible with Effect diagnostics, which reject native async functions. */
import * as Data from 'effect/Data';

import type { SessionUser, WorkflowAction, WorkflowSnapshot } from '@shared/api';
import { workflowActionSchema } from '@shared/api';

type StripCoordinatorFields<Action> = Action extends WorkflowAction
  ? Omit<Action, 'expectedRevision' | 'operationId'>
  : never;

export type WorkflowActionIntent = StripCoordinatorFields<WorkflowAction>;

export interface WorkflowConflictPayload {
  readonly currentRevision: number;
  readonly currentSnapshot: WorkflowSnapshot;
  readonly draftId: string;
  readonly expectedRevision: number;
  readonly message: string;
}

export class WorkflowTransportError extends Data.TaggedError('WorkflowTransportError')<{
  readonly conflict: WorkflowConflictPayload | null;
  readonly message: string;
  readonly status: number | null;
}> {}

export interface WorkflowRequestTransport {
  readonly request: (
    action: WorkflowAction,
    options: { readonly signal?: AbortSignal },
  ) => Promise<WorkflowSnapshot>;
}

export type WorkflowCoordinatorOutcome =
  | {
      readonly canNavigate: boolean;
      readonly kind: 'applied';
      readonly snapshot: WorkflowSnapshot;
    }
  | {
      readonly canNavigate: false;
      readonly kind: 'ignored';
      readonly snapshot: WorkflowSnapshot | null;
    }
  | {
      readonly canNavigate: false;
      readonly conflict: WorkflowConflictPayload;
      readonly kind: 'conflict';
      readonly snapshot: WorkflowSnapshot;
    }
  | { readonly canNavigate: false; readonly kind: 'unauthorized'; readonly snapshot: null };

interface WorkflowRequestCoordinatorOptions {
  readonly initialRouteKey: string | null;
  readonly initialSessionId: string | null;
  readonly initialSnapshot: WorkflowSnapshot | null;
  readonly operationId?: () => string;
  readonly onMutationCommitted?: (event: {
    readonly draftId: string | null;
    readonly revision: number;
  }) => void;
  readonly transport: WorkflowRequestTransport;
}

export const browserOperationId = () => {
  const values = globalThis.crypto.getRandomValues(new Uint32Array(4));
  return [...values].map((value) => value.toString(16).padStart(8, '0')).join('');
};

export const initialSessionStateFor = ({
  cachedSessionUser,
  initialSessionUser,
  sessionProvided,
}: {
  readonly cachedSessionUser: SessionUser | null;
  readonly initialSessionUser: SessionUser | null | undefined;
  readonly sessionProvided: boolean;
}) => ({
  isResolved: sessionProvided || cachedSessionUser !== null,
  user: sessionProvided ? (initialSessionUser ?? null) : cachedSessionUser,
});

export const shouldRevalidateWorkflow = ({
  isReading,
  isVisible,
  routeKey,
  sessionId,
}: {
  readonly isReading: boolean;
  readonly isVisible: boolean;
  readonly routeKey: string | null;
  readonly sessionId: string | null;
}) => isVisible && !isReading && routeKey !== null && sessionId !== null;

export const workflowInvalidationKindForSession = (
  value: unknown,
  session: { readonly clientId: string; readonly ownerId: string },
): 'mutation-committed' | 'session-invalidated' | null => {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const clientId = Reflect.get(value, 'clientId');
  const kind = Reflect.get(value, 'kind');
  const ownerId = Reflect.get(value, 'ownerId');
  if (
    clientId === session.clientId ||
    ownerId !== session.ownerId ||
    (kind !== 'mutation-committed' && kind !== 'session-invalidated')
  ) {
    return null;
  }
  return kind;
};

const operationActions = new Set<WorkflowActionIntent['action']>([
  'addSource',
  'advanceDraft',
  'createDraft',
  'deleteDraft',
  'deleteSource',
  'generateActivities',
  'generateCourse',
  'generateCourseContent',
  'generateLearningBlueprint',
  'goToStep',
  'retryAiRun',
  'retrySource',
]);

const routeTransitionActions = new Set<WorkflowActionIntent['action']>([
  'advanceDraft',
  'createDraft',
  'generateCourse',
  'goToStep',
  'openPreview',
  'retryAiRun',
]);

const isReadIntent = (intent: WorkflowActionIntent) =>
  intent.action === 'getState' ||
  intent.action === 'getRouteState' ||
  intent.action === 'selectDraft';

const draftIdForIntent = (intent: WorkflowActionIntent): string | null =>
  'draftId' in intent && typeof intent.draftId === 'string' ? intent.draftId : null;

const hasExpectedRevision = (intent: WorkflowActionIntent) =>
  intent.action !== 'createDraft' && !isReadIntent(intent);

const summaryById = (snapshot: WorkflowSnapshot, draftId: string) =>
  snapshot.drafts.find((summary) => summary.id === draftId) ?? null;

const draftRevisionFor = (snapshot: WorkflowSnapshot | null, draftId: string) => {
  if (snapshot?.draft?.id === draftId) {
    return snapshot.draft.revision;
  }
  return snapshot === null ? null : (summaryById(snapshot, draftId)?.revision ?? null);
};

const selectedDraftAfterMutation = (
  current: WorkflowSnapshot,
  incoming: WorkflowSnapshot,
  intent: WorkflowActionIntent,
  targetDraftId: string | null,
) => {
  if (intent.action === 'deleteDraft' && current.draft?.id === targetDraftId) {
    return null;
  }
  if (
    incoming.draft === null ||
    (current.draft !== null &&
      current.draft.id !== incoming.draft.id &&
      intent.action !== 'createDraft' &&
      !isReadIntent(intent))
  ) {
    return current.draft;
  }

  const acceptedDraft =
    current.draft?.id !== incoming.draft.id || incoming.draft.revision >= current.draft.revision
      ? incoming.draft
      : current.draft;
  return current.draft?.id === acceptedDraft.id && !routeTransitionActions.has(intent.action)
    ? { ...acceptedDraft, step: current.draft.step }
    : acceptedDraft;
};

const mergeMutationSnapshot = (
  current: WorkflowSnapshot | null,
  incoming: WorkflowSnapshot,
  intent: WorkflowActionIntent,
): WorkflowSnapshot => {
  if (current === null) {
    return incoming;
  }
  if (incoming.revision < current.revision) {
    return current;
  }

  const summaries = new Map(current.drafts.map((summary) => [summary.id, summary]));
  for (const summary of incoming.drafts) {
    const existing = summaries.get(summary.id);
    if (existing === undefined || summary.revision >= existing.revision) {
      summaries.set(summary.id, summary);
    }
  }

  const targetDraftId = draftIdForIntent(intent);
  if (intent.action === 'deleteDraft' && targetDraftId !== null) {
    summaries.delete(targetDraftId);
  }

  const nextDraft = selectedDraftAfterMutation(current, incoming, intent, targetDraftId);

  return {
    config: incoming.config,
    draft: nextDraft,
    drafts: [...summaries.values()].toSorted((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt),
    ),
    revision: Math.max(current.revision, incoming.revision),
  };
};

export class WorkflowRequestCoordinator {
  readonly #listeners = new Set<() => void>();
  readonly #mutationQueues = new Map<string, Promise<unknown>>();
  #onMutationCommitted:
    | ((event: { readonly draftId: string | null; readonly revision: number }) => void)
    | undefined;
  readonly #operationId: () => string;
  #transport: WorkflowRequestTransport;
  #activeReadController: AbortController | null = null;
  #activeReadRouteKey: string | null = null;
  #readGeneration = 0;
  #routeGeneration = 0;
  #routeKey: string | null;
  #sessionEpoch = 0;
  #sessionId: string | null;
  #snapshot: WorkflowSnapshot | null;

  constructor(options: WorkflowRequestCoordinatorOptions) {
    this.#transport = options.transport;
    this.#operationId = options.operationId ?? browserOperationId;
    this.#onMutationCommitted = options.onMutationCommitted;
    this.#routeKey = options.initialRouteKey;
    this.#sessionId = options.initialSessionId;
    this.#snapshot = options.initialSnapshot;
  }

  get routeGeneration() {
    return this.#routeGeneration;
  }

  get routeKey() {
    return this.#routeKey;
  }

  get snapshot() {
    return this.#snapshot;
  }

  isReadingRoute(routeKey: string) {
    return this.#activeReadController !== null && this.#activeReadRouteKey === routeKey;
  }

  subscribe = (listener: () => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  configure({
    onMutationCommitted,
    transport,
  }: {
    readonly onMutationCommitted?: WorkflowRequestCoordinatorOptions['onMutationCommitted'];
    readonly transport: WorkflowRequestTransport;
  }) {
    this.#transport = transport;
    this.#onMutationCommitted = onMutationCommitted;
  }

  setRoute(routeKey: string | null) {
    if (routeKey === this.#routeKey) {
      return;
    }
    this.#routeKey = routeKey;
    this.#routeGeneration += 1;
    this.#readGeneration += 1;
    this.#activeReadController?.abort();
    this.#activeReadController = null;
    this.#activeReadRouteKey = null;
  }

  setSession(sessionId: string | null, snapshot: WorkflowSnapshot | null = null) {
    if (sessionId === this.#sessionId) {
      if (snapshot !== null) {
        this.#applyOrderedSnapshot(snapshot);
      }
      return;
    }
    this.#sessionEpoch += 1;
    this.#sessionId = sessionId;
    this.#snapshot = snapshot;
    this.#routeGeneration += 1;
    this.#readGeneration += 1;
    this.#activeReadController?.abort();
    this.#activeReadController = null;
    this.#activeReadRouteKey = null;
    this.#emit();
  }

  invalidateSession() {
    this.setSession(null, null);
  }

  read(
    action: Extract<WorkflowActionIntent, { action: 'getRouteState' | 'getState' | 'selectDraft' }>,
    routeKey: string,
  ): Promise<WorkflowCoordinatorOutcome> {
    this.setRoute(routeKey);
    this.#activeReadController?.abort();
    const controller = new AbortController();
    this.#activeReadController = controller;
    this.#activeReadRouteKey = routeKey;
    const routeGeneration = this.#routeGeneration;
    const readGeneration = this.#readGeneration + 1;
    this.#readGeneration = readGeneration;
    const sessionEpoch = this.#sessionEpoch;
    const sessionId = this.#sessionId;

    const materializedAction = Schema.decodeUnknownSync(workflowActionSchema)(action);
    return this.#transport
      .request(materializedAction, {
        signal: controller.signal,
      })
      .then((responseSnapshot): WorkflowCoordinatorOutcome => {
        const incoming =
          action.action === 'getState' ? { ...responseSnapshot, draft: null } : responseSnapshot;
        if (
          controller.signal.aborted ||
          sessionEpoch !== this.#sessionEpoch ||
          sessionId !== this.#sessionId ||
          readGeneration !== this.#readGeneration ||
          routeGeneration !== this.#routeGeneration ||
          routeKey !== this.#routeKey
        ) {
          return {
            canNavigate: false,
            kind: 'ignored',
            snapshot: this.#snapshot,
          };
        }
        const snapshot =
          action.action === 'getState'
            ? this.#applyOrderedSnapshot(incoming)
            : this.#applyMutationSnapshot(incoming, action);
        return { canNavigate: true, kind: 'applied', snapshot };
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return {
            canNavigate: false,
            kind: 'ignored',
            snapshot: this.#snapshot,
          } satisfies WorkflowCoordinatorOutcome;
        }
        return this.#handleRequestError(error, sessionEpoch);
      })
      .finally(() => {
        if (this.#activeReadController === controller) {
          this.#activeReadController = null;
          this.#activeReadRouteKey = null;
        }
      });
  }

  mutate(
    intent: Exclude<WorkflowActionIntent, { action: 'getRouteState' | 'getState' | 'selectDraft' }>,
  ) {
    const draftId = draftIdForIntent(intent);
    const queueKey = draftId ?? `owner:${this.#sessionId ?? 'anonymous'}`;
    const operationId = operationActions.has(intent.action) ? this.#operationId() : null;
    const enqueueRouteGeneration = this.#routeGeneration;
    const enqueueSessionEpoch = this.#sessionEpoch;
    const previous = this.#mutationQueues.get(queueKey) ?? Promise.resolve();
    const task = previous
      .catch(() => null)
      .then(() =>
        this.#executeMutation({
          draftId,
          enqueueRouteGeneration,
          enqueueSessionEpoch,
          intent,
          operationId,
        }),
      );
    const tail = task.then(
      () => null,
      () => null,
    );
    this.#mutationQueues.set(queueKey, tail);
    void tail.finally(() => {
      if (this.#mutationQueues.get(queueKey) === tail) {
        this.#mutationQueues.delete(queueKey);
      }
    });
    return task;
  }

  dispose() {
    this.#activeReadController?.abort();
    this.#activeReadController = null;
    this.#activeReadRouteKey = null;
    this.#listeners.clear();
  }

  #executeMutation({
    draftId,
    enqueueRouteGeneration,
    enqueueSessionEpoch,
    intent,
    operationId,
  }: {
    readonly draftId: string | null;
    readonly enqueueRouteGeneration: number;
    readonly enqueueSessionEpoch: number;
    readonly intent: Exclude<
      WorkflowActionIntent,
      { action: 'getRouteState' | 'getState' | 'selectDraft' }
    >;
    readonly operationId: string | null;
  }): Promise<WorkflowCoordinatorOutcome> {
    if (enqueueSessionEpoch !== this.#sessionEpoch || this.#sessionId === null) {
      return Promise.resolve({ canNavigate: false, kind: 'unauthorized', snapshot: null });
    }

    const candidate: Record<string, unknown> = { ...intent };
    if (draftId !== null && hasExpectedRevision(intent)) {
      const expectedRevision = draftRevisionFor(this.#snapshot, draftId);
      if (expectedRevision === null) {
        throw new Error(`Missing authoritative revision for draft ${draftId}.`);
      }
      candidate['expectedRevision'] = expectedRevision;
    }
    if (operationId !== null) {
      candidate['operationId'] = operationId;
    }
    const action = Schema.decodeUnknownSync(workflowActionSchema)(candidate);

    return this.#transport
      .request(action, {})
      .then((incoming): WorkflowCoordinatorOutcome => {
        if (enqueueSessionEpoch !== this.#sessionEpoch) {
          return {
            canNavigate: false,
            kind: 'ignored',
            snapshot: this.#snapshot,
          };
        }
        const snapshot = this.#applyMutationSnapshot(incoming, intent);
        this.#onMutationCommitted?.({ draftId, revision: snapshot.revision });
        return {
          canNavigate: enqueueRouteGeneration === this.#routeGeneration,
          kind: 'applied',
          snapshot,
        };
      })
      .catch((error: unknown) => this.#handleRequestError(error, enqueueSessionEpoch));
  }

  #handleRequestError(error: unknown, requestSessionEpoch: number): WorkflowCoordinatorOutcome {
    if (requestSessionEpoch !== this.#sessionEpoch) {
      return {
        canNavigate: false,
        kind: 'ignored',
        snapshot: this.#snapshot,
      };
    }
    if (error instanceof WorkflowTransportError && error.status === 401) {
      this.invalidateSession();
      return { canNavigate: false, kind: 'unauthorized', snapshot: null };
    }
    if (error instanceof WorkflowTransportError && error.conflict !== null) {
      const snapshot = this.#applyOrderedSnapshot(error.conflict.currentSnapshot);
      return {
        canNavigate: false,
        conflict: error.conflict,
        kind: 'conflict',
        snapshot,
      };
    }
    throw error;
  }

  #applyMutationSnapshot(incoming: WorkflowSnapshot, intent: WorkflowActionIntent) {
    const next = mergeMutationSnapshot(this.#snapshot, incoming, intent);
    if (next !== this.#snapshot) {
      this.#snapshot = next;
      this.#emit();
    }
    return next;
  }

  #applyOrderedSnapshot(incoming: WorkflowSnapshot) {
    if (this.#snapshot !== null && incoming.revision < this.#snapshot.revision) {
      return this.#snapshot;
    }
    if (
      this.#snapshot?.draft !== null &&
      this.#snapshot?.draft !== undefined &&
      incoming.draft?.id === this.#snapshot.draft.id &&
      incoming.draft.revision < this.#snapshot.draft.revision
    ) {
      return this.#snapshot;
    }
    this.#snapshot = incoming;
    this.#emit();
    return incoming;
  }

  #emit() {
    for (const listener of this.#listeners) {
      listener();
    }
  }
}

let browserCoordinator: WorkflowRequestCoordinator | null = null;

export const workflowRequestCoordinatorForBrowser = (
  options: WorkflowRequestCoordinatorOptions,
) => {
  browserCoordinator ??= new WorkflowRequestCoordinator(options);
  browserCoordinator.configure(options);
  return browserCoordinator;
};
