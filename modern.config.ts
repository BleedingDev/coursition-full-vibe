import { appTools, defineConfig, presetUltramodern } from '@modern-js/app-tools';
import { createRequire } from 'node:module';
import { bffPlugin } from '@modern-js/plugin-bff';
import { i18nPlugin } from '@modern-js/plugin-i18n';
import { tanstackRouterPlugin } from '@modern-js/plugin-tanstack';
import { loadCoursitionModernConfig } from './server/coursition/config.ts';

const require = createRequire(import.meta.url);
const tanstackRuntimePath = require.resolve('@modern-js/plugin-tanstack/runtime');
const coursitionConfig = loadCoursitionModernConfig({
  argv: process.argv,
  cwd: process.cwd(),
});

// https://bleedingdev.github.io/ultramodern.js/configure/app/usage.html
export default defineConfig(
  presetUltramodern(
    {
      bff: {
        effect: {
          entry: './api/effect/index',
          openapi: {
            path: '/openapi.json',
          },
        },
        prefix: '/api',
        runtimeFramework: 'effect',
      },
      output: {
        filenameHash: false,
        splitRouteChunks: false,
      },
      plugins: [
        appTools(),
        bffPlugin(),
        tanstackRouterPlugin(),
        i18nPlugin({
          backend: {
            enabled: true,
            loadPath: '/locales/{{lng}}/{{ns}}.json',
          },
          localeDetection: {
            detection: {
              lookupFromPathIndex: 0,
              order: ['path', 'querystring', 'cookie', 'localStorage', 'htmlTag', 'navigator'],
            },
            fallbackLanguage: 'en',
            languages: ['en', 'cs'],
            localePathRedirect: true,
            localisedUrls: {
              '/course-creation/:courseId/:step': {
                cs: '/tvorba-kurzu/:courseId/:step',
                en: '/course-creation/:courseId/:step',
              },
              '/dashboard': {
                cs: '/nastenka',
                en: '/dashboard',
              },
            },
          },
          reactI18next: false,
        }),
      ],
      server: {
        publicDir: ['./locales'],
        ssr: {
          mode: 'string',
          moduleFederationAppSSR: true,
        },
      },
      source: {
        globalVars: {
          ULTRAMODERN_SITE_URL: coursitionConfig.siteUrl,
        },
      },
      tools: {
        bundlerChain: (chain, { environment }) => {
          chain.resolve.alias.set('@modern-js/plugin-tanstack/runtime', tanstackRuntimePath);
          if (environment.name === 'client') {
            chain.optimization.chunkIds('named');
            chain.output.chunkFilename('static/js/[name].js');
          }
          chain.ignoreWarnings([
            {
              message: /the request of a dependency is an expression/u,
              module: /modern-js-plugin-i18n/u,
            },
          ]);
        },
      },
    },
    {
      appId: coursitionConfig.appId,
      enableBffRequestId: coursitionConfig.enableBffRequestId,
      enableModuleFederationSSR: coursitionConfig.enableModuleFederationSSR,
      enableTelemetryExporters: coursitionConfig.enableTelemetryExporters,
      telemetryFailLoudStartup: coursitionConfig.telemetryFailLoudStartup,
      ...(typeof coursitionConfig.otlpEndpoint === 'string'
        ? { otlpEndpoint: coursitionConfig.otlpEndpoint }
        : {}),
      ...(typeof coursitionConfig.victoriaMetricsEndpoint === 'string'
        ? { victoriaMetricsEndpoint: coursitionConfig.victoriaMetricsEndpoint }
        : {}),
    },
  ),
);
