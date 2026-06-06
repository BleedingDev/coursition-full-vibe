---
name: quality-eval-fixtures-gepa-readiness
overview: Build regression fixtures and comparison tooling so CourseQualityReport can support prompt experiments and later GEPA/Pareto optimization without becoming a fragile vanity metric.
todos:
  - id: define-representative-fixtures
    content: Add or identify fixture coverage for markdown notes, uploaded PDF-style source, URL source, long school script, and compliance or safety training sources.
    status: pending
  - id: add-adversarial-quality-fixtures
    content: Add adversarial cases for verbose-but-bad content, source-citation theater, fake interactivity, meta distractors, and over-personalized unsupported claims.
    status: pending
  - id: add-report-regression-tests
    content: Add regression tests that assert per-fixture readiness, gate behavior, axis floors, observations, and critical findings instead of one averaged score.
    status: pending
  - id: add-generation-comparison-script
    content: Add a script or test helper that runs comparable generation outputs through the report builder and prints per-axis/per-fixture deltas suitable for prompt iteration.
    status: pending
  - id: document-gepa-readiness
    content: Document the future GEPA setup: use held-out fixtures, Pareto axes, textual traces, cost/latency telemetry, and anti-gaming checks only after report behavior is stable.
    status: pending
isProject: false
---

# quality-eval-fixtures-gepa-readiness

## Execution Notes

This lane makes quality measurable across inputs and resistant to optimizer gaming. It should not implement GEPA yet. It should produce stable fixtures, deterministic report expectations, and comparison output that can later feed GEPA or another prompt optimizer.

Useful references:

- [.codex/ideas/learning-quality-score-gepa-next-steps.md](/Users/satan/work/coursition-all/coursition-full-vibe/.codex/ideas/learning-quality-score-gepa-next-steps.md:1)
- [tests/coursition.workflow.test.ts](/Users/satan/work/coursition-all/coursition-full-vibe/tests/coursition.workflow.test.ts:1)
- [tests/coursition.workflow.runner.cjs](/Users/satan/work/coursition-all/coursition-full-vibe/tests/coursition.workflow.runner.cjs:1)

## Constraints

Do not add Mubit memory, real GEPA execution, or model-provider tuning in this lane. Do not average away per-source failures. Keep fixture assertions stable enough to catch regressions without overfitting to exact generated prose.

## Operator Guidance

Depends on `deterministic-course-quality-evaluator`. It can run in parallel with `quality-report-persistence-preview` once the evaluator exists. Prefer deterministic fixtures and textual failure traces over brittle snapshot tests.
