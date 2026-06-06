---
name: real-knowledge-ingestion
overview: Implement real Knowledge Base ingestion for uploaded files, URLs, and raw notes using durable source records, object storage, asynchronous processing, LlamaParse, Deepgram, URL cleanup, chunking, retries, previews, and continue-without-waiting behavior.
todos:
  - id: attach-sources-to-drafts
    content: Implement authenticated source intake that requires an existing Course Draft and stores uploaded files, URLs, and raw notes under the creator owned draft.
    status: pending
  - id: implement-file-upload-storage
    content: Store original uploaded files in real object storage with MIME type, byte size, checksum, storage key, upload status, and ownership metadata.
    status: pending
  - id: implement-llamaparse-documents
    content: Process PDFs and supported document or slide files through LlamaParse Cloud and store Markdown outputs with page or slide references when available.
    status: pending
  - id: implement-deepgram-media
    content: Process audio and video files through Deepgram transcription and store timestamped transcript derived documents.
    status: pending
  - id: implement-image-processing
    content: Process supported image files through the configured real document or vision extraction provider and store extracted text or description outputs with references.
    status: pending
  - id: implement-url-ingestion
    content: Fetch real URLs, clean main content, convert it into Markdown like derived documents, and preserve URL metadata and retrieval errors.
    status: pending
  - id: implement-raw-note-ingestion
    content: Store raw pasted notes as source assets and derived source documents without treating them as static translation copy.
    status: pending
  - id: implement-async-processing
    content: Queue and run asynchronous source processing with queued, processing, processed, partially processed, failed, unsupported, deleted, retry, and failure metadata states.
    status: pending
  - id: implement-knowledge-chunking
    content: Chunk derived documents into real Knowledge Chunks containing content, offsets, page, slide, timestamp, heading path, quality, and chunking strategy metadata.
    status: pending
  - id: implement-source-actions
    content: Implement preview processed output, delete source, retry failed processing, view processing details, continue, and continue without waiting through real backend mutations.
    status: pending
  - id: add-real-ingestion-gates
    content: Add real provider and storage validation that proves ingestion calls configured providers and fails loudly rather than substituting provider fakes.
    status: pending
isProject: false
---

# real-knowledge-ingestion

## Execution Notes

The current `KnowledgeAndReviewPanel` contains fixed `sampleSources`, local dropped-file count, local link and notes state, fixed processor states, and buttons without mutation handlers. Replace that with source records loaded from the server.

The PRD requires broad upload acceptance, typed processing paths, processed output previews, retries, delete, and processing-aware continuation. Unknown files should be stored and marked unsupported or uploaded-but-not-processed, not lost.

## Constraints

No provider fakes. No fixture-only ingestion. No static source list. If LlamaParse, Deepgram, object storage, or URL processing configuration is missing, ingestion must show an operational failure or blocked state.

## Operator Guidance

Depends on `production-foundation` and `durable-domain-model`. Coordinate with `real-ai-generation` on Knowledge Chunk shape and with `real-course-studio-ui` on processing-aware navigation.
