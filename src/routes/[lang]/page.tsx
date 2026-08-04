import { useEffect, useState } from 'react';
import { useModernI18n } from '@modern-js/plugin-i18n/runtime';
import { Helmet } from '@modern-js/runtime/head';
import { Button } from '@techsio/ui-kit/atoms/button';
import { LinkButton } from '@techsio/ui-kit/atoms/link-button';
import { useToast } from '@techsio/ui-kit/molecules/toast';
import { Link, useLoaderData, useLocation, useRouterState } from '@tanstack/react-router';
import * as Data from 'effect/Data';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';

import effectBff from '@api/index';
import { CoursitionFooter } from '@/features/coursition/coursition-footer';
import { CoursitionLandingPage } from '@/features/coursition/coursition-landing-page';
import { CoursitionWorkflowApp } from '@/features/coursition/coursition-workflow-app-entry';
import type { CoursitionRouteKind } from '@/features/coursition/coursition-workflow-app.types';
import { flushAllPendingCoursitionDraftSaves } from '@/features/coursition/workflow-form-integrity';
import type { SupportedLanguage } from '@/features/coursition/i18n';
import { resolveCurrentLanguage } from '@/features/coursition/i18n';
import { coursePageLoaderDataFromUnknown } from '@/features/coursition/route-data';
import type { CoursePageLoaderData } from '@/features/coursition/route-data';
import {
  authRoutePath,
  authRoutePattern,
  courseRoutePattern,
  courseRoutesMatch,
  courseRouteStepSlug,
  dashboardRoutePath,
  dashboardRoutePattern,
  localizedPathForLanguage,
  parseAuthRoutePath,
  parseCourseRoutePath,
} from '@/features/coursition/routes';
import type { CourseRouteMatch } from '@/features/coursition/routes';
import type { Translate } from '@/features/coursition/translation';

type ModernI18nInstance = ReturnType<typeof useModernI18n>['i18nInstance'];
type Theme = 'light' | 'dark' | 'system';
type ExplicitTheme = Exclude<Theme, 'system'>;

class PageEffectError extends Data.TaggedError('PageEffectError')<{
  readonly cause: unknown;
}> {}

const languageFlags: Record<SupportedLanguage, string> = {
  cs: '🇨🇿',
  en: '🇬🇧',
};
const landingRoutePattern = '/$lang';
const themeCookieName = 'theme';
const themePreferenceStorageKey = 'coursition-theme';
const recoverEffect = Effect.catch;

const explicitThemeFrom = (value: unknown): ExplicitTheme | null =>
  value === 'light' || value === 'dark' ? value : null;

const themeCookieFromBrowser = (): ExplicitTheme | null => {
  if (typeof document === 'undefined') {
    return null;
  }
  const themeCookie = document.cookie
    .split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${themeCookieName}=`));
  return explicitThemeFrom(themeCookie?.slice(themeCookieName.length + 1));
};

const themePreferenceFromBrowser = (fallback: Theme): Theme => {
  if (typeof window === 'undefined') {
    return fallback;
  }
  try {
    return (
      explicitThemeFrom(window.localStorage.getItem(themePreferenceStorageKey)) ??
      themeCookieFromBrowser() ??
      fallback
    );
  } catch {
    return themeCookieFromBrowser() ?? fallback;
  }
};

const persistThemePreference = (theme: ExplicitTheme) => {
  try {
    window.localStorage.setItem(themePreferenceStorageKey, theme);
  } catch {
    // The SSR cookie below remains the persistence fallback when storage is unavailable.
  }
  /* eslint-disable-next-line unicorn/no-document-cookie */
  document.cookie = `${themeCookieName}=${theme}; path=/; max-age=31536000; SameSite=Lax`;
};

const createTranslate = (
  i18nInstance: ModernI18nInstance,
  currentLanguage: SupportedLanguage,
): Translate => {
  const translate = i18nInstance['t'].bind(i18nInstance);
  return function translateKey(key, options) {
    return String(translate(key, { ...options, lng: currentLanguage }));
  };
};

const openGraphLocales = {
  cs: 'cs_CZ',
  en: 'en_GB',
} as const satisfies Record<SupportedLanguage, string>;

/* Purpose-built 1200x630 share cards, rendered per locale from the landing
 * hero so the preview matches the page a visitor lands on. */
const socialImagePaths = {
  cs: '/social/og-cs.png',
  en: '/social/og-en.png',
} as const satisfies Record<SupportedLanguage, string>;
const socialImageWidth = '1200';
const socialImageHeight = '630';

/**
 * Production origin injected at build time via `ULTRAMODERN_SITE_URL`.
 * Falls back to the browser origin, and finally to an empty string so that
 * server-rendered markup emits relative URLs instead of broken absolute ones.
 */
const resolveSiteOrigin = (): string => {
  const configured = typeof ULTRAMODERN_SITE_URL === 'string' ? ULTRAMODERN_SITE_URL.trim() : '';
  if (configured !== '') {
    return configured.replace(/\/+$/u, '');
  }
  return typeof window === 'undefined' ? '' : window.location.origin;
};

/* Only the public landing page belongs in a search index; the studio, dashboard
 * and auth screens are application surfaces, so they carry `noindex`. */
const LocalizedHead = ({
  currentLanguage,
  isIndexable,
  pathname,
  t,
  theme,
}: {
  currentLanguage: SupportedLanguage;
  isIndexable: boolean;
  pathname: string;
  t: Translate;
  theme: Theme;
}) => {
  const origin = resolveSiteOrigin();
  const alternateLanguage: SupportedLanguage = currentLanguage === 'en' ? 'cs' : 'en';
  const csUrl = `${origin}${localizedPathForLanguage(pathname, 'cs')}`;
  const enUrl = `${origin}${localizedPathForLanguage(pathname, 'en')}`;
  const canonicalUrl = currentLanguage === 'cs' ? csUrl : enUrl;
  const socialImageUrl = `${origin}${socialImagePaths[currentLanguage]}`;

  return (
    <Helmet
      htmlAttributes={{
        lang: currentLanguage,
        ...(theme === 'system' ? {} : { className: theme }),
      }}
    >
      <title>{t('coursition.meta.title')}</title>
      <meta content={t('coursition.meta.description')} name="description" />
      <meta content={isIndexable ? 'index, follow' : 'noindex, follow'} name="robots" />
      <link href="/favicon.svg" rel="icon" type="image/svg+xml" />
      <link href="/favicon.svg" rel="apple-touch-icon" />
      <link href={canonicalUrl} rel="canonical" />
      <link href={csUrl} hrefLang="cs" rel="alternate" />
      <link href={enUrl} hrefLang="en" rel="alternate" />
      <link href={enUrl} hrefLang="x-default" rel="alternate" />
      <meta content="website" property="og:type" />
      <meta content={t('coursition.common.productName')} property="og:site_name" />
      <meta content={openGraphLocales[currentLanguage]} property="og:locale" />
      <meta content={openGraphLocales[alternateLanguage]} property="og:locale:alternate" />
      <meta content={t('coursition.meta.title')} property="og:title" />
      <meta content={t('coursition.meta.description')} property="og:description" />
      <meta content={canonicalUrl} property="og:url" />
      <meta content={socialImageUrl} property="og:image" />
      <meta content={socialImageWidth} property="og:image:width" />
      <meta content={socialImageHeight} property="og:image:height" />
      <meta content={t('coursition.meta.imageAlt')} property="og:image:alt" />
      <meta content="summary_large_image" name="twitter:card" />
      <meta content={t('coursition.meta.title')} name="twitter:title" />
      <meta content={t('coursition.meta.description')} name="twitter:description" />
      <meta content={socialImageUrl} name="twitter:image" />
      <meta content={t('coursition.meta.imageAlt')} name="twitter:image:alt" />
    </Helmet>
  );
};

/* Kept out of the page body so the route component stays under the complexity
 * budget; the header CTA only appears to signed-out visitors on the landing. */
const LandingHeaderCta = ({
  language,
  show,
  t,
}: {
  language: SupportedLanguage;
  show: boolean;
  t: Translate;
}) =>
  show ? (
    <>
      <a
        className="coursition-header-signin hidden px-2 text-sm font-medium text-fg-secondary no-underline transition-colors hover:text-fg-primary sm:inline-block"
        href={authRoutePath(language, 'signIn')}
      >
        {t('coursition.common.headerSignIn')}
      </a>
      <LinkButton
        className="coursition-header-cta inline-flex"
        href={authRoutePath(language, 'signUp')}
        size="sm"
        theme="solid"
        variant="primary"
      >
        {t('coursition.common.headerCta')}
      </LinkButton>
    </>
  ) : null;

const SunIcon = () => (
  <svg
    aria-hidden="true"
    className="size-5"
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
    className="size-5"
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

const resolvedThemeFor = (theme: Theme, isSystemDark: boolean): ExplicitTheme => {
  if (theme === 'system') {
    return isSystemDark ? 'dark' : 'light';
  }
  return theme;
};

const routeKindFor = ({
  isAuthRoute,
  isCourseRoute,
  isDashboardRoute,
}: {
  isAuthRoute: boolean;
  isCourseRoute: boolean;
  isDashboardRoute: boolean;
}): CoursitionRouteKind => {
  if (isAuthRoute) {
    return 'auth';
  }
  if (isCourseRoute) {
    return 'course';
  }
  return isDashboardRoute ? 'dashboard' : 'root';
};

const Index = () => {
  const toast = useToast();
  const { i18nInstance, language } = useModernI18n();
  const location = useLocation();
  const isRoutePending = useRouterState({ select: (state) => state.isLoading });
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
  const otherLanguage: SupportedLanguage = currentLanguage === 'en' ? 'cs' : 'en';
  const currentCourseRoute = parseCourseRoutePath(location.pathname);
  const currentAuthRoute = parseAuthRoutePath(location.pathname);
  const isDashboardRoute = location.pathname === dashboardRoutePath(currentLanguage);
  const routeKind = routeKindFor({
    isAuthRoute: currentAuthRoute !== null,
    isCourseRoute: currentCourseRoute !== null,
    isDashboardRoute,
  });
  const isLandingRoute = routeKind === 'root';
  /* `routeKind === 'root'` also matches unknown paths such as /robots.txt, which
   * the catch-all renders as the landing page. Only the bare locale root is a
   * real, indexable page. */
  const isIndexableRoute = isLandingRoute && /^\/(cs|en)\/?$/u.test(location.pathname);
  const loaderRoute = loaderData?.route ?? null;
  const activeRoute = currentCourseRoute ?? loaderRoute;
  const routeSnapshot = routeSnapshotFor(loaderData?.snapshot, currentCourseRoute, loaderRoute);

  const [theme, setTheme] = useState<Theme>(() =>
    themePreferenceFromBrowser(loaderData?.theme ?? 'system'),
  );
  const [isSystemDark, setIsSystemDark] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [runtimeSessionUser, setRuntimeSessionUser] = useState(loaderData?.sessionUser ?? null);
  const isLandingHeaderCtaVisible = isLandingRoute && runtimeSessionUser === null;

  useEffect(() => {
    const colorScheme = window.matchMedia('(prefers-color-scheme: dark)');
    const updateSystemTheme = () => setIsSystemDark(colorScheme.matches);
    updateSystemTheme();
    colorScheme.addEventListener('change', updateSystemTheme);
    return () => colorScheme.removeEventListener('change', updateSystemTheme);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    if (theme !== 'system') {
      root.classList.add(theme);
    }
  }, [theme]);

  const toggleTheme = () => {
    const nextTheme = resolvedThemeFor(theme, isSystemDark) === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    persistThemePreference(nextTheme);
  };

  const signOut = () => {
    setIsSigningOut(true);
    Effect.runFork(
      Effect.gen(function* signOutProgram() {
        const pendingSavesSucceeded = yield* Effect.promise(() =>
          flushAllPendingCoursitionDraftSaves(),
        );
        if (!pendingSavesSucceeded) {
          return yield* new PageEffectError({ cause: new Error('Coursition draft flush failed') });
        }
        yield* Effect.tryPromise({
          catch: (cause) => new PageEffectError({ cause }),
          try: () => effectBff.client.auth.signOut({}),
        });
      }).pipe(
        Effect.asVoid,
        Effect.flatMap(() =>
          Effect.sync(() => globalThis.location.assign(authRoutePath(currentLanguage, 'signIn'))),
        ),
        recoverEffect(() =>
          Effect.sync(() => {
            setIsSigningOut(false);
            toast.create({
              closable: true,
              title: t('coursition.app.errors.generic'),
              type: 'error',
            });
          }),
        ),
      ),
    );
  };

  const resolvedTheme = resolvedThemeFor(theme, isSystemDark);

  return (
    <div className="min-h-dvh bg-base text-fg-primary antialiased">
      <LocalizedHead
        currentLanguage={currentLanguage}
        isIndexable={isIndexableRoute}
        pathname={location.pathname}
        t={t}
        theme={theme}
      />
      <a
        className="absolute left-2 top-2 z-50 h-px w-px overflow-hidden whitespace-nowrap rounded-md bg-base p-0 text-sm font-semibold text-fg-primary opacity-0 outline-none focus:h-auto focus:w-auto focus:px-3 focus:py-2 focus:opacity-100 focus:ring-2 focus:ring-ring"
        href="#course-studio"
      >
        {t('coursition.app.skipToStudio')}
      </a>
      <header className="sticky top-0 z-30 border-b border-border-muted/50 bg-base/90 backdrop-blur-xl">
        <div className="mx-auto flex min-h-14 w-full max-w-[80rem] items-center justify-between gap-3 px-5 sm:px-6 lg:px-8">
          <Link
            aria-label={t('coursition.common.productName')}
            className="coursition-brand-link flex min-w-0 shrink items-center no-underline"
            params={{ lang: currentLanguage }}
            to={isLandingRoute ? landingRoutePattern : dashboardRoutePattern(currentLanguage)}
          >
            <img
              alt=""
              className="coursition-brand-logo coursition-brand-logo--light"
              height={131}
              src="/brand/coursition-logo-light.svg"
              width={504}
            />
            <img
              alt=""
              className="coursition-brand-logo coursition-brand-logo--dark"
              height={131}
              src="/brand/coursition-logo-dark.svg"
              width={504}
            />
          </Link>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            {(() => {
              const languageToggleClassName =
                'inline-flex size-10 items-center justify-center rounded-full text-xl leading-none no-underline transition-colors hover:bg-fill-hover';
              const flag = languageFlags[currentLanguage];
              const label = t('coursition.languages.switchTo', {
                language: t(`coursition.languages.${otherLanguage}`),
              });
              if (currentCourseRoute !== null) {
                return (
                  <Link
                    aria-label={label}
                    className={languageToggleClassName}
                    params={{
                      courseId: currentCourseRoute.draftId,
                      lang: otherLanguage,
                      step: courseRouteStepSlug(otherLanguage, currentCourseRoute.step),
                    }}
                    title={label}
                    to={courseRoutePattern(otherLanguage)}
                  >
                    <span aria-hidden="true">{flag}</span>
                  </Link>
                );
              }
              if (currentAuthRoute !== null) {
                return (
                  <Link
                    aria-label={label}
                    className={languageToggleClassName}
                    params={{ lang: otherLanguage }}
                    title={label}
                    to={authRoutePattern(otherLanguage, currentAuthRoute.mode)}
                  >
                    <span aria-hidden="true">{flag}</span>
                  </Link>
                );
              }
              return (
                <Link
                  aria-label={label}
                  className={languageToggleClassName}
                  params={{ lang: otherLanguage }}
                  title={label}
                  to={isLandingRoute ? landingRoutePattern : dashboardRoutePattern(otherLanguage)}
                >
                  <span aria-hidden="true">{flag}</span>
                </Link>
              );
            })()}
            <Button
              variant="primary"
              theme="borderless"
              size="current"
              aria-label={
                resolvedTheme === 'dark'
                  ? t('coursition.common.theme.light')
                  : t('coursition.common.theme.dark')
              }
              className="inline-flex size-10 items-center justify-center rounded-full text-fg-secondary transition-colors hover:bg-fill-hover hover:text-fg-primary"
              onClick={toggleTheme}
              type="button"
            >
              {resolvedTheme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </Button>
            <LandingHeaderCta language={currentLanguage} show={isLandingHeaderCtaVisible} t={t} />
            {runtimeSessionUser === null ? null : (
              <Button
                disabled={isSigningOut}
                onClick={signOut}
                theme="light"
                type="button"
                variant="primary"
              >
                {t('coursition.app.auth.signOut')}
              </Button>
            )}
          </div>
        </div>
      </header>

      {isRoutePending ? (
        <>
          <output aria-live="polite" className="sr-only">
            {t('coursition.common.loadingNextPage')}
          </output>
          <div aria-hidden="true" className="coursition-route-progress">
            <span />
          </div>
        </>
      ) : null}

      {isLandingRoute ? (
        <main
          aria-busy={isRoutePending}
          className="isolate w-full outline-none"
          id="course-studio"
          tabIndex={-1}
        >
          <CoursitionLandingPage language={currentLanguage} t={t} theme={theme} />
          <CoursitionFooter language={currentLanguage} t={t} />
        </main>
      ) : (
        <main
          aria-busy={isRoutePending}
          data-coursition-workflow
          id="course-studio"
          tabIndex={-1}
          className="isolate mx-auto grid w-full max-w-[80rem] gap-6 px-5 py-6 outline-none sm:px-6 lg:px-8 lg:py-8"
        >
          <CoursitionWorkflowApp
            authMode={currentAuthRoute?.mode ?? null}
            initialRoute={activeRoute}
            {...(loaderData === undefined ? {} : { initialSessionUser: loaderData.sessionUser })}
            initialSnapshot={routeSnapshot}
            language={currentLanguage}
            onSessionUserChange={setRuntimeSessionUser}
            routeKind={routeKind}
            t={t}
          />
        </main>
      )}
    </div>
  );
};

export default Index;
