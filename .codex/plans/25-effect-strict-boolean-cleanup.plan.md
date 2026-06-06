---
name: effect-strict-boolean-cleanup
overview: Remove the dominant `strictBooleanExpressions` diagnostics by replacing truthy and falsy control flow with explicit null, undefined, length, and boolean checks across shared workflow, API handlers, server modules, and the workflow UI.
todos:
  - id: clean-shared-workflow-booleans
    content: Replace non-boolean conditions in `shared/coursition/workflow.ts` with explicit predicates while preserving gate and finding behavior.
    status: pending
  - id: clean-effect-api-booleans
    content: Replace non-boolean conditions in `api/effect/index.ts` with explicit session, user, cookie, and name checks.
    status: completed
  - id: clean-server-booleans
    content: Replace non-boolean conditions in `server/coursition/store.ts` and `server/coursition/ai-provider.ts` without changing generated course behavior.
    status: pending
  - id: clean-workflow-app-booleans
    content: Replace non-boolean conditions in `src/features/coursition/coursition-workflow-app.tsx` with explicit checks while preserving React render state and navigation behavior.
    status: pending
  - id: verify-strict-boolean-clean
    content: Run an unsuppressed checker pass and confirm no `strictBooleanExpressions` diagnostics remain in the selected cleanup files.
    status: pending
isProject: false
---

# effect-strict-boolean-cleanup

## Execution Notes

The latest unsuppressed main project produced 472 `strictBooleanExpressions` diagnostics. Most of them are local control-flow fixes: optional object checks, optional string checks, `filter(Boolean)`, ternaries on nullable values, and truthy array element checks. This lane should not migrate platform APIs or async control flow; it should keep behavior stable and make later Effect runtime work easier to review.

Useful references:

- [shared/coursition/workflow.ts](/Users/satan/work/coursition-all/coursition-full-vibe/shared/coursition/workflow.ts:816)
- [api/effect/index.ts](/Users/satan/work/coursition-all/coursition-full-vibe/api/effect/index.ts:40)
- [server/coursition/store.ts](/Users/satan/work/coursition-all/coursition-full-vibe/server/coursition/store.ts:571)
- [server/coursition/ai-provider.ts](/Users/satan/work/coursition-all/coursition-full-vibe/server/coursition/ai-provider.ts:104)
- [src/features/coursition/coursition-workflow-app.tsx](/Users/satan/work/coursition-all/coursition-full-vibe/src/features/coursition/coursition-workflow-app.tsx:189)

## Constraints

Do not perform broad refactors just to reduce line count. Avoid changing the public workflow API, persisted draft shape, route names, translations, or Course domain terminology. Treat the dirty working tree as user work and preserve unrelated changes.

## Operator Guidance

This lane can run after `effect-diagnostics-baseline-guard`. It can proceed in parallel with config/platform work. Prefer small patches grouped by file and run focused workflow tests after server/shared edits because these checks touch gate logic and review findings.

`api/effect/index.ts` is complete: cookie fallback, owner id, session user, and optional name checks now use explicit predicates, and the stale API suppression comment was removed. Shared workflow, server, and UI strict-boolean cleanup remain pending because those files are dirty in the shared worktree.
