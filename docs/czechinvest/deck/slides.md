---
theme: ./theme
title: Coursition — první návrh kurzu z vlastních podkladů
info: |
  Produktová prezentace Coursition, aktualizovaná 5. 8. 2026.
  Snímky zachycují české rozhraní současného rebrandovaného buildu.
class: text-left
transition: none
mdc: true
drawings:
  persist: false
fonts:
  provider: none
layout: cover
source: Lokální Cloudflare Worker preview, 5. 8. 2026 · kurz „Bezpečnost práce ve výrobě“
---

# Z podkladu propojený první návrh kurzu

Coursition připraví cíle, zadání aktivit a navazující obsah. Autor výstup
zkontroluje, upraví přípravu, cíle a zadání aktivit a podle potřeby obsah znovu vygeneruje.

::media::

<div class="cover-stack">
  <img class="cs-shot cover-desktop" :src="'/shots/10-objectives-cs-desktop-rebrand.png'" alt="Mapa cílů v současném fialovém rozhraní Coursition" />
  <img class="cs-shot cs-shot--phone cover-phone" :src="'/shots/14-preview-cs-mobile-rebrand.png'" alt="Interní náhled kurzu v mobilním viewportu" />
</div>

<style>
.cover-stack { position: relative; }
.cover-desktop { width: 100%; }
.cover-phone {
  position: absolute;
  right: -1.2rem;
  bottom: -3.2rem;
  height: 15.5rem;
}
</style>

<!--
Zdroje: methodologies/figures/10-objectives-cs-desktop-reused.png a
methodologies/figures/14-preview-cs-mobile-reused.png. Celé viewporty bez ořezu.
-->

---
layout: default
kicker: Nástěnka
title: Rozpracované návrhy zůstávají pohromadě
lead: Z nástěnky založíte nový kurz nebo otevřete existující návrh a pokračujete v práci.
source: application-screenshots/16-dashboard-cs-desktop-rebrand.png · lokální preview 5. 8. 2026
---

<div class="shot-left">
  <img class="cs-shot" :src="'/shots/16-dashboard-cs-desktop-rebrand.png'" alt="Nástěnka Coursition s rozpracovaným kurzem" />

  <div class="cs-points">
    <div class="cs-point">
      <img :src="'/icons/resume.png'" alt="" />
      <div>
        <h3>Pokračování bez hledání</h3>
        <p>Karta kurzu nabízí návrat do uloženého workflow. Snímek dokládá lokální stav aplikace, nikoli produkční dostupnost.</p>
      </div>
    </div>
    <div class="cs-point">
      <img :src="'/icons/layers.png'" alt="" />
      <div>
        <h3>Stav je vidět na kartě</h3>
        <p>Počty zdrojů, aktivit a částí obsahu ukazují aktuální rozsah rozpracovaného návrhu.</p>
      </div>
    </div>
    <div class="cs-point">
      <img :src="'/icons/doc.png'" alt="" />
      <div>
        <h3>Nový kurz začíná názvem</h3>
        <p>Nástěnka je výchozí pracovní plocha autora, ne katalog nebo distribuční prostředí pro studující.</p>
      </div>
    </div>
  </div>
</div>

<!--
Zdroj: application-screenshots/16-dashboard-cs-desktop-rebrand.png, celý viewport
1440 × 900. Lokální syntetický stav; bez produkčního zásahu.
-->

---
layout: default
kicker: Zdroje
title: Vlastní podklady otevřou první návrh
lead: Autor může přidat poznámky, URL nebo soubor. Zpracovaný zdroj je vstupem pro generování, ne garancí správnosti výstupu.
source: application-screenshots/17-sources-cs-desktop-rebrand.png · lokální preview 5. 8. 2026
---

<div class="shot-right">
  <div class="cs-points">
    <div class="cs-point">
      <img :src="'/icons/doc.png'" alt="" />
      <div>
        <h3>Tři typy vstupu</h3>
        <p>Poznámky, veřejná URL nebo podporovaný soubor dávají systému materiál pro další kroky.</p>
      </div>
    </div>
    <div class="cs-point">
      <img :src="'/icons/check.png'" alt="" />
      <div>
        <h3>Stav zpracování je viditelný</h3>
        <p>Označení „Zpracováno“ potvrzuje dokončení technického zpracování zdroje, ne věcnou správnost budoucího kurzu.</p>
      </div>
    </div>
    <div class="cs-point">
      <img :src="'/icons/edit.png'" alt="" />
      <div>
        <h3>Autor dál rozhoduje</h3>
        <p>Příprava kurzu zůstává upravitelná a vygenerované výstupy vyžadují odbornou a didaktickou kontrolu.</p>
      </div>
    </div>
  </div>
  <img class="cs-shot" :src="'/shots/17-sources-cs-desktop-rebrand.png'" alt="Obrazovka Zdroje s kartami Poznámky, URL a Soubor" />
</div>

<!--
Zdroj: application-screenshots/17-sources-cs-desktop-rebrand.png, celý viewport
1440 × 900. Lokální syntetický kurz; bez externích změn.
-->

---
layout: default
kicker: Mapa cílů
title: Cíle dostanou strukturu — a zůstávají upravitelné
lead: Návrh propojí schopnosti s navazujícími aktivitami a obsahem. Autor může názvy i formulace schopností změnit přímo.
source: methodologies/figures/10-objectives-cs-desktop-reused.png · lokální preview 5. 8. 2026
---

<div class="shot-left">
  <img class="cs-shot" :src="'/shots/10-objectives-cs-desktop-rebrand.png'" alt="Upravitelná mapa cílů se štítky deklarované opory ve zdroji" />

  <div class="cs-points">
    <div class="cs-point">
      <img :src="'/icons/label.png'" alt="" />
      <div>
        <h3>Struktura místo prázdné stránky</h3>
        <p>Každý cíl obsahuje název a schopnost, na kterou mohou navázat aktivity a části obsahu.</p>
      </div>
    </div>
    <div class="cs-point">
      <img :src="'/icons/edit.png'" alt="" />
      <div>
        <h3>Štítek je deklarace systému</h3>
        <p>„Podloženo zdrojem“ uvádí, jak systém cíl klasifikoval. Shodu s původním materiálem ověřuje autor.</p>
      </div>
    </div>
    <div class="cs-point">
      <img :src="'/icons/resume.png'" alt="" />
      <div>
        <h3>Přímá úprava nebo regenerace</h3>
        <p>Jednotlivý cíl lze přepsat na místě. Změny mohou označit navazující výstupy jako zastaralé a vyžádat nové generování.</p>
      </div>
    </div>
  </div>
</div>

<!--
Zdroj: methodologies/figures/10-objectives-cs-desktop-reused.png, celý viewport
1440 × 900; rebrandovaný kurz „Bezpečnost práce ve výrobě“.
-->

---
layout: default
kicker: Plán aktivit
title: Zadání aktivit upravíte přímo
lead: Coursition navrhne typ a zadání aktivit. Autor upraví instrukce, akci studujícího, kritéria úspěchu i doporučení ke zpětné vazbě.
source: methodologies/figures/11-activities-cs-desktop-reused.png · lokální preview 5. 8. 2026
---

<div class="shot-right">
  <div class="cs-points">
    <div class="cs-point">
      <img :src="'/icons/label.png'" alt="" />
      <div>
        <h3>Návrh navazuje na cíle</h3>
        <p>Aktivita je přiřazena ke schopnosti, kterou má kurz rozvíjet. Vazbu musí autor posoudit.</p>
      </div>
    </div>
    <div class="cs-point">
      <img :src="'/icons/edit.png'" alt="" />
      <div>
        <h3>Brief není uzamčený</h3>
        <p>Název, typ, instrukce a očekávaná akce jsou přímo upravitelné v pracovním kroku.</p>
      </div>
    </div>
    <div class="cs-point">
      <img :src="'/icons/check.png'" alt="" />
      <div>
        <h3>Obsah se opravuje regenerací</h3>
        <p>Změna briefu, která ovlivňuje text pro studující, vyžaduje nové vygenerování obsahu a další kontrolu autora.</p>
      </div>
    </div>
  </div>
  <img class="cs-shot" :src="'/shots/11-activities-cs-desktop-rebrand.png'" alt="Upravitelný plán aktivit v současném rozhraní Coursition" />
</div>

<!--
Zdroj: methodologies/figures/11-activities-cs-desktop-reused.png, celý viewport
1440 × 900. Screenshot dokládá přímou editaci briefu, ne správnost návrhu.
-->

---
layout: default
kicker: Interní náhled
title: Výsledek zkontrolujete před dalším použitím
lead: Náhled ukazuje současný vygenerovaný kurz na desktopu i telefonu. Coursition jej zde nepublikuje ani nedoručuje účastníkům.
source: methodologies/figures/13-preview-cs-desktop-reused.png + 14-preview-cs-mobile-reused.png · 5. 8. 2026
---

<div class="learner">
  <div class="learner-desk">
    <img class="cs-shot" :src="'/shots/13-preview-cs-desktop-rebrand.png'" alt="Interní náhled vygenerovaného kurzu na desktopu" />
    <div class="cs-fact learner-note"><img :src="'/icons/check.png'" alt="" /><span>Autor projde sekce, vysvětlení a aktivity a porovná je s původními podklady.</span></div>
  </div>
  <div class="learner-phone">
    <img class="cs-shot cs-shot--phone" :src="'/shots/14-preview-cs-mobile-rebrand.png'" alt="Interní náhled vygenerovaného kurzu v mobilním viewportu" />
    <div class="cs-fact learner-note"><img :src="'/icons/phone.png'" alt="" /><span>Mobilní viewport odhalí čitelnost a responzivní chování před případným dalším zpracováním.</span></div>
  </div>
</div>

<style>
.learner {
  display: grid;
  grid-template-columns: auto auto;
  justify-content: start;
  gap: 2.4rem;
  align-items: start;
}
.learner-desk .cs-shot { height: 16.4rem; width: auto; }
.learner-phone .cs-shot--phone { height: 16.4rem; }
.learner-note { margin-top: 1rem; }
</style>

<!--
Zdroje: methodologies/figures/13-preview-cs-desktop-reused.png (1440 × 900)
a 14-preview-cs-mobile-reused.png (390 × 844). Interní autorský náhled, ne LMS.
-->

---
layout: end
---

# První návrh vznikne rychleji. Odpovědnost zůstává autorovi.

Coursition propojí podklady, cíle, zadání aktivit a obsah. Autor rozhoduje,
co upraví, co znovu vygeneruje a co je připravené k dalšímu použití.

<!--
Závěr bez tvrzení o publikaci, doručení studujícím nebo automatické správnosti.
-->
