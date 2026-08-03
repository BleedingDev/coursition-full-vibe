---
theme: ./theme
title: Coursition - tvorba kurzů z vlastních podkladů
info: |
  Produktová prezentace pro CzechInvest (Ivo Stanček), 3. 8. 2026.
  Snímky jsou z aktuálního buildu aplikace, české rozhraní,
  kurz Onboarding zákazníků.
author: Petr Glaser
class: text-left
transition: none
mdc: true
drawings:
  persist: false
fonts:
  provider: none
layout: cover
---

# Z jednoho podkladu celý hotový kurz

Vložíte materiál, který už máte. Coursition z něj sám poskládá cíle, aktivity
i obsah a hotový kurz si hned prohlédnete.

::media::

<div class="cover-stack">
  <img class="cs-shot cover-desktop" :src="'/shots/04-objectives-desktop-card.png'" alt="Vygenerovaná mapa cílů kurzu" />
  <img class="cs-shot cs-shot--phone cover-phone" :src="'/shots/09-preview-mobile-card.png'" alt="Hotový kurz v telefonu" />
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
Otevírací věta: tvůrce vloží jediný podklad a dostane hotový kurz.
Vizuál: vlevo vygenerovaná mapa cílů, vpravo hotový kurz v telefonu.
Zdroj: application-screenshots/04-objectives-desktop.png, 09-preview-mobile.png
-->

---

layout: default
kicker: Start kurzu
title: Jediný krok, který děláte vy.
lead: Vložíte materiál k tématu. Všechno ostatní, co uvidíte na dalších obrazovkách, si Coursition vygeneruje sám.
---

<div class="shot-right">
  <div class="cs-points">
    <div class="cs-point">
      <img :src="'/icons/doc.png'" alt="" />
      <div>
        <h3>Pár vteřin a máte hotovo</h3>
        <p>Poznámky, odkaz na stránku nebo soubor z disku. Nic se nedopisuje ani neupravuje, podklad stačí tak, jak je.</p>
      </div>
    </div>
    <div class="cs-point">
      <img :src="'/icons/check.png'" alt="" />
      <div>
        <h3>Stav máte na očích</h3>
        <p>U podkladu je vidět, kdy je zpracovaný. Do té doby se nemusíte o nic starat.</p>
      </div>
    </div>
    <div class="cs-point">
      <img :src="'/icons/layers.png'" alt="" />
      <div>
        <h3>Nic se neztratí</h3>
        <p>Materiál zůstává v kurzu. Cíle, aktivity i texty z něj vycházejí a kdykoli si dohledáte, odkud co je.</p>
      </div>
    </div>
  </div>
  <img class="cs-shot" :src="'/shots/03-sources-desktop-card.png'" alt="Obrazovka Zdroje: poznámky, odkaz a soubor" />
</div>

<!--
Snímek: krok Zdroje, záložky Poznámky / URL / Soubor a vložený podklad.
Zdroj: application-screenshots/03-sources-desktop.png
-->

---

layout: default
kicker: Mapa cílů
title: Kostra kurzu, kterou nemusíte vymýšlet
lead: Coursition z vašeho materiálu sám sepíše schopnosti, které má účastník kurzu získat.
---

<div class="shot-left">
  <img class="cs-shot" :src="'/shots/04-objectives-desktop-card.png'" alt="Vygenerovaná mapa cílů se štítky původu" />

  <div class="cs-points">
    <div class="cs-point">
      <img :src="'/icons/label.png'" alt="" />
      <div>
        <h3>Cíle máte hotové</h3>
        <p>Ke každému cíli je název i popis schopnosti. Aktivity a obsah kurzu na ně pak navazují.</p>
      </div>
    </div>
    <div class="cs-point">
      <img :src="'/icons/edit.png'" alt="" />
      <div>
        <h3>Vidíte, odkud se cíl vzal</h3>
        <p>Štítek Podloženo zdrojem znamená oporu ve vašem materiálu. Odvozeno je doplněk navíc. Nic není záhada.</p>
      </div>
    </div>
    <div class="cs-point">
      <img :src="'/icons/resume.png'" alt="" />
      <div>
        <h3>Nesedí to? Jedno kliknutí</h3>
        <p>Novou mapu cílů si necháte navrhnout, kdykoli se vám to hodí. Jednotlivý cíl změníte rovnou na místě.</p>
      </div>
    </div>
  </div>
</div>

<!--
Snímek: krok Mapa cílů, štítky Podloženo zdrojem / Odvozeno a tlačítko
Vygenerovat mapu cílů znovu.
Zdroj: application-screenshots/04-objectives-desktop.png
-->

---

layout: default
kicker: Aktivity
title: Vymýšlení úkolů máte za sebou
lead: Ta nejzdlouhavější část přípravy kurzu je hotová dřív, než se k ní stihnete dostat.
---

<div class="shot-right">
  <div class="cs-points">
    <div class="cs-point">
      <img :src="'/icons/label.png'" alt="" />
      <div>
        <h3>Prázdná stránka odpadá</h3>
        <p>V plánu aktivit už úkoly jsou. I s instrukcemi a s tím, co má studující odevzdat.</p>
      </div>
    </div>
    <div class="cs-point">
      <img :src="'/icons/edit.png'" alt="" />
      <div>
        <h3>Typ úkolu je vybraný za vás</h3>
        <p>Vybavovací kontrola, praktický úkol a další. Vždycky ke schopnosti, kterou má kurz naučit.</p>
      </div>
    </div>
    <div class="cs-point">
      <img :src="'/icons/check.png'" alt="" />
      <div>
        <h3>Doladíte, když budete chtít</h3>
        <p>Nic vás k tomu nenutí. Kurz funguje přesně tak, jak se vygeneroval. Změna je na jedno kliknutí.</p>
      </div>
    </div>
  </div>
  <img class="cs-shot" :src="'/shots/05-activities-desktop-card.png'" alt="Vygenerovaný plán aktivit s typem úkolu a zadáním" />
</div>

<!--
Snímek: krok Plán aktivit, vygenerovaný úkol s typem, instrukcemi a akcí
studujícího. Zdroj: application-screenshots/05-activities-desktop.png
-->

---

layout: default
kicker: Hotový výsledek
title: Kurz vidíte hotový, ještě než ho pošlete dál
lead: Otevřete náhled a projdete si celý kurz přesně tak, jak ho uvidí vaši účastníci.
---

<div class="learner">
  <div class="learner-desk">
    <img class="cs-shot" :src="'/shots/07-preview-desktop-card.png'" alt="Hotový kurz na počítači" />
    <div class="cs-fact learner-note"><img :src="'/icons/check.png'" alt="" /><span>Na počítači sekce, vysvětlení opřené o váš materiál a praktický úkol pod sebou</span></div>
  </div>
  <div class="learner-phone">
    <img class="cs-shot cs-shot--phone" :src="'/shots/09-preview-mobile-card.png'" alt="Hotový kurz v telefonu" />
    <div class="cs-fact learner-note"><img :src="'/icons/phone.png'" alt="" /><span>V telefonu úplně stejný kurz, žádná druhá verze a nic k nastavování</span></div>
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
Zdroje: 07-preview-desktop.png (1440x900), 09-preview-mobile.png (390x844)
-->

---

layout: default
kicker: Nástěnka
title: Všechny kurzy na jednom místě
lead: Otevřete nástěnku a hned vidíte, co máte hotové. Jedno kliknutí a jste zpátky uvnitř kurzu.
---

<div class="shot-left">
  <img class="cs-shot" :src="'/shots/02-dashboard-desktop-card.png'" alt="Nástěnka s přehledem kurzů" />

  <div class="cs-points">
    <div class="cs-point">
      <img :src="'/icons/resume.png'" alt="" />
      <div>
        <h3>Zpátky jedním kliknutím</h3>
        <p>Tlačítko Pokračovat vás vrátí do kurzu tam, kde jste skončili. I po odhlášení a na jiném počítači.</p>
      </div>
    </div>
    <div class="cs-point">
      <img :src="'/icons/layers.png'" alt="" />
      <div>
        <h3>Poznáte kurz bez otevírání</h3>
        <p>U každého kurzu je počet zdrojů, aktivit a částí obsahu. Rozsah vidíte na první pohled.</p>
      </div>
    </div>
    <div class="cs-point">
      <img :src="'/icons/doc.png'" alt="" />
      <div>
        <h3>Nový kurz hned vedle</h3>
        <p>Další kurz začnete přímo z nástěnky. Ukázkové kurzy jsou označené, ať se nepletou s vašimi.</p>
      </div>
    </div>
  </div>
</div>

<!--
Snímek: nástěnka s kartami kurzů, tlačítkem Pokračovat a počty zdrojů,
aktivit a částí obsahu. Zdroj: application-screenshots/02-dashboard-desktop.png
-->

---

layout: end
---

# Odcházíte s hotovým kurzem.

Vložíte materiál, který už máte. Cíle, aktivity, obsah i studentský náhled
zvládne Coursition sám.

<!--
Závěr. Slot ::next:: je zatím prázdný, protože záznam dema ještě neexistuje.
-->
