import { LinkButton } from '@techsio/ui-kit/atoms/link-button';
import type { ReactNode } from 'react';

import type { SupportedLanguage } from './i18n';
import { authRoutePath } from './routes';
import type { Translate } from './translation';

const receiveKeys = ['objectives', 'activityPlan', 'courseContent'] as const;

const trustKeys = ['sourceSupport', 'preview'] as const;

type IconName = 'objectives' | 'activities' | 'sections' | 'preview' | 'sourceSupport';

/* Single-weight outline glyphs on one 24px grid, so the page reads as a single
 * icon set instead of a pile of borrowed marks. */
const iconShapes: Record<IconName, ReactNode> = {
  activities: (
    <>
      <path d="M3.5 6.5 5 8l2.5-2.75M3.5 12.5 5 14l2.5-2.75M3.5 18.5 5 20l2.5-2.75" />
      <path d="M11 7h9.5M11 13h9.5M11 19h6" />
    </>
  ),
  objectives: (
    <>
      <circle cx="12" cy="12" r="8.25" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  preview: (
    <>
      <rect height="15.5" rx="2.5" width="17" x="3.5" y="4.25" />
      <path d="M10.25 9.25 15 12l-4.75 2.75z" />
    </>
  ),
  sections: (
    <>
      <rect height="5" rx="1.5" width="17" x="3.5" y="3.75" />
      <rect height="9" rx="1.5" width="17" x="3.5" y="11.25" />
    </>
  ),
  sourceSupport: (
    <>
      <path d="M6 3.25h7l5 5v12.5H6z" />
      <path d="M13 3.25v5h5" />
      <path d="m9 14.25 2 2 4-4" />
    </>
  ),
};

const Icon = ({ className, name }: { className: string; name: IconName }) => (
  <svg
    aria-hidden="true"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.4"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    {iconShapes[name]}
  </svg>
);

/* Real product surfaces, captured per locale at 2x so the Czech page shows the
 * Czech studio and the English page the English one.
 *
 * Every still exists in four files: a desktop-width and a phone-width capture,
 * each in a light and a dark build of the studio. The phone captures are taken
 * at a 390px viewport, so a phone shows a whole frame at roughly its captured
 * size instead of a zoomed window into a desktop screen.
 *
 * Intrinsic sizes are declared for every candidate — including the `<source>`
 * elements, which carry their own `width`/`height` — so nothing reflows while a
 * capture decodes, whichever candidate the browser picks. Sizes differ per
 * locale wherever Czech wraps to another line. */
type StillName = 'activities' | 'content' | 'map' | 'objectives';

interface StillSize {
  height: number;
  width: number;
}

interface StillSizes {
  desktop: StillSize;
  phone: StillSize;
}

const stillSizes = {
  cs: {
    activities: { desktop: { height: 470, width: 1624 }, phone: { height: 633, width: 700 } },
    content: { desktop: { height: 600, width: 1560 }, phone: { height: 981, width: 636 } },
    map: { desktop: { height: 1084, width: 1792 }, phone: { height: 1467, width: 700 } },
    objectives: { desktop: { height: 614, width: 1624 }, phone: { height: 949, width: 700 } },
  },
  en: {
    activities: { desktop: { height: 470, width: 1624 }, phone: { height: 573, width: 700 } },
    content: { desktop: { height: 600, width: 1560 }, phone: { height: 981, width: 636 } },
    map: { desktop: { height: 1084, width: 1792 }, phone: { height: 1467, width: 700 } },
    objectives: { desktop: { height: 570, width: 1624 }, phone: { height: 949, width: 700 } },
  },
} as const satisfies Record<SupportedLanguage, Record<StillName, StillSizes>>;

/* The page-level theme, as `src/routes/[lang]/page.tsx` holds it. */
export type LandingTheme = 'dark' | 'light' | 'system';

const stillSrc = (language: SupportedLanguage, variant: string, name: StillName) =>
  `/landing/${language}/${variant}${name}.png`;

/* Phones get their own captures below this width; it is the same breakpoint the
 * stylesheet uses to switch the story from one column to two. */
const phoneMedia = '(width < 48rem)';

interface StillCandidate extends StillSize {
  src: string;
}

interface StillSource extends StillCandidate {
  media: string;
}

/*
 * A `<source media="(prefers-color-scheme: dark)">` cannot see the explicit
 * `html.light` / `html.dark` classes the theme toggle sets, so the candidate
 * list is built from the theme React already holds and only falls back to the
 * media query when the visitor has expressed no preference. That covers all
 * four states — explicit light under a dark system, explicit dark under a light
 * system, and both matching cases — and, because exactly one candidate matches
 * at any moment, the browser downloads each screenshot once instead of fetching
 * the light file and then overriding it with a dark one.
 *
 * Hydration: the server has no access to the stored preference, so it always
 * renders the `'system'` branch — which is safe, because that branch resolves
 * purely from a media query the browser can evaluate on its own. The client then
 * re-renders with the stored preference. For everyone whose preference matches
 * their system setting, and for everyone who has expressed none, both renders
 * select the same file and nothing is fetched twice. A visitor running an
 * explicit theme *against* their system setting fetches the system-matching file
 * from the server markup before the stored preference is applied; closing that
 * last gap needs the `theme` cookie in `CoursePageLoaderData`, which nothing
 * populates yet.
 */
const stillCandidatesFor = (
  language: SupportedLanguage,
  name: StillName,
  theme: LandingTheme,
): { fallback: StillCandidate; sources: StillSource[] } => {
  const sizes = stillSizes[language][name];
  /* The `<img>` fallback carries the desktop capture for the resolved theme, so
   * the one candidate a browser loads without consulting any `<source>` is
   * already the right file. */
  const desktopLight = { ...sizes.desktop, src: stillSrc(language, '', name) };
  const desktopDark = { ...sizes.desktop, src: stillSrc(language, 'dark/', name) };
  if (theme === 'light') {
    return {
      fallback: desktopLight,
      sources: [{ ...sizes.phone, media: phoneMedia, src: stillSrc(language, 'phone/', name) }],
    };
  }
  if (theme === 'dark') {
    return {
      fallback: desktopDark,
      sources: [
        { ...sizes.phone, media: phoneMedia, src: stillSrc(language, 'phone/dark/', name) },
      ],
    };
  }
  return {
    fallback: desktopLight,
    sources: [
      {
        ...sizes.phone,
        media: `${phoneMedia} and (prefers-color-scheme: dark)`,
        src: stillSrc(language, 'phone/dark/', name),
      },
      { ...sizes.phone, media: phoneMedia, src: stillSrc(language, 'phone/', name) },
      {
        ...sizes.desktop,
        media: '(prefers-color-scheme: dark)',
        src: stillSrc(language, 'dark/', name),
      },
    ],
  };
};

const ProductStill = ({
  alt,
  className,
  isHero,
  language,
  name,
  theme,
}: {
  alt: string;
  className: string;
  isHero?: boolean;
  language: SupportedLanguage;
  name: StillName;
  theme: LandingTheme;
}) => {
  const { fallback, sources } = stillCandidatesFor(language, name, theme);
  return (
    <figure className={className}>
      <picture>
        {sources.map((source) => (
          <source
            height={source.height}
            key={source.media}
            media={source.media}
            srcSet={source.src}
            width={source.width}
          />
        ))}
        {isHero === true ? (
          <img
            alt={alt}
            decoding="async"
            fetchPriority="high"
            height={fallback.height}
            src={fallback.src}
            width={fallback.width}
          />
        ) : (
          <img
            alt={alt}
            decoding="async"
            height={fallback.height}
            loading="lazy"
            src={fallback.src}
            width={fallback.width}
          />
        )}
      </picture>
    </figure>
  );
};

/* The hero carries the whole objective map — the frame that shows at a glance
 * what an uploaded file turns into — while the first story beat stays on the
 * single objective it is talking about, so the two are never the same picture.
 * The hero is the LCP image. */
const heroStillName: StillName = 'map';

const receiveStills = {
  activityPlan: { icon: 'activities', name: 'activities' },
  courseContent: { icon: 'sections', name: 'content' },
  objectives: { icon: 'objectives', name: 'objectives' },
} as const satisfies Record<(typeof receiveKeys)[number], { icon: IconName; name: StillName }>;

export const CoursitionLandingPage = ({
  language,
  t,
  theme,
}: {
  language: SupportedLanguage;
  t: Translate;
  theme: LandingTheme;
}) => {
  const signUpHref = authRoutePath(language, 'signUp');

  return (
    <div className="coursition-landing">
      <section aria-labelledby="landing-hero-title" className="coursition-landing__hero">
        <div className="coursition-landing__shell coursition-landing__hero-grid">
          <div className="coursition-landing__hero-copy">
            <h1 className="coursition-landing__title" id="landing-hero-title">
              {`${t('coursition.landing.hero.titleLead')} `}
              <em>{t('coursition.landing.hero.titleAccent')}</em>
            </h1>
            <p className="coursition-landing__lead">{t('coursition.landing.hero.lead')}</p>
            <div className="coursition-landing__actions">
              <LinkButton href={signUpHref} size="lg" theme="solid" variant="primary">
                {t('coursition.landing.hero.primaryCta')}
              </LinkButton>
            </div>
          </div>

          <div className="coursition-landing__stage">
            <ProductStill
              alt={t('coursition.landing.hero.still.alt')}
              className="coursition-landing__still coursition-landing__still--front"
              isHero={true}
              language={language}
              name={heroStillName}
              theme={theme}
            />
          </div>
        </div>
      </section>

      <section aria-labelledby="landing-receive-title" className="coursition-landing__section">
        <div className="coursition-landing__shell">
          <h2 className="coursition-landing__heading" id="landing-receive-title">
            {t('coursition.landing.receive.title')}
          </h2>
          <p className="coursition-landing__intro">{t('coursition.landing.receive.intro')}</p>

          <ul className="coursition-landing__story">
            {receiveKeys.map((receiveKey) => (
              <li className="coursition-landing__beat" key={receiveKey}>
                <div className="coursition-landing__beat-copy">
                  <span className="coursition-landing__chip">
                    <Icon
                      className="coursition-landing__chip-icon"
                      name={receiveStills[receiveKey].icon}
                    />
                  </span>
                  <h3 className="coursition-landing__beat-title">
                    {t(`coursition.landing.receive.items.${receiveKey}.title`)}
                  </h3>
                  <p className="coursition-landing__beat-body">
                    {t(`coursition.landing.receive.items.${receiveKey}.body`)}
                  </p>
                </div>
                <ProductStill
                  alt={t(`coursition.landing.receive.items.${receiveKey}.alt`)}
                  className="coursition-landing__still coursition-landing__still--beat"
                  language={language}
                  name={receiveStills[receiveKey].name}
                  theme={theme}
                />
              </li>
            ))}
          </ul>
          <p className="coursition-landing__outro">{t('coursition.landing.receive.outro')}</p>
        </div>
      </section>

      <section aria-labelledby="landing-trust-title" className="coursition-landing__section">
        <div className="coursition-landing__shell">
          <h2 className="coursition-landing__heading" id="landing-trust-title">
            {t('coursition.landing.trust.title')}
          </h2>
          <p className="coursition-landing__intro">{t('coursition.landing.trust.intro')}</p>
          <ul className="coursition-landing__benefits">
            {trustKeys.map((trustKey) => (
              <li className="coursition-landing__benefit" key={trustKey}>
                <span className="coursition-landing__chip">
                  <Icon className="coursition-landing__chip-icon" name={trustKey} />
                </span>
                <h3 className="coursition-landing__benefit-title">
                  {t(`coursition.landing.trust.items.${trustKey}.title`)}
                </h3>
                <p className="coursition-landing__benefit-body">
                  {t(`coursition.landing.trust.items.${trustKey}.body`)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="landing-closing-title" className="coursition-landing__closing">
        <div className="coursition-landing__shell coursition-landing__closing-inner">
          <h2 className="coursition-landing__closing-title" id="landing-closing-title">
            {t('coursition.landing.closing.title')}
          </h2>
          <p className="coursition-landing__closing-body">{t('coursition.landing.closing.body')}</p>
          <div className="coursition-landing__actions">
            <LinkButton href={signUpHref} size="lg" theme="solid" variant="primary">
              {t('coursition.landing.closing.primaryCta')}
            </LinkButton>
          </div>
        </div>
      </section>
    </div>
  );
};
