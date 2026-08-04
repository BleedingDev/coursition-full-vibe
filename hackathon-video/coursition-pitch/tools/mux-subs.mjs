// Muxes coursition-pitch.en.srt into coursition-pitch.mp4 as a soft, toggleable
// subtitle track (mov_text). Run after `npm run render`.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const video = path.join(ROOT, 'coursition-pitch.mp4');
const srt = path.join(ROOT, 'coursition-pitch.en.srt');
const tmp = path.join(ROOT, 'build', 'coursition-pitch.subbed.mp4');

for (const f of [video, srt]) {
  if (!fs.existsSync(f)) {
    console.error(`Missing ${path.basename(f)} — run "npm run render" and "npm run subs" first.`);
    process.exit(1);
  }
}
fs.mkdirSync(path.dirname(tmp), { recursive: true });

execFileSync(
  'ffmpeg',
  [
    '-y', '-i', video, '-i', srt,
    '-map', '0:v:0', '-map', '0:a:0?', '-map', '1:0',
    '-c:v', 'copy', '-c:a', 'copy', '-c:s', 'mov_text',
    '-metadata:s:s:0', 'language=eng', '-metadata:s:s:0', 'title=English',
    '-disposition:s:0', '0',
    tmp,
  ],
  { stdio: ['ignore', 'pipe', 'pipe'] },
);
fs.renameSync(tmp, video);
console.log('Muxed soft English subtitles into coursition-pitch.mp4 (toggleable).');
