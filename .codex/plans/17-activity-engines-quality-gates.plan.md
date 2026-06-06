---
name: activity-engines-quality-gates
overview: Implement the v1 constrained activity engines and the teaching quality gates that ensure generated courses are interactive, source-aware, and feedback-driven.
todos:
  - id: model-generated-activities
    content: Add generated activity data derived from Activity Briefs for Retrieval Check, Practice Task, Scenario Decision, Ordering / Matching Activity, and Rubric Answer.
    status: pending
  - id: render-activity-content
    content: Map generated activities into learner-facing course content and preview blocks while keeping activity mechanics regenerable rather than directly editable.
    status: pending
  - id: implement-quality-gates
    content: Add blocking Teaching Quality Gates for missing source material, missing objectives, unsupported strict-source objectives, missing learner action, missing feedback criteria, and text-only output.
    status: pending
  - id: implement-quality-warnings
    content: Add non-blocking warnings for inferred audience/outcome, partial source coverage, suboptimal activity type, difficulty mismatch, lack of variety, and missing spaced review.
    status: pending
  - id: enforce-strict-source-mode
    content: Enforce Strict-Source Mode only when enabled and keep default source-confidence behavior permissive with warnings.
    status: pending
  - id: add-activity-quality-tests
    content: Add tests proving each activity type has learner action and feedback guidance, strict-source blocking works, text-only courses block, and transfer/guided-practice recommendations appear where applicable.
    status: pending
isProject: false
---

# activity-engines-quality-gates

## Execution Notes

Activities are learning engines, not decorations. Every generated activity must map to at least one Learning Objective and carry learner action plus feedback/success criteria.

## Constraints

Do not build a general-purpose mini-game builder. Do not support iframe, Module Federation, MicroVerticals, or custom code activities in v1. Future custom activities should wait until the Activity Brief contract is stable.

## Validated Done Boundaries

- V1 generated activity data is limited to Retrieval Check, Practice Task, Scenario Decision, Ordering / Matching Activity, and Rubric Answer.
- Every generated activity must link to at least one Learning Objective, contain a learner action, carry feedback or success criteria, and include source support/confidence.
- Generated mechanics are regenerable from Activity Briefs; direct mechanic editing is out of scope for this lane.
- Blocking gates are only the PRD gates: no usable source, no objectives, unsupported strict-source objective, missing learner action, missing feedback/success criteria, or text-only course.
- Warnings are non-blocking and must be distinguishable from gates in data and UI-facing output.
- `model-generated-activities`: Done when each v1 activity type has a typed data shape derived from Activity Briefs.
- `render-activity-content`: Done when each generated activity maps into learner-facing preview/content blocks without exposing internal mechanics as editable fields.
- `implement-quality-gates`: Done when blocking findings prevent preview/generation only for the approved blocker list.
- `implement-quality-warnings`: Done when inferred audience/outcome, partial coverage, suboptimal activity, mismatch, low variety, and no spaced review produce warnings only.
- `enforce-strict-source-mode`: Done when unsupported objectives block only with Strict-Source Mode enabled and warn otherwise.
- `add-activity-quality-tests`: Done when tests prove the learner-action, feedback, text-only, strict-source, and transfer/guided-practice invariants.

## Operator Guidance

Depends on `learning-blueprint-domain`. This can run alongside `objective-retrieval-ai` after the shared model lands, but UI integration should wait for both generation and activity contracts.
