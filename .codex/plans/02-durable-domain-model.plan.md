---
name: durable-domain-model
overview: Convert the PRD-shaped TypeScript sketch into validated durable data contracts for Course Drafts, wizard sessions, sources, chunks, AI runs, topics, target learners, chapters, lessons, blocks, findings, provenance, and generated content patches.
todos:
  - id: split-static-copy-from-content
    content: Replace TranslationKey fields for user and AI generated content with persisted localized content values while keeping translation keys only for static interface labels.
    status: pending
  - id: model-course-draft-lifecycle
    content: Extend Course Draft records with owner user id, draft status, created and updated timestamps, versioning, autosave metadata, optional target learner, and current wizard session.
    status: pending
  - id: model-wizard-session
    content: Persist wizard step state, AI involvement mode, guided question answers, mode-specific required input state, source processing caveats, and resume metadata.
    status: pending
  - id: model-source-records
    content: Extend Source Asset, Derived Source Document, Knowledge Chunk, and Source Reference records with real content, storage keys, MIME data, byte sizes, checksums, offsets, provider job ids, retry data, and processing metadata.
    status: pending
  - id: model-ai-run-records
    content: Extend AI Run records with structured inputs and outputs, provider request ids, prompt versions, selected chunks, lifecycle timestamps, validation errors, cost metadata, retry lineage, and application patches.
    status: pending
  - id: model-builder-content
    content: Define durable Course Builder chapters, lessons, blocks, block ordering, media references, quiz data, exercise data, code blocks, reflections, summaries, manual edit markers, and save versions.
    status: pending
  - id: model-review-and-provenance
    content: Define AI Finding, source coverage, teaching quality, provenance classification, source reference, dismissed and resolved finding state, and recomputation trigger contracts.
    status: pending
  - id: implement-schema-validation
    content: Implement runtime validation for every persisted record and every inbound or outbound API payload used by the course generator.
    status: pending
  - id: add-contract-gates
    content: Add tests and validation commands that reject demo records, internal mock providers, generated content in locale files, missing ownership fields, and invalid AI output patches.
    status: pending
isProject: false
---

# durable-domain-model

## Execution Notes

Research found useful vocabulary in `src/features/coursition/domain.ts`, but it is not live product state. It also contains demo records and `internal_mock`, and it models per-user/generated content as translation keys. Treat it as a naming seed only.

The durable model must allow a Course Draft to exist before sources, target learner, chapters, and lessons exist. It must also support source-backed provenance and AI application patches without overwriting manual edits.

## Constraints

Do not keep demo exports in the production path. Do not store raw user notes, source names, lesson bodies, AI outputs, topic names, or draft titles in `locales/*/translation.json`.

## Operator Guidance

Depends on `production-foundation`. This lane should produce the contracts used by ingestion, AI generation, wizard UI, builder UI, review, and preview. Any UI lane that needs a type should import this durable contract instead of defining local duplicates.
