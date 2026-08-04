---
name: coursition-d1-draft-authority
overview: Replace the single global Coursition JSON row with per-draft D1 authority, atomic revision checks, coherent snapshots, and a verified one-time production migration.
todos:
  - id: d1-authority-repository
    content: Implement a Drizzle draft repository that creates, reads, lists, compare-and-swap updates, and deletes rows by draft ID and owner ID without reading or writing unrelated owners.
    status: completed
  - id: d1-authority-atomic-snapshots
    content: Build selected draft and dashboard summaries from one repository read result so a WorkflowSnapshot cannot mix draft and summary versions.
    status: completed
  - id: d1-authority-idempotency
    content: Persist committed operation IDs with their resulting revision so repeated create and draft mutations are idempotent across Worker isolates.
    status: completed
  - id: d1-authority-storage-boundaries
    content: Separate draft-row persistence from source-blob persistence and expose narrow Effect services that server workflow and source lifecycle lanes can use without sharing the old StoreBackend aggregate.
    status: completed
  - id: d1-authority-backfill
    content: Add a one-time migration command that backs up and validates the primary aggregate, inserts each current draft at revision one, and produces aggregate counts without exposing user content.
    status: completed
  - id: d1-authority-concurrency-tests
    content: Add repository integration tests proving two owners and two repository instances cannot erase one another and stale expected revisions return the typed conflict.
    status: completed
isProject: false
---

# coursition-d1-draft-authority

## Execution Notes

The production payload is already 266658 bytes and must no longer grow as one row. Keep the course aggregate as JSON inside each draft row for delivery speed; full domain normalization is out of scope. All writes must be a single conditional D1 update or insert and must inspect the affected-row count.

The migration should be repeatable in dry-run mode and refuse to proceed when draft IDs, owner IDs, or schema decoding are invalid. Runtime reads switch to the new table only after the migration verification succeeds.

## Constraints

Do not add paid Cloudflare services, Durable Objects, queues, or a compatibility read fallback. Preserve BetterAuth tables and unrelated `workers-research` data. Do not print draft titles, source text, email addresses, or provider secrets in migration output. Preserve current owner isolation and current JSON schema validation.

## Operator Guidance

Depends on `coursition-integrity-contract`. This lane owns repository modules, Drizzle persistence, migration/backfill tooling, and the removal of global-row runtime reads. Extract blob operations into a separate module before the source lane starts. It can run in parallel with `coursition-client-request-ordering`.
