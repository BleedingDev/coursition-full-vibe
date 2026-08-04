import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const devVariablesPath = path.join(projectRoot, '.dev.vars');

if (!fs.existsSync(devVariablesPath)) {
  throw new Error('Create .dev.vars from .dev.vars.example before starting Cloudflare preview.');
}

const variables = Object.fromEntries(
  fs
    .readFileSync(devVariablesPath, 'utf-8')
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .map((line) => {
      const separatorIndex = line.indexOf('=');
      if (separatorIndex < 1) {
        throw new Error(`Invalid .dev.vars line: ${line}`);
      }
      return [line.slice(0, separatorIndex).trim(), line.slice(separatorIndex + 1).trim()];
    }),
);

const secret = variables.BETTER_AUTH_SECRET;
if (typeof secret !== 'string' || secret.length < 32) {
  throw new Error('BETTER_AUTH_SECRET in .dev.vars must contain at least 32 characters.');
}

const previewPort = process.env.CLOUDFLARE_PREVIEW_PORT?.trim() || '8787';
if (!/^\d+$/u.test(previewPort)) {
  throw new Error('CLOUDFLARE_PREVIEW_PORT must be a valid TCP port number.');
}
const previewOrigin = `http://localhost:${previewPort}`;
const previewEnvironment = {
  ...process.env,
  ...variables,
  BETTER_AUTH_URL: previewOrigin,
  MODERN_PUBLIC_SITE_URL: previewOrigin,
};
const previewVariablesPath = path.join(projectRoot, '.output', '.dev.vars');

const run = (command, args, environment = process.env) => {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    env: environment,
    stdio: 'inherit',
  });
  if (result.error !== undefined) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

run('pnpm', ['run', 'cloudflare:build'], previewEnvironment);
run(
  'pnpm',
  [
    'exec',
    'wrangler',
    'd1',
    'migrations',
    'apply',
    'COURSITION_DB',
    '--local',
    '--config',
    '.output/wrangler.json',
  ],
  { ...previewEnvironment, CI: 'true' },
);

const previewVariables = {
  ...variables,
  BETTER_AUTH_URL: previewOrigin,
  MODERN_PUBLIC_SITE_URL: previewOrigin,
};
fs.writeFileSync(
  previewVariablesPath,
  `${Object.entries(previewVariables)
    .map(([name, value]) => `${name}=${JSON.stringify(value)}`)
    .join('\n')}\n`,
  { mode: 0o600 },
);

const wranglerDevArguments = [
  'exec',
  'wrangler',
  'dev',
  '--port',
  previewPort,
  '--config',
  '.output/wrangler.json',
];
try {
  run('pnpm', wranglerDevArguments, previewEnvironment);
} finally {
  fs.rmSync(previewVariablesPath, { force: true });
}
