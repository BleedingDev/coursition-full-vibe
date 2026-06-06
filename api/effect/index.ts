// @effect-diagnostics asyncFunction:off strictBooleanExpressions:off
import {
  Cookies,
  defineEffectBff,
  Effect,
  HttpApiBuilder,
  HttpServerResponse,
  Layer,
} from '@modern-js/plugin-bff/effect-server';
import type { HttpServerRequest } from '@modern-js/plugin-bff/effect-server';
import {
  CoursitionServerError,
  CoursitionUnauthorized,
  coursitionEffectApi,
} from '../../shared/coursition/effect-api.ts';
import { auth } from '../../server/coursition/auth.ts';
import { applyWorkflowAction } from '../../server/coursition/store.ts';

const messageFrom = (cause: unknown) =>
  cause instanceof Error ? cause.message : 'Coursition API request failed.';

const headersFromEffectRequest = (request: HttpServerRequest.HttpServerRequest) => {
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (typeof value === 'string') {
      headers.set(key, value);
    }
  }
  return headers;
};

const setCookieHeadersFrom = (response: Response) => {
  const headersWithCookies = response.headers as Headers & {
    getSetCookie?: () => string[];
  };
  const explicitCookies = headersWithCookies.getSetCookie?.() ?? [];
  if (explicitCookies.length > 0) {
    return explicitCookies;
  }
  const fallbackCookie = response.headers.get('set-cookie');
  return fallbackCookie ? [fallbackCookie] : [];
};

const authJsonResponse = (
  response: Response,
  body: { session: null } | { ok: boolean },
): Effect.Effect<HttpServerResponse.HttpServerResponse, CoursitionServerError> =>
  Effect.try({
    catch: (cause) => new CoursitionServerError({ message: messageFrom(cause) }),
    try: () => {
      if (!response.ok) {
        throw new Error(`Authentication request failed with status ${response.status}.`);
      }
      return Cookies.fromSetCookie(setCookieHeadersFrom(response));
    },
  }).pipe(
    Effect.flatMap((cookies) =>
      HttpServerResponse.json(body, {
        cookies,
        status: response.status,
      }),
    ),
    Effect.mapError((cause) => new CoursitionServerError({ message: messageFrom(cause) })),
  );

const sessionForRequest = (request: HttpServerRequest.HttpServerRequest) =>
  Effect.tryPromise({
    catch: (cause) => new CoursitionServerError({ message: messageFrom(cause) }),
    try: () => auth.api.getSession({ headers: headersFromEffectRequest(request) }),
  });

const ownerIdForRequest = (request: HttpServerRequest.HttpServerRequest) =>
  sessionForRequest(request).pipe(
    Effect.flatMap((session) => {
      if (session?.user?.id) {
        return Effect.succeed(session.user.id);
      }
      return Effect.fail(
        new CoursitionUnauthorized({
          message: 'Sign in before creating a course draft.',
        }),
      );
    }),
  );

const authLayer = HttpApiBuilder.group(coursitionEffectApi, 'auth', (handlers) =>
  handlers
    .handle('session', ({ request }) =>
      sessionForRequest(request).pipe(
        Effect.map((session) => ({
          session: session?.user
            ? {
                user: {
                  email: session.user.email,
                  id: session.user.id,
                  ...(session.user.name ? { name: session.user.name } : {}),
                },
              }
            : null,
        })),
      ),
    )
    .handle('signUp', ({ payload }) =>
      Effect.tryPromise({
        catch: (cause) => new CoursitionServerError({ message: messageFrom(cause) }),
        try: () =>
          auth.api.signUpEmail({
            asResponse: true,
            body: {
              email: payload.email,
              name: payload.name ?? payload.email,
              password: payload.password,
            },
          }),
      }).pipe(Effect.flatMap((response) => authJsonResponse(response, { session: null }))),
    )
    .handle('signIn', ({ payload }) =>
      Effect.tryPromise({
        catch: (cause) => new CoursitionServerError({ message: messageFrom(cause) }),
        try: () =>
          auth.api.signInEmail({
            asResponse: true,
            body: {
              email: payload.email,
              password: payload.password,
            },
          }),
      }).pipe(Effect.flatMap((response) => authJsonResponse(response, { session: null }))),
    )
    .handle('signOut', ({ request }) =>
      Effect.tryPromise({
        catch: (cause) => new CoursitionServerError({ message: messageFrom(cause) }),
        try: () =>
          auth.api.signOut({
            asResponse: true,
            headers: headersFromEffectRequest(request),
          }),
      }).pipe(Effect.flatMap((response) => authJsonResponse(response, { ok: true }))),
    ),
);

const workflowLayer = HttpApiBuilder.group(coursitionEffectApi, 'workflow', (handlers) =>
  handlers.handle('apply', ({ payload, request }) =>
    ownerIdForRequest(request).pipe(
      Effect.flatMap((ownerId) =>
        Effect.tryPromise({
          catch: (cause) => new CoursitionServerError({ message: messageFrom(cause) }),
          try: () => applyWorkflowAction(ownerId, payload),
        }),
      ),
    ),
  ),
);

const layer = HttpApiBuilder.layer(coursitionEffectApi).pipe(
  Layer.provide(authLayer),
  Layer.provide(workflowLayer),
);

export default defineEffectBff({
  api: coursitionEffectApi,
  layer,
});
