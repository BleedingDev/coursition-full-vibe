---
name: coursition-ui-workflow
overview: Flatten and polish the authentication, dashboard, course studio, editor, and learner-preview composition using the existing UI-kit components and a small shared semantic class vocabulary.
todos:
  - id: split-shared-surface-roles
    content: Replace the universal bordered card treatment with distinct shared studio-header, workspace-section, and inset surface roles that avoid nested boxes.
    status: completed
  - id: polish-auth-dashboard-mode-sources
    content: Refine authentication, dashboard, mode selection, and source management into calmer editorial compositions with one clear primary action per screen.
    status: completed
  - id: polish-editor-accordions
    content: Refine preparation, objective, and activity-plan screens with constrained reading measure, borderless list hierarchy, compact metadata, and clearer generation actions.
    status: completed
  - id: polish-course-preview
    content: Flatten course content and playable preview surfaces so learner content, activities, self-checks, feedback, and review states have clear hierarchy without nested card stacks.
    status: completed
  - id: verify-workflow-interactions
    content: Verify all seven course steps, dashboard actions, activity engines, responsive wrapping, and keyboard semantics remain behaviorally unchanged.
    status: completed
isProject: false
---

# coursition-ui-workflow

## Execution Notes

Apply the accepted civic-editorial direction to the central workflow renderer. The current `cardClass` is used for the sticky course header and every major step, while dashboard and preview add further nested borders. Flatten those layers using a small shared semantic vocabulary rather than scattered screen-specific utilities.

Preserve the current component library: Button, Badge, Input, FormInput, FormTextarea, RadioCard, Steps, Tabs, Accordion, SelectTemplate, Toast, and activity engines. This is a composition polish, not a workflow rewrite.

## Constraints

- Write ownership is limited to `src/features/coursition/coursition-workflow-app.tsx`.
- Do not edit route shell files, theme CSS, loading components, translations, shared workflow schemas, server code, API clients, auth, Cloudflare configuration, or generated files.
- Do not alter workflow state transitions, API actions, route paths, cache behavior, activity evaluation logic, source persistence, or generation behavior.
- Do not add hardcoded user-visible strings.
- Prefer existing UI-kit variants and semantic tokens. Keep new manual class constants few, role-based, and shared across screens.
- Preserve APCA contrast assumptions; do not add opacity-based text weakening.
- Preserve responsive behavior and ensure destructive actions remain visually secondary until confirmation.

## Operator Guidance

This is one coherent hotspot file and therefore has exactly one writer. It may run in Wave 1 alongside theme and shell because ownership is disjoint. Stop if a desired effect requires editing another file; report the needed integration change instead.

The primary agent owns combined visual QA, any cross-file reconciliation, and release verification.
