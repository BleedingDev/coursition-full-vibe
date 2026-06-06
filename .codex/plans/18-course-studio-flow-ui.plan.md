---
name: course-studio-flow-ui
overview: Rework the Course Studio UI around Generate and Assist modes, exposing concrete Course Preparation including optional source focus, Objective Map, Activity Plan, Course Content, quality findings, and playable preview surfaces.
todos:
  - id: enforce-two-mode-ui
    content: Ensure the mode picker, navigation, copy, persisted mode normalization, and tests expose only Generate Mode and Assist Mode as primary course modes.
    status: pending
  - id: add-source-focus-surface
    content: Add optional Learning Goal / Source Focus inside Course Preparation and make Generate Mode infer it from sources when the creator leaves it blank.
    status: pending
  - id: add-assist-preparation-ui
    content: Add Assist Mode surfaces for Course Preparation, Objective Map, and Activity Plan using concrete labels instead of exposing Learning Blueprint terminology.
    status: pending
  - id: add-activity-brief-editing
    content: Let creators edit Learning Objectives, Activity Briefs, activity type choices from the approved set, instructions, and feedback/rubric wording.
    status: pending
  - id: add-preview-assumptions-panel
    content: Make Generate Mode land on playable preview with a compact assumptions/source coverage/quality warning panel and actions to edit preparation or regenerate.
    status: pending
  - id: update-i18n-and-visual-tests
    content: Add English and Czech copy for the revised flow and verify with i18n checks plus focused UI or screenshot coverage.
    status: pending
isProject: false
---

# course-studio-flow-ui

## Execution Notes

The UI should feel simple even though the internal model is stronger. Use terms like "What to focus on", "Who this is for", "What learners will be able to do", and "How they will practice"; do not present "Learning Blueprint" as a wizard step.

## Constraints

Keep generated activity mechanics non-editable in v1. Text, instructions, objectives, and briefs are editable. Avoid landing-page or marketing-style redesign; this is an operational creator workflow. Do not add any no-source generation entry point.

## Validated Done Boundaries

- UI copy must use concrete creator-facing language such as "What to focus on", "Who this is for", "What learners will be able to do", "How they will practice", "Assumptions", "Source coverage", and "Quality warnings". Do not use "Learning Blueprint" as a visible step.
- Generate Mode must feel like the fast path: source required, optional source focus inside Course Preparation, playable preview first, assumptions available after generation.
- Assist Mode must expose editable Course Preparation, Objective Map, and Activity Plan before generation.
- Activity mechanics are not directly editable. Objectives, Activity Briefs, activity type selection from the approved set, instructions, feedback, and rubric wording are editable.
- All new user-visible text, aria labels, titles, placeholders, and alt text must go through locale files.
- `enforce-two-mode-ui`: Done when mode picker, navigation, persisted mode normalization, and tests expose only Generate and Assist as primary modes.
- `add-source-focus-surface`: Done when Learning Goal / Source Focus can be skipped, inferred from source material, edited in Course Preparation, and never behaves as a standalone generation seed.
- `add-assist-preparation-ui`: Done when Course Preparation, Objective Map, and Activity Plan are editable with concrete labels.
- `add-activity-brief-editing`: Done when editable fields mark downstream generated content stale and offer regeneration.
- `add-preview-assumptions-panel`: Done when playable preview shows compact assumptions, source coverage, quality warnings, and edit/regenerate actions.
- `update-i18n-and-visual-tests`: Done when i18n checks and focused UI/browser or screenshot coverage pass for the revised surfaces.

## Operator Guidance

Depends on `objective-retrieval-ai` and `activity-engines-quality-gates`. This lane owns user-visible copy and should run i18n checks before handoff.
