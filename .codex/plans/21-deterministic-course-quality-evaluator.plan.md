---
name: deterministic-course-quality-evaluator
overview: Promote the existing evidence-based learning checks into a reusable deterministic CourseQualityReport builder with hard gates, four scored axes, observations, findings, and reproducible evaluator metadata.
todos:
  - id: extract-evidence-observations
    content: Move the reusable parts of validateLearningEvidence from test-only code into shared workflow evaluator helpers that produce deterministic observations from a CourseDraft, LearningBlueprint, generated activities, source coverage, and findings.
    status: pending
  - id: compute-hard-gates-readiness
    content: Implement factualIntegrity and safetyAccessibilityBaseline gate results plus derived readiness from blocking findings, strict-source violations, text-only output, missing learner action, missing feedback, and unsupported claims.
    status: pending
  - id: score-four-quality-axes
    content: Implement anchored 0-3 scores for sourceGrounding, learningAlignment, practiceFeedback, and learnerExperience using deterministic evidence and repair findings.
    status: pending
  - id: detect-activity-quality-repairs
    content: Add deterministic findings for vague activity briefs, meta distractors, repeated lesson text, missing concrete learner action, missing feedback criteria, and placeholder-like generated choices.
    status: pending
  - id: update-evaluator-tests
    content: Update focused workflow tests so the existing five-course evidence checks assert against CourseQualityReport readiness, gates, axes, observations, and findings.
    status: pending
isProject: false
---

# deterministic-course-quality-evaluator

## Execution Notes

This lane should make the report real without adding an LLM judge. The codebase already has raw evaluator material in `tests/coursition.workflow.runner.cjs` and quality-gate builders in `shared/coursition/workflow.ts`. Promote those checks into reusable pure functions so server actions, tests, and future GEPA scripts can all consume one report builder.

Useful references:

- [tests/coursition.workflow.runner.cjs](/Users/satan/work/coursition-all/coursition-full-vibe/tests/coursition.workflow.runner.cjs:389)
- [shared/coursition/workflow.ts](/Users/satan/work/coursition-all/coursition-full-vibe/shared/coursition/workflow.ts:1366)
- [server/coursition/ai-provider.ts](/Users/satan/work/coursition-all/coursition-full-vibe/server/coursition/ai-provider.ts:1)

## Constraints

Do not add networked model calls or require `AiRunType.teaching_quality_review` in this lane. Do not collapse the report into one vanity score. Keep observations inspectable and stable enough for regression tests.

## Operator Guidance

Depends on `course-quality-report-contract`. This is the best lane for a focused subagent because it has a clear pure-domain write scope. Run focused workflow tests after implementation and leave UI wiring to `quality-report-persistence-preview`.
