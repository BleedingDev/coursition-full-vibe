import type { CoursePageLoaderData } from './route-data';

export const supportedLanguages = ['en', 'cs'] as const;

export type SupportedLanguage = (typeof supportedLanguages)[number];

export const [defaultLanguage] = supportedLanguages;

export const isSupportedLanguage = (value: string): value is SupportedLanguage =>
  value === 'en' || value === 'cs';

export const languageFromPathname = (pathname: string): SupportedLanguage | null => {
  const firstSegment = pathname.split('/').find(Boolean);
  return typeof firstSegment === 'string' && isSupportedLanguage(firstSegment)
    ? firstSegment
    : null;
};

export const resolveCurrentLanguage = ({
  loaderLanguage,
  pathname,
  runtimeLanguage,
}: {
  loaderLanguage?: CoursePageLoaderData['language'] | undefined;
  pathname: string;
  runtimeLanguage?: string;
}): SupportedLanguage => {
  const pathLanguage = languageFromPathname(pathname);
  if (pathLanguage !== null) {
    return pathLanguage;
  }
  if (typeof loaderLanguage === 'string' && isSupportedLanguage(loaderLanguage)) {
    return loaderLanguage;
  }
  if (typeof runtimeLanguage === 'string' && isSupportedLanguage(runtimeLanguage)) {
    return runtimeLanguage;
  }
  return defaultLanguage;
};
