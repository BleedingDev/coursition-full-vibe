---
name: learning-blueprint-domain
overview: Replace the shared workflow contract with the durable source-material-first domain model, including steps, actions, schemas, draft shape, Course Preparation, Learning Objectives, Activity Briefs, Course Sections, Content Blocks, source support, stale status, and teaching quality findings.
todos:
  - id: define-blueprint-types
    content: Add shared domain types for CoursePreparation including optional Learning Goal / Source Focus, LearningObjective, ActivityBrief, ActivityType, CourseSection, ContentBlock, SourceSupport, source confidence, and stale/generated status metadata.
    status: pending
  - id: replace-workflow-surface
    content: Replace legacy DraftStep, WorkflowAction, gate reasons, and draft fields with the six-step source-material workflow and the approved action surface from the PRD.
    status: pending
  - id: mirror-effect-schemas
    content: Mirror the new domain types, steps, actions, gates, WorkflowSnapshot, and CourseDraft schemas in the Effect API without preserving legacy draft shapes.
    status: pending
  - id: add-store-defaults
    content: Add empty Course Preparation, Objective Map, Activity Plan, Course Section, Content Block, quality report, and staleness helpers for newly created drafts.
    status: pending
  - id: add-edit-actions
    content: Add workflow actions for updating Course Preparation, Learning Objectives, Activity Briefs, Course Sections, and Content Blocks while marking downstream generated artifacts stale.
    status: pending
  - id: add-domain-tests
    content: Add focused tests for blueprint defaults, schema round-trips, objective/activity edit actions, stale marking, and preservation of human-authored content.
    status: pending
isProject: false
---

# learning-blueprint-domain

## Execution Notes

Learning Blueprint is an internal model, not a user-facing step. Learning Objective becomes the primary planning unit. Activity Brief is the editable contract for interactive activities. Course Section and Content Block are the persisted course content model. This lane owns the entire shared contract replacement, not only additive types.

## Constraints

Do not expose the full Learning Blueprint as a visible wizard step. Do not preserve removed legacy draft concepts. No-source generation remains out of scope; use only source-bound Learning Goal / Source Focus inside Course Preparation. Do not leave old steps/actions/schemas/gates as hidden compatibility paths.

Removed concepts and actions from the PRD are deletion targets in this lane:

- `GuidedQuestions`
- `Topic`
- `TargetLearner`
- `Chapter`
- `Lesson`
- `LessonBlock`
- old question/topic/target/chapter/lesson/block actions
- `openPreview` as a state-changing API action unless it persists meaningful state

## Validated Done Boundaries

- Minimal v1 Course Preparation fields are output language, optional Learning Goal / Source Focus, audience, prior knowledge, desired outcome, depth, constraints, tone when retained, activity mix preference, and source strictness.
- Minimal v1 Learning Objective fields are stable id, observable capability, source support/confidence, source references, and generation/stale status.
- Minimal v1 Activity Brief fields are stable id, linked objective ids, approved activity type, learner action, success criteria, feedback guidance, source references, source confidence, and generation/stale status.
- Minimal v1 Course Section fields are stable id, title, linked objective ids, ordered content block ids, referenced generated activity ids, and generation/stale status.
- Minimal v1 Content Block fields are stable id, section id, type, learner-facing editable content, source references when applicable, and generation/stale status.
- Teaching Quality Findings must distinguish blocking gates from warnings and must be persisted with enough context for UI display and tests.
- Existing sourceSupport/provenance concepts must be extended or replaced without losing manually authored content history inside the new model. Do not keep parallel legacy provenance models.
- `define-blueprint-types`: Done when the shared types express only the minimal v1 contract above.
- `replace-workflow-surface`: Done when shared steps/actions/draft fields/gate reasons match the PRD workflow: Sources, Preparation, Objective Map, Activity Plan, Course Content, Playable Preview; Generate Mode uses `generateCourse`; Assist Mode uses staged editable actions; pure navigation is not persisted as progress.
- `mirror-effect-schemas`: Done when Effect API schemas round-trip the same contract, expose the same action surface, and old legacy draft shapes are no longer accepted as hidden compatibility inputs.
- `add-store-defaults`: Done when draft creation produces an empty valid source-material-first workflow state.
- `add-edit-actions`: Done when preparation/objective/brief edits mark only dependent generated content stale and preserve human-authored edits.
- `add-domain-tests`: Done when tests cover defaults, schema round-trips, stale marking, and provenance preservation.

## Operator Guidance

Depends on `learning-rework-baseline-repair`. This is the single shared interface owner for `shared/coursition/workflow.ts`, `shared/coursition/effect-api.ts`, route step contracts, draft shape, action surface, gate reasons, and source-material staleness rules. Retrieval, activity, and UI lanes must consume the settled contract and report needed contract changes back to the primary agent instead of redefining shared types.
