# Produktová prezentace Coursition pro CzechInvest

Slidev deck - prezentace je kód, ne binární soubor. Struktura vychází ze sdílené
Slidev sady v repozitáři BleedingDev (téma jako balíček s vlastními layouty,
markdown jako obsah, export přes CLI), vizuální jazyk je Coursition.

## Spuštění

```bash
pnpm install --ignore-workspace   # jednorázově
pnpm dev                          # http://localhost:3131 (presenter mode na /presenter)
pnpm export                       # PDF do ../coursition-czechinvest-ivo-2026-08-03.pdf
pnpm build                        # statický web do dist/
```

Export vyžaduje Chromium: `node_modules/.bin/playwright install chromium`.

## Struktura

| Cesta                     | Obsah                                                          |
| ------------------------- | -------------------------------------------------------------- |
| `slides.md`               | Obsah prezentace v češtině + poznámky pro řečníka              |
| `theme/`                  | Lokální Slidev téma `slidev-theme-coursition`                  |
| `theme/styles/layout.css` | Tokeny, typografie, sdílené prvky (`cs-*`)                     |
| `theme/layouts/`          | `cover`, `default`, `end`                                      |
| `theme/CsFooter.vue`      | Patička se zdrojem tvrzení, vkládá se do každého layoutu       |
| `public/shots/`           | Snímky aplikace ze 3. 8. 2026, zaoblené karty                  |
| `public/icons/`           | Ikony (dokument, editace, štítek, obnovení, telefon, kontrola) |
| `public/logo*.svg`        | Oficiální vektorové logo, světlá varianta pro tmavý slide      |

## Slidy

| #   | Slide                      | Snímek                                     |
| --- | -------------------------- | ------------------------------------------ |
| 1   | Úvodní příslib             | veřejná stránka, desktop + mobil           |
| 2   | Krok 1 - Zdroje            | `03-sources-desktop`                       |
| 3   | Krok 2 - Mapa cílů         | `04-objectives-desktop`                    |
| 4   | Krok 3 - Plán aktivit      | `05-activities-desktop`                    |
| 5   | Krok 4 - Studentský náhled | `07-preview-desktop` + `09-preview-mobile` |
| 6   | Vaše kurzy                 | `02-dashboard-desktop`                     |
| 7   | Závěr a odkaz na záznam    | -                                          |

## Pravidla obsahu

- Prezentace ukazuje **produkt**, ne průběh inkubace. Finance, dopad inkubace,
  testy a stav projektu patří do závěrečné zprávy, ne na slide.
- Jeden slide = jedna obrazovka aplikace + jeden nadpis s přínosem + nejvýš tři
  krátké popisky. Snímek zabírá víc plochy než text.
- Každý slide má ve frontmatteru `source` - v patičce je vidět, z čeho snímek je.
- Poznámky pro řečníka (`<!-- ... -->`) drží cesty ke zdrojovým snímkům
  a scénář dema; na slidu samotném citace nejsou.
- Slovo z rozhraní „hratelný náhled“ se v textu slidů nepoužívá; mluvíme
  o studentském náhledu. Ve snímcích obrazovky zůstává, protože jde o skutečné
  rozhraní.

## Obnovení snímků

Snímky vznikly z lokálního buildu na `http://localhost:8080` v českém rozhraní,
ve světlém režimu, nad kurzem `Onboarding zákazníků` (české zadání i výstup). Zdrojové soubory jsou
v `../application-screenshots/`; zaoblené karty v `public/shots/` se z nich
generují oříznutím rohů a přidáním rámečku.
