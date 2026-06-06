# Coursition Flow Visual Audit Plan

Screenshots captured: `01-auth-signup.png` through `14-dashboard-with-course.png`, plus `contact-sheet.png`.

## Global Problems

- The app uses a narrow centered column while most of the desktop viewport is empty.
- Visible helper copy is overused. Keep labels and required validation visible; move explanatory instructions to `sr-only`, tooltips, or only show them after an error/block.
- The empty `Review` panel consumes persistent space. Hide it when there are no actionable findings.
- Step labels truncate too aggressively and duplicate state text. Use compact stepper labels with full names visible on desktop.
- Primary actions are scattered: `Next`, `Continue`, `Generate`, `Confirm`, and review actions compete with each other.
- Generated content quality is visibly poor on Topics and should be fixed before optimizing layout.

## Screen Plans

1. Auth signup
   - Remove the hero-style title/subtitle from authenticated-product flow.
   - Widen the form slightly and center it more intentionally, or make it a compact auth panel.
   - Keep only field labels visible; make password requirements available to screen readers or inline only after invalid input.

2. Dashboard
   - Turn the create-course row into a compact toolbar above the course list.
   - Use more page width for the course list: title, status, counts, and actions on one row.
   - Remove the persistent explanatory sentence under `Courses`.

3. Mode
   - Replace three text-heavy option cards with a segmented control or compact radio list.
   - Move option descriptions to screen-reader text or hover/help affordances.
   - Hide `Review` when empty.
   - Keep mode selection and Next in one obvious path: choose mode, then Next.

4. Sources
   - Remove visible helper text such as “Name the source before adding it” until validation fails.
   - Keep one concise ready state: source row status plus enabled Next. Remove the large blue ready message.
   - Make source type a compact segmented control.
   - After source is ready, collapse the add-source form behind “Add another source”.

5. Questions
   - Show generated answers in a denser two-column form on desktop.
   - Keep required fields obvious, but move “Generate topics before continuing” style guidance to blocked-state messages only.
   - Put `Save questions` and `Generate topics` in a single action row aligned with the title.

6. Topics
   - Highest-priority screen to redesign.
   - Replace editable form cards with review rows: topic name, one-line description, importance/status, Accept/Reject.
   - Hide inline edit fields until user clicks Edit.
   - Make accepted/rejected state visually obvious and non-color-only.
   - Fix AI/fallback topic quality before layout polish; current topics are nonsensical.

7. Target
   - Replace seven large textareas with grouped compact fields or a summary-first view.
   - After generation, show a review summary with Edit controls, not a giant form by default.
   - Make “Confirm target learner” produce visible state feedback and unlock/enable next action clearly.
   - Move blocked reasons to a small status line near the primary action.

8. Review panel
   - Hide when empty.
   - When findings exist, show only blocking items relevant to the current step.
   - Use toast or inline compact errors for transient failures; do not show long diagnostic/status panels by default.

## Implementation Order

1. Remove visible helper copy and empty Review panel.
2. Redesign Topics into review-first rows with edit-on-demand.
3. Collapse ready Sources form after successful source add.
4. Compact Target into summary-first generated profile.
5. Widen desktop layout and use full-width content bands/toolbars.
6. Improve generated topic fallback quality.
7. Re-run screenshots across desktop and mobile.
