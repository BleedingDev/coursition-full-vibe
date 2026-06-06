import type { DraftStep } from './workflow';

export type CourseRouteLanguage = 'en' | 'cs';

const courseBaseSlugByLanguage = {
  cs: 'tvorba-kurzu',
  en: 'course-creation',
} as const satisfies Record<CourseRouteLanguage, string>;

const dashboardSlugByLanguage = {
  cs: 'nastenka',
  en: 'dashboard',
} as const satisfies Record<CourseRouteLanguage, string>;

const stepSlugByLanguage = {
  cs: {
    activityPlan: 'plan-aktivit',
    courseContent: 'obsah-kurzu',
    mode: 'rezim',
    objectives: 'cile',
    preparation: 'priprava',
    preview: 'nahled',
    sources: 'zdroje',
  },
  en: {
    activityPlan: 'activity-plan',
    courseContent: 'course-content',
    mode: 'mode',
    objectives: 'objectives',
    preparation: 'preparation',
    preview: 'preview',
    sources: 'sources',
  },
} as const satisfies Record<CourseRouteLanguage, Record<DraftStep, string>>;

export interface CourseRouteMatch {
  draftId: string;
  language: CourseRouteLanguage;
  step: DraftStep;
}

export const isCourseRouteLanguage = (value: string): value is CourseRouteLanguage =>
  value === 'cs' || value === 'en';

export const courseRoutePath = (language: CourseRouteLanguage, draftId: string, step: DraftStep) =>
  `/${language}/${courseBaseSlugByLanguage[language]}/${encodeURIComponent(draftId)}/${
    stepSlugByLanguage[language][step]
  }`;

export const courseRoutePattern = (language: CourseRouteLanguage) =>
  language === 'cs'
    ? '/$lang/tvorba-kurzu/$courseId/$step'
    : '/$lang/course-creation/$courseId/$step';

export const dashboardRoutePath = (language: CourseRouteLanguage) =>
  `/${language}/${dashboardSlugByLanguage[language]}`;

export const dashboardRoutePattern = (language: CourseRouteLanguage) =>
  language === 'cs' ? '/$lang/nastenka' : '/$lang/dashboard';

export const courseRouteStepSlug = (language: CourseRouteLanguage, step: DraftStep) =>
  stepSlugByLanguage[language][step];

export const courseRoutesMatch = (
  first: CourseRouteMatch | null,
  second: CourseRouteMatch | null,
) =>
  first?.draftId === second?.draftId &&
  first?.language === second?.language &&
  first?.step === second?.step;

export const parseCourseRoutePath = (pathname: string): CourseRouteMatch | null => {
  const [languageSegment, baseSegment, draftIdSegment, stepSegment] = pathname
    .split('/')
    .filter(Boolean);
  const candidateLanguage = languageSegment ?? '';
  if (!isCourseRouteLanguage(candidateLanguage)) {
    return null;
  }
  const language = candidateLanguage;
  if (
    baseSegment !== courseBaseSlugByLanguage[language] ||
    typeof draftIdSegment !== 'string' ||
    draftIdSegment.length === 0 ||
    typeof stepSegment !== 'string' ||
    stepSegment.length === 0
  ) {
    return null;
  }
  const stepEntry = Object.entries(stepSlugByLanguage[language]).find(
    ([, slug]) => slug === stepSegment,
  );
  if (stepEntry === undefined) {
    return null;
  }
  return {
    draftId: decodeURIComponent(draftIdSegment),
    language,
    step: stepEntry[0] as DraftStep,
  };
};

export const localizedPathForLanguage = (pathname: string, language: CourseRouteLanguage) => {
  const courseRoute = parseCourseRoutePath(pathname);
  if (courseRoute !== null) {
    return courseRoutePath(language, courseRoute.draftId, courseRoute.step);
  }
  const [languageSegment, dashboardSegment] = pathname.split('/').filter(Boolean);
  const candidateDashboardLanguage = languageSegment ?? '';
  if (
    isCourseRouteLanguage(candidateDashboardLanguage) &&
    dashboardSegment === dashboardSlugByLanguage[candidateDashboardLanguage]
  ) {
    return dashboardRoutePath(language);
  }
  const segments = pathname.split('/').filter(Boolean);
  if (isCourseRouteLanguage(segments[0] ?? '')) {
    segments.shift();
  }
  return segments.length === 0 ? `/${language}` : `/${language}/${segments.join('/')}`;
};
