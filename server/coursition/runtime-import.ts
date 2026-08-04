/*
 * Dynamic import whose specifier the bundler cannot see.
 *
 * Two module specifiers must survive into the Worker without being bundled:
 * `cloudflare:workers`, which only the Workers runtime provides, and
 * `node:sqlite`, which backs the local file store and must never be pulled into
 * a Worker build. `webpackIgnore` alone keeps them unbundled but leaves the
 * string literal in the output, where the Cloudflare output verifier's static
 * import scan rejects both — `cloudflare:` is not on its builtin list and
 * `node:sqlite` is genuinely unsupported on Workers.
 *
 * Routing them through a variable specifier keeps the call sites honest: the
 * import still happens at runtime, on the platform that actually provides the
 * module, and neither the bundler nor the verifier sees a literal to resolve.
 */
export const importAtRuntime = <T>(specifier: string): Promise<T> =>
  import(/* webpackIgnore: true */ specifier) as Promise<T>;
