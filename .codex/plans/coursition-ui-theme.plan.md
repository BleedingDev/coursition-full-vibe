---
name: coursition-ui-theme
overview: Rebuild the Coursition visual foundation as a calm civic-editorial theme using UI-kit semantic and component tokens, with strong light/dark APCA contrast and far less border-driven hierarchy.
todos:
  - id: define-civic-editorial-tokens
    content: Replace the current neutral card-heavy theme values with a coherent civic-editorial palette, surface ladder, typography, radii, depth, and focus language in coursition-theme.css.
    status: completed
  - id: tune-ui-kit-component-tokens
    content: Tune buttons, form controls, tabs, accordions, radio cards, steps, badges, and feedback surfaces through supported UI-kit component tokens without page-specific selectors.
    status: completed
  - id: verify-theme-contrast
    content: Verify representative light and dark states preserve high APCA contrast and usable focus, disabled, hover, selected, and destructive states.
    status: completed
isProject: false
---

# coursition-ui-theme

## Execution Notes

Implement the accepted “civic editorial studio” direction. The visual identity should feel credible for CzechInvest and public-administration users while remaining modern, fresh, and recognizably product-designed. Preserve the deep forest-green interaction color, introduce a calmer warm-neutral surface ladder, and create hierarchy through typography and spacing rather than repeated outlines.

Baseline screenshots are under `artifacts/coursition-ui-audit/{light,dark}`. The current theme source is `src/routes/coursition-theme.css`, imported after UI-kit tokens and theme CSS.

## Constraints

- Write ownership is limited to `src/routes/coursition-theme.css` and, only if necessary for a global font token, the base typography portion of `src/routes/index.css`.
- Do not edit route components, workflow components, localization, backend, auth, provider, or Cloudflare configuration.
- Use semantic and UI-kit component variables. Do not add page-specific selectors or per-screen CSS class APIs.
- Do not weaken the existing APCA-oriented foreground values or rely on opacity for functional text hierarchy.
- Do not change OpenRouter, GLM, course-generation behavior, loading behavior, or URL routing.
- Preserve both explicit `.light` and `.dark` modes and the system fallback.

## Operator Guidance

This lane is independent of the shell and workflow-composition lanes and may run in Wave 1. Stop after the theme files are formatted and the owned-file diff is internally coherent. Hand any required component markup change back to the integrator rather than touching TSX.

At the fan-in, the primary agent will validate the combined UI in production-like browser screenshots and run the project quality gates.
