import type { SessionUser, WorkflowSnapshot } from '@shared/coursition/effect-api';
import type { CourseRouteLanguage, CourseRouteMatch } from '@shared/coursition/routes';

export interface CoursePageLoaderData {
  language: CourseRouteLanguage;
  route: CourseRouteMatch | null;
  sessionUser: SessionUser | null;
  snapshot: WorkflowSnapshot | null;
  theme?: 'light' | 'dark' | null;
}
