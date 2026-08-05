# Web copy a vizuální mapa

**Produkt:** Coursition  
**Verze dokumentu:** 1.0  
**Datum:** 27. 7. 2026  
**Stav:** inventář současné realizace a doporučená mapa

> Dokument popisuje současnou landing page a navrhuje další obsahovou práci. Neupravuje zdrojový kód ani nepřepisuje paralelně rozpracovanou landing page. „Návrh“ znamená doporučení, nikoli existující stránku.

## 1. Autoritativní stav

Současný landing-page zdroj je rozdělen do čtyř obsahových sekcí:

1. Hero
2. „Hotová první verze“ — cíle, aktivity, obsah
3. „Nejdřív to uvidíte vy“ — kontrola a zdrojová opora
4. Závěrečná CTA

Texty jsou v `locales/cs/translation.json`, layout v `src/features/coursition/coursition-landing-page.tsx` a vizuální pravidla v `src/routes/coursition-landing.css`.

Archivní screenshoty redesignu zachycují starší copy. Při rozporu má přednost současný zdroj a nový reprodukovaný screenshot.

**Omezení živého ověření:** při přípravě dokumentu veřejné načtení `https://coursition.com/cs` nevrátilo obsah landing page a zobrazilo pouze titul „TanStack Router“. Proto se za autoritativní považuje současný repozitář a ověřený lokální build; produkční nasazení nelze z tohoto pokusu označit za potvrzené.

## 2. Jednotná narativní osa

**Vstup:** autor má soubor, URL nebo poznámky.  
**Přechod:** Coursition z nich připraví propojený první návrh.  
**Výstup:** příprava, cíle a zadání aktivit jsou přímo upravitelné; obsah se opravuje přes vstupy a nové vygenerování.  
**Důvěra:** autor vidí deklarovanou míru opory cíle ve zdroji, slabá místa a interní náhled; označení nenahrazuje ověření v původním podkladu.  
**Akce:** CTA otevře registraci; nahrání zdroje následuje uvnitř produktu. B2B zájemce může místo toho vybrat konkrétní pilotní případ.

Každá webová sekce musí posunout jednu část této osy. Funkce, které osu neposunují, patří do detailu produktu nebo dokumentace.

## 3. Inventář hlavní české narativní copy

Anglická větev používá idiomaticky lokalizovanou stejnou narativní strukturu v `locales/en/translation.json`; nejde o mechanický překlad. Header/footer CTA a alternativní texty jsou součástí lokalizačního zdroje, ale tato kapitola inventarizuje hlavní narativní osu.

### 3.1 Hero

**Současná headline ve zdroji:**

> Nejtěžší na kurzu je prázdná stránka. Vy začínáte až za ní.

**Lead:**

> Nahrajete soubor. Otevře se rozepsaný kurz — cíle, aktivity, text pro studující. Nepíšete. Škrtáte.

**CTA:** `Nahrát první soubor`

**Vizuál:** produktový still celé mapy cílů s deklarovanou mírou opory ve zdroji a otevřenou editací cíle.

**Role ve funnelu:** problém → mechanismus → aktivace.

**Hodnocení:** silné, konkrétní, v souladu s positioningem. Slovo „kurz“ zde není SEO cílový termín stránky, ale přirozená produktová copy; SEO podstránky musí používat kvalifikátor „e-learning“.

### 3.2 Sekce „Hotová první verze“

**Intro:**

> Od cílů až po text, který čtou studující. Celé, ne kostra.

| Blok | Současný titulek | Funkce sdělení | Vizuální důkaz |
| --- | --- | --- | --- |
| Cíle | Cíle nevymýšlíte | první struktura ze zdroje | mapa cílů |
| Aktivity | Zadání nepíšete | propojení cíle s činností | plán aktivit |
| Obsah | Text nelepíte dohromady | navazující text kurzu | obsah kurzu |

**Outro:**

> Přepíšete cíl, změní se aktivity i text. Jedna oprava, ne tři.

**Faktické omezení současné copy:** věta může působit jako automatická propagace. Skutečné chování: po úpravě cíle mohou být navazující aktivity a obsah označeny jako zastaralé; autor je musí znovu vygenerovat a zkontrolovat. Text obsahu se nyní přímo needituje.

**Role ve funnelu:** vysvětlit hodnotu a provázanost návrhu.

### 3.3 Sekce „Nejdřív to uvidíte vy“

**Intro:**

> Slabá místa najdete, dokud je oprava levná.

| Blok | Současný titulek | Funkce sdělení |
| --- | --- | --- |
| Zdrojová opora | U každého cíle víte, odkud je | důvěra a kontrola |
| Náhled | Díry najdete vy, ne studující | kontrola před použitím |

**Role ve funnelu:** snížit obavu z nekontrolovaného AI výstupu.

### 3.4 Závěrečná CTA

**Titulek:** `Kurz zůstane váš.`  
**Body:** `Nahrajete, co máte. Rozhodujete vy: co zůstane, co přepíšete, co půjde pryč.`  
**CTA:** `Nahrát první soubor`

**Role ve funnelu:** zopakovat autorskou kontrolu a aktivovat.

## 4. Vizuální mapa současné landing page

| Sekce | Kompozice | Barva | Typ vizuálu | Pravidlo |
| --- | --- | --- | --- | --- |
| Hero | text + velký produktový still | warm canvas, plum/magenta | celá mapa cílů | screenshot musí čitelně dokazovat přímou editaci cíle a zobrazenou deklarovanou míru opory ve zdroji |
| První verze | střídavý text a still | neutrální plocha | cíle, aktivity, obsah | jeden screenshot na jedno tvrzení |
| Kontrola | sada benefitů | jemné karty | ikony + stručná copy | nekonkurovat screenshotům dekorací |
| Closing | plná plum plocha | `#4A044E` | bez generické ilustrace | jedna CTA, bílý text, vysoký kontrast |

Dark mode používá stejnou značkovou rodinu s přístupně upravenou světlostí. Produktové stilly musí odpovídat režimu stránky; nepoužívat světlou obrazovku jako svítící cizí blok na tmavém podkladu.

## 5. Mapování na cílové skupiny

| Sekce | Primární publikum | Potřeba | Co musí pochopit |
| --- | --- | --- | --- |
| Hero | lektor/expert; HR/L&D jako prioritní B2B hypotéza; self-service jako neověřená hypotéza | nezačínat od nuly | stačí vlastní podklad k prvnímu návrhu; nejde o potvrzení segmentu prodeji |
| První verze | všichni autoři | získat použitelnou strukturu | návrh je propojený, ne jen text |
| Kontrola | HR/L&D, agentura, expert | důvěra a odpovědnost | výstup lze posoudit před použitím |
| Closing | aktivovaný zájemce | jasný další krok | nahraje první soubor |

B2B rozhodovatel potřebuje navíc cenu, bezpečnost, rozsah pilotu a limity. Tyto informace nemusí přetížit hlavní landing page; patří do samostatné pilotní nabídky nebo B2B podstránky.

## 6. Mapování na funnel

| Fáze | Současný webový prvek | Chybějící důkaz / doporučení |
| --- | --- | --- |
| Awareness | hero problém prázdné stránky | cílové SEO stránky pro konkrétní use cases |
| Interest | cíle, aktivity, obsah | ukázka jednoho celého vstupu a výstupu |
| Trust | zdrojová opora a náhled | transparentní limity, ochrana dat, metodika kontroly |
| Activation | `Nahrát první soubor` otevírá registraci | navržené měření: klik CTA → registrace → založení návrhu → přidání zdroje → zpracování → kontrola/úprava |
| B2B qualification | nyní není samostatně pokryto | stručná stránka placeného pilotu |
| Conversion | není veřejně definována nabídka/cena | ceník nebo pilotní cena po rozhodnutí vlastníka |

## 7. Doporučené webové vrstvy

Všechny níže uvedené stránky jsou **návrh, zatím neexistují**, pokud současný zdroj neprokáže opak.

### 7.1 Priorita P0 — produktové důkazy

#### Ukázky vstupu a výstupu

**Účel:** nahradit chybějící reference skutečným produktovým důkazem.  
**Obsah:** anonymní/vlastní zdroj → cíl → aktivita → obsah → ruční oprava.  
**CTA:** Nahrát vlastní podklad.

#### Placený pilot

**Účel:** kvalifikovat B2B zájemce.  
**Obsah:** pro koho, vhodné případy, rozsah, limity, role, výsledek a další rozhodnutí.  
**CTA:** Vybrat pilotní materiál.

### 7.2 Priorita P0/P1 — české use cases

České názvy musí mít e-learningový nebo konkrétní firemní kvalifikátor:

1. `Školení zaměstnanců online z materiálů, které už máte`
2. `Onboarding nových zaměstnanců jako opakovatelné e-learningové školení`
3. `Jak z prezentace vytvořit e-learningový kurz`
4. `Jak převést směrnici nebo manuál na e-learningové školení`
5. `Tvorba testů a ověření znalostí zaměstnanců`

Nepsat obecnou stránku „tvorba kurzu“ bez rozlišení záměru.

### 7.3 Priorita P0/P1 — anglické source-to-course use cases

1. `Turn PDF or slide deck into an editable course draft`
2. `Turn a recorded webinar into a course`
3. `Turn SOPs and internal documents into training`
4. `AI course creator from source materials`

Anglické varianty nejsou mechanickým překladem českých stránek.

### 7.4 Priorita P1 — důvěra

- Jak Coursition pracuje se zdroji a co musí zkontrolovat autor.
- Bezpečnost a zacházení s materiály — publikovat jen ověřené technické informace.
- Co Coursition je a není: authoring studio vs. LMS.
- Veřejný ceník, až je nabídka rozhodnuta.

## 8. Doporučená copy matrice

| Webový typ | Headline vzorec | Důkaz | CTA |
| --- | --- | --- | --- |
| Hlavní landing | problém prázdné stránky → první návrh | produktový still | Nahrát první soubor |
| Use case | z konkrétního vstupu konkrétní e-learningový výstup | vstup + výstup | Vyzkoušet na vlastním podkladu |
| B2B pilot | ověřte jeden konkrétní interní materiál | rozsah a limity | Vybrat pilotní případ |
| Guide | jak dokončit práci, ne jak koupit nástroj | postup + ukázka | Otevřít první návrh |
| Comparison | pro koho je Coursition a kdy potřebujete LMS/jiný nástroj | transparentní hranice | Zkusit vhodný případ |

## 9. Copy vzory

### 9.1 Česká use-case hero

> **Z prezentace vytvořte propojený první návrh e-learningového kurzu.**  
> Nahrajete podklad. Coursition připraví cíle, aktivity a text. Přípravu, cíle a zadání aktivit upravíte přímo; obsah zkontrolujete a případné opravy promítnete přes vstupy a regeneraci.

### 9.2 Anglická use-case hero

> **Turn your source material into an editable course draft.**  
> Upload a PDF, slide deck, link, or notes. Review the objectives, activities, and learner-facing content before you use it.

### 9.3 B2B pilot

> **Ověřte jeden interní materiál, ne celou transformaci vzdělávání.**  
> Vybereme konkrétní podklad, autora a očekávaný výstup. Předem popíšeme limity. Výsledkem pilotu je rozhodnutí, zda má placené pokračování smysl.

### 9.4 Transparentní limit

> Coursition připravuje návrh. Odbornou správnost, vhodnost aktivit a práva ke zdrojům musí posoudit autor.

## 10. SEO a metadatová pravidla

- Každá cílová stránka má jeden záměr, vlastní title, meta description a H1.
- České stránky používají „e-learning“, „školení zaměstnanců“ nebo konkrétní vstup; neholé „kurz“ jako hlavní dotaz.
- Anglické stránky používají konkrétní source-to-course formulace.
- Přesná search volume: **není k dispozici**. Nevkládat odhad do priority nebo business case.
- Každá nová stránka má interní odkazy z relevantních sekcí.
- Structured data používat až pro skutečný obsah; neoznačovat marketingový text jako FAQ/HowTo bez odpovídající struktury.
- Nepoužívat zákaznické logo, rating, case study nebo testimonial bez skutečného důkazu.

## 11. Vizuální podklady

### Současné runtime product stilly

- `public/landing/{cs,en}/{map,objectives,activities,content}.png` — desktop light.
- `public/landing/{cs,en}/dark/{map,objectives,activities,content}.png` — desktop dark.
- `public/landing/{cs,en}/phone/{map,objectives,activities,content}.png` — telefon light.
- `public/landing/{cs,en}/phone/dark/{map,objectives,activities,content}.png` — telefon dark.

Runtime vybírá asset podle jazyka, viewportu a režimu. Přesný příkaz, zdrojový kurz a čas pořízení těchto stillů nejsou v samostatném manifestu doloženy; proto dokládají současnou implementaci, ne produkční deploy.

### Archivní page captures

- `interní archiv produktových screenshotů11-landing-redesign-full-desktop.png` — archivní celá světlá landing page, starší copy.
- `interní archiv produktových screenshotů12-landing-redesign-dark-desktop.png` — archivní dark-mode hero, starší copy.
- `interní archiv produktových screenshotů13-landing-redesign-mobile.png`
- `interní archiv produktových screenshotů14-landing-redesign-full-mobile.png`
- `interní archiv produktových screenshotů15-landing-redesign-en-desktop.png`
- `aktuální produktové screenshoty Coursition` — aktuálnější metodické screenshoty aplikace.

### Pravidlo aktualizace

Po změně landing-page copy nebo layoutu:

1. sestavit aktuální aplikaci;
2. zachytit `/cs` a `/en`, desktop/mobile, light/dark podle potřeby;
3. nechat v dokumentaci pouze reprodukovatelné stavy;
4. staré screenshoty označit jako archivní nebo nahradit;
5. zkontrolovat shodu textu v obrazu s lokalizačním zdrojem.

## 12. Co se tímto dokumentem nemění

- žádný soubor v `src/`, `locales/` ani `public/`;
- žádný deployment nebo produkční obsah;
- žádný ceník, nabídka nebo integrační slib;
- žádná SEO stránka;
- žádný souběžný landing-page návrh jiné práce.

## 13. Zdrojový registr

- `src/features/coursition/coursition-landing-page.tsx`
- `locales/cs/translation.json` a `locales/en/translation.json`, `coursition.landing.*`
- `public/landing/`
- `interní registr produktových screenshotů`
- `Brand-a-graficky-manual-Coursition.md`
- `Komunikacni-strategie-a-manual-Coursition.md`
- `src/routes/coursition-landing.css`
- `src/routes/coursition-theme.css`
- `interní archiv produktových screenshotů`
- `aktuální produktové screenshoty Coursition`
- `SEO analýza a manuál Coursition`, kap. 7–10
- `strategická data SEO: sitemap plan`
- `strategická data SEO: české content briefs`
- `strategická data SEO: anglické content briefs`
