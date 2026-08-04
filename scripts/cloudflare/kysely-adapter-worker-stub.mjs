/*
 * Worker-only replacement for `@better-auth/kysely-adapter`.
 *
 * The Cloudflare path builds better-auth with `drizzleAdapter` over D1, so the
 * Kysely adapter is never constructed there. It still reaches the worker bundle
 * because the same module also holds the local `node:sqlite` setup, and the
 * adapter carries a `webpackIgnore`d `import('node:sqlite')` that the Cloudflare
 * output verifier rejects. Swapping the package for this stub keeps the
 * unsupported builtin out of the bundle; every export throws so a wrong turn
 * fails loudly instead of silently degrading.
 */
const unavailable = (name) => () => {
  throw new Error(
    `${name} is not available on Cloudflare Workers; better-auth runs on the D1 drizzle adapter here.`,
  );
};

export const createKyselyAdapter = unavailable('createKyselyAdapter');
export const getKyselyDatabaseType = unavailable('getKyselyDatabaseType');
export const kyselyAdapter = unavailable('kyselyAdapter');
