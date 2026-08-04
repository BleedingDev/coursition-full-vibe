import type { SessionUser } from '@shared/api';
import { authRoutePath, dashboardRoutePath } from '@shared/coursition/routes';
import type { CourseRouteLanguage, CourseRouteMatch } from '@shared/coursition/routes';
import type { CoursitionRouteKind } from './coursition-workflow-app.types';

export const snapshotRouteKeyFor = (
  routeKind: CoursitionRouteKind,
  route: CourseRouteMatch | null,
) => {
  if (routeKind === 'dashboard') {
    return 'dashboard';
  }
  return routeKind === 'course' && route !== null ? `${route.draftId}:${route.step}` : null;
};

export const sessionRedirectPathFor = ({
  isSessionResolved,
  language,
  routeKind,
  sessionUser,
}: {
  isSessionResolved: boolean;
  language: CourseRouteLanguage;
  routeKind: CoursitionRouteKind;
  sessionUser: SessionUser | null;
}) => {
  if (!isSessionResolved) {
    return null;
  }
  if (sessionUser === null) {
    return routeKind === 'auth' ? null : authRoutePath(language, 'signIn');
  }
  return routeKind === 'auth' || routeKind === 'root' ? dashboardRoutePath(language) : null;
};

export const snapshotLoadStatusFor = ({
  errorRouteKey,
  loadedRouteKey,
  requestedRouteKey,
}: {
  errorRouteKey: string | null;
  loadedRouteKey: string | null;
  requestedRouteKey: string | null;
}): 'error' | 'loading' | 'ready' => {
  if (loadedRouteKey === requestedRouteKey) {
    return 'ready';
  }
  return errorRouteKey === requestedRouteKey ? 'error' : 'loading';
};
