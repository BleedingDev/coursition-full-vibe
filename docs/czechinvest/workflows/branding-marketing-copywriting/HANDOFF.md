# Handoff: dokončení Branding + Marketing + Copywriting

## Režim práce

Tento handoff je určen pro novou samostatnou Claude Code session a jednoho solo agenta. Nespouštěj native Workflow ani další subagenty, pokud uživatel výslovně nezmění zadání.

## Mise

Dokončit klíčové strategické výstupy aktivity **Branding + Marketing + Copywriting (349 900 Kč)** tak, aby byly:

- použitelné pro další produktové, obchodní, marketingové a obsahové rozhodování Coursition;
- věcně ukotvené v aktuálním produktu, SEO analýze, existujícím designu a reálné landing page;
- dostatečně konkrétní jako samostatný výstup aktivity pro CzechInvest;
- připravené jako stručný předávací podklad pro Janu Drozenovou.

Nejde o administrativní cvičení ani obecné AI texty. Výstupy musí tvořit jeden konzistentní strategický systém.

## Přesný schválený rozsah aktivity

Zdroj rozsahu: `docs/czechinvest/source-screenshots/17-branding-marketing-copywriting-activity.png`.

### Podaktivity

- Discovery Session
- vizuální podoba
- textace webu
- vnitřní analýza firmy
- grafické práce a podklady

### Plánované výstupy

- brand a grafický manuál;
- komunikační strategie a manuál;
- marketingová strategie;
- textace a vizuál webu.

Plánovaný účel: nastavit jednotný vizuální styl firmy a produktu včetně stylu komunikace, na kterém bude postaven marketing a identita značky.

## Důležitý aktuální kontext

- Landing page a vizuální sjednocení aplikace jsou paralelně rozpracované. Nezastavuj tuto práci a neupravuj aplikační zdrojový kód.
- Cílová produkční doména je `coursition.com`; ověř aktuální stav z repozitáře a nasazení, nepředpokládej dokončení.
- SEO balíček je hotový v `docs/czechinvest/seo/` a musí být hlavní evidenční základnou pro segmenty, vyhledávací témata a obsahové priority.
- Uživatelská a IT metodika jsou hotové v `docs/czechinvest/methodologies/`; používej je pouze pro ověřený popis produktu.
- Existující 14stránkový manuál `docs/czechinvest/source-files/design-manual-coursition.pdf` je vstup, ne automaticky finální výstup. Obsahuje nedokončené místo pro text copywritera.
- Copywriting, branding a marketing zachovej jako jasně oddělené pracovní vrstvy a samostatně identifikovatelné výstupy. Nemíchej odpovědnosti ani nepřepisuj práci paralelních agentů.

## Autoritativní zdroje

Čti v tomto pořadí:

1. `AGENTS.md`
2. `docs/czechinvest/README.md`
3. `docs/czechinvest/CURRENT-STATUS.md`
4. `docs/czechinvest/WORKING-CHECKLIST.md`
5. `docs/czechinvest/INPUTS-FROM-PETR.md`
6. přesný rozsah aktivity ve screenshotu uvedeném výše;
7. aktuální landing page, lokalizační texty a produkční podoba produktu;
8. `docs/czechinvest/seo/SEO-analyza-a-manual-Coursition.md` a strategická data v `docs/czechinvest/seo/data/strategy/`;
9. `docs/czechinvest/source-files/design-manual-coursition.pdf`;
10. metodiky, současný CzechInvest deck a další existující grafické podklady.

Při rozporu preferuj aktuální reprodukovatelné chování produktu, aktuální veřejnou landing page, současný zdroj a ověřené výstupy před starými prezentacemi nebo plánovanými tvrzeními.

## Povinné výstupy

Vytvoř adresář `docs/czechinvest/branding-marketing-copywriting/` a nejméně:

1. `Brand-a-graficky-manual-Coursition.md`
   - účel značky, architektura značky a produktu;
   - logo a pravidla použití;
   - barvy, typografie, obrazový styl, UI návaznost;
   - příklady správného a chybného použití;
   - vazba na existující landing page a aplikaci.

2. `Komunikacni-strategie-a-manual-Coursition.md`
   - positioning a hlavní sdělení;
   - cílové skupiny a jejich potřeby;
   - message hierarchy;
   - tone of voice;
   - doporučená a zakázaná tvrzení;
   - kanály, obsahové pilíře a praktické příklady komunikace.

3. `Marketingova-strategie-Coursition.md`
   - prioritní segmenty a use cases;
   - vazba na SEO zjištění;
   - B2B a self-service/B2C hypotézy jasně oddělené;
   - acquisition, activation, pilot a conversion cesta;
   - 90denní priority, odpovědnosti, měřitelné signály a rozhodovací brány;
   - explicitní seznam toho, co nyní nedělat.

4. `Discovery-a-vnitrni-analyza-Coursition.md`
   - současný produkt, tržní situace, silné/slabé stránky a omezení;
   - doložené poznatky versus současné strategické hypotézy;
   - rozhodnutí, která z analýzy plynou.

5. `Web-copy-a-vizualni-mapa-Coursition.md`
   - inventář aktuálních webových sdělení a sekcí;
   - mapování sdělení na cílové skupiny a funnel;
   - odkaz na skutečné texty a vizuály v landing page;
   - neprovádět paralelní přepis aplikace bez výslovného souhlasu uživatele.

6. `A2-podklady-pro-Janu.md`
   - stručný popis realizace aktivity;
   - seznam výstupů a jejich cest;
   - mapování každé podaktivity a plánovaného výstupu na konkrétní důkaz;
   - pravdivé omezení nebo nedokončená místa.

7. `README.md`
   - obsah balíčku, zdroje, datum přípravy, postup aktualizace.

Je-li v repozitáři zaveden reprodukovatelný dokumentový build, vytvoř také finální DOCX/PDF. Nevytvářej ručně neudržitelné binární soubory bez zdroje.

## Pravidla pravdivosti

- Nevymýšlej historickou Discovery Session, účastníky, data, citace, schválení ani dodání dodavatelem.
- Pokud neexistuje záznam původní Discovery Session, označ dokument jako současnou evidenční rekonstrukci z ověřených podkladů.
- Nevymýšlej zákazníky, prodeje, partnerství ani úspěšné piloty. Potvrzený stav: 0 prodejů, 0 Kč, žádná uzavřená spolupráce, neúspěšný první pilot.
- Neuváděj schopnost produktu, kterou nelze ověřit.
- Nevydávej SEO odhady za naměřenou poptávku.
- Nepřepisuj současné produktové nebo landing-page změny jiných agentů.
- Neprováděj commit, push, deploy, upload ani změny Google Drive/Notion.

## Definice hotovo

Handoff je splněn pouze když:

- všechny plánované výstupy aktivity mají konkrétní samostatný dokument nebo jasně odůvodněné mapování;
- strategie vychází z aktuálního produktu, SEO balíčku a existující identity;
- branding, komunikace, marketing a webová realizace si neodporují;
- každé podstatné tvrzení má dohledatelný zdroj nebo je výslovně označeno jako hypotéza/doporučení;
- `A2-podklady-pro-Janu.md` umožní převzít výsledek bez pročítání celého repozitáře;
- jsou aktualizovány `docs/czechinvest/CURRENT-STATUS.md` a `docs/czechinvest/WORKING-CHECKLIST.md` skutečnými cestami, výsledky a omezeními.

## Finální odpověď

Uveď pouze:

- vytvořené/změněné soubory;
- které plánované výstupy aktivity jsou pokryté;
- provedené kontroly;
- otevřené věcné mezery;
- zda byla respektována paralelní práce na landing page a aplikaci.
