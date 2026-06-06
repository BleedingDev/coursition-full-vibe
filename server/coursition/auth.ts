import { betterAuth } from 'better-auth/minimal';
import { loadCoursitionAuthConfig } from './config.ts';

const config = loadCoursitionAuthConfig();

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

const trustedOrigins = [
  ...new Set(
    [
      originFrom(config.baseURL),
      'http://localhost:*',
      'http://127.0.0.1:*',
      'http://[::1]:*',
    ].filter((origin): origin is string => typeof origin === 'string'),
  ),
];

export const auth = betterAuth({
  baseURL: config.baseURL,
  emailAndPassword: {
    enabled: true,
  },
  secret: config.secret,
  trustedOrigins,
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
