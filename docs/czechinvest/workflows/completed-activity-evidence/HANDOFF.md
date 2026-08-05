# Handoff: dohledání a propojení důkazů hotových aktivit A1, A3 a A7

## Režim práce

Tento handoff je určen pro novou samostatnou Claude Code session a jednoho solo agenta. Nespouštěj native Workflow ani další subagenty, pokud uživatel výslovně nezmění zadání.

## Mise

Dohledat, ověřit, lokálně uložit nebo bezpečně odkázat existující důkazy tří aktivit, které jsou vedené jako hotové:

- **A1 Průzkum trhu — 250 000 Kč**
- **A3 Ochranná známka — 50 171 Kč**
- **A7 Právní poradenství — 170 000 Kč**

Nevytvářej tyto aktivity znovu. Uživatel 5. 8. 2026 výslovně uvedl, že **tržní analýza a právní spolupráce již byly doloženy v minulé zprávě**. Nejprve proto najdi předchozí/průběžnou zprávu a její přílohy, ověř přesný rozsah již doloženého plnění a pouze uzavři evidenční odkazy pro závěrečnou zprávu. Ochrannou známku a IP scan ověř stejným způsobem; jejich předchozí doložení uživatel v tomto checkpointu výslovně nepotvrdil.

## Přesný rozsah aktivit

### A1 Průzkum trhu

Zdroj: `docs/czechinvest/source-screenshots/10-market-research-activity.png`.

Podaktivity:

- vydefinování dotazníku;
- kvantitativní průzkum;
- vyhodnocení údajů;
- kvalitativní průzkum;
- úprava strategie a priorit vývoje podle zjištěných potřeb trhu.

Plánovaný výstup: detailní analýza trhu poskytující informace pro úpravu priorit a roadmapy, odhalení potřeb trhu a změny pohledu na cílové segmenty.

### A3 Ochranná známka

Zdroj: `docs/czechinvest/source-screenshots/11-trademark-activity.png`.

Podaktivity:

- definice třídy;
- výběr zemí;
- získání ochranné známky;
- dokumentace k produktu v anglickém jazyce.

Plánované výstupy: **ochranná známka EU a IP scan**.

### A7 Právní poradenství

Zdroj: `docs/czechinvest/source-screenshots/15-legal-activity.png`.

Podaktivity:

- zákaznické smlouvy;
- kontraktorské smlouvy;
- GDPR;
- podmínky používání.

Plánované výstupy:

- GDPR metodika;
- smlouvy;
- dohody;
- podmínky využívání produktu;
- smluvní ujednání.

## Autoritativní zdroje

Začni:

1. `AGENTS.md`
2. `docs/czechinvest/README.md`
3. `docs/czechinvest/CURRENT-STATUS.md`
4. `docs/czechinvest/WORKING-CHECKLIST.md`
5. `docs/czechinvest/INPUTS-FROM-PETR.md`
6. `docs/czechinvest/source-files/final-report-draft-with-comments-2026-08-03.docx`
7. předchozí/průběžné zprávy a jejich přílohy v dostupných lokálních souborech, read-only Google Drive a read-only Gmailu;
8. tři screenshoty přesného rozsahu uvedené výše.

Lokální repozitář je preferované místo trvalého evidenčního indexu. Google Drive, Gmail a Notion používej pouze read-only. Nic neposílej, neupravuj ani nemaž.

## Povinný postup

1. Identifikuj přesný dokument označený jako minulá/předchozí/průběžná zpráva.
2. U každé A1/A3/A7 najdi:
   - text ve zprávě;
   - uvedenou přílohu;
   - skutečný soubor nebo stabilní read-only odkaz;
   - datum/verzi;
   - vazbu na plánovanou podaktivitu a výstup.
3. Rozlišuj:
   - `doloženo v předchozí zprávě a soubor ověřen`;
   - `doloženo v předchozí zprávě, ale příloha zatím nenalezena`;
   - `existující soubor nalezen, ale vazba ve zprávě neověřena`;
   - `nedoloženo / vyžaduje vstup uživatele`.
4. Neklasifikuj položku jako chybějící pouze proto, že zatím není zkopírovaná v tomto repozitáři.
5. Nevytvářej náhradní tržní analýzu, právní dokumenty, IP scan ani tvrzení o registraci známky.
6. Pokud narazíš na citlivé právní nebo osobní údaje, do repozitáře ukládej pouze minimální evidenční metadata a bezpečný odkaz, ne celý citlivý dokument bez nutnosti.

## Povinné výstupy

Vytvoř adresář `docs/czechinvest/completed-activity-evidence/` a nejméně:

1. `A1-A3-A7-evidence-index.md`
   - jedna řádka pro každou plánovanou podaktivitu/výstup;
   - stav, zdroj, cesta/odkaz, datum/verze, poznámka k ověření;
   - žádné domnělé `hotovo`.

2. `A1-pruzkum-trhu.md`
   - přesný souhrn toho, co bylo doloženo v minulé zprávě;
   - odkazy na analýzu a přílohy;
   - jedna stručná věta o doloženém dopadu na priority, segmenty nebo roadmapu, pouze pokud ji lze podložit.

3. `A3-ochranna-znamka.md`
   - identifikace EU ochranné známky, stav a třídy pouze podle ověřeného záznamu;
   - odkaz na IP scan;
   - chybějící položky bez domýšlení.

4. `A7-pravni-poradenstvi.md`
   - mapování předchozí zprávy a příloh na GDPR, zákaznické/kontraktorské smlouvy, podmínky a další ujednání;
   - nevydávat právní stanovisko ani neupravovat právní obsah.

5. `A1-A3-A7-podklady-pro-Janu.md`
   - co lze v závěrečné zprávě stručně převzít jako již doložené;
   - které přílohy pouze znovu odkázat;
   - které konkrétní důkazy skutečně chybí;
   - jasné oddělení potvrzení uživatele od nezávisle ověřených souborů.

6. `README.md`
   - zdroje, pravidla citlivosti, datum kontroly, způsob aktualizace.

## Zakázané odbočky

- Neotvírej znovu procurement, dodavatelský výběr, limity smluv, AIS ani již vyřešený jediný závazný výstup.
- Neobjednávej nové právní, IP ani výzkumné služby.
- Nekontaktuj dodavatele, CzechInvest ani Janu.
- Nevytvářej nové historické datum, autorství, předávací protokol nebo podpis.
- Neprováděj commit, push, upload, e-mail ani změny Drive/Notion.
- Nezaměňuj současnou SEO analýzu za dřívější tržní průzkum A1.

## Definice hotovo

Handoff je splněn pouze když:

- byla nalezena a identifikována předchozí zpráva, nebo je přesně popsáno, kde a proč dohledání skončilo;
- A1, A3 a A7 mají úplnou mapu plánovaný výstup → předchozí report → příloha/důkaz → ověřený stav;
- A1 a A7 nejsou zbytečně vytvářeny znovu;
- u A3 je jednoznačně odlišeno, co je skutečně doložené a co zatím pouze označené jako hotové;
- Jana dostane krátký použitelný podklad bez citlivých nebo nepodložených tvrzení;
- `docs/czechinvest/CURRENT-STATUS.md` a `docs/czechinvest/WORKING-CHECKLIST.md` jsou aktualizované podle skutečně ověřeného výsledku.

## Finální odpověď

Uveď pouze:

- identifikovanou předchozí zprávu;
- stav A1, A3 a A7;
- vytvořené/změněné soubory;
- přesně které důkazy nebyly nalezeny;
- zda byl respektován read-only režim externích zdrojů.
