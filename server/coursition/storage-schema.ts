import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const courseStore = sqliteTable('coursition_store', {
  id: text('id').primaryKey(),
  payload: text('payload').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const courseDraft = sqliteTable(
  'coursition_draft',
  {
    createdAt: integer('created_at').notNull(),
    id: text('id').primaryKey(),
    lastOperationId: text('last_operation_id'),
    ownerId: text('owner_id').notNull(),
    payload: text('payload').notNull(),
    revision: integer('revision').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    index('coursition_draft_owner_idx').on(table.ownerId),
    index('coursition_draft_owner_updated_idx').on(table.ownerId, table.updatedAt),
  ],
);

export const courseOwnerState = sqliteTable('coursition_owner_state', {
  ownerId: text('owner_id').primaryKey(),
  revision: integer('revision').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const courseOperation = sqliteTable(
  'coursition_operation',
  {
    action: text('action').notNull(),
    completedAt: integer('completed_at'),
    createdAt: integer('created_at').notNull(),
    draftId: text('draft_id'),
    expectedRevision: integer('expected_revision'),
    failureCode: text('failure_code'),
    leaseExpiresAt: integer('lease_expires_at').notNull(),
    leaseToken: text('lease_token').notNull(),
    operationId: text('operation_id').notNull(),
    ownerId: text('owner_id').notNull(),
    requestFingerprint: text('request_fingerprint').notNull(),
    resultRevision: integer('result_revision'),
    status: text('status', { enum: ['pending', 'committed', 'failed'] }).notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.ownerId, table.operationId] }),
    index('coursition_operation_draft_idx').on(table.ownerId, table.draftId),
    index('coursition_operation_lease_idx').on(table.status, table.leaseExpiresAt),
  ],
);

export const courseSourceCleanup = sqliteTable(
  'coursition_source_cleanup',
  {
    attempts: integer('attempts').notNull(),
    cleanupId: text('cleanup_id').primaryKey(),
    createdAt: integer('created_at').notNull(),
    draftId: text('draft_id').notNull(),
    lastError: text('last_error'),
    nextAttemptAt: integer('next_attempt_at').notNull(),
    ownerId: text('owner_id').notNull(),
    reference: text('reference').notNull(),
    sourceId: text('source_id'),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    index('coursition_source_cleanup_due_idx').on(table.nextAttemptAt),
    index('coursition_source_cleanup_owner_idx').on(table.ownerId, table.draftId),
  ],
);
