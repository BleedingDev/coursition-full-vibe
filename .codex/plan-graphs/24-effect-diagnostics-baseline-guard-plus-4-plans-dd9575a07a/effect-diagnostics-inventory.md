# Effect Diagnostics Inventory

Captured on 2026-06-06 from a temporary copy of the current dirty worktree.

Method:

- Copied the repository to `/tmp/coursition-effect-diagnostics-*`.
- Excluded `.git`, `.modern`, `.turbo`, `.vera`, `dist`, `dogfood-output`, and `node_modules`.
- Symlinked the live `node_modules` into the temporary copy.
- Removed the first-line Effect diagnostic suppression comments from source files in the temporary copy only.
- Ran the local `effect-tsgo` binary with `--noEmit -p <project> --pretty false`.

## Current Suppressions

The suppression-ban check finds 10 source/test files:

- `api/effect/index.ts`
- `modern.config.ts`
- `server/coursition/ai-provider.ts`
- `server/coursition/auth.ts`
- `server/coursition/store.ts`
- `shared/coursition/workflow.ts`
- `src/features/coursition/coursition-workflow-app.tsx`
- `src/routes/[lang]/course-page-loader.ts`
- `tests/coursition.ai-provider.test.ts`
- `tests/coursition.workflow.test.ts`

## Unsuppressed Main Project

Command in temp copy: `effect-tsgo --noEmit -p tsconfig.json --pretty false`

Exit code: `2`

Total Effect diagnostics: `618`

By category:

| Category                   | Count |
| -------------------------- | ----: |
| `strictBooleanExpressions` |   472 |
| `asyncFunction`            |    90 |
| `processEnv`               |    45 |
| `globalFetch`              |     4 |
| `nodeBuiltinImport`        |     3 |
| `cryptoRandomUUID`         |     2 |
| `globalDate`               |     2 |

By file:

| File                                                  | Total | Categories                                                                                                                                       |
| ----------------------------------------------------- | ----: | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/features/coursition/coursition-workflow-app.tsx` |   371 | `strictBooleanExpressions` 313, `asyncFunction` 57, `globalFetch` 1                                                                              |
| `server/coursition/store.ts`                          |   146 | `strictBooleanExpressions` 95, `processEnv` 25, `asyncFunction` 20, `cryptoRandomUUID` 2, `nodeBuiltinImport` 2, `globalDate` 1, `globalFetch` 1 |
| `server/coursition/ai-provider.ts`                    |    64 | `strictBooleanExpressions` 42, `asyncFunction` 11, `processEnv` 9, `globalDate` 1, `globalFetch` 1                                               |
| `shared/coursition/workflow.ts`                       |    15 | `strictBooleanExpressions` 15                                                                                                                    |
| `modern.config.ts`                                    |    10 | `processEnv` 9, `nodeBuiltinImport` 1                                                                                                            |
| `api/effect/index.ts`                                 |     7 | `strictBooleanExpressions` 7                                                                                                                     |
| `src/routes/[lang]/course-page-loader.ts`             |     3 | `asyncFunction` 2, `globalFetch` 1                                                                                                               |
| `server/coursition/auth.ts`                           |     2 | `processEnv` 2                                                                                                                                   |

## Tests Project Scope

`tests/tsconfig.json` is not added to the SG-24 enforced gate. It already fails with suppressions intact, so enforcing it now would mix the no-suppression guardrail with unrelated existing test checker cleanup.

Current `tests/tsconfig.json` with suppressions intact:

- Exit code: `2`
- Total Effect diagnostics: `52`
- Categories: `asyncFunction` 44, `nodeBuiltinImport` 4, `strictBooleanExpressions` 4
- Files: `tests/coursition.workflow.test.ts` 43, `tests/coursition.i18n.test.ts` 4, `tests/coursition.ai-provider.test.ts` 3, `tests/ultramodern.contract.test.ts` 2

Unsuppressed `tests/tsconfig.json` in the temp copy:

- Exit code: `2`
- Total Effect diagnostics: `139`
- Categories: `strictBooleanExpressions` 61, `asyncFunction` 55, `processEnv` 15, `nodeBuiltinImport` 6, `globalDate` 1, `globalFetch` 1
- Files: `server/coursition/ai-provider.ts` 64, `tests/coursition.workflow.test.ts` 45, `shared/coursition/workflow.ts` 15, `tests/coursition.ai-provider.test.ts` 9, `tests/coursition.i18n.test.ts` 4, `tests/ultramodern.contract.test.ts` 2

SG-28 owns the test checker cleanup and any decision to promote `tests/tsconfig.json` into `ultramodern:check`.
