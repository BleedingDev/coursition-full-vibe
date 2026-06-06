---
name: coursition-target-progression-redesign
overview: Rework Target learner and downstream progression so generated profiles are reviewable at a glance, confirmation gives visible feedback, and chapter generation unlocks in an obvious way.
todos:
  - id: target-summary-first-view
    content: Render generated target learner content as a compact review summary by default instead of seven large textareas.
    status: pending
  - id: target-edit-on-demand
    content: Provide Edit controls that reveal grouped editable fields only when the user needs to change the generated target profile.
    status: pending
  - id: target-confirm-feedback
    content: After Confirm target learner, show an explicit confirmed state and enable the next chapter-generation action without requiring users to infer state from disabled buttons.
    status: pending
  - id: simplify-target-actions
    content: Establish one primary action at a time on Target: generate, confirm, then generate chapters/next; demote or hide unavailable actions until they are relevant.
    status: pending
  - id: blocked-reason-placement
    content: Move blocked reasons to a compact status line near the current primary action and remove persistent generic instruction text once the requirement is satisfied.
    status: pending
isProject: false
---

# coursition-target-progression-redesign

## Execution Notes

Use screenshots `11-target-empty.png`, `12-target-generated.png`, and `13-target-full-blocked-after-confirm.png`. Target currently becomes a long form that hides the lower fields and next action on a 1440x900 viewport. It also fails to communicate confirmation/progression clearly.

## Constraints

- Preserve target learner data shape and server validation.
- Keep the user able to manually edit all target fields.
- Preserve route gating: later steps must remain blocked until target learner is usable and confirmed.
- Do not surface technical AI provider details or permanent inline diagnostic dumps.

## Operator Guidance

This lane depends on Topics because Target is only useful after selected topics exist. Verify both generated and manual-edit target flows. Include a regression for Confirm target learner visibly unlocking the next action.
