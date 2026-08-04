# CzechInvest current status

Last durable checkpoint: **2026-08-05**.

## Objective

Prepare the smallest credible package that lets Jana Drozenová (Elohir) complete the CzechInvest final report and demonstrates the real promised outputs of all funded activities. The priority is substantive outputs grounded in the current Coursition application, not procurement reconstruction, timesheets, or invented historical paperwork.

## Fixed scope decisions

- Supplier selection, equal-price winners, contractual/procurement thresholds, and AIS processing were verified with CzechInvest and are out of scope unless the user reopens them.
- There is only one binding output in AIS; this has already been resolved with CzechInvest.
- Do not ask for detailed worklogs, hour-by-hour records, or supplier-history narratives unless the user explicitly requests them.
- Create missing deliverables now as honest current outputs. Never backdate them or fabricate authorship, historical delivery, paid-tool data, metrics, tests, signatures, or handovers.
- For product claims, current reproducible application behavior outranks current source, which outranks current tests and screenshots, which outrank older drafts and marketing material.
- Photographic attachments are deliberately deferred. Petr will supply the photos he has.

## Workstreams at this checkpoint

| Area                        | State                                                | Next action                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Final-report factual inputs | Collected and saved                                  | Jana/final editor must place the concise text into the report and finish administrative tables.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Events and workshops        | Researched, categorized, and saved                   | Preserve the three separate report categories; later attach Petr's photos/e-mail evidence.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| A4 SEO                      | **Done**                                             | Deliverables are in `docs/czechinvest/seo/`: 13-sheet XLSX, Czech report + PDF, raw JSONL evidence, reproducible scripts, `README.md`. The document date is the confirmed preparation date, 27 July 2026; the separate data-update and technical-verification date remains 4 August 2026. The final report is framed solely as an internal Coursition deliverable, without funder or activity co-branding. Its 31-page PDF uses the official wordmark, Geist/Inter typography and the Coursition palette, with a blue-led composition deliberately distinct from the plum-led methodologies. Formulas verified by a LibreOffice recalculation (0 error cells). Do not rerun; if data needs refreshing, follow `seo/README.md`.                                                            |
| A8 methodologies            | **Done 2026-08-04**                                  | Deliverables are in `docs/czechinvest/methodologies/`: both methodologies as MD/DOCX/PDF (user 26 pages, IT 40 pages), `A8-podklady-pro-Janu.md`, `_evidence-review-record.md`, `figures/`, reproducible `build-methodologies.mjs`. Produced by one Workflow run `wf_789bb358-9b2`; three-model gate (GPT-5.6 Sol high/max, Opus 5 high, Fable 5 xhigh) passed with no unresolved blockers. Both methodologies' document dates were corrected to the confirmed preparation date, 27 July 2026; the separate application/test verification date remains 4 August 2026. Covers and footers now use concise Coursition-only branding without redundant company naming or funder co-branding. All ten figures were recaptured on 2026-08-05 against the rebranded application (violet on cream, WCAG 2.1 AAA) and both exports were rebuilt from them. Do not rerun; rebuild documents with `node build-methodologies.mjs` after editing the MD files. |
| A5 UX/UI                    | Partly evidenced                                     | Expand the existing logo/design manual into the minimum promised UX/UI output and connect it to current application screenshots.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| A6 development              | Application and partial evidence exist               | Complete the evidence matrix, acceptance evidence, demo scenario, and proof for each actually implemented promised capability.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| A2 branding/marketing/copy  | Partial landing page, deck, design assets; solo-agent handoff ready | Run `workflows/branding-marketing-copywriting/HANDOFF.md` in a fresh solo-agent session. Complete substantive brand, communication, marketing, discovery, and web-copy outputs without interfering with parallel landing-page/application work. |
| A1 market research          | Marked complete; Petr confirms it was documented in the previous report, local evidence link still unverified | Use `workflows/completed-activity-evidence/HANDOFF.md` to locate the previous-report text and attachment; do not recreate the research. |
| A3 trademark                | Marked complete, evidence not yet linked             | Use `workflows/completed-activity-evidence/HANDOFF.md` to verify the EU trademark and IP-scan evidence without recreating either output. |
| A7 legal                    | Marked complete; Petr confirms legal cooperation was documented in the previous report, local evidence links still unverified | Use `workflows/completed-activity-evidence/HANDOFF.md` to locate and map the previous-report evidence; do not recreate legal outputs. |
| Final attachment package    | Pending                                              | After activity outputs are complete, create one attachment index for Jana. Photos remain Petr's input.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

## SEO deliverables (A4) — document date 2026-07-27

`docs/czechinvest/seo/` now contains the finished package:

| File                                          | What it is                                                                                                                                                                                                                                                                                                                                   |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SEO-pruzkum-Coursition.xlsx`                 | 13 sheets. 7 008 keywords, 1 778 recorded search results, 75 probed competitor domains, 1 479 cross-competitor comparison rows, 3 998 URLs, 748 audience questions, 32 on-page rules, 30-page site map, 22 content briefs, 25-item 90-day plan, 3 cluster verdicts, 16 explicit do-not-target calls. Derived scores are real Excel formulas. |
| `SEO-analyza-a-manual-Coursition.md` / `.pdf` | Czech report and manual, ~10 000 words, 13 sections; branded 31-page PDF with its own blue-led visual system.                                                                                                                                                                                                                                |
| `README.md`                                   | How the study was produced and how to repeat it.                                                                                                                                                                                                                                                                                             |
| `data/`                                       | Raw JSON Lines evidence; every row carries source_url, source_name, access_date, method_note, confidence.                                                                                                                                                                                                                                    |
| `scripts/`                                    | The 14 scripts that produced everything, runnable end to end.                                                                                                                                                                                                                                                                                |

**Second finding, on where to compete.** The English cluster was split. On the six queries
about generating a course from a source file (`ai course creator`, `convert pdf to elearning
course`, `turn documents into training course` and similar) 34 of 60 top-ten places belong to
small vendors of Coursition's own kind and only 3 to established players; `learningstudioai.com`
ranks third on `ai course creator` with 46 URLs in its sitemap while `articulate.com` (541 URLs)
and `docebo.com` (417) do not appear at all. Site size is not the gate there, a page named after
the input format is. That cluster is now `en-ai-source-to-course` and is the one primary target.
On the Czech side the decisive constraint is lexical: "kurz" also means an exchange rate and a
course somebody buys, so the qualifier "e-learning" is what makes Czech queries targetable.
See `data/strategy/cluster-verdicts.jsonl` and report section 5.9.

**Technical baseline.** The crawl of `coursition.com` records server-rendered localized pages
with complete titles, descriptions, headings, canonical URLs, hreflang and Open Graph metadata.
The main SEO constraint is the small public content layer: six sitemap URLs, including four
legal pages. See findings T-01 to T-06.

Honest limitations, recorded rather than papered over: exact monthly search volume is absent
(free sources do not provide it, so `volume_exact` is deliberately empty); Google, Bing,
DuckDuckGo and Mojeek refused automated queries on 2026-08-04, so all 575 Czech SERP rows come
from Seznam.cz alone and must not be read as Google positions, while the English rows come from
Startpage (Google-backed, 200), Yahoo (Bing-backed, 196) and WebSearch (236); Google Trends could
not be obtained at all and those rows carry `confidence: low` with an empty value; and field
speed data from real visitors (CrUX) was unreachable — the keyless PageSpeed Insights API now
returns HTTP 429 with a daily quota of zero and CrUX returns HTTP 403 to unregistered callers,
so measurement fell back to local Lighthouse 13.4.1 and the absence of a CrUX record is inferred
rather than confirmed (finding T-16).

## Current execution order

1. ~~Let the existing SEO workflow finish and verify its deliverables.~~ Done 2026-08-04; A4 package is complete in `docs/czechinvest/seo/`.
2. ~~Launch and complete the A8 methodologies workflow.~~ Done 2026-08-04; A8 package is complete in `docs/czechinvest/methodologies/`.
3. Continue landing-page deployment and application redesign in their existing sessions; do not launch duplicate handoffs for this iterative work.
4. Run the fresh solo-agent A2 handoff in `workflows/branding-marketing-copywriting/HANDOFF.md`.
5. Run the separate fresh solo-agent evidence handoff in `workflows/completed-activity-evidence/HANDOFF.md`; A1 and A7 were already documented in the previous report and must not be recreated.
6. Assemble Jana's final text and attachment index; add Petr's photos last.

## Resume rule

Do not infer completion from a handoff, process, raw-data directory, or draft. Inspect the actual final files and validation evidence, update this document, and then update [the checklist](WORKING-CHECKLIST.md).
