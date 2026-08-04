import type * as NodeSqlite from 'node:sqlite';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import * as NodeFileSystem from '@effect/platform-node/NodeFileSystem';
import { betterAuth } from 'better-auth';
import { getMigrations } from 'better-auth/db/migration';
import { betterAuth as betterAuthMinimal } from 'better-auth/minimal';
import { drizzle } from 'drizzle-orm/d1';
import { Effect, FileSystem } from 'effect';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import * as authSchema from './auth-schema.ts';
import { coursitionCloudflareBindings } from './cloudflare-bindings.ts';
import type { CoursitionAuthConfig } from './config.ts';
import { loadCoursitionAuthConfig } from './config.ts';
import { hashCoursitionPassword, verifyCoursitionPassword } from './password-hash.ts';
import { importAtRuntime } from './runtime-import.ts';

type NodeSqliteModule = typeof NodeSqlite;

const originFrom = (value: string) => {
  let origin: string | undefined;
  try {
    const { origin: parsedOrigin } = new URL(value);
    origin = parsedOrigin;
  } catch {
    origin = undefined;
  }
  return origin;
};

const trustedOriginsFor = (baseURL: string) => [
  ...new Set(
    [originFrom(baseURL), 'http://localhost:*', 'http://127.0.0.1:*', 'http://[::1]:*'].filter(
      (origin): origin is string => typeof origin === 'string',
    ),
  ),
];

const sharedAuthOptions = (config: CoursitionAuthConfig) => ({
  baseURL: config.baseURL,
  emailAndPassword: {
    enabled: true as const,
    password: {
      hash: hashCoursitionPassword,
      verify: verifyCoursitionPassword,
    },
  },
  secret: config.secret,
  trustedOrigins: trustedOriginsFor(config.baseURL),
});

export const createCoursitionAuth = (config: CoursitionAuthConfig) =>
  importAtRuntime<NodeSqliteModule>('node:sqlite').then(({ DatabaseSync }) =>
    ManagedRuntime.make(NodeFileSystem.layer).runPromise(
      Effect.gen(function* createAuthProgram() {
        const databaseDirectory = config.databasePath.replace(/[/\\][^/\\]+$/u, '');
        if (
          config.databasePath !== ':memory:' &&
          databaseDirectory !== config.databasePath &&
          databaseDirectory.length > 0
        ) {
          const fileSystem = yield* FileSystem.FileSystem;
          yield* fileSystem.makeDirectory(databaseDirectory, { recursive: true });
        }
        const database = yield* Effect.sync(() => {
          const connection = new DatabaseSync(config.databasePath);
          connection.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
          return connection;
        });
        const options = {
          ...sharedAuthOptions(config),
          database,
        };
        const auth = betterAuth(options);
        const migrations = yield* Effect.tryPromise(() => getMigrations(options));
        yield* Effect.tryPromise(() => migrations.runMigrations());
        return { auth, database };
      }),
    ),
  );

const createCloudflareAuth = (config: CoursitionAuthConfig) =>
  coursitionCloudflareBindings().then((bindings) => {
    const database = drizzle(bindings.COURSITION_DB, {
      schema: authSchema,
    });
    const auth = betterAuthMinimal({
      ...sharedAuthOptions(config),
      database: drizzleAdapter(database, {
        provider: 'sqlite',
        schema: authSchema,
      }),
    });
    return { auth };
  });

type CoursitionAuthRuntime =
  | Awaited<ReturnType<typeof createCoursitionAuth>>
  | Awaited<ReturnType<typeof createCloudflareAuth>>;

let authPromise: Promise<CoursitionAuthRuntime> | undefined;

export const getCoursitionAuth = () => {
  if (authPromise === undefined) {
    const processEnvironment = (
      globalThis as typeof globalThis & {
        process?: { env?: Record<string, string | undefined> };
      }
    ).process?.env;
    const backend = processEnvironment?.['COURSITION_STORE_BACKEND'];
    authPromise =
      backend === 'cloudflare'
        ? importAtRuntime<{ env: unknown }>('cloudflare:workers').then(({ env }) =>
            createCloudflareAuth(
              loadCoursitionAuthConfig(env as Record<string, string | undefined>),
            ),
          )
        : createCoursitionAuth(loadCoursitionAuthConfig());
  }
  return authPromise;
};

export const headersFromInput = (input: {
  cookies?: string;
  headers?: Record<string, string | undefined>;
}) => {
  const headers = new Headers();
  for (const [key, value] of Object.entries(input.headers ?? {})) {
    if (typeof value === 'string') {
      headers.set(key, value);
    }
  }
  if (typeof input.cookies === 'string' && input.cookies.length > 0) {
    headers.set('cookie', input.cookies);
  }
  return headers;
};

export const headersFromRequest = (request: Request) => new Headers(request.headers);
