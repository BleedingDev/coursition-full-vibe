// Builds a PLACEHOLDER voiceover from scenes.config.mjs using macOS `say`,
// then lays the lines out with deterministic gaps into assets/voiceover.mp3
// and writes data/timeline.json (line + scene timings) for the HTML builder.
//
// Replace later with a real founder VO: drop your own assets/voiceover.mp3 and
// a matching data/timeline.json (same shape), or re-run with the same config.
//
// Requires: macOS `say`, ffmpeg, ffprobe.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  GAP_BETWEEN_SCENES,
  GAP_WITHIN_SCENE,
  POST_ROLL,
  PRE_ROLL,
  SCENES,
  SPEAKING_RATE,
  VOICE,
} from '../scenes.config.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const TMP = path.join(ROOT, 'build', 'tts');
const ASSETS = path.join(ROOT, 'assets');
const DATA = path.join(ROOT, 'data');
const SR = 48_000;

fs.rmSync(TMP, { force: true, recursive: true });
fs.mkdirSync(TMP, { recursive: true });
fs.mkdirSync(ASSETS, { recursive: true });
fs.mkdirSync(DATA, { recursive: true });

const sh = (cmd, args) => execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
const probeDuration = (file) =>
  Number.parseFloat(
    sh('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      file,
    ])
      .toString()
      .trim(),
  );

const silence = (seconds) => {
  const out = path.join(TMP, `sil_${Math.round(seconds * 1000)}.wav`);
  if (!fs.existsSync(out)) {
    sh('ffmpeg', [
      '-y',
      '-f',
      'lavfi',
      '-i',
      `anullsrc=r=${SR}:cl=stereo`,
      '-t',
      seconds.toFixed(3),
      '-c:a',
      'pcm_s16le',
      out,
    ]);
  }
  return out;
};

// 1. Synthesize each line and normalize to a uniform WAV.
const flat = [];
for (const [sceneIndex, scene] of SCENES.entries()) {
  for (const line of scene.lines) {
    flat.push({ ...line, scene: scene.id, sceneIndex });
  }
}

console.log(`Synthesizing ${flat.length} lines with voice "${VOICE}"...`);
for (const line of flat) {
  const aiff = path.join(TMP, `${line.id}.aiff`);
  const wav = path.join(TMP, `${line.id}.wav`);
  sh('say', ['-v', VOICE, '-r', String(SPEAKING_RATE), '-o', aiff, line.text]);
  sh('ffmpeg', ['-y', '-i', aiff, '-ar', String(SR), '-ac', '2', '-c:a', 'pcm_s16le', wav]);
  line.wav = wav;
  line.dur = probeDuration(wav);
}

// 2. Lay out the timeline with pre-roll, per-line gaps, post-roll.
const concatParts = [];
const lineTimings = {};
const sceneTimings = {};
let cursor = 0;

const addPart = (file, dur) => {
  concatParts.push(file);
  cursor += dur;
};

addPart(silence(PRE_ROLL), PRE_ROLL);

let prevScene = null;
for (const [index, line] of flat.entries()) {
  if (index > 0) {
    const gap = line.scene === prevScene ? GAP_WITHIN_SCENE : GAP_BETWEEN_SCENES;
    addPart(silence(gap), gap);
  }
  const start = cursor;
  addPart(line.wav, line.dur);
  lineTimings[line.id] = {
    dur: Number(line.dur.toFixed(3)),
    end: Number(cursor.toFixed(3)),
    scene: line.scene,
    start: Number(start.toFixed(3)),
    text: line.text,
  };
  const st = (sceneTimings[line.scene] ??= { end: cursor, lineIds: [], start });
  st.start = Math.min(st.start, start);
  st.end = Math.max(st.end, cursor);
  st.lineIds.push(line.id);
  prevScene = line.scene;
}

addPart(silence(POST_ROLL), POST_ROLL);
const total = cursor;

// 3. Concatenate to a single WAV, then encode to MP3 for the composition.
const listFile = path.join(TMP, 'concat.txt');
fs.writeFileSync(
  listFile,
  concatParts.map((p) => `file '${p.replaceAll("'", "'\\''")}'`).join('\n'),
);
const masterWav = path.join(TMP, 'voiceover.wav');
sh('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c:a', 'pcm_s16le', masterWav]);
const outMp3 = path.join(ASSETS, 'voiceover.mp3');
sh('ffmpeg', ['-y', '-i', masterWav, '-c:a', 'libmp3lame', '-q:a', '3', outMp3]);

const mp3Duration = probeDuration(outMp3);

// 4. Round scene timings and emit timeline.json.
for (const id of Object.keys(sceneTimings)) {
  sceneTimings[id].start = Number(sceneTimings[id].start.toFixed(3));
  sceneTimings[id].end = Number(sceneTimings[id].end.toFixed(3));
}

const timeline = {
  audio: 'assets/voiceover.mp3',
  audioDuration: Number(mp3Duration.toFixed(3)),
  lines: lineTimings,
  sceneOrder: SCENES.map((s) => s.id),
  scenes: sceneTimings,
  total: Number(total.toFixed(3)),
  voice: VOICE,
};
fs.writeFileSync(path.join(DATA, 'timeline.json'), `${JSON.stringify(timeline, null, 2)}\n`);

console.log('\nTimeline:');
for (const s of SCENES) {
  const st = sceneTimings[s.id];
  console.log(`  ${s.id.padEnd(12)} ${st.start.toFixed(2)}s -> ${st.end.toFixed(2)}s`);
}
console.log(`\nvoiceover.mp3: ${mp3Duration.toFixed(2)}s | layout total: ${total.toFixed(2)}s`);
console.log('Wrote assets/voiceover.mp3 and data/timeline.json');
