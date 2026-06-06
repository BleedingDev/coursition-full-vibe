import { snapshotFor, snapshotForRoute } from '@server/coursition/store';
import { auth } from '@server/coursition/auth';
import * as Data from 'effect/Data';
import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import type { CoursePageLoaderData } from '@/features/coursition/route-data';
import { sessionPayloadSchema } from '@shared/coursition/effect-api';
import type { SessionPayload } from '@shared/coursition/effect-api';
import {
  courseRoutePath,
  isCourseRouteLanguage,
  parseCourseRoutePath,
} from '@shared/coursition/routes';
import { buildFindings } from '@shared/coursition/workflow';

interface CoursePageLoaderArgs {
  request: Request;
  params: Record<string, string | undefined>;
}

const requestPathname = (request: Request) => new URL(request.url, 'http://localhost').pathname;

const redirectResponse = (location: string) =>
  new Response(null, {
    headers: { Location: location },
    status: 302,
  });

class LoaderPromiseError extends Data.TaggedError('LoaderPromiseError')<{
  readonly cause: unknown;
}> {}

const foreignPromise = <A>(evaluate: () => PromiseLike<A>) =>
  Effect.tryPromise({
    catch: (cause) => new LoaderPromiseError({ cause }),
    try: evaluate,
  });

const sessionForRequest = (request: Request): Effect.Effect<SessionPayload['session']> =>
  foreignPromise(() => auth.api.getSession({ headers: request.headers })).pipe(
    Effect.flatMap((session) => Schema.decodeUnknownEffect(sessionPayloadSchema)({ session })),
    Effect.map((payload) => payload.session),
    Effect.orElseSucceed(() => null),
  );

const languageFrom = (
  params: Record<string, string | undefined>,
  pathname: string,
): CoursePageLoaderData['language'] => {
  const paramLanguage = params['lang'];
  if (typeof paramLanguage === 'string' && isCourseRouteLanguage(paramLanguage)) {
    return paramLanguage;
  }
  const segment = pathname.split('/').find((pathSegment) => pathSegment.length > 0);
  return typeof segment === 'string' && isCourseRouteLanguage(segment) ? segment : 'en';
};

const snapshotForLanguage = (
  snapshot: Awaited<ReturnType<typeof snapshotForRoute>>,
  language: CoursePageLoaderData['language'],
): Awaited<ReturnType<typeof snapshotForRoute>> => {
  if (snapshot.draft === null || snapshot.draft.language === language) {
    return snapshot;
  }
  const localizedDraft = { ...snapshot.draft, language };
  return {
    ...snapshot,
    draft: {
      ...localizedDraft,
      findings: buildFindings(localizedDraft),
    },
  };
};

const loaderEffect = ({
  params,
  request,
}: CoursePageLoaderArgs): Effect.Effect<CoursePageLoaderData | Response, LoaderPromiseError> =>
  Effect.gen(function* effectProgram() {
    const pathname = requestPathname(request);
    const language = languageFrom(params, pathname);
    const session = yield* sessionForRequest(request);
    const sessionUser =
      session?.user === undefined || session.user === null
        ? null
        : {
            email: session.user.email,
            id: session.user.id,
            ...(typeof session.user.name === 'string' && session.user.name.length > 0
              ? { name: session.user.name }
              : {}),
          };
    const route = parseCourseRoutePath(pathname);

    const cookieHeader = request.headers.get('cookie') ?? '';
    let theme: 'light' | 'dark' | null = null;
    const themeMatch = cookieHeader.match(/(?:^|;\s*)theme=(light|dark)(?:;|$)/u);
    if (themeMatch !== null) {
      theme = themeMatch[1] as 'light' | 'dark';
    }

    if (
      route === null &&
      (typeof params['courseId'] === 'string' || typeof params['step'] === 'string')
    ) {
      return new Response(null, { status: 404 });
    }
    if (sessionUser === null) {
      return {
        language,
        route,
        sessionUser: null,
        snapshot: null,
        theme,
      };
    }
    if (route === null) {
      const snapshot = yield* foreignPromise(() => snapshotFor(sessionUser.id));
      return {
        language,
        route: null,
        sessionUser,
        snapshot: {
          ...snapshot,
          draft: null,
        },
        theme,
      };
    }

    const snapshotResult = yield* foreignPromise(() =>
      snapshotForRoute(sessionUser.id, route.draftId, route.step),
    ).pipe(
      Effect.map((snapshot) => ({
        snapshot: snapshotForLanguage(snapshot, language),
        type: 'snapshot' as const,
      })),
      Effect.orElseSucceed(() => ({ type: 'notFound' as const })),
    );
    if (snapshotResult.type === 'notFound') {
      return new Response(null, { status: 404 });
    }
    const { snapshot } = snapshotResult;
    const { draft } = snapshot;
    if (draft !== null && draft.step !== route.step) {
      return redirectResponse(courseRoutePath(language, draft.id, draft.step));
    }
    return {
      language,
      route,
      sessionUser,
      snapshot,
      theme,
    };
  });

export const loader = (args: CoursePageLoaderArgs): Promise<CoursePageLoaderData | Response> =>
  Effect.runPromise(loaderEffect(args));
