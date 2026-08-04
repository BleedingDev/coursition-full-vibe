import { lazy, Suspense } from 'react';
import type { ComponentType } from 'react';
import type { CoursitionWorkflowAppProps } from './coursition-workflow-app.types';

const ServerWorkflowPlaceholder = (_props: CoursitionWorkflowAppProps) => null;

declare const __COURSITION_BROWSER_BUILD__: boolean;

const loadCoursitionWorkflowApp = (): Promise<{
  default: ComponentType<CoursitionWorkflowAppProps>;
}> =>
  __COURSITION_BROWSER_BUILD__
    ? import('./coursition-workflow-app')
    : Promise.resolve({ default: ServerWorkflowPlaceholder });

const LazyCoursitionWorkflowApp = lazy(loadCoursitionWorkflowApp);

export const CoursitionWorkflowApp = (props: CoursitionWorkflowAppProps) => (
  <Suspense fallback={null}>
    <LazyCoursitionWorkflowApp {...props} />
  </Suspense>
);
