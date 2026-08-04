---
name: coursition-ui-integration
overview: Integrate the three independent UI lanes, verify the combined application across themes and routes, correct only cross-lane defects, and publish the polished Cloudflare build.
todos:
  - id: review-and-integrate-lanes
    content: Review each lane against its ownership contract, reconcile the combined theme/shell/workflow result, and remove any accidental overlap or regressions.
    status: completed
  - id: run-affected-quality-gates
    content: Use TraceDecay to determine affected tests, run diagnostics and the relevant UltraModern, i18n, format, lint, type, and Cloudflare build checks, and fix integration defects.
    status: completed
  - id: perform-visual-functional-qa
    content: Capture and inspect light/dark desktop and responsive screenshots for auth, dashboard, all seven course steps, and preview while checking URL, loading, locale, theme, and activity interactions.
    status: completed
  - id: deploy-polished-build
    content: Deploy the verified build to Cloudflare and perform a final production smoke check without changing AI provider configuration.
    status: completed
isProject: false
---

# coursition-ui-integration

## Execution Notes

This plan is the fan-in and critical path after `coursition-ui-theme`, `coursition-ui-shell`, and `coursition-ui-workflow`. The primary agent owns it locally. Baseline screenshots live under `artifacts/coursition-ui-audit` and should be replaced or supplemented with after-state evidence during QA.

## Constraints

- Do not revert or overwrite unrelated dirty-worktree changes.
- Do not change OpenRouter, GLM, prompts, model selection, D1/R2 schemas, BetterAuth persistence, or workflow semantics.
- Do not accept a visually improved result that reintroduces locale refetch, loading flashes, protected-route login rendering, browser-history mismatch, or low-contrast text.
- Keep documentation delivery out of this implementation pass.
- Use `apply_patch` for any final integration edit and keep it limited to the three lane-owned files unless a verified build defect requires a narrowly justified adjacent fix.

## Operator Guidance

Explicit inter-plan dependencies are required: `coursition-ui-theme`, `coursition-ui-shell`, and `coursition-ui-workflow` must all feed this plan. Runtime capacity is four active slots including the primary agent, so Wave 1 uses three leaf subagents and the primary retains integration ownership. No nested spawning is needed despite configured `max_depth=3`.

The merge points are: owned-file review, combined diagnostics/build, visual browser QA, and production smoke. If two lanes expose the same conceptual issue, preserve file ownership and reconcile locally only after both lanes finish.
