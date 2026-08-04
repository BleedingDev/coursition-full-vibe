# A8 — podklady pro závěrečnou zprávu

## Cíl aktivity

Vytvořit manuály pro uživatele a vývojářský tým včetně testerů. Uživatelská metodika má dát autorům kurzů jasnou oporu při práci s produktem. IT metodika má podpořit vývojáře, testery a odborníky na straně zákazníka při provozu, ověřování a úpravách produktu podle jejich potřeb.

## Provedené práce

- Analýza aktuální aplikace, zdrojového kódu, datového modelu, testů, release skriptů a provozního runbooku.
- Ověření reálných uživatelských toků na lokálně sestavené aplikaci: české a anglické rozhraní, registrace a přihlášení, založení kurzu, přidání zdrojů, generování, úpravy přípravy, cílů a aktivit, regenerace obsahu, náhled, uložení, opětovné přihlášení a návrat k rozpracovanému kurzu.
- Sjednocení názvů kroků, polí, stavů a akcí s aktuálním českým uživatelským rozhraním.
- Zpracování samostatné metodiky pro autory kurzů a samostatné metodiky pro vývoj, testování a provoz.
- Doplnění metodik o snímky obrazovky, architektonická schémata, kontrolní seznamy, řešení potíží a výslovné vymezení ověřených funkcí a současných omezení.

## Konkrétní vytvořené výstupy

1. **Uživatelská metodika v editovatelné a předávací podobě** — zdrojový Markdown, DOCX a PDF.  
   `Metodika-pro-uzivatele-Coursition.md`  
   `Metodika-pro-uzivatele-Coursition.docx`  
   `Metodika-pro-uzivatele-Coursition.pdf`
2. **IT metodika v editovatelné a předávací podobě** — zdrojový Markdown, DOCX a PDF. Pokrývá architekturu, datový model, API, autentizaci, zpracování zdrojů, AI vrstvu, konfiguraci, testy, nasazení, zálohu, obnovu, diagnostiku a známá omezení.  
   `Metodika-pro-IT-Coursition.md`  
   `Metodika-pro-IT-Coursition.docx`  
   `Metodika-pro-IT-Coursition.pdf`
3. **Obrazové podklady** — deset doložených snímků v adresáři `figures/`; osm je použito v uživatelské metodice a dva úvodní snímky (anglický desktop a český mobil) slouží jako doplňková příloha.
4. **Interní evidenční záznam** — mapa tvrzení, odkazy na route/kód/figury/testy/provozní podklady, řešení rozporů, výsledky nezávislé kontroly a provenience snímků.

DOCX slouží pro případné redakční úpravy. PDF je připravené jako předávací příloha pod skutečným názvem uvedeným výše.

## Naplnění cíle aktivity

Cíl aktivity byl naplněn dvěma oddělenými metodikami pro rozdílné skupiny příjemců:

- **autor kurzu** získává praktický návod vedený podle skutečného pořadí kroků aplikace, přesných českých názvů ovládacích prvků a povinné kontroly výstupů vytvořených pomocí AI;
- **vývojář, tester nebo provozovatel** získává technický podklad pro orientaci v současné implementaci, bezpečné ověřování změn, nasazení, diagnostiku a plánování dalších úprav bez záměny současných funkcí za dosud neimplementované schopnosti.

Metodiky tak poskytují jasnou oporu jak pro každodenní práci s Coursition, tak pro jeho technickou správu a další rozvoj.

## Poznámka k omezením

Metodiky popisují ověřený stav aplikace k 4. 8. 2026. Uživatelské toky byly ověřeny na lokálně sestavené aplikaci; nešlo o ověření produkčního nasazení. Výstupy vytvořené pomocí AI jsou návrhy, které musí autor věcně a didakticky zkontrolovat. Krok Obsah kurzu je v současné aplikaci určen ke kontrole a regeneraci, nikoli k přímé editaci textu. Provozní postupy zálohy a obnovy jsou popsány jako řízené kroky provozovatele, nikoli jako tvrzení o automatickém průběžném zálohování nebo o odzkoušené automatické obnově.

## Umístění výstupů

- `docs/czechinvest/methodologies/Metodika-pro-uzivatele-Coursition.md`
- `docs/czechinvest/methodologies/Metodika-pro-uzivatele-Coursition.pdf` (příloha k předání)
- `docs/czechinvest/methodologies/Metodika-pro-uzivatele-Coursition.docx`
- `docs/czechinvest/methodologies/Metodika-pro-IT-Coursition.md`
- `docs/czechinvest/methodologies/Metodika-pro-IT-Coursition.pdf` (příloha k předání)
- `docs/czechinvest/methodologies/Metodika-pro-IT-Coursition.docx`
- `docs/czechinvest/methodologies/figures/`
- `docs/czechinvest/methodologies/A8-podklady-pro-Janu.md`
- `docs/czechinvest/methodologies/_evidence-review-record.md`
