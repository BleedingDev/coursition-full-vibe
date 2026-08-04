/**
 * Writes `robots.txt` and `sitemap.xml` into `config/public`, which Modern.js
 * copies to the site root. Both need the production origin, so they are
 * generated from the same `siteUrl` the canonical/hreflang tags use rather than
 * hardcoding the host in two more places.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const publicDir = path.join(path.dirname(import.meta.dirname), 'config', 'public');

/* Application surfaces. Crawlers get the two public landing pages and nothing
 * else; the studio, dashboard and auth screens are behind or about to be behind
 * a session. Czech routes carry localized slugs, so both spellings are listed. */
const disallowedPaths = [
  '/api',
  '/cs/nastenka',
  '/cs/prihlaseni',
  '/cs/registrace',
  '/cs/tvorba-kurzu',
  '/en/course-creation',
  '/en/dashboard',
  '/en/sign-in',
  '/en/sign-up',
];

/* Every publicly indexable page, with the localized slug each language serves
 * it under. These mirror `legalSlugByLanguage` in `shared/coursition/routes.ts`;
 * the sitemap is plain data written at build time, so it cannot import the
 * TypeScript source and the two lists have to be kept in step by hand. */
const indexablePages = [
  { cs: '', en: '' },
  { cs: '/ochrana-osobnich-udaju', en: '/privacy' },
  { cs: '/obchodni-podminky', en: '/terms' },
];

const languages = ['cs', 'en'];

export const generateSeoStatic = (siteUrl) => {
  const origin = siteUrl.replace(/\/+$/u, '');
  const robots = [
    'User-agent: *',
    ...disallowedPaths.map((route) => `Disallow: ${route}`),
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n');

  const urlFor = (page, language) => `${origin}/${language}${page[language]}`;

  const sitemap = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...indexablePages.flatMap((page) => {
      const alternates = [
        ...languages.map(
          (language) =>
            `    <xhtml:link href="${urlFor(page, language)}" hreflang="${language}" rel="alternate"/>`,
        ),
        `    <xhtml:link href="${urlFor(page, 'en')}" hreflang="x-default" rel="alternate"/>`,
      ].join('\n');

      return languages.map((language) =>
        [`  <url>`, `    <loc>${urlFor(page, language)}</loc>`, alternates, `  </url>`].join('\n'),
      );
    }),
    '</urlset>',
    '',
  ].join('\n');

  mkdirSync(publicDir, { recursive: true });
  writeFileSync(path.join(publicDir, 'robots.txt'), robots, 'utf-8');
  writeFileSync(path.join(publicDir, 'sitemap.xml'), sitemap, 'utf-8');
};
