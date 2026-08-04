// Shared design system for the Coursition pitch — used by BOTH the video
// (tools/build-html.mjs) and the slide deck (tools/build-slides.mjs).
//
// Dark editorial "red-pen / study-notes". Fonts the HyperFrames renderer bundles
// deterministically: Oswald (display), EB Garamond (serif voice), Space Mono
// (labels). Never set font-family via CSS var() — the renderer can't follow it.

export const esc = (s) =>
  String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

// «word» -> red marker-underline span.
export const mark = (s) =>
  esc(s).replaceAll(/«([^»]+)»/gu, '<span class="mark">$1<i class="swipe"></i></span>');

// Big headline lines with a translate/opacity reveal (class "ri").
export const bigLines = (arr) =>
  (Array.isArray(arr) ? arr : [arr])
    .map((line) => `<span class="rl"><span class="ri">${mark(line)}</span></span>`)
    .join('');

export const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

// Design tokens + component styles. Excludes nothing video-specific that would
// break print; the slide builder simply reveals .swipe and lays scenes per page.
export const CSS = String.raw`
      :root {
        --ink: #0c0b0a;
        --ink2: #15120e;
        --paper: #f1e9da;
        --muted: #8d8676;
        --faint: rgba(241, 233, 218, 0.14);
        --hair: rgba(241, 233, 218, 0.16);
        --red: #ff3b27;
        --display: Oswald, sans-serif;
        --serif: "EB Garamond", serif;
        --mono: "Space Mono", monospace;
      }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: 1920px; height: 1080px; overflow: hidden; background: var(--ink); color: var(--paper); }
      #root { position: relative; width: 1920px; height: 1080px; overflow: hidden; font-family: Oswald, sans-serif; }

      /* ---- atmosphere ---- */
      .bg { position: absolute; inset: 0; z-index: 0; background:
        radial-gradient(1500px 1000px at 70% 8%, #19150f 0%, var(--ink) 60%),
        var(--ink); }
      .bg-lines { position: absolute; inset: 0; opacity: 0.5;
        background-image: repeating-linear-gradient(0deg, transparent 0 63px, rgba(241,233,218,0.028) 63px 64px);
        -webkit-mask-image: linear-gradient(180deg, transparent, #000 18%, #000 82%, transparent);
                mask-image: linear-gradient(180deg, transparent, #000 18%, #000 82%, transparent); }
      .grain { position: absolute; inset: 0; z-index: 6; pointer-events: none;
        opacity: 0.05; mix-blend-mode: soft-light; background-image: ${GRAIN}; background-size: 180px 180px; }

      /* ---- persistent editorial frame ---- */
      .chrome { position: absolute; inset: 0; z-index: 5; pointer-events: none; }
      .chrome .hr { position: absolute; left: 150px; right: 150px; height: 1px; background: var(--hair); }
      .chrome .hr-top { top: 92px; }
      .chrome .hr-bot { bottom: 92px; }
      .chrome .bar { position: absolute; left: 150px; right: 150px; display: flex; justify-content: space-between; align-items: center;
        font-family: "Space Mono", monospace; font-size: 17px; letter-spacing: 0.24em; text-transform: uppercase; color: var(--muted); }
      .chrome .bar-top { top: 54px; }
      .chrome .bar-bot { bottom: 54px; }
      .chrome .brand { color: var(--paper); }
      .chrome .brand b { color: var(--red); font-weight: 400; }
      .chrome .sections { position: relative; height: 18px; min-width: 320px; text-align: right; }
      .chrome .seclabel { position: absolute; right: 0; top: 0; opacity: 0; color: var(--paper); }
      .chrome .tick { color: var(--red); }

      /* ---- scene shell (left-aligned, editorial) ---- */
      .scene { position: absolute; inset: 0; z-index: 2; opacity: 0;
        display: flex; flex-direction: column; align-items: flex-start; justify-content: center;
        padding: 150px 152px 150px 152px; }
      .stack { display: flex; flex-direction: column; align-items: flex-start; text-align: left; gap: 30px; max-width: 1610px; }
      .rl { display: block; overflow: visible; }
      .ri { display: inline-block; }
      .eyebrow { font-family: "Space Mono", monospace; font-size: 21px; letter-spacing: 0.26em; text-transform: uppercase; color: var(--muted); }
      .eyebrow::before { content: "●  "; color: var(--red); }

      .mark { position: relative; white-space: nowrap; }
      .mark .swipe { position: absolute; left: -0.02em; right: -0.02em; bottom: 0.04em; height: 0.1em;
        background: var(--red); transform: scaleX(0); transform-origin: left center; }

      h1.display { font-family: Oswald, sans-serif; font-weight: 700; text-transform: uppercase;
        line-height: 0.95; letter-spacing: -0.005em; color: var(--paper); }
      .xl { font-size: 150px; }
      .lg { font-size: 100px; }
      .md { font-size: 86px; }
      .serif-em { font-family: "EB Garamond", serif; font-style: italic; font-weight: 500; text-transform: none;
        color: var(--red); letter-spacing: 0; line-height: 1.02; }

      /* ---- positioning ---- */
      .rivals { font-family: "EB Garamond", serif; font-size: 44px; color: var(--muted); line-height: 1.2; }
      .rivals .rl-label { font-family: "Space Mono", monospace; font-size: 18px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--muted); }
      .pipe { display: flex; align-items: center; gap: 16px; font-family: "Space Mono", monospace; font-size: 23px; color: var(--paper); margin-top: 8px; }
      .pipe .seg { padding: 12px 0; border-bottom: 2px solid var(--faint); }
      .pipe .arrow { color: var(--red); font-family: Oswald, sans-serif; font-size: 26px; }

      /* ---- fight ---- */
      .contrast { display: flex; flex-direction: column; gap: 16px; margin-top: 10px; }
      .crow { display: flex; align-items: center; gap: 22px; font-family: "Space Mono", monospace; font-size: 30px; }
      .crow .cmark { width: 46px; height: 46px; display: grid; place-items: center; font-size: 26px; border: 1.5px solid var(--faint); }
      .crow.bad { color: var(--muted); }
      .crow.bad .lbl { text-decoration: line-through; text-decoration-color: var(--red); text-decoration-thickness: 2px; }
      .crow.bad .cmark { color: var(--red); }
      .crow.good { color: var(--paper); }
      .crow.good .cmark { color: var(--red); border-color: var(--red); }

      /* ---- engines (numbered editorial row) ---- */
      .list { display: flex; gap: 26px; margin-top: 14px; }
      .item { display: flex; flex-direction: column; gap: 12px; max-width: 300px; }
      .item .num { font-family: "Space Mono", monospace; font-size: 20px; color: var(--red); letter-spacing: 0.1em; }
      .item .num::after { content: ""; display: block; width: 34px; height: 2px; background: var(--red); margin-top: 10px; }
      .item .lab { font-family: Oswald, sans-serif; text-transform: uppercase; font-weight: 500; font-size: 27px; line-height: 1.04; color: var(--paper); }
      .note { font-family: "EB Garamond", serif; font-style: italic; font-size: 28px; color: var(--muted); margin-top: 8px; }

      /* ---- demo ---- */
      .demo-wrap { display: flex; flex-direction: column; align-items: center; gap: 20px; width: 100%; }
      .demo-head { width: 100%; max-width: 1216px; display: flex; align-items: baseline; justify-content: space-between; }
      .demo-head .h { font-family: Oswald, sans-serif; text-transform: uppercase; font-weight: 600; font-size: 40px; color: var(--paper); }
      .demo-head .e { font-family: "Space Mono", monospace; font-size: 17px; letter-spacing: 0.24em; text-transform: uppercase; color: var(--muted); }
      .demo-head .e::before { content: "●  "; color: var(--red); }
      .browser { width: 1216px; overflow: hidden; background: var(--ink2); border: 1px solid var(--hair);
        box-shadow: 0 40px 90px rgba(0,0,0,0.55); }
      .browser-bar { position: relative; height: 52px; display: flex; align-items: center; gap: 14px; padding: 0 20px;
        background: rgba(241,233,218,0.04); border-bottom: 1px solid var(--hair); }
      .browser-bar .dots { display: flex; gap: 8px; }
      .browser-bar .dots i { width: 11px; height: 11px; border-radius: 50%; background: #4a4338; }
      .browser-bar .url { font-family: "Space Mono", monospace; font-size: 16px; color: var(--muted); padding: 6px 14px; background: rgba(0,0,0,0.28); }
      .browser-bar .steplabel { position: absolute; right: 20px; top: 50%; transform: translateY(-50%);
        font-family: "Space Mono", monospace; font-size: 16px; letter-spacing: 0.06em; color: var(--paper); opacity: 0; }
      .browser-bar .steplabel b { color: var(--red); margin-right: 10px; }
      .browser-view { position: relative; width: 100%; height: 760px; background: var(--ink); }
      .shot { position: absolute; inset: 0; background-size: cover; background-position: top center; opacity: 0; }

      /* ---- result ---- */
      .next { display: flex; gap: 0; margin-top: 16px; }
      .next .item2 { display: flex; align-items: baseline; gap: 16px; padding: 0 34px; border-left: 1px solid var(--hair); }
      .next .item2:first-child { padding-left: 0; border-left: 0; }
      .next .item2 .t { font-family: "Space Mono", monospace; font-size: 24px; color: var(--paper); }
      .next .item2 .c { color: var(--red); font-family: Oswald, sans-serif; font-size: 26px; }

      /* ---- close ---- */
      .close-wrap { display: flex; flex-direction: column; align-items: flex-start; gap: 22px; }
      .wordmark { font-family: Oswald, sans-serif; font-weight: 700; font-size: 176px; line-height: 0.9; text-transform: uppercase; color: var(--paper); }
      .tagline { font-family: "EB Garamond", serif; font-style: italic; font-size: 40px; color: var(--muted); max-width: 1200px; line-height: 1.25; }
`;

// Per-type scene markup (inner content only). "ri" = big reveal lines, "r" = secondary.
export const RENDERERS = {
  hook: (s) => `
  <div class="stack">
    <div class="eyebrow r">${esc(s.eyebrow)}</div>
    <h1 class="display xl">${bigLines(s.title)}</h1>
  </div>`,
  positioning: (s) => `
  <div class="stack">
    <div class="eyebrow r">${esc(s.eyebrow)}</div>
    <div class="rivals r"><span class="rl-label">${esc(s.rivalsLabel)}</span><br/>${esc(s.rivals)}</div>
    <h1 class="display lg">${bigLines(s.headline)}</h1>
    <div class="pipe r">
      ${s.pipeline.map((p, i) => `<span class="seg">${esc(p)}</span>${i < s.pipeline.length - 1 ? '<span class="arrow">→</span>' : ''}`).join('')}
    </div>
  </div>`,
  fight: (s) => `
  <div class="stack">
    <div class="eyebrow r">${esc(s.eyebrow)}</div>
    <h1 class="display md">${bigLines(s.headline)}<span class="rl"><span class="ri serif-em">${mark(s.em)}</span></span></h1>
    <div class="contrast">
      ${s.contrast
        .map((c) => `<div class="crow ${c.tone} r"><span class="cmark">${esc(c.mark)}</span><span class="lbl">${esc(c.label)}</span></div>`)
        .join('')}
    </div>
  </div>`,
  engines: (s) => `
  <div class="stack">
    <div class="eyebrow r">${esc(s.eyebrow)}</div>
    <h1 class="display md">${bigLines(s.headline)}</h1>
    <div class="list">
      ${s.engines
        .map((e, i) => `<div class="item r"><span class="num">0${i + 1}</span><span class="lab">${esc(e)}</span></div>`)
        .join('')}
    </div>
  </div>`,
  demo: (s) => `
  <div class="demo-wrap">
    <div class="demo-head r">
      <span class="h">${mark(s.headline)}</span>
      <span class="e">${esc(s.eyebrow)}</span>
    </div>
    <div class="browser r">
      <div class="browser-bar">
        <span class="dots"><i></i><i></i><i></i></span>
        <span class="url">localhost:8080 — Coursition</span>
        ${s.lines.map((ln, i) => `<span class="steplabel" data-line="${ln.id}"><b>0${i + 1}/0${s.lines.length}</b>${esc(ln.label)}</span>`).join('')}
      </div>
      <div class="browser-view">
        ${s.lines.map((ln) => `<div class="shot" data-line="${ln.id}" style="background-image:url('assets/screens/${ln.shot}')"></div>`).join('')}
      </div>
    </div>
  </div>`,
  result: (s) => `
  <div class="stack">
    <div class="eyebrow r">${esc(s.eyebrow)}</div>
    <h1 class="display lg">${bigLines(s.title)}<span class="rl"><span class="ri serif-em">${mark(s.em)}</span></span></h1>
    <div class="next">
      ${s.next.map((n) => `<div class="item2 r"><span class="c">→</span><span class="t">${esc(n)}</span></div>`).join('')}
    </div>
  </div>`,
  close: (s) => `
  <div class="close-wrap">
    <div class="wordmark"><span class="rl"><span class="ri">${esc(s.wordmark)}<i class="swipe" style="height:0.05em;bottom:0.02em"></i></span></span></div>
    <div class="tagline r">${esc(s.tagline)}</div>
  </div>`,
};
