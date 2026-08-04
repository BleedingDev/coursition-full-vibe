// Renders slides.html to a pixel-accurate 16:9 PDF (one slide per page) using
// system Chrome's DevTools Protocol (Page.printToPDF). Zero npm dependencies.
//
//   node tools/print-pdf.mjs [output.pdf]   (npm run pdf builds slides first)

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INPUT = path.join(ROOT, 'slides.html');
const OUTPUT = path.resolve(ROOT, process.argv[2] || 'coursition-pitch-deck.pdf');
const PORT = 9333;
const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ...fs.existsSync(path.join(os.homedir(), '.cache/puppeteer/chrome'))
    ? fs.readdirSync(path.join(os.homedir(), '.cache/puppeteer/chrome'))
        .map((d) => path.join(os.homedir(), '.cache/puppeteer/chrome', d, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'))
    : [],
];
const CHROME = CHROME_CANDIDATES.find((p) => fs.existsSync(p));
if (!CHROME) throw new Error('No Chrome binary found.');
if (!fs.existsSync(INPUT)) throw new Error('slides.html missing — run npm run slides first.');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hf-pdf-'));
const proc = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--allow-file-access-from-files', `--remote-debugging-port=${PORT}`, `--user-data-dir=${userDir}`,
  'about:blank',
], { stdio: 'ignore' });

const cleanup = () => { try { proc.kill('SIGKILL'); } catch {} fs.rmSync(userDir, { recursive: true, force: true }); };

try {
  let version;
  for (let i = 0; i < 120; i++) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (r.ok) { version = await r.json(); break; } } catch {}
    await sleep(100);
  }
  if (!version) throw new Error('Chrome DevTools did not start.');

  const ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onclose = (e) => process.stderr.write(`[pdf] ws closed code=${e.code}\n`);

  let msgId = 0;
  const pending = new Map();
  const listeners = [];
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id);
      pending.delete(m.id);
      m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
    } else if (m.method) listeners.forEach((fn) => fn(m));
  };
  const send = (method, params = {}, sessionId) => {
    const id = ++msgId;
    ws.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }));
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
  };

  const log = (m) => process.stderr.write(`[pdf] ${m}\n`);
  log('connected to browser');
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  log(`attached session ${sessionId}`);
  await send('Page.enable', {}, sessionId);
  const loaded = Promise.race([
    new Promise((res) => listeners.push((m) => { if (m.method === 'Page.loadEventFired' && m.sessionId === sessionId) res(); })),
    sleep(8000),
  ]);
  await send('Page.navigate', { url: `file://${INPUT}` }, sessionId);
  log('navigated; waiting for load');
  await loaded;
  log('loaded; waiting for fonts');
  await Promise.race([
    send('Runtime.evaluate', { expression: 'document.fonts.ready.then(() => true)', awaitPromise: true }, sessionId),
    sleep(6000),
  ]);
  log('fonts ready; settling');
  await sleep(1400); // settle fonts + background images
  log('printing PDF (streamed)');

  // Stream the PDF in small chunks — a single multi-MB CDP message can exceed
  // the WebSocket payload limit and silently drop the connection.
  const { stream } = await send('Page.printToPDF', {
    printBackground: true,
    preferCSSPageSize: true,
    paperWidth: 20,
    paperHeight: 11.25,
    marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0,
    scale: 1,
    transferMode: 'ReturnAsStream',
  }, sessionId);

  const chunks = [];
  for (;;) {
    const r = await send('IO.read', { handle: stream, size: 524288 }, sessionId);
    if (r.data) chunks.push(Buffer.from(r.data, r.base64Encoded === false ? 'utf8' : 'base64'));
    if (r.eof) break;
  }
  await send('IO.close', { handle: stream }, sessionId);
  fs.writeFileSync(OUTPUT, Buffer.concat(chunks));
  console.log(`Wrote ${OUTPUT} (${(Buffer.concat(chunks).length / 1024).toFixed(0)} KB)`);
  ws.close();
} finally {
  cleanup();
}
