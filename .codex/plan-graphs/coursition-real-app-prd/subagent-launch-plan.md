# Coursition Real App Subagent Graph

Graph id: `coursition-real-app-prd`
Snapshot: `.codex/plan-graphs/coursition-real-app-prd/snapshot.json`
Selection hash: `172475c7b9`
Plan set hash: `ac0b810c0b`
Agent limits: `max_threads=50`, `max_depth=3`

This graph transforms the PRD-derived plans into a massively parallel launch shape while keeping write ownership explicit. It is not an implementation start record.

## Canonical Plan Bundle

Plans root: `.codex/plans`
Glob: `*.plan.md`

Explicit plan dependencies:

- `production-foundation:durable-domain-model`
- `durable-domain-model:real-knowledge-ingestion`
- `durable-domain-model:real-course-builder`
- `real-knowledge-ingestion:real-ai-generation`
- `real-knowledge-ingestion:real-course-studio-ui`
- `real-ai-generation:real-course-studio-ui`
- `real-ai-generation:real-ai-review-provenance`
- `real-course-builder:real-ai-review-provenance`
- `real-course-studio-ui:real-acceptance-and-operations`
- `real-course-builder:real-acceptance-and-operations`
- `real-ai-review-provenance:real-acceptance-and-operations`

## Operating Rules

- No fixtures, mocks, fake providers, silent demo fallbacks, or hard-coded generated content are acceptable.
- Shared contracts, package versions, runtime config, and migrations have a single write owner per wave.
- Workers may read outside their ownership scope but must not edit outside it.
- Provider/API unknowns must be resolved with real package/docs/demo evidence before implementation.
- Browser and SSR validation are acceptance work, not proof from HTTP 200 alone.
- Active implementation should start with at most 5 agents in Wave A, then expand once shared interfaces are stable.

## Shared Hotspots

These files and areas require ownership discipline:

- `package.json`, `pnpm-lock.yaml`
- UltraModern config/runtime files
- route files under `src/routes/**`
- shared Coursition domain/contracts under `src/features/coursition/**`
- server API/BFF modules
- database schema and migrations
- translation files and native UltraModern i18n wiring
- tests and browser validation artifacts

## Wave A: Immediate Launchable Discovery And Foundation

These lanes can run first. Only `A1` owns foundational writes; the rest are scout lanes that produce implementation handoffs without modifying the app.

### A1 Foundation Platform Owner

Plan: `production-foundation`
Type: writer
Depends on: none
Owns:

- `package.json`
- `pnpm-lock.yaml`
- UltraModern app/runtime config
- BFF/API skeleton
- environment/config validation skeleton

Must not edit:

- feature UI beyond wiring required for server/runtime bootstrap
- course domain model internals

Done when:

- real UltraModern package versions and scripts are installed
- SSR starts cleanly
- server route skeleton exists
- missing required config fails loudly

### A2 Auth Scout

Plan: `production-foundation`
Type: scout
Depends on: none
Owns: research handoff only

Deliver:

- BetterAuth integration map
- exact package/version requirements
- route/session/server boundaries
- write-scope proposal for Wave B auth worker

### A3 Persistence And Storage Scout

Plan: `production-foundation`
Type: scout
Depends on: none
Owns: research handoff only

Deliver:

- database schema/migration approach
- object storage API shape
- draft/source/course persistence boundaries
- write-scope proposal for Wave B persistence worker

### A4 Provider Integration Scout

Plans: `real-knowledge-ingestion`, `real-ai-generation`
Type: scout
Depends on: none
Owns: research handoff only

Deliver:

- LlamaParse, Deepgram, and AI provider client requirements
- env vars and failure modes
- async job lifecycle requirements
- write-scope proposal for ingestion and generation workers

### A5 Domain Contract Scout

Plans: `durable-domain-model`, `real-course-builder`, `real-ai-review-provenance`
Type: scout
Depends on: none
Owns: research handoff only

Deliver:

- current `domain.ts` inventory
- list of demo/mock exports to remove
- normalized durable entities and provenance contracts
- write-scope proposal for Wave B contract owner

## Wave B: Production Foundation Parallel Build

Launch after `A1` establishes package/runtime ownership and scouts return enough concrete evidence.

### B1 BetterAuth Worker

Plan: `production-foundation`
Depends on: `A1`, `A2`
Owns:

- auth server modules
- auth API routes
- session loading helpers
- authenticated route guards

Done when auth is real and no unauthenticated course mutation path remains.

### B2 Persistence And Object Storage Worker

Plan: `production-foundation`
Depends on: `A1`, `A3`
Owns:

- database schema/migrations
- repository modules
- object storage service
- source asset persistence

Done when drafts, sources, course graph records, generation runs, and review findings can persist durably.

### B3 Durable Contract Owner

Plan: `durable-domain-model`
Depends on: `A5`, `B2`
Owns:

- durable course/source/generation/review TypeScript contracts
- runtime validation schemas
- removal of demo/mock domain records

Done when downstream workers can import stable contracts and no `internal_mock`, fixture, fake, or demo records remain in the shared domain module.

### B4 Effect Service Layer Worker

Plan: `production-foundation`
Depends on: `A1`, `B2`
Owns:

- server-side service composition
- typed errors
- provider dependency injection
- audit/logging adapters

Done when API handlers use real service boundaries instead of UI-local state or simulated calls.

### B5 Native I18n Worker

Plan: `production-foundation`
Depends on: `A1`
Owns:

- native UltraModern i18n configuration
- translation resources
- localized routing integration

Done when language handling uses native UltraModern translations and route behavior, with no ad hoc `language === "en"` branching.

## Wave C: Knowledge Ingestion Parallel Build

Launch after `B2`, `B3`, and provider evidence from `A4`.

### C1 Source Intake Worker

Plan: `real-knowledge-ingestion`
Depends on: `B2`, `B3`, `B4`, `A4`
Owns:

- upload/create-source API actions
- source status lifecycle
- persistence of raw input metadata

### C2 Document Parsing Worker

Plan: `real-knowledge-ingestion`
Depends on: `C1`
Owns:

- LlamaParse integration
- document parse job handling
- parsed text/table/image reference persistence

### C3 Media Transcription Worker

Plan: `real-knowledge-ingestion`
Depends on: `C1`
Owns:

- Deepgram integration
- audio/video transcription jobs
- transcript persistence and failure handling

### C4 URL Notes Images Worker

Plan: `real-knowledge-ingestion`
Depends on: `C1`
Owns:

- URL/raw notes/image ingestion paths
- extraction/normalization where supported by real services
- explicit unsupported-state errors where no real provider exists

### C5 Knowledge Chunking Worker

Plan: `real-knowledge-ingestion`
Depends on: `C2`, `C3`, `C4`
Owns:

- chunking pipeline
- citation anchors
- source readiness aggregation
- knowledge query API

## Wave D: Real Course Builder Parallel Build

Launch after `B3`; it can run in parallel with Wave C.

### D1 Draft Course API Worker

Plan: `real-course-builder`
Depends on: `B2`, `B3`, `B4`
Owns:

- draft course CRUD APIs
- outline/module/lesson persistence
- versioning and save semantics

### D2 Block Editor State Worker

Plan: `real-course-builder`
Depends on: `D1`
Owns:

- block CRUD/reorder/update APIs
- content block validation
- durable edit state

### D3 Preview And Export Read Model Worker

Plan: `real-course-builder`
Depends on: `D1`, `D2`
Owns:

- preview read models
- course tree selectors
- export/read-only course assembly APIs

## Wave E: Real AI Generation Parallel Build

Launch after `C5` and `B4`.

### E1 AI Run Lifecycle Worker

Plan: `real-ai-generation`
Depends on: `C5`, `B4`
Owns:

- generation run records
- real provider client orchestration
- cancellation/retry/failure handling

### E2 Topic Target Chapter Worker

Plan: `real-ai-generation`
Depends on: `E1`
Owns:

- topics generation
- target output generation
- chapter outline generation

### E3 Lesson And Block Generation Worker

Plan: `real-ai-generation`
Depends on: `E1`, `D2`
Owns:

- lesson generation
- content block generation
- insertion into durable builder APIs

### E4 Validation And Patch Worker

Plan: `real-ai-generation`
Depends on: `E2`, `E3`
Owns:

- schema validation of AI outputs
- citation/provenance enforcement
- safe patch application for generated changes

## Wave F: Studio UI Parallel Build

Launch after `C5`, `E2`, and native i18n foundation.

### F1 Authenticated Studio Shell Worker

Plan: `real-course-studio-ui`
Depends on: `B1`, `B5`, `D1`
Owns:

- authenticated localized studio shell
- route loaders/actions integration
- draft selector and create/resume flow

### F2 Knowledge UI Worker

Plan: `real-course-studio-ui`
Depends on: `C5`, `F1`
Owns:

- source upload/status UI
- knowledge evidence UI
- ingestion failure/retry controls

### F3 Generation Workflow UI Worker

Plan: `real-course-studio-ui`
Depends on: `E2`, `E4`, `F1`
Owns:

- wizard actions wired to real generation APIs
- progress/error states
- applying accepted generated outputs

### F4 Builder UI Worker

Plan: `real-course-studio-ui`
Depends on: `D2`, `D3`, `F1`
Owns:

- compact course tree/editor UI
- real save/reorder/delete flows
- preview wiring

## Wave G: Review And Provenance Parallel Build

Launch after AI generation and builder read/write APIs.

### G1 Provenance Worker

Plan: `real-ai-review-provenance`
Depends on: `E4`, `D3`
Owns:

- provenance records
- citation mapping
- generated-content lineage APIs

### G2 Review Findings Worker

Plan: `real-ai-review-provenance`
Depends on: `G1`
Owns:

- review run records
- finding generation/refresh
- finding resolution and audit trail

### G3 Review UI Worker

Plan: `real-ai-review-provenance`
Depends on: `G2`, `F4`
Owns:

- review panel integration
- provenance display
- finding actions in the studio UI

## Wave H: Acceptance And Operations

Launch after Wave F and Wave G.

### H1 Config And Failure Audit Worker

Plan: `real-acceptance-and-operations`
Depends on: `F1`, `F2`, `F3`, `F4`, `G3`
Owns:

- required env audit
- no-mock/no-fixture scan
- unsupported-provider failure behavior

### H2 SSR Browser Validation Worker

Plan: `real-acceptance-and-operations`
Depends on: `H1`
Owns:

- build/start validation
- SSR checks
- agent-browser or Playwright browser proof
- console/network error report

### H3 End-To-End Course Generator Worker

Plan: `real-acceptance-and-operations`
Depends on: `H1`, `H2`
Owns:

- authenticated full workflow test
- source ingestion to generated course to review path
- final readiness report

## Launch Frontier

Current plan-graph frontier contains only `production-foundation` because all other plan files intentionally depend on real foundation first.

Practical first launch set:

- `A1 Foundation Platform Owner`
- `A2 Auth Scout`
- `A3 Persistence And Storage Scout`
- `A4 Provider Integration Scout`
- `A5 Domain Contract Scout`

After Wave A returns, `helm` should merge scout findings, lock shared interfaces, then launch Wave B workers in parallel.
