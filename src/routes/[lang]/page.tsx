import { useEffect, useState } from 'react';
import { useModernI18n } from '@modern-js/plugin-i18n/runtime';
import { Link, useLoaderData, useLocation } from '@modern-js/plugin-tanstack/runtime';
import { Helmet } from '@modern-js/runtime/head';
import { Button } from '@techsio/ui-kit/atoms/button';
import * as Data from 'effect/Data';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';

import effectBff from '@api/effect/index';
import { CoursitionWorkflowApp } from '@/features/coursition/coursition-workflow-app';
import type { SupportedLanguage } from '@/features/coursition/i18n';
import { resolveCurrentLanguage, supportedLanguages } from '@/features/coursition/i18n';
import { coursePageLoaderDataFromUnknown } from '@/features/coursition/route-data';
import type { CoursePageLoaderData } from '@/features/coursition/route-data';
import {
  courseRoutePattern,
  courseRoutesMatch,
  courseRouteStepSlug,
  dashboardRoutePath,
  dashboardRoutePattern,
  parseCourseRoutePath,
} from '@/features/coursition/routes';
import type { CourseRouteMatch } from '@/features/coursition/routes';
import type { Translate } from '@/features/coursition/translation';

type ModernI18nInstance = ReturnType<typeof useModernI18n>['i18nInstance'];
type Theme = 'light' | 'dark' | 'system';

class PageEffectError extends Data.TaggedError('PageEffectError')<{
  readonly cause: unknown;
}> {}

const selectedMarkerClass = 'sr-only';
const stateToken = (label: string) => ` - ${label}`;
const recoverEffect = Effect.catch;

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
  theme,
}: {
  currentLanguage: SupportedLanguage;
  t: Translate;
  theme: Theme;
}) => (
  <Helmet
    htmlAttributes={{
      lang: currentLanguage,
      ...(theme === 'system' ? {} : { 'data-theme': theme }),
    }}
  >
    <title>{t('coursition.meta.title')}</title>
    <meta content={t('coursition.meta.description')} name="description" />
  </Helmet>
);

const SunIcon = () => (
  <svg
    aria-hidden="true"
    className="h-4 w-4"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="2"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2" />
    <path d="M12 20v2" />
    <path d="M4.93 4.93l1.41 1.41" />
    <path d="M17.66 17.66l1.41 1.41" />
    <path d="M2 12h2" />
    <path d="M20 12h2" />
    <path d="M6.34 17.66l-1.41 1.41" />
    <path d="M19.07 4.93l-1.41 1.41" />
  </svg>
);

const MoonIcon = () => (
  <svg
    aria-hidden="true"
    className="h-4 w-4"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="2"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
  </svg>
);

const routeSnapshotFor = (
  loaderSnapshot: CoursePageLoaderData['snapshot'] | undefined,
  currentCourseRoute: CourseRouteMatch | null,
  loaderRoute: CourseRouteMatch | null,
) => {
  const routeSnapshot = loaderSnapshot ?? null;
  if (
    routeSnapshot !== null &&
    (currentCourseRoute === null || !courseRoutesMatch(currentCourseRoute, loaderRoute))
  ) {
    return { ...routeSnapshot, draft: null };
  }
  return routeSnapshot;
};

const resolvedThemeFor = (theme: Theme, mounted: boolean): Exclude<Theme, 'system'> => {
  if (theme !== 'system') {
    return theme;
  }
  if (!mounted || typeof window === 'undefined') {
    return 'light';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const Index = () => {
  const { i18nInstance, language } = useModernI18n();
  const location = useLocation();
  const loaderData = Option.getOrUndefined(
    coursePageLoaderDataFromUnknown(useLoaderData({ strict: false })),
  );
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
  const routeSnapshot = routeSnapshotFor(loaderData?.snapshot, currentCourseRoute, loaderRoute);

  const [theme, setTheme] = useState<Theme>(loaderData?.theme ?? 'system');
  const [mounted, setMounted] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (theme === 'system') {
      delete document.documentElement.dataset['theme'];
    } else {
      document.documentElement.dataset['theme'] = theme;
    }
  }, [theme]);

  const toggleTheme = () => {
    let nextTheme: 'light' | 'dark';
    if (theme === 'system') {
      const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      nextTheme = isSystemDark ? 'light' : 'dark';
    } else {
      nextTheme = theme === 'dark' ? 'light' : 'dark';
    }
    setTheme(nextTheme);
    /* eslint-disable-next-line unicorn/no-document-cookie */
    document.cookie = `theme=${nextTheme}; path=/; max-age=31536000; SameSite=Lax`;
  };

  const signOut = () => {
    setIsSigningOut(true);
    Effect.runFork(
      Effect.tryPromise({
        catch: (cause) => new PageEffectError({ cause }),
        try: () => effectBff.client.auth.signOut({}),
      }).pipe(
        Effect.asVoid,
        Effect.flatMap(() =>
          Effect.sync(() => globalThis.location.assign(dashboardRoutePath(currentLanguage))),
        ),
        recoverEffect(() => Effect.sync(() => setIsSigningOut(false))),
      ),
    );
  };

  const resolvedTheme = resolvedThemeFor(theme, mounted);

  return (
    <div className="min-h-dvh bg-base text-fg-primary">
      <LocalizedHead currentLanguage={currentLanguage} t={t} theme={theme} />
      <a
        className="absolute left-2 top-2 z-50 h-px w-px overflow-hidden whitespace-nowrap rounded-md bg-base p-0 text-sm font-semibold text-fg-primary opacity-0 outline-none focus:h-auto focus:w-auto focus:px-3 focus:py-2 focus:opacity-100 focus:ring-2 focus:ring-slate-500"
        href="#course-studio"
      >
        {t('coursition.app.skipToStudio')}
      </a>
      <header className="sticky top-0 z-10 bg-base">
        <div className="mx-auto flex min-h-12 w-full max-w-[88rem] items-center justify-between gap-3 px-4 lg:px-8">
          <Link
            className="text-sm font-semibold tracking-normal text-fg-primary no-underline"
            params={{ lang: currentLanguage }}
            to={dashboardRoutePattern(currentLanguage)}
          >
            {t('coursition.common.productName')}
          </Link>
          <div className="flex items-center gap-2">
            <nav
              className="inline-flex items-center gap-1"
              aria-label={t('coursition.languages.switcher')}
            >
              {supportedLanguages.map((code) => {
                const linkClassName = `rounded-md px-2 py-1 text-xs font-medium no-underline text-fg-secondary transition hover:bg-fill-hover hover:text-fg-primary ${
                  currentLanguage === code ? 'bg-fill-base font-semibold text-fg-primary' : ''
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
            <Button
              theme="unstyled"
              size="current"
              aria-label={
                resolvedTheme === 'dark'
                  ? t('coursition.common.theme.light')
                  : t('coursition.common.theme.dark')
              }
              className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-fill-base text-fg-primary transition hover:bg-fill-hover active:bg-fill-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={toggleTheme}
              type="button"
            >
              {resolvedTheme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </Button>
            {loaderData?.sessionUser === null || loaderData?.sessionUser === undefined ? null : (
              <button
                className="inline-flex min-h-10 items-center justify-center rounded-md bg-fill-base px-3 py-2 text-sm font-semibold text-fg-primary transition hover:bg-fill-hover active:bg-fill-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isSigningOut}
                onClick={signOut}
                type="button"
              >
                {t('coursition.app.auth.signOut')}
              </button>
            )}
          </div>
        </div>
      </header>

      <main
        data-coursition-workflow
        id="course-studio"
        tabIndex={-1}
        className="mx-auto grid w-full max-w-[88rem] gap-3 p-4 outline-none lg:px-8"
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
