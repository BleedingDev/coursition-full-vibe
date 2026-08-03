# Handoff: evidence-based SEO research for Coursition

## Mission

Produce a real, current, evidence-backed SEO research package for Coursition that can serve as the substantive output of CzechInvest activity A4. The result must be useful to the product team and credible to an external reviewer. It must match or exceed the qualitative and quantitative depth of the supplied Nauč mě IT benchmark while using free or already-available data sources only.

This is a research and documentation task, not a product-code implementation task. Do not modify the application unless the user explicitly expands the scope.

## Working context

- Repository: `/Users/satan/work/coursition-all/coursition-full-vibe`
- Product: Coursition, a bilingual AI-assisted platform for creating editable courses from source materials and participant context, with both B2B and self-service/B2C potential.
- Inspect the repository rather than relying on this short description. Start with `README.md`, `locales/cs/translation.json`, `locales/en/translation.json`, `src/routes/[lang]/page.tsx`, `src/features/coursition/`, `server/coursition/`, `scripts/generate-seo-static.mjs`, `modern.config.ts`, and the route tree.
- Determine and verify the current production domain from repository/deployment configuration or other authoritative evidence. Do not assume a URL from an email address.
- Relevant final-report template: <https://docs.google.com/document/d/17Qb-Tvb-MOv6lAzD5KVS3hDP9vRVTjKT/edit>
- Administrative context is already handled elsewhere. Do not investigate procurement, invoices, contracts, AIS decisions, or CzechInvest supplier rules.

## Mandatory local benchmark

Read and analyze this downloaded workbook before designing the Coursition deliverable:

`docs/czechinvest/source-files/seo-reference-2026-08-03.xlsx`

Source: `SEO Nauč mě IT`, prepared by Martina Libřická. The local file is a real XLSX export, not a link or placeholder.

- SHA-256: `4a030075f538f2e3c5c3f04e963f56676ae589a54fd19437e8bf7299980c9fa8`
- 10 worksheets
- 665 populated XML rows and 6,181 populated cells overall
- Important benchmark sections include: research notes, narrative content-SEO findings, keyword analysis, full site URL inventory, existing rankings, detailed individual competitor datasets, a cross-competitor keyword/position matrix, and competitor URL inventories.
- Quantitative examples from the benchmark: 142 keyword-analysis rows, 119 rows in the cross-competitor analysis, and 193 rows in the competitor URL inventory.

Use the workbook as a benchmark for scope, density, organization, and decision usefulness. Do not copy Nauč mě IT-specific conclusions, keywords, competitors, positions, search volumes, or URLs into the Coursition output.

## Non-negotiable research rules

1. Research the real current market. Inspect the live product, current search results, current competitors, and the actual repository. Record the collection date for every dataset.
2. Do not invent search volumes, rankings, traffic, keyword difficulty, CPC, SERP features, Core Web Vitals, index counts, or competitor metrics.
3. Every externally derived number must have a source URL or named source, access date, locale, and a short methodology note. Separate exact values, ranges, estimates, and ordinal proxies into distinct fields.
4. If a free source cannot provide a defensible monthly search volume, leave exact volume blank and use a clearly labeled range or relative-demand proxy. Never present an inferred value as measured fact.
5. Do not pay for tools, start paid trials, create billable accounts, bypass access controls, or ask the user to buy an SEO subscription. Use public/free sources and tools already available in the environment.
6. If a site blocks automation, reduce request frequency, use browser-based sampling, public cached/search results, sitemaps, or another lawful source. Record the limitation; do not silently fabricate the missing data.
7. Normalize and deduplicate keywords. Preserve language, country/locale, intent, funnel stage, persona, source, and evidence for each row.
8. Distinguish observations from recommendations. Mark every material assumption and assign a confidence level.
9. The report must be written in Czech for CzechInvest/Jana. English-language queries and market data are still required where relevant.
10. Do not stop after producing a generic AI-written SEO checklist. The spreadsheet must contain real rows of researched evidence and the narrative must derive its recommendations from those rows.

## Free-data research strategy

Use the best combination available at execution time. Prefer primary or directly observable evidence.

- Product/repository crawl: route inventory, rendered HTML, metadata, headings, internal links, canonical URLs, `hreflang`, robots directives, sitemap, status codes, redirects, structured data, indexability, authenticated/private routes, and JavaScript rendering behavior.
- Local Lighthouse and public PageSpeed Insights for performance evidence. Record tested URL, device mode, timestamp, and run variability; do not treat one run as a universal truth.
- Google and/or Bing search result sampling for chosen queries: titles, ranking URLs, SERP intent, result types, People Also Ask, related searches, autocomplete, and visible competitors. Use a Czech locale for Czech queries and a declared English-speaking locale for English queries.
- Google Trends for relative interest, seasonality, related topics, and query comparisons. Export or preserve the underlying values and note that Trends is an index, not monthly volume.
- Free keyword data exposed by reputable providers, Google Ads Keyword Planner if it is already accessible without spending, Google Search Console if it is already configured and authorized, and public webmaster tools. Record the provider and its limitations.
- Competitor websites, their sitemaps, robots files, navigation, page templates, pricing/product pages, blog/category structures, metadata, structured data, and internal linking.
- Public search documentation and current search-engine guidance for recommendations, favoring primary sources.

Do not use raw search-result counts as precise demand. They may be retained only as a low-confidence competition/context signal with an explicit caveat.

## Research coverage

### Market and audience model

Derive the actual positioning from the product and existing materials. At minimum test these candidate clusters rather than accepting them blindly:

- AI course creator / AI course generator
- AI authoring tool and e-learning authoring software
- employee training, onboarding, internal academy, and knowledge transfer
- LMS-adjacent course creation and integrations
- personalized/adaptive learning and learning paths
- creating a course from documents, PDFs, presentations, or company knowledge
- self-service course creation for individuals, trainers, and subject-matter experts
- Czech equivalents and naturally used Czech terminology

Explicitly decide which clusters fit Coursition, which do not, and why. Separate B2B decision makers, HR/L&D users, course authors/trainers, technical buyers, and self-service/B2C users.

### Technical SEO audit

Audit at least:

- discoverable public URLs and route/localization behavior;
- indexable versus private/authenticated product surfaces;
- status codes, redirect chains, canonicalization, `hreflang`, robots and sitemap;
- title, meta description, H1-H6, content depth, duplication, internal links, image text alternatives, Open Graph, and structured data;
- CSR/SSR/rendered-content accessibility to crawlers;
- page performance and mobile behavior;
- broken links and orphaned public pages;
- whether Czech and English pages correctly target their intended locale;
- gaps between current landing-page content and the demand discovered in the keyword research.

Tie every issue to evidence, affected URLs, severity, expected impact, effort, recommended fix, and a verification method.

### Keyword and SERP research

Build a defensible keyword universe with both Czech and English segments. The benchmark contains 142 keyword rows; the Coursition workbook must contain at least 150 unique, relevant, deduplicated keyword/query rows unless evidence shows the addressable niche is genuinely smaller. Do not pad the dataset with irrelevant variants merely to hit the number.

For each row include, when evidence permits:

- normalized keyword/query;
- language and target locale;
- cluster/topic;
- persona and B2B/B2C segment;
- intent and funnel stage;
- exact search volume or declared range/proxy;
- volume/source date and provider;
- trend/seasonality signal;
- SERP composition and representative ranking URLs;
- observed Coursition position if any, with collection method and date;
- competition/difficulty proxy with an explained rubric;
- business relevance and conversion potential;
- recommended target page or new page type;
- priority score calculated from visible component scores;
- confidence and notes.

Sample real SERPs deeply enough to support the recommendations. As a target, collect the top organic results for at least 50 high-value queries across the selected locales, subject to lawful access and rate limits. Store the query, locale, timestamp, rank, domain, URL, title, and result type. If this target cannot be met, document exactly why and retain the completed sample rather than replacing it with invented data.

### Competitor research

Select competitors from observed SERPs and product overlap, not memory alone. Include at least six direct/product competitors and three indirect/content competitors if the evidence supports that many.

For each competitor capture:

- positioning and target segment;
- relevant ranking/content pages and their target intent;
- sitemap/navigation-derived URL inventory;
- content hubs, topic clusters, templates, lead magnets, comparison pages, glossary/help content, and programmatic SEO patterns;
- metadata and structured-data patterns;
- strengths, weaknesses, exploitable gaps, and lessons for Coursition;
- representative search visibility based on the collected SERP sample, not unsupported traffic estimates.

The benchmark contains a 119-row comparison matrix and 193-row competitor URL inventory. Aim for at least 120 evidence-rich cross-competitor keyword/query comparisons and at least 200 relevant competitor URLs across the chosen set, unless the market evidence makes those thresholds artificial. Quality and relevance take precedence over padding; explain any shortfall.

### Strategy and implementation-ready recommendations

Translate the evidence into:

- an information architecture/site map for Czech and English public pages;
- keyword-to-page mapping that prevents cannibalization;
- recommended URL, title, meta description, H1, intent, persona, primary/secondary keywords, internal links, and CTA for every proposed priority page;
- a prioritized 90-day roadmap split into technical fixes, core landing pages, comparison/use-case pages, and supporting content;
- at least 20 evidence-based content briefs, each linked to a keyword cluster and SERP gap;
- measurement plan with Search Console/analytics events, baseline fields, KPIs, and a repeatable monthly review process;
- explicit “do not target / not worth doing now” findings to demonstrate prioritization rather than indiscriminate content generation.

## Required deliverables

First inspect the repository for an established CzechInvest/deliverables directory. If none exists, create `docs/czechinvest/seo/` and place the final outputs there.

1. `SEO-pruzkum-Coursition.xlsx`
   - A polished, filterable workbook with real datasets, formulas for derived priority scores, source URLs, collection dates, methodology notes, and clearly separated raw observations versus recommendations.
   - Use the benchmark's 10-sheet depth as the baseline. A suitable structure is: `Souhrn`, `Metodika a zdroje`, `Technické SEO`, `Klíčová slova`, `SERP vzorek`, `Současné pozice`, `Konkurenti`, `Analýza konkurence`, `URL inventář`, `Mapa webu a obsahový plán`.
   - Adapt the structure if the evidence calls for it, but do not collapse the work into one superficial table.

2. `SEO-analyza-a-manual-Coursition.md`
   - A Czech narrative report explaining the method, limitations, findings, competitor landscape, technical issues, proposed architecture, on-page rules, content strategy, prioritization, and measurement plan.
   - It must cite workbook sheets/ranges or source URLs close to material claims.

3. `SEO-analyza-a-manual-Coursition.pdf`
   - Generate a readable final PDF from the narrative source if a reliable local conversion path is available. If conversion is unavailable, do not fake it; state the concrete blocker and leave the complete Markdown source ready for conversion.

4. Reproducibility artifacts
   - Preserve lightweight scripts, raw CSV/JSON exports, query lists, crawl settings, and a concise `README.md` sufficient to rerun or update the research.
   - Do not commit cookies, tokens, personal account exports, or credentials.

## Workbook quality bar

- Match the supplied workbook's information density while improving traceability.
- Freeze headers, enable filters, use readable widths/wrapping, and apply consistent types and formats.
- Keep numeric fields numeric. Do not store `590 searches` as text when the value is known to be numeric.
- Use formulas for priority scoring and visible lookup/mapping logic. Document scoring weights and confidence handling.
- Include a source and collection date on every researched row or through a clearly linked source table.
- No `#REF!`, `#VALUE!`, `#DIV/0!`, broken formulas, clipped core fields, blank placeholder sections, or invented cells.
- Visually inspect every sheet before completion.

## Definition of done

Do not declare completion until all of the following are true:

- the benchmark workbook has been inspected and its useful patterns have been reflected without copying its domain-specific content;
- the live product and repository have both been audited;
- the keyword, SERP, competitor, URL, and technical datasets contain real current observations with sources and dates;
- the workbook reaches comparable depth to the benchmark or includes a specific evidence-based explanation for any lower row count;
- the Czech report draws its claims and recommendations from the collected evidence;
- proposed pages and content are mapped to real query clusters, personas, and funnel stages;
- unsupported numbers and generic AI filler have been removed;
- spreadsheet formulas and layouts have been verified;
- all final file paths and any limitations are reported to the user.

Work autonomously. Make reasonable, documented assumptions and continue through the full research workflow. Ask the user only when missing access or a strategic decision genuinely prevents progress; otherwise finish the best defensible version with the available evidence.

## Out of scope

- CzechInvest procurement compliance, supplier selection, invoices, contract limits, or AIS history
- fabricating historical delivery dates, paid-tool exports, rankings, volumes, traffic, or authorship
- implementing the recommended SEO changes in product code
- backlink outreach or contacting external parties

## Suggested skills

Invoke the closest available equivalents of these skills before starting:

- `deep-research` for source-backed market and competitor research
- `agent-browser` for live-site inspection, public SERP sampling, Google Trends, and free web tools
- `spreadsheets:Spreadsheets` for studying the benchmark and producing/verifying the XLSX
- `documents:documents` for the narrative report and PDF conversion
- `scout-local` for a focused inventory of public routes, SEO implementation, and product positioning in the repository
