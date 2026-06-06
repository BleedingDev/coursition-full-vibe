---
name: effect-config-platform-boundary
overview: Replace raw environment and platform-boundary reads with an accepted Effect-compatible configuration layer, including the dependency decision needed for `Config`, Node runtime services, and Modern config compatibility.
todos:
  - id: choose-effect-platform-dependencies
    content: Decide whether to use Modern BFF Effect re-exports only or add explicit `effect` and platform dependencies for config, filesystem, HTTP, time, and random services.
    status: completed
  - id: create-coursition-config-module
    content: Add typed Coursition configuration accessors for AI provider, source providers, auth defaults, telemetry, and site URL values.
    status: completed
  - id: migrate-modern-and-auth-config
    content: Replace direct env reads in `modern.config.ts` and `server/coursition/auth.ts` with the accepted config boundary without weakening production site URL validation.
    status: completed
  - id: migrate-server-provider-config
    content: Replace direct env reads in `server/coursition/store.ts` and `server/coursition/ai-provider.ts` with typed config access while preserving local fallback behavior.
    status: pending
  - id: add-config-coverage
    content: Add focused coverage for development, test, production, local fallback, and missing provider configuration paths.
    status: pending
isProject: false
---

# effect-config-platform-boundary

## Execution Notes

The unsuppressed diagnostics showed 45 main-project `processEnv` diagnostics plus Node/platform diagnostics around `fs`, `path`, `Date`, `fetch`, and `crypto.randomUUID`. Modern BFF re-exports `Config`, `Effect`, `Layer`, and HTTP APIs from `@modern-js/plugin-bff/effect-server`, but the app now declares a direct `effect@4.0.0-beta.66` dependency so application code does not rely on transitive package access. Effect 4 exports `FileSystem`, `Path`, `Clock`, `DateTime`, and `Random` from the root package, so no separate platform package is needed for the planned server migration unless SG-27 proves a runtime implementation gap.

Useful references:

- [modern.config.ts](/Users/satan/work/coursition-all/coursition-full-vibe/modern.config.ts:11)
- [server/coursition/auth.ts](/Users/satan/work/coursition-all/coursition-full-vibe/server/coursition/auth.ts:4)
- [server/coursition/store.ts](/Users/satan/work/coursition-all/coursition-full-vibe/server/coursition/store.ts:76)
- [server/coursition/ai-provider.ts](/Users/satan/work/coursition-all/coursition-full-vibe/server/coursition/ai-provider.ts:103)
- [tests/coursition.ai-provider.test.ts](/Users/satan/work/coursition-all/coursition-full-vibe/tests/coursition.ai-provider.test.ts:21)

## Constraints

Do not hide env access by moving the same raw reads into untyped helpers. Do not rely on undeclared transitive dependencies in application code. Keep `MODERN_PUBLIC_SITE_URL` production validation intact. Preserve existing default local AI provider and deterministic fallback semantics.

## Operator Guidance

This lane can run after `effect-diagnostics-baseline-guard` and in parallel with `effect-strict-boolean-cleanup`. The dependency decision gates deeper server I/O migration. Modern config and Better Auth now use `server/coursition/config.ts`, which runs Effect `Config` synchronously at framework boundaries while preserving production `MODERN_PUBLIC_SITE_URL` validation. Server store/provider env migration remains serialized because those files are already dirty in the shared worktree.
