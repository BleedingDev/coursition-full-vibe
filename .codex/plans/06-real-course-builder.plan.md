---
name: real-course-builder
overview: Build the real editable Course Builder backed by persisted course drafts, chapters, lessons, blocks, manual edits, generated AI patches, reordering, save versions, media resources, and internal preview rendering.
todos:
  - id: load-builder-draft
    content: Load generated or blank manual Course Builder drafts from durable storage with authentication and ownership checks.
    status: pending
  - id: implement-course-editing
    content: Persist course title, language, strict source-only setting, save state, autosave versions, and manual edit metadata.
    status: pending
  - id: implement-chapter-crud
    content: Add real chapter creation, editing, deletion, reordering, generated metadata display, and save behavior.
    status: pending
  - id: implement-lesson-crud
    content: Add real lesson creation, editing, deletion, reordering, chapter organization, estimated effort, objective, next step, and save behavior.
    status: pending
  - id: implement-block-editor
    content: Add persisted block creation, editing, deletion, reordering, and rendering for heading, rich text, callout, image, video or audio reference, file resource, quiz or check, exercise task, code block, reflection prompt, and summary.
    status: pending
  - id: implement-media-resources
    content: Connect image, video, audio, and file resource blocks to real stored source assets or uploaded builder resources with preview and ownership checks.
    status: pending
  - id: preserve-manual-edits
    content: Track manual edits and prevent AI regeneration, source reanalysis, or review patches from silently overwriting creator changes.
    status: pending
  - id: apply-generated-patches
    content: Apply validated generated lessons and review suggestions into builder records through explicit creator approval.
    status: pending
  - id: implement-internal-preview
    content: Add creator-only preview routing that renders persisted chapters, lessons, and blocks in desktop and mobile layouts without public learner features.
    status: pending
  - id: remove-static-builder-seeds
    content: Remove static builderChapters, translation-key lesson bodies, simulated save timers, inert preview buttons, and local override maps from the production builder path.
    status: pending
isProject: false
---

# real-course-builder

## Execution Notes

The current builder is a local editor over static `builderChapters`; save is simulated with `window.setTimeout`, and preview/open buttons have no handlers. Replace it with durable Course Builder records and real mutations.

Manual Course Builder use is valid without AI. AI-generated content becomes normal editable builder content only after validated, explicit application.

## Constraints

No JSON import/export, no public publishing, no learner accounts, no commerce, no academy management. Internal preview is creator-only.

## Operator Guidance

Depends on `production-foundation` and `durable-domain-model`. Generated patch application depends on `real-ai-generation`; preview rendering depends on completed block support.
