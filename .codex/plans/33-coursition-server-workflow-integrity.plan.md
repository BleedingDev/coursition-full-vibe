---
name: coursition-server-workflow-integrity
overview: Make every server workflow mutation revision-safe, merge long AI results into current state, recover interrupted runs, and enforce child and finding invariants before committing.
todos:
  - id: server-integrity-repository-adoption
    content: Route every workflow read and mutation through the per-draft repository with owner checks, expected revision, operation identity, and typed conflict propagation.
    status: completed
  - id: server-integrity-ai-merge
    content: Reload the latest draft after each external AI phase and merge only fields owned by that phase so title, sources, preparation, and unrelated edits cannot be restored from a captured stale aggregate.
    status: completed
  - id: server-integrity-run-recovery
    content: Reconcile persisted running AI runs older than the accepted timeout into failed recoverable runs and allow a safe idempotent retry without duplicating applied output.
    status: completed
  - id: server-integrity-child-validation
    content: Reject missing or deleted source, objective, activity brief, AI run, and finding IDs before staling content, changing steps, or incrementing a revision.
    status: completed
  - id: server-integrity-findings
    content: Derive findings from the final post-mutation draft while preserving resolved or dismissed status by fingerprint and never persist findings computed from pre-stale state.
    status: completed
  - id: server-integrity-race-tests
    content: Add delayed-AI and conflicting-mutation tests proving concurrent edits survive success, provider failure, interrupted-run recovery, retry, and regeneration.
    status: completed
isProject: false
---

# coursition-server-workflow-integrity

## Execution Notes

Long provider calls must not hold a draft object as later write authority. Persist the run start, call the provider, reload the current revision, merge the phase-owned result, and commit with CAS. On a conflict, reload and retry only a merge that is explicitly safe; never overwrite or silently discard user changes.

`buildFindings` should observe exactly the draft being committed. Invalid child IDs are errors, not successful no-op mutations.

## Constraints

Preserve Generate and Assist behavior, Ax/OpenRouter provider behavior, source grounding, activity engines, and current user-visible generation results. Do not serialize all users through an in-memory semaphore. Do not use a broad whole-draft merge after external I/O.

## Operator Guidance

Depends on `coursition-d1-draft-authority`. This lane owns workflow orchestration and the mutation and AI sections currently in `server/coursition/store.ts`. Coordinate the narrow source lifecycle import seam with `coursition-source-asset-lifecycle`; that lane owns blob implementation and source processing internals.
