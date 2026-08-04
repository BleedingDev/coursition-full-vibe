// Generates the static HyperFrames composition (index.html) from
// scenes.config.mjs + data/timeline.json. Deterministic: timings baked in,
// no runtime fetch, no Date/Math.random. Captions are NOT burned in — they
// ship as a soft, toggleable subtitle track (see tools/build-subtitles.mjs).
//
// Design system + scene renderers live in tools/design.mjs (shared with the deck).
// Run after build-voiceover.mjs:  node tools/build-html.mjs   (npm run build does both)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCENES } from '../scenes.config.mjs';
import { CSS, esc, RENDERERS } from './design.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const timeline = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'timeline.json'), 'utf8'));
const { lines: L, scenes: ST, total } = timeline;
const sceneById = Object.fromEntries(SCENES.map((s) => [s.id, s]));

const sceneSections = SCENES.map(
  (s) => `    <section class="scene" id="scene-${s.id}" data-type="${s.type}">
${RENDERERS[s.type](s)}
    </section>`,
).join('\n');

const sectionLabels = SCENES.map(
  (s) => `        <span class="seclabel" data-scene="${s.id}">${esc(s.section)}</span>`,
).join('\n');

const animData = {
  total,
  scenes: SCENES.map((s) => ({ id: s.id, start: ST[s.id].start, end: ST[s.id].end })),
  demoOrder: (sceneById.demo?.lines ?? []).map((ln) => ln.id),
  demoLines: Object.fromEntries(
    (sceneById.demo?.lines ?? []).map((ln) => [ln.id, { start: L[ln.id].start }]),
  ),
  demoEnd: ST.demo?.end ?? 0,
};

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
${CSS}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${total.toFixed(3)}" data-width="1920" data-height="1080">
      <div class="bg"><div class="bg-lines"></div></div>

${sceneSections}

      <div class="chrome">
        <div class="hr hr-top"></div>
        <div class="hr hr-bot"></div>
        <div class="bar bar-top">
          <span class="brand"><b>●</b> COURSITION</span>
          <span class="sections">
${sectionLabels}
          </span>
        </div>
        <div class="bar bar-bot">
          <span>Course preparation engine</span>
          <span class="tick">●</span>
        </div>
      </div>

      <div class="grain"></div>

      <!-- PLACEHOLDER voiceover. Swap assets/voiceover.mp3 for the real (Boson) VO. -->
      <audio id="vo" class="clip" src="assets/voiceover.mp3" data-start="0"
        data-duration="${(timeline.audioDuration ?? total).toFixed(3)}" data-track-index="9" data-volume="1"></audio>
    </div>

    <script>
      window.__timelines = window.__timelines || {};
      const D = ${JSON.stringify(animData)};
      const tl = gsap.timeline({ paused: true });
      const OW = 'auto', LEAD = 0.35, TAIL = 0.22;

      D.scenes.forEach((sc, i) => {
        const el = '#scene-' + sc.id;
        const inAt = Math.max(0, sc.start - LEAD);
        tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.32, ease: 'power2.out', overwrite: OW }, inAt);
        tl.from(el + ' .ri', { yPercent: 70, opacity: 0, duration: 0.6, stagger: 0.09, ease: 'power4.out', overwrite: OW }, inAt + 0.04);
        tl.from(el + ' .r', { y: 26, opacity: 0, duration: 0.5, stagger: 0.07, ease: 'power3.out', overwrite: OW }, inAt + 0.14);
        tl.fromTo(el + ' .swipe', { scaleX: 0 }, { scaleX: 1, duration: 0.5, ease: 'expo.out', transformOrigin: 'left center', stagger: 0.08, overwrite: OW }, inAt + 0.4);
        const sl = '.seclabel[data-scene="' + sc.id + '"]';
        tl.fromTo(sl, { opacity: 0 }, { opacity: 1, duration: 0.3, overwrite: OW }, inAt);
        if (i < D.scenes.length - 1) {
          tl.to(el, { opacity: 0, duration: 0.3, ease: 'power2.in', overwrite: OW }, sc.end + TAIL);
          tl.to(sl, { opacity: 0, duration: 0.25, overwrite: OW }, sc.end + TAIL);
        }
      });

      // Demo: crossfade the five real screenshots + step labels in sync with the VO.
      D.demoOrder.forEach((id, i) => {
        const shot = '.shot[data-line="' + id + '"]';
        const lab = '.steplabel[data-line="' + id + '"]';
        const start = D.demoLines[id].start;
        const nextId = D.demoOrder[i + 1];
        const outAt = nextId ? D.demoLines[nextId].start - 0.18 : D.demoEnd + 0.25;
        tl.fromTo(shot, { opacity: 0, scale: 1.02 }, { opacity: 1, scale: 1, duration: 0.4, ease: 'power2.out', overwrite: OW }, Math.max(0, start - 0.18));
        tl.fromTo(lab, { opacity: 0 }, { opacity: 1, duration: 0.28, overwrite: OW }, Math.max(0, start - 0.18));
        if (nextId) {
          tl.to(shot, { opacity: 0, duration: 0.35, ease: 'power1.in', overwrite: OW }, outAt);
          tl.to(lab, { opacity: 0, duration: 0.25, overwrite: OW }, outAt);
          tl.set(shot, { opacity: 0 }, outAt + 0.35);
        }
      });

      // Pin composition length to the full voiceover. Must target a real element
      // (an empty-object set does not extend the GSAP timeline duration).
      tl.set('.bg', { opacity: 1 }, D.total);
      window.__timelines['main'] = tl;
    </script>
  </body>
</html>
`;

fs.writeFileSync(path.join(ROOT, 'index.html'), html);
console.log(`Wrote index.html (${SCENES.length} scenes, ${total.toFixed(2)}s).`);
