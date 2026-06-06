---
name: learning-rework-baseline-repair
overview: Repair the interrupted post-freeze workspace enough for the source-material-first rework to proceed, without restoring the old wizard workflow as the durable baseline.
todos:
  - id: inspect-current-breakage
    content: Run focused format, lint, typecheck, i18n, test, and ultramodern commands far enough to classify every blocker for the source-material rework.
    status: completed
  - id: reconcile-shared-contract
    content: Make shared workflow types, Effect API schemas, store normalization, and route data agree on Generate/Assist-only mode handling without preserving removed wizard concepts as product concepts.
    status: in_progress
  - id: remove-legacy-baseline-tests
    content: Rewrite or delete tests and normalization paths that preserve removed draft shapes such as GuidedQuestions, Topic, TargetLearner, Chapter, Lesson, LessonBlock, old Manual Mode drafts, or old builder routes.
    status: pending
  - id: preserve-human-authored-content
    content: Verify that existing human-authored provenance/sourceSupport still round-trips during baseline repair without preserving legacy content concepts as final model concepts.
    status: pending
  - id: restore-baseline-gates
    content: Clear or explicitly isolate current blockers: plan artifact formatting, lint failures, i18n checker/code false positive, AI provider config test failures or coordinated Effect-lane ownership, typecheck, and focused workflow tests.
    status: pending
isProject: false
---

# learning-rework-baseline-repair

## Execution Notes

This lane starts from the public freeze at `v0.1.0-freeze`, but the local workspace contains interrupted source-material workflow edits. Repair only the compile/test/i18n/lint baseline needed to continue the source-material-first rework. Do not rebuild the old questions/topics/target/chapters/lessons/builder wizard as the baseline.

Known current blockers from validation:

- format check fails on plan graph artifacts
- lint fails across current rework files
- i18n check flags a TypeScript generic/checker false positive
- AI provider config tests fail because production/remote cases select the local fallback provider
- `pnpm ultramodern:check` cannot pass until the above are resolved or explicitly coordinated

## Constraints

Do not build the new objective/activity system in this lane. Do not remove human-authored `manual` provenance or source support while repairing the baseline. Do not keep compatibility tests, normalization branches, adapters, or shims for removed legacy draft shapes. Treat old wizard tests as rewrite/delete targets unless they protect a still-valid invariant such as owner isolation, source grounding, i18n, or source lifecycle.

Avoid `server/coursition/config.ts` unless a current gate cannot be isolated any other way. If AI provider config failures require touching config/platform direction, coordinate that ownership with the separate Effect cleanup graph instead of folding broad config work into this lane.

## Validated Done Boundaries

- `inspect-current-breakage`: Done when the failing commands and failing files are listed, with failures grouped as type/schema/store/UI/test issues rather than mixed together.
- `reconcile-shared-contract`: Done when Course Mode is normalized to Generate/Assist only across shared workflow types, Effect API schemas, store data, and route data, with no partial fields required by callers and no product dependency on removed wizard concepts.
- `remove-legacy-baseline-tests`: Done when tests/normalization that only preserve old local draft shapes or old wizard routes are rewritten around source-material invariants or deleted.
- `preserve-human-authored-content`: Done when existing human-authored or `manual` provenance/sourceSupport values still round-trip during the repair step, with no claim that legacy content structures remain part of the target model.
- `restore-baseline-gates`: Done when source-rework baseline blockers are fixed or isolated and verification output is recorded for format, lint, typecheck, i18n check, focused workflow tests, and any failing AI provider config tests. Do not fix unrelated pre-existing issues unless they block those gates.

## Operator Guidance

This is the root of the graph. No downstream feature lane should start until this plan passes typecheck and focused workflow tests or has a recorded, narrow blocker owned by another graph. Prefer small baseline fixes, but do not preserve the old wizard to make legacy tests green.
