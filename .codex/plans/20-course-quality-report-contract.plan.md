---
name: course-quality-report-contract
overview: Add the first-class CourseQualityReport domain contract with hard gates, four scored axes, deterministic observations, findings, evaluator metadata, and hidden optimization telemetry.
todos:
  - id: define-quality-report-types
    content: Add CourseQualityReport, CourseQualityAxisScore, CourseQualityGate, CourseQualityObservation, CourseQualityEvaluator, and optimization telemetry types near the existing ReviewFinding and CourseDraft domain types.
    status: pending
  - id: add-effect-api-schemas
    content: Add matching Effect schemas for the quality report contract and expose the optional qualityReport field through the draft snapshot API shape.
    status: pending
  - id: align-report-with-existing-findings
    content: Represent report findings as ReviewFinding references or ReviewFinding-compatible repair items so quality output reuses the existing review workflow instead of creating a second findings model.
    status: pending
  - id: add-contract-coverage
    content: Add focused contract coverage or type-level checks that prove legacy drafts can omit qualityReport while new snapshots can carry the full report shape.
    status: pending
isProject: false
---

# course-quality-report-contract

## Execution Notes

This lane turns the accepted quality-scoring direction into shared domain and API contracts. The first version is intentionally compact: two hard gates, four scored axes, deterministic observations, existing-style findings, evaluator metadata, and optional optimizer telemetry. The scored axes are `sourceGrounding`, `learningAlignment`, `practiceFeedback`, and `learnerExperience`. Readiness is derived as `blocked | needs_review | ready`; readiness risk is not a peer score.

Useful references:

- [.codex/ideas/learning-quality-score-gepa-next-steps.md](/Users/satan/work/coursition-all/coursition-full-vibe/.codex/ideas/learning-quality-score-gepa-next-steps.md:1)
- [CONTEXT.md](/Users/satan/work/coursition-all/coursition-full-vibe/CONTEXT.md:1)
- [shared/coursition/workflow.ts](/Users/satan/work/coursition-all/coursition-full-vibe/shared/coursition/workflow.ts:242)
- [shared/coursition/effect-api.ts](/Users/satan/work/coursition-all/coursition-full-vibe/shared/coursition/effect-api.ts:299)

## Constraints

Do not introduce many rubric dimensions. Do not expose cost, latency, provider, prompt version, or GEPA run data as creator-facing quality. Keep LLM-as-judge fields optional and versioned; the first implementation can be deterministic only.

## Operator Guidance

This plan gates the evaluator, persistence, UI, and fixture plans. Keep the write scope focused on `shared/coursition/workflow.ts`, `shared/coursition/effect-api.ts`, and narrowly related contract tests. If the existing `setFindingStatus` mismatch appears while touching schemas, fix it only if it is needed for contract consistency.
