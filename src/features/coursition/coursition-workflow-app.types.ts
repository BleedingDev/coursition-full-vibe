import type { SessionUser, WorkflowSnapshot } from '@shared/api';
import type { AuthMode, CourseRouteLanguage, CourseRouteMatch } from '@shared/coursition/routes';
import type { Translate } from './translation';

export type CoursitionRouteKind = 'auth' | 'course' | 'dashboard' | 'root';

export interface CoursitionWorkflowAppProps {
  authMode?: AuthMode | null;
  initialRoute?: CourseRouteMatch | null;
  initialSessionUser?: SessionUser | null;
  initialSnapshot?: WorkflowSnapshot | null;
  language: CourseRouteLanguage;
  onSessionUserChange?: (sessionUser: SessionUser | null) => void;
  routeKind: CoursitionRouteKind;
  t: Translate;
}
