import { defineRuntimeConfig } from '@modern-js/runtime';
import { createInstance } from 'i18next';
import type { Resource } from 'i18next';

import czechTranslation from '../locales/cs/translation.json';
import englishTranslation from '../locales/en/translation.json';

const i18nInstance = createInstance();

const resources = {
  cs: {
    translation: czechTranslation,
  },
  en: {
    translation: englishTranslation,
  },
} satisfies Resource;

export default defineRuntimeConfig({
  i18n: {
    i18nInstance,
    initOptions: {
      defaultNS: 'translation',
      fallbackLng: 'en',
      interpolation: {
        escapeValue: false,
      },
      ns: ['translation'],
      resources: resources as never,
      supportedLngs: ['en', 'cs'],
    },
  },
  router: {
    framework: 'tanstack',
  },
});
