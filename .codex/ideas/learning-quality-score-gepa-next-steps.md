# Learning Quality Score, GEPA, and Memory Next Steps

Saved from the learning-generation rework discussion on 2026-06-06.

## Context

The current learning rework can generate source-grounded courses with objectives, activity briefs, generated activities, quality findings, and a playable preview. The next step should make course quality measurable, comparable, and optimizable without adding too much product complexity or turning the score into a fragile vanity metric.

## Saved Product Direction

1. Keep the current pipeline: source material -> course preparation -> objectives -> activity briefs -> generated course -> preview.
2. Avoid arbitrary generated mini-app code for now. Prefer reusable activity engines with strict specs.
3. Build polished reusable engines for retrieval checks, scenario decisions, ordering/matching, practice tasks, and rubric answers.
4. Add stricter activity-quality validation to reject meta distractors, vague tasks, repeated lesson text, and activities without concrete learner action.
5. Add a separate learner mode that hides creator controls and presents lesson -> activity -> feedback -> progress.
6. Add a persisted course quality report as a first-class domain object.
7. Add "regenerate this activity" from creator preview after quality findings identify a weak activity.
8. Keep personalization at generation time for now, saving target learner, prior knowledge, outcome, depth, practice style, constraints, and source strictness.
9. Use Mubit later for memory over learner preferences, teacher style, successful quality reports, domain teaching patterns, and recurring weak spots.
10. Use GEPA/Pareto optimization later after the quality report is stable, so optimization improves measured course quality instead of amplifying a weak metric.
11. Keep the quality report compact and orthogonal. Use a few stable dimensions plus evidence-backed findings instead of a long checklist of semi-overlapping scores.
12. Treat dimension count as a design risk. Before implementation, validate whether each proposed score adds independent decision value or merely restates another dimension.
13. Design the report for evaluator calibration and anti-gaming from the start: every numeric score should have observable anchors, counterexamples, and concrete repair actions.

## Recommended Next Product Slice

1. Persist a compact CourseQualityReport on the generated course draft.
2. Show the report in creator preview as a concise quality panel, not a complex analytics dashboard.
3. Convert the current evidence-based runtime checks into reusable evaluator functions.
4. Add fixture-based regression evals for the five representative generation cases: markdown notes, uploaded PDF, URL source, long school script, and compliance/safety training.
5. Add a generation-comparison script that runs the same source through generation variants and outputs report deltas.

## Resume-Ready Implementation Checklist

1. Creator-facing: add a small preview quality panel with readiness, source grounding, learner fit, activity strength, and blocking findings.
2. Learner-facing: add a separate learner mode that removes builder controls and runs lesson -> activity -> feedback -> progress.
3. Activity engine: replace generic generated activity display with validated specs for retrieval, scenario, ordering/matching, practice, and rubric activities.
4. Evaluator: promote the current evidence checks into reusable report builders with deterministic gates first and judge-based checks later.
5. Optimizer-facing: store raw evaluator observations separately from creator-facing labels so GEPA can optimize tradeoffs without forcing a fake single score.
6. Memory-facing: keep Mubit optional until report schema and eval fixtures are stable, then feed remembered preferences into generation context rather than hidden scoring state.

## GEPA / Pareto Optimization Frame

Treat CourseQualityReport as the eval substrate for later GEPA experiments. Optimize across a small set of visible tradeoff axes instead of collapsing everything into one vanity score:

- learning quality
- source/content validity
- activity and feedback quality
- learner fit and usability
- latency and cost, as optimizer telemetry only

Readiness risk should be derived from gates and open findings, not treated as an independent Pareto axis.

## Non-Goals For The Next Slice

- Do not generate arbitrary activity code, iframe mini-apps, or module-federated micro-frontends yet.
- Do not add adaptive mastery tracking before the learner experience exists.
- Do not add Mubit memory into the core generation loop until the report schema is stable.
- Do not optimize with GEPA against a single vanity score; keep tradeoffs inspectable.
- Do not add many dimensions just because they sound pedagogically relevant. Prefer fewer orthogonal axes that can survive regression tests, model comparison, and prompt optimization.

## Initial Quality Report Shape To Revisit

Use a compact report with a few aggregate dimensions rather than many independent scores. Candidate dimensions:

- Learning alignment
- Source grounding/content validity
- Practice and feedback quality
- Learner experience/fit
- Operational cost and latency, stored only for optimization experiments, not creator-facing quality

Each dimension should carry evidence-backed findings, not only a number. The score should be useful for regression evals and optimization, but the product UI should emphasize readiness, weak spots, and concrete repair actions.

## 2026-06-06 Research Update

External rubric and prompt-optimization research pushes this toward a smaller analytic rubric rather than many loosely related dimensions.

Key implications:

1. Keep the creator-facing score small. A good first report should have 4 orthogonal scored dimensions, hard gates, and a derived readiness state, not a radar chart with 10+ scores.
2. Treat "overall score" as derived, optional, and secondary. Store raw evaluator observations and findings so optimization can inspect tradeoffs without hiding them behind one number.
3. Prefer anchored criteria over vague scales. Every score needs observable anchors, examples, and failure cases.
4. Separate deterministic gates from judge-based judgments. Deterministic gates should cover mapping, source references, missing activities, missing feedback, unsupported strict-source objectives, and text-only output. LLM judges can later assess natural distractors, activity realism, learner fit, and engagement quality.
5. Calibrate before optimizing. Any judge-based score should be checked against human-labeled examples and versioned with rubric version, judge model, prompt version, and calibration set.
6. Use Pareto optimization only after the report is stable. GEPA should optimize across separate tradeoff axes and per-case failures, not a single vanity score.
7. Add anti-gaming checks before GEPA. Optimizers can learn to satisfy brittle criteria, so keep adversarial fixtures for verbose-but-bad content, source-citation theater, fake interactivity, meta distractors, and over-personalized unsupported claims.

Recommended first `CourseQualityReport` shape:

- `readiness`: `blocked | needs_review | ready`
- `hardGates`: `factualIntegrity`, `safetyAccessibilityBaseline`
- `dimensions`: `sourceGrounding`, `learningAlignment`, `practiceFeedback`, `learnerExperience`
- `observations`: deterministic booleans/counts already produced by the workflow validator
- `findings`: existing `ReviewFinding`-style repair items, or references to them
- `evaluator`: rubric version, deterministic/judge mode, judge model if used, evaluatedAt
- `optimizationTelemetry`: optional hidden metadata for generation cost, latency, provider/model, prompt version, input hash, output hash

GEPA-facing note:

The useful Pareto axes are probably not the same as creator-facing dimensions. Start with `learning_quality`, `source_validity`, `activity_quality`, `learner_fit`, and `cost_latency`. Maintain per-fixture/per-source scores so a prompt that improves PDF courses but hurts URL courses can remain visible on the frontier instead of being averaged away.

## Proposed Minimal CourseQualityReport Direction

Treat the report as an evaluator artifact first and a creator-facing UI feature second. This restates the implementation stance from the research update in product terms:

- Persist deterministic checks before adding LLM-as-judge dimensions.
- Prefer 4 independent dimensions with explicit evidence and findings; avoid a wide dashboard of loosely correlated scores.
- Separate creator-facing readiness from optimizer-facing metrics. Creators need "ready / needs review / blocked" with actionable findings; GEPA needs raw component scores and textual traces.
- Keep unsupported-claim risk and source coverage as hard gates for source-grounded courses.
- Keep engagement as a finding-backed activity-quality signal, not an early standalone score, until there is learner outcome data.
- Store evaluator version, generation inputs hash, source strictness, and model/provider metadata so quality deltas are reproducible.

## Future GEPA Setup

GEPA should optimize prompts and generation policies only after the report can produce stable, debuggable feedback.

- Build a small golden set from the five representative generation cases plus a few adversarial cases.
- Use Pareto selection across a small set of competing metrics: source faithfulness, learning design, activity quality, learner experience, cost/latency.
- Feed GEPA textual traces from objective alignment, source-grounding failures, activity-quality findings, and blocked readiness checks.
- Track Pareto candidates by per-case wins, not only average score, so a prompt that helps compliance training but hurts math does not silently replace the baseline.
- Keep Mubit memory out of optimization runs until the evaluator can distinguish memory-personalized improvement from reproducibility drift.

## Codebase Fit Notes

Current code already has most of the raw material for a first quality report:

- `shared/coursition/workflow.ts` defines `CoursePreparation`, `LearningObjective`, `ActivityBrief`, `GeneratedActivity`, `LearningBlueprint`, `ReviewFinding`, and the deterministic quality-gate builders.
- `shared/coursition/effect-api.ts` mirrors those contracts through Effect schemas, so any persisted report needs schema support there too.
- `server/coursition/store.ts` owns normalization, draft persistence, `buildFullCourse`, `generateLearningBlueprint`, and `buildFindings` calls after mutations.
- `server/coursition/ai-provider.ts` owns the Ax learning-blueprint generation contract and the deterministic `generatedActivityFromBrief` conversion.
- `tests/coursition.workflow.runner.cjs` already contains `validateLearningEvidence`, which can be promoted into reusable report-building logic.
- `tests/coursition.workflow.test.ts` already validates five representative generated courses against evidence-based checks.
- `src/features/coursition/coursition-workflow-app.tsx` already has a small preview "Quality signals" section where a compact report panel can land without changing the whole builder UI.

Likely first implementation:

1. Add `CourseQualityReport`, `CourseQualityDimension`, and `CourseQualityObservation` types in `shared/coursition/workflow.ts`.
2. Add matching schemas in `shared/coursition/effect-api.ts`.
3. Store `qualityReport` on `CourseDraft` and normalize legacy drafts to an empty or computed report.
4. Compute deterministic reports from the existing blueprint, generated activities, source coverage, and `ReviewFinding` list.
5. Show readiness, two hard gates, and four compact dimensions in the existing preview quality section.
6. Keep `AiRunType.teaching_quality_review` reserved for a later LLM-judge pass; do not require it for the first deterministic report.

Important local weakness to capture as an activity-quality finding:

- `generatedActivityFromBrief` currently derives some learner-facing choices from meta strings such as "Common mistake", "Too broad", and "Escalate only after checking". That is not a reason to add a new top-level dimension. It belongs under `practiceFeedback` as a concrete repair finding.

## Open Questions

- Which dimensions should be scored independently, and which should be derived findings?
- Should the user-facing report expose a single score, a readiness state, or a radar-style breakdown?
- What is the minimum stable report schema before GEPA is useful?
- Which quality checks can be deterministic now, and which need LLM-as-judge or learner outcome data later?
- How should Mubit memory influence generation without contaminating source-grounding or making evaluation less reproducible?
- How should rubrics be calibrated across model/provider versions so quality scores remain comparable?
- What guardrails prevent GEPA or another optimizer from learning to satisfy the rubric while making the course less useful to real learners?
