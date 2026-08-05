# CzechInvest - pracovní checklist

Kanonický pracovní seznam pro podklady Janě Drozenové (Elohir). Při nové konverzaci nejprve přečíst [continuity hub](README.md), [aktuální stav](CURRENT-STATUS.md) a [potvrzené vstupy](INPUTS-FROM-PETR.md). Zdrojové dokumenty, e-maily, Google Drive a Notion jsou pouze ke čtení. `[x]` znamená hotovo podle dosavadních podkladů; před odevzdáním je ještě nutné zkontrolovat konkrétní soubor.

## 1. Přístupy a uložené zdroje

- [x] Gmail `syreanis@gmail.com`: dostupný, nalezena komunikace s Ivem Stančekem a CzechInvestem.
- [x] Závěrečná zpráva včetně komentářů: [lokální DOCX](source-files/final-report-draft-with-comments-2026-08-03.docx).
- [x] Vzor pro SEO: [lokální XLSX](source-files/seo-reference-2026-08-03.xlsx).
- [x] Design Manual: [lokální PDF](source-files/design-manual-coursition.pdf), 14 stran; obsahuje nedokončené místo pro text copywritera.
- [x] Všech 17 dodaných screenshotů je uloženo ve [source-screenshots](source-screenshots/).
- [x] Google Drive složka `Coursition`: read-only OAuth přes `gog` funguje; ověřena metadata i strom složek.
- [x] SEO tabulka: read-only Sheets API funguje a vidí list `Obsahové SEO`.
- [x] Notion: OAuth funguje; čerstvý `codall` našel stránku `Design Manual Coursition`. Aktuální starou relaci je nutné restartovat.
- [x] Závěrečná zpráva je soubor Office, proto ji Google Docs API neumí číst přímo; použít Drive download/export a uložený DOCX.

### Stav připojení

1. Google Cloud projekt `Coursition Workspace CLI` (`coursition-workspace-cli`) je vytvořený. Gmail, Drive, Docs a Sheets API jsou povolené; OAuth klient typu **Desktop app** je aktivní a aplikace je v produkci.
2. `gog` je autorizovaný výhradně pro čtení. Pro případnou obnovu použít:

   ```sh
   gog auth credentials ~/Downloads/client_secret_*.json
   gog --readonly --gmail-no-send auth add syreanis@gmail.com --services gmail,drive,docs,sheets
   gog auth list --check
   gog auth doctor --check
   ```

3. Notion nevyžaduje další přihlášení. Ukončit starou Codex relaci a spustit novou příkazem `codall`, aby načetla nové MCP nástroje.

## 2. Texty do závěrečné zprávy - Petr

- [x] **Finanční vývoj a růst firmy:** částky, data, splacená a nesplacená část i nulové tržby z produktu jsou uložené v [potvrzených vstupech](INPUTS-FROM-PETR.md).
- [x] **Vývoj týmu:** 0 interních zaměstnanců na začátku i konci; externisté podle potřeby; bez stálého týmu.
- [x] **Dopad inkubace:** potvrzen vznik editovatelné platformy a věcně popsaná chybějící marketing/sales/strategy podpora.
- [x] **Plány do budoucna:** placený pilot, možné nasazení, B2C samoobsluha a průzkum dalších programů.
- [x] **Partnerství a dohody o spolupráci** (otázka 7): žádné; Just English skončilo bez dohody.
- [x] **Nalezené zakázky a zájem zákazníků** (otázka 8): bez uzavřené zakázky.
- [x] **Uskutečněné prodeje a jejich celková hodnota** (otázka 9): 0 prodejů, 0 Kč.
- [x] **Jak inkubace pomohla a co během ní chybělo** (otázka 10).
- [x] **Klíčové týmové poznatky** (otázka 11).
- [x] **Další firemní kroky po inkubaci** (otázka 12).
- [x] **Využití alumni komunity CzechInvest a možný vlastní přínos** (otázka 13).
- [x] **Plány účasti v dalších programech CzechInvest** (otázka 14).
- [x] **Ostatní novinky:** události, meetupy, hackathony a podcast jsou roztříděné v [podkladech](FINAL-REPORT-PODKLADY.md).
- [x] **Manažerské shrnutí:** všechny potřebné vstupy jsou dostupné v uložených podkladech.
- [ ] **Vložit a redakčně sjednotit texty v živé závěrečné zprávě.** Připravené texty zatím nebyly do dokumentu zapsány.
- [ ] **Předat Janě seznam příloh a odkazy na podklady**, aby mohla dokončit přílohovou část zprávy.

## 3. Části, které doplní Jana nebo je nutné potvrdit

- [x] Předchozí zpráva a její již doložené aktivity jsou uzavřené; znovu je nedohledávat ani nedokládat.
- [ ] Doplnit finální tabulku celkových nákladů.
- [x] Rozsah detailu akcí ověřen s Ivem: jednotlivé události není nutné rozsáhle rozvádět.
- [x] Podklady k absolvovaným workshopům a jejich přínosu jsou uložené a oddělené od ostatních akcí.
- [x] Podklady ke spolupráci s inkubačním manažerem / nepřímé podpoře jsou uložené samostatně.
- [x] Podklady ke komunikačním aktivitám jsou uložené samostatně, včetně CityJS, ELC, hackathonů a podcastu.
- [ ] Přenést tyto tři samostatné bloky do živé závěrečné zprávy.
- [ ] Dokončit tabulku rizik po dodání podkladů.
- [ ] Dokončit sekci příloh po dodání podkladů od Petra.

## 4. Výstupy podle financovaných aktivit

Celková přímá podpora: **4 500 000 Kč**.

### Průzkum trhu - 250 000 Kč - hotovo

- [x] Aktivita označena jako dokončená.
- [x] Petr 5. 8. 2026 potvrdil, že předchozí zpráva i průzkum trhu jsou hotové a doložené; nic znovu nedohledávat, nepropojovat ani nevytvářet.

### Ochranná známka - 50 171 Kč - hotovo

- [x] Aktivita označena jako dokončená.
- [x] Petr 5. 8. 2026 potvrdil, že ochranná známka i související podklady jsou hotové; znovu je nedokládat.

### SEO - 180 000 Kč - hotovo, datum dokumentu 27. 7. 2026

Výstupy jsou v [`seo/`](seo/README.md). Sběr dat proběhl 4. 8. 2026, vše z bezplatných
a veřejných zdrojů.

- [x] Připravit a uložit [detailní workflow handoff](workflows/seo-research/HANDOFF.md) a kompletní desetilistý benchmark Martiny Libřické.
- [x] Zahájit SEO workflow; k checkpointu 4. 8. 2026 probíhal technický sběr dat v `seo/data/`.
- [x] Ověřit, že existující SEO workflow doběhlo; duplicitní běh nespuštěn.
- [x] Vytvořit SEO analýzu podle uloženého vzoru — [`seo/SEO-pruzkum-Coursition.xlsx`](seo/SEO-pruzkum-Coursition.xlsx), 13 listů.
- [x] Vytvořit SEO manuál pro další práci — [`seo/SEO-analyza-a-manual-Coursition.md`](seo/SEO-analyza-a-manual-Coursition.md) a [PDF](seo/SEO-analyza-a-manual-Coursition.pdf).
- [x] Určit cílové dotazy, technické problémy, obsahové priority a měřitelné KPI.
- [x] Ověřit finální XLSX (přepočet v LibreOffice: 0 chybových buněk), Markdown/PDF, surová data a reprodukovatelnost přes [`seo/README.md`](seo/README.md).
- [x] Sjednotit datum vypracování SEO analýzy a sešitu v MD/PDF/XLSX na potvrzené datum 27. 7. 2026; samostatné datum aktualizace dat a technického ověření 4. 8. 2026 zůstává zachováno.
- [x] Odstranit z finální SEO zprávy grantové rámování; výstupy jsou prezentovány výhradně jako interní materiály Coursition bez co-brandingu poskytovatele podpory.
- [x] Vizuálně sjednotit SEO PDF s rodinou dokumentů Coursition: oficiální logo, Geist/Inter a společná paleta; zachovat odlišný dodavatelský rukopis přes modrou nosnou barvu, svislou obálku, datové karty a vlastní tabulkový styl.
- [x] Doplnit verdikt nad shluky dotazů — anglický shluk rozdělen, `en-ai-source-to-course` je jediný primární cíl; česká větev musí používat slovo „e-learning“, protože „kurz“ je zároveň kurzovní lístek. Viz `seo/data/strategy/cluster-verdicts.jsonl` a kapitola 5.9.

Rozsah oproti vzoru Martiny Libřické (ten měl 10 listů, 142 klíčových slov, 119 srovnávacích
řádků, 193 URL konkurence):

| Ukazatel            | Vzor                     | Coursition                                          |
| ------------------- | ------------------------ | --------------------------------------------------- |
| Listů v sešitě      | 10                       | 13                                                  |
| Klíčových slov      | 142                      | 7 008                                               |
| Srovnání konkurence | 119                      | 1 479                                               |
| URL konkurence      | 193                      | 3 998 v sešitě z 19 264 sebraných                   |
| Zdroj hledanosti    | Dragon Metrics (placený) | bezplatné zdroje, přesná hledanost vědomě neuváděna |

Technický crawl `coursition.com` potvrzuje serverově vykreslené lokalizované stránky se
správnými metadaty, kanonickými adresami a jazykovým párováním. Hlavním SEO omezením je
malá veřejná obsahová vrstva: sitemapa má šest adres, z toho čtyři právní stránky.

### UX/UI Design - 380 000 Kč - doložit produktem

- [x] Logo a současný vizuální systém jsou součástí aplikace a strategického balíčku.
- [x] Finální UX/UI je od 5. 8. 2026 dostupné na `https://coursition.com` a bylo produkčně proklikáno v češtině i angličtině. Povinná publicita CzechInvest / Technologická inkubace se po načtení patičky zobrazuje; zbývá krátké video. Samostatné detailní UX/UI dokazování není priorita.

### Vývoj - 3 049 929 Kč - doložit produktem

- [x] Zajistit dostupnou nasazenou aplikaci, kterou si hodnotitelé sami proklikají. Hotovo 5. 8. 2026: `coursition.com` běží přímo na Cloudflare Workeru `coursition-full-vibe`, verze `15420de0-c4e3-4967-965a-aab1d323eb4c`, se serverovým vykreslením CS/EN.
- [x] Ověřit hlavní průchod. Hotovo 5. 8. 2026 na produkci: registrace → odhlášení/přihlášení → dashboard → poznámkový, souborový a URL zdroj → příprava → AI mapa cílů → plán aktivit → obsah → náhled → správné vyhodnocení aktivity → AI zpětná vazba → návrat k uloženému kurzu. Přidání zdroje správně označilo navazující výstupy jako zastaralé a regenerace je obnovila. Přepnutí CS/EN zachovalo účet, kurz i krok. AI volání fungují, ale jsou pomalá (desítky sekund až přibližně dvě minuty).
- [x] Po ověření odstranit pouze syntetická produkční data. Testovací kurz a účet odstraněny; D1 se vrátila na 0 uživatelů, 0 sessions a původních 10 draftů. R2 se vrátilo na původních 8 objektů / 1 513 764 B; pro testovací draft nezůstal žádný objekt ani cleanup řádek.
- [ ] Natočit krátké video stejného průchodu jako záložní a prezentační důkaz.
- [x] Uvádět jen schopnosti skutečně viditelné v nasazené aplikaci; technický audit, commitová evidence a detailní UX/UI dokumentace nejsou priorita.

### Právní poradenství - 170 000 Kč - hotovo

- [x] Aktivita označena jako dokončená.
- [x] Petr 5. 8. 2026 potvrdil, že předchozí zpráva, GDPR i právní výstupy jsou hotové a doložené; nic znovu nedohledávat, nepropojovat ani nevytvářet.

### Tvorba metodik - 70 000 Kč - hotovo 4. 8. 2026

Výstupy jsou v [`methodologies/`](methodologies/). Dokumenty se přegenerují příkazem `node build-methodologies.mjs` po úpravě `.md`.

- [x] Připravit a uložit [workflow handoff](workflows/methodologies/HANDOFF.md) pro jeden `ultracode` Workflow se společnou evidenční základnou a třímodelovým review gate.
- [x] Spustit přesně jeden workflow a zaznamenat jeho run/task ID; nespouštět duplikát. Run ID `wf_789bb358-9b2`.
- [x] Dokončit metodiku pro uživatele. [`Metodika-pro-uzivatele-Coursition.md`](methodologies/Metodika-pro-uzivatele-Coursition.md) + DOCX/PDF, 26 stran.
- [x] Vytvořit metodiku pro IT: architektura, nasazení, konfigurace, záloha, obnova, bezpečnost a řešení incidentů. [`Metodika-pro-IT-Coursition.md`](methodologies/Metodika-pro-IT-Coursition.md) + DOCX/PDF, 40 stran.
- [x] Sjednotit obě metodiky s reálným stavem aplikace a demonstračním scénářem. Ověřeno živým průchodem lokálně sestavené aplikace, kódem a testy; rozpory zaznamenány v [`_evidence-review-record.md`](methodologies/_evidence-review-record.md).
- [x] Vytvořit [`A8-podklady-pro-Janu.md`](methodologies/A8-podklady-pro-Janu.md), finální DOCX/PDF a doložit Fable 5 + GPT-5.6 Sol + Opus 5 review. Brána prošla bez otevřených blokujících nálezů; doložení v evidenčním záznamu.
- [x] Opravit datum vypracování obou metodik v MD/DOCX/PDF na potvrzené datum 27. 7. 2026; samostatné datum ověření aplikace a testů 4. 8. 2026 zůstává zachováno.
- [x] Vyčistit branding obou metodik ve zdrojích i MD/DOCX/PDF: wordmark je jediným označením firmy na obálce, názvy a patičky neopakují Coursition a není použit co-branding poskytovatele podpory.
- [x] Přegenerovat všech deset obrázků v [`figures/`](methodologies/figures/) po rebrandu aplikace do fialové na krémovém podkladu (WCAG 2.1 AAA) a znovu sestavit DOCX/PDF. Hotovo 5. 8. 2026; snímky 10-14 vznikly reálným průchodem kurzu "Bezpečnost práce ve výrobě" proti Cloudflare worker preview.

### Branding + Marketing + Copywriting - 349 900 Kč - strategický balíček schválen Petrem 5. 8. 2026

- [x] Připravit samostatný solo-agent [handoff](workflows/branding-marketing-copywriting/HANDOFF.md) pro dokončení strategického balíčku bez zásahu do paralelní práce na landing page a aplikaci.
- [x] Oddělit interní strategické dokumenty Coursition od CzechInvest administrativy: finální zdroje a exporty jsou v `../branding-marketing-copywriting/`, nikoli pod `docs/czechinvest/`.
- [x] Dokončit brand a grafický manuál: `../branding-marketing-copywriting/Brand-a-graficky-manual-Coursition.{md,docx,pdf}`.
- [x] Vytvořit komunikační strategii, manuál a komunikační matici: `../branding-marketing-copywriting/Komunikacni-strategie-a-manual-Coursition.{md,docx,pdf}`.
- [x] Vytvořit marketingovou strategii pro validační fázi: `../branding-marketing-copywriting/Marketingova-strategie-Coursition.{md,docx,pdf}`.
- [x] Zmapovat současnou landing copy a vizuály: `../branding-marketing-copywriting/Web-copy-a-vizualni-mapa-Coursition.{md,docx,pdf}`. Produkční deploy zůstává neověřen.
- [x] Pokrýt Discovery a vnitřní analýzu současnou evidenční rekonstrukcí: `../branding-marketing-copywriting/Discovery-a-vnitrni-analyza-Coursition.{md,docx,pdf}`.
- [x] Petr 5. 8. 2026 obsahově schválil všech pět strategických dokumentů.
- [x] Doplnit kanonické logo Coursition na obálky všech pěti dokumentů a opravit světlou variantu assetu.
- [x] Odstranit z interních dokumentů CzechInvest/Jana/A1–A8 terminologii, rozpočtové kódy, byrokratické členění a cesty `docs/czechinvest`.
- [x] Odstranit nepotřebný dokument `A2-podklady-pro-Janu` ze zdrojů, exportů i buildu.
- [x] Ověřit nový build: 5 PDF A4, 5 validních DOCX, čistý scan zakázaných referencí a vizuálně přítomné logo na obálkách.
- [ ] Administrativní akceptace, historické dodavatelské autorství a produkční dostupnost nejsou tímto balíčkem potvrzeny.

## 5. Prezentační a demonstrační balíček

- [ ] Krátká prezentace pro CzechInvest: problém, řešení, postup inkubace, konkrétní výsledky, finance/tým, další kroky. Produktová část je obnovena v `coursition-prezentace.pdf`; širší závěrečná prezentace stále nemá finance/tým/postup inkubace.
- [x] Obnovit produktovou prezentaci současnými rebrandovanými screenshoty a fakticky přesným popisem workflow. Hotovo 5. 8. 2026: 7 slidů, úplné viewporty, viditelné zdrojové patičky, interní náhled bez tvrzení o publikaci/LMS.
- [x] Ověřit screenshoty současné landing page. Zdroj používá 32 runtime stillů v `public/landing/` pro CS/EN, desktop/telefon a light/dark; lokální preview i přímý produkční Cloudflare Worker deploy 5. 8. 2026 byly ověřeny.
- [ ] Jednotný demonstrační scénář aplikace.
- [x] Produkční aplikace je od 5. 8. 2026 dostupná hodnotitelům na `https://coursition.com` s Worker SSR a přihlášený CS/EN průchod byl ověřen od registrace přes všechny tři typy zdrojů, AI generování, obsah a interní náhled až po odhlášení, nové přihlášení a obnovení uloženého kurzu.
- [ ] Krátké video hlavního průchodu aplikací.
- [ ] Finální zpráva pro Janu: co je hotové, co musí doplnit, odkazy na všechny soubory.
- [x] Každé produktové tvrzení v obnovené sedmislidové prezentaci propojit s konkrétním lokálním screenshotem nebo explicitním omezením. Širší závěrečná prezentace zůstává samostatný úkol.

## 6. Mapa screenshotů

| Screenshot                                                              | Zachycený obsah                                                                |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| [01](source-screenshots/01-final-report-summary-comments.png)           | Finance, tým, dopad inkubace a budoucí plány; Petr má doplnit chybějící fakta. |
| [02](source-screenshots/02-finance-team-comments.png)                   | Vlastní zdroje/přesuny financí a změny týmu.                                   |
| [03](source-screenshots/03-report-sections-6-14.png)                    | Otázky 7-14 jsou označené `Text - Petr`.                                       |
| [04](source-screenshots/04-activity-progress-comment.png)               | Přenést předchozí zprávy a doplnit poslední období.                            |
| [05](source-screenshots/05-cost-overview-comment.png)                   | Doplnit poslední tabulku nákladů.                                              |
| [06](source-screenshots/06-mentoring-hours-comment.png)                 | Ověřit mentoringové hodiny a míru detailu.                                     |
| [07](source-screenshots/07-workshops-communication-risks-comments.png)  | Workshopy, inkubační manažer, komunikace a rizika čekají na podklady.          |
| [08](source-screenshots/08-other-news-attachments-comments.png)         | Ostatní novinky a přílohy čekají na Petra.                                     |
| [09](source-screenshots/09-incubation-activity-budget-overview.png)     | Přehled osmi aktivit a celkových 4,5 mil. Kč.                                  |
| [10](source-screenshots/10-market-research-activity.png)                | Detail průzkumu trhu.                                                          |
| [11](source-screenshots/11-trademark-activity.png)                      | Detail ochranné známky a IP scanu.                                             |
| [12](source-screenshots/12-seo-activity.png)                            | Detail SEO analýzy a SEO manuálu.                                              |
| [13](source-screenshots/13-ux-ui-activity.png)                          | UX/UI manual, logo a UX analýzy.                                               |
| [14](source-screenshots/14-development-activity.png)                    | Prototyp, editor, AI funkce, rozšířené výstupy a testy.                        |
| [15](source-screenshots/15-legal-activity.png)                          | GDPR, smlouvy, dohody a podmínky.                                              |
| [16](source-screenshots/16-methodology-activity.png)                    | Metodika pro uživatele a metodika pro IT.                                      |
| [17](source-screenshots/17-branding-marketing-copywriting-activity.png) | Brand, komunikace, marketing a webové texty/vizuály.                           |

## 7. Pořadí práce

1. ~~Nechat doběhnout existující SEO workflow a ověřit finální A4 balíček.~~ Hotovo 4. 8. 2026, výstupy v `seo/`.
2. ~~Spustit a dokončit samostatný workflow pro A8 metodiky.~~ Hotovo 4. 8. 2026, výstupy v `methodologies/`.
3. ~~Zajistit a produkčně ověřit nasazenou aplikaci pro samostatné proklikání hodnotiteli.~~ Nasazeno a celý přihlášený CS/EN demonstrační průchod ověřen 5. 8. 2026 na přímém Cloudflare Workeru.
4. Natočit krátké video hlavního produktového průchodu a připravit demonstrační scénář.
5. ~~Dokončit A2 branding/marketing/copy výstupy a propojit je s landing page.~~ Strategický dokumentový balíček schválen 5. 8. 2026; landing source nebyl měněn a produkční deploy zůstává samostatný.
6. Sestavit finální text a seznam příloh pro Janu; fotografie doplnit až po předání Petrem.
