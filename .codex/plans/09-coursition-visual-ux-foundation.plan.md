---
name: coursition-visual-ux-foundation
overview: Establish the shared layout, copy, navigation, and review-panel rules needed before screen-specific Coursition UI cleanup. This work removes persistent noise, makes the desktop layout use space intentionally, and preserves native route-driven navigation.
todos:
  - id: audit-current-layout-helpers
    content: Inventory visible helper/status copy, empty Review rendering, and desktop width constraints in the current Coursition workflow component using the captured screenshot set as evidence.
    status: pending
  - id: hide-empty-review-panel
    content: Hide the Review panel whenever there are no actionable findings; when findings exist, render only findings relevant to the current step.
    status: pending
  - id: convert-nonessential-help
    content: Move persistent instructional helper text to screen-reader-only text, contextual tooltips, or validation-only messages while keeping labels and required/error states visible.
    status: pending
  - id: widen-workflow-layout
    content: Adjust the desktop workflow layout so primary content uses the available viewport width without reintroducing cards, borders, shadows, or nested panels.
    status: pending
  - id: normalize-stepper-and-actions
    content: Keep full step names visible on desktop, preserve non-color status cues, and keep Back/Next aligned with the current step title at normal control height.
    status: pending
isProject: false
---

# coursition-visual-ux-foundation

## Execution Notes

This plan is based on `dogfood-output/screenshots/coursition-flow-20260604-202137/analysis-plan.md` and the matching screenshots. The recurring problems are visible helper copy, a permanently empty Review column, truncated step labels, scattered primary actions, and huge unused desktop space.

The intended visual direction is minimal, flat, dense, and operational. This is a course authoring tool, not a landing page. The UI should prioritize getting through the workflow and reviewing generated structure.

## Constraints

- Preserve localized, addressable UltraModern/TanStack routes.
- Do not add custom `window.location`, history handlers, or manual anchor navigation for routed transitions.
- Keep the UI flat: no decorative cards, borders, shadows, or nested panels.
- Keep accessibility labels, state text, and validation available. The cleanup targets visible noise, not accessibility semantics.
- Do not degrade mobile layout while widening desktop.

## Operator Guidance

Start here before screen-specific work. This lane owns shared layout constants, helper text policy, stepper/action layout, and Review panel visibility. Other visual lanes should build on this cleaned foundation rather than each inventing local spacing and copy rules.
