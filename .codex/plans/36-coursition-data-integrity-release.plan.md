---
name: coursition-data-integrity-release
overview: Integrate every data-consistency lane, migrate and verify production safely, exercise concurrent real workflows, and deploy one evidence-backed release with an immediate rollback path.
todos:
  - id: integrity-release-integrate
    content: Review and integrate the storage, server, source, client, and form lanes against the revision contract and remove duplicate authority, stale fallback, and overlapping mutation paths.
    status: completed
  - id: integrity-release-gates
    content: Run format, lint, typecheck, Effect diagnostics, i18n, all tests, UltraModern contract checks, Cloudflare build, migration dry-run, and invariant audit before deployment.
    status: completed
  - id: integrity-release-staging-qa
    content: Exercise two authenticated browser sessions through create, edit, autosave, rapid route changes, locale changes, source upload, generation, delete, conflict, refresh, and auth-expiry scenarios on a non-production deployment.
    status: completed
  - id: integrity-release-production-migration
    content: Capture aggregate backup evidence, run the per-draft production backfill, verify counts and revisions, and keep the old aggregate read-disabled but available for immediate rollback.
    status: completed
  - id: integrity-release-deploy-smoke
    content: Deploy the verified Worker, repeat the critical multi-tab smoke flow, verify D1 and R2 invariants plus zero abandoned runs, and remove all temporary QA users, courses, sessions, and blobs.
    status: completed
  - id: integrity-release-closeout
    content: Record the production version, migration result, rollback command, invariant counts, and remaining non-blocking risks for the CzechInvest delivery handoff.
    status: completed
isProject: false
---

# coursition-data-integrity-release

## Execution Notes

This is the only integration and deployment lane. It starts after all three downstream implementation branches are complete. The release is accepted only when concurrent browser sessions cannot lose a course, late route responses cannot flash or block loading, AI completion preserves edits, source deletion leaves no R2 orphan, and a hard refresh shows the same committed state.

Production verification must use aggregate counts and generated QA identifiers rather than printing real user content. Retain the previous Worker version and the backed-up global row through the smoke window.

## Constraints

Do not deploy partial lanes. Do not run destructive concurrency experiments against existing user drafts. Do not leave QA accounts, sessions, courses, R2 objects, debug instrumentation, or audit logs in the repository. Documentation here is limited to operational release evidence; the full RsPress technical and user manuals remain a later delivery.

## Operator Guidance

Depends on `coursition-server-workflow-integrity`, `coursition-source-asset-lifecycle`, and `coursition-form-autosave-integrity`. Use one integration owner. Parallelize quality gates, migration dry-run, and staging browser scenarios only when they do not mutate the same environment. Stop immediately on any revision conflict that is silently converted to success.

## Release Evidence — 2026-07-15

- UltraModern release gate passed: format, lint, Effect TypeScript, Effect diagnostics, i18n, skills contract, UltraModern contract, 89 browser-independent tests, and 23 D1/R2 tests (112 total).
- Cloudflare deployment: 7020.83 KiB raw / 1998.55 KiB gzip with Ax retained.
- Local Cloudflare browser smoke passed auth URL redirects, create → back without refresh, hard-refresh persistence, theme persistence, zero workflow reload on locale switch, per-tab source draft preservation, source creation, logout/login resume, and delete.
- Pre-migration D1 export: `artifacts/backups/coursition-2026-07-15T17-48-02-151Z.sql`, ignored by git.
- Migrations `0001_warm_miss_america.sql` and `0002_ancient_inertia.sql` applied remotely; no migrations remain pending.
- Backfill verified the four legacy drafts and owners while preserving one newer authoritative QA row during deployment; the QA row was removed after smoke verification.
- Production URL: `https://coursition.com`, version `71888359-1351-4ff0-ab95-e9bfaabd0318`.
- Production browser smoke passed create → immediate dashboard return, locale switch without workflow reload, explicit URL-step navigation, and non-navigation mode mutation without a hidden step jump.
- Fresh PDF upload showed immediate persistent progress, reset the native file control after completion, and produced a processed `cloudflare_markdown` source through the Workers AI binding without LlamaParse credentials.
- Production deletion removed the QA draft plus all three captured R2 objects; the verified cleanup outbox was empty. QA user, sessions, operations, draft, and owner state were removed.
- Post-release invariants: 4 drafts, 4 owners, 0 invalid draft payloads/revisions, 0 pending cleanup jobs, and 0 abandoned operations.
- Previous Worker version: `0d568ca1-5603-486b-8076-cb52fa33f9fe`. Application rollback command: `pnpm exec wrangler rollback 0d568ca1-5603-486b-8076-cb52fa33f9fe --config .output/wrangler.json --yes`.
