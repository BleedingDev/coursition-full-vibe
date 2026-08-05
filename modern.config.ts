import { fileURLToPath } from 'node:url';
import { appTools, defineConfig, presetUltramodern } from '@modern-js/app-tools';
import { bffPlugin } from '@modern-js/plugin-bff';
import { i18nPlugin } from '@modern-js/plugin-i18n';
import { tanstackRouterPlugin } from '@modern-js/plugin-tanstack';
import { pluginTailwindcss } from '@rsbuild/plugin-tailwindcss';
import { withZephyr } from 'zephyr-modernjs-plugin';
import { loadCoursitionModernConfig } from './server/coursition/config.ts';
import { generateDefaultSeedModule } from './scripts/generate-default-seed-module.mjs';
import { generateSeoStatic } from './scripts/generate-seo-static.mjs';

const coursitionConfig = loadCoursitionModernConfig({
  argv: process.argv,
  cwd: process.cwd(),
});
generateDefaultSeedModule();
generateSeoStatic(coursitionConfig.siteUrl);

const processEnv = (name: string) =>
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[
    name
  ]?.trim();
const cloudflareDeployEnabled = processEnv('MODERNJS_DEPLOY') === 'cloudflare';
const zephyrDeployEnabled = processEnv('MODERNJS_DEPLOY') === 'zephyr';
const cloudflareWorkerName = 'coursition-full-vibe';
const cloudflareDatabaseId =
  processEnv('CLOUDFLARE_D1_DATABASE_ID') ?? '00000000-0000-0000-0000-000000000000';
const cloudflareDatabaseName = processEnv('CLOUDFLARE_D1_DATABASE_NAME') ?? 'coursition';
const cloudflareSourceBucketName =
  processEnv('CLOUDFLARE_R2_BUCKET_NAME') ?? 'coursition-source-assets';
const coursitionAiBaseUrl = processEnv('COURSITION_AI_BASE_URL') ?? 'https://openrouter.ai/api/v1';
const coursitionAiModel = processEnv('COURSITION_AI_MODEL') ?? 'openai/gpt-oss-20b:free';
const buildTarget = cloudflareDeployEnabled ? 'cloudflare' : 'web';

const cloudflareCustomDomain = (() => {
  const host = URL.parse(coursitionConfig.siteUrl)?.hostname;
  return host === undefined || host === 'localhost' ? undefined : host;
})();

// https://bleedingdev.github.io/ultramodern.js/configure/app/usage.html
export default defineConfig(
  presetUltramodern(
    {
      bff: {
        effect: {
          entry: './api/index',
          openapi: {
            path: '/openapi.json',
          },
          strictEffectApproach: true,
        },
        prefix: '/api',
        runtimeFramework: 'effect',
      },
      builderPlugins: [
        {
          name: 'coursition-build-target',
          setup(api: Parameters<ReturnType<typeof pluginTailwindcss>['setup']>[0]) {
            api.modifyEnvironmentConfig((config, { name }) => ({
              ...config,
              source: {
                ...config.source,
                define: {
                  ...config.source?.define,
                  __COURSITION_BROWSER_BUILD__: JSON.stringify(name === 'client'),
                },
              },
            }));
          },
        },
        pluginTailwindcss(),
      ],
      ...(cloudflareDeployEnabled
        ? {
            deploy: {
              target: 'cloudflare' as const,
              worker: {
                compatibilityDate: '2026-06-02',
                d1Databases: [
                  {
                    binding: 'COURSITION_DB',
                    databaseId: cloudflareDatabaseId,
                    databaseName: cloudflareDatabaseName,
                    migrationsDir: 'drizzle',
                  },
                ],
                name: cloudflareWorkerName,
                publicAssetExcludes: ['api', 'server', 'shared'],
                security: {
                  contentSecurityPolicy: {
                    directives: {
                      'base-uri': ["'self'"],
                      'connect-src': ["'self'", 'https:', 'http:', 'wss:', 'ws:'],
                      'default-src': ["'self'"],
                      'font-src': ["'self'", 'data:', 'https:'],
                      'form-action': ["'self'"],
                      'frame-ancestors': ["'self'"],
                      'img-src': ["'self'", 'data:', 'blob:', 'https:'],
                      'manifest-src': ["'self'"],
                      'object-src': ["'none'"],
                      'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'blob:'],
                      'style-src': ["'self'", "'unsafe-inline'"],
                      'worker-src': ["'self'", 'blob:'],
                    },
                    mode: 'report-only' as const,
                    reason:
                      'Report-only while CzechInvest acceptance testing confirms every generated editor and Worker asset path.',
                  },
                  enabled: true,
                  headers: {
                    contentTypeOptions: 'nosniff' as const,
                    permissionsPolicy:
                      'camera=(), geolocation=(), microphone=(), payment=(), usb=()',
                    referrerPolicy: 'strict-origin-when-cross-origin' as const,
                  },
                  noindex: {
                    localhost: true,
                    previewHostnames: [],
                  },
                },
                ssr: true,
                wrangler: {
                  ai: {
                    binding: 'AI',
                  },
                  minify: true,
                  observability: { enabled: true },
                  workers_dev: false,
                  ...(cloudflareCustomDomain === undefined
                    ? {}
                    : {
                        routes: [{ custom_domain: true, pattern: cloudflareCustomDomain }],
                      }),
                  r2_buckets: [
                    {
                      binding: 'COURSITION_SOURCE_BUCKET',
                      bucket_name: cloudflareSourceBucketName,
                    },
                  ],
                  vars: {
                    BETTER_AUTH_URL: coursitionConfig.siteUrl,
                    COURSITION_AI_BASE_URL: coursitionAiBaseUrl,
                    COURSITION_AI_MODEL: coursitionAiModel,
                    COURSITION_STORE_BACKEND: 'cloudflare',
                    MODERN_PUBLIC_SITE_URL: coursitionConfig.siteUrl,
                  },
                },
              },
            },
          }
        : {}),
      html: {
        meta: {
          // WCAG 2.1 SC 1.4.4: never block pinch-zoom on public pages.
          viewport: 'width=device-width, initial-scale=1.0, viewport-fit=cover',
        },
        outputStructure: 'flat',
      },
      output: {
        assetPrefix: '/',
        disableTsChecker: false,
        distPath: {
          html: './',
          root: cloudflareDeployEnabled ? 'dist-cloudflare' : 'dist',
        },
        polyfill: 'off',
        splitRouteChunks: true,
        tempDir: `node_modules/.modern-js-coursition-${buildTarget}`,
      },
      performance: {
        buildCache: {
          cacheDigest: [coursitionConfig.appId, buildTarget],
          cacheDirectory: `node_modules/.cache/rspack-coursition-${buildTarget}`,
        },
        rsdoctor: {
          disableClientServer: true,
          enabled: processEnv('ULTRAMODERN_RSDOCTOR') === 'true',
        },
      },
      plugins: [
        appTools(),
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
            ignoreRedirectRoutes: ['/api', '/locales', '/openapi.json', '/robots.txt', '/static'],
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
              '/privacy': {
                cs: '/ochrana-osobnich-udaju',
                en: '/privacy',
              },
              '/sign-in': {
                cs: '/prihlaseni',
                en: '/sign-in',
              },
              '/sign-up': {
                cs: '/registrace',
                en: '/sign-up',
              },
              '/terms': {
                cs: '/obchodni-podminky',
                en: '/terms',
              },
            },
          },
          reactI18next: false,
        }),
        bffPlugin(),
        /* Zephyr has to come last: it reads the finished compiler array and
         * publishes one snapshot after every compiler settles. It stays opt-in
         * so the Cloudflare release path is byte-for-byte unaffected. */
        ...(zephyrDeployEnabled
          ? [withZephyr({ entrypoint: 'server/index.js', snapshotType: 'ssr' as const })]
          : []),
      ],
      server: {
        publicDir: ['./public', './locales'],
        ssr: {
          mode: 'string',
          moduleFederationAppSSR: coursitionConfig.enableModuleFederationSSR,
        },
      },
      source: {
        alias: {
          '@modern-js/plugin-i18n/runtime': '@modern-js/plugin-i18n/runtime/no-react-i18next',
        },
        globalVars: {
          ULTRAMODERN_SITE_URL: coursitionConfig.siteUrl,
        },
        mainEntryName: 'index',
      },
      splitChunks: {
        chunks: 'async',
      },
      tools: {
        autoprefixer: {
          overrideBrowserslist: ['defaults'],
        },
        rspack(config, { environment, rspack }) {
          if (cloudflareDeployEnabled && environment.name === 'workerSSR') {
            config.output ??= {};
            config.output.importMetaName = '__modernCloudflareImportMeta';
            config.plugins ??= [];
            config.plugins.push(
              new rspack.BannerPlugin({
                banner: 'const __modernCloudflareImportMeta = { url: "file:///worker/index.mjs" };',
                raw: true,
              }),
            );
            /* better-auth's Kysely adapter reaches the worker bundle through
             * the shared auth module, and it carries a `webpackIgnore`d
             * `import('node:sqlite')` that survives bundling and trips the
             * Cloudflare output verifier. Neither `resolve.alias` nor
             * `IgnorePlugin` can drop that request — the comment tells rspack to
             * leave it alone — so the adapter itself is swapped for a stub. The
             * Cloudflare path runs better-auth on the D1 drizzle adapter and
             * never constructs a Kysely one. */
            config.resolve ??= {};
            config.resolve.alias = {
              ...config.resolve.alias,
              '@better-auth/kysely-adapter': fileURLToPath(
                new URL('scripts/cloudflare/kysely-adapter-worker-stub.mjs', import.meta.url),
              ),
            };
          }
          return config;
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
