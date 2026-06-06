# Source-Material Course Workflow Rework Subagent Graph

## Handoff Bundle

- Plan selection:
  - `.codex/plans/14-learning-rework-baseline-repair.plan.md`
  - `.codex/plans/15-learning-blueprint-domain.plan.md`
  - `.codex/plans/16-objective-retrieval-ai.plan.md`
  - `.codex/plans/17-activity-engines-quality-gates.plan.md`
  - `.codex/plans/18-course-studio-flow-ui.plan.md`
  - `.codex/plans/19-learning-rework-acceptance-rollout.plan.md`
- Explicit edges:
  - `learning-rework-baseline-repair:learning-blueprint-domain`
  - `learning-blueprint-domain:objective-retrieval-ai`
  - `learning-blueprint-domain:activity-engines-quality-gates`
  - `objective-retrieval-ai:course-studio-flow-ui`
  - `activity-engines-quality-gates:course-studio-flow-ui`
  - `course-studio-flow-ui:learning-rework-acceptance-rollout`
- Graph id: `source-material-course-workflow-rework`
- Selection hash: `042d0648f8`
- Snapshot path: `.codex/plan-graphs/source-material-course-workflow-rework/snapshot.json`
- State dir: `.codex/plan-graphs/source-material-course-workflow-rework`

## Limits

- Resolved agent limit: `max_threads=50`
- Resolved depth limit: `max_depth=3`
- Practical launch cap: 4 to 6 active agents at once. The codebase has shared contract hotspots, so extra writer fan-out would increase conflict risk without improving wall-clock time.
- Primary/root agent keeps graph ownership, integration, status updates, and final verification.

## Goal

Implement the accepted source-material-first workflow rework: Course Preparation with optional Learning Goal / Source Focus, Learning Objectives, Activity Briefs, Course Sections, Content Blocks, Generated Activities, artifact-derived progress, stale-but-accessible downstream content, rare blocking gates, and Generate/Assist modes only.

## Excluded From This Runnable Graph

- Quality/GEPA follow-on plans `20-23` are separate optimization/evaluator work and should not be pulled into this workflow implementation graph unless the user explicitly expands scope.
- Effect cleanup plans `24-28` are separate infrastructure work. Another agent may be working there; do not touch Effect config/platform files from this graph unless a direct compile blocker forces a local narrow fix.
- Deleted old plan graphs and old visual wireframes are intentionally not runnable.

## Critical Path

`source-rework baseline repair -> domain contract -> retrieval/activity implementation -> UI integration -> acceptance`

The first true write bottlenecks are `14-learning-rework-baseline-repair` and `15-learning-blueprint-domain`. Parallelism before those completes should be read-only scouting only.

## Validation Corrections Applied

- Baseline repair means clearing current blockers for the source-material-first rework. It does not mean restoring the old questions/topics/target/chapters/lessons/builder wizard as a durable product baseline.
- The current known blockers are plan artifact formatting, lint failures, an i18n checker/code false positive, and AI provider config test failures or coordinated Effect-lane ownership.
- SG-05 is the only shared contract writer for steps, actions, schemas, draft shape, gate reasons, and staleness rules.
- Legacy draft normalization and old topic/chapter/lesson workflow tests are rewrite/delete targets unless they protect still-valid invariants such as source grounding, owner isolation, i18n, source lifecycle, or human-authored provenance.
- Retrieval, activity, and UI writers consume the settled SG-05 contract. They must not redefine shared contracts or keep legacy steps/actions alive.

## Launch Waves

### Wave 1: Parallel Read-Only Scouts

Launch these together. They do not edit files.

#### SG-01 Baseline Failure Scout

- Purpose: produce a grouped baseline failure inventory for `14-learning-rework-baseline-repair`.
- Inputs: PRD, `CONTEXT.md`, plan `14`, current dirty worktree.
- Ownership: read-only over whole repo.
- Required output: failing commands, failing files, grouped causes, and smallest recommended baseline repair order.
- Required verification: run focused typecheck/test/lint commands only far enough to classify failures.
- Out of scope: no edits, no broad cleanup, no fixes.
- Stop condition: hand back a concise failure matrix.

#### SG-02 Legacy Surface Scout

- Purpose: map every remaining removed legacy concept/action in production code.
- Inputs: PRD deletion-target section, `CONTEXT.md`, plan `15`.
- Ownership: read-only over `shared/`, `server/coursition/`, `src/features/coursition/`, `src/routes/[lang]/`, `locales/`, and `tests/`.
- Required output: exact files/symbols still using removed concepts/actions and which target concept replaces each one.
- Required verification: `rg` evidence with file paths and symbol names.
- Out of scope: no edits, no compatibility design, no preserving old draft shapes.
- Stop condition: hand back a removal map usable by the baseline/domain writer.

#### SG-03 Current Workflow Contract Scout

- Purpose: map the current shared workflow/API/store/route-data contracts before the baseline writer edits them.
- Inputs: plans `14` and `15`.
- Ownership: read-only over `shared/coursition/workflow.ts`, `shared/coursition/effect-api.ts`, `server/coursition/store.ts`, `api/effect/index.ts`, `src/features/coursition/route-data.ts`, and workflow tests.
- Required output: current contract graph, required target contract graph, and likely compile breakpoints.
- Required verification: cite exact files/symbols.
- Out of scope: no implementation.
- Stop condition: hand back an interface-risk map.

### Wave 2: Baseline Writer

Launch after Wave 1 outputs are integrated by the primary agent.

#### SG-04 Baseline Repair Writer

- Purpose: complete `14-learning-rework-baseline-repair`.
- Inputs: Wave 1 outputs, plan `14`, PRD, `CONTEXT.md`.
- Ownership: write-capable over files required to clear the source-rework baseline blockers without restoring the old wizard as a product contract.
- Preferred files: shared workflow/API contracts, store normalization, route data, workflow tests, locale fixes only when compile/UI tests require them.
- Do not edit: `server/coursition/config.ts`, Effect platform/config direction, quality/GEPA plans, unrelated visual CSS, except for a narrow coordinated fix if AI provider config tests cannot otherwise be isolated.
- Required output: patch plus verification transcript.
- Required verification: focused workflow tests, typecheck or a recorded narrowed failure list, i18n check, lint or a grouped lint blocker list, and provider test status if AI provider config failures remain.
- Out of scope: no new objective/activity system, no Course Section/Content Block migration yet.
- Out of scope: no compatibility branch that preserves removed draft shapes solely to keep legacy tests green.
- Stop condition: source-rework baseline is green enough for domain work, or blocker is isolated with exact failing files and owner graph.

### Wave 3: Domain Writer Plus Parallel Prep Scouts

Run the shared contract writer as the only writer. Launch prep scouts in parallel because they are read-only.

#### SG-05 Domain Contract Writer

- Purpose: complete `15-learning-blueprint-domain`.
- Inputs: plan `15`, baseline repair patch, PRD, `CONTEXT.md`.
- Ownership: single writer for shared source-material-first model, steps, actions, schemas, draft shape, gate reasons, and staleness rules.
- Preferred files: `shared/coursition/workflow.ts`, `shared/coursition/effect-api.ts`, store defaults/helpers, focused domain/schema tests.
- Do not edit: AI provider prompts, generated activity rendering/UI surfaces except compile adapters required by the shared contract.
- Required output: new durable domain contract, approved six-step workflow, approved action surface, no legacy draft preservation, tests.
- Required verification: schema round-trip tests, workflow/domain tests, typecheck slice if practical.
- Out of scope: no full AI generation, no UI redesign.
- Stop condition: downstream workers can depend on stable CoursePreparation/LearningObjective/ActivityBrief/CourseSection/ContentBlock/GeneratedActivity shapes.

#### SG-06 Retrieval Prep Scout

- Purpose: prepare `16-objective-retrieval-ai` implementation while the domain writer works.
- Inputs: plan `16`, current AI provider/store tests, PRD.
- Ownership: read-only over `server/coursition/ai-provider.ts`, `server/coursition/store.ts`, source/chunk helpers, AI provider tests.
- Required output: exact implementation seams for objective-targeted retrieval, Ax programs, deterministic fallback, and tests.
- Out of scope: no edits.
- Stop condition: hand back a ready-to-implement retrieval plan tied to current file paths.

#### SG-07 Activity/Gates Prep Scout

- Purpose: prepare `17-activity-engines-quality-gates` implementation while the domain writer works.
- Inputs: plan `17`, PRD, existing preview/activity/quality code.
- Ownership: read-only over activity rendering, quality/review findings, workflow tests, preview paths.
- Required output: file/symbol map for generated activities, teaching gates, warnings, strict-source behavior, and tests.
- Out of scope: no edits.
- Stop condition: hand back a ready-to-implement activity/gates plan tied to current file paths.

#### SG-08 UI Prep Scout

- Purpose: prepare `18-course-studio-flow-ui` without touching files before retrieval/activity data contracts land.
- Inputs: plan `18`, AGENTS i18n rules, current course workflow UI.
- Ownership: read-only over `src/features/coursition/`, `src/routes/[lang]/`, `locales/`, and relevant UI tests.
- Required output: UI surface map, locale key plan, and interaction states needed for Generate/Assist and stale-but-accessible navigation.
- Out of scope: no edits, no landing-page redesign.
- Stop condition: hand back UI integration notes for the later UI writer.

### Wave 4: Parallel Retrieval And Activity Writers

Launch after SG-05 is integrated. SG-06 and SG-07 outputs should be attached to these prompts.

#### SG-09 Objective Retrieval AI Writer

- Purpose: complete `16-objective-retrieval-ai`.
- Inputs: SG-05 domain contract, SG-06 prep output, plan `16`.
- Ownership: write-capable over AI/retrieval implementation and tests.
- Preferred files: `server/coursition/ai-provider.ts`, retrieval/source evidence helpers, AI provider tests, workflow generation tests.
- Do not edit: shared contract definitions, legacy step/action definitions, or UI. If the settled contract is insufficient, report the needed contract change to the primary agent instead of editing it.
- Required output: objective-targeted source evidence, structured Ax programs or deterministic fallback, Generate Mode orchestration hooks.
- Required verification: objective-specific retrieval tests, fallback tests, source-focus generation tests.
- Out of scope: no activity mechanics, no UI.
- Stop condition: generated Objective Map and Activity Brief data are available to downstream course generation.

#### SG-10 Activity Engines And Gates Writer

- Purpose: complete `17-activity-engines-quality-gates`.
- Inputs: SG-05 domain contract, SG-07 prep output, plan `17`.
- Ownership: write-capable over generated activity data, activity-to-preview mapping, teaching gates/warnings, and related tests.
- Preferred files: activity/preview helpers, quality gate helpers, workflow/activity tests.
- Do not edit: AI provider retrieval logic, shared contract definitions, legacy step/action definitions, or creator UI. If the settled contract is insufficient, report the needed contract change to the primary agent instead of editing it.
- Required output: v1 generated activity types, learner action + feedback invariants, strict-source gate behavior, non-blocking warnings.
- Required verification: tests for every activity type, text-only blocking, strict-source blocking, warning non-blocking.
- Out of scope: no general mini-game builder, no iframe/module-federation runtime.
- Stop condition: generated activities can be rendered/validated against Course Sections without direct mechanic editing.

### Wave 5: UI Writer

Launch after SG-09 and SG-10 are integrated. SG-08 output should be attached.

#### SG-11 Course Studio Flow UI Writer

- Purpose: complete `18-course-studio-flow-ui`.
- Inputs: integrated retrieval/activity implementation, SG-08 UI prep output, plan `18`, AGENTS i18n rules.
- Ownership: write-capable over Course Studio UI, localized copy, route navigation, and UI-focused tests.
- Preferred files: `src/features/coursition/coursition-workflow-app.tsx`, route data, locale JSON, targeted UI/browser tests.
- Do not edit: core shared contracts, legacy step/action definitions, or Effect config/platform files. Route any required contract change through the primary agent.
- Required output: two-mode UI, source focus in Course Preparation, Assist surfaces, activity brief editing, preview assumptions/quality panel, stale-but-accessible navigation.
- Required verification: `pnpm i18n:check`, focused UI tests or browser screenshots, workflow navigation regression.
- Out of scope: no marketing page, no direct generated activity mechanic editor.
- Stop condition: creator can navigate the six-step workflow and Generate Mode lands on playable preview.

### Wave 6: Acceptance And Documentation

Launch after SG-11 is integrated.

#### SG-12 Acceptance Rollout Verifier

- Purpose: complete `19-learning-rework-acceptance-rollout`.
- Inputs: all integrated implementation lanes, plan `19`.
- Ownership: write-capable over end-to-end/focused tests, docs/ADRs only when needed, and final handoff notes.
- Preferred files: tests, docs/ADR or implementation notes, graph operator log.
- Do not edit: production implementation except tiny fixes approved by primary agent after failing verification.
- Required output: E2E or workflow coverage, UI acceptance coverage, quality gate command results, final architecture notes, handoff.
- Required verification: `pnpm format`, `pnpm lint`, `pnpm typecheck`, `pnpm i18n:check`, focused Rstest suites, `pnpm ultramodern:check` where feasible.
- Out of scope: no new product scope beyond the PRD.
- Stop condition: graph-level verification complete with residual risks recorded.

## Conflict Hotspots

- Single-owner shared contracts: `shared/coursition/workflow.ts`, `shared/coursition/effect-api.ts`.
- Single-owner baseline/store integration when active: `server/coursition/store.ts`, `src/features/coursition/route-data.ts`.
- UI writer only after data contracts and generated activity contracts settle: `src/features/coursition/coursition-workflow-app.tsx`, locale JSON.
- Do not let retrieval, activity, or UI writers redefine shared types, route steps, action unions, draft fields, or gate reasons. If any lane needs a contract change, it must report that to the primary agent instead of editing the shared contract directly.

## Parallelism Policy

- Wave 1 launches 3 read-only scouts in parallel.
- Wave 3 launches 1 writer plus 3 read-only prep scouts in parallel.
- Wave 4 launches 2 writers in parallel after the domain contract lands.
- Wave 5 and Wave 6 are serialized because they integrate prior outputs and share UI/test surfaces.
- Maximum useful active agents under this graph: 4 in Wave 3. More would create overlap or duplicate scouting.

## Merge Points

- Merge Point A: integrate Wave 1 scouting into the SG-04 baseline writer prompt.
- Merge Point B: after SG-04, run focused baseline verification before SG-05.
- Merge Point C: after SG-05, freeze shared contracts for SG-09 and SG-10.
- Merge Point D: after SG-09 and SG-10, run focused workflow/activity tests before SG-11.
- Merge Point E: after SG-11, run UI/i18n/navigation checks before SG-12.

## First Launch Recommendation

Start with SG-01, SG-02, and SG-03. The primary agent should simultaneously keep the critical path warm by reviewing `shared/coursition/workflow.ts`, `shared/coursition/effect-api.ts`, `server/coursition/store.ts`, and the focused workflow tests locally.
