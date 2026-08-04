import type { CoursitionAiRuntimeConfig } from './config.ts';
import { loadCoursitionAiRuntimeConfig } from './config.ts';

export interface AiProviderConfig {
  apiKey: string;
  baseURL: string;
  model: string;
  provider: string;
}

const defaultLocalBaseUrl = 'http://localhost:8317/v1';
const defaultLocalApiKey = 'droid-local-key';
export const defaultAiModel = 'gpt-5.3-codex-spark';
const axProviderLabel = 'ax/openai-compatible';

const isLocalUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1';
  } catch {
    return false;
  }
};

const shouldUseDefaultLocalAiProvider = (config: CoursitionAiRuntimeConfig) =>
  config.nodeEnv !== 'test' &&
  (config.nodeEnv !== 'production' ||
    config.modernPublicSiteUrl === undefined ||
    isLocalUrl(config.modernPublicSiteUrl));

export const aiCallTimeoutMs = () => {
  const config = loadCoursitionAiRuntimeConfig();
  if (config.aiTimeoutMs !== undefined) {
    return config.aiTimeoutMs;
  }
  return config.nodeEnv === 'test' ? 1500 : 120_000;
};

export const isFreeAiModel = (model: string | undefined) =>
  model === 'openrouter/free' || model?.endsWith(':free') === true;

export const aiProviderConfig = (): AiProviderConfig | null => {
  const config = loadCoursitionAiRuntimeConfig();
  const baseURL =
    config.aiBaseUrl ??
    config.openAiBaseUrl ??
    (shouldUseDefaultLocalAiProvider(config) ? defaultLocalBaseUrl : '');
  const apiKey =
    config.aiProviderApiKey ??
    config.openAiApiKey ??
    (isLocalUrl(baseURL) ? defaultLocalApiKey : '');
  const model = config.aiModel ?? defaultAiModel;
  if (baseURL.length === 0 || apiKey.length === 0) {
    return null;
  }
  return {
    apiKey,
    baseURL,
    model,
    provider: axProviderLabel,
  };
};

export const isAiProviderConfigured = () => aiProviderConfig() !== null;
