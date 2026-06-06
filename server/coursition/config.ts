const defaultAppId = 'coursition';
const defaultAuthSecret = 'coursition-dev-secret-2026-06-02-fully-local-auth-session-key-64-bytes';
const defaultSiteUrl = 'http://localhost:8080';
const productionSiteUrlErrorMessage =
  'MODERN_PUBLIC_SITE_URL must be set for production builds so canonical and hreflang URLs use the deployed origin.';

export interface CoursitionModernConfig {
  appId: string;
  enableBffRequestId: boolean;
  enableModuleFederationSSR: boolean;
  enableTelemetryExporters: boolean;
  otlpEndpoint: string | undefined;
  siteUrl: string;
  telemetryFailLoudStartup: boolean;
  victoriaMetricsEndpoint: string | undefined;
}

export interface CoursitionAuthConfig {
  baseURL: string;
  secret: string;
}

export interface CoursitionAiRuntimeConfig {
  aiBaseUrl: string | undefined;
  aiModel: string | undefined;
  aiProviderApiKey: string | undefined;
  aiAttempts: number | undefined;
  aiTimeoutMs: number | undefined;
  modernPublicSiteUrl: string | undefined;
  nodeEnv: string;
  openAiApiKey: string | undefined;
  openAiBaseUrl: string | undefined;
}

export interface CoursitionSourceProviderConfig {
  aiModel: string | undefined;
  deepgramApiKey: string | undefined;
  deepgramBaseUrl: string;
  deepgramModel: string;
  exaApiKey: string | undefined;
  exaBaseUrl: string;
  firecrawlApiKey: string | undefined;
  firecrawlBaseUrl: string;
  llamaCloudApiKey: string | undefined;
  llamaCloudBaseUrl: string;
  llamaParseTier: string;
  llamaParseVersion: string;
  nodeEnv: string;
  tavilyApiKey: string | undefined;
  tavilyBaseUrl: string;
}

const hasText = (value: string | undefined): value is string =>
  typeof value === 'string' && value.length > 0;

const runtimeEnv = () =>
  (
    globalThis as typeof globalThis & {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process?.env ?? {};

const envString = (name: string) => runtimeEnv()[name];

const optionalTrimmedString = (name: string) => {
  const value = envString(name);
  if (typeof value !== 'string') {
    return;
  }
  const trimmed = value.trim();
  return hasText(trimmed) ? trimmed : undefined;
};

const stringWithDefault = (name: string, defaultValue: string) => envString(name) ?? defaultValue;

const enabledUnlessFalse = (name: string) => stringWithDefault(name, 'true') !== 'false';

const enabledWhenTrue = (name: string) => stringWithDefault(name, 'false') === 'true';

const optionalPositiveInteger = (name: string) => {
  const value = optionalTrimmedString(name);
  if (typeof value !== 'string') {
    return;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

const appIdFromCwd = (cwd: string) => {
  const normalized = cwd.replace(/[/\\]+$/u, '');
  const lastUnixSeparator = normalized.lastIndexOf('/');
  const lastWindowsSeparator = normalized.lastIndexOf('\\');
  const lastSeparator = Math.max(lastUnixSeparator, lastWindowsSeparator);
  const appId = normalized.slice(lastSeparator + 1);
  return appId.length > 0 ? appId : defaultAppId;
};

export const loadCoursitionModernConfig = (options: {
  argv: readonly string[];
  cwd: string;
}): CoursitionModernConfig => {
  const fallbackAppId = appIdFromCwd(options.cwd);
  const nodeEnv = stringWithDefault('NODE_ENV', 'development');
  const configuredSiteUrl = optionalTrimmedString('MODERN_PUBLIC_SITE_URL');
  const hasConfiguredSiteUrl = hasText(configuredSiteUrl);
  const isProductionBuild = nodeEnv === 'production' || options.argv.includes('build');

  if (isProductionBuild && !hasConfiguredSiteUrl) {
    throw new Error(productionSiteUrlErrorMessage);
  }

  return {
    appId: stringWithDefault('MODERN_BASELINE_APP_ID', fallbackAppId),
    enableBffRequestId: enabledUnlessFalse('MODERN_BASELINE_ENABLE_BFF_REQUEST_ID'),
    enableModuleFederationSSR: enabledUnlessFalse('MODERN_BASELINE_ENABLE_MF_SSR'),
    enableTelemetryExporters: enabledWhenTrue('MODERN_BASELINE_ENABLE_TELEMETRY_EXPORTERS'),
    otlpEndpoint: optionalTrimmedString('MODERN_TELEMETRY_OTLP_ENDPOINT'),
    siteUrl: configuredSiteUrl ?? defaultSiteUrl,
    telemetryFailLoudStartup: enabledWhenTrue('MODERN_TELEMETRY_FAIL_LOUD_STARTUP'),
    victoriaMetricsEndpoint: optionalTrimmedString('MODERN_TELEMETRY_VICTORIA_ENDPOINT'),
  };
};

export const loadCoursitionAuthConfig = (): CoursitionAuthConfig => ({
  baseURL: stringWithDefault('BETTER_AUTH_URL', defaultSiteUrl),
  secret: stringWithDefault('BETTER_AUTH_SECRET', defaultAuthSecret),
});

export const loadCoursitionAiRuntimeConfig = (): CoursitionAiRuntimeConfig => ({
  aiAttempts: optionalPositiveInteger('COURSITION_AI_ATTEMPTS'),
  aiBaseUrl: optionalTrimmedString('COURSITION_AI_BASE_URL'),
  aiModel: optionalTrimmedString('COURSITION_AI_MODEL'),
  aiProviderApiKey: optionalTrimmedString('COURSITION_AI_PROVIDER_API_KEY'),
  aiTimeoutMs: optionalPositiveInteger('COURSITION_AI_TIMEOUT_MS'),
  modernPublicSiteUrl: optionalTrimmedString('MODERN_PUBLIC_SITE_URL'),
  nodeEnv: stringWithDefault('NODE_ENV', 'development'),
  openAiApiKey: optionalTrimmedString('OPENAI_API_KEY'),
  openAiBaseUrl: optionalTrimmedString('OPENAI_BASE_URL'),
});

export const loadCoursitionSourceProviderConfig = (): CoursitionSourceProviderConfig => ({
  aiModel: optionalTrimmedString('COURSITION_AI_MODEL'),
  deepgramApiKey: optionalTrimmedString('DEEPGRAM_API_KEY'),
  deepgramBaseUrl: stringWithDefault('DEEPGRAM_BASE_URL', 'https://api.deepgram.com'),
  deepgramModel: stringWithDefault('DEEPGRAM_MODEL', 'nova-3'),
  exaApiKey: optionalTrimmedString('EXA_API_KEY'),
  exaBaseUrl: stringWithDefault('EXA_BASE_URL', 'https://api.exa.ai'),
  firecrawlApiKey: optionalTrimmedString('FIRECRAWL_API_KEY'),
  firecrawlBaseUrl: stringWithDefault('FIRECRAWL_BASE_URL', 'https://api.firecrawl.dev'),
  llamaCloudApiKey: optionalTrimmedString('LLAMA_CLOUD_API_KEY'),
  llamaCloudBaseUrl: stringWithDefault('LLAMA_CLOUD_BASE_URL', 'https://api.cloud.llamaindex.ai'),
  llamaParseTier: stringWithDefault('LLAMA_PARSE_TIER', 'cost_effective'),
  llamaParseVersion: stringWithDefault('LLAMA_PARSE_VERSION', 'latest'),
  nodeEnv: stringWithDefault('NODE_ENV', 'development'),
  tavilyApiKey: optionalTrimmedString('TAVILY_API_KEY'),
  tavilyBaseUrl: stringWithDefault('TAVILY_BASE_URL', 'https://api.tavily.com'),
});
