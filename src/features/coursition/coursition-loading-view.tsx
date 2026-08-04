import { Skeleton } from '@techsio/ui-kit/atoms/skeleton';

import type { CoursitionRouteKind } from './coursition-workflow-app.types';
import type { Translate } from './translation';

const loadingTitleKeyByRouteKind = {
  auth: 'coursition.app.loading.sessionTitle',
  course: 'coursition.app.loading.courseTitle',
  dashboard: 'coursition.app.loading.dashboardTitle',
  root: 'coursition.app.loading.sessionTitle',
} as const satisfies Record<CoursitionRouteKind, string>;

export const CoursitionLoadingView = ({
  routeKind,
  t,
}: {
  routeKind: CoursitionRouteKind;
  t: Translate;
}) => (
  <section aria-busy="true" aria-live="polite" className="grid min-h-80 content-start gap-8 py-8">
    <div className="grid gap-2 border-b border-border-primary pb-6">
      <h1 className="text-balance text-xl font-semibold text-fg-primary">
        {t(loadingTitleKeyByRouteKind[routeKind])}
      </h1>
      <p className="text-pretty text-base text-fg-secondary sm:text-sm">
        {t('coursition.app.loading.body')}
      </p>
    </div>
    <div
      aria-hidden="true"
      className="grid divide-y divide-border-primary border-y border-border-primary"
    >
      <div className="grid gap-3 py-6">
        <Skeleton.Rectangle className="h-4 w-2/5 rounded-sm" variant="secondary" />
        <Skeleton.Rectangle className="h-3 w-4/5 rounded-sm" variant="secondary" />
      </div>
      <div className="grid gap-3 py-6">
        <Skeleton.Rectangle className="h-4 w-1/3 rounded-sm" variant="secondary" />
        <Skeleton.Rectangle className="h-3 w-3/5 rounded-sm" variant="secondary" />
      </div>
    </div>
  </section>
);
