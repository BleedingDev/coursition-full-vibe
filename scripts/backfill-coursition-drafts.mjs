import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { Effect, Schema } from 'effect';
import { courseDraftSchema } from '../shared/api.ts';

const argumentsSet = new Set(process.argv.slice(2));
const apply = argumentsSet.has('--apply');
const local = argumentsSet.has('--local');
const configArgument = process.argv.indexOf('--config');
const config = configArgument === -1 ? '.output/wrangler.json' : process.argv[configArgument + 1];

if (typeof config !== 'string' || config.trim().length === 0) {
  throw new Error('A non-empty --config path is required.');
}

const locationArguments = local ? ['--local'] : ['--remote'];
const wrangler = (extraArguments) =>
  execFileSync(
    'pnpm',
    [
      'exec',
      'wrangler',
      'd1',
      'execute',
      'COURSITION_DB',
      ...locationArguments,
      '--config',
      config,
      '--json',
      ...extraArguments,
    ],
    { encoding: 'utf-8', maxBuffer: 16 * 1024 * 1024 },
  );

const query = (sql) => {
  const response = JSON.parse(wrangler(['--command', sql]));
  const statement = Array.isArray(response) ? response[0] : undefined;
  if (statement?.success !== true || !Array.isArray(statement.results)) {
    throw new Error('D1 returned an invalid maintenance response.');
  }
  return statement.results;
};

const aggregateRows = query(
  "SELECT payload, updated_at FROM coursition_store WHERE id = 'primary' LIMIT 2",
);
if (aggregateRows.length > 1) {
  throw new Error('Coursition aggregate contains more than one primary row.');
}

const [aggregate] = aggregateRows;
if (aggregate === undefined) {
  console.log('Coursition backfill dry-run: no legacy aggregate exists; draft count 0.');
  process.exit(0);
}
if (typeof aggregate.payload !== 'string') {
  throw new TypeError('Coursition aggregate payload is unavailable.');
}

const parsed = JSON.parse(aggregate.payload);
if (typeof parsed !== 'object' || parsed === null || !Array.isArray(parsed.drafts)) {
  throw new Error('Coursition aggregate does not match the expected envelope.');
}

const drafts = await Promise.all(
  parsed.drafts.map((value) =>
    Effect.runPromise(
      Schema.decodeUnknownEffect(courseDraftSchema)({
        ...value,
        revision: 1,
      }),
    ),
  ),
);
const ids = new Set(drafts.map((draft) => draft.id));
const ownerIds = new Set(drafts.map((draft) => draft.ownerId));
if (ids.size !== drafts.length || [...ids].some((id) => id.trim().length === 0)) {
  throw new Error('Coursition aggregate contains missing or duplicate draft IDs.');
}
if ([...ownerIds].some((ownerId) => ownerId.trim().length === 0)) {
  throw new Error('Coursition aggregate contains a missing owner ID.');
}
if (drafts.some((draft) => JSON.stringify(draft).length >= 1_900_000)) {
  throw new Error('A Coursition draft is too close to the D1 row-size limit.');
}

const existingOwners =
  ownerIds.size === 0
    ? []
    : query(
        `SELECT id FROM user WHERE id IN (${[...ownerIds]
          .map((ownerId) => `'${ownerId.replaceAll("'", "''")}'`)
          .join(',')})`,
      );
if (existingOwners.length !== ownerIds.size) {
  throw new Error(
    `Coursition aggregate owner validation failed (${existingOwners.length}/${ownerIds.size}).`,
  );
}

let existingDraftCount = 0;
try {
  const rows = query('SELECT COUNT(*) AS count FROM coursition_draft');
  existingDraftCount = Number(rows[0]?.count ?? 0);
} catch (error) {
  throw new Error('Apply D1 migrations before running the Coursition backfill.', {
    cause: error,
  });
}

console.log(
  `Coursition backfill ${apply ? 'apply' : 'dry-run'}: ${drafts.length} drafts, ${ownerIds.size} owners, ${existingDraftCount} target rows.`,
);

const verifyTarget = () =>
  query(
    `SELECT
       (SELECT COUNT(*) FROM coursition_draft) AS draft_count,
       (SELECT COUNT(DISTINCT owner_id) FROM coursition_draft) AS owner_count,
       (SELECT COUNT(*) FROM coursition_draft WHERE revision < 1) AS invalid_revision_count,
       (SELECT COUNT(*) FROM coursition_draft
         WHERE id <> json_extract(payload, '$.id')
            OR owner_id <> json_extract(payload, '$.ownerId')
            OR revision <> json_extract(payload, '$.revision')) AS metadata_mismatch_count,
       (SELECT COUNT(*)
          FROM (SELECT DISTINCT owner_id FROM coursition_draft) target_owner
          LEFT JOIN coursition_owner_state owner_state
            ON owner_state.owner_id = target_owner.owner_id
         WHERE owner_state.owner_id IS NULL OR owner_state.revision < 1) AS invalid_owner_state_count,
       (SELECT COUNT(*)
          FROM json_each((SELECT payload FROM coursition_store WHERE id = 'primary'), '$.drafts') legacy
          LEFT JOIN coursition_draft target ON target.id = json_extract(legacy.value, '$.id')
         WHERE target.id IS NULL
            OR target.owner_id <> json_extract(legacy.value, '$.ownerId')
            OR target.payload <> json_set(legacy.value, '$.revision', 1)) AS missing_target_count,
       (SELECT COUNT(*)
          FROM coursition_draft target
         WHERE NOT EXISTS (
           SELECT 1
             FROM json_each((SELECT payload FROM coursition_store WHERE id = 'primary'), '$.drafts') legacy
            WHERE json_extract(legacy.value, '$.id') = target.id
         )) AS extra_target_count`,
  )[0];

const targetPreservesAggregate = (verification) =>
  Number(verification?.draft_count) >= drafts.length &&
  Number(verification?.owner_count) >= ownerIds.size &&
  Number(verification?.invalid_revision_count) === 0 &&
  Number(verification?.metadata_mismatch_count) === 0 &&
  Number(verification?.invalid_owner_state_count) === 0 &&
  Number(verification?.missing_target_count) === 0;

if (!apply) {
  process.exit(0);
}
if (existingDraftCount !== 0) {
  const verification = verifyTarget();
  if (targetPreservesAggregate(verification)) {
    console.log(
      `Coursition backfill already preserves the legacy aggregate; ${verification.extra_target_count} newer authoritative rows left untouched.`,
    );
    process.exit(0);
  }
  throw new Error(
    'Coursition target table is not empty; refusing to overwrite authoritative rows.',
  );
}

const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'coursition-backfill-'));
const sqlPath = path.join(temporaryDirectory, 'backfill.sql');
const sql = `
INSERT INTO coursition_draft
  (created_at, id, last_operation_id, owner_id, payload, revision, updated_at)
SELECT
  CAST(unixepoch(json_extract(value, '$.createdAt'), 'subsec') * 1000 AS INTEGER),
  json_extract(value, '$.id'),
  NULL,
  json_extract(value, '$.ownerId'),
  json_set(value, '$.revision', 1),
  1,
  CAST(unixepoch(json_extract(value, '$.updatedAt'), 'subsec') * 1000 AS INTEGER)
FROM json_each((SELECT payload FROM coursition_store WHERE id = 'primary'), '$.drafts');

INSERT INTO coursition_owner_state (owner_id, revision, updated_at)
SELECT DISTINCT owner_id, 1, CAST(unixepoch('subsecond') * 1000 AS INTEGER)
FROM coursition_draft;
`;

try {
  await fs.writeFile(sqlPath, sql, { encoding: 'utf-8', mode: 0o600 });
  wrangler(['--file', sqlPath]);
} finally {
  await fs.rm(temporaryDirectory, { force: true, recursive: true });
}

const verification = verifyTarget();
const [preservedAggregate] = query(
  "SELECT payload, updated_at FROM coursition_store WHERE id = 'primary' LIMIT 2",
);

if (
  !targetPreservesAggregate(verification) ||
  preservedAggregate?.payload !== aggregate.payload ||
  preservedAggregate?.updated_at !== aggregate.updated_at
) {
  throw new Error('Coursition backfill verification failed. Restore the saved D1 bookmark.');
}

console.log(
  `Coursition backfill verified: ${verification.draft_count} drafts, ${verification.owner_count} owners, revision 1.`,
);
