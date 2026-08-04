---
name: coursition-form-autosave-integrity
overview: Make every editable creator form preserve in-progress values, save in a deterministic order, survive locale navigation, and never erase newer input when an older request finishes.
todos:
  - id: form-integrity-autosave-boundaries
    content: Save preparation only after debounce or leaving the whole panel and route title, objective, and activity saves through the per-draft mutation queue.
    status: completed
  - id: form-integrity-navigation-flush
    content: Flush or explicitly resolve pending autosaves before step navigation, generation, preview, delete, sign-out, and any action that reads the just-edited data.
    status: completed
  - id: form-integrity-controlled-drafts
    content: Replace stale uncontrolled objective and activity default values with revision-aware edit buffers that sync server changes only while the local field is pristine.
    status: completed
  - id: form-integrity-source-submit
    content: Version each source-tab form draft and reset only the submitted unchanged version so typing or choosing a new file during an in-flight add never loses the next draft.
    status: completed
  - id: form-integrity-file-name
    content: Track whether a file source name is automatic or user-authored so replacing a file updates only an automatic name and never mismatches bytes and metadata.
    status: completed
  - id: form-integrity-retry-state
    content: Clear deduplication and busy state after every failed autosave and prevent conflicting retry, delete, resolve, dismiss, and generation actions from running together.
    status: completed
  - id: form-integrity-transient-drafts
    content: Preserve non-file source drafts and other unsaved text edit buffers across route and locale remounts in a session-scoped per-user per-draft cache while clearly handling file selections that browsers cannot restore.
    status: completed
  - id: form-integrity-interaction-tests
    content: Add interaction tests for tab switching, in-flight source edits, internal preparation focus changes, autosave failure retry, navigation flush, locale preservation, and server revision updates.
    status: completed
isProject: false
---

# coursition-form-autosave-integrity

## Execution Notes

The request coordinator is the only network mutation path. Forms own edit buffers; server snapshots own committed values. A newer local edit must never be replaced or cleared by an older response. Source tabs continue to own separate complete drafts, and switching tabs remains purely presentational.

Prefer a short debounce plus queue flush over a request on every field-to-field blur. User-visible navigation may show a compact pending state, but it must not navigate using stale preparation or activity data.

## Constraints

Do not redesign the UI, change theme tokens, add manual class-name styling, or merge Notes, URL, and File form state. Preserve URL-driven locale and step navigation. Do not store `File` bytes in localStorage; keep any transient file reference in the current browser runtime only.

## Operator Guidance

Depends on `coursition-client-request-ordering`. This lane owns individual form state and handlers inside `coursition-workflow-app.tsx` after the coordinator extraction has landed. It should not modify transport ordering or server persistence. Run focused interaction tests before handing off to release integration.
