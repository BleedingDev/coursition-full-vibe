---
name: coursition-client-request-ordering
overview: Make client state revision-aware and URL-safe through one request coordinator that orders mutations, cancels obsolete reads, revalidates shared state, and invalidates expired authentication.
todos:
  - id: client-ordering-coordinator
    content: Introduce a workflow request coordinator that owns session identity, current route token, current draft revision, cancelable reads, and one serialized mutation queue per draft.
    status: completed
  - id: client-ordering-apply-guards
    content: Apply a response only when its session, draft, route token, and revision are still current and ignore every response older than the locally committed revision.
    status: completed
  - id: client-ordering-route-loading
    content: Replace refreshedRouteKeyRef loading guards with explicit request generations so rapid Back and Forward navigation cannot restore an old route or leave permanent loading.
    status: completed
  - id: client-ordering-cache-revalidation
    content: Keep locale navigation warm without a refetch while revalidating dashboard state on focus and visibility and broadcasting successful draft mutations to other tabs.
    status: completed
  - id: client-ordering-auth-expiry
    content: Treat workflow 401 as session invalidation by clearing user and snapshot caches, cancelling pending work, and navigating to the locale-correct sign-in URL.
    status: completed
  - id: client-ordering-session-bootstrap
    content: Distinguish absent loader data from an explicit anonymous session, show retry for transient session bootstrap failure, and surface sign-out failure instead of silently preserving stale authentication.
    status: completed
  - id: client-ordering-delayed-response-tests
    content: Add deterministic client tests with delayed out-of-order reads and mutations covering route changes, locale changes, cross-tab invalidation, conflicts, and auth expiry.
    status: completed
isProject: false
---

# coursition-client-request-ordering

## Execution Notes

Extract transport and ordering from `coursition-workflow-app.tsx` into a focused client module or hook. Route reads and draft mutations are separate lanes: obsolete reads may be aborted, while draft mutations execute serially with the latest committed expected revision. A locale link must reuse the current valid state and never trigger a course loading flash.

Dashboard cache is an optimization, not an authority. Focus, visibility, or a `BroadcastChannel` mutation notice must trigger background revalidation without flashing the full loading screen. Session bootstrap must have an explicit loading, retryable error, authenticated, or anonymous outcome; cached identity cannot override an explicit anonymous response.

## Constraints

Do not change visual design, URL shapes, locale prefixes, theme persistence, or source-tab draft ownership. Do not solve conflicts with last-response-wins. Do not reintroduce route-keyed copies that can diverge. Preserve Effect-based error decoding and the current BFF boundary.

## Operator Guidance

Depends on `coursition-integrity-contract` and can run in parallel with the D1 repository lane using the agreed API contract. This lane owns the new client coordinator plus the minimal integration seam in `coursition-workflow-app.tsx`; leave individual form behavior to `coursition-form-autosave-integrity`.
