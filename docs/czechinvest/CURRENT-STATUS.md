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
| A5 UX/UI                    | Produkční rozhraní nasazeno a ověřeno 2026-08-05     | Finální rozhraní na `https://coursition.com` prošlo produkčním průchodem v češtině i angličtině; povinná publicita CzechInvest / Technologická inkubace se po načtení patičky zobrazuje. Zbývá krátké průchodové video. |
| A6 development              | Cloudflare Worker SSR a hlavní průchod ověřeny 2026-08-05 | `coursition.com` běží přímo na Workeru `coursition-full-vibe` (verze `15420de0-c4e3-4967-965a-aab1d323eb4c`). Produkčně ověřeno: registrace, odhlášení a nové přihlášení, dashboard a obnovení kurzu, poznámkový/souborový/URL zdroj, příprava, AI cíle a aktivity, obsah, náhled, správné vyhodnocení aktivity, AI zpětná vazba, invalidace po přidání zdroje a následná regenerace. Přepnutí CS/EN zachovalo účet, kurz i krok. AI operace fungují, ale mohou trvat desítky sekund až přibližně dvě minuty. Testovací kurz, účet i R2 objekt byly po ověření odstraněny; zůstalo původních 10 draftů a 8 R2 objektů. Zbývá krátké video. |
| A2 branding/marketing/copy  | **Strategický balíček schválen Petrem 2026-08-05; zbývá administrativní předání** | Pět interních dokumentů Coursition je odděleno od CzechInvest administrativy v `docs/branding-marketing-copywriting/`: MD/DOCX/PDF, `README.md`, brand manifest a reprodukovatelný build. Petr 5. 8. 2026 výslovně potvrdil, že mu dokumenty dávají smysl a schvaluje je. Dokumenty neobsahují CzechInvest/Jana/A1–A8 terminologii ani cesty `docs/czechinvest`; zbytečný předávací dokument byl odstraněn. Obálky používají kanonické logo Coursition. Zbývá zahrnout výstupy do finálního seznamu příloh pro Janu; produktová prezentace zůstává samostatně v CzechInvest balíčku. |
| A1 market research          | **Hotovo a doloženo v předchozí zprávě**             | Petr 5. 8. 2026 znovu potvrdil uzavření; nic nedohledávat ani nevytvářet. |
| A3 trademark                | **Hotovo a doloženo**                                 | Petr 5. 8. 2026 znovu potvrdil uzavření ochranné známky a souvisejících podkladů; nic nedohledávat ani nevytvářet. |
| A7 legal                    | **Hotovo a doloženo včetně GDPR**                    | Petr 5. 8. 2026 znovu potvrdil uzavření; nic nedohledávat ani nevytvářet. |
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
3. ~~Deploy and verify the current application for evaluator access.~~ Done 2026-08-05: direct Cloudflare Worker SSR on `coursition.com`; authenticated CS/EN golden-course flow verified end to end. Next record the walkthrough video.
4. ~~Complete A2 branding/marketing/copy package.~~ Interní strategické dokumenty jsou v `../branding-marketing-copywriting/`; CzechInvest složka pouze eviduje jejich použití pro reporting.
5. Run the separate fresh solo-agent evidence handoff in `workflows/completed-activity-evidence/HANDOFF.md`; A1 and A7 were already documented in the previous report and must not be recreated.
6. Assemble Jana's final text and attachment index; add Petr's photos last.

## Resume rule

Do not infer completion from a handoff, process, raw-data directory, or draft. Inspect the actual final files and validation evidence, update this document, and then update [the checklist](WORKING-CHECKLIST.md).
