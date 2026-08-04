---
name: coursition-source-asset-lifecycle
overview: Give uploaded source bytes a bounded, reversible, privacy-safe R2 lifecycle with rollback, deletion, cleanup recovery, and consistent client and server file validation.
todos:
  - id: source-lifecycle-blob-api
    content: Add source blob delete and cleanup operations to the extracted blob service for local storage and Cloudflare R2 without exposing bucket keys to the client.
    status: completed
  - id: source-lifecycle-upload-rollback
    content: Delete a newly written blob when processing, validation, or the following draft CAS commit fails so an unsuccessful addSource cannot leave unreachable bytes.
    status: completed
  - id: source-lifecycle-delete-outbox
    content: Add a durable D1 cleanup outbox for source and draft deletion so failed R2 deletes are retried and can be audited without retaining user content indefinitely.
    status: completed
  - id: source-lifecycle-deleted-retry
    content: Reject retrySource for deleted sources and ensure source deletion removes derived documents and chunks before scheduling the referenced blob for cleanup.
    status: completed
  - id: source-lifecycle-file-limits
    content: Enforce one documented 10 MiB file limit before client base64 conversion and again at the server schema boundary with clear localized validation errors.
    status: completed
  - id: source-lifecycle-integration-tests
    content: Add local and R2-adapter contract tests for upload success, processing failure, CAS conflict, source deletion, draft deletion, cleanup retry, and zero-orphan reconciliation.
    status: completed
isProject: false
---

# coursition-source-asset-lifecycle

## Execution Notes

R2 cannot participate in a D1 transaction, so use compensating cleanup. Blob writes that do not acquire committed metadata are immediately deleted. Blobs belonging to a successfully deleted source or course are recorded in a small durable cleanup outbox and removed idempotently. The current production bucket is empty, which makes rollout safe but does not remove the need for future cleanup guarantees.

## Constraints

Use the existing Cloudflare D1 and R2 ecosystem and remain viable on the free plan. Do not add a paid queue. Do not log source content, base64 payloads, blob bytes, signed URLs, or provider credentials. Keep Notes and URL source behavior unchanged.

## Operator Guidance

Depends on `coursition-d1-draft-authority`. It may run in parallel with the server workflow lane after storage has extracted the blob service. Own `server/coursition/source-processing.ts`, the blob service, cleanup schema, and cleanup tests. Keep changes to workflow orchestration behind a narrow exported lifecycle API to minimize overlap with the server lane.
