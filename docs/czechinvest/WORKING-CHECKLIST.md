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

- [ ] Přenést relevantní informace z předchozích zpráv a přidat poslední období.
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
- [ ] Najít a uložit finální tržní analýzu.
- [ ] Připravit jednu stručnou větu: jak analýza změnila priority, cílové segmenty nebo roadmapu.

### Ochranná známka - 50 171 Kč - hotovo

- [x] Aktivita označena jako dokončená.
- [ ] Doložit ochrannou známku EU.
- [ ] Doložit IP scan.

### SEO - 180 000 Kč - workflow probíhá

- [x] Připravit a uložit [detailní workflow handoff](workflows/seo-research/HANDOFF.md) a kompletní desetilistý benchmark Martiny Libřické.
- [x] Zahájit SEO workflow; k checkpointu 4. 8. 2026 probíhal technický sběr dat v `seo/data/`.
- [ ] Ověřit, že existující SEO workflow doběhlo; nespouštět duplicitní běh.
- [ ] Vytvořit SEO analýzu podle uloženého vzoru.
- [ ] Vytvořit stručný SEO manuál pro další práci.
- [ ] Určit cílové dotazy, technické problémy, obsahové priority a měřitelné KPI.
- [ ] Ověřit finální XLSX, Markdown/PDF, surová data, reprodukovatelnost a třímodelový review gate.

### UX/UI Design - 380 000 Kč - částečně hotovo

- [ ] Dokončit UX/UI Design Manual; současné PDF obsahuje nedokončený text copywritera.
- [x] Logo produktu je v Design Manualu.
- [ ] Doložit UX analýzy a uživatelské testování.
- [ ] Propojit výstupy se screenshoty finální aplikace.

### Vývoj - 3 049 929 Kč - částečně hotovo

- [ ] Doložit funkční prototyp editoru.
- [ ] Doložit editor kurzů.
- [ ] Doložit průvodce personalizací uživatele pro AI nástroje.
- [ ] Doložit AI mentora kvality, který při tvorbě kurzu vrací zpětnou vazbu.
- [ ] Doložit rozšířené výstupy: PDF, prezentace, video a audio, pokud jsou skutečně implementované.
- [ ] Připravit výsledky testů a stručný akceptační protokol.
- [ ] Pro každý bod uvést konkrétní obrazovku, URL, soubor, test nebo commit; ne pouze obecný popis.
- [ ] Prověřit i ostatní pokusy v `/Users/satan/work/coursition-all`, aby se neztratil relevantní výstup.

Existující technické podklady: [akceptační audit](../czechinvest-acceptance-audit-2026-07-14.md), [evidence matrix](../czechinvest-output-evidence-matrix.md) a [uživatelský manuál](../czechinvest-user-manual-cs.md).

### Právní poradenství - 170 000 Kč - hotovo

- [x] Aktivita označena jako dokončená.
- [ ] Doložit GDPR metodiku.
- [ ] Doložit smlouvy, dohody, podmínky užívání a další smluvní ujednání.

### Tvorba metodik - 70 000 Kč - chybí finální balíček

- [x] Připravit a uložit [workflow handoff](workflows/methodologies/HANDOFF.md) pro jeden `ultracode` Workflow se společnou evidenční základnou a třímodelovým review gate.
- [ ] Spustit přesně jeden workflow a zaznamenat jeho run/task ID; nespouštět duplikát.
- [ ] Dokončit metodiku pro uživatele. Existující uživatelský manuál použít jako základ, nikoli automaticky jako finální výstup.
- [ ] Vytvořit metodiku pro IT: architektura, nasazení, konfigurace, záloha, obnova, bezpečnost a řešení incidentů.
- [ ] Sjednotit obě metodiky s reálným stavem aplikace a demonstračním scénářem.
- [ ] Vytvořit `A8-podklady-pro-Janu.md`, finální DOCX/PDF a doložit Fable 5 + GPT-5.6 Sol + Opus 5 review.

### Branding + Marketing + Copywriting - 349 900 Kč - částečně hotovo

- [ ] Dokončit brand a grafický manuál.
- [ ] Vytvořit komunikační strategii a stručný komunikační manuál.
- [ ] Vytvořit marketingovou strategii.
- [ ] Vytvořit novou landing page včetně textů a vizuálů.
- [ ] Doložit Discovery Session, vizuální podobu, interní analýzu a grafické podklady.

## 5. Prezentační a demonstrační balíček

- [ ] Krátká prezentace pro CzechInvest: problém, řešení, postup inkubace, konkrétní výsledky, finance/tým, další kroky.
- [ ] Jednotný demonstrační scénář aplikace.
- [ ] Screenshoty: přihlášení, dashboard, zdroje, příprava kurzu, cíle, aktivity, editor, studentský náhled, mobilní zobrazení a obnovení uloženého kurzu.
- [ ] Krátké video nebo živé demo podle finální dohody s Janou.
- [ ] Finální zpráva pro Janu: co je hotové, co musí doplnit, odkazy na všechny soubory.
- [ ] Každé tvrzení v prezentaci propojit s jedním konkrétním důkazem.

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

1. Nechat doběhnout existující SEO workflow a ověřit finální A4 balíček; nespouštět další SEO run.
2. Spustit a dokončit samostatný workflow pro A8 metodiky.
3. Dokončit minimální věrohodný A5 UX/UI/design-manual výstup.
4. Uzavřít A6 důkazy vývoje pomocí současné aplikace, testů, screenshotů a dema.
5. Dokončit A2 branding/marketing/copy výstupy a propojit je s landing page.
6. Lokálně propojit již hotové výstupy A1, A3 a A7.
7. Sestavit finální text a seznam příloh pro Janu; fotografie doplnit až po předání Petrem.
