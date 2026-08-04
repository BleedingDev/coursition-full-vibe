import * as DateTime from 'effect/DateTime';

import type { SupportedLanguage } from './i18n';
import { authRoutePath, legalRoutePath } from './routes';
import type { Translate } from './translation';

/*
 * Publicity artwork for the CzechInvest Technology Incubation programme.
 *
 * The programme ships a positive lockup for light backgrounds and a negative
 * one for dark backgrounds, plus a matching pair for the Country for the Future
 * mark. Both are rendered and the inactive one is hidden in CSS, so the swap
 * follows the same `html.dark` / `prefers-color-scheme` rules the landing page
 * already uses instead of depending on React state that is not settled on the
 * server. Intrinsic sizes are the trimmed pixel dimensions of the assets, so
 * the row reserves its box before the PNGs decode.
 */
const incubationLogos = {
  cs: {
    dark: '/publicity/technology-incubation-cs-negative.png',
    height: 244,
    light: '/publicity/technology-incubation-cs-positive.png',
    width: 1288,
  },
  en: {
    dark: '/publicity/technology-incubation-en-negative.png',
    height: 220,
    light: '/publicity/technology-incubation-en-positive.png',
    width: 1044,
  },
} as const satisfies Record<
  SupportedLanguage,
  { dark: string; height: number; light: string; width: number }
>;

const countryLogo = {
  dark: '/publicity/country-for-the-future-white.png',
  height: 422,
  light: '/publicity/country-for-the-future-color.png',
  width: 1158,
} as const;

const ThemedLogo = ({
  alt,
  dark,
  height,
  light,
  width,
}: {
  alt: string;
  dark: string;
  height: number;
  light: string;
  width: number;
}) => (
  <>
    <img
      alt={alt}
      className="coursition-footer__logo coursition-footer__logo--light"
      height={height}
      loading="lazy"
      src={light}
      width={width}
    />
    <img
      alt={alt}
      className="coursition-footer__logo coursition-footer__logo--dark"
      height={height}
      loading="lazy"
      src={dark}
      width={width}
    />
  </>
);

export const CoursitionFooter = ({
  language,
  t,
}: {
  language: SupportedLanguage;
  t: Translate;
}) => {
  const incubation = incubationLogos[language];

  return (
    <footer aria-labelledby="landing-footer-title" className="coursition-footer">
      <div className="coursition-footer__shell">
        {/* Masthead: the wordmark and one sentence on the left, the links
         * gathered into two short labelled columns on the right. Stacked
         * columns beat a single wrapping row of four links, which read as a
         * cramped afterthought next to a full-size wordmark. */}
        <div className="coursition-footer__masthead">
          <div className="coursition-footer__brand">
            <p className="coursition-footer__wordmark" id="landing-footer-title">
              <span className="sr-only">{t('coursition.common.productName')}</span>
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
            </p>
            <p className="coursition-footer__tagline">{t('coursition.footer.tagline')}</p>
          </div>
          <nav aria-label={t('coursition.footer.navLabel')} className="coursition-footer__nav">
            <div className="coursition-footer__nav-group">
              <p className="coursition-footer__nav-title">
                {t('coursition.footer.groups.account')}
              </p>
              <ul className="coursition-footer__nav-list">
                <li>
                  <a className="coursition-footer__link" href={authRoutePath(language, 'signUp')}>
                    {t('coursition.footer.links.signUp')}
                  </a>
                </li>
                <li>
                  <a className="coursition-footer__link" href={authRoutePath(language, 'signIn')}>
                    {t('coursition.footer.links.signIn')}
                  </a>
                </li>
              </ul>
            </div>
            <div className="coursition-footer__nav-group">
              <p className="coursition-footer__nav-title">{t('coursition.footer.groups.legal')}</p>
              <ul className="coursition-footer__nav-list">
                <li>
                  <a className="coursition-footer__link" href={legalRoutePath(language, 'privacy')}>
                    {t('coursition.footer.links.privacy')}
                  </a>
                </li>
                <li>
                  <a className="coursition-footer__link" href={legalRoutePath(language, 'terms')}>
                    {t('coursition.footer.links.terms')}
                  </a>
                </li>
              </ul>
            </div>
          </nav>
        </div>

        {/* Programme publicity. The marks sit on their own quiet panel so each
         * one keeps the clear space the programme manual asks for and the row
         * reads as a credential rather than as leftover artwork. */}
        <div className="coursition-footer__publicity">
          <div className="coursition-footer__logos">
            <span className="coursition-footer__logo-slot">
              <ThemedLogo
                alt={t('coursition.footer.publicity.incubationAlt')}
                dark={incubation.dark}
                height={incubation.height}
                light={incubation.light}
                width={incubation.width}
              />
            </span>
            <span className="coursition-footer__logo-slot">
              <ThemedLogo
                alt={t('coursition.footer.publicity.countryAlt')}
                dark={countryLogo.dark}
                height={countryLogo.height}
                light={countryLogo.light}
                width={countryLogo.width}
              />
            </span>
          </div>
          <p className="coursition-footer__publicity-text">
            {t('coursition.footer.publicity.statement')}
          </p>
        </div>

        <div className="coursition-footer__baseline">
          {/* Statutory operator identity. Czech law expects the trading company,
           * its registration numbers, seat, and register entry to be reachable
           * from the public site, and the legal pages reference this block rather
           * than repeating it. */}
          <address className="coursition-footer__company">
            <p className="coursition-footer__company-label">
              {t('coursition.footer.company.label')}
            </p>
            <p className="coursition-footer__company-name">{t('coursition.footer.company.name')}</p>
            <p className="coursition-footer__company-facts">
              <span>{t('coursition.footer.company.address')}</span>
              <span>{t('coursition.footer.company.ids')}</span>
              <span>{t('coursition.footer.company.register')}</span>
            </p>
            <a
              className="coursition-footer__link coursition-footer__company-email"
              href={`mailto:${t('coursition.footer.company.email')}`}
            >
              {t('coursition.footer.company.email')}
            </a>
          </address>

          <p className="coursition-footer__legal">
            {t('coursition.footer.copyright', {
              year: DateTime.getPartUtc(DateTime.nowUnsafe(), 'year'),
            })}
          </p>
        </div>
      </div>
    </footer>
  );
};
