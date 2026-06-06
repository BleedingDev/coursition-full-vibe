---
name: coursition-topics-review-redesign
overview: Redesign Topics as a review-first decision screen and fix low-quality generated topic fallback content so users can quickly accept, reject, or edit meaningful suggestions.
todos:
  - id: improve-topic-generation-fallback
    content: Replace naive/generated fallback topic names and descriptions with source-aware, course-title-aware topic suggestions that are coherent in English and Czech.
    status: pending
  - id: topic-review-row-model
    content: Convert generated topic items from always-visible edit forms into compact review rows showing name, one-line description, importance, status, and primary Accept/Reject actions.
    status: pending
  - id: edit-topic-on-demand
    content: Add edit-on-demand behavior for topic name/description so fields appear only when the user chooses to edit a row.
    status: pending
  - id: accepted-rejected-state-cues
    content: Make accepted, rejected, suggested, and manual states visibly distinct without relying only on color; ensure accepted rows are clearly changed after action.
    status: pending
  - id: topic-next-action
    content: Make the accepted-topic count and Next-to-Target availability obvious without persistent explanatory copy when the requirement is satisfied.
    status: pending
isProject: false
---

# coursition-topics-review-redesign

## Execution Notes

Use screenshots `09-topics-generated.png` and `10-topics-after-accept.png`. This is the highest-priority UX failure: the generated content is poor, every generated item is rendered as an editing form, and Accept/Reject decisions are visually secondary.

## Constraints

- Preserve manual topic creation.
- Preserve update, accept, reject, and delete behavior.
- Do not make accepted/rejected state color-only; keep explicit text or icon/text cues.
- Keep strict gating: users should not continue without at least one selected topic unless chapters already exist.

## Operator Guidance

This lane depends on both foundation cleanup and source/question streamlining because Topics consumes generated questions and source-derived context. Verify with expect-cli and screenshots after implementation; bad generated topic quality is a product blocker, not only a visual issue.
