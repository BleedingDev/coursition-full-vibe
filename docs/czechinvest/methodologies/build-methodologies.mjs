#!/usr/bin/env node
/** Reproducible Markdown → styled HTML → PDF/DOCX build for Coursition methodologies. */

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const scratchDir =
  process.env.COURSITION_METHODOLOGY_SCRATCH ??
  path.join(os.tmpdir(), 'coursition-methodologies-build');

/* Brand values follow Design Manual Coursition: Geist as the corporate typeface with
   the freely available Inter as its substitute, plum as the base colour and magenta
   as the accent taken from the logo gradient. */
const brand = {
  plum: '#4A044E',
  plumDeep: '#2F0333',
  plumSoft: '#5F0A63',
  magenta: '#A01DAF',
  magentaLight: '#F9EFFA',
  blue: '#007AA8',
  ink: '#241528',
  muted: '#6B5A70',
  line: '#D9C6DD',
  fontStack: 'Geist, Inter, "Helvetica Neue", Arial, sans-serif',
};
const logoSvgPath = path.join(scriptDir, 'brand', 'coursition-logo-light.svg');
/* The cover logo is rasterised once per build: Word before 2016 cannot show an SVG,
   so the DOCX branch must embed a PNG. */
let logoPngUrl = pathToFileURL(logoSvgPath).href;
const deckModules = path.resolve(scriptDir, '../deck/node_modules/.pnpm');
const markdownItPath = path.join(
  deckModules,
  'markdown-it@14.3.0/node_modules/markdown-it/index.mjs',
);
const playwrightPath = path.join(
  deckModules,
  'playwright-chromium@1.61.1/node_modules/playwright-chromium/index.js',
);
const soffice = '/opt/homebrew/bin/soffice';

const documents = [
  {
    stem: 'Metodika-pro-uzivatele-Coursition',
    title: 'Metodika pro uživatele',
    shortTitle: 'Metodika pro uživatele',
    audience: 'Praktický průvodce pro autory kurzů',
  },
  {
    stem: 'Metodika-pro-IT-Coursition',
    title: 'Metodika pro IT',
    shortTitle: 'Metodika pro IT',
    audience: 'Technická a provozní metodika',
  },
];

const mdModule = await import(pathToFileURL(markdownItPath).href);
const MarkdownIt = mdModule.default;
const playwrightModule = await import(pathToFileURL(playwrightPath).href);
const { chromium } = playwrightModule.default;

function escapeHtml(value) {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[char],
  );
}

function slugify(value) {
  return (
    value
      .toLocaleLowerCase('cs')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'sekce'
  );
}

function uniqueSlug(value, used) {
  const base = slugify(value);
  const count = used.get(base) ?? 0;
  used.set(base, count + 1);
  return count === 0 ? base : `${base}-${count + 1}`;
}

function nodeBox(x, y, width, height, text, variant = 'standard') {
  const fill =
    variant === 'primary' ? brand.plum : variant === 'accent' ? brand.magentaLight : '#ffffff';
  const stroke = variant === 'primary' ? brand.plum : brand.line;
  const color = variant === 'primary' ? '#ffffff' : brand.ink;
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  const maxChars = Math.max(15, Math.floor(width / 7));
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else line = candidate;
  }
  if (line) lines.push(line);
  const lineHeight = 17;
  const firstY = y + height / 2 - ((lines.length - 1) * lineHeight) / 2 + 5;
  const textSvg = lines
    .map(
      (entry, index) =>
        `<text x="${x + width / 2}" y="${firstY + index * lineHeight}" text-anchor="middle" class="node-label" fill="${color}">${escapeHtml(entry)}</text>`,
    )
    .join('');
  return `<g><rect x="${x}" y="${y}" width="${width}" height="${height}" rx="9" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>${textSvg}</g>`;
}

function arrow(x1, y1, x2, y2, dashed = false, label = '') {
  const labelX = (x1 + x2) / 2;
  const labelY = (y1 + y2) / 2 - 7;
  return `<g><path d="M ${x1} ${y1} L ${x2} ${y2}" fill="none" stroke="${brand.magenta}" stroke-width="1.7" ${dashed ? 'stroke-dasharray="6 5"' : ''} marker-end="url(#arrow)"/>${label ? `<text x="${labelX}" y="${labelY}" text-anchor="middle" class="edge-label">${escapeHtml(label)}</text>` : ''}</g>`;
}

function svgShell(width, height, body, label) {
  return `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeHtml(label)}" viewBox="0 0 ${width} ${height}" width="100%" height="auto">
    <defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="${brand.magenta}"/></marker></defs>
    <style>.node-label{font:600 13px Inter,Helvetica,Arial,sans-serif}.edge-label{font:11px Inter,Helvetica,Arial,sans-serif;fill:${brand.muted}}.small{font:12px Inter,Helvetica,Arial,sans-serif;fill:${brand.muted}}</style>
    <rect width="100%" height="100%" rx="12" fill="#FBF6FC"/>
    ${body}
  </svg>`;
}

function renderMermaid(code, index) {
  if (code.includes('Creator browser')) {
    const width = 1000,
      height = 360;
    let body = '';
    body += nodeBox(25, 142, 155, 68, 'Creator browser (CS / EN)', 'accent');
    body += nodeBox(275, 132, 205, 88, 'Cloudflare Worker: Coursition', 'primary');
    const targets = [
      [585, 25, 180, 58, 'Cloudflare D1: COURSITION_DB', false],
      [790, 25, 180, 58, 'Cloudflare R2: COURSITION_SOURCE_BUCKET', false],
      [585, 112, 180, 58, 'Workers AI binding: AI', true],
      [790, 112, 180, 58, 'Ax / OpenAI-compatible AI', false],
      [585, 199, 180, 58, 'Firecrawl / Tavily / Exa', true],
      [790, 199, 180, 58, 'LlamaParse / Deepgram', true],
    ];
    body += arrow(180, 176, 275, 176);
    for (const [x, y, w, h, text, dashed] of targets) {
      body += nodeBox(x, y, w, h, text, dashed ? 'accent' : 'standard');
      body += arrow(480, 176, x, y + h / 2, dashed, dashed ? 'volitelné' : '');
    }
    body +=
      '<text x="500" y="325" text-anchor="middle" class="small">Jedna nasazovací jednotka propojuje UI, data a nakonfigurované externí služby.</text>';
    return svgShell(width, height, body, 'Kontext systému Coursition');
  }
  if (code.includes('Modern.js / UltraModern web application')) {
    const width = 880,
      height = 530;
    let body = '';
    body += nodeBox(300, 25, 280, 62, 'Modern.js / UltraModern web application', 'primary');
    const row2 = [
      [30, 145, 'TanStack Router'],
      [235, 145, 'Modern.js i18n plugin'],
      [440, 145, 'Effect BFF'],
      [645, 145, 'Better Auth'],
    ];
    for (const [x, y, t] of row2)
      body += nodeBox(x, y, 175, 58, t, t === 'Effect BFF' ? 'accent' : 'standard');
    body += arrow(370, 87, 117, 145);
    body += arrow(420, 87, 322, 145);
    body += arrow(470, 87, 527, 145);
    body += arrow(527, 203, 732, 203);
    body += nodeBox(335, 265, 210, 62, 'Coursition workflow store', 'primary');
    body += arrow(527, 203, 440, 265);
    const row4 = [
      [80, 390, 'DraftRepository'],
      [335, 390, 'Source processing'],
      [590, 390, 'Ax / AI boundary'],
    ];
    for (const [x, y, t] of row4)
      body += nodeBox(x, y, 210, 58, t, t === 'DraftRepository' ? 'accent' : 'standard');
    body += arrow(405, 327, 185, 390);
    body += arrow(440, 327, 440, 390);
    body += arrow(475, 327, 695, 390);
    body += nodeBox(80, 470, 210, 44, 'Source cleanup outbox');
    body += arrow(185, 448, 185, 470);
    return svgShell(width, height, body, 'Logické komponenty uvnitř Workeru');
  }
  if (code.includes('Source cleanup outbox')) {
    const width = 1040,
      height = 250;
    const labels = [
      'Smazání source / draftu',
      'D1 transakční změna',
      'Source cleanup outbox',
      'Claim cleanup jobu',
      'Cloudflare R2',
      'Ověření nepřítomnosti',
    ];
    let body = '';
    labels.forEach(
      (label, i) =>
        (body += nodeBox(20 + i * 170, 55, 145, 64, label, i === 2 ? 'primary' : 'standard')),
    );
    for (let i = 0; i < labels.length - 1; i++) body += arrow(165 + i * 170, 87, 190 + i * 170, 87);
    body += nodeBox(710, 170, 130, 48, 'Cleanup completed', 'accent');
    body += nodeBox(875, 170, 130, 48, 'Backoff + retry', 'accent');
    body += arrow(947, 119, 775, 170, false, 'úspěch');
    body += arrow(947, 119, 940, 170, false, 'chyba');
    body += `<path d="M 940 218 C 940 240, 360 240, 360 119" fill="none" stroke="${brand.magenta}" stroke-width="1.7" stroke-dasharray="6 5" marker-end="url(#arrow)"/>`;
    return svgShell(width, height, body, 'Životní cyklus odstranění source blobu');
  }
  if (code.includes('pnpm cloudflare:deploy')) {
    const width = 1060,
      height = 245;
    const labels = [
      'pnpm cloudflare:deploy',
      'Validace release',
      'Cloudflare build',
      'D1 table probe',
      'Podmíněný D1 export',
      'Remote migrace',
      'Backfill + verify',
      'Wrangler deploy',
    ];
    let body = '';
    labels.forEach(
      (label, i) =>
        (body += nodeBox(
          15 + i * 130,
          80,
          115,
          60,
          label,
          i === 0 || i === 7 ? 'primary' : 'standard',
        )),
    );
    for (let i = 0; i < labels.length - 1; i++)
      body += arrow(130 + i * 130, 110, 145 + i * 130, 110);
    body += nodeBox(15, 175, 190, 45, 'Ruční kroky operátora', 'accent');
    body += arrow(110, 175, 72, 140, true, 'resources / secrets / smoke');
    return svgShell(width, height, body, 'Fail-fast release pipeline');
  }
  return svgShell(
    900,
    180,
    nodeBox(
      100,
      55,
      700,
      70,
      `Diagram ${index}: struktura je popsána v přilehlém textu.`,
      'accent',
    ),
    `Diagram ${index}`,
  );
}

function buildRenderer(md, baseDir) {
  md.core.ruler.after('inline', 'coursition_task_lists', (state) => {
    for (let index = 2; index < state.tokens.length; index += 1) {
      const inline = state.tokens[index];
      if (inline.type !== 'inline' || inline.children === null) continue;
      const listItem = state.tokens[index - 1];
      const bulletList = state.tokens[index - 2];
      if (listItem.type !== 'paragraph_open' || bulletList.type !== 'list_item_open') continue;
      const first = inline.children[0];
      const match = first?.type === 'text' ? first.content.match(/^\[([ xX])\]\s+/u) : null;
      if (match === null || first === undefined) continue;
      const checked = match[1].toLowerCase() === 'x';
      first.content = first.content.slice(match[0].length);
      first.content = `${checked ? '☑' : '☐'} ${first.content}`;
      bulletList.attrJoin('class', 'task-list-item');
    }
  });

  const defaultImage = md.renderer.rules.image;
  md.renderer.rules.image = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const srcIndex = token.attrIndex('src');
    if (srcIndex >= 0) {
      const src = token.attrs[srcIndex][1];
      if (!/^[a-z]+:/i.test(src))
        token.attrs[srcIndex][1] = pathToFileURL(path.resolve(baseDir, src)).href;
    }
    token.attrSet('loading', 'eager');
    return defaultImage(tokens, idx, options, env, self);
  };

  const defaultFence = md.renderer.rules.fence;
  let diagramIndex = 0;
  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    if (token.info.trim().toLowerCase() === 'mermaid') {
      diagramIndex += 1;
      return `<div class="diagram">${renderMermaid(token.content, diagramIndex)}</div>`;
    }
    return defaultFence(tokens, idx, options, env, self);
  };
}

function addHeadingIdsAndToc(md) {
  const used = new Map();
  const headings = [];
  md.core.ruler.push('coursition_heading_ids', (state) => {
    for (let i = 0; i < state.tokens.length; i += 1) {
      const token = state.tokens[i];
      if (token.type !== 'heading_open') continue;
      const level = Number(token.tag.slice(1));
      const inline = state.tokens[i + 1];
      const title = inline?.content?.trim() ?? '';
      const id = uniqueSlug(title, used);
      token.attrSet('id', id);
      if (level === 2 || level === 3) headings.push({ level, title, id });
    }
  });
  return headings;
}

function tocHtml(headings) {
  const filtered = headings.filter((item) => item.title.toLocaleLowerCase('cs') !== 'obsah');
  return `<nav class="toc" aria-label="Obsah"><h2>Obsah</h2><ol>${filtered.map((item) => `<li class="toc-level-${item.level}"><a href="#${item.id}">${escapeHtml(item.title)}</a></li>`).join('')}</ol></nav>`;
}

function stripExistingToc(markdown) {
  const match = markdown.match(/\n## Obsah\s*\n[\s\S]*?\n---\s*\n/);
  return match ? markdown.replace(match[0], '\n') : markdown;
}

function styleSheet() {
  return `<style>
    @page { size: A4; margin: 20mm 16mm 22mm; }
    * { box-sizing: border-box; }
    html { color: ${brand.ink}; background: white; font-family: ${brand.fontStack}; font-size: 10.1pt; line-height: 1.47; }
    body { margin: 0 auto; max-width: 178mm; hyphens: auto; overflow-wrap: anywhere; }
    .cover { min-height: 225mm; display: flex; flex-direction: column; justify-content: center; page-break-after: always; padding: 18mm 9mm; position: relative; }
    .cover::before { content: ""; position: absolute; top: 0; left: 0; right: 0; height: 9px; background: linear-gradient(90deg, ${brand.magenta} 0%, ${brand.plum} 100%); }
    .cover-logo { display: block; width: 68mm; height: auto; margin: 0 0 16mm; }
    .cover h1 { color: ${brand.plum}; font-size: 30pt; line-height: 1.08; margin: 9mm 0 5mm; letter-spacing: -0.01em; }
    .cover .audience { color: ${brand.plumSoft}; font-size: 15pt; margin: 0 0 22mm; }
    .cover-meta { border-left: 3px solid ${brand.magenta}; padding-left: 5mm; color: ${brand.muted}; }
    .cover-meta p { margin: 2mm 0; }
    .cover-meta strong { color: ${brand.plum}; }
    .toc { page-break-after: always; }
    .toc h2 { margin-top: 0; }
    .toc ol { list-style: none; padding: 0; margin: 0; column-count: 2; column-gap: 10mm; }
    .toc li { break-inside: avoid; margin: 0 0 2.3mm; }
    .toc-level-2 { font-weight: 700; }
    .toc-level-3 { padding-left: 4mm; font-weight: 400; font-size: 9.2pt; }
    .toc a { color: ${brand.plum}; text-decoration: none; }
    article > h1:first-child { display: none; }
    h1, h2, h3, h4 { color: ${brand.plum}; line-height: 1.2; page-break-after: avoid; break-after: avoid-page; letter-spacing: -0.005em; }
    h2 { font-size: 17.5pt; margin: 9mm 0 3.5mm; padding-bottom: 2mm; border-bottom: 1px solid ${brand.line}; }
    h3 { font-size: 13.3pt; margin: 6mm 0 2.5mm; }
    h4 { font-size: 11.2pt; margin: 4.5mm 0 2mm; }
    p { margin: 0 0 3mm; orphans: 3; widows: 3; }
    ul, ol { margin: 1.5mm 0 3.5mm; padding-left: 6mm; }
    li { margin: 0 0 1.1mm; }
    strong { color: ${brand.plum}; }
    a { color: ${brand.blue}; }
    blockquote { margin: 4mm 0; padding: 3.5mm 5mm; border-left: 4px solid ${brand.magenta}; background: ${brand.magentaLight}; color: ${brand.plumDeep}; page-break-inside: avoid; }
    code { font-family: "Geist Mono", "SF Mono", Consolas, monospace; font-size: 8.8pt; background: ${brand.magentaLight}; color: ${brand.plumDeep}; border-radius: 3px; padding: .2mm .8mm; overflow-wrap: anywhere; }
    code, pre, a, kbd, samp { hyphens: none; -webkit-hyphens: none; }
    pre { background: ${brand.plumDeep}; color: #F7EEF8; padding: 4mm; border-radius: 5px; overflow-wrap: anywhere; white-space: pre-wrap; page-break-inside: avoid; font-size: 8.2pt; line-height: 1.35; }
    pre code { background: transparent; color: inherit; padding: 0; }
    .task-list-item { list-style: none; margin-left: -5mm; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; margin: 3mm 0 5mm; font-size: 8.5pt; page-break-inside: auto; }
    tr { page-break-inside: avoid; break-inside: avoid; }
    th { background: ${brand.plum}; color: white; font-weight: 700; text-align: left; }
    th, td { border: 1px solid ${brand.line}; padding: 2.2mm; vertical-align: top; overflow-wrap: anywhere; }
    tbody tr:nth-child(even) td { background: #FAF5FB; }
    img { display: block; max-width: 100%; max-height: 166mm; width: auto; height: auto; object-fit: contain; margin: 4mm auto 1.5mm; page-break-inside: avoid; }
    p:has(> img) { page-break-inside: avoid; break-inside: avoid; margin-bottom: 1mm; }
    p:has(> img) + p > em { display: block; text-align: center; color: ${brand.muted}; font-size: 8.7pt; margin-bottom: 5mm; page-break-before: avoid; }
    .diagram { margin: 4mm 0 2mm; page-break-inside: avoid; break-inside: avoid; }
    .diagram svg { display: block; max-height: 150mm; }
    hr { border: 0; border-top: 1px solid ${brand.line}; margin: 7mm 0; }
    .doc-note { margin: 6mm 0 0; color: ${brand.muted}; font-size: 8.5pt; }
    @media print { .cover, .toc { break-after: page; } }
  </style>`;
}

async function buildHtml(doc) {
  const inputPath = path.join(scriptDir, `${doc.stem}.md`);
  const originalMarkdown = await fs.readFile(inputPath, 'utf8');
  const date = originalMarkdown.match(/\*\*Datum:\*\*\s*([^\n]+)/)?.[1]?.trim() ?? '4. 8. 2026';
  const version =
    originalMarkdown.match(/\*\*Verze dokumentu:\*\*\s*([^\n]+)/)?.[1]?.trim() ?? '1.0';
  let markdown = stripExistingToc(originalMarkdown);
  markdown = markdown.replace(/^#[\s\S]*?(?=^##\s+)/m, '');
  const md = new MarkdownIt({ html: true, linkify: true, typographer: true, breaks: false });
  buildRenderer(md, scriptDir);
  const headings = addHeadingIdsAndToc(md);
  const body = md.render(markdown);
  const cover = `<section class="cover"><img class="cover-logo" src="${logoPngUrl}" alt="Coursition"><h1>${escapeHtml(doc.title)}</h1><p class="audience">${escapeHtml(doc.audience)}</p><div class="cover-meta"><p><strong>Verze dokumentu:</strong> ${escapeHtml(version)}</p><p><strong>Datum vydání:</strong> ${escapeHtml(date)}</p><p><strong>Stav ověření:</strong> lokálně sestavená aplikace a aktuální repozitář</p></div><p class="doc-note">Dokument popisuje ověřený stav k uvedenému datu. Uvedené AI výstupy a provozní postupy vyžadují lidskou kontrolu.</p></section>`;
  return `<!doctype html><html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(doc.title)}</title>${styleSheet()}</head><body>${cover}${tocHtml(headings)}<article>${body}</article></body></html>`;
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', ...options });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} skončil s kódem ${code}`)),
    );
  });
}

async function renderLogoPng(browser) {
  const svg = await fs.readFile(logoSvgPath, 'utf8');
  const target = path.join(scratchDir, 'coursition-logo.png');
  const page = await browser.newPage({
    viewport: { width: 1100, height: 320 },
    deviceScaleFactor: 3,
  });
  await page.setContent(`<html><body style="margin:0;background:white">${svg}</body></html>`);
  await page.locator('svg').screenshot({ path: target, omitBackground: false });
  await page.close();
  return target;
}

async function buildPdf(browser, doc, htmlPath) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load' });
  await page.emulateMedia({ media: 'print' });
  await page.pdf({
    path: path.join(scriptDir, `${doc.stem}.pdf`),
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: `<div style="width:100%;font-family:Inter,Helvetica,Arial,sans-serif;font-size:8px;color:${brand.muted};padding:0 16mm;display:flex;justify-content:space-between;"><span>${escapeHtml(doc.shortTitle)}</span><span>Strana <span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
    margin: { top: '20mm', right: '16mm', bottom: '22mm', left: '16mm' },
    preferCSSPageSize: true,
  });
  await page.close();
}

async function prepareDocxHtml(browser, doc, html) {
  const diagramPattern = /<div class="diagram">([\s\S]*?<\/svg>)<\/div>/g;
  const matches = [...html.matchAll(diagramPattern)];
  let prepared = html;
  for (let index = 0; index < matches.length; index += 1) {
    const svg = matches[index][1];
    const assetPath = path.join(scratchDir, `${doc.stem}-diagram-${index + 1}.png`);
    const page = await browser.newPage({
      viewport: { width: 1400, height: 900 },
      deviceScaleFactor: 2,
    });
    await page.setContent(`<html><body style="margin:0;background:white">${svg}</body></html>`);
    await page.locator('svg').screenshot({ path: assetPath });
    await page.close();
    prepared = prepared.replace(
      matches[index][0],
      `<div class="diagram"><img src="${pathToFileURL(assetPath).href}" alt="Diagram ${index + 1}"></div>`,
    );
  }
  const docxHtmlPath = path.join(scratchDir, `${doc.stem}-docx.html`);
  await fs.writeFile(docxHtmlPath, prepared, 'utf8');
  return docxHtmlPath;
}

async function embedDocxImages(docxPath) {
  const helperPath = path.join(scratchDir, 'embed-docx-images.py');
  const helper = `from pathlib import Path\nimport mimetypes, re, sys, urllib.parse, zipfile\np=Path(sys.argv[1])\ntmp=p.with_suffix('.embedded.docx')\nwith zipfile.ZipFile(p,'r') as zin:\n    rel_name='word/_rels/document.xml.rels'\n    rel=zin.read(rel_name).decode('utf-8')\n    document=zin.read('word/document.xml').decode('utf-8')\n    external=re.findall(r'<Relationship\\b[^>]*Type="[^"]+/image"[^>]*/>',rel)\n    assets=[]\n    for i,tag in enumerate(external,1):\n        tm=re.search(r'Target="([^"]+)"',tag)\n        im=re.search(r'Id="([^"]+)"',tag)\n        if not tm or not im or 'TargetMode="External"' not in tag: continue\n        target=urllib.parse.unquote(tm.group(1).replace('file://','',1))\n        source=Path(target)\n        if not source.exists(): raise SystemExit(f'Missing DOCX image: {source}')\n        ext=source.suffix.lower().lstrip('.') or 'png'\n        name=f'word/media/coursition-{i}.{ext}'\n        replacement=re.sub(r'Target="[^"]+"',f'Target="media/coursition-{i}.{ext}"',tag)\n        replacement=re.sub(r'\\s+TargetMode="External"','',replacement)\n        rel=rel.replace(tag,replacement)\n        document=document.replace(f'r:link="{im.group(1)}"',f'r:embed="{im.group(1)}"')\n        assets.append((name,source.read_bytes(),ext))\n    max_width=5800000\n    def resize(match):\n        block=match.group(0)\n        em=re.search(r'<wp:extent cx="(\\d+)" cy="(\\d+)"/>',block)\n        if not em or int(em.group(1))<=max_width: return block\n        cx,cy=map(int,em.groups()); ncy=round(cy*max_width/cx)\n        block=block.replace(f'cx="{cx}" cy="{cy}"',f'cx="{max_width}" cy="{ncy}"')\n        return block\n    document=re.sub(r'<w:drawing>[\\s\\S]*?</w:drawing>',resize,document)\n    content=zin.read('[Content_Types].xml').decode('utf-8')\n    types={'png':'image/png','jpg':'image/jpeg','jpeg':'image/jpeg','svg':'image/svg+xml','gif':'image/gif'}\n    for _,_,ext in assets:\n        if f'Extension="{ext}"' not in content:\n            content=content.replace('</Types>',f'<Default Extension="{ext}" ContentType="{types.get(ext,mimetypes.guess_type("x."+ext)[0] or "application/octet-stream")}"/></Types>')\n    with zipfile.ZipFile(tmp,'w',zipfile.ZIP_DEFLATED) as zout:\n        for item in zin.infolist():\n            if item.filename==rel_name: data=rel.encode('utf-8')\n            elif item.filename=='word/document.xml': data=document.encode('utf-8')\n            elif item.filename=='[Content_Types].xml': data=content.encode('utf-8')\n            else: data=zin.read(item.filename)\n            zout.writestr(item,data)\n        for name,data,_ in assets: zout.writestr(name,data)\ntmp.replace(p)\n`;
  await fs.writeFile(helperPath, helper, 'utf8');
  await run('python3', [helperPath, docxPath]);
}

async function buildDocx(browser, doc, html) {
  const htmlPath = await prepareDocxHtml(browser, doc, html);
  const tempOut = path.join(scratchDir, `${doc.stem}-docx`);
  await fs.rm(tempOut, { recursive: true, force: true });
  await fs.mkdir(tempOut, { recursive: true });
  await run(soffice, [
    '--headless',
    '--infilter=HTML (StarWriter)',
    '--convert-to',
    'docx:MS Word 2007 XML',
    '--outdir',
    tempOut,
    htmlPath,
  ]);
  const generated = path.join(tempOut, `${doc.stem}-docx.docx`);
  const finalPath = path.join(scriptDir, `${doc.stem}.docx`);
  await fs.copyFile(generated, finalPath);
  await embedDocxImages(finalPath);
}

await fs.mkdir(scratchDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  logoPngUrl = pathToFileURL(await renderLogoPng(browser)).href;
  for (const doc of documents) {
    const html = await buildHtml(doc);
    const htmlPath = path.join(scratchDir, `${doc.stem}.html`);
    await fs.writeFile(htmlPath, html, 'utf8');
    await buildPdf(browser, doc, htmlPath);
    await buildDocx(browser, doc, html);
    console.log(`Vytvořeno: ${doc.stem}.pdf a ${doc.stem}.docx`);
  }
} finally {
  await browser.close();
}
