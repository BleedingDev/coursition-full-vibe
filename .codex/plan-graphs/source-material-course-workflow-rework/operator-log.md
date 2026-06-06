# Source-Material Course Workflow Rework Operator Log

## Control Facts

- Graph id: `source-material-course-workflow-rework`
- Snapshot: `.codex/plan-graphs/source-material-course-workflow-rework/snapshot.json`
- Launch plan: `.codex/plan-graphs/source-material-course-workflow-rework/subagent-launch-plan.md`
- Limits: `max_threads=50`, `max_depth=3`
- Practical cap: 4 to 6 active agents; no more than 2 write-capable implementation agents at once.
- Current status: SG-04 broad baseline writer stopped; next execution uses small local contract slices plus read-only prep lanes.
- Readiness note: product direction validated as sound, but write launch requires source-rework baseline repair first. Baseline repair must not restore the old questions/topics/target/chapters/lessons/builder wizard as a durable target.

## Nodes

| Node                                    | Agent id                                        | Mode               | Owner / write scope                                             | Dependency          | Status    | Next action                                 |
| --------------------------------------- | ----------------------------------------------- | ------------------ | --------------------------------------------------------------- | ------------------- | --------- | ------------------------------------------- |
| SG-01 Baseline Failure Scout            | 019e9cb6-64c1-7373-88b1-73f72f9d1cbb / Pasteur  | read-only          | whole repo diagnostics                                          | none                | completed | matrix integrated                           |
| SG-02 Legacy Surface Scout              | 019e9cb6-8d3d-7b00-b1e1-9f631c179515 / Maxwell  | read-only          | removed concept/action inventory                                | none                | completed | removal map integrated                      |
| SG-03 Current Workflow Contract Scout   | 019e9cb6-bb2c-7ed2-8ca5-c4be91311389 / Beauvoir | read-only          | shared/API/store/route contract map                             | none                | completed | interface-risk map integrated               |
| SG-04 Baseline Repair Writer            | 019e9cbf-f771-7992-99bb-93cec5fed1cd / Hegel    | write              | source-rework baseline repair only                              | SG-01, SG-02, SG-03 | stopped   | do not integrate broad patch without review |
| SG-05 Domain Contract Writer            | TBD                                             | write              | shared source-material-first steps/actions/domain/schemas/gates | SG-04               | pending   | launch after baseline verification          |
| SG-06 Retrieval Prep Scout              | TBD                                             | read-only          | AI/retrieval file map                                           | SG-04               | pending   | launch with SG-05                           |
| SG-07 Activity/Gates Prep Scout         | TBD                                             | read-only          | activity/gate file map                                          | SG-04               | pending   | launch with SG-05                           |
| SG-08 UI Prep Scout                     | TBD                                             | read-only          | UI/i18n/navigation file map                                     | SG-04               | pending   | launch with SG-05                           |
| SG-09 Objective Retrieval AI Writer     | TBD                                             | write              | AI/retrieval implementation and tests                           | SG-05, SG-06        | pending   | launch in parallel with SG-10               |
| SG-10 Activity Engines And Gates Writer | TBD                                             | write              | activities/gates/warnings/tests                                 | SG-05, SG-07        | pending   | launch in parallel with SG-09               |
| SG-11 Course Studio Flow UI Writer      | TBD                                             | write              | UI/locales/route navigation/tests                               | SG-08, SG-09, SG-10 | pending   | launch after retrieval/activity integration |
| SG-12 Acceptance Rollout Verifier       | TBD                                             | verification/write | tests/docs/handoff only                                         | SG-11               | pending   | launch after UI integration                 |

## Excluded Plans

- `20-23`: quality scoring / GEPA follow-on work.
- `24-28`: Effect cleanup/config/runtime work.

## Launch Guardrails

- SG-04 clears current format/lint/type/i18n/test blockers for the source-material rework; it does not preserve legacy wizard tests or draft shapes just to make the old flow green.
- Known baseline blockers to classify or fix: plan artifact formatting, lint failures, i18n checker/code false positive, AI provider config test failures or coordinated Effect-lane ownership.
- SG-05 owns the shared contract replacement: route steps, action surface, draft shape, Effect schemas, gate reasons, staleness rules, and removal of legacy concepts/actions.
- SG-09, SG-10, and SG-11 consume the SG-05 contract and must report needed contract changes to the primary agent instead of editing shared contracts directly.

## Wave 1 Synthesis

- SG-01 baseline failures: `pnpm typecheck`, `pnpm i18n:check`, `pnpm effect-diagnostics:check`, `pnpm skills:check`, `node ./scripts/validate-ultramodern.mjs`, workflow tests, i18n tests, and ultramodern contract tests pass. `pnpm format:check` fails on plan graph artifacts; `pnpm lint` reports 182 diagnostics across workflow UI, store, config, AI provider, and course-page-loader; AI provider tests fail 5/6 on config/provider expectations and one legacy topic fallback test; `pnpm ultramodern:check` stops at format.
- SG-02 legacy map: old steps/actions/types remain across `shared/coursition/workflow.ts`, `shared/coursition/effect-api.ts`, `server/coursition/store.ts`, `server/coursition/ai-provider.ts`, `src/features/coursition/coursition-workflow-app.tsx`, `shared/coursition/routes.ts`, route loader, locales, and workflow tests. Delete or rewrite legacy-only tests; preserve source grounding, owner isolation, source lifecycle, i18n, auth, provider env, and human-authored provenance invariants.
- SG-03 contract map: SG-05 must own `DraftStep`, `workflowSteps`, route slugs, `CourseDraft`, `WorkflowAction`, Effect schemas, gate reasons, store normalization/defaults, `snapshotForRoute`, `applyWorkflowAction`, route-data semantics, and focused contract tests.
- Immediate SG-04 prompt requirement: clear plan artifact formatting/snapshot targeting first; coordinate `server/coursition/config.ts` and provider behavior with the Effect/config graph if needed; do not keep `Topic` fallback or old wizard normalization as baseline requirements.

## Execution Adjustment

- Do not run another broad baseline-lint writer. The old workflow files are about to change substantially, so broad lint cleanup there is low leverage.
- Primary agent owns the first shared-contract slice locally: step names, route slugs, action surface, draft shape, gate vocabulary, and minimal compile adapters.
- Subagents may run in parallel only as read-only prep or verification until the shared contract slice lands.
- Writer waits must be bounded. If a writer cannot report a small verified patch quickly, stop it and narrow the lane.
