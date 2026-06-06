# Effect-Native Runtime Follow-Ups

Saved on 2026-06-06 after making the workflow UI and AI provider Effect-native enough to pass the generated contract.

## Done In Current Pass

- Browser workflow requests now run as typed Effect programs.
- Browser file reading uses `Effect.tryPromise` at the file API boundary.
- Auth and sign-out flows use Effect instead of `Promise.resolve(...).then(...)`.
- Ax generation calls run through typed Effect programs with deterministic fallback via `Effect.exit`.
- `pnpm ultramodern:check` passes.

## Remaining Debt

The store runtime still uses a scoped low-level Promise generator and a Promise mutation queue in `server/coursition/store.ts`.

Do not mechanically replace it with `Effect.gen`: the existing implementation relies on JS `try/catch` around yielded provider operations. A naive conversion would change failure behavior for:

- missing or unreadable `.coursition-data/workflow.json`
- web extraction provider fallback order
- LlamaParse / Deepgram processing failures
- failed AI generation runs
- serialized draft write mutations

## Safer Plan

1. Add targeted tests for provider failure/fallback behavior and concurrent draft writes.
2. Introduce typed store/provider errors with `Data.TaggedError`.
3. Convert provider helpers to `Effect.Effect` first, preserving fallback behavior through `Effect.exit`.
4. Convert read/write store operations to Effect with an explicit queue abstraction.
5. Remove the scoped Promise lint disables only after behavior-equivalent tests pass.
