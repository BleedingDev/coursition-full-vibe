---
name: coursition-visual-regression-verification
overview: Re-capture the Coursition workflow after implementation, compare it against the audit screenshots, and verify desktop, mobile, accessibility, SSR routing, and generated-mode behavior.
todos:
  - id: refresh-screenshot-set
    content: Capture a new screenshot set for auth, dashboard, mode, sources, questions, topics, target, and dashboard-with-course at desktop and mobile viewports.
    status: pending
  - id: compare-against-audit-findings
    content: Compare new screenshots against the 20260604 audit and confirm visible helper text, empty Review, topic rows, target density, and desktop width issues are resolved.
    status: pending
  - id: expect-cli-flow-audit
    content: Run expect-cli through generated-course and assisted/manual paths, asking it to be strict about UX logic, navigation, visible copy, and consistency.
    status: pending
  - id: accessibility-and-keyboard-check
    content: Run accessibility and keyboard checks for form labels, state cues, focus order, and non-color-only states across changed screens.
    status: pending
  - id: project-healthcheck
    content: Run the project quality gate and focused workflow tests, including SSR route refresh and Back/Forward checks for localized URLs.
    status: pending
isProject: false
---

# coursition-visual-regression-verification

## Execution Notes

This plan closes the visual UX redesign. It should not begin until the implementation lanes have landed. The baseline lives under `dogfood-output/screenshots/coursition-flow-20260604-202137/`.

## Constraints

- Do not accept improvements based only on DOM snapshots; inspect screenshots.
- Verify Czech and English routes where copy or URL localization is touched.
- Keep the dev server clean/restarted before final expect-cli runs to avoid HMR contamination.
- Report any remaining IBM Equal Access generic `style_color_misuse` findings separately from concrete accessibility failures with selectors.

## Operator Guidance

This is the merge/acceptance lane. It depends on all implementation lanes. Produce a short before/after report and keep the screenshot folder path in the final handoff.
