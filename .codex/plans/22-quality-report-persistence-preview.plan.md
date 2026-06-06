---
name: quality-report-persistence-preview
overview: Persist CourseQualityReport on course drafts, recompute it at the right workflow points, and surface a concise creator-facing quality panel in the playable course preview.
todos:
  - id: persist-quality-report
    content: Add qualityReport as a top-level CourseDraft field, normalize legacy drafts that omit it, and ensure draft serialization preserves evaluator metadata and observations.
    status: pending
  - id: recompute-quality-report
    content: Recompute the deterministic report after full course generation, learning blueprint generation, opening preview, source/target mutations that affect quality, and activity brief updates that make generated activities stale.
    status: pending
  - id: expose-report-to-client
    content: Ensure route data and Effect API responses deliver qualityReport consistently to the course workflow UI without duplicating report-building logic in the client.
    status: pending
  - id: render-preview-quality-panel
    content: Replace or refine the current preview Quality signals block with readiness, two hard gates, four compact axes, and the most actionable blocking findings.
    status: pending
  - id: add-i18n-copy
    content: Add all new user-visible quality report labels, statuses, findings, and tooltips to locale translation files instead of hardcoding JSX copy.
    status: pending
isProject: false
---

# quality-report-persistence-preview

## Execution Notes

The report belongs on `CourseDraft` as a top-level sibling of `learningBlueprint`, `findings`, and `aiRuns`, because quality spans source material, course preparation, objectives, generated content, activities, and review findings. The UI should stay small and creator-actionable: readiness, gates, axes, and repair findings rather than analytics.

Useful references:

- [server/coursition/store.ts](/Users/satan/work/coursition-all/coursition-full-vibe/server/coursition/store.ts:495)
- [server/coursition/store.ts](/Users/satan/work/coursition-all/coursition-full-vibe/server/coursition/store.ts:1527)
- [src/features/coursition/coursition-workflow-app.tsx](/Users/satan/work/coursition-all/coursition-full-vibe/src/features/coursition/coursition-workflow-app.tsx:4527)
- [locales/en/translation.json](/Users/satan/work/coursition-all/coursition-full-vibe/locales/en/translation.json:1)
- [locales/cs/translation.json](/Users/satan/work/coursition-all/coursition-full-vibe/locales/cs/translation.json:1)

## Constraints

Do not add a complex analytics dashboard, radar chart, or editable generated activity internals. Do not expose optimizer telemetry to creators. Preserve the two-mode Generate/Assist behavior.

## Operator Guidance

Depends on `deterministic-course-quality-evaluator`. This lane touches server persistence and frontend UI, so it should run after the report builder is stable. Verify with focused workflow tests, typecheck, i18n check, and a browser pass if the dev server is already available.
