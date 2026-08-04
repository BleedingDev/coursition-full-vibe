/*
 * Coursition public legal pages: the privacy notice and the terms of use.
 *
 * These are reading pages, not app surfaces, so they are indexable, they carry
 * the same shell width as the landing page, and the body is capped at a
 * comfortable measure instead of the full 76rem.
 *
 * Both documents were drafted from the Sedlakova Legal B2B framework agreement
 * and the GDPR processor terms, neither of which is a public-facing website
 * policy. The copy describes what the product actually does today and is kept
 * deliberately plain. It has not been reviewed by counsel — that review is a
 * launch prerequisite.
 *
 * Each locale gets its own slug, and each slug is a real route file under
 * `src/routes/[lang]/`, so this component is rendered by four routes. It owns
 * its own header because the studio shell in `src/routes/[lang]/page.tsx` is
 * scoped to the app routes.
 */
import { useEffect, useState } from 'react';
import { useModernI18n } from '@modern-js/plugin-i18n/runtime';
import { Helmet } from '@modern-js/runtime/head';
import { Button } from '@techsio/ui-kit/atoms/button';
import { Link, useLocation } from '@tanstack/react-router';

import { CoursitionFooter } from './coursition-footer';
import type { SupportedLanguage } from './i18n';
import { resolveCurrentLanguage } from './i18n';
import { legalRoutePath, legalRoutePattern } from './routes';
import type { LegalDocument } from './routes';
import type { Translate } from './translation';

type ModernI18nInstance = ReturnType<typeof useModernI18n>['i18nInstance'];
type Theme = 'light' | 'dark' | 'system';
type ExplicitTheme = Exclude<Theme, 'system'>;

interface LegalSection {
  readonly id: string;
  readonly items?: readonly string[];
}

const languageFlags: Record<SupportedLanguage, string> = {
  cs: '🇨🇿',
  en: '🇬🇧',
};

const landingRoutePattern = '/$lang';
const themeCookieName = 'theme';
const themePreferenceStorageKey = 'coursition-theme';

const openGraphLocales = {
  cs: 'cs_CZ',
  en: 'en_GB',
} as const satisfies Record<SupportedLanguage, string>;

/* Section order is fixed in code rather than in the locale files so both
 * translations stay in lockstep and a missing key fails loudly. */
const sectionsByDocument = {
  privacy: [
    { id: 'scope' },
    { id: 'data', items: ['account', 'content', 'technical'] },
    { id: 'purposes' },
    { id: 'ai' },
    { id: 'cookies' },
    { id: 'sharing' },
    { id: 'retention' },
    {
      id: 'rights',
      items: ['access', 'correction', 'deletion', 'objection', 'portability', 'complaint'],
    },
    { id: 'business' },
    { id: 'changes' },
  ],
  terms: [
    { id: 'scope' },
    { id: 'account' },
    { id: 'service' },
    { id: 'yourContent' },
    { id: 'ai' },
    { id: 'acceptableUse', items: ['resell', 'reverseEngineer', 'unlawful', 'abuse'] },
    { id: 'availability' },
    { id: 'liability' },
    { id: 'termination' },
    { id: 'law' },
    { id: 'business' },
    { id: 'changes' },
  ],
} as const satisfies Record<LegalDocument, readonly LegalSection[]>;

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

/* Mirrors the landing shell: localStorage is the client authority across route
 * remounts, with the SSR cookie as the fallback when storage is unavailable. */
const themePreferenceFromBrowser = (): Theme => {
  if (typeof window === 'undefined') {
    return 'system';
  }
  try {
    return (
      explicitThemeFrom(window.localStorage.getItem(themePreferenceStorageKey)) ??
      themeCookieFromBrowser() ??
      'system'
    );
  } catch {
    return themeCookieFromBrowser() ?? 'system';
  }
};

const persistThemePreference = (theme: ExplicitTheme) => {
  try {
    window.localStorage.setItem(themePreferenceStorageKey, theme);
  } catch {
    // The cookie below remains the persistence fallback when storage is unavailable.
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

const resolveSiteOrigin = (): string => {
  const configured = typeof ULTRAMODERN_SITE_URL === 'string' ? ULTRAMODERN_SITE_URL.trim() : '';
  if (configured !== '') {
    return configured.replace(/\/+$/u, '');
  }
  return typeof window === 'undefined' ? '' : window.location.origin;
};

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

/* Both spellings of a slug resolve, so `/en/ochrana-osobnich-udaju` renders.
 * Only the canonical language/slug pairing is offered to crawlers. */
const LegalHead = ({
  currentLanguage,
  document,
  isIndexable,
  t,
  theme,
}: {
  currentLanguage: SupportedLanguage;
  document: LegalDocument;
  isIndexable: boolean;
  t: Translate;
  theme: Theme;
}) => {
  const origin = resolveSiteOrigin();
  const alternateLanguage: SupportedLanguage = currentLanguage === 'en' ? 'cs' : 'en';
  const csUrl = `${origin}${legalRoutePath('cs', document)}`;
  const enUrl = `${origin}${legalRoutePath('en', document)}`;
  const canonicalUrl = currentLanguage === 'cs' ? csUrl : enUrl;
  const title = `${t(`coursition.legal.${document}.title`)} — ${t('coursition.common.productName')}`;
  const description = t(`coursition.legal.${document}.description`);

  return (
    <Helmet
      htmlAttributes={{
        lang: currentLanguage,
        ...(theme === 'system' ? {} : { className: theme }),
      }}
    >
      <title>{title}</title>
      <meta content={description} name="description" />
      <meta content={isIndexable ? 'index, follow' : 'noindex, follow'} name="robots" />
      <link href="/favicon.svg" rel="icon" type="image/svg+xml" />
      <link href={canonicalUrl} rel="canonical" />
      <link href={csUrl} hrefLang="cs" rel="alternate" />
      <link href={enUrl} hrefLang="en" rel="alternate" />
      <link href={enUrl} hrefLang="x-default" rel="alternate" />
      <meta content="article" property="og:type" />
      <meta content={t('coursition.common.productName')} property="og:site_name" />
      <meta content={openGraphLocales[currentLanguage]} property="og:locale" />
      <meta content={openGraphLocales[alternateLanguage]} property="og:locale:alternate" />
      <meta content={title} property="og:title" />
      <meta content={description} property="og:description" />
      <meta content={canonicalUrl} property="og:url" />
    </Helmet>
  );
};

const LegalSectionBlock = ({
  base,
  section,
  t,
}: {
  base: string;
  section: LegalSection;
  t: Translate;
}) => (
  <section className="coursition-legal__section">
    <h2 className="coursition-legal__heading">{t(`${base}.sections.${section.id}.title`)}</h2>
    <p className="coursition-legal__paragraph">{t(`${base}.sections.${section.id}.body`)}</p>
    {section.items === undefined ? null : (
      <ul className="coursition-legal__list">
        {section.items.map((item) => (
          <li className="coursition-legal__list-item" key={item}>
            {t(`${base}.sections.${section.id}.items.${item}`)}
          </li>
        ))}
      </ul>
    )}
  </section>
);

export const CoursitionLegalPage = ({ document: legalDocument }: { document: LegalDocument }) => {
  const { i18nInstance, language } = useModernI18n();
  const location = useLocation();
  const currentLanguage = resolveCurrentLanguage({
    pathname: location.pathname,
    runtimeLanguage: language,
  });
  const t = createTranslate(i18nInstance, currentLanguage);
  const otherLanguage: SupportedLanguage = currentLanguage === 'en' ? 'cs' : 'en';
  const base = `coursition.legal.${legalDocument}`;
  const isIndexable = location.pathname === legalRoutePath(currentLanguage, legalDocument);

  const [theme, setTheme] = useState<Theme>(themePreferenceFromBrowser);
  const [isSystemDark, setIsSystemDark] = useState(false);

  useEffect(() => {
    const colorScheme = window.matchMedia('(prefers-color-scheme: dark)');
    const updateSystemTheme = () => setIsSystemDark(colorScheme.matches);
    updateSystemTheme();
    colorScheme.addEventListener('change', updateSystemTheme);
    return () => colorScheme.removeEventListener('change', updateSystemTheme);
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    if (theme !== 'system') {
      root.classList.add(theme);
    }
  }, [theme]);

  const systemTheme: ExplicitTheme = isSystemDark ? 'dark' : 'light';
  const resolvedTheme: ExplicitTheme = theme === 'system' ? systemTheme : theme;

  const toggleTheme = () => {
    const nextTheme: ExplicitTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    persistThemePreference(nextTheme);
  };

  const switchLabel = t('coursition.languages.switchTo', {
    language: t(`coursition.languages.${otherLanguage}`),
  });

  return (
    <div className="min-h-dvh bg-base text-fg-primary antialiased">
      <LegalHead
        currentLanguage={currentLanguage}
        document={legalDocument}
        isIndexable={isIndexable}
        t={t}
        theme={theme}
      />
      <header className="sticky top-0 z-30 border-b border-border-muted/50 bg-base/90 backdrop-blur-xl">
        <div className="mx-auto flex min-h-14 w-full max-w-[80rem] items-center justify-between gap-3 px-5 sm:px-6 lg:px-8">
          {/* Same brand lockup as the app header, so a reader who lands here
           * from search sees the product rather than a bare word. */}
          <Link
            aria-label={t('coursition.legal.backToHome')}
            className="coursition-brand-link flex min-w-0 shrink items-center no-underline"
            params={{ lang: currentLanguage }}
            to={landingRoutePattern}
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
            <Link
              aria-label={switchLabel}
              className="inline-flex size-10 items-center justify-center rounded-full text-xl leading-none no-underline transition-colors hover:bg-fill-hover"
              params={{ lang: otherLanguage }}
              title={switchLabel}
              to={legalRoutePattern(otherLanguage, legalDocument)}
            >
              <span aria-hidden="true">{languageFlags[currentLanguage]}</span>
            </Link>
            <Button
              aria-label={
                resolvedTheme === 'dark'
                  ? t('coursition.common.theme.light')
                  : t('coursition.common.theme.dark')
              }
              className="inline-flex size-10 items-center justify-center rounded-full text-fg-secondary transition-colors hover:bg-fill-hover hover:text-fg-primary"
              onClick={toggleTheme}
              size="current"
              theme="borderless"
              type="button"
              variant="primary"
            >
              {resolvedTheme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </Button>
          </div>
        </div>
      </header>

      <main className="isolate w-full outline-none" id="legal-content" tabIndex={-1}>
        <article className="coursition-legal">
          <div className="coursition-legal__shell">
            <header className="coursition-legal__intro">
              <p className="coursition-legal__eyebrow">{t('coursition.legal.eyebrow')}</p>
              <h1 className="coursition-legal__title">{t(`${base}.title`)}</h1>
              <p className="coursition-legal__lead">{t(`${base}.lead`)}</p>
              <p className="coursition-legal__updated">
                {`${t('coursition.legal.lastUpdatedLabel')}: ${t('coursition.legal.lastUpdated')}`}
              </p>
            </header>

            <div className="coursition-legal__body">
              {sectionsByDocument[legalDocument].map((section) => (
                <LegalSectionBlock base={base} key={section.id} section={section} t={t} />
              ))}

              <section className="coursition-legal__section">
                <h2 className="coursition-legal__heading">{t('coursition.legal.contact.title')}</h2>
                <p className="coursition-legal__paragraph">
                  {t('coursition.legal.contact.company')}
                  <br />
                  {t('coursition.legal.contact.address')}
                  <br />
                  {t('coursition.legal.contact.registration')}
                </p>
                <p className="coursition-legal__paragraph">
                  {`${t('coursition.legal.contact.emailLabel')}: `}
                  <a
                    className="coursition-legal__link"
                    href={`mailto:${t('coursition.legal.contact.email')}`}
                  >
                    {t('coursition.legal.contact.email')}
                  </a>
                </p>
              </section>
            </div>
          </div>
        </article>
        <CoursitionFooter language={currentLanguage} t={t} />
      </main>
    </div>
  );
};
