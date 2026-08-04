// Builds slides.html — a print-ready 16:9 deck that mirrors the video's design
// (shared tools/design.mjs). The demo scene expands into one slide per product
// screenshot. Render to PDF with: npm run pdf
//
// Each .slide is exactly 1920×1080 and maps to one PDF page (@page size).

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCENES } from '../scenes.config.mjs';
import { CSS, esc, mark, RENDERERS } from './design.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Downscale screenshots to lightweight JPEGs for the deck (keeps the PDF small;
// the video still uses the full-res PNGs in assets/screens).
const PRINT_DIR = path.join(ROOT, 'assets', 'screens-print');
fs.mkdirSync(PRINT_DIR, { recursive: true });
const printShot = (png) => {
  const jpg = png.replace(/\.png$/iu, '.jpg');
  const src = path.join(ROOT, 'assets', 'screens', png);
  const dst = path.join(PRINT_DIR, jpg);
  if (fs.existsSync(src) && !fs.existsSync(dst)) {
    execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '82', '-Z', '1632', src, '--out', dst], { stdio: 'ignore' });
  }
  return `assets/screens-print/${jpg}`;
};

const demoSlide = (s, ln, i, n) => `
  <div class="demo-wrap">
    <div class="demo-head">
      <span class="h">${mark(s.headline)}</span>
      <span class="e">${i + 1} / ${n} · ${esc(ln.label)}</span>
    </div>
    <div class="browser">
      <div class="browser-bar">
        <span class="dots"><i></i><i></i><i></i></span>
        <span class="url">localhost:8080 — Coursition</span>
        <span class="steplabel"><b>0${i + 1}/0${n}</b>${esc(ln.label)}</span>
      </div>
      <div class="browser-view">
        <div class="shot" style="background-image:url('${printShot(ln.shot)}')"></div>
      </div>
    </div>
  </div>`;

// Expand scenes into slides (demo -> one per screenshot).
const slides = [];
for (const s of SCENES) {
  if (s.type === 'demo') {
    s.lines.forEach((ln, i) => slides.push({ section: s.section, inner: demoSlide(s, ln, i, s.lines.length) }));
  } else {
    slides.push({ section: s.section, inner: RENDERERS[s.type](s) });
  }
}

const total = slides.length;
const pad = (n) => String(n).padStart(2, '0');

const slideHtml = (slide, idx) => `
    <section class="slide">
      <div class="bg-lines"></div>
      ${slide.inner}
      <div class="chrome">
        <div class="hr hr-top"></div>
        <div class="hr hr-bot"></div>
        <div class="bar bar-top">
          <span class="brand"><b>●</b> COURSITION</span>
          <span style="color:var(--paper)">${esc(slide.section)}</span>
        </div>
        <div class="bar bar-bot">
          <span>Course preparation engine</span>
          <span><span class="tick">●</span>&nbsp;&nbsp;${pad(idx + 1)} / ${pad(total)}</span>
        </div>
      </div>
      <div class="grain"></div>
    </section>`;

const SLIDE_CSS = String.raw`
      @page { size: 1920px 1080px; margin: 0; }
      html, body { width: 1920px; height: auto; overflow: visible; background: var(--ink); }
      .slide { position: relative; width: 1920px; height: 1080px; overflow: hidden;
        display: flex; flex-direction: column; align-items: flex-start; justify-content: center;
        padding: 150px 152px;
        background: radial-gradient(1500px 1000px at 70% 8%, #19150f 0%, var(--ink) 60%), var(--ink);
        break-after: page; page-break-after: always; }
      .slide:last-child { break-after: auto; page-break-after: auto; }
      /* reveal everything (no GSAP in print) */
      .slide .swipe { transform: scaleX(1) !important; }
      .slide .shot { opacity: 1 !important; }
      .slide .steplabel { opacity: 1 !important; }
      .slide .scene { position: static; opacity: 1; padding: 0; }
      @media print { html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
`;

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Coursition — pitch deck</title>
    <!-- Fonts for print (the video relies on the HyperFrames renderer to bundle these). -->
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=EB+Garamond:ital,wght@0,500;1,500&family=Space+Mono:wght@400;700&display=swap"
      rel="stylesheet"
    />
    <style>
${CSS}
${SLIDE_CSS}
    </style>
  </head>
  <body>
${slides.map((s, i) => slideHtml(s, i)).join('\n')}
  </body>
</html>
`;

fs.writeFileSync(path.join(ROOT, 'slides.html'), html);
console.log(`Wrote slides.html (${total} slides).`);
