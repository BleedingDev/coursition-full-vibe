# Discovery a vnitřní analýza

**Produkt:** Coursition  
**Verze dokumentu:** 1.0  
**Datum přípravy dokumentu:** 27. 7. 2026  
**Typ dokumentu:** současná evidenční rekonstrukce

> **Důležité omezení:** původní záznam Discovery Session, seznam účastníků, zápis, citace ani schválení nejsou v dostupných podkladech. Tento dokument proto není historickým zápisem setkání. Rekonstruuje současný stav z ověřeného produktu, SEO balíčku, existující identity a potvrzených firemních vstupů.

## 1. Manažerské shrnutí

Coursition je funkční produkt ve fázi obchodní validace. Z existujících podkladů připravuje propojený návrh kurzu vedený přes přípravu, vzdělávací cíle, aktivity, obsah a interní náhled. Přípravu, cíle a zadání aktivit lze upravovat přímo; obsah se opravuje přes vstupy a regeneraci. Autor musí výstup zkontrolovat a zůstává odpovědný za jeho použití.

Technická a vizuální základna existuje. Hlavní mezera není další obecný branding, ale důkaz trhu a opakovatelná cesta k hodnotě:

- 0 prodejů a 0 Kč produktových tržeb;
- žádná uzavřená spolupráce;
- první pilot nebyl úspěšný a další neproběhl;
- žádní stálí zaměstnanci;
- bez dedikované obchodní kapacity je B2B prodej pomalý;
- přesná search volume nejsou k dispozici;
- veřejný web má malou obsahovou vrstvu.

Z analýzy plyne: soustředit značku na práci „z podkladu do propojeného prvního návrhu pod kontrolou autora“, ověřovat úzké use cases a neškálovat komunikaci před prokázanou aktivací a ochotou platit.

## 2. Metoda rekonstrukce

Použité vrstvy evidence v pořadí důvěry:

1. současné reprodukovatelné chování aplikace a uživatelská metodika;
2. současný landing-page zdroj a lokalizace;
3. SEO analýza a surová strategická data;
4. potvrzené vstupy od Petra;
5. původní Design Manual a současné grafické podklady;
6. starší screenshoty a prezentace pouze jako historický kontext.

Veřejné produkční nasazení nebylo tímto dokumentem potvrzeno. Produktové skutečnosti označené jako ověřené vycházejí z reprodukovatelného lokálního sestavení, současného zdroje a metodiky; dostupnost produkční domény je samostatná provozní otázka.

Při rozporu má přednost vyšší vrstva. Starší screenshot není důkazem současné copy, pokud se zdroj změnil.

## 3. Potvrzené skutečnosti

### 3.1 Produkt

| Skutečnost | Stav | Zdroj |
| --- | --- | --- |
| Coursition převádí poznámky, URL nebo soubor na strukturovaný návrh kurzu | ověřeno | uživatelská metodika, kap. 1 a workflow |
| Workflow obsahuje přípravu, cíle, aktivity, obsah a náhled | ověřeno | uživatelská metodika; současná aplikace |
| Návrhy lze upravovat | ověřeno | aplikace a metodika |
| Výstup AI vyžaduje kontrolu autora | ověřeno | uživatelská metodika |
| Rozhraní je česky a anglicky | ověřeno | lokalizace a metodika |
| Produkt není LMS ani tržiště hotových kurzů | vymezení podle současných schopností | SEO a metodika |
| SCORM/xAPI/LTI nelze nyní slibovat | neověřeno jako současná schopnost | SEO seznam „co necílit“ |

### 3.2 Značka a web

| Skutečnost | Stav | Zdroj |
| --- | --- | --- |
| Existuje symbol vlaštovky/papírového letadla, wordmark a kompletní logo | ověřeno | původní Design Manual, zdrojové SVG |
| Základní barvy jsou plum `#4A044E`, magenta `#A01DAF`, sekundární blue `#007AA8` | ověřeno | manuál a současné CSS |
| Primární písmo je Geist s náhradou Inter | ověřeno | manuál a současné CSS |
| Současná copy staví na prázdné stránce, prvním návrhu a kontrole autora | ověřeno ve zdroji | `locales/cs/translation.json` |
| Veřejná obsahová vrstva je malá | doloženo SEO auditem dostupným k datu dokumentu | SEO analýza |
| Starší redesignové screenshoty mají jinou headline než současný zdroj | ověřeno porovnáním | screenshoty + lokalizace |

### 3.3 Obchod a organizace

| Skutečnost | Stav | Zdroj |
| --- | --- | --- |
| Produktové tržby | **0 Kč** | potvrzené vstupy od Petra |
| Dokončené prodeje | **0** | potvrzené vstupy od Petra |
| Uzavřené partnerství/spolupráce | **žádné** | potvrzené vstupy od Petra |
| První pilot | neúspěšný | potvrzené vstupy od Petra |
| Další pilot | neproběhl | potvrzené vstupy od Petra |
| Stálí interní zaměstnanci | 0 na začátku i na konci | potvrzené vstupy od Petra |
| Vývoj | silně podporovaný AI, externí spolupracovníci podle potřeby | potvrzené vstupy od Petra |
| B2B nákup | pomalý a obtížný bez dedikovaného sales a kontaktů na HR/L&D | potvrzené vstupy od Petra |

## 4. Současná SEO evidence o trhu a poptávce

Tato část není novým průzkumem trhu. Shrnuje pouze současnou SEO/SERP evidence pro obsahovou prioritizaci. Historická tržní analýza byla podle potvrzených podkladů dokončena dříve; její lokální evidenční propojení zůstává samostatným úkolem.

### 4.1 Co SEO skutečně ukazuje

- Technický základ webu je použitelný, ale chybí cílové obsahové stránky.
- Anglický source-to-course shluk má v jednom odebraném SERP vzorku relativně příznivé složení menších dodavatelů a konkrétních vstupních formátů.
- Česká obecná fráze „kurz“ je významově nejednoznačná. Pro produktový obsah je nutné „e-learning“, „školení zaměstnanců“ nebo konkrétní vstup.
- SEO balíček obsahuje audience questions, obsahová zadání a seznam témat, která nyní necílit.
- Přesná měsíční hledanost a Google Trends nejsou dostupné. Zjištění nejsou důkazem velikosti placeného trhu.

### 4.2 Co SEO neukazuje

- ochotu platit;
- aktivaci uvnitř produktu;
- délku obchodního cyklu konkrétního segmentu;
- cenu, kterou trh přijme;
- požadovanou míru podpory;
- retenci;
- důvod neúspěchu prvního pilotu.

## 5. Silné stránky

### 5.1 Jasný mechanismus hodnoty

Vstupem jsou materiály, které už autor má. Výstupem není jen volný text, ale propojená struktura. Mechanismus lze ukázat obrazovkou a konkrétním příkladem.

### 5.2 Editovatelnost a kontrola autora

Produktový příslib není „AI všechno udělá správně“, ale „autor nezačne od nuly“. To je důvěryhodnější a odpovídá skutečnému workflow.

### 5.3 Existující vizuální identita

Logo, typografie a barvy jsou rozpoznatelné a současný produkt je používá. Není nutná nová značka; je nutná důslednost.

### 5.4 Lokalizovaný produkt a web

Čeština a angličtina umožňují testovat dvě rozdílné jazykové větve. SEO analýza ukazuje, že se nemají překládat mechanicky.

### 5.5 Reprodukovatelné podklady

Existují metodiky, SEO data, zdrojové texty, screenshoty a dokumentové buildy. Strategická tvrzení lze průběžně ověřovat.

## 6. Slabé stránky a omezení

### 6.1 Nulová komerční validace

Bez prodeje a úspěšného pilotu nelze používat sociální důkaz, odhadovat konverze ani mluvit o product-market fit.

### 6.2 Chybějící obchodní kapacita

B2B strategie bez konkrétního vlastníka sales může vytvořit dokumenty, ale ne důkaz. Odpovědnost musí být přidělena po rolích a kapacitě.

### 6.3 Malá obsahová vrstva webu

Technický web nestačí k zachycení konkrétních use cases. Reklama bez cílových stránek by posílala návštěvníky na příliš obecný vstup.

### 6.4 Důvěra a produktové limity

**Hypotéza k ověření:** B2B nákup mohou blokovat požadavky na kvalitu, práci se zdroji, bezpečnost, export, integrace a odpovědnost. Ověřit v kvalifikačních rozhovorech a placené nabídce; do té doby je nevydávat za doložené námitky trhu.

### 6.5 Neznámý důvod neúspěchu pilotu

Dostupná evidence potvrzuje výsledek, ne root cause. Opakovat pilot stejným způsobem bez retrospektivy by bylo neřízené.

### 6.6 Historický manuál byl nedokončený

Původní Design Manual obsahuje prázdná místa pro copy a vizuální aplikace. Tento balíček je doplňuje, ale nevytváří důkaz o původním procesu nebo schválení.

## 7. Příležitosti

Všechny body jsou **strategické hypotézy**:

1. Anglický source-to-course obsah pro konkrétní vstupy: PDF, slides, webinar, SOP/docs.
2. Český obsah pro tvorbu e-learningu, onboarding a interní školení.
3. Placený pilot na jednom omezeném interním materiálu.
4. Self-service cesta pro lektory a experty s kratším rozhodováním.
5. Produktové ukázky vstup/výstup jako náhrada chybějících zákaznických referencí.
6. Transparentní komunikace kontroly zdrojové podloženosti.

## 8. Hrozby

1. **Kategorie mismatch:** návštěvník očekává LMS, HR software nebo SCORM export.
2. **Přehnaný slib AI:** první nepřesnost zničí důvěru, pokud komunikace slíbila bezchybnost.
3. **Enterprise rozptyl:** dlouhý nákupní cyklus spotřebuje omezenou kapacitu bez výsledku.
4. **Obsah bez distribuce:** vzniknou stránky, ale nikdo nevlastní měření a navazující akci.
5. **Falešná přesnost:** SEO odhady nebo doporučené prahy budou vydány za historická data.
6. **Paralelní nesoulad:** strategický dokument přepíše positioning rychleji než produkt a landing page.
7. **Supplier handoff gap:** výstup existuje, ale není jasné, kdo rozhoduje a udržuje jej.

## 9. Známé neznámé

| Otázka | Proč rozhoduje | Jak ověřit |
| --- | --- | --- |
| Proč první pilot selhal? | bez příčiny nelze navrhnout druhý | strukturovaná retrospektiva nad skutečným případem |
| Který krok nejčastěji zastaví autora? | určuje aktivaci a onboarding | instrumentace + pozorované průchody |
| Který segment má nejvyšší naléhavost? | určuje obchodní fokus | rozhovor nad konkrétním materiálem + placená nabídka |
| Jaká je přijímaná cena? | určuje model | nabídnout cenu, neměřit jen deklarovaný zájem |
| Kolik podpory vyžaduje první návrh? | určuje ekonomiku self-service | evidovat zásahy a čas podpory |
| Jaké exporty/integrace jsou skutečně nutné? | určuje roadmapu | kvalifikovat deal-breaker, ne wishlist |
| Je anglický source-to-course traffic kvalitní? | určuje obsahovou prioritu | publikovat stránky a měřit aktivaci podle zdroje |
| Kdo vlastní sales a marketing? | bez vlastníka není test | explicitně přidělit roli, čas a cíl |

## 10. Co bylo z analýzy vyloučeno

Nebyla vytvořena ani domýšlena:

- historická Discovery Session;
- jména účastníků, citace, závěry nebo schválení setkání;
- zákazníci, reference, prodeje nebo partnerství;
- příčina neúspěchu pilotu;
- přesná search volume;
- historické funnel metriky;
- konkrétní ROI nebo úspora času;
- schopnosti produktu, které nejsou ověřené;
- autorství nebo dodavatelská historie původního manuálu;
- změny aplikace nebo landing page;
- nový nebo náhradní průzkum trhu; současná SEO evidence slouží pouze k nové obsahové prioritizaci.

## 11. Rozhodnutí plynoucí z analýzy

### Rozhodnutí 1 — držet jednu značkovou osu

Coursition = z podkladů do propojeného prvního návrhu pod kontrolou autora. Tuto osu používat v brandu, copy, marketingu a webové mapě.

### Rozhodnutí 2 — nejprve aktivace a placený use case

Měřit postup od zdroje k první úpravě. Nabízet omezený placený pilot. Nezaměňovat registraci za hodnotu.

### Rozhodnutí 3 — dvě jazykové strategie

Anglicky konkrétní source-to-course formáty. Česky e-learning a konkrétní firemní situace. Nepřekládat stránky jedna ku jedné.

### Rozhodnutí 4 — důkaz produktem, ne referencí

Dokud neexistují zákazníci, používat reálné ukázky vstupu a výstupu, metodiku a transparentní omezení.

### Rozhodnutí 5 — neškálovat bez vlastníka

Marketingový a obchodní plán platí pouze s přidělenou rolí a kapacitou. Pokud chybí, má být výsledkem rozhodnutí o pauze, ne další seznam aktivit.

## 12. Otázky pro převzetí a další rozhodnutí

1. Kdo bude po dobu 90 dnů vlastníkem produktové aktivace, marketingu a obchodu?
2. Lze rekonstruovat první pilot natolik, aby byla známa příčina selhání a změna pro další test?
3. Který jeden materiál/use case bude použit pro první placenou nabídku?
4. Jaké produktové limity se uvedou přímo v nabídce pilotu?
5. Jaký rozpočet a čas jsou skutečně dostupné pro obsah a obchod?
6. Kdo smí schvalovat veřejná tvrzení a použití vizuálů?
7. Kdy se strategie znovu vyhodnotí podle reálných dat?

## 13. Zdrojový registr

- `potvrzené interní vstupy vedení Coursition`
- `SEO analýza a manuál Coursition`
- `strategická data SEO: cluster verdicts`
- `strategická data SEO: do-not-target`
- `původní Design Manual Coursition`
- `uživatelská metodika Coursition`
- `locales/cs/translation.json`
- `src/features/coursition/coursition-landing-page.tsx`
- `src/routes/coursition-theme.css`
- `src/routes/coursition-landing.css`
- `interní archiv produktových screenshotů`
