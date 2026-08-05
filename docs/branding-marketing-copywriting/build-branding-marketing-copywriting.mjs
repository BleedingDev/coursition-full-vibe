#!/usr/bin/env node
/** Reproducible Markdown → branded PDF/DOCX build for Coursition strategy documents. */

import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const scratchDir = process.env.COURSITION_DOCS_SCRATCH;
if (!scratchDir) throw new Error('Nastavte COURSITION_DOCS_SCRATCH na dočasnou složku mimo repozitář.');

async function findPackageEntry(relativeEntry) {
  const docsDir = path.resolve(scriptDir, '..');
  const queue = [docsDir];
  while (queue.length) {
    const directory = queue.shift();
    const candidate = path.join(directory, 'node_modules', '.pnpm', relativeEntry);
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Continue through documentation tooling directories.
    }
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name !== 'node_modules') queue.push(path.join(directory, entry.name));
    }
  }
  throw new Error(`Chybí build závislost: ${relativeEntry}`);
}

const markdownItPath = await findPackageEntry(
  'markdown-it@14.3.0/node_modules/markdown-it/index.mjs',
);
const playwrightPath = await findPackageEntry(
  'playwright-chromium@1.61.1/node_modules/playwright-chromium/index.js',
);
const soffice = process.env.SOFFICE ?? '/opt/homebrew/bin/soffice';
const logoSvgPath = path.join(scriptDir, 'brand', 'coursition-logo-light.svg');

const documents = [
  ['Brand-a-graficky-manual-Coursition', 'Brand a grafický manuál', 'Strategický a realizační manuál'],
  ['Komunikacni-strategie-a-manual-Coursition', 'Komunikační strategie a manuál', 'Komunikační systém Coursition'],
  ['Marketingova-strategie-Coursition', 'Marketingová strategie', 'Doporučení pro validační fázi'],
  ['Discovery-a-vnitrni-analyza-Coursition', 'Discovery a vnitřní analýza', 'Současná evidenční rekonstrukce'],
  ['Web-copy-a-vizualni-mapa-Coursition', 'Web copy a vizuální mapa', 'Inventář současné realizace a doporučená mapa'],
].map(([stem, title, audience]) => ({ stem, title, audience }));

const brand = {
  plum: '#4A044E',
  plumDeep: '#2F0333',
  magenta: '#A01DAF',
  magentaLight: '#F9EFFA',
  blue: '#007AA8',
  ink: '#241528',
  muted: '#6B5A70',
  line: '#D9C6DD',
};

const [{ default: MarkdownIt }, { default: playwright }] = await Promise.all([
  import(pathToFileURL(markdownItPath).href),
  import(pathToFileURL(playwrightPath).href),
]);
const { chromium } = playwright;
let logoPngUrl = pathToFileURL(logoSvgPath).href;

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function slugify(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'sekce';
}

function configureMarkdown(md) {
  const defaultImage = md.renderer.rules.image;
  md.renderer.rules.image = (tokens, index, options, env, self) => {
    const token = tokens[index];
    const srcIndex = token.attrIndex('src');
    if (srcIndex >= 0) {
      const src = token.attrs[srcIndex][1];
      if (!/^(?:https?:|data:|file:)/.test(src)) {
        token.attrs[srcIndex][1] = pathToFileURL(path.resolve(scriptDir, src)).href;
      }
    }
    return defaultImage(tokens, index, options, env, self);
  };
}

function renderBody(markdown) {
  const md = new MarkdownIt({ html: true, linkify: true, typographer: true });
  configureMarkdown(md);
  const used = new Map();
  const headings = [];
  md.core.ruler.push('coursition-heading-ids', (state) => {
    for (let index = 0; index < state.tokens.length; index += 1) {
      const token = state.tokens[index];
      if (token.type !== 'heading_open') continue;
      const inline = state.tokens[index + 1];
      const base = slugify(inline?.content ?? 'sekce');
      const count = used.get(base) ?? 0;
      used.set(base, count + 1);
      const id = count ? `${base}-${count + 1}` : base;
      token.attrSet('id', id);
      headings.push({ level: Number(token.tag.slice(1)), text: inline?.content ?? '', id });
    }
  });
  return { html: md.render(markdown), headings };
}

function tocHtml(headings) {
  const entries = headings
    .filter(({ level }) => level === 2 || level === 3)
    .map(({ level, text, id }) => `<li class="toc-${level}"><a href="#${id}">${escapeHtml(text)}</a></li>`)
    .join('');
  return `<section class="toc"><h2>Obsah</h2><ol>${entries}</ol></section>`;
}

function styleSheet() {
  return `<style>
    @page { size: A4; margin: 20mm 16mm 22mm; }
    * { box-sizing: border-box; }
    html { color: ${brand.ink}; font-family: Geist, Inter, "Helvetica Neue", Arial, sans-serif; font-size: 10pt; line-height: 1.48; }
    body { margin: 0; }
    .cover { min-height: 244mm; display: flex; flex-direction: column; justify-content: center; break-after: page; }
    .cover::before { content: ""; display: block; width: 34mm; height: 3mm; background: ${brand.magenta}; border-radius: 2mm; margin-bottom: 16mm; }
    .cover-logo { width: 66mm; max-height: 25mm; object-fit: contain; object-position: left center; margin: 0 0 20mm; }
    .cover h1 { color: ${brand.plum}; font-size: 31pt; line-height: 1.04; margin: 0 0 8mm; letter-spacing: -.025em; }
    .audience { color: ${brand.muted}; font-size: 14pt; margin: 0 0 20mm; }
    .cover-meta { border-top: 1px solid ${brand.line}; padding-top: 6mm; }
    .cover-meta p { margin: 0 0 2mm; }
    .doc-note { margin-top: 8mm; color: ${brand.muted}; font-size: 8.5pt; max-width: 145mm; }
    .toc { break-after: page; }
    .toc h2 { border: 0; font-size: 24pt; margin-top: 0; }
    .toc ol { list-style: none; padding: 0; }
    .toc li { border-bottom: 1px solid ${brand.line}; padding: 2.2mm 0; }
    .toc-3 { padding-left: 7mm !important; font-size: 9pt; }
    h1, h2, h3, h4 { color: ${brand.plum}; line-height: 1.2; break-after: avoid-page; }
    article > h1:first-child { display: none; }
    h2 { font-size: 17.5pt; margin: 9mm 0 3.5mm; padding-bottom: 2mm; border-bottom: 1px solid ${brand.line}; }
    h3 { font-size: 13.3pt; margin: 6mm 0 2.5mm; }
    h4 { font-size: 11.2pt; margin: 4.5mm 0 2mm; }
    p { margin: 0 0 3mm; orphans: 3; widows: 3; }
    ul, ol { margin: 1.5mm 0 3.5mm; padding-left: 6mm; }
    li { margin-bottom: 1.1mm; }
    strong { color: ${brand.plum}; }
    a { color: ${brand.blue}; overflow-wrap: anywhere; }
    blockquote { margin: 4mm 0; padding: 3.5mm 5mm; border-left: 4px solid ${brand.magenta}; background: ${brand.magentaLight}; color: ${brand.plumDeep}; break-inside: avoid; }
    code { font-family: "Geist Mono", "SF Mono", Consolas, monospace; font-size: 8.6pt; background: ${brand.magentaLight}; color: ${brand.plumDeep}; border-radius: 3px; padding: .2mm .8mm; overflow-wrap: anywhere; }
    pre { background: ${brand.plumDeep}; color: #F7EEF8; padding: 4mm; border-radius: 5px; white-space: pre-wrap; break-inside: avoid; }
    pre code { background: transparent; color: inherit; padding: 0; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; margin: 3mm 0 5mm; font-size: 8.2pt; }
    tr { break-inside: avoid; }
    th { background: ${brand.plum}; color: white; text-align: left; }
    th, td { border: 1px solid ${brand.line}; padding: 2.1mm; vertical-align: top; overflow-wrap: anywhere; }
    tbody tr:nth-child(even) td { background: #FAF5FB; }
    img { display: block; max-width: 100%; max-height: 165mm; width: auto; height: auto; object-fit: contain; margin: 4mm auto; break-inside: avoid; }
    hr { border: 0; border-top: 1px solid ${brand.line}; margin: 7mm 0; }
  </style>`;
}

async function buildHtml(doc) {
  const markdown = await fs.readFile(path.join(scriptDir, `${doc.stem}.md`), 'utf8');
  const date = markdown.match(/\*\*(?:Datum|Datum přípravy dokumentů?|Datum přípravy dokumentu):\*\*\s*([^\n]+)/)?.[1]?.trim() ?? '27. 7. 2026';
  const version = markdown.match(/\*\*Verze dokumentu:\*\*\s*([^\n]+)/)?.[1]?.trim() ?? '1.0';
  const { html, headings } = renderBody(markdown);
  const cover = `<section class="cover"><img class="cover-logo" src="${logoPngUrl}" alt="Coursition"><h1>${escapeHtml(doc.title)}</h1><p class="audience">${escapeHtml(doc.audience)}</p><div class="cover-meta"><p><strong>Verze dokumentu:</strong> ${escapeHtml(version)}</p><p><strong>Datum přípravy:</strong> ${escapeHtml(date)}</p><p><strong>Stav dokumentu:</strong> současné interní podklady Coursition</p></div><p class="doc-note">Interní dokument Coursition. Doporučení a hypotézy nejsou historické výsledky. Produktové a AI výstupy vyžadují lidskou kontrolu.</p></section>`;
  return `<!doctype html><html lang="cs"><head><meta charset="utf-8"><title>${escapeHtml(doc.title)}</title>${styleSheet()}</head><body>${cover}${tocHtml(headings)}<article>${html}</article></body></html>`;
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`${command} skončil s kódem ${code}`)));
  });
}

async function renderLogoPng(browser) {
  const svg = await fs.readFile(logoSvgPath, 'utf8');
  const target = path.join(scratchDir, 'coursition-logo-docs.png');
  const page = await browser.newPage({ viewport: { width: 1200, height: 360 }, deviceScaleFactor: 3 });
  await page.setContent(`<html><body style="margin:0;padding:24px;background:white;display:inline-block">${svg}</body></html>`);
  const logo = page.locator('svg');
  await logo.evaluate((element) => {
    element.style.display = 'block';
    element.style.width = '760px';
    element.style.height = 'auto';
  });
  await logo.screenshot({ path: target, omitBackground: false });
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
    footerTemplate: `<div style="width:100%;font-family:Inter,Arial,sans-serif;font-size:8px;color:${brand.muted};padding:0 16mm;display:flex;justify-content:space-between"><span>${escapeHtml(doc.title)}</span><span>Strana <span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
    margin: { top: '20mm', right: '16mm', bottom: '22mm', left: '16mm' },
    preferCSSPageSize: true,
  });
  await page.close();
}

async function normalizeDocxDates(docxPath) {
  const helperPath = path.join(scratchDir, 'normalize-coursition-docx-dates.py');
  const helper = `from pathlib import Path
import sys,zipfile
p=Path(sys.argv[1]); tmp=p.with_suffix('.dated.docx'); stamp=(2026,7,27,12,0,0)
with zipfile.ZipFile(p,'r') as zin, zipfile.ZipFile(tmp,'w',zipfile.ZIP_DEFLATED) as zout:
 for item in zin.infolist():
  data=zin.read(item.filename)
  item.date_time=stamp
  zout.writestr(item,data)
tmp.replace(p)
`;
  await fs.writeFile(helperPath, helper, 'utf8');
  await run('python3', [helperPath, docxPath]);
}

async function normalizePdfDates(pdfPath) {
  const helperPath = path.join(scratchDir, 'normalize-coursition-pdf-dates.py');
  const helper = `from pathlib import Path
import re,sys
p=Path(sys.argv[1]); data=p.read_bytes()
data=re.sub(rb'/CreationDate \\(D:[^)]*\\)',rb"/CreationDate (D:20260727120000+00'00')",data)
data=re.sub(rb'/ModDate \\(D:[^)]*\\)',rb"/ModDate (D:20260727120000+00'00')",data)
p.write_bytes(data)
`;
  await fs.writeFile(helperPath, helper, 'utf8');
  await run('python3', [helperPath, pdfPath]);
}

async function embedDocxImages(docxPath) {
  const helperPath = path.join(scratchDir, 'embed-coursition-docx-images.py');
  const helper = `from pathlib import Path\nimport mimetypes,re,sys,urllib.parse,zipfile\np=Path(sys.argv[1]); tmp=p.with_suffix('.embedded.docx')\nwith zipfile.ZipFile(p,'r') as zin:\n rel_name='word/_rels/document.xml.rels'; rel=zin.read(rel_name).decode(); document=zin.read('word/document.xml').decode(); assets=[]\n for i,tag in enumerate(re.findall(r'<Relationship\\b[^>]*Type="[^"]+/image"[^>]*/>',rel),1):\n  tm=re.search(r'Target="([^"]+)"',tag); im=re.search(r'Id="([^"]+)"',tag)\n  if not tm or not im or 'TargetMode="External"' not in tag: continue\n  source=Path(urllib.parse.unquote(tm.group(1).replace('file://','',1)))\n  if not source.exists(): raise SystemExit(f'Missing DOCX image: {source}')\n  ext=source.suffix.lower().lstrip('.') or 'png'; name=f'word/media/coursition-{i}.{ext}'\n  replacement=re.sub(r'Target="[^"]+"',f'Target="media/coursition-{i}.{ext}"',tag); replacement=re.sub(r'\\s+TargetMode="External"','',replacement)\n  rel=rel.replace(tag,replacement); document=document.replace(f'r:link="{im.group(1)}"',f'r:embed="{im.group(1)}"'); assets.append((name,source.read_bytes(),ext))\n content=zin.read('[Content_Types].xml').decode(); types={'png':'image/png','jpg':'image/jpeg','jpeg':'image/jpeg','svg':'image/svg+xml'}\n for _,_,ext in assets:\n  if f'Extension="{ext}"' not in content: content=content.replace('</Types>',f'<Default Extension="{ext}" ContentType="{types.get(ext,mimetypes.guess_type("x."+ext)[0] or "application/octet-stream")}"/></Types>')\n with zipfile.ZipFile(tmp,'w',zipfile.ZIP_DEFLATED) as zout:\n  for item in zin.infolist():\n   data=rel.encode() if item.filename==rel_name else document.encode() if item.filename=='word/document.xml' else content.encode() if item.filename=='[Content_Types].xml' else zin.read(item.filename)\n   zout.writestr(item,data)\n  for name,data,_ in assets: zout.writestr(name,data)\ntmp.replace(p)\n`;
  await fs.writeFile(helperPath, helper, 'utf8');
  await run('python3', [helperPath, docxPath]);
}

async function buildDocx(doc, html) {
  const htmlPath = path.join(scratchDir, `${doc.stem}-docx.html`);
  const outputDir = path.join(scratchDir, `${doc.stem}-docx-out`);
  await fs.rm(outputDir, { recursive: true, force: true });
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(htmlPath, html, 'utf8');
  await run(soffice, ['--headless', '--infilter=HTML (StarWriter)', '--convert-to', 'docx:MS Word 2007 XML', '--outdir', outputDir, htmlPath]);
  const generated = path.join(outputDir, `${doc.stem}-docx.docx`);
  const finalPath = path.join(scriptDir, `${doc.stem}.docx`);
  await fs.copyFile(generated, finalPath);
  await embedDocxImages(finalPath);
  await normalizeDocxDates(finalPath);
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
    await normalizePdfDates(path.join(scriptDir, `${doc.stem}.pdf`));
    await buildDocx(doc, html);
    console.log(`Vytvořeno: ${doc.stem}.pdf a ${doc.stem}.docx`);
  }
} finally {
  await browser.close();
}
