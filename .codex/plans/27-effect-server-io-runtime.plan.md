---
name: effect-server-io-runtime
overview: Move server-side filesystem, HTTP, time, random, sleep, and async workflow operations into Effect runtime boundaries while preserving the Promise-shaped APIs expected by Modern BFF, route loaders, and tests.
todos:
  - id: introduce-server-effect-runtime
    content: Add a server runtime boundary that can run Coursition Effect programs from Modern handlers, route loaders, and test helpers.
    status: pending
  - id: migrate-store-filesystem-time-random
    content: Replace JSON-store filesystem operations, timestamps, temporary IDs, and mutation queue operations in `server/coursition/store.ts` with Effect services.
    status: pending
  - id: migrate-provider-http-and-delays
    content: Replace provider fetch calls, retry waits, local fallback deadlines, and timestamp creation in `server/coursition/ai-provider.ts` with Effect programs.
    status: pending
  - id: migrate-loader-session-fetch
    content: Replace route loader session fetch and async loader helpers in `src/routes/[lang]/course-page-loader.ts` with the accepted Effect boundary.
    status: pending
  - id: adapt-bff-handler-boundaries
    content: Keep BFF handler signatures working while replacing `Effect.tryPromise` wrappers around non-Effect internals with direct Effect composition.
    status: pending
  - id: verify-server-diagnostics-clean
    content: Run unsuppressed checker passes and confirm server, API, auth, config, and loader files no longer need diagnostic comments.
    status: pending
isProject: false
---

# effect-server-io-runtime

## Execution Notes

This is the deepest technical lane. The current server code uses raw `node:fs/promises`, `node:path`, `node:timers/promises`, `fetch`, `new Date()`, `crypto.randomUUID()`, and many async functions. Effect diagnostics point to `FileSystem`, `Path`, `HttpClient`, `DateTime` or clock services, `Random.nextUUIDv4`, and `Effect.gen`. The implementation should preserve the current JSON storage behavior and BFF API shape while moving impurity to explicit runtime boundaries.

Useful references:

- [server/coursition/store.ts](/Users/satan/work/coursition-all/coursition-full-vibe/server/coursition/store.ts:107)
- [server/coursition/ai-provider.ts](/Users/satan/work/coursition-all/coursition-full-vibe/server/coursition/ai-provider.ts:173)
- [api/effect/index.ts](/Users/satan/work/coursition-all/coursition-full-vibe/api/effect/index.ts:66)
- [src/routes/[lang]/course-page-loader.ts](/Users/satan/work/coursition-all/coursition-full-vibe/src/routes/[lang]/course-page-loader.ts:25)

## Constraints

Do not change persisted `.coursition-data/workflow.json` shape. Do not change route URLs, BFF API schemas, Better Auth behavior, or source provider ordering. Do not parallelize web extractor fallback calls because current tests expect sequential fallback behavior.

## Operator Guidance

This lane depends on both strict-boolean cleanup and the config/platform dependency decision. Use focused workflow tests after each server slice, especially source processing, AI fallback, owner isolation, and route loader behavior. Keep Promise adapters thin and near framework boundaries.
