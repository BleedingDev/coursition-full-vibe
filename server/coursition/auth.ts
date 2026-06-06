// @effect-diagnostics processEnv:off
import { betterAuth } from 'better-auth';

const secret =
  process.env['BETTER_AUTH_SECRET'] ??
  'coursition-dev-secret-2026-06-02-fully-local-auth-session-key-64-bytes';

export const auth = betterAuth({
  baseURL: process.env['BETTER_AUTH_URL'] ?? 'http://localhost:8080',
  emailAndPassword: {
    enabled: true,
  },
  secret,
});

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
