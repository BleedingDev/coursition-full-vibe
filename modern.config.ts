// @effect-diagnostics nodeBuiltinImport:off processEnv:off
import { appTools, defineConfig, presetUltramodern } from '@modern-js/app-tools';
import { createRequire } from 'node:module';
import path from 'node:path';
import { bffPlugin } from '@modern-js/plugin-bff';
import { i18nPlugin } from '@modern-js/plugin-i18n';
import { tanstackRouterPlugin } from '@modern-js/plugin-tanstack';

const require = createRequire(import.meta.url);
const tanstackRuntimePath = require.resolve('@modern-js/plugin-tanstack/runtime');
const appId = process.env['MODERN_BASELINE_APP_ID'] || path.basename(process.cwd());
const enableModuleFederationSSR = process.env['MODERN_BASELINE_ENABLE_MF_SSR'] !== 'false';
const enableBffRequestId = process.env['MODERN_BASELINE_ENABLE_BFF_REQUEST_ID'] !== 'false';
const enableTelemetryExporters =
  process.env['MODERN_BASELINE_ENABLE_TELEMETRY_EXPORTERS'] === 'true';
const telemetryFailLoudStartup = process.env['MODERN_TELEMETRY_FAIL_LOUD_STARTUP'] === 'true';
const otlpEndpoint = process.env['MODERN_TELEMETRY_OTLP_ENDPOINT'];
const configuredSiteUrl = process.env['MODERN_PUBLIC_SITE_URL'];
const hasConfiguredSiteUrl = typeof configuredSiteUrl === 'string' && configuredSiteUrl.length > 0;
const isProductionBuild =
  process.env['NODE_ENV'] === 'production' || process.argv.includes('build');

if (isProductionBuild && !hasConfiguredSiteUrl) {
  throw new Error(
    'MODERN_PUBLIC_SITE_URL must be set for production builds so canonical and hreflang URLs use the deployed origin.',
  );
}

const siteUrl = hasConfiguredSiteUrl ? configuredSiteUrl : 'http://localhost:8080';
const victoriaMetricsEndpoint = process.env['MODERN_TELEMETRY_VICTORIA_ENDPOINT'];

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
          ULTRAMODERN_SITE_URL: siteUrl,
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
      appId,
      enableBffRequestId,
      enableModuleFederationSSR,
      enableTelemetryExporters,
      telemetryFailLoudStartup,
      ...(typeof otlpEndpoint === 'string' ? { otlpEndpoint } : {}),
      ...(typeof victoriaMetricsEndpoint === 'string' ? { victoriaMetricsEndpoint } : {}),
    },
  ),
);
