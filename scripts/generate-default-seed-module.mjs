/**
 * Emits `server/coursition/default-seed.generated.ts` from `default-seed.json`.
 *
 * The seed cannot be imported as JSON directly: the API compile step rewrites
 * relative import extensions and turns `./default-seed.json` into
 * `./default-seed.js`, which then fails to resolve when the Worker bundle is
 * built. Carrying the seed as a JSON string sidesteps the rewriter entirely and
 * costs nothing at the type level, because `store.ts` decodes it through
 * `Schema.decodeUnknownSync` anyway.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const serverDir = path.join(path.dirname(import.meta.dirname), 'server', 'coursition');

export const generateDefaultSeedModule = () => {
  const seed = readFileSync(path.join(serverDir, 'default-seed.json'), 'utf-8');
  /* Round-trips through the parser so a malformed seed fails here, at build
   * time, rather than at Worker start-up. */
  const source = `/* Generated from default-seed.json. Do not edit. */\nexport const defaultSeedStoreJsonText = ${JSON.stringify(seed)};\n`;
  writeFileSync(path.join(serverDir, 'default-seed.generated.ts'), source, 'utf-8');
};

generateDefaultSeedModule();
