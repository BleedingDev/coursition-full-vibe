# Refactor `server/coursition/store.ts`

## Current Decision

Keep `server/coursition/store.ts` for the hackathon. It is ugly, but it is also the working backend workflow engine. Refactoring it now would risk breaking course creation, source processing, AI generation, and route gating while real-user testing is the priority.

## What It Does Today

`store.ts` is misnamed. It is not just a persistence module.

It currently owns:

- JSON-backed draft persistence in `.coursition-data/workflow.json`.
- Serialized mutation ordering so concurrent actions do not corrupt the JSON file.
- Current user workflow snapshots for loaders and the course UI.
- Route-step gating through `snapshotForRoute`.
- Workflow action handling through `applyWorkflowAction`.
- Source processing decisions for notes, URLs, text files, PDFs, documents, audio, video, and images.
- Derived source document and knowledge chunk creation.
- AI orchestration for learning blueprint and course content generation.
- AI run tracking, retry handling, failure recording, and stale downstream content.
- Finding generation and status updates.

The public surface is relatively small:

- `snapshotFor(ownerId)`
- `snapshotForRoute(ownerId, draftId, step)`
- `applyWorkflowAction(ownerId, action)`

That small surface is the useful boundary for a later refactor.

## Why Not Refactor Now

The file mixes several concerns, but those concerns are currently coupled around important state transitions:

- source changes must stale learning blueprints and course content;
- objective edits must stale dependent activity briefs and generated activities;
- failed AI runs must be recorded without losing the draft;
- invalid route navigation must fall back to the nearest allowed step;
- JSON writes must remain serialized and atomic enough for local demo use.

A mechanical Effect rewrite would make the file look cleaner while increasing risk. The right move is to preserve behavior first, add narrow tests around the key transitions, then split it.

## Target Shape

Split only when the workflow is stable enough:

- `course-draft-repository.ts`
  - reads/writes drafts;
  - hides JSON-file implementation;
  - owns mutation serialization;
  - later can be swapped for a real database.

- `course-workflow-service.ts`
  - owns `snapshotFor`, `snapshotForRoute`, and `applyWorkflowAction`;
  - coordinates repository, source ingestion, AI provider, and findings;
  - remains the main backend entrypoint for routes.

- `source-ingestion-service.ts`
  - chooses processors;
  - extracts text/documents/chunks from notes, URLs, files, PDFs, audio/video/images;
  - returns normalized derived source documents and knowledge chunks.

- `course-generation-service.ts`
  - wraps learning blueprint and course content AI generation;
  - records `aiRuns`;
  - applies fallback/failure semantics consistently.

- `workflow-transition.ts`
  - pure transition helpers for stale state, step changes, and dependent generated artifacts;
  - easy to unit test without filesystem or AI.

## Safe Refactor Order

1. Add characterization tests for `applyWorkflowAction` around source replacement, preparation update, objective edit, AI failure, and invalid route fallback.
2. Extract pure transition helpers first, with no behavior changes.
3. Extract repository behind the existing JSON implementation.
4. Extract source ingestion.
5. Extract AI orchestration.
6. Convert the repository/service boundaries to Effect-native APIs after the split is covered by tests.

## Non-Goals

- No backwards compatibility adapters.
- No shim layer.
- No parallel legacy pathway.
- No database migration during the hackathon unless JSON persistence blocks user testing.

## Done State

The refactor is done when `store.ts` either disappears or becomes a tiny composition module, and the app still passes the same workflow contract tests without preserving any legacy duplicate code path.
