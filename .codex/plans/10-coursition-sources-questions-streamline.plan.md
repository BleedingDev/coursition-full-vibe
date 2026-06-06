---
name: coursition-sources-questions-streamline
overview: Simplify Sources and Questions so users see the current task and next action without repeated guidance text, redundant status panels, or always-expanded forms after successful source ingestion.
todos:
  - id: streamline-source-type-control
    content: Convert source type selection into a compact segmented control with visible selected state, aria state, and no explanatory card-style copy.
    status: pending
  - id: validation-only-source-help
    content: Remove default visible source help such as source-name and source-required hints; show them only as validation errors or blocked-next reasons.
    status: pending
  - id: collapse-source-form-after-ready
    content: After at least one usable source is ready, collapse the add-source form behind an Add another source action while preserving source preview, retry, and delete controls.
    status: pending
  - id: remove-ready-banner-duplication
    content: Replace the large ready-state banner with source row status plus an enabled Next/Continue control; avoid duplicate ready/status messages.
    status: pending
  - id: compact-questions-layout
    content: Rework generated teaching questions into a denser desktop layout with Save questions and Generate topics aligned in one action row near the Questions title.
    status: pending
isProject: false
---

# coursition-sources-questions-streamline

## Execution Notes

Use screenshots `05-sources-empty-notes.png`, `06-sources-url-empty.png`, `07-sources-url-ready.png`, and `08-questions-generated.png` as the visual baseline. The Sources screen currently repeats guidance in the form, status area, and CTA area. Questions is functional but too single-column for desktop and splits primary actions.

## Constraints

- Keep source validation server-backed and client-visible on actual errors.
- Keep URL source fallback behavior from the recent fix: a blocked fetch must not strand users on Sources when the URL itself is usable.
- Do not remove Preview/Delete/Retry capabilities.
- Keep generated question values editable.

## Operator Guidance

This lane depends on `coursition-visual-ux-foundation`. After implementing, verify generated mode with `https://junior.guru/handbook/`, browser Back/Forward from Questions to Sources to Mode, and placeholder/label accessibility.
