import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const config = '.output/wrangler.json';
const backupDirectory = 'artifacts/backups';
const timestamp = new Date().toISOString().replaceAll(/[:.]/gu, '-');
const backupPath = path.join(backupDirectory, `coursition-${timestamp}.sql`);

const run = (command, arguments_) =>
  execFileSync(command, arguments_, {
    encoding: 'utf-8',
    stdio: ['ignore', 'inherit', 'inherit'],
  });

await fs.mkdir(backupDirectory, { recursive: true });

/* Nothing to lose on a database that has never been migrated, and
 * `wrangler d1 export` is unavailable to OAuth logins, so the first release
 * would otherwise be unable to run at all. Later releases still get a backup
 * because by then the schema exists. */
const capture = (command, arguments_) =>
  execFileSync(command, arguments_, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'inherit'] });

const tableProbe = capture('pnpm', [
  'exec',
  'wrangler',
  'd1',
  'execute',
  'COURSITION_DB',
  '--remote',
  '--json',
  '--config',
  config,
  '--command',
  "select name from sqlite_master where type = 'table' and name not like 'sqlite_%' and name not like '_cf_%'",
]);
const existingTables = JSON.parse(tableProbe)[0]?.results ?? [];

if (existingTables.length === 0) {
  console.log('Remote D1 database has no tables yet; skipping the pre-migration export.');
} else {
  console.log('Exporting the remote D1 database before migration.');
  run('pnpm', [
    'exec',
    'wrangler',
    'd1',
    'export',
    'COURSITION_DB',
    '--remote',
    '--config',
    config,
    '--output',
    backupPath,
  ]);
  await fs.chmod(backupPath, 0o600);
}

console.log('Applying the verified D1 migrations.');
run('pnpm', [
  'exec',
  'wrangler',
  'd1',
  'migrations',
  'apply',
  'COURSITION_DB',
  '--remote',
  '--config',
  config,
]);

console.log('Backfilling and verifying per-draft authority before Worker deployment.');
run('node', ['./scripts/backfill-coursition-drafts.mjs', '--apply', '--config', config]);

console.log('Deploying the Worker only after migration and backfill verification.');
run('pnpm', ['exec', 'wrangler', 'deploy', '--config', config]);

console.log(
  existingTables.length === 0
    ? 'Cloudflare release completed. No pre-migration backup was needed.'
    : `Cloudflare release completed. Pre-migration backup: ${backupPath}`,
);
