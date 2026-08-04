import * as NodeFileSystem from '@effect/platform-node/NodeFileSystem';
import { DateTime, Effect, FileSystem, Schema, Semaphore } from 'effect';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import type { CourseDraft } from '../../shared/coursition/workflow.ts';
import {
  DraftNotFound,
  DraftOperationReuse,
  DraftRepositoryError,
  DraftRevisionConflict,
  decodeDraftPayload,
  initialDraftRevision,
  nextDraftRevision,
  repositoryFailure,
} from './draft-repository.ts';
import type {
  DraftOperationCommit,
  DraftOperationRecord,
  DraftOperationReservation,
  DraftRepository,
  DraftRepositoryFailure,
  OwnerDraftState,
  ReserveDraftOperation,
} from './draft-repository.ts';

interface LocalRepositoryState {
  readonly drafts: CourseDraft[];
  readonly operations: DraftOperationRecord[];
  readonly ownerRevisions: Record<string, number>;
}

interface LocalStateStorage {
  readonly read: () => Effect.Effect<LocalRepositoryState, DraftRepositoryFailure>;
  readonly write: (state: LocalRepositoryState) => Effect.Effect<void, DraftRepositoryFailure>;
}

const emptyState = (): LocalRepositoryState => ({ drafts: [], operations: [], ownerRevisions: {} });
const cloneState = (state: LocalRepositoryState): LocalRepositoryState => structuredClone(state);
const nowMillis = () => DateTime.toEpochMillis(DateTime.nowUnsafe());
const fileSystemRuntime = ManagedRuntime.make(NodeFileSystem.layer);
const unknownJsonStringSchema = Schema.UnknownFromJsonString;

const ownerStateFrom = (state: LocalRepositoryState, ownerId: string): OwnerDraftState => ({
  drafts: state.drafts
    .filter((draft) => draft.ownerId === ownerId)
    .toSorted((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .map((draft) => structuredClone(draft)),
  revision: state.ownerRevisions[ownerId] ?? 0,
});

const committedOperations = (
  operations: readonly DraftOperationRecord[],
  operation: DraftOperationCommit | undefined,
  resultRevision: number,
  timestamp: number,
) => {
  if (operation === undefined) {
    return [...operations];
  }
  const index = operations.findIndex(
    (candidate) =>
      candidate.operationId === operation.operationId &&
      candidate.leaseToken === operation.leaseToken,
  );
  const existing = operations[index];
  if (existing === undefined || existing.status !== 'pending') {
    throw new DraftRepositoryError({ message: 'Draft operation lease is not pending.' });
  }
  const next = [...operations];
  next[index] = {
    ...existing,
    completedAt: timestamp,
    resultRevision,
    status: 'committed',
    updatedAt: timestamp,
  };
  return next;
};

const operationMatches = (operation: DraftOperationRecord, input: ReserveDraftOperation) =>
  operation.action === input.action &&
  operation.requestFingerprint === input.requestFingerprint &&
  operation.draftId === input.draftId &&
  operation.expectedRevision === input.expectedRevision;

const makeLocalDraftRepository = (storage: LocalStateStorage): DraftRepository => {
  const semaphore = Semaphore.makeUnsafe(1);
  const mutate = <A>(
    operation: (state: LocalRepositoryState) => readonly [A, LocalRepositoryState],
  ) =>
    semaphore.withPermits(1)(
      Effect.gen(function* mutateLocalDraftState() {
        const state = yield* storage.read();
        const [result, nextState] = yield* Effect.try({
          catch: (cause) => repositoryFailure(cause, 'Course draft storage failed.'),
          try: () => operation(state),
        });
        yield* storage.write(nextState);
        return result;
      }),
    );

  const read = <A>(operation: (state: LocalRepositoryState) => A) =>
    semaphore.withPermits(1)(
      storage.read().pipe(
        Effect.flatMap((state) =>
          Effect.try({
            catch: (cause) => repositoryFailure(cause, 'Course draft storage failed.'),
            try: () => operation(state),
          }),
        ),
      ),
    );

  return {
    create: (inputDraft, operation) =>
      mutate((state) => {
        if (state.drafts.some((draft) => draft.id === inputDraft.id)) {
          throw new DraftRepositoryError({ message: 'Course draft already exists.' });
        }
        const draft = initialDraftRevision(inputDraft);
        const timestamp = nowMillis();
        return [
          structuredClone(draft),
          {
            ...state,
            drafts: [...state.drafts, draft],
            operations: committedOperations(state.operations, operation, draft.revision, timestamp),
            ownerRevisions: {
              ...state.ownerRevisions,
              [draft.ownerId]: (state.ownerRevisions[draft.ownerId] ?? 0) + 1,
            },
          },
        ];
      }),
    delete: (ownerId, draftId, expectedRevision, operation) =>
      mutate((state) => {
        const draftIndex = state.drafts.findIndex(
          (draft) => draft.id === draftId && draft.ownerId === ownerId,
        );
        const draft = state.drafts[draftIndex];
        if (draft === undefined) {
          throw new DraftNotFound({ draftId, ownerId });
        }
        if (draft.revision !== expectedRevision) {
          throw new DraftRevisionConflict({
            current: ownerStateFrom(state, ownerId),
            draftId,
            expectedRevision,
            ownerId,
          });
        }
        const timestamp = nowMillis();
        const drafts = [...state.drafts];
        drafts.splice(draftIndex, 1);
        return [
          undefined,
          {
            ...state,
            drafts,
            operations: committedOperations(
              state.operations,
              operation,
              expectedRevision + 1,
              timestamp,
            ),
            ownerRevisions: {
              ...state.ownerRevisions,
              [ownerId]: (state.ownerRevisions[ownerId] ?? 0) + 1,
            },
          },
        ];
      }),
    failOperation: (ownerId, operationId, leaseToken, failureCode) =>
      mutate((state) => {
        const index = state.operations.findIndex(
          (operation) => operation.ownerId === ownerId && operation.operationId === operationId,
        );
        const existing = state.operations[index];
        if (
          existing === undefined ||
          existing.status !== 'pending' ||
          existing.leaseToken !== leaseToken
        ) {
          throw new DraftRepositoryError({ message: 'Draft operation lease is not pending.' });
        }
        const timestamp = nowMillis();
        const operation: DraftOperationRecord = {
          ...existing,
          completedAt: timestamp,
          failureCode,
          status: 'failed',
          updatedAt: timestamp,
        };
        const operations = [...state.operations];
        operations[index] = operation;
        return [operation, { ...state, operations }];
      }),
    find: (ownerId, draftId) =>
      read((state) => {
        const draft = state.drafts.find(
          (candidate) => candidate.id === draftId && candidate.ownerId === ownerId,
        );
        if (draft === undefined) {
          throw new DraftNotFound({ draftId, ownerId });
        }
        return structuredClone(draft);
      }),
    readOwnerState: (ownerId) => read((state) => ownerStateFrom(state, ownerId)),
    reserveOperation: (input) =>
      mutate((state) => {
        const existingIndex = state.operations.findIndex(
          (operation) =>
            operation.ownerId === input.ownerId && operation.operationId === input.operationId,
        );
        const existing = state.operations[existingIndex];
        if (existing !== undefined) {
          if (!operationMatches(existing, input)) {
            throw new DraftOperationReuse({
              operationId: input.operationId,
              ownerId: input.ownerId,
            });
          }
          if (existing.status !== 'pending' || existing.leaseExpiresAt > nowMillis()) {
            return [
              {
                kind: existing.status,
                operation: structuredClone(existing),
              } as DraftOperationReservation,
              state,
            ];
          }
        }
        const timestamp = nowMillis();
        const operation: DraftOperationRecord = {
          action: input.action,
          createdAt: existing?.createdAt ?? timestamp,
          ...(input.draftId === undefined ? {} : { draftId: input.draftId }),
          ...(input.expectedRevision === undefined
            ? {}
            : { expectedRevision: input.expectedRevision }),
          leaseExpiresAt: timestamp + input.leaseDurationMs,
          leaseToken: input.leaseToken,
          operationId: input.operationId,
          ownerId: input.ownerId,
          requestFingerprint: input.requestFingerprint,
          status: 'pending',
          updatedAt: timestamp,
        };
        const operations = [...state.operations];
        if (existingIndex === -1) {
          operations.push(operation);
        } else {
          operations[existingIndex] = operation;
        }
        return [
          { kind: 'acquired', operation } as DraftOperationReservation,
          { ...state, operations },
        ];
      }),
    update: (inputDraft, expectedRevision, operation) =>
      mutate((state) => {
        const draftIndex = state.drafts.findIndex(
          (draft) => draft.id === inputDraft.id && draft.ownerId === inputDraft.ownerId,
        );
        const current = state.drafts[draftIndex];
        if (current === undefined) {
          throw new DraftNotFound({ draftId: inputDraft.id, ownerId: inputDraft.ownerId });
        }
        if (current.revision !== expectedRevision) {
          throw new DraftRevisionConflict({
            current: ownerStateFrom(state, inputDraft.ownerId),
            draftId: inputDraft.id,
            expectedRevision,
            ownerId: inputDraft.ownerId,
          });
        }
        const draft = nextDraftRevision(inputDraft, expectedRevision);
        const timestamp = nowMillis();
        const drafts = [...state.drafts];
        drafts[draftIndex] = draft;
        return [
          structuredClone(draft),
          {
            ...state,
            drafts,
            operations: committedOperations(state.operations, operation, draft.revision, timestamp),
            ownerRevisions: {
              ...state.ownerRevisions,
              [draft.ownerId]: (state.ownerRevisions[draft.ownerId] ?? 0) + 1,
            },
          },
        ];
      }),
  };
};

const invalidStoredState = () =>
  new DraftRepositoryError({
    message: 'Stored course draft data does not match the current schema.',
  });

const stateFromUnknown = (value: unknown) =>
  Effect.gen(function* decodeLocalRepositoryState() {
    const record = yield* Effect.try({
      catch: invalidStoredState,
      try: () => {
        if (typeof value !== 'object' || value === null) {
          throw invalidStoredState();
        }
        return value as Record<string, unknown>;
      },
    });
    if (
      !Array.isArray(record['drafts']) ||
      !Array.isArray(record['operations']) ||
      typeof record['ownerRevisions'] !== 'object' ||
      record['ownerRevisions'] === null
    ) {
      return yield* invalidStoredState();
    }
    const drafts = yield* Effect.all(
      record['drafts'].map((draft) =>
        Schema.encodeUnknownEffect(unknownJsonStringSchema)(draft).pipe(
          Effect.mapError(invalidStoredState),
          Effect.flatMap(decodeDraftPayload),
        ),
      ),
    );
    const ownerRevisionEntries = Object.entries(record['ownerRevisions']);
    if (
      ownerRevisionEntries.some(
        ([ownerId, revision]) =>
          ownerId.length === 0 || !Number.isInteger(revision) || Number(revision) < 0,
      )
    ) {
      return yield* invalidStoredState();
    }
    return {
      drafts,
      operations: structuredClone(record['operations']) as DraftOperationRecord[],
      ownerRevisions: Object.fromEntries(ownerRevisionEntries) as Record<string, number>,
    } satisfies LocalRepositoryState;
  });

export const jsonFileDraftRepository = (rootDirectory: string): DraftRepository => {
  const storePath = `${rootDirectory}/workflow.json`;
  const storage: LocalStateStorage = {
    read: () =>
      Effect.tryPromise({
        catch: (cause) => repositoryFailure(cause, 'Course draft storage failed.'),
        try: () =>
          fileSystemRuntime.runPromise(
            Effect.gen(function* readLocalDraftState() {
              const fileSystem = yield* FileSystem.FileSystem;
              if (!(yield* fileSystem.exists(storePath))) {
                return emptyState();
              }
              const contents = yield* fileSystem.readFileString(storePath);
              const parsed = yield* Schema.decodeUnknownEffect(unknownJsonStringSchema)(contents);
              return yield* stateFromUnknown(parsed);
            }),
          ),
      }),
    write: (state) =>
      Effect.tryPromise({
        catch: (cause) => repositoryFailure(cause, 'Course draft storage failed.'),
        try: () =>
          fileSystemRuntime.runPromise(
            Effect.gen(function* writeLocalDraftState() {
              const fileSystem = yield* FileSystem.FileSystem;
              const encoded = yield* Schema.encodeUnknownEffect(unknownJsonStringSchema)(state);
              yield* fileSystem.makeDirectory(rootDirectory, { recursive: true });
              const temporaryPath = `${storePath}.tmp`;
              yield* fileSystem.writeFileString(temporaryPath, `${encoded}\n`);
              yield* fileSystem.rename(temporaryPath, storePath);
            }),
          ),
      }),
  };
  return makeLocalDraftRepository(storage);
};

export const inMemoryDraftRepository = (): DraftRepository => {
  let state = emptyState();
  return makeLocalDraftRepository({
    read: () => Effect.sync(() => cloneState(state)),
    write: (nextState) =>
      Effect.sync(() => {
        state = cloneState(nextState);
      }),
  });
};
