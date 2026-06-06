---
name: effect-diagnostics-baseline-guard
overview: Establish the enforced no-suppression contract for Effect diagnostics, preserve a reproducible diagnostic inventory, and prevent new `@effect-diagnostics` comments from entering the codebase while cleanup proceeds.
todos:
  - id: capture-unsuppressed-inventory
    content: Re-run the unsuppressed main and test checker experiment and record the current file by category inventory for the cleanup branch.
    status: completed
  - id: add-suppression-ban
    content: Add a repository check that fails when any source file contains `@effect-diagnostics` and wire it into the existing quality gate.
    status: completed
  - id: define-test-typecheck-scope
    content: Decide and encode whether `tests/tsconfig.json` is an enforced gate for this cleanup, including handling existing test-only checker failures.
    status: completed
  - id: remove-stale-suppression-tokens
    content: Record that stale token-only cleanup is superseded by the suppression-ban gate; later cleanup lanes must delete whole comments instead of narrowing categories.
    status: completed
isProject: false
---

# effect-diagnostics-baseline-guard

## Execution Notes

This lane turns the investigation into an enforceable contract before broad edits start. The latest inventory artifact found 10 file-scope `@effect-diagnostics` comments and 618 main-project Effect diagnostics after removing them in a temporary copy. The largest categories were `strictBooleanExpressions`, `asyncFunction`, and `processEnv`.

Useful references:

- [tsconfig.json](/Users/satan/work/coursition-all/coursition-full-vibe/tsconfig.json:29)
- [package.json](/Users/satan/work/coursition-all/coursition-full-vibe/package.json:7)
- [CONTEXT.md](/Users/satan/work/coursition-all/coursition-full-vibe/CONTEXT.md:1)
- [effect-diagnostics-inventory.md](/Users/satan/work/coursition-all/coursition-full-vibe/.codex/plan-graphs/24-effect-diagnostics-baseline-guard-plus-4-plans-dd9575a07a/effect-diagnostics-inventory.md:1)

## Constraints

Do not weaken Effect diagnostic severity. Do not remove diagnostics from `tsconfig.json`. Do not touch unrelated generated plans or graph snapshots. The check should be simple enough to run locally and in existing `pnpm ultramodern:check`.

## Operator Guidance

This plan is the root of the graph. The suppression ban is now wired into `pnpm ultramodern:check` through `pnpm effect-diagnostics:check`, so the full gate intentionally fails until downstream lanes delete every suppression comment. `tests/tsconfig.json` remains outside `ultramodern:check` for SG-24 because it already fails with suppressions intact; SG-28 owns test checker cleanup and any later promotion of that project to an enforced gate.
