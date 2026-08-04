---
name: coursition-ui-shell
overview: Modernize the global Coursition shell, header, width, and theme-mode behavior while preserving URL-driven navigation and authentication semantics.
todos:
  - id: flatten-global-shell
    content: Refine the sticky product header and main content measure so the shell feels lighter, calmer, and aligned with the new editorial workspace hierarchy.
    status: completed
  - id: fix-effective-theme-toggle
    content: Make the theme-toggle label and icon reflect the effective system/light/dark mode and preserve the existing cookie and pre-hydration behavior.
    status: completed
  - id: verify-shell-navigation
    content: Verify locale links, sign-out, auth routes, sticky behavior, theme switching, and responsive header layout remain functional.
    status: completed
isProject: false
---

# coursition-ui-shell

## Execution Notes

The route shell currently uses a bordered sticky bar and a very wide `88rem` canvas. Refine it into quiet product chrome with a tighter shared measure and less visual competition with the course studio. Fix the discovered system-theme bug where a system-dark page can announce “Switch to dark mode”.

## Constraints

- Write ownership is limited to `src/routes/[lang]/page.tsx`.
- Do not edit `coursition-workflow-app.tsx`, theme CSS, translation JSON, route schemas, server code, auth code, or generated router files.
- Reuse existing localized strings. Do not introduce hardcoded user-visible text.
- Preserve URL-driven locale switching with zero workflow refetch and zero loading flash.
- Preserve BetterAuth sign-out behavior, canonical route behavior, and current keyboard-accessible controls.
- Before adding any helper, probe TraceDecay for an existing effective-theme resolver and assess its call sites.

## Operator Guidance

This lane is independent and may run in Wave 1. The file is a conflict hotspot and must have exactly one writer. Stop once the owned file is formatted and its local type surface is coherent. Do not expand into workflow visuals.

At the fan-in, the primary agent will re-run authenticated and unauthenticated locale/theme route checks.
