// @effect-diagnostics asyncFunction:off globalFetch:off
import { snapshotFor, snapshotForRoute } from '@server/coursition/store';
import type { CoursePageLoaderData } from '@/features/coursition/route-data';
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

const sessionForRequest = async (request: Request): Promise<SessionPayload['session']> => {
  const sessionUrl = new URL('/api/auth/session', request.url);
  const headers = new Headers({ accept: 'application/json' });
  const cookie = request.headers.get('cookie');
  if (cookie !== null && cookie.length > 0) {
    headers.set('cookie', cookie);
  }
  const response = await fetch(sessionUrl, { headers });
  if (!response.ok) {
    return null;
  }
  const payload = (await response.json()) as SessionPayload;
  return payload.session;
};

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

export const loader = async ({
  params,
  request,
}: CoursePageLoaderArgs): Promise<CoursePageLoaderData | Response> => {
  const pathname = requestPathname(request);
  const language = languageFrom(params, pathname);
  const session = await sessionForRequest(request);
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
    };
  }
  if (route === null) {
    const snapshot = await snapshotFor(sessionUser.id);
    return {
      language,
      route: null,
      sessionUser,
      snapshot: {
        ...snapshot,
        draft: null,
      },
    };
  }

  let snapshot: Awaited<ReturnType<typeof snapshotForRoute>>;
  try {
    snapshot = snapshotForLanguage(
      await snapshotForRoute(sessionUser.id, route.draftId, route.step),
      language,
    );
  } catch {
    return new Response(null, { status: 404 });
  }
  if (snapshot.draft !== null && snapshot.draft.step !== route.step) {
    return redirectResponse(courseRoutePath(language, snapshot.draft.id, snapshot.draft.step));
  }
  return {
    language,
    route,
    sessionUser,
    snapshot,
  };
};
