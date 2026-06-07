import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outputDirectory = path.join(root, '.output');
const publicDirectory = path.join(outputDirectory, 'public');
const wranglerConfigPath = path.join(outputDirectory, 'wrangler.json');

const removeIfExists = (relativePath) => {
  const absolutePath = path.join(root, relativePath);
  if (fs.existsSync(absolutePath)) {
    fs.rmSync(absolutePath, { force: true, recursive: true });
  }
};

for (const relativePath of [
  'dist/.env',
  'dist/.env.local',
  'dist/.rsdoctor',
  'dist/.scratch',
  '.output/public/.env',
  '.output/public/.env.local',
  '.output/public/.rsdoctor',
  '.output/public/.scratch',
]) {
  removeIfExists(relativePath);
}

if (!fs.existsSync(wranglerConfigPath)) {
  throw new Error('Cloudflare output is missing .output/wrangler.json.');
}

const siteUrl =
  process.env.MODERN_PUBLIC_SITE_URL?.trim() || 'https://coursition-full-vibe.syreanis.workers.dev';
const wranglerConfig = JSON.parse(fs.readFileSync(wranglerConfigPath, 'utf-8'));
wranglerConfig.vars = {
  ...wranglerConfig.vars,
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL?.trim() || siteUrl,
  COURSITION_STORE_BACKEND: 'memory',
  MODERN_PUBLIC_SITE_URL: siteUrl,
};
fs.writeFileSync(wranglerConfigPath, `${JSON.stringify(wranglerConfig, null, 2)}\n`);

if (!fs.existsSync(publicDirectory)) {
  throw new Error('Cloudflare output is missing .output/public.');
}
