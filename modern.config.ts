import { appTools, defineConfig, presetUltramodern } from '@modern-js/app-tools';
import type { AppTools, CliPlugin } from '@modern-js/app-tools';
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
const processEnv = (name: string) =>
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[name];
const cloudflareDeployEnabled = processEnv('MODERNJS_DEPLOY') === 'cloudflare';
const cloudflareWorkerName = 'coursition-full-vibe';
const workerShimPath = (fileName: string) =>
  new URL(`tools/cloudflare-worker-shims/${fileName}`, import.meta.url).pathname;
const cloudflareWorkerNodeBuiltinsPlugin = (): CliPlugin<AppTools> => ({
  name: 'coursition-cloudflare-worker-node-builtins-plugin',
  setup(api) {
    if (!cloudflareDeployEnabled) {
      return;
    }
    api.modifyRspackConfig((config) => {
      const workerConfig = config as {
        externalsPresets?: Record<string, unknown>;
        name?: string;
        resolve?: {
          alias?: Record<string, unknown>;
          fallback?: Record<string, false | string>;
        };
      };
      if (workerConfig.name !== 'workerSSR') {
        return config;
      }
      Object.assign(workerConfig, {
        externalsPresets: {
          ...(typeof workerConfig.externalsPresets === 'object' &&
          workerConfig.externalsPresets !== null
            ? workerConfig.externalsPresets
            : {}),
          node: true,
        },
      });
      workerConfig.resolve ??= {};
      workerConfig.resolve.alias ??= {};
      workerConfig.resolve.fallback ??= {};
      Object.assign(workerConfig.resolve.alias, {
        'node:async_hooks': workerShimPath('async-hooks.mjs'),
        'node:crypto': workerShimPath('crypto.mjs'),
        'node:fs': workerShimPath('fs.mjs'),
        'node:os': workerShimPath('os.mjs'),
        'node:path': workerShimPath('path.mjs'),
      });
      Object.assign(workerConfig.resolve.fallback, {
        async_hooks: false,
        fs: false,
        'node:async_hooks': false,
        'node:fs': false,
      });
      return config;
    });
  },
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
      ...(cloudflareDeployEnabled
        ? {
            deploy: {
              target: 'cloudflare',
              worker: {
                name: cloudflareWorkerName,
                ssr: true,
              },
            },
          }
        : {}),
      html: {
        outputStructure: 'flat',
      },
      output: {
        assetPrefix: coursitionConfig.siteUrl,
        disableTsChecker: true,
        distPath: {
          html: './',
        },
        filenameHash: false,
        polyfill: 'off',
        splitRouteChunks: true,
      },
      ...(cloudflareDeployEnabled
        ? {
            performance: {
              rsdoctor: false,
            },
          }
        : {}),
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
        cloudflareWorkerNodeBuiltinsPlugin(),
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
              message: /Critical dependency: the request of a dependency is an expression/u,
            },
          ]);
          if (cloudflareDeployEnabled) {
            chain.resolve.alias.set('node:async_hooks', workerShimPath('async-hooks.mjs'));
            chain.resolve.alias.set('node:crypto', workerShimPath('crypto.mjs'));
            chain.resolve.alias.set('node:fs', workerShimPath('fs.mjs'));
            chain.resolve.alias.set('node:os', workerShimPath('os.mjs'));
            chain.resolve.alias.set('node:path', workerShimPath('path.mjs'));
            chain.resolve.alias.set('@loadable/server$', workerShimPath('loadable-server.mjs'));
            chain.resolve.alias.set('fs/promises$', workerShimPath('fs-promises.mjs'));
            chain.resolve.alias.set('node:fs/promises$', workerShimPath('fs-promises.mjs'));
            chain.resolve.alias.set('path$', workerShimPath('path.mjs'));
            chain.resolve.alias.set('node:path$', workerShimPath('path.mjs'));
            chain.resolve.fallback.set('async_hooks', false);
            chain.resolve.fallback.set('node:async_hooks', false);
            chain.resolve.fallback.set('fs', false);
            chain.resolve.fallback.set('node:fs', false);
          }
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
