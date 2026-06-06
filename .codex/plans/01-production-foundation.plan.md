---
name: production-foundation
overview: Replace the current prototype-only foundation with real UltraModern server capability, BetterAuth ownership, durable persistence, object storage, runtime schemas, Effect workflow services, and provider configuration required before any source, AI, or builder work can be considered real.
todos:
  - id: install-production-dependencies
    content: Add and configure the real dependencies for BetterAuth, database access, object storage, runtime schemas, Effect workflows, provider HTTP clients, and Modern BFF routes.
    status: pending
  - id: enable-bff-entrypoints
    content: Create Modern BFF or server action entrypoints for authenticated Coursition operations and wire them into the UltraModern app without bypassing SSR.
    status: pending
  - id: configure-betterauth
    content: Implement BetterAuth login, session lookup, protected route behavior, and ownership checks for course drafts, source assets, AI runs, and previews.
    status: pending
  - id: configure-durable-database
    content: Add the real database schema, migrations, connection management, and transaction boundaries for Coursition records.
    status: pending
  - id: configure-object-storage
    content: Add real object storage for uploaded source assets, derived documents, transcripts, generated outputs, and previewable artifacts.
    status: pending
  - id: add-runtime-schemas
    content: Define runtime schemas for API inputs, storage records, provider outputs, generated course patches, and Course Builder block payloads.
    status: pending
  - id: add-effect-service-layer
    content: Add Effect based services for auth context, draft repository, source repository, ingestion workflows, AI workflows, storage, provider calls, retries, and typed errors.
    status: pending
  - id: remove-prototype-data-contracts
    content: Remove demo records, internal mock provider values, translation-key generated content fields, local-only save timers, and sample source arrays from the production contract path.
    status: pending
  - id: add-foundation-gates
    content: Add quality gates proving auth, persistence, schemas, storage, and BFF endpoints are real and fail loudly when required provider or storage configuration is missing.
    status: pending
isProject: false
---

# production-foundation

## Execution Notes

The research found a single UltraModern app with SSR and localized TanStack routing, but no implemented BFF handlers, database clients, route loaders, route actions, or source/AI network calls. The current route renders `StudioWizardPanel`, `KnowledgeAndReviewPanel`, and `CourseBuilderPanel` directly from local component state.

This plan is the root dependency for every other lane. The PRD requires a signed-in creator, a durable Course Draft created before upload, resumable wizard state, real source ownership, durable AI Runs, and real Course Builder storage. Build those capabilities before allowing UI work to claim product completeness.

## Constraints

No fixtures, mocks, fakes, demo data, simulated saves, fake provider responses, or internal mock provider names are allowed in product code. Tests may verify that missing real configuration blocks execution, but they must not pass by substituting fake providers.

Generated or user content must be persisted as content records, not locale translation keys. Locale files remain for static UI copy only.

## Operator Guidance

Start here. Downstream lanes must call these services instead of adding local state workarounds. If credentials, database, or storage are not configured, product workflows should report a blocked or failed state, not silently use placeholders.
