# Produktová prezentace Coursition

Slidev deck: obsah je v Markdownu, vzhled v lokálním tématu a PDF vzniká reprodukovatelným exportem. Aktualizace 5. 8. 2026 nahrazuje staré zelené snímky současným fialovým rozhraním a opravuje produktová tvrzení.

## Spuštění

```bash
pnpm install --ignore-workspace # jednorázově
node_modules/.bin/playwright install chromium # jednorázově
pnpm dev                         # http://localhost:3131
pnpm export                      # ../coursition-prezentace.pdf
pnpm build                       # statický web do dist/
```

## Struktura

| Cesta | Obsah |
| --- | --- |
| `slides.md` | 7 slidů v češtině a poznámky s proveniencí |
| `theme/` | lokální Slidev téma |
| `theme/styles/layout.css` | typografie, layout a CSS rámování screenshotů bez ořezu |
| `theme/CsFooter.vue` | viditelná patička z pole `source` |
| `public/shots/` | kopie úplných viewportů použitých deckem |
| `public/icons/` | doprovodné ikony |
| `public/logo*.svg` | logo pro téma |

## Mapování screenshotů

| Slide | Obraz | Autoritativní zdroj |
| ---: | --- | --- |
| 1 | cíle + mobilní interní náhled | `../methodologies/figures/10-objectives-cs-desktop-reused.png`, `14-preview-cs-mobile-reused.png` |
| 2 | nástěnka | `../application-screenshots/16-dashboard-cs-desktop-rebrand.png` |
| 3 | zdroje | `../application-screenshots/17-sources-cs-desktop-rebrand.png` |
| 4 | mapa cílů | `../methodologies/figures/10-objectives-cs-desktop-reused.png` |
| 5 | plán aktivit | `../methodologies/figures/11-activities-cs-desktop-reused.png` |
| 6 | interní náhled desktop + telefon | `../methodologies/figures/13-preview-cs-desktop-reused.png`, `14-preview-cs-mobile-reused.png` |
| 7 | závěr | bez screenshotu |

Všechny zdrojové obrazy zachovávají celý viewport: desktop 1440 × 900, telefon 390 × 844. Deck nepoužívá `object-fit: cover`, maskování ani destruktivní ořez; rámeček a zaoblení přidává CSS.

## Provenience a omezení

- Nástěnka a Zdroje byly zachyceny 5. 8. 2026 z lokálního Cloudflare Worker preview nad syntetickým účtem a kurzem. Nebyla změněna produkce ani externí systém.
- Cíle, aktivity a náhled pocházejí z rebrandované metodické sady, zachycené 5. 8. 2026 nad kurzem `Bezpečnost práce ve výrobě`.
- Snímky dokládají lokálně reprodukovaný stav aplikace, ne shodu veřejného produkčního deploymentu.
- Náhled je interní kontrolní obrazovka autora. Není důkazem LMS, veřejného publikování ani doručení účastníkům.
- Štítky opory ve zdroji jsou deklarované klasifikace systému; správnost ověřuje autor.
- Příprava, cíle a zadání aktivit jsou přímo upravitelné. Text obsahu se opravuje přes vstupy a regeneraci.

## Landing page

Současná landing page používá 32 specializovaných runtime stillů v `../../../public/landing/`: CS/EN × desktop/telefon × light/dark × mapa/cíle/aktivity/obsah. Komponenta je vybírá podle jazyka, viewportu a režimu. Lokální Cloudflare preview 5. 8. 2026 načetlo české desktopové assety HTTP 200. Produkční deploy parity nebyla tímto ověřena a zdroj landing page nebyl při refreshi decku změněn.
