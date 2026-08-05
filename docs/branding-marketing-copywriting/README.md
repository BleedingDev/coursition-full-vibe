# Branding + Marketing + Copywriting — strategický balíček

**Produkt:** Coursition  
**Datum přípravy dokumentů:** 27. 7. 2026  

Balíček spojuje brand, komunikaci, marketing, discovery a webovou copy do jednoho současného strategického systému. Markdown je autoritativní zdroj; PDF slouží k předání, DOCX k redakční práci. Dokumenty jsou interní materiály Coursition. Materiály nejsou pojmenované ani strukturované podle externího příjemce.

## Obsah

| Soubor | Úloha |
| --- | --- |
| `Brand-a-graficky-manual-Coursition.md` / `.docx` / `.pdf` | značkový a grafický systém, logo, barvy, typografie, obrazový styl, digitální návaznost |
| `Komunikacni-strategie-a-manual-Coursition.md` / `.docx` / `.pdf` | positioning, tone of voice, komunikační matice, tvrzení, kanály a redakční kontrola |
| `Marketingova-strategie-Coursition.md` / `.docx` / `.pdf` | validační větve, nabídka, funnel, měření, 90denní brány a odpovědnosti |
| `Discovery-a-vnitrni-analyza-Coursition.md` / `.docx` / `.pdf` | současná evidenční rekonstrukce Discovery a vnitřní analýzy; ne historický zápis session |
| `Web-copy-a-vizualni-mapa-Coursition.md` / `.docx` / `.pdf` | inventář současné source copy, faktická omezení, vizuální/funnel mapa a doporučené vrstvy |
| `brand/` | lokální build assety a manifest původu |
| `build-branding-marketing-copywriting.mjs` | reprodukovatelný Markdown → PDF/DOCX build |

## Autorita podkladů

Při rozporu platí pořadí:

1. současné reprodukovatelné chování aplikace a metodiky;
2. současný zdroj a lokalizace;
3. SEO evidence a její surová data;
4. potvrzené vstupy od Petra;
5. původní Design Manual a současné grafické assety;
6. archivní screenshoty a starší prezentace.

Produkční dostupnost `coursition.com` není tímto dokumentovým balíčkem potvrzena. Současný repozitář a lokální evidence nejsou důkazem úspěšného deploye.

## Hlavní pravdivostní hranice

- 0 prodejů, 0 Kč produktových tržeb, žádná uzavřená spolupráce, neúspěšný první pilot, žádní stálí zaměstnanci.
- Původní zápis Discovery Session, účastníci, citace a schválení nebyly v dostupných podkladech nalezeny.
- Přípravu, cíle a zadání aktivit lze upravovat přímo; text obsahu se opravuje změnou vstupů a novým vygenerováním.
- Náhled je interní; balíček neslibuje LMS delivery, publikování, learner management, SCORM/xAPI/LTI ani neověřené integrace.
- Zpracování některých formátů, zejména audia/videa, závisí na konfiguraci poskytovatelů.
- Přesná search volume, konverze, ROI, úspory času, zákazníci a reference nejsou k dispozici.
- Doporučené prahy, segmenty, kampaně a nové webové stránky jsou doporučení nebo hypotézy, ne historické výsledky.

## Aktualizace

1. Ověřit produktové tvrzení proti aktuální metodice, zdroji a lokalizaci.
2. Upravit Markdown a zdrojové registry; neměnit aplikaci ani deployment jako vedlejší efekt dokumentové práce.
3. Při změně vizuálu obnovit jen nutné screenshoty a zapsat datum, revizi, route, locale, theme a viewport.
4. Spustit build:

```bash
COURSITION_DOCS_SCRATCH=/cesta/k/docasne/slozce node build-branding-marketing-copywriting.mjs
```

5. Zkontrolovat všechny PDF/DOCX: českou diakritiku, tabulky, obrázky, odkazy, záhlaví, zápatí a ořezy.

## Klíčové zdroje

- archivní schválený podklad k rozsahu práce
- původní Design Manual Coursition
- potvrzené interní vstupy vedení Coursition
- uživatelská metodika Coursition
- IT metodika Coursition
- SEO analýza a manuál Coursition
- `../../locales/cs/translation.json`, `../../locales/en/translation.json`
- `../../src/features/coursition/coursition-landing-page.tsx`
- `../../src/routes/coursition-theme.css`, `../../src/routes/coursition-landing.css`
- `../../public/brand/`, `../../public/landing/`
