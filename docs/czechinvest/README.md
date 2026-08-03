# CzechInvest continuity hub

This directory is the durable handoff for the Coursition CzechInvest close-out. It exists so a fresh Codex or Claude Code conversation can continue without the previous transcript, clipboard contents, or `/tmp` files.

## Start a new conversation

Use this prompt from the repository root:

> Read `AGENTS.md` and `docs/czechinvest/README.md`, inspect the current status, and continue with the next CzechInvest task I give you. Update the tracker before you finish.

The agent must then read, in order:

1. [Current status](CURRENT-STATUS.md) — current workstreams, boundaries, and next steps.
2. [Working checklist](WORKING-CHECKLIST.md) — the canonical task tracker.
3. [Confirmed inputs from Petr](INPUTS-FROM-PETR.md) — facts that must not be asked again.
4. [Final-report podklady](FINAL-REPORT-PODKLADY.md) — reusable Czech text, especially the mandatory separation of event categories.

At the end of every CzechInvest task, update the status and checklist. If a workflow is already running or its output directory has changed recently, inspect it before launching anything else; never start a duplicate run merely because a previous chat is gone.

## Workflow entry points

- [SEO research handoff](workflows/seo-research/HANDOFF.md)
- [Methodologies handoff](workflows/methodologies/HANDOFF.md)
- [Workflow launch notes](workflows/README.md)

The complete Martina Libřická benchmark required by the SEO workflow is [stored locally](source-files/seo-reference-2026-08-03.xlsx). It must remain a real ten-sheet XLSX file with SHA-256 `4a030075f538f2e3c5c3f04e963f56676ae589a54fd19437e8bf7299980c9fa8`.

The earlier one-sheet export is preserved as `source-files/seo-reference-obsahove-seo-only-2026-08-03.xlsx` for provenance only. Do not use it as the quantitative benchmark.

## Durable evidence already in the repository

- [Final-report draft with Jana's comments](source-files/final-report-draft-with-comments-2026-08-03.docx)
- [Design manual](source-files/design-manual-coursition.pdf)
- [Activity-scope screenshots](source-screenshots/)
- [Application screenshots and provenance](application-screenshots/README.md)
- [CzechInvest presentation source](deck/slides.md) and [exported PDF](coursition-czechinvest-ivo-2026-08-03.pdf)
- [Acceptance audit](../czechinvest-acceptance-audit-2026-07-14.md)
- [Output evidence matrix](../czechinvest-output-evidence-matrix.md)
- [Existing user-manual draft](../czechinvest-user-manual-cs.md)
- [Cloudflare deployment runbook](../cloudflare-deployment-runbook.md)

Google Drive, Gmail, Notion, and the live report remain read-only evidence sources unless the user explicitly authorizes a write. Repository files are the durable working copy.

If an exact transcript audit is ever necessary, the main recovered Codex session is `019fc7b8-34c4-7420-ba79-1120cc51bb56` (started 2026-08-03). A preceding setup session is `019fc6aa-9630-7ed0-b471-44fbb4016695` (started 2026-08-03). The repository files above are authoritative for continuing work; transcript retrieval is only a fallback.
