import { useModernI18n } from '@modern-js/plugin-i18n/runtime';
import { Link, useLoaderData, useLocation } from '@modern-js/plugin-tanstack/runtime';
import { Helmet } from '@modern-js/runtime/head';

import { CoursitionWorkflowApp } from '@/features/coursition/coursition-workflow-app';
import type { SupportedLanguage } from '@/features/coursition/i18n';
import { resolveCurrentLanguage, supportedLanguages } from '@/features/coursition/i18n';
import type { CoursePageLoaderData } from '@/features/coursition/route-data';
import {
  courseRoutePattern,
  courseRoutesMatch,
  courseRouteStepSlug,
  dashboardRoutePattern,
  parseCourseRoutePath,
} from '@/features/coursition/routes';
import type { Translate } from '@/features/coursition/translation';

type ModernI18nInstance = ReturnType<typeof useModernI18n>['i18nInstance'];

const selectedMarkerClass = 'sr-only';
const stateToken = (label: string) => ` - ${label}`;

const createTranslate = (
  i18nInstance: ModernI18nInstance,
  currentLanguage: SupportedLanguage,
): Translate => {
  const translate = i18nInstance['t'].bind(i18nInstance);
  return function translateKey(key, options) {
    return String(translate(key, { ...options, lng: currentLanguage }));
  };
};

const LocalizedHead = ({
  currentLanguage,
  t,
}: {
  currentLanguage: SupportedLanguage;
  t: Translate;
}) => (
  <Helmet htmlAttributes={{ lang: currentLanguage }}>
    <title>{t('coursition.meta.title')}</title>
    <meta content={t('coursition.meta.description')} name="description" />
  </Helmet>
);

const Index = () => {
  const { i18nInstance, language } = useModernI18n();
  const location = useLocation();
  const loaderData = useLoaderData({ strict: false }) as CoursePageLoaderData | undefined;
  const { language: loaderLanguage } = loaderData ?? {};
  const currentLanguage = resolveCurrentLanguage({
    loaderLanguage,
    pathname: location.pathname,
    runtimeLanguage: language,
  });
  const t = createTranslate(i18nInstance, currentLanguage);
  const currentCourseRoute = parseCourseRoutePath(location.pathname);
  const loaderRoute = loaderData?.route ?? null;
  const activeRoute = currentCourseRoute ?? loaderRoute;
  let routeSnapshot = loaderData?.snapshot ?? null;
  if (
    routeSnapshot !== null &&
    (currentCourseRoute === null || !courseRoutesMatch(currentCourseRoute, loaderRoute))
  ) {
    routeSnapshot = { ...routeSnapshot, draft: null };
  }
  return (
    <div className="light min-h-dvh bg-white text-slate-950">
      <LocalizedHead currentLanguage={currentLanguage} t={t} />
      <a
        className="absolute left-2 top-2 z-50 h-px w-px overflow-hidden whitespace-nowrap rounded-md bg-white p-0 text-sm font-semibold text-slate-950 opacity-0 outline-none focus:h-auto focus:w-auto focus:px-3 focus:py-2 focus:opacity-100 focus:ring-2 focus:ring-slate-500"
        href="#course-studio"
      >
        {t('coursition.app.skipToStudio')}
      </a>
      <header className="sticky top-0 z-10 flex min-h-14 items-center justify-between gap-3 bg-white px-4">
        <div className="flex items-center gap-2">
          <Link
            className="text-sm font-semibold tracking-normal text-slate-950 no-underline"
            params={{ lang: currentLanguage }}
            to={dashboardRoutePattern(currentLanguage)}
          >
            {t('coursition.common.productName')}
          </Link>
        </div>
        <nav
          className="inline-flex items-center gap-1"
          aria-label={t('coursition.languages.switcher')}
        >
          {supportedLanguages.map((code) => {
            const linkClassName = `px-2 py-1.5 text-xs font-medium no-underline text-slate-950 ${
              currentLanguage === code
                ? 'font-semibold underline decoration-2 underline-offset-4'
                : ''
            }`;
            if (currentCourseRoute !== null) {
              return (
                <Link
                  aria-current={currentLanguage === code ? 'page' : undefined}
                  className={linkClassName}
                  key={code}
                  params={{
                    courseId: currentCourseRoute.draftId,
                    lang: code,
                    step: courseRouteStepSlug(code, currentCourseRoute.step),
                  }}
                  to={courseRoutePattern(code)}
                >
                  {t(`coursition.languages.${code}`)}
                  {currentLanguage === code ? (
                    <span className={selectedMarkerClass}>
                      {stateToken(t('coursition.app.selected'))}
                    </span>
                  ) : null}
                </Link>
              );
            }
            return (
              <Link
                aria-current={currentLanguage === code ? 'page' : undefined}
                className={linkClassName}
                key={code}
                params={{ lang: code }}
                to={dashboardRoutePattern(code)}
              >
                {t(`coursition.languages.${code}`)}
                {currentLanguage === code ? (
                  <span className={selectedMarkerClass}>
                    {stateToken(t('coursition.app.selected'))}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      </header>

      <main
        id="course-studio"
        tabIndex={-1}
        className="mx-auto grid w-full max-w-[88rem] gap-4 p-4 outline-none lg:px-8"
      >
        <CoursitionWorkflowApp
          initialRoute={activeRoute}
          initialSessionUser={loaderData?.sessionUser ?? null}
          initialSnapshot={routeSnapshot}
          language={currentLanguage}
          t={t}
        />
      </main>
    </div>
  );
};

export default Index;
