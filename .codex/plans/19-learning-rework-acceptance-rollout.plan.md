---
name: learning-rework-acceptance-rollout
overview: Verify the full learning-objective rework end to end, document decisions, and prepare the implementation for agent handoff or release.
todos:
  - id: add-end-to-end-workflow-tests
    content: Add end-to-end workflow coverage for Generate Mode source-only generation, Generate Mode with optional Learning Goal / Source Focus, Assist Mode editing, strict-source behavior, and preview gating.
    status: pending
  - id: add-ui-acceptance-coverage
    content: Add browser or component coverage for the two-mode picker, assumptions panel, Objective Map, Activity Plan, activity brief editing, and playable preview.
    status: pending
  - id: run-quality-gates
    content: Run format, lint, typecheck, i18n check, focused Rstest suites, and ultramodern contract checks; fix regressions inside the accepted scope.
    status: pending
  - id: document-architecture-decisions
    content: Add ADRs only for hard-to-reverse decisions that are surprising without context, such as Activity Briefs as the editable boundary or optional Agent Memory as non-authoritative.
    status: pending
  - id: update-product-docs
    content: Update PRD/README or implementation notes to reflect Generate/Assist flow, objective-first generation, strict-source behavior, and optional memory adapter boundaries.
    status: pending
  - id: prepare-agent-handoff
    content: Summarize completed work, remaining risks, graph state, and exact verification commands for the next operator or subagent graph.
    status: pending
isProject: false
---

# learning-rework-acceptance-rollout

## Execution Notes

This is the final integration and acceptance lane. It should prove the rework holds together across domain contracts, Ax generation, source retrieval, activity rendering, UI copy, and review findings.

## Constraints

Do not expand scope into per-learner adaptation, teacher dashboards, arbitrary mini-game authoring, or required external memory. Optional MuBit/API memory can be documented or stubbed only if the core course model remains the source of truth.

## Validated Done Boundaries

- This lane verifies integration; it must not introduce new product scope beyond the PRD and completed implementation lanes.
- End-to-end proof must cover Generate Mode source-only, Generate Mode with optional source-bound Learning Goal / Source Focus, Assist Mode edits, Strict-Source behavior, quality findings, and playable preview.
- Acceptance docs should describe current behavior, decisions, and remaining risks. Add ADRs only for decisions that are hard to reverse or surprising without context.
- `add-end-to-end-workflow-tests`: Done when workflow coverage proves source-only generation, source-focus-assisted generation, Assist Mode edits, strict-source blocking, and preview gating.
- `add-ui-acceptance-coverage`: Done when browser or component coverage verifies the two-mode picker, assumptions panel, Objective Map, Activity Plan, Activity Brief editing, and playable preview.
- `run-quality-gates`: Done when format, lint, typecheck, i18n check, focused Rstest suites, and ultramodern checks have recorded results.
- `document-architecture-decisions`: Done when only necessary ADRs are added, especially for Activity Brief as editable boundary or optional Agent Memory as non-authoritative.
- `update-product-docs`: Done when docs reflect Generate/Assist flow, objective-first generation, Strict-Source behavior, and optional memory boundaries.
- `prepare-agent-handoff`: Done when graph state, completed work, remaining risks, changed files, and exact verification commands are summarized for the next operator.

## Operator Guidance

Depends on `course-studio-flow-ui`. Use this lane for broad verification after the implementation lanes finish. If failures reveal missing product decisions, return to the PRD before expanding implementation.
