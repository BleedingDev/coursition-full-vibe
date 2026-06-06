# Course Quality Report / GEPA Subagent Graph

## Handoff Bundle

- `graph_id`: `course-quality-report-gepa-20260606`
- `selection_hash`: `c0eb01c45b`
- `snapshot_path`: `/Users/satan/work/coursition-all/coursition-full-vibe/.codex/plan-graphs/course-quality-report-gepa-20260606/snapshot.json`
- `state_dir`: `/Users/satan/work/coursition-all/coursition-full-vibe/.codex/plan-graphs/course-quality-report-gepa-20260606`
- `max_threads`: 50
- `max_depth`: 3

Exact plan selection:

- `.codex/plans/20-course-quality-report-contract.plan.md`
- `.codex/plans/21-deterministic-course-quality-evaluator.plan.md`
- `.codex/plans/22-quality-report-persistence-preview.plan.md`
- `.codex/plans/23-quality-eval-fixtures-gepa-readiness.plan.md`

Dependency overlay:

- `course-quality-report-contract:deterministic-course-quality-evaluator`
- `deterministic-course-quality-evaluator:quality-report-persistence-preview`
- `deterministic-course-quality-evaluator:quality-eval-fixtures-gepa-readiness`

## Current Status

No implementation agents have been started. The app is being started for manual testing before code changes begin.

## Goal

Implement a compact, deterministic CourseQualityReport as a first-class Coursition domain object, persist it on drafts, show it in creator preview, and add regression fixtures that make future GEPA/Pareto optimization safer.

## Launch Waves

Wave 0, current:

- No workers.
- User manually tests current app state.
- Primary agent keeps graph dormant.

Wave 1, contract:

- Lane: `course-quality-report-contract`
- Suggested owner: one write-capable subagent or primary agent.
- Write scope: `shared/coursition/workflow.ts`, `shared/coursition/effect-api.ts`, narrowly related contract tests.
- Do not edit: server store, UI, locales, generation prompts, fixture scripts.
- Stop condition: plan 20 todos are implemented, contract tests pass, plan statuses are updated.

Wave 2, evaluator:

- Lane: `deterministic-course-quality-evaluator`
- Dependency: plan 20 complete.
- Suggested owner: one write-capable subagent.
- Write scope: `shared/coursition/workflow.ts`, `tests/coursition.workflow.runner.cjs`, `tests/coursition.workflow.test.ts`, narrowly related test helpers.
- Do not edit: UI files, locale files, persistence wiring except type imports required by tests.
- Stop condition: deterministic CourseQualityReport builder exists, five-course checks assert report readiness/gates/axes/observations, plan statuses are updated.

Wave 3, parallel downstream:

- Lane: `quality-report-persistence-preview`
- Dependency: plan 21 complete.
- Suggested owner: one write-capable subagent.
- Write scope: `server/coursition/store.ts`, `src/features/coursition/coursition-workflow-app.tsx`, `src/features/coursition/route-data.ts`, `src/routes/[lang]/course-page-loader.ts`, `locales/en/translation.json`, `locales/cs/translation.json`.
- Do not edit: evaluator scoring rules or test fixtures except to consume existing report fields.
- Stop condition: report persists, recomputes, reaches client, renders in preview, i18n check passes, plan statuses are updated.

- Lane: `quality-eval-fixtures-gepa-readiness`
- Dependency: plan 21 complete.
- Suggested owner: one write-capable subagent.
- Write scope: `tests/`, test fixtures, scripts or docs specifically for report comparison and future GEPA readiness.
- Do not edit: server persistence, UI, shared report contract except for additive test helper exports agreed with the evaluator owner.
- Stop condition: representative and adversarial report fixtures exist, comparison helper exists, future GEPA notes are documented, plan statuses are updated.

Wave 4, integration:

- Owner: primary agent.
- Merge scope: resolve any cross-lane type drift, run focused tests plus `pnpm typecheck`, `pnpm i18n:check`, and relevant quality gates.
- Stop condition: graph todos are complete or remaining blockers are explicit.

## Conflict Hotspots

- `shared/coursition/workflow.ts`: contract and evaluator both need it, so serialize plan 20 before plan 21.
- `shared/coursition/effect-api.ts`: contract owns schemas first; persistence/UI consumes after.
- `tests/coursition.workflow.runner.cjs`: evaluator owns reusable evidence extraction; fixture lane consumes after.
- `src/features/coursition/coursition-workflow-app.tsx`: persistence/UI lane owns all creator-facing quality panel changes.
- `locales/en/translation.json` and `locales/cs/translation.json`: persistence/UI owns all new user-visible copy.

## First Launch Prompt Skeleton

Use only after the user approves implementation:

```text
You own the plan-backed lane `course-quality-report-contract` in graph `course-quality-report-gepa-20260606`.

Implement plan `.codex/plans/20-course-quality-report-contract.plan.md` only. Update that plan's todo statuses as you complete them.

In scope: shared CourseQualityReport domain types, matching Effect schemas, compatibility for legacy drafts omitting `qualityReport`, and focused contract coverage.
Out of scope: evaluator scoring logic, server persistence wiring, UI, locales, fixture generation, GEPA execution.
Do not revert unrelated work in the dirty tree.
Stop when plan 20 is complete, focused verification has run or failures are reported, and changed files are listed.
```
