---
name: effect-ui-tests-cleanup
overview: Finish diagnostic removal in the React workflow surface and tests, including raw browser fetch, async handlers, test harness Node usage, and the final deletion of every `@effect-diagnostics` comment.
todos:
  - id: extract-workflow-client-boundary
    content: Replace raw workflow API fetch in `coursition-workflow-app.tsx` with the accepted client or Effect boundary while preserving error messages and credentials.
    status: pending
  - id: tame-react-async-handlers
    content: Refactor React async handlers and autosave chains so async control flow is represented through the chosen Effect boundary or isolated framework adapters.
    status: pending
  - id: split-workflow-app-if-needed
    content: Extract focused hooks or helper modules from `coursition-workflow-app.tsx` only where it makes diagnostic cleanup reviewable.
    status: pending
  - id: migrate-test-harness-diagnostics
    content: Remove test-file suppressions by replacing raw Node env and process usage or by adding explicit test adapters that satisfy the selected checker scope.
    status: pending
  - id: delete-all-effect-diagnostic-comments
    content: Remove every remaining `@effect-diagnostics` comment from the repository and confirm the suppression ban passes.
    status: pending
  - id: run-final-quality-gates
    content: Run format, lint, typecheck, i18n check, tests, skills check, and ultramodern contract validation after all suppressions are gone.
    status: pending
isProject: false
---

# effect-ui-tests-cleanup

## Execution Notes

The workflow UI currently accounts for most remaining unsuppressed diagnostics: 307 strict-boolean diagnostics, 56 async diagnostics, and one raw `fetch`. Tests also have suppressions in `coursition.workflow.test.ts` and `coursition.ai-provider.test.ts`, while a direct `tests/tsconfig.json` run revealed existing failures in other test files. This lane is the final convergence point that removes comments everywhere and proves the repository contract.

Useful references:

- [src/features/coursition/coursition-workflow-app.tsx](/Users/satan/work/coursition-all/coursition-full-vibe/src/features/coursition/coursition-workflow-app.tsx:228)
- [tests/coursition.workflow.test.ts](/Users/satan/work/coursition-all/coursition-full-vibe/tests/coursition.workflow.test.ts:1)
- [tests/coursition.ai-provider.test.ts](/Users/satan/work/coursition-all/coursition-full-vibe/tests/coursition.ai-provider.test.ts:1)
- [tests/tsconfig.json](/Users/satan/work/coursition-all/coursition-full-vibe/tests/tsconfig.json:1)

## Constraints

Do not convert the app into a landing page or change user-visible course creation behavior. Keep all user-visible copy in locale files. Avoid a broad UI redesign unless it is necessary to separate Effect adapters from React state management.

## Operator Guidance

This lane depends on server runtime cleanup and strict-boolean cleanup. It should be last because UI and tests import server/shared modules and will inherit their remaining diagnostics. The final acceptance condition is `rg "@effect-diagnostics|effect-diagnostics"` returning no source suppressions and `pnpm ultramodern:check` passing.
