---
name: coursition-integrity-contract
overview: Establish the revisioned workflow and persistence contract that every storage, server, and client integrity repair will implement, without changing the creator-facing course flow.
todos:
  - id: integrity-contract-revision-model
    content: Add an integer draft revision to CourseDraft, CourseDraftSummary, and WorkflowSnapshot and require expectedRevision on every mutating draft-scoped workflow action.
    status: completed
  - id: integrity-contract-operation-identity
    content: Add operationId to non-repeatable create, source, generation, and destructive actions so duplicate submissions can return the already committed result instead of repeating side effects.
    status: completed
  - id: integrity-contract-conflict-api
    content: Add a typed HTTP 409 workflow conflict response carrying the current draft revision and enough current snapshot data for deterministic client reconciliation.
    status: completed
  - id: integrity-contract-d1-schema
    content: Define the Drizzle and SQL schema for one coursition_draft row per draft with owner, JSON payload, revision, created and updated timestamps, plus owner and recency indexes.
    status: completed
  - id: integrity-contract-schema-tests
    content: Update shared schema round-trip and API contract tests for revisions, expected revisions, operation identity, and typed conflict responses.
    status: completed
isProject: false
---

# coursition-integrity-contract

## Execution Notes

This is the short convergence lane. The accepted authority model is one D1 row per course draft, a monotonically increasing integer revision, compare-and-swap writes, and explicit operation identity for actions that must not execute twice. A successful mutation returns the committed revision. A conflicting mutation never silently overwrites newer data.

Useful evidence is in `shared/api.ts`, `server/coursition/storage-schema.ts`, `drizzle/0000_magical_inertia.sql`, and the data-integrity audit summarized in the conversation.

## Constraints

Do not change UI layout, Course Mode, workflow step names, source-tab behavior, translations, or generated-course semantics. Do not add a runtime fallback to the global `coursition_store` payload. The old row may be retained temporarily as a rollback backup during migration, but the new runtime contract must fail clearly rather than silently reading old storage.

## Operator Guidance

Run this lane first and keep it small. It owns `shared/api.ts`, the new conflict type, and the new Drizzle table definition. `coursition-d1-draft-authority` and `coursition-client-request-ordering` may launch in parallel only after this plan completes. Run focused schema and API tests before opening the frontier.
