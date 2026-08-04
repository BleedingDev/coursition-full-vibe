import { DateTime, Effect } from 'effect';
import { coursitionCloudflareBindings } from './cloudflare-bindings.ts';
import {
  DraftNotFound,
  DraftOperationReuse,
  DraftRepositoryError,
  DraftRevisionConflict,
  decodeDraftPayload,
  encodeDraftPayload,
  initialDraftRevision,
  nextDraftRevision,
  repositoryFailure,
} from './draft-repository.ts';
import type {
  DraftOperationCommit,
  DraftOperationRecord,
  DraftOperationReservation,
  DraftRepository,
  DraftSourceCleanup,
  OwnerDraftState,
  ReserveDraftOperation,
} from './draft-repository.ts';

type DatabaseSource = D1Database | (() => D1Database | Promise<D1Database>);

interface DraftRow {
  readonly created_at: number;
  readonly id: string;
  readonly last_operation_id: string | null;
  readonly owner_id: string;
  readonly payload: string;
  readonly revision: number;
  readonly updated_at: number;
}

interface OperationRow {
  readonly action: string;
  readonly completed_at: number | null;
  readonly created_at: number;
  readonly draft_id: string | null;
  readonly expected_revision: number | null;
  readonly failure_code: string | null;
  readonly lease_expires_at: number;
  readonly lease_token: string;
  readonly operation_id: string;
  readonly owner_id: string;
  readonly request_fingerprint: string;
  readonly result_revision: number | null;
  readonly status: 'committed' | 'failed' | 'pending';
  readonly updated_at: number;
}

const nowMillis = () => DateTime.toEpochMillis(DateTime.nowUnsafe());

const databaseEffect = (source: DatabaseSource) =>
  Effect.tryPromise({
    catch: (cause) => repositoryFailure(cause, 'D1 database binding is unavailable.'),
    try: () => (typeof source === 'function' ? Promise.resolve(source()) : Promise.resolve(source)),
  });

const databaseCall = <A>(message: string, operation: () => Promise<A>) =>
  Effect.tryPromise({
    catch: (cause) => repositoryFailure(cause, message),
    try: operation,
  });

const rowsFrom = <Row>(result: D1Result<unknown>): Row[] => result.results as Row[];
const changesFrom = (result: D1Result<unknown>) => Number(result.meta.changes ?? 0);

const draftFromRow = (row: DraftRow) =>
  decodeDraftPayload(row.payload).pipe(
    Effect.flatMap((draft) =>
      draft.id === row.id && draft.ownerId === row.owner_id && draft.revision === row.revision
        ? Effect.succeed(draft)
        : Effect.fail(
            new DraftRepositoryError({
              message: 'Stored course draft row metadata does not match its payload.',
            }),
          ),
    ),
  );

const operationFromRow = (row: OperationRow): DraftOperationRecord => ({
  action: row.action,
  ...(row.completed_at === null ? {} : { completedAt: row.completed_at }),
  createdAt: row.created_at,
  ...(row.draft_id === null ? {} : { draftId: row.draft_id }),
  ...(row.expected_revision === null ? {} : { expectedRevision: row.expected_revision }),
  ...(row.failure_code === null ? {} : { failureCode: row.failure_code }),
  leaseExpiresAt: row.lease_expires_at,
  leaseToken: row.lease_token,
  operationId: row.operation_id,
  ownerId: row.owner_id,
  requestFingerprint: row.request_fingerprint,
  ...(row.result_revision === null ? {} : { resultRevision: row.result_revision }),
  status: row.status,
  updatedAt: row.updated_at,
});

const operationMatches = (operation: DraftOperationRecord, input: ReserveDraftOperation) =>
  operation.action === input.action &&
  operation.requestFingerprint === input.requestFingerprint &&
  operation.draftId === input.draftId &&
  operation.expectedRevision === input.expectedRevision;

const operationResult = (operation: DraftOperationRecord): DraftOperationReservation => ({
  kind: operation.status,
  operation,
});

const draftColumns = 'created_at, id, last_operation_id, owner_id, payload, revision, updated_at';
const operationColumns =
  'action, completed_at, created_at, draft_id, expected_revision, failure_code, lease_expires_at, lease_token, operation_id, owner_id, request_fingerprint, result_revision, status, updated_at';

const appendCleanupStatements = (
  statements: D1PreparedStatement[],
  database: D1Database,
  ownerId: string,
  draftId: string,
  committedRevision: number,
  timestamp: number,
  sourceCleanup: readonly DraftSourceCleanup[],
) => {
  for (const [index, cleanup] of sourceCleanup.entries()) {
    statements.push(
      database
        .prepare(
          `INSERT INTO coursition_source_cleanup
             (attempts, cleanup_id, created_at, draft_id, last_error, next_attempt_at,
              owner_id, reference, source_id, updated_at)
           SELECT 0, ?, ?, ?, NULL, ?, ?, ?, ?, ? WHERE changes() = 1`,
        )
        .bind(
          `${draftId}:${committedRevision}:${index}`,
          timestamp,
          draftId,
          timestamp,
          ownerId,
          cleanup.reference,
          cleanup.sourceId ?? null,
          timestamp,
        ),
    );
  }
};

export const d1DraftRepository = (source: DatabaseSource): DraftRepository => {
  const readOperation = (ownerId: string, operationId: string) =>
    Effect.gen(function* readOperationProgram() {
      const database = yield* databaseEffect(source);
      const result = yield* databaseCall('Failed to read course operation.', () =>
        database
          .prepare(
            `SELECT ${operationColumns} FROM coursition_operation
             WHERE owner_id = ? AND operation_id = ?`,
          )
          .bind(ownerId, operationId)
          .all<OperationRow>(),
      );
      const [row] = result.results;
      return row === undefined ? undefined : operationFromRow(row);
    });

  const readOwnerState = (ownerId: string) =>
    Effect.gen(function* readOwnerStateProgram() {
      const database = yield* databaseEffect(source);
      const results = yield* databaseCall('Failed to read course drafts.', () =>
        database.batch([
          database
            .prepare('SELECT revision FROM coursition_owner_state WHERE owner_id = ?')
            .bind(ownerId),
          database
            .prepare(
              `SELECT ${draftColumns} FROM coursition_draft
               WHERE owner_id = ? ORDER BY updated_at DESC, id ASC`,
            )
            .bind(ownerId),
        ]),
      );
      const [ownerResult, draftResult] = results;
      if (ownerResult === undefined || draftResult === undefined) {
        return yield* new DraftRepositoryError({ message: 'D1 owner snapshot is incomplete.' });
      }
      const [ownerRow] = rowsFrom<{ revision: number }>(ownerResult);
      const drafts = yield* Effect.all(rowsFrom<DraftRow>(draftResult).map(draftFromRow));
      return { drafts, revision: ownerRow?.revision ?? 0 } satisfies OwnerDraftState;
    });

  const ensureCommitLease = (ownerId: string, operation: DraftOperationCommit) =>
    readOperation(ownerId, operation.operationId).pipe(
      Effect.flatMap((existing) =>
        existing !== undefined &&
        existing.status === 'pending' &&
        existing.leaseToken === operation.leaseToken
          ? Effect.void
          : Effect.fail(
              new DraftRepositoryError({ message: 'Draft operation lease is not pending.' }),
            ),
      ),
    );

  const conflictOrNotFound = (ownerId: string, draftId: string, expectedRevision: number) =>
    readOwnerState(ownerId).pipe(
      Effect.flatMap((current) => {
        const failure: DraftNotFound | DraftRevisionConflict = current.drafts.some(
          (draft) => draft.id === draftId,
        )
          ? new DraftRevisionConflict({ current, draftId, expectedRevision, ownerId })
          : new DraftNotFound({ draftId, ownerId });
        return Effect.fail(failure);
      }),
    );

  const verifyDependentChanges = (
    results: readonly D1Result<unknown>[],
    failureMessage: string,
  ) => {
    if (results.length === 0 || results.some((result) => changesFrom(result) !== 1)) {
      return Effect.fail(new DraftRepositoryError({ message: failureMessage }));
    }
    return Effect.void;
  };

  const verifyConflictIsolation = (
    results: readonly D1Result<unknown>[],
    failureMessage: string,
  ) => {
    if (results.slice(1).some((result) => changesFrom(result) !== 0)) {
      return Effect.fail(new DraftRepositoryError({ message: failureMessage }));
    }
    return Effect.void;
  };

  return {
    create: (inputDraft, operation) =>
      Effect.gen(function* createDraftProgram() {
        const draft = initialDraftRevision(inputDraft);
        const payload = yield* encodeDraftPayload(draft);
        const timestamp = nowMillis();
        const database = yield* databaseEffect(source);
        if (operation !== undefined) {
          yield* ensureCommitLease(draft.ownerId, operation);
        }
        const insert =
          operation === undefined
            ? database
                .prepare(
                  `INSERT INTO coursition_draft
                     (created_at, id, last_operation_id, owner_id, payload, revision, updated_at)
                   VALUES (?, ?, NULL, ?, ?, ?, ?)`,
                )
                .bind(timestamp, draft.id, draft.ownerId, payload, draft.revision, timestamp)
            : database
                .prepare(
                  `INSERT INTO coursition_draft
                     (created_at, id, last_operation_id, owner_id, payload, revision, updated_at)
                   SELECT ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (
                     SELECT 1 FROM coursition_operation
                     WHERE owner_id = ? AND operation_id = ? AND status = 'pending'
                       AND lease_token = ?
                   )`,
                )
                .bind(
                  timestamp,
                  draft.id,
                  operation.operationId,
                  draft.ownerId,
                  payload,
                  draft.revision,
                  timestamp,
                  draft.ownerId,
                  operation.operationId,
                  operation.leaseToken,
                );
        const statements = [insert];
        if (operation !== undefined) {
          statements.push(
            database
              .prepare(
                `UPDATE coursition_operation
                 SET status = 'committed', result_revision = ?, completed_at = ?, updated_at = ?
                 WHERE owner_id = ? AND operation_id = ? AND status = 'pending'
                   AND lease_token = ? AND changes() = 1`,
              )
              .bind(
                draft.revision,
                timestamp,
                timestamp,
                draft.ownerId,
                operation.operationId,
                operation.leaseToken,
              ),
          );
        }
        statements.push(
          database
            .prepare(
              `INSERT INTO coursition_owner_state (owner_id, revision, updated_at)
               SELECT ?, 1, ? WHERE changes() = 1
               ON CONFLICT(owner_id) DO UPDATE
               SET revision = coursition_owner_state.revision + 1, updated_at = excluded.updated_at`,
            )
            .bind(draft.ownerId, timestamp),
        );
        const results = yield* databaseCall('Failed to create course draft.', () =>
          database.batch(statements),
        );
        yield* verifyDependentChanges(results, 'Course draft create was not committed.');
        return draft;
      }),
    delete: (ownerId, draftId, expectedRevision, operation, sourceCleanup = []) =>
      Effect.gen(function* deleteDraftProgram() {
        const database = yield* databaseEffect(source);
        const timestamp = nowMillis();
        if (operation !== undefined) {
          yield* ensureCommitLease(ownerId, operation);
        }
        const deleteStatement = database
          .prepare(
            `DELETE FROM coursition_draft
             WHERE id = ? AND owner_id = ? AND revision = ?${
               operation === undefined
                 ? ''
                 : ` AND EXISTS (
                       SELECT 1 FROM coursition_operation
                       WHERE owner_id = ? AND operation_id = ? AND status = 'pending'
                         AND lease_token = ?
                     )`
             }`,
          )
          .bind(
            draftId,
            ownerId,
            expectedRevision,
            ...(operation === undefined
              ? []
              : [ownerId, operation.operationId, operation.leaseToken]),
          );
        const statements = [deleteStatement];
        if (operation !== undefined) {
          statements.push(
            database
              .prepare(
                `UPDATE coursition_operation
                 SET status = 'committed', result_revision = ?, completed_at = ?, updated_at = ?
                 WHERE owner_id = ? AND operation_id = ? AND status = 'pending'
                   AND lease_token = ? AND changes() = 1`,
              )
              .bind(
                expectedRevision + 1,
                timestamp,
                timestamp,
                ownerId,
                operation.operationId,
                operation.leaseToken,
              ),
          );
        }
        statements.push(
          database
            .prepare(
              `INSERT INTO coursition_owner_state (owner_id, revision, updated_at)
               SELECT ?, 1, ? WHERE changes() = 1
               ON CONFLICT(owner_id) DO UPDATE
               SET revision = coursition_owner_state.revision + 1, updated_at = excluded.updated_at`,
            )
            .bind(ownerId, timestamp),
        );
        appendCleanupStatements(
          statements,
          database,
          ownerId,
          draftId,
          expectedRevision + 1,
          timestamp,
          sourceCleanup,
        );
        const results = yield* databaseCall('Failed to delete course draft.', () =>
          database.batch(statements),
        );
        if (results[0] === undefined || changesFrom(results[0]) !== 1) {
          yield* verifyConflictIsolation(
            results,
            'Course draft delete conflict changed dependent state.',
          );
          return yield* conflictOrNotFound(ownerId, draftId, expectedRevision);
        }
        yield* verifyDependentChanges(results, 'Course draft delete was not committed.');
        return yield* Effect.void;
      }),
    failOperation: (ownerId, operationId, leaseToken, failureCode) =>
      Effect.gen(function* failOperationProgram() {
        const database = yield* databaseEffect(source);
        const timestamp = nowMillis();
        const result = yield* databaseCall('Failed to record course operation failure.', () =>
          database
            .prepare(
              `UPDATE coursition_operation
               SET status = 'failed', failure_code = ?, completed_at = ?, updated_at = ?
               WHERE owner_id = ? AND operation_id = ? AND status = 'pending' AND lease_token = ?`,
            )
            .bind(failureCode, timestamp, timestamp, ownerId, operationId, leaseToken)
            .run(),
        );
        if (changesFrom(result) !== 1) {
          return yield* new DraftRepositoryError({
            message: 'Draft operation lease is not pending.',
          });
        }
        const operation = yield* readOperation(ownerId, operationId);
        if (operation === undefined) {
          return yield* new DraftRepositoryError({
            message: 'Draft operation was not found after update.',
          });
        }
        return operation;
      }),
    find: (ownerId, draftId) =>
      Effect.gen(function* findDraftProgram() {
        const database = yield* databaseEffect(source);
        const result = yield* databaseCall('Failed to read course draft.', () =>
          database
            .prepare(`SELECT ${draftColumns} FROM coursition_draft WHERE owner_id = ? AND id = ?`)
            .bind(ownerId, draftId)
            .all<DraftRow>(),
        );
        const [row] = result.results;
        return row === undefined
          ? yield* new DraftNotFound({ draftId, ownerId })
          : yield* draftFromRow(row);
      }),
    readOwnerState,
    reserveOperation: (input) =>
      Effect.gen(function* reserveOperationProgram() {
        const database = yield* databaseEffect(source);
        const timestamp = nowMillis();
        const leaseExpiresAt = timestamp + input.leaseDurationMs;
        const insertResult = yield* databaseCall('Failed to reserve course operation.', () =>
          database
            .prepare(
              `INSERT OR IGNORE INTO coursition_operation
                 (action, completed_at, created_at, draft_id, expected_revision, failure_code,
                  lease_expires_at, lease_token, operation_id, owner_id, request_fingerprint,
                  result_revision, status, updated_at)
               VALUES (?, NULL, ?, ?, ?, NULL, ?, ?, ?, ?, ?, NULL, 'pending', ?)`,
            )
            .bind(
              input.action,
              timestamp,
              input.draftId ?? null,
              input.expectedRevision ?? null,
              leaseExpiresAt,
              input.leaseToken,
              input.operationId,
              input.ownerId,
              input.requestFingerprint,
              timestamp,
            )
            .run(),
        );
        if (changesFrom(insertResult) === 1) {
          const acquired = yield* readOperation(input.ownerId, input.operationId);
          return acquired === undefined
            ? yield* new DraftRepositoryError({ message: 'Reserved operation cannot be read.' })
            : { kind: 'acquired' as const, operation: acquired };
        }
        const existing = yield* readOperation(input.ownerId, input.operationId);
        if (existing === undefined) {
          return yield* new DraftRepositoryError({ message: 'Reserved operation cannot be read.' });
        }
        if (!operationMatches(existing, input)) {
          return yield* new DraftOperationReuse({
            operationId: input.operationId,
            ownerId: input.ownerId,
          });
        }
        if (existing.status !== 'pending' || existing.leaseExpiresAt > timestamp) {
          return operationResult(existing);
        }
        const takeover = yield* databaseCall('Failed to take over expired course operation.', () =>
          database
            .prepare(
              `UPDATE coursition_operation
               SET lease_expires_at = ?, lease_token = ?, updated_at = ?
               WHERE owner_id = ? AND operation_id = ? AND status = 'pending'
                 AND lease_expires_at <= ?`,
            )
            .bind(
              leaseExpiresAt,
              input.leaseToken,
              timestamp,
              input.ownerId,
              input.operationId,
              timestamp,
            )
            .run(),
        );
        const current = yield* readOperation(input.ownerId, input.operationId);
        if (current === undefined) {
          return yield* new DraftRepositoryError({ message: 'Reserved operation cannot be read.' });
        }
        return changesFrom(takeover) === 1
          ? { kind: 'acquired', operation: current }
          : operationResult(current);
      }),
    update: (inputDraft, expectedRevision, operation, sourceCleanup = []) =>
      Effect.gen(function* updateDraftProgram() {
        const draft = nextDraftRevision(inputDraft, expectedRevision);
        const payload = yield* encodeDraftPayload(draft);
        const database = yield* databaseEffect(source);
        const timestamp = nowMillis();
        if (operation !== undefined) {
          yield* ensureCommitLease(draft.ownerId, operation);
        }
        const updateStatement = database
          .prepare(
            `UPDATE coursition_draft
             SET payload = ?, revision = ?, updated_at = ?, last_operation_id = ?
             WHERE id = ? AND owner_id = ? AND revision = ?${
               operation === undefined
                 ? ''
                 : ` AND EXISTS (
                       SELECT 1 FROM coursition_operation
                       WHERE owner_id = ? AND operation_id = ? AND status = 'pending'
                         AND lease_token = ?
                     )`
             }`,
          )
          .bind(
            payload,
            draft.revision,
            timestamp,
            operation?.operationId ?? null,
            draft.id,
            draft.ownerId,
            expectedRevision,
            ...(operation === undefined
              ? []
              : [draft.ownerId, operation.operationId, operation.leaseToken]),
          );
        const statements = [updateStatement];
        if (operation !== undefined) {
          statements.push(
            database
              .prepare(
                `UPDATE coursition_operation
                 SET status = 'committed', result_revision = ?, completed_at = ?, updated_at = ?
                 WHERE owner_id = ? AND operation_id = ? AND status = 'pending'
                   AND lease_token = ? AND changes() = 1`,
              )
              .bind(
                draft.revision,
                timestamp,
                timestamp,
                draft.ownerId,
                operation.operationId,
                operation.leaseToken,
              ),
          );
        }
        statements.push(
          database
            .prepare(
              `INSERT INTO coursition_owner_state (owner_id, revision, updated_at)
               SELECT ?, 1, ? WHERE changes() = 1
               ON CONFLICT(owner_id) DO UPDATE
               SET revision = coursition_owner_state.revision + 1, updated_at = excluded.updated_at`,
            )
            .bind(draft.ownerId, timestamp),
        );
        appendCleanupStatements(
          statements,
          database,
          draft.ownerId,
          draft.id,
          draft.revision,
          timestamp,
          sourceCleanup,
        );
        const results = yield* databaseCall('Failed to update course draft.', () =>
          database.batch(statements),
        );
        if (results[0] === undefined || changesFrom(results[0]) !== 1) {
          yield* verifyConflictIsolation(
            results,
            'Course draft update conflict changed dependent state.',
          );
          return yield* conflictOrNotFound(draft.ownerId, draft.id, expectedRevision);
        }
        yield* verifyDependentChanges(results, 'Course draft update was not committed.');
        return draft;
      }),
  };
};

export const cloudflareDraftRepository = () =>
  d1DraftRepository(() =>
    coursitionCloudflareBindings().then((bindings) => bindings.COURSITION_DB),
  );
