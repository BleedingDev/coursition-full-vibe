ultracode

# Handoff: produce the Coursition user and IT methodologies

## Mission

Use one native Claude Code Workflow to produce the two missing CzechInvest Activity A8 outputs:

1. **Metodika pro uživatele Coursition**
2. **Metodika pro IT Coursition**

Both documents must be in Czech, concise but substantive, professionally formatted, and fully anchored in the current Coursition application. They must describe what the application actually does now. Do not invent planned capabilities, historical delivery claims, infrastructure, procedures, integrations, or screenshots.

This is a documentation workflow. Do not implement or redesign the product. If the application and an older document disagree, treat the running/current application and current source as authoritative, correct the documentation, and record the discrepancy internally.

## Repository and ownership

- Repository: `/Users/satan/work/coursition-all/coursition-full-vibe`
- Read and obey the repository `AGENTS.md` before any action.
- The worktree is already dirty and contains user/other-agent work. Preserve it. Do not reset, clean, revert, delete, or overwrite unrelated changes.
- Limit authored outputs to a new or existing methodology directory under `docs/czechinvest/`. Do not edit application source, tests, configuration, migrations, package files, the SEO work, or the existing presentation unless the user explicitly expands scope.
- Do not commit, push, upload, email, or modify Google Drive/Notion. Produce the local final package and report paths to the user.

## Mandatory workflow orchestration

The keyword `ultracode` is intentional. Execute this through **exactly one native Claude Code Workflow invocation**. Do not emulate the Workflow with ad-hoc fixed subagents. An `async_launched` result means the run exists; record its task/run IDs and wait for it. Do not launch a duplicate run merely because it is still active.

Load and follow the local `claude-ecosystem` and `efficient-fable` instructions before composing the Workflow script. Prefix every routed `agent()` prompt with the required `[[claude-ecosystem:...]]` marker using a registered alias; never invent a route alias.

### Required model gate

Every final methodology artifact and the final Activity A8 summary must receive independent feedback from all three model families below:

1. **GPT-5.6 Sol**, high reasoning or higher
   - Use the registered Sol aliases (`claude-sol-high` for normal evidence/drafting work and `claude-sol-max` for the independent factual/technical review).
   - Verify from Workflow metadata/router traces that the resolved target is GPT-5.6 Sol and the effort is high or max.

2. **Opus 5**, high reasoning or higher
   - The user explicitly requires Opus **5**, not Opus 4.8.
   - Resolve the currently registered/native Opus 5 route before generating the Workflow script. A native `opus` Workflow slot is acceptable only when the run metadata/transcript proves it resolved to `claude-opus-5` with high-or-higher effort.
   - Do not silently substitute `claude-opus-4-8-high`, Sonnet, or another model. If Opus 5 high+ cannot be routed, stop and report that concrete blocker instead of downgrading or guessing an alias.

3. **Fable 5**, xhigh reasoning
   - Use the registered `claude-fable-5-xhigh` route.
   - Keep Fable scarce: one planning/judgment pass and one final reconciliation/judge pass at most. Do not use Fable for bulk drafting.

Run the Sol and Opus reviews independently, preferably in parallel after complete candidate documents exist. Fable then reads the candidate documents, both review reports, verification evidence, and any conflicts; it is the final judge. If review produces material fixes, apply them and run targeted Sol + Opus re-review before Fable's final acceptance. Do not claim the three-model gate passed without inspecting the persisted Workflow metadata/router traces and reporting the resolved models and efforts.

Suggested Workflow phases:

1. `Evidence`: Sol High inventories authoritative sources and builds a claim/evidence map.
2. `Application verification`: Sol High verifies real user flows and current technical behavior; this phase is read-only against the app/code.
3. `Drafting`: separate bounded Sol lanes draft the user and IT methodologies from the shared evidence packet.
4. `Document production`: a bounded owner produces consistent Markdown/DOCX/PDF outputs and figures.
5. `Independent review`: Sol Max and verified Opus 5 high+ review both complete artifacts without editing them.
6. `Correction`: Sol High applies only verified fixes.
7. `Final judgment`: Fable 5 xhigh reconciles reviews, reopens the final artifacts, and either accepts them or returns specific blockers.

Use bounded schemas for every lane. Each result must identify sources inspected, claims verified, uncertainties, output paths, and blockers. No vague “looks good” review is acceptable.

## Source-of-truth order

Use this order whenever sources conflict:

1. reproducible behavior in the current running application;
2. current source code, routes, runtime configuration contracts, schemas/migrations, and tests;
3. current screenshots captured from that application;
4. existing current technical documentation;
5. older CzechInvest drafts, screenshots, presentation text, Notion/Drive exports, and comments.

Do not infer functionality merely from a button label, unfinished code path, test fixture, marketing claim, or planned output. A user-visible capability belongs in the methodology only when it can be demonstrated or clearly verified in current implementation. An operational procedure belongs in the IT methodology only when it follows from current configuration/code or has been safely exercised.

## Existing artifacts to inspect, not duplicate

Start with these sources and reference them rather than copying them into new side reports:

- Activity scope and working status: `docs/czechinvest/WORKING-CHECKLIST.md`
- Exact A8 scope screenshot: `docs/czechinvest/source-screenshots/16-methodology-activity.png`
- Existing user-manual draft: `docs/czechinvest-user-manual-cs.md`
- Existing application evidence map: `docs/czechinvest-output-evidence-matrix.md`
- Existing acceptance audit: `docs/czechinvest-acceptance-audit-2026-07-14.md`
- Deployment operations: `docs/cloudflare-deployment-runbook.md`
- Current application screenshots and their provenance: `docs/czechinvest/application-screenshots/` and its `README.md`
- CzechInvest source report and comments: `docs/czechinvest/source-files/final-report-draft-with-comments-2026-08-03.docx`
- Current CzechInvest presentation, for terminology only: `docs/czechinvest/coursition-czechinvest-ivo-2026-08-03.pdf` and `docs/czechinvest/deck/slides.md`
- Existing design manual, only where it helps UI terminology: `docs/czechinvest/source-files/design-manual-coursition.pdf`

Inspect the relevant current application surfaces and implementation, including routes, translations, workflow UI, shared workflow/domain contracts, authentication, configuration, persistence, source ingestion/storage/cleanup, AI-provider integration, deployment scripts, database schema/migrations, and focused tests. Use TraceDecay first for code navigation as required by the repository environment; do not perform a blind full-tree scan.

Do not expose any secret values from `.dev.vars`, environment variables, provider configuration, cookies, databases, logs, or account data. The IT methodology may name required configuration keys and describe their purpose, but never include real values.

## Application verification requirements

Before drafting, identify an existing safe runnable URL or start the application without disrupting an existing server. Use `agent-browser` in named sessions to verify the real flows in both Czech and English where localization affects behavior. Verify representative desktop and mobile states.

At minimum verify, where currently implemented:

- landing page and language switching;
- registration, sign-in, sign-out, and protected-route behavior;
- dashboard and course lifecycle;
- course mode selection;
- source entry by notes, URL, and supported file types;
- source processing status, retry, preview, and deletion;
- preparation/personalization inputs;
- objectives, activities, generated content, and interactive preview;
- editing/regeneration and stale/downstream state behavior;
- persistence, resuming, and course deletion;
- error messages and supported troubleshooting actions;
- responsive/mobile behavior relevant to the manual.

Use a disposable test account and non-sensitive sample content if a test environment is available. Do not mutate production user data. If a flow cannot be safely exercised, verify it from current code/tests and label that evidence path; do not pretend it was manually tested.

Reuse existing screenshots only after confirming they still match the current UI. Recapture stale or missing screens with consistent viewport, language, theme, and clean demo content. Avoid personal data in screenshots. Record capture URL/route, viewport, date, and application revision in the screenshot README or a compact evidence map.

## Deliverable 1: user methodology

Create a Czech methodology that a real non-technical course author can follow without repository knowledge. It should be approximately 12–20 useful pages after rendering, depending on screenshot density; do not pad it.

Cover only verified behavior:

- document purpose, audience, prerequisites, terminology, version/date;
- supported languages, devices, and access;
- registration, sign-in, sign-out, and account safety;
- dashboard and course creation/resumption/deletion;
- both course-creation modes if actually supported;
- adding and managing notes, URL, and file sources, including limitations;
- preparation/personalization, objectives, activities, content, editing, and preview;
- how AI-generated suggestions are reviewed and corrected by the user;
- save/regeneration/stale-state semantics that matter to the user;
- data-handling and copyright/privacy cautions in plain language;
- concise troubleshooting with observable symptoms and actions;
- a short end-to-end demonstration scenario;
- glossary and support/escalation information that can be stated truthfully;
- screenshots placed next to the relevant procedure, with accurate captions and useful alt text in the source document.

Do not turn it into marketing copy, a feature wish list, or an internal developer guide. Avoid invented SLAs, supported formats, limits, integrations, and contact processes.

## Deliverable 2: IT methodology

Create a Czech operational methodology for a competent developer/operator. It should be approximately 15–25 useful pages after rendering, depending on diagrams/tables; do not pad it with generic DevOps boilerplate.

Cover the verified current system:

- purpose, audience, scope, version/date, and clear exclusions;
- system/context and container-level architecture grounded in actual components;
- runtime/deployment topology and public/private surfaces;
- repository structure relevant to operation;
- environments and configuration keys by name/purpose/sensitivity, never secret values;
- authentication/session behavior and authorization boundaries;
- persistence/data model, migrations, and ownership of course/source data;
- source ingestion, parsing, blob/file lifecycle, retries, deletion, and cleanup;
- AI provider boundary, model configuration, failure behavior, and deterministic fallback only if actually present;
- localization, public routes, canonical behavior, and generated SEO files only insofar as they affect operation;
- build, preview, deployment, smoke checks, and rollback based on existing scripts/runbooks;
- backup, restore, and recovery procedures grounded in the actual storage/deployment platform;
- logging/diagnostics, incident triage, and safe escalation;
- security/privacy controls and remaining operational limitations stated proportionately;
- relevant automated tests and a compact release/maintenance checklist;
- known limitations and manual steps, without disguising them as automation.

Diagrams must be generated from verified architecture, remain readable in the PDF, and use the same component names as the source/configuration. Do not claim unimplemented monitoring, backup automation, RTO/RPO, redundancy, encryption properties, or compliance certifications.

## Required output package

First inspect `docs/czechinvest/` for current conventions. Prefer a dedicated directory such as `docs/czechinvest/methodologies/` without moving or renaming existing user files.

Produce:

- `Metodika-pro-uzivatele-Coursition.md`
- `Metodika-pro-uzivatele-Coursition.docx`
- `Metodika-pro-uzivatele-Coursition.pdf`
- `Metodika-pro-IT-Coursition.md`
- `Metodika-pro-IT-Coursition.docx`
- `Metodika-pro-IT-Coursition.pdf`
- `A8-podklady-pro-Janu.md`
- a compact internal evidence/review record that maps material claims to application routes, code/tests, screenshots, or existing runbooks and records the three-model review outcome.

`A8-podklady-pro-Janu.md` must contain immediately reusable Czech text for the final report:

- objective of the activity;
- work performed;
- concrete outputs created;
- how the activity objective was fulfilled;
- short note on any truthful deviation or limitation;
- exact local output paths and suggested attachment names.

The DOCX and PDF versions must be final deliverables, not placeholders. Preserve Czech diacritics, fonts, headings, tables, page numbers, captions, and links. Include a table of contents where useful. No `TODO`, lorem ipsum, broken links, clipped figures, missing images, or internal agent commentary may remain.

## Minimalism and CzechInvest suitability

The goal is the smallest credible, useful package that fully satisfies the two promised outputs. Do not create timesheets, procurement narratives, supplier histories, fictional handover dates, or unrelated bureaucracy. Do not duplicate whole source documents inside appendices.

The documents should read as methodologies produced for the Coursition product, not as an explanation of how an AI agent assembled evidence. Keep evidence/review provenance in the compact internal record, not in the user-facing prose unless a source citation materially helps.

## Validation and acceptance

Before final judgment:

- reopen and compare both Markdown sources, DOCX files, and PDFs;
- render/visually inspect every PDF page and representative DOCX pages;
- verify screenshot readability and captions;
- scan for placeholders, secrets, personal data, unsupported claims, contradictory terminology, stale screen labels, broken internal references, and duplicate sections;
- verify Czech grammar and consistent vocabulary across both methodologies and the current translations;
- verify every command shown in the IT methodology is safe, current, and copied from or reconciled with existing scripts/runbooks;
- verify architecture/configuration claims against current code and tests;
- ensure the final documents describe the same product state and use the same terminology;
- inspect `git diff`/status and confirm no application code or unrelated user work changed;
- retain concrete browser/test/render evidence or state exact blockers.

### Required review focus

The independent Sol and Opus 5 reviewers must each review both methodologies and the Jana summary. Their reports must contain only evidence-backed findings classified as blocking/non-blocking, with exact section/page/file anchors, unsupported-claim checks, missing-flow checks, security/secrets checks, operational realism, user clarity, and confidence.

Fable 5 then adjudicates disagreements and returns a final matrix for:

- user methodology factual fidelity;
- IT methodology architectural/operational fidelity;
- cross-document consistency;
- document/render quality;
- CzechInvest A8 coverage;
- unresolved blockers;
- confirmed resolved models and reasoning levels for Fable, Sol, and Opus.

Completion requires zero unresolved blocking findings. If the current application does not support a promised detail, document the honest limitation rather than modifying the product or fabricating completion.

## Out of scope

- SEO research or the SEO workbook
- UX/UI or brand-manual expansion
- marketing, sales, procurement, contracts, invoices, AIS, or accounting
- changes to product code, infrastructure, production data, or deployment
- fake authorship, signatures, dates, testing, handovers, or operational capabilities
- contacting suppliers, CzechInvest, Jana, or any external party

## Suggested skills

Invoke these skills, or their closest installed equivalents, before the relevant phase:

- `claude-ecosystem` — mandatory native Workflow routing and persistent model traces
- `efficient-fable` — keep Fable scarce while preserving final frontier judgment
- `documents:documents` — DOCX authoring and verification
- `pdf:pdf` — PDF generation and full-page visual inspection
- `agent-browser` — verify current UI flows and capture evidence
- `tracedecay:exploring-code` — evidence-led navigation of the current implementation
- `architecture-evidence-verification` — prevent invented topology, isolation, backup, or security claims
- `qa` — final cross-format and claim-quality gate

## Final response contract

Report concisely:

- final output paths;
- what was verified directly in the application versus from code/tests;
- material corrections made after Sol/Opus feedback;
- Fable's final verdict;
- resolved model + effort evidence for Fable 5, GPT-5.6 Sol, and Opus 5;
- any remaining non-blocking limitations.

Do not merely describe a plan. Execute the Workflow through completed, reviewed, locally saved deliverables.
