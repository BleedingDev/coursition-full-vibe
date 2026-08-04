import { Data, DateTime, Effect, Exit, Random } from 'effect';
import { coursitionCloudflareBindings } from './cloudflare-bindings.ts';
import type { SourceBlobStore } from './source-blob-store.ts';
import { isSourceBlobReference } from './source-blob-store.ts';

export interface SourceCleanupJob {
  readonly attempts: number;
  readonly cleanupId: string;
  readonly createdAt: number;
  readonly draftId: string;
  readonly nextAttemptAt: number;
  readonly ownerId: string;
  readonly reference: string;
  readonly sourceId?: string;
  readonly updatedAt: number;
}

export interface ScheduleSourceCleanup {
  readonly draftId: string;
  readonly ownerId: string;
  readonly reference: string;
  readonly sourceId?: string;
}

export class SourceCleanupError extends Data.TaggedError('SourceCleanupError')<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

export interface SourceCleanupRepository {
  readonly complete: (cleanupId: string) => Effect.Effect<void, SourceCleanupError>;
  readonly fail: (
    cleanupId: string,
    nextAttemptAt: number,
    failureCode: string,
  ) => Effect.Effect<void, SourceCleanupError>;
  readonly listDue: (
    timestamp: number,
    limit: number,
  ) => Effect.Effect<readonly SourceCleanupJob[], SourceCleanupError>;
  readonly schedule: (
    request: ScheduleSourceCleanup,
  ) => Effect.Effect<SourceCleanupJob, SourceCleanupError>;
}

type DatabaseSource = D1Database | (() => D1Database | Promise<D1Database>);

interface CleanupRow {
  readonly attempts: number;
  readonly cleanup_id: string;
  readonly created_at: number;
  readonly draft_id: string;
  readonly next_attempt_at: number;
  readonly owner_id: string;
  readonly reference: string;
  readonly source_id: string | null;
  readonly updated_at: number;
}

const cleanupFailure = (cause: unknown, message: string) =>
  cause instanceof SourceCleanupError ? cause : new SourceCleanupError({ cause, message });

const nowMillis = () => DateTime.toEpochMillis(DateTime.nowUnsafe());

const jobFromRow = (row: CleanupRow): SourceCleanupJob => ({
  attempts: row.attempts,
  cleanupId: row.cleanup_id,
  createdAt: row.created_at,
  draftId: row.draft_id,
  nextAttemptAt: row.next_attempt_at,
  ownerId: row.owner_id,
  reference: row.reference,
  ...(row.source_id === null ? {} : { sourceId: row.source_id }),
  updatedAt: row.updated_at,
});

const databaseEffect = (source: DatabaseSource) =>
  Effect.tryPromise({
    catch: (cause) => cleanupFailure(cause, 'D1 cleanup database is unavailable.'),
    try: () => (typeof source === 'function' ? Promise.resolve(source()) : Promise.resolve(source)),
  });

const databaseCall = <A>(message: string, operation: () => Promise<A>) =>
  Effect.tryPromise({ catch: (cause) => cleanupFailure(cause, message), try: operation });

export const d1SourceCleanupRepository = (source: DatabaseSource): SourceCleanupRepository => ({
  complete: (cleanupId) =>
    Effect.gen(function* completeSourceCleanupProgram() {
      const database = yield* databaseEffect(source);
      yield* databaseCall('Failed to complete source cleanup.', () =>
        database
          .prepare('DELETE FROM coursition_source_cleanup WHERE cleanup_id = ?')
          .bind(cleanupId)
          .run(),
      );
    }),
  fail: (cleanupId, nextAttemptAt, failureCode) =>
    Effect.gen(function* failSourceCleanupProgram() {
      const database = yield* databaseEffect(source);
      yield* databaseCall('Failed to defer source cleanup.', () =>
        database
          .prepare(
            `UPDATE coursition_source_cleanup
             SET attempts = attempts + 1, last_error = ?, next_attempt_at = ?, updated_at = ?
             WHERE cleanup_id = ?`,
          )
          .bind(failureCode, nextAttemptAt, nowMillis(), cleanupId)
          .run(),
      );
    }),
  listDue: (timestamp, limit) =>
    Effect.gen(function* listDueSourceCleanupProgram() {
      const database = yield* databaseEffect(source);
      const result = yield* databaseCall('Failed to list pending source cleanup.', () =>
        database
          .prepare(
            `SELECT attempts, cleanup_id, created_at, draft_id, next_attempt_at, owner_id,
                    reference, source_id, updated_at
             FROM coursition_source_cleanup
             WHERE next_attempt_at <= ?
             ORDER BY next_attempt_at ASC, created_at ASC
             LIMIT ?`,
          )
          .bind(timestamp, Math.max(1, Math.min(limit, 100)))
          .all<CleanupRow>(),
      );
      return result.results.map(jobFromRow);
    }),
  schedule: (request) =>
    Effect.gen(function* scheduleSourceCleanupProgram() {
      if (!isSourceBlobReference(request.reference)) {
        return yield* new SourceCleanupError({ message: 'Source reference is not an owned blob.' });
      }
      const database = yield* databaseEffect(source);
      const timestamp = nowMillis();
      const randomPart = yield* Random.nextInt;
      const job: SourceCleanupJob = {
        attempts: 0,
        cleanupId: `${request.draftId}:${timestamp}:${Math.abs(randomPart)}`,
        createdAt: timestamp,
        draftId: request.draftId,
        nextAttemptAt: timestamp,
        ownerId: request.ownerId,
        reference: request.reference,
        ...(request.sourceId === undefined ? {} : { sourceId: request.sourceId }),
        updatedAt: timestamp,
      };
      yield* databaseCall('Failed to schedule source cleanup.', () =>
        database
          .prepare(
            `INSERT INTO coursition_source_cleanup
               (attempts, cleanup_id, created_at, draft_id, last_error, next_attempt_at,
                owner_id, reference, source_id, updated_at)
             VALUES (0, ?, ?, ?, NULL, ?, ?, ?, ?, ?)`,
          )
          .bind(
            job.cleanupId,
            job.createdAt,
            job.draftId,
            job.nextAttemptAt,
            job.ownerId,
            job.reference,
            job.sourceId ?? null,
            job.updatedAt,
          )
          .run(),
      );
      return job;
    }),
});

export const cloudflareSourceCleanupRepository = () =>
  d1SourceCleanupRepository(() =>
    coursitionCloudflareBindings().then((bindings) => bindings.COURSITION_DB),
  );

const retryDelayMillis = (attempts: number) =>
  Math.min(60 * 60 * 1000, 60 * 1000 * 2 ** Math.min(attempts, 6));

export interface SourceCleanupSummary {
  readonly completed: number;
  readonly failed: number;
  readonly processed: number;
}

const deleteSourceBlobAndVerify = (blobStore: SourceBlobStore, reference: string) =>
  blobStore.delete(reference).pipe(
    Effect.flatMap(() => blobStore.exists(reference)),
    Effect.map((exists) => !exists),
  );

export const deleteSourceBlobOrSchedule = (
  repository: SourceCleanupRepository,
  blobStore: SourceBlobStore,
  request: ScheduleSourceCleanup,
) =>
  Effect.exit(deleteSourceBlobAndVerify(blobStore, request.reference)).pipe(
    Effect.flatMap((deletion) =>
      Exit.isSuccess(deletion) && deletion.value
        ? Effect.void
        : repository.schedule(request).pipe(Effect.asVoid),
    ),
  );

export const drainSourceCleanup = (
  repository: SourceCleanupRepository,
  blobStore: SourceBlobStore,
  options: { readonly limit?: number; readonly timestamp?: number } = {},
) =>
  Effect.gen(function* drainSourceCleanupProgram() {
    const timestamp = options.timestamp ?? nowMillis();
    const jobs = yield* repository.listDue(timestamp, options.limit ?? 25);
    let completed = 0;
    let failed = 0;
    yield* Effect.forEach(
      jobs,
      (job) =>
        Effect.gen(function* cleanupSourceBlobProgram() {
          const deletion = yield* Effect.exit(deleteSourceBlobAndVerify(blobStore, job.reference));
          if (Exit.isSuccess(deletion) && deletion.value) {
            yield* repository.complete(job.cleanupId);
            completed += 1;
            return;
          }
          const failureCode = Exit.isSuccess(deletion)
            ? 'blob_delete_unverified'
            : 'blob_delete_failed';
          yield* repository.fail(
            job.cleanupId,
            timestamp + retryDelayMillis(job.attempts),
            failureCode,
          );
          failed += 1;
        }),
      { concurrency: 1, discard: true },
    );
    return { completed, failed, processed: jobs.length } satisfies SourceCleanupSummary;
  });
