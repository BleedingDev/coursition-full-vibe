# Coursition — uživatelský manuál

## Účel aplikace

Coursition převádí vlastní zdrojové materiály na strukturovaný online kurz. Tvůrce dodá poznámky, URL nebo soubor, zkontroluje návrh cílové skupiny a výukových cílů, nechá připravit aktivity a otevře hotový kurz v interaktivním náhledu.

Aplikace je dostupná česky a anglicky, podporuje světlý a tmavý režim a funguje na mobilu i desktopu.

## Přihlášení

1. Otevřete produkční adresu Coursition.
2. Přepněte jazyk pomocí **Čeština / English** v horní liště.
3. Pro nový účet zvolte **Registrace**, vyplňte jméno, e-mail a heslo s alespoň 8 znaky.
4. Pro existující účet zvolte **Přihlášení**.
5. Po práci použijte **Odhlásit se**. Kurzy zůstávají uložené a po dalším přihlášení je lze obnovit.

## Vytvoření kurzu

1. Na nástěnce vyplňte název a stiskněte **Vytvořit kurz**.
2. Zvolte režim:
   - **Vygenerovat kurz za mě** připraví celý návrh po dodání zdrojů.
   - **Pomozte mi ho vytvořit** umožní kontrolu jednotlivých kroků.
3. V horní navigaci je aktuální krok zvýrazněn. Tlačítka **Zpět** a **Další** respektují povinné podmínky; pokud krok nelze otevřít, aplikace zobrazí důvod.

## Přidání zdrojů

Na kroku **Zdroje** vyberte jeden typ:

- **Poznámky** — vložte vlastní text; nejspolehlivější varianta pro demonstrační scénář.
- **URL** — vložte veřejně dostupnou adresu. Úspěch závisí na obsahu stránky a nakonfigurovaném poskytovateli.
- **Soubor** — nahrajte podporovaný dokument. Velké nebo chráněné soubory mohou být odmítnuty.

Vyplňte název zdroje a stiskněte **Přidat zdroj**. Po zpracování se zdroj objeví v seznamu. U zdroje lze otevřít náhled, zkusit zpracování znovu nebo jej odstranit. Při přepnutí typu zdroje se neslučitelná rozepsaná data záměrně vymažou.

Používejte jen materiály, ke kterým máte oprávnění. Nevkládejte osobní nebo citlivé údaje, pokud pro jejich zpracování nemáte právní základ a schválený postup.

## Příprava kurzu

V průvodci postupně zkontrolujte:

1. **Příprava kurzu** — publikum, očekávaný výsledek, předchozí znalosti, tón, hloubku, omezení, preferenci aktivit, jazyk a přísnost práce se zdroji.
2. **Mapa cílů** — upravte názvy a pozorovatelné schopnosti. Změny se ukládají po opuštění formuláře.
3. **Plán aktivit** — zkontrolujte typ, pokyny, akci studenta, kritéria úspěchu a zpětnou vazbu.
4. **Obsah kurzu** — nechte vytvořit výsledné sekce a zkontrolujte vazbu na zdroje.
5. **Interaktivní náhled** — projděte kurz jako student.

Pokud upravíte dřívější krok, navazující vygenerované části mohou být označeny jako zastaralé a je nutné je přegenerovat.

## Typy aktivit

Coursition používá pět opakovatelných výukových mechanismů:

- kontrolní otázka s volbou odpovědi;
- rozhodnutí v modelové situaci;
- řazení nebo přiřazování;
- praktický úkol s kontrolním seznamem;
- otevřená odpověď hodnocená podle kritérií.

U otevřených odpovědí odešlete konkrétní text. Aplikace vrátí skóre, zpětnou vazbu ke kritériím a doporučený další krok.

## Obnovení a odstranění kurzu

Na nástěnce použijte **Pokračovat** pro návrat do posledního kroku. **Smazat** odstraní kurz z účtu; tuto akci používejte pouze tehdy, když data již nepotřebujete. Kurzy označené **Ukázkový kurz** slouží pouze k demonstraci.

## Doporučený akceptační scénář

1. Zaregistrujte čistý demonstrační účet.
2. Vytvořte český kurz s jednoznačným názvem.
3. Přidejte krátké známé poznámky bez citlivých údajů.
4. Projděte všechny kroky a zaznamenejte obrazovku.
5. Vyzkoušejte všech pět typů aktivit.
6. Odhlaste se, znovu se přihlaste a kurz obnovte.
7. Uložte datum, URL, commit, deployment ID a snímky obrazovky do akceptačního protokolu.

## Řešení potíží

- **Nelze pokračovat:** přečtěte zprávu pod navigací; obvykle chybí zpracovaný zdroj nebo schválený výstup předchozího kroku.
- **Zdroj selhal:** otevřete detail, zkontrolujte formát/URL a použijte opakování; pro demo lze vložit stejný obsah jako poznámky.
- **Generování není dostupné:** správce musí ověřit produkční AI klíč a model.
- **Přihlášení selhalo:** zkontrolujte e-mail a heslo; správce ověří Worker, D1 a `BETTER_AUTH_SECRET`.
- **Změny nejsou vidět:** obnovte stránku a kurz otevřete z nástěnky. Pokud potíž trvá, předejte správci čas, účet, URL a přesný krok.
