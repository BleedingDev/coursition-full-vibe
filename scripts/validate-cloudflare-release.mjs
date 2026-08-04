import fs from 'node:fs';
import { loadEnvFile } from 'node:process';

if (fs.existsSync('.env')) {
  loadEnvFile('.env');
}

const requiredVariables = [
  'BETTER_AUTH_SECRET',
  'CLOUDFLARE_D1_DATABASE_ID',
  'CLOUDFLARE_D1_DATABASE_NAME',
  'CLOUDFLARE_R2_BUCKET_NAME',
  'MODERN_PUBLIC_SITE_URL',
];

const missingVariables = requiredVariables.filter(
  (name) => typeof process.env[name] !== 'string' || process.env[name].trim().length === 0,
);

if (missingVariables.length > 0) {
  throw new Error(`Missing Cloudflare release variables: ${missingVariables.join(', ')}`);
}

const siteUrl = new URL(process.env.MODERN_PUBLIC_SITE_URL);
if (siteUrl.protocol !== 'https:') {
  throw new Error('MODERN_PUBLIC_SITE_URL must use HTTPS for a Cloudflare release.');
}

console.log('Cloudflare release configuration is complete.');
