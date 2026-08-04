/*
 * Uploads the Worker secrets from `.env` in one `wrangler secret bulk` call.
 *
 * Only the values that must stay hidden go here; the public configuration
 * (site URL, AI base URL and model, store backend) is already in `vars` inside
 * the generated `wrangler.json`. The payload travels over stdin so no file on
 * disk ever holds the plaintext secrets.
 */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { loadEnvFile } from 'node:process';

if (fs.existsSync('.env')) {
  loadEnvFile('.env');
}

const secretNames = [
  'BETTER_AUTH_SECRET',
  'COURSITION_AI_PROVIDER_API_KEY',
  'DEEPGRAM_API_KEY',
  'EXA_API_KEY',
  'FIRECRAWL_API_KEY',
  'LLAMA_CLOUD_API_KEY',
  'TAVILY_API_KEY',
];

const missing = secretNames.filter(
  (name) => typeof process.env[name] !== 'string' || process.env[name].trim().length === 0,
);

if (missing.length > 0) {
  throw new Error(`Missing Cloudflare Worker secrets in .env: ${missing.join(', ')}`);
}

const payload = Object.fromEntries(secretNames.map((name) => [name, process.env[name].trim()]));

execFileSync('pnpm', ['exec', 'wrangler', 'secret', 'bulk', '--config', '.output/wrangler.json'], {
  input: JSON.stringify(payload),
  stdio: ['pipe', 'inherit', 'inherit'],
});

console.log(`Uploaded ${secretNames.length} Worker secrets.`);
