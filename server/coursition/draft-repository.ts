import { Data, DateTime, Effect, Schema } from 'effect';
import { courseDraftSchema } from '../../shared/api.ts';
import type { CourseDraft } from '../../shared/coursition/workflow.ts';

export interface OwnerDraftState {
  readonly drafts: readonly CourseDraft[];
  readonly revision: number;
}

export interface DraftOperationCommit {
  readonly leaseToken: string;
  readonly operationId: string;
}

export interface DraftSourceCleanup {
  readonly reference: string;
  readonly sourceId?: string;
}

export interface ReserveDraftOperation {
  readonly action: string;
  readonly draftId?: string;
  readonly expectedRevision?: number;
  readonly leaseDurationMs: number;
  readonly leaseToken: string;
  readonly operationId: string;
  readonly ownerId: string;
  readonly requestFingerprint: string;
}

export interface DraftOperationRecord {
  readonly action: string;
  readonly completedAt?: number;
  readonly createdAt: number;
  readonly draftId?: string;
  readonly expectedRevision?: number;
  readonly failureCode?: string;
  readonly leaseExpiresAt: number;
  readonly leaseToken: string;
  readonly operationId: string;
  readonly ownerId: string;
  readonly requestFingerprint: string;
  readonly resultRevision?: number;
  readonly status: 'committed' | 'failed' | 'pending';
  readonly updatedAt: number;
}

export type DraftOperationReservation =
  | { readonly kind: 'acquired'; readonly operation: DraftOperationRecord }
  | { readonly kind: 'committed'; readonly operation: DraftOperationRecord }
  | { readonly kind: 'failed'; readonly operation: DraftOperationRecord }
  | { readonly kind: 'pending'; readonly operation: DraftOperationRecord };

export class DraftRepositoryError extends Data.TaggedError('DraftRepositoryError')<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

export class DraftNotFound extends Data.TaggedError('DraftNotFound')<{
  readonly draftId: string;
  readonly ownerId: string;
}> {}

export class DraftRevisionConflict extends Data.TaggedError('DraftRevisionConflict')<{
  readonly current: OwnerDraftState;
  readonly draftId: string;
  readonly expectedRevision: number;
  readonly ownerId: string;
}> {}

export class DraftOperationReuse extends Data.TaggedError('DraftOperationReuse')<{
  readonly operationId: string;
  readonly ownerId: string;
}> {}

export type DraftRepositoryFailure =
  | DraftNotFound
  | DraftOperationReuse
  | DraftRepositoryError
  | DraftRevisionConflict;

export interface DraftRepository {
  readonly create: (
    draft: CourseDraft,
    operation?: DraftOperationCommit,
  ) => Effect.Effect<CourseDraft, DraftRepositoryFailure>;
  readonly delete: (
    ownerId: string,
    draftId: string,
    expectedRevision: number,
    operation?: DraftOperationCommit,
    sourceCleanup?: readonly DraftSourceCleanup[],
  ) => Effect.Effect<void, DraftRepositoryFailure>;
  readonly failOperation: (
    ownerId: string,
    operationId: string,
    leaseToken: string,
    failureCode: string,
  ) => Effect.Effect<DraftOperationRecord, DraftRepositoryFailure>;
  readonly find: (
    ownerId: string,
    draftId: string,
  ) => Effect.Effect<CourseDraft, DraftRepositoryFailure>;
  readonly readOwnerState: (
    ownerId: string,
  ) => Effect.Effect<OwnerDraftState, DraftRepositoryFailure>;
  readonly reserveOperation: (
    input: ReserveDraftOperation,
  ) => Effect.Effect<DraftOperationReservation, DraftRepositoryFailure>;
  readonly update: (
    draft: CourseDraft,
    expectedRevision: number,
    operation?: DraftOperationCommit,
    sourceCleanup?: readonly DraftSourceCleanup[],
  ) => Effect.Effect<CourseDraft, DraftRepositoryFailure>;
}

const draftJsonSchema = Schema.fromJsonString(courseDraftSchema);

export const decodeDraftPayload = (payload: string) =>
  Schema.decodeUnknownEffect(draftJsonSchema)(payload).pipe(
    Effect.mapError(
      (cause) =>
        new DraftRepositoryError({
          cause,
          message: 'Stored course draft data does not match the current schema.',
        }),
    ),
  );

export const encodeDraftPayload = (draft: CourseDraft) =>
  Schema.encodeEffect(draftJsonSchema)(draft).pipe(
    Effect.mapError(
      (cause) =>
        new DraftRepositoryError({
          cause,
          message: 'Course draft data cannot be encoded with the current schema.',
        }),
    ),
  );

export const repositoryFailure = (cause: unknown, message: string) =>
  cause instanceof DraftNotFound ||
  cause instanceof DraftOperationReuse ||
  cause instanceof DraftRepositoryError ||
  cause instanceof DraftRevisionConflict
    ? cause
    : new DraftRepositoryError({ cause, message });

export const nextDraftRevision = (draft: CourseDraft, expectedRevision: number): CourseDraft => ({
  ...draft,
  revision: expectedRevision + 1,
  updatedAt: DateTime.formatIso(DateTime.nowUnsafe()),
});

export const initialDraftRevision = (draft: CourseDraft): CourseDraft => ({
  ...draft,
  revision: 1,
});
