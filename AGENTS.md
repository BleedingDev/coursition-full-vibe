# UltraModern Agent Contract

This project is generated for Codex-first UltraModern.js work.

## Quality Gates

- `pnpm lint` runs Oxlint with the Ultracite preset.
- `pnpm format` runs oxfmt.
- `pnpm typecheck` runs effect-tsgo as the TypeScript checker.
- `pnpm i18n:check` rejects hardcoded user-visible JSX text.
- `pnpm ultramodern:check` verifies the generated contract.
- Generated Codex stop hooks and subagent-stop hooks run `pnpm format && pnpm lint:fix && pnpm ultramodern:check`.
- `postinstall` installs `lefthook` when the app is inside a Git worktree. Generated `lefthook.yml` runs `pnpm format`, `pnpm lint:fix`, and `pnpm ultramodern:check` on pre-commit; pre-push runs `pnpm ultramodern:check`.

## Internationalization

Runtime i18n is enabled by default. Agents must put user-visible UI copy in `locales/<lang>/translation.json` and render it through `@modern-js/plugin-i18n/runtime`. Do not add hardcoded JSX text, `aria-label`, `title`, `alt`, or `placeholder` strings unless the value is a non-translatable technical token.

Routes are locale-prefixed by default through `localePathRedirect: true`. Keep localized pages under `src/routes/[lang]`, use links for language switching, and preserve canonical plus `hreflang` metadata. Production builds fail unless `MODERN_PUBLIC_SITE_URL` is set, so deployed canonical URLs always use the production origin.

## Compatibility

Do not add backwards-compatibility shims, legacy fallbacks, migration branches, or old-schema support unless the user explicitly asks for them. Prefer removing obsolete fields and failing clearly over silently preserving old behavior.

## Private Skills

Private orchestration skills are installed automatically during `pnpm install` when the current developer is authorized for `TechsioCZ/skills`. The installer clones that private repository and copies only the allowlisted skills from `.agents/skills-lock.json`; unauthorized developers get a warning and can continue with the public contract.

## CzechInvest continuity

For every CzechInvest, final-report, or funded-activity-output task, begin by reading these repository files in order:

1. `docs/czechinvest/README.md`
2. `docs/czechinvest/CURRENT-STATUS.md`
3. `docs/czechinvest/WORKING-CHECKLIST.md`
4. `docs/czechinvest/INPUTS-FROM-PETR.md`

Continue from the first relevant unchecked item instead of reconstructing the project from chat history. Treat the current application and source code as the source of truth for product claims. Update `CURRENT-STATUS.md` and `WORKING-CHECKLIST.md` whenever CzechInvest work materially advances.

Supplier selection, procurement limits, AIS approvals, and the single binding-output arrangement have already been handled with CzechInvest. Do not reopen them unless the user explicitly asks. The active scope is the final-report content and credible, application-grounded outputs for the funded activities; do not invent historical work, dates, metrics, authorship, testing, or handovers.
