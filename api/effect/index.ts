import {
  Cookies,
  defineEffectBff,
  Effect,
  HttpApiBuilder,
  HttpServerResponse,
  Layer,
  Schema,
} from '@modern-js/plugin-bff/effect-server';
import type { HttpServerRequest } from '@modern-js/plugin-bff/effect-server';
import {
  CoursitionServerError,
  CoursitionUnauthorized,
  coursitionEffectApi,
  sessionPayloadSchema,
} from '../../shared/coursition/effect-api.ts';
import { auth } from '../../server/coursition/auth.ts';
import { evaluateActivityAnswerWithAi } from '../../server/coursition/ai-provider.ts';
import { applyWorkflowAction, draftForOwner } from '../../server/coursition/store.ts';

const messageFrom = (cause: unknown) =>
  cause instanceof Error ? cause.message : 'Coursition API request failed.';

type AuthAction = 'signIn' | 'signOut' | 'signUp';

const fallbackAuthFailureMessages: Record<AuthAction, string> = {
  signIn: 'Sign in failed. Check your email and password.',
  signOut: 'Sign out failed. Refresh the page and try again.',
  signUp: 'Create account failed. Check the form and try again.',
};

const sharedBlockedOriginMessage =
  'Authentication was blocked for this local page. Reload the app and try again.';

const staticAuthFailureMessages: Record<string, string> = {
  CROSS_SITE_NAVIGATION_LOGIN_BLOCKED: sharedBlockedOriginMessage,
  EMAIL_NOT_VERIFIED: 'Verify your email before signing in.',
  EMAIL_PASSWORD_DISABLED: 'Email and password sign in is not enabled for this app.',
  EMAIL_PASSWORD_SIGN_UP_DISABLED: 'Account creation is not enabled for this app.',
  FAILED_TO_CREATE_USER: 'The account could not be created. Try again in a moment.',
  INVALID_EMAIL: 'Enter a valid email address.',
  INVALID_EMAIL_OR_PASSWORD: 'Email or password is incorrect.',
  INVALID_ORIGIN: sharedBlockedOriginMessage,
  INVALID_PASSWORD: 'Enter a password and try again.',
  MISSING_OR_NULL_ORIGIN: sharedBlockedOriginMessage,
  PASSWORD_TOO_LONG: 'Use a shorter password.',
  PASSWORD_TOO_SHORT: 'Use at least 8 characters for the password.',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:
    'An account already exists for this email. Sign in instead.',
};

const knownAuthFailureMessage = (code: string, action: AuthAction) => {
  if (code === 'FAILED_TO_CREATE_SESSION') {
    return action === 'signUp'
      ? 'Your account was created, but the app could not start a session. Try signing in.'
      : 'The app could not start a session. Try signing in again.';
  }
  return staticAuthFailureMessages[code] ?? null;
};

const stringField = (payload: Record<string, unknown> | null, key: string) => {
  const value = payload?.[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
};

const authFailurePayloadFrom = (response: Response) => {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('json')) {
    return Effect.succeed(null);
  }
  return Effect.tryPromise({
    catch: () => null,
    try: () => response.clone().json() as Promise<unknown>,
  }).pipe(
    Effect.map((payload) =>
      typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>) : null,
    ),
    Effect.orElseSucceed(() => null),
  );
};

const authFailureMessageFrom = (response: Response, action: AuthAction) =>
  authFailurePayloadFrom(response).pipe(
    Effect.map((payload) => {
      const code = stringField(payload, 'code');
      if (code !== null) {
        const message = knownAuthFailureMessage(code, action);
        if (message !== null) {
          return message;
        }
      }
      const message = stringField(payload, 'message');
      return message ?? fallbackAuthFailureMessages[action];
    }),
  );

const failedAuthResponse = (response: Response, action: AuthAction) =>
  authFailureMessageFrom(response, action).pipe(
    Effect.flatMap((message) => Effect.fail(new CoursitionServerError({ message }))),
  );

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
  return typeof fallbackCookie === 'string' ? [fallbackCookie] : [];
};

const authResponseCookies = (response: Response) =>
  Effect.try({
    catch: (cause) => new CoursitionServerError({ message: messageFrom(cause) }),
    try: () => Cookies.fromSetCookie(setCookieHeadersFrom(response)),
  });

const cookiesForAuthResponse = (response: Response, action: AuthAction) => {
  if (!response.ok) {
    return failedAuthResponse(response, action);
  }
  return authResponseCookies(response);
};

const authJsonResponse = (
  response: Response,
  body: { session: null } | { ok: boolean },
  action: AuthAction,
): Effect.Effect<HttpServerResponse.HttpServerResponse, CoursitionServerError> =>
  cookiesForAuthResponse(response, action).pipe(
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

const sessionPayloadFromAuthSession = (session: unknown) =>
  Schema.decodeUnknownEffect(sessionPayloadSchema)({ session }).pipe(
    Effect.mapError((cause) => new CoursitionServerError({ message: messageFrom(cause) })),
  );

const nonEmptyOwnerIdFrom = (id: unknown) =>
  Schema.decodeUnknownEffect(Schema.NonEmptyString)(id).pipe(
    Effect.mapError(
      () =>
        new CoursitionUnauthorized({
          message: 'Sign in before creating a course draft.',
        }),
    ),
  );

const ownerIdForRequest = (request: HttpServerRequest.HttpServerRequest) =>
  sessionForRequest(request).pipe(
    Effect.flatMap(sessionPayloadFromAuthSession),
    Effect.flatMap((payload) => {
      if (payload.session !== null) {
        return nonEmptyOwnerIdFrom(payload.session.user.id);
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
      sessionForRequest(request).pipe(Effect.flatMap(sessionPayloadFromAuthSession)),
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
      }).pipe(
        Effect.flatMap((response) => authJsonResponse(response, { session: null }, 'signUp')),
      ),
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
      }).pipe(
        Effect.flatMap((response) => authJsonResponse(response, { session: null }, 'signIn')),
      ),
    )
    .handle('signOut', ({ request }) =>
      Effect.tryPromise({
        catch: (cause) => new CoursitionServerError({ message: messageFrom(cause) }),
        try: () =>
          auth.api.signOut({
            asResponse: true,
            headers: headersFromEffectRequest(request),
          }),
      }).pipe(Effect.flatMap((response) => authJsonResponse(response, { ok: true }, 'signOut'))),
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

const activityEvaluationLayer = HttpApiBuilder.group(
  coursitionEffectApi,
  'activityEvaluation',
  (handlers) =>
    handlers.handle('evaluate', ({ payload, request }) =>
      ownerIdForRequest(request).pipe(
        Effect.flatMap((ownerId) =>
          Effect.gen(function* evaluateActivityProgram() {
            const draft = yield* Effect.tryPromise({
              catch: (cause) => new CoursitionServerError({ message: messageFrom(cause) }),
              try: () => draftForOwner(ownerId, payload.draftId),
            });
            const activity = draft.learningBlueprint.generatedActivities.find(
              (candidate) => candidate.id === payload.activityId,
            );
            if (activity === undefined) {
              return yield* new CoursitionServerError({
                message: 'Activity is not available for evaluation.',
              });
            }
            if (activity.type !== 'practice_task' && activity.type !== 'rubric_answer') {
              return yield* new CoursitionServerError({
                message: 'Only open-ended activities can be evaluated with AI.',
              });
            }
            if (payload.answer.trim().length === 0) {
              return yield* new CoursitionServerError({
                message: 'Write an answer before requesting AI feedback.',
              });
            }
            const evaluation = yield* Effect.tryPromise({
              catch: (cause) => new CoursitionServerError({ message: messageFrom(cause) }),
              try: () =>
                evaluateActivityAnswerWithAi(
                  draft,
                  activity,
                  payload.answer,
                  payload.checkedCriteria,
                ),
            });
            return evaluation.value;
          }),
        ),
      ),
    ),
);

const layer = HttpApiBuilder.layer(coursitionEffectApi).pipe(
  Layer.provide(authLayer),
  Layer.provide(workflowLayer),
  Layer.provide(activityEvaluationLayer),
);

export default defineEffectBff({
  api: coursitionEffectApi,
  layer,
});
