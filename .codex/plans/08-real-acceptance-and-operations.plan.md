---
name: real-acceptance-and-operations
overview: Prove the completed app through real end-to-end validation, provider configuration checks, production build verification, SSR and browser testing, operational failure handling, and explicit out-of-scope exclusion checks without substituting fixtures, mocks, fakes, or demo workflows.
todos:
  - id: add-configuration-audit
    content: Add a startup or preflight audit that reports required database, auth, storage, LlamaParse, Deepgram, AI provider, and site URL configuration without falling back to fake services.
    status: pending
  - id: add-real-golden-path-e2e
    content: Add an end-to-end browser test for a signed-in creator creating a course draft, adding real sources, waiting or continuing, generating topics, target learner, chapters, lessons, editing builder content, resolving findings, and opening preview.
    status: pending
  - id: add-real-ingestion-validation
    content: Add validation that exercises real provider-backed ingestion paths for documents, media, images, URLs, raw notes, unsupported files, delete, retry, preview, and continue without waiting.
    status: pending
  - id: add-real-ai-validation
    content: Add validation that exercises real AI runs for topics, target learner, chapters, lessons, checks, review, retry, failure handling, safe application, and no silent overwrite.
    status: pending
  - id: add-builder-validation
    content: Add validation for persisted Course Builder chapter, lesson, block, media, quiz, exercise, code, reflection, summary, reorder, save, preview, and manual edit preservation behavior.
    status: pending
  - id: add-ssr-and-browser-validation
    content: Validate SSR HTML contains real authenticated or unauthenticated states, app routes render with styles, browser console has no runtime errors, and language switching stays native i18n.
    status: pending
  - id: add-operational-failure-validation
    content: Validate missing provider keys, provider errors, failed uploads, failed processing, failed AI runs, and storage errors surface as real product states rather than fake success.
    status: pending
  - id: verify-out-of-scope-boundaries
    content: Verify the implementation did not add sales pages, checkout, public publishing, learner management, certificates, analytics dashboards, public APIs, importers, mobile apps, or enterprise self-host features.
    status: pending
  - id: publish-readiness-report
    content: Produce a concise readiness report with commands run, real provider validations completed, screenshots, remaining blocked configuration if any, and exact product gaps if any remain.
    status: pending
isProject: false
---

# real-acceptance-and-operations

## Execution Notes

This is not a fixture plan. It is an acceptance and operations lane for a real app. If real credentials or real storage are missing, the result is blocked or failed validation, not a passing fake test.

The highest-value acceptance path is the PRD golden path: signed-in creator, durable draft, real source ingestion, real AI generation, real Course Builder editing, real AI review, and internal preview.

## Constraints

No fixtures, mocks, fakes, fake providers, demo source records, fake AI outputs, or static local-state acceptance. Do not add out-of-scope LMS, commerce, publishing, analytics, or enterprise features.

## Operator Guidance

Run after implementation lanes, but configuration audit can start as soon as `production-foundation` exists. Browser validation must use actual pages and console/error inspection, not source-code content checks as proof of rendering.
