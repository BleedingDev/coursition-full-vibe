# Coursition data-integrity operator ledger

## Handoff bundle

- Goal: eliminate every audited data-loss, stale-state, storage-lifecycle, autosave, loading, and session-consistency defect and deploy the migrated Cloudflare application.
- Selection: `.codex/plans/3[0-6]-coursition-*.plan.md`
- Graph ID: `30-coursition-integrity-contract-plus-6-plans-204c32596c`
- Selection hash: `204c32596c`
- Snapshot: `.codex/plan-graphs/30-coursition-integrity-contract-plus-6-plans-204c32596c/snapshot.json`
- Dependency edges: contract to D1 and client; D1 to server and source; client to forms; server plus source plus forms to release.
- Config limits: max threads 50 and max depth 3. The live collaboration service accepted root plus two subagents and rejected a third Wave 0 spawn, so the effective runtime budget is three active slots until a slot is released.
- Excluded plans: all pre-existing learning, Effect cleanup, quality-report, and completed UI plans are intentionally outside this runnable graph.

## Launch plan

- Critical path: integrity contract, D1 authority, server workflow integrity, release integration.
- Wave 0 now: root writes and independently reviews the integrity contract; two read-only sidecars prepare D1 and client handoffs without touching shared files.
- Wave 1 after contract: D1 authority and client request ordering become parallel write lanes; root integrates shared contract fallout.
- Wave 2: server workflow, source lifecycle, and form integrity run concurrently with disjoint ownership.
- Wave 3: one integration owner runs migration, staging QA, production deployment, smoke verification, and cleanup.
- Merge points: contract verification before Wave 1, repository verification before server/source, coordinator verification before forms, full fan-in before release.
- Hotspots: `shared/api.ts`, `server/coursition/store.ts`, `server/coursition/storage-schema.ts`, `src/features/coursition/coursition-workflow-app.tsx`, Drizzle migrations, locale files, and shared tests are single-owner at every wave.

## Live lanes

| Lane                 | Agent                           | Write scope                                                                                       | Blocker | Status    | Next action                                                            |
| -------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------- | ------- | --------- | ---------------------------------------------------------------------- |
| integrity-contract   | root                            | shared API contract, storage schema, migration contract tests, plan status                        | none    | completed | guard the finalized contract while downstream lanes compile against it |
| d1-authority         | /root/d1_authority_preflight    | repository, D1/local adapters, blob seam, store integration, migration/backfill, repository tests | none    | completed | 8/8 D1 concurrency and idempotency tests pass                          |
| client-ordering      | /root/client_ordering_preflight | browser coordinator/runtime, workflow client integration, delayed-response tests                  | none    | completed | 13 focused ordering and route tests pass; URL projection verified live |
| form-autosave        | /root/form_autosave_integrity   | form buffers, autosave/flush integration, source draft lifecycle, interaction tests               | none    | completed | 9/9 form tests; combined client/form/route suite 21/21 pass            |
| server-integrity     | /root/server_workflow_integrity | revision-safe workflow dispatch, AI merge/recovery, child invariants, typed conflict tests        | none    | completed | provider-backed generation and the 112-test release gate passed        |
| source-lifecycle     | /root/source_lifecycle_finish   | blob deletion, D1 cleanup outbox, rollback, file limits, lifecycle tests                          | none    | completed | PDF conversion and verified R2 deletion passed in production           |
| contract-risk-review | root                            | shared API and contract tests                                                                     | none    | completed | four focused contract tests pass, including typed HTTP 409             |
| release              | root                            | integration, gates, Cloudflare migration, browser smoke, production cleanup                       | none    | completed | Worker 71888359 deployed; QA removed; invariants all zero/valid        |

## Ownership guard

All implementation waves and the release fan-in are complete. The previous Worker version and the ignored pre-migration D1 export remain available for rollback; production QA data was removed after the smoke test.
