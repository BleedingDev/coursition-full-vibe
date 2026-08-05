# Screenshoty aplikace — evidence a provenience

Kurátorovaná sada lokálně reprodukovaných stavů aplikace. Snímky nejsou důkazem shody veřejného produkčního deploymentu. Při rozporu má přednost reprodukovatelné runtime chování, potom současný kód a až potom screenshot.

## Původní sada — 3. 8. 2026, archivní vzhled

Soubory `01`–`09` vznikly z tehdejšího lokálního buildu. Po rebrandu z 5. 8. 2026 mají historický vizuální vzhled a nesmí být označovány jako současné produktové snímky.

| Soubor | Obsah | Viewport |
| --- | --- | ---: |
| `01-landing-desktop.png` | archivní veřejná landing page | 1440 × 900 |
| `02-dashboard-desktop.png` | archivní nástěnka | 1440 × 900 |
| `03-sources-desktop.png` | archivní krok Zdroje | 1440 × 900 |
| `04-objectives-desktop.png` | archivní mapa cílů | 1440 × 900 |
| `05-activities-desktop.png` | archivní plán aktivit | 1440 × 900 |
| `06-content-desktop.png` | archivní obsah kurzu | 1440 × 900 |
| `07-preview-desktop.png` | archivní interní náhled | 1440 × 900 |
| `08-landing-mobile.png` | archivní mobilní landing | 390 × 844 |
| `09-preview-mobile.png` | archivní mobilní interní náhled | 390 × 844 |

## Landing redesign — archivní page captures

Soubory `10`–`15` zachycují průběžné varianty landing page. Nejsou důkazem současné copy ani přesného současného výběru produktových stillů.

| Soubor | Viewport |
| --- | ---: |
| `10-landing-redesign-desktop.png` | 1440 × 900 |
| `11-landing-redesign-full-desktop.png` | 1440 × 3068 |
| `12-landing-redesign-dark-desktop.png` | 1440 × 900 |
| `13-landing-redesign-mobile.png` | 390 × 844 |
| `14-landing-redesign-full-mobile.png` | 390 × 5030 |
| `15-landing-redesign-en-desktop.png` | 1440 × 900 |

## Rebrandované produktové snímky — 5. 8. 2026

| Soubor | Co dokládá | Viewport | Provenience |
| --- | --- | ---: | --- |
| `16-dashboard-cs-desktop-rebrand.png` | současná fialová/krémová nástěnka a karta rozpracovaného kurzu | 1440 × 900 | lokální Cloudflare Worker preview; syntetický účet a kurz; celý viewport; nulový vodorovný overflow |
| `17-sources-cs-desktop-rebrand.png` | současný krok Zdroje, poznámky/URL/soubor a stav zpracování | 1440 × 900 | stejný lokální preview průchod; celý viewport; nulový vodorovný overflow |

Snímky `16` a `17` vznikly pouze v lokální Wrangler/D1 emulaci. Nebyla změněna produkce ani externí zdroj dat. Přístupové údaje syntetického účtu se neukládají do repozitáře.

Navazující současné rebrandované obrazovky cílů, aktivit, obsahu a interního náhledu jsou v `../methodologies/figures/10`–`14`. Byly zachyceny 5. 8. 2026 nad kurzem `Bezpečnost práce ve výrobě` a používá je obnovená prezentace `../coursition-prezentace.pdf`.

## Současná landing page

Runtime landing nepoužívá archivní soubory z této složky. Používá 32 assetů:

- `public/landing/{cs,en}/{map,objectives,activities,content}.png`;
- `public/landing/{cs,en}/dark/...`;
- `public/landing/{cs,en}/phone/...`;
- `public/landing/{cs,en}/phone/dark/...`.

Komponenta vybírá variantu podle jazyka, viewportu a světlého/tmavého režimu. Lokální Cloudflare preview na `/cs` dne 5. 8. 2026 načetlo české desktopové assety `map`, `objectives`, `activities` a `content` s HTTP 200. Zdroj landing page proto již používá současný vyhrazený still systém; produkční deploy parity tím ověřena nebyla.
