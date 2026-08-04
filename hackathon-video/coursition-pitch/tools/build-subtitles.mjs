// Emits coursition-pitch.en.srt from data/timeline.json — a real, toggleable
// subtitle track (NOT burned into the frame). Muxed in by tools/mux-subs.mjs.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCENES } from '../scenes.config.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { lines } = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'timeline.json'), 'utf8'));

const ts = (sec) => {
  const ms = Math.max(0, Math.round(sec * 1000));
  const h = String(Math.floor(ms / 3600000)).padStart(2, '0');
  const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, '0');
  const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0');
  const milli = String(ms % 1000).padStart(3, '0');
  return `${h}:${m}:${s},${milli}`;
};

const ordered = SCENES.flatMap((scene) => scene.lines.map((ln) => ln.id)).filter((id) => lines[id]);

const srt = ordered
  .map((id, i) => {
    const ln = lines[id];
    return `${i + 1}\n${ts(ln.start)} --> ${ts(ln.end + 0.15)}\n${ln.text}\n`;
  })
  .join('\n');

fs.writeFileSync(path.join(ROOT, 'coursition-pitch.en.srt'), `${srt}\n`);
console.log(`Wrote coursition-pitch.en.srt (${ordered.length} cues).`);
