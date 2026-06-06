# UltraModern.js Upgrade Backlog

Saved on 2026-06-06 after the source-first workflow smoke test.

## Why This Matters

The app was pinned to UltraModern build `.83` across the BleedingDev Modern.js aliases. The npm `latest` dist-tag resolved to `3.2.0-ultramodern.108` on 2026-06-06, so the framework packages were upgraded together to keep route, BFF, i18n, Rstest, runtime, and tsconfig packages on one cohort.

## Current Versions

- `@modern-js/app-tools`: `npm:@bleedingdev/modern-js-app-tools@3.2.0-ultramodern.108`
- `@modern-js/plugin-bff`: `npm:@bleedingdev/modern-js-plugin-bff@3.2.0-ultramodern.108`
- `@modern-js/plugin-i18n`: `npm:@bleedingdev/modern-js-plugin-i18n@3.2.0-ultramodern.108`
- `@modern-js/plugin-tanstack`: `npm:@bleedingdev/modern-js-plugin-tanstack@3.2.0-ultramodern.108`
- `@modern-js/runtime`: `npm:@bleedingdev/modern-js-runtime@3.2.0-ultramodern.108`
- `@modern-js/adapter-rstest`: `npm:@bleedingdev/modern-js-adapter-rstest@3.2.0-ultramodern.108`
- `@modern-js/tsconfig`: `npm:@bleedingdev/modern-js-tsconfig@3.2.0-ultramodern.108`
- `react`: `^19.2.7`
- `react-dom`: `^19.2.7`

## Verified Latest Target

Registry check on 2026-06-06:

- Latest stable alias target: `3.2.0-ultramodern.108`
- `ultramodern-canary` dist-tag: `3.2.0-ultramodern.99`
- `@modern-js/ultramodern-checks` and `@bleedingdev/modern-js-ultramodern-checks` are not installable from the current registry view yet; both returned 404 on 2026-06-06 before and after the `.108` upgrade.

Use the `latest` dist-tag at implementation time, not the hardcoded `.108`, because the current latest may have advanced again.

## Shared Checks Migration

Use `MIGRATION-PLAYBOOK-0002: UltraModern Shared Checks` as part of this upgrade. The local copied i18n scanner should not be patched further once the shared checks package is available.

Single-app target for this repo:

1. Add `@modern-js/ultramodern-checks` to `.modernjs/ultramodern-package-source.json`.
2. Add the install-strategy alias:
   - package: `@modern-js/ultramodern-checks`
   - alias: `@bleedingdev/modern-js-ultramodern-checks`
   - specifier: same UltraModern cohort as the other Modern packages.
3. Add root devDependency:
   - `@modern-js/ultramodern-checks`: `npm:@bleedingdev/modern-js-ultramodern-checks@<cohort>`
4. Replace `scripts/check-i18n-strings.mjs` with the shared wrapper:

   ```js
   #!/usr/bin/env node
   import { runSingleAppI18nCheck } from '@modern-js/ultramodern-checks';

   process.exitCode = runSingleAppI18nCheck({ cwd: process.cwd() });
   ```

5. Keep the existing public script contract:
   - `i18n:check`: `node ./scripts/check-i18n-strings.mjs`
6. Update `scripts/validate-ultramodern.mjs` so the generated contract requires:
   - `@modern-js/ultramodern-checks` root devDependency.
   - package-source metadata includes the package.
   - install-strategy aliases include `@modern-js/ultramodern-checks`.
   - the dependency specifier matches package-source metadata.

Do not copy the checker implementation into this app, do not add app-specific regex allowlists, and do not use local `file:` or `link:` shims in shared repo state.

## Upgrade Follow-Up

1. If `@bleedingdev/modern-js-ultramodern-checks@<cohort>` is published, migrate the local i18n check to `@modern-js/ultramodern-checks` in the same change.
2. If the shared checks alias is still missing, stop before changing package metadata; do not replace it with copied source or local shims.
3. Continue using clean dev-server restarts after dependency upgrades, not HMR over an active install.
4. Run after the shared checks package becomes available:
   - `pnpm i18n:check`
   - `pnpm typecheck`
   - `pnpm exec rstest run tests/coursition.workflow.test.ts tests/coursition.ai-provider.test.ts`
   - `pnpm ultramodern:check`
   - `pnpm lint`
5. Browser-smoke the source-first workflow:
   - sign up/sign in
   - create a draft
   - choose Generate mode
   - add notes source
   - generate full course
   - verify Czech preview route renders
   - switch output language preference in Assist path
6. Recheck the known fragile areas:
   - localized TanStack route navigation
   - BFF client calls
   - i18n localized URL generation
   - Effect typecheck diagnostics
   - dev-server SSR/HMR behavior

## Timing

Do this after the immediate real-user validation build unless the current framework version blocks testing. The workflow is now smoke-testable, while the framework upgrade can introduce unrelated migration churn.
