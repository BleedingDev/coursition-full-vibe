// Builds the voiceover from scenes.config.mjs and writes assets/voiceover.mp3
// + data/timeline.json (per-line + per-scene timings) for the HTML/subtitle builders.
//
// BOSON path (recommended): the WHOLE narration is one continuous synthesis call
// — a single, consistent voice — then per-line timing is recovered by force-aligning
// the known line text to Whisper word timestamps (hyperframes transcribe).
// SAY path (fallback): per-line synthesis with deterministic gaps.
//
// Provider (scenes.config.mjs TTS.provider or TTS_PROVIDER env): boson | say | auto.
// Requires: ffmpeg, ffprobe (+ macOS `say` for fallback). Boson needs BOSON_API_KEY.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  GAP_BETWEEN_SCENES,
  GAP_WITHIN_SCENE,
  POST_ROLL,
  PRE_ROLL,
  SCENES,
  TTS,
} from '../scenes.config.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TMP = path.join(ROOT, 'build', 'tts');
const ASSETS = path.join(ROOT, 'assets');
const DATA = path.join(ROOT, 'data');
const SR = 48000;

for (const file of [path.join(ROOT, '.env.local'), path.resolve(ROOT, '../../.env.local')]) {
  if (!fs.existsSync(file)) continue;
  for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = raw.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/u);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

const sh = (cmd, args) => execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
const shOut = (cmd, args) =>
  execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const probeDuration = (file) =>
  Number.parseFloat(
    sh('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', file]).toString().trim(),
  );

const resolveProvider = () => {
  const key = process.env.BOSON_API_KEY;
  if (TTS.provider === 'boson') {
    if (!key) throw new Error('TTS.provider=boson but BOSON_API_KEY is not set (env or .env.local).');
    return 'boson';
  }
  if (TTS.provider === 'say') return 'say';
  return key ? 'boson' : 'say';
};

const silence = (seconds) => {
  const out = path.join(TMP, `sil_${Math.round(seconds * 1000)}.wav`);
  if (!fs.existsSync(out)) {
    sh('ffmpeg', ['-y', '-f', 'lavfi', '-i', `anullsrc=r=${SR}:cl=stereo`, '-t', seconds.toFixed(3), '-c:a', 'pcm_s16le', out]);
  }
  return out;
};

const toMp3 = (inFile, outMp3) => sh('ffmpeg', ['-y', '-i', inFile, '-c:a', 'libmp3lame', '-q:a', '3', outMp3]);
const concatWav = (parts, outWav) => {
  const list = path.join(TMP, 'concat.txt');
  fs.writeFileSync(list, parts.map((p) => `file '${p.replaceAll("'", "'\\''")}'`).join('\n'));
  sh('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', list, '-c:a', 'pcm_s16le', outWav]);
};

const bosonSynth = async (text, outRaw) => {
  const res = await fetch(TTS.bosonEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.BOSON_API_KEY}` },
    body: JSON.stringify({
      input: text,
      model: TTS.bosonModel,
      voice: process.env.BOSON_TTS_VOICE || TTS.bosonVoice,
      response_format: 'wav',
      stream: false,
    }),
  });
  const ctype = res.headers.get('content-type') || '';
  if (!res.ok || ctype.includes('application/json')) {
    throw new Error(`Boson TTS failed (${res.status}): ${await res.text()}`);
  }
  fs.writeFileSync(outRaw, Buffer.from(await res.arrayBuffer()));
};

// Force-align known line text to Whisper word timestamps by anchoring each line
// on its first word(s) with a forward-only cursor (robust to "two thousand"->"2000").
const lev = (a, b) => {
  const m = a.length;
  const n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
};
// Equal allowing small ASR drift on long words (e.g. "coursition" vs "coercision").
const eq = (x, y) => x === y || (x.length >= 6 && y.length >= 6 && lev(x, y) <= 3);

const alignLines = (flat, words, offset) => {
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/gu, '');
  const W = words.map((w) => ({ t: norm(w.text), start: w.start, end: w.end }));
  const anchors = [];
  let cursor = 0;
  for (const line of flat) {
    const lw = line.text.split(/\s+/u).map(norm).filter(Boolean);
    let found = -1;
    for (const aLen of [Math.min(3, lw.length), 2, 1]) {
      for (let p = cursor; p <= W.length - aLen; p++) {
        let ok = true;
        for (let k = 0; k < aLen; k++) if (!eq(W[p + k].t, lw[k])) { ok = false; break; }
        if (ok) { found = p; break; }
      }
      if (found >= 0) break;
    }
    anchors.push(found);
    if (found >= 0) cursor = found + 1;
  }
  const timings = {};
  for (let i = 0; i < flat.length; i++) {
    const idx = anchors[i];
    let nextIdx = -1;
    for (let j = i + 1; j < flat.length; j++) if (anchors[j] >= 0) { nextIdx = anchors[j]; break; }
    const start = idx >= 0 ? W[idx].start : (i > 0 ? timings[flat[i - 1].id].end - offset : 0);
    const end = nextIdx >= 0 ? W[nextIdx - 1].end : W[W.length - 1].end;
    timings[flat[i].id] = {
      scene: flat[i].scene,
      start: Number((start + offset).toFixed(3)),
      end: Number((end + offset).toFixed(3)),
      dur: Number((end - start).toFixed(3)),
      text: flat[i].text,
    };
  }
  return timings;
};

const main = async () => {
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });
  fs.mkdirSync(ASSETS, { recursive: true });
  fs.mkdirSync(DATA, { recursive: true });

  const provider = resolveProvider();
  const flat = [];
  SCENES.forEach((scene) => scene.lines.forEach((line) => flat.push({ ...line, scene: scene.id })));
  const voiceName = provider === 'boson' ? (process.env.BOSON_TTS_VOICE || TTS.bosonVoice) : TTS.sayVoice;
  const outMp3 = path.join(ASSETS, 'voiceover.mp3');
  let lineTimings;

  if (provider === 'boson') {
    console.log(`Synthesizing ONE continuous take via boson (voice "${voiceName}") for a single consistent voice...`);
    const fullText = flat.map((l) => l.text).join(' ');
    const rawWav = path.join(TMP, 'boson.raw.wav');
    await bosonSynth(fullText, rawWav);
    const normWav = path.join(TMP, 'boson.wav');
    sh('ffmpeg', ['-y', '-i', rawWav, '-ar', String(SR), '-ac', '2', '-c:a', 'pcm_s16le', normWav]);

    console.log('Aligning lines with Whisper word timestamps...');
    const meta = JSON.parse(shOut('npx', ['--yes', 'hyperframes@0.6.79', 'transcribe', normWav, '--json']));
    const words = JSON.parse(fs.readFileSync(meta.transcriptPath, 'utf8'));
    lineTimings = alignLines(flat, words, PRE_ROLL);

    // master = pre-roll + narration + post-roll
    concatWav([silence(PRE_ROLL), normWav, silence(POST_ROLL)], path.join(TMP, 'master.wav'));
    toMp3(path.join(TMP, 'master.wav'), outMp3);

    const matched = Object.values(lineTimings).filter((t) => t.dur > 0).length;
    console.log(`Aligned ${matched}/${flat.length} lines (${words.length} words).`);
  } else {
    console.log(`Synthesizing ${flat.length} lines via say (voice "${voiceName}")...`);
    for (const line of flat) {
      const aiff = path.join(TMP, `${line.id}.aiff`);
      const wav = path.join(TMP, `${line.id}.wav`);
      sh('say', ['-v', TTS.sayVoice, '-r', String(TTS.sayRate), '-o', aiff, line.text]);
      sh('ffmpeg', ['-y', '-i', aiff, '-ar', String(SR), '-ac', '2', '-c:a', 'pcm_s16le', wav]);
      line.wav = wav;
      line.dur = probeDuration(wav);
    }
    const parts = [silence(PRE_ROLL)];
    let cursor = PRE_ROLL;
    lineTimings = {};
    let prevScene = null;
    flat.forEach((line, i) => {
      if (i > 0) {
        const gap = line.scene === prevScene ? GAP_WITHIN_SCENE : GAP_BETWEEN_SCENES;
        parts.push(silence(gap));
        cursor += gap;
      }
      const start = cursor;
      parts.push(line.wav);
      cursor += line.dur;
      lineTimings[line.id] = { scene: line.scene, start: Number(start.toFixed(3)), end: Number(cursor.toFixed(3)), dur: Number(line.dur.toFixed(3)), text: line.text };
      prevScene = line.scene;
    });
    parts.push(silence(POST_ROLL));
    concatWav(parts, path.join(TMP, 'master.wav'));
    toMp3(path.join(TMP, 'master.wav'), outMp3);
  }

  // Scene timings from line timings.
  const sceneTimings = {};
  for (const line of flat) {
    const t = lineTimings[line.id];
    const st = (sceneTimings[line.scene] ??= { start: t.start, end: t.end, lineIds: [] });
    st.start = Math.min(st.start, t.start);
    st.end = Math.max(st.end, t.end);
    st.lineIds.push(line.id);
  }
  for (const id of Object.keys(sceneTimings)) {
    sceneTimings[id].start = Number(sceneTimings[id].start.toFixed(3));
    sceneTimings[id].end = Number(sceneTimings[id].end.toFixed(3));
  }

  const mp3Duration = probeDuration(outMp3);
  fs.writeFileSync(
    path.join(DATA, 'timeline.json'),
    `${JSON.stringify({
      provider,
      voice: voiceName,
      audio: 'assets/voiceover.mp3',
      total: Number(mp3Duration.toFixed(3)),
      audioDuration: Number(mp3Duration.toFixed(3)),
      lines: lineTimings,
      scenes: sceneTimings,
      sceneOrder: SCENES.map((s) => s.id),
    }, null, 2)}\n`,
  );

  console.log('\nTimeline:');
  for (const s of SCENES) {
    const st = sceneTimings[s.id];
    console.log(`  ${s.id.padEnd(12)} ${st.start.toFixed(2)}s -> ${st.end.toFixed(2)}s`);
  }
  console.log(`\nvoiceover.mp3: ${mp3Duration.toFixed(2)}s (${provider}/${voiceName})`);
};

main().catch((err) => { console.error(err.message || err); process.exit(1); });
