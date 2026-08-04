import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test } from '@rstest/core';
import { createCoursitionAuth } from '../server/coursition/auth.ts';
import { loadCoursitionAuthConfig } from '../server/coursition/config.ts';

const openAuthDatabases: { close: () => void }[] = [];

afterEach(() => {
  for (const database of openAuthDatabases.splice(0)) {
    database.close();
  }
});

describe('Coursition authentication persistence', () => {
  test('a registered evaluator can sign in after the application restarts', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'coursition-auth-'));
    const databasePath = path.join(tempRoot, 'auth.sqlite');
    const options = {
      backend: 'json-file',
      baseURL: 'http://localhost:8080',
      databasePath,
      secret: 'coursition-auth-persistence-test-secret-that-is-long-enough',
    };

    try {
      const firstProcess = await createCoursitionAuth(options);
      openAuthDatabases.push(firstProcess.database);
      await firstProcess.auth.api.signUpEmail({
        body: {
          email: 'evaluator@example.test',
          name: 'CzechInvest Evaluator',
          password: 'durable-password-2026',
        },
      });
      firstProcess.database.close();
      openAuthDatabases.pop();

      const restartedProcess = await createCoursitionAuth(options);
      openAuthDatabases.push(restartedProcess.database);
      const session = await restartedProcess.auth.api.signInEmail({
        body: {
          email: 'evaluator@example.test',
          password: 'durable-password-2026',
        },
      });

      expect(session.user.email).toBe('evaluator@example.test');
    } finally {
      await fs.rm(tempRoot, { force: true, recursive: true });
    }
  });
});

describe('Coursition production authentication config', () => {
  test('requires a private secret for the Cloudflare backend', () => {
    const previousBackend = process.env['COURSITION_STORE_BACKEND'];
    const previousNodeEnv = process.env['NODE_ENV'];
    const previousSecret = process.env['BETTER_AUTH_SECRET'];
    process.env['COURSITION_STORE_BACKEND'] = 'cloudflare';
    process.env['NODE_ENV'] = 'development';
    Reflect.deleteProperty(process.env, 'BETTER_AUTH_SECRET');

    try {
      expect(() => loadCoursitionAuthConfig()).toThrow('BETTER_AUTH_SECRET');
    } finally {
      if (previousBackend === undefined) {
        Reflect.deleteProperty(process.env, 'COURSITION_STORE_BACKEND');
      } else {
        process.env['COURSITION_STORE_BACKEND'] = previousBackend;
      }
      if (previousNodeEnv === undefined) {
        Reflect.deleteProperty(process.env, 'NODE_ENV');
      } else {
        process.env['NODE_ENV'] = previousNodeEnv;
      }
      if (previousSecret === undefined) {
        Reflect.deleteProperty(process.env, 'BETTER_AUTH_SECRET');
      } else {
        process.env['BETTER_AUTH_SECRET'] = previousSecret;
      }
    }
  });

  test('rejects the development secret in production', () => {
    const previousNodeEnv = process.env['NODE_ENV'];
    const previousSecret = process.env['BETTER_AUTH_SECRET'];
    process.env['NODE_ENV'] = 'production';
    Reflect.deleteProperty(process.env, 'BETTER_AUTH_SECRET');

    try {
      expect(() => loadCoursitionAuthConfig()).toThrow('BETTER_AUTH_SECRET');
    } finally {
      if (previousNodeEnv === undefined) {
        Reflect.deleteProperty(process.env, 'NODE_ENV');
      } else {
        process.env['NODE_ENV'] = previousNodeEnv;
      }
      if (previousSecret === undefined) {
        Reflect.deleteProperty(process.env, 'BETTER_AUTH_SECRET');
      } else {
        process.env['BETTER_AUTH_SECRET'] = previousSecret;
      }
    }
  });
});
