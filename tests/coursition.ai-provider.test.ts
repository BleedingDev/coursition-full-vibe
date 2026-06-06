// @effect-diagnostics processEnv:off processGlobal:off
import { describe, expect, test } from '@rstest/core';
import type { CourseDraft } from '../shared/coursition/workflow.ts';
import {
  aiProviderConfig,
  generateTopicsWithAi,
  isAiProviderConfigured,
} from '../server/coursition/ai-provider.ts';

const providerEnvKeys = [
  'COURSITION_AI_BASE_URL',
  'COURSITION_AI_LOCAL_FALLBACK',
  'COURSITION_AI_MODEL',
  'COURSITION_AI_PROVIDER_API_KEY',
  'MODERN_PUBLIC_SITE_URL',
  'NODE_ENV',
  'OPENAI_API_KEY',
  'OPENAI_BASE_URL',
] as const;

const withProviderEnv = <T>(env: Record<string, string>, run: () => T): T => {
  const previous = new Map(providerEnvKeys.map((key) => [key, process.env[key]]));
  for (const key of providerEnvKeys) {
    Reflect.deleteProperty(process.env, key);
  }
  for (const [key, value] of Object.entries(env)) {
    process.env[key] = value;
  }
  try {
    return run();
  } finally {
    for (const key of providerEnvKeys) {
      const value = previous.get(key);
      if (value === undefined) {
        Reflect.deleteProperty(process.env, key);
      } else {
        process.env[key] = value;
      }
    }
  }
};

const withProviderEnvAsync = async <T>(
  env: Record<string, string>,
  run: () => Promise<T>,
): Promise<T> => {
  const previous = new Map(providerEnvKeys.map((key) => [key, process.env[key]]));
  for (const key of providerEnvKeys) {
    Reflect.deleteProperty(process.env, key);
  }
  for (const [key, value] of Object.entries(env)) {
    process.env[key] = value;
  }
  try {
    return await run();
  } finally {
    for (const key of providerEnvKeys) {
      const value = previous.get(key);
      if (value === undefined) {
        Reflect.deleteProperty(process.env, key);
      } else {
        process.env[key] = value;
      }
    }
  }
};

const topicFallbackDraft = (): CourseDraft => {
  const createdAt = '2026-06-04T00:00:00.000Z';
  return {
    aiRuns: [],
    chapters: [],
    createdAt,
    derivedSourceDocuments: [],
    findings: [],
    id: 'draft_topic_quality',
    knowledgeChunks: [
      {
        confidence: 'high',
        content:
          'Incident triage playbooks define escalation paths, ownership handoff, evidence capture, and post-incident review drills. Junior members of klubu use Github labels during the drill, but the teachable work is the repeatable review process.',
        createdAt,
        derivedSourceDocumentId: 'document_topic_quality',
        id: 'chunk_topic_quality_1',
        reference: {
          heading: 'Incident review notes',
          position: 'chunk-1',
          sourceAssetId: 'source_topic_quality',
        },
        sourceAssetId: 'source_topic_quality',
      },
    ],
    language: 'en',
    mode: 'assist',
    ownerId: 'owner_topic_quality',
    questions: {
      audience: 'new incident coordinators',
      avoid: '',
      depth: 'practical',
      outcome: 'run a repeatable incident review workflow',
      practice: 'scenario review drills',
      priorKnowledge: '',
      strictSourceOnly: false,
    },
    sourceProcessingIncomplete: false,
    sources: [
      {
        content:
          'Incident triage playbooks define escalation paths, ownership handoff, evidence capture, and post-incident review drills. Junior members of klubu use Github labels during the drill, but the teachable work is the repeatable review process.',
        createdAt,
        id: 'source_topic_quality',
        name: 'Incident review notes',
        processor: 'test',
        sizeLabel: '360 chars',
        status: 'processed',
        type: 'notes',
      },
    ],
    step: 'topics',
    targetLearner: {
      constraints: '',
      currentKnowledge: '',
      desiredOutcome: '',
      motivation: '',
      pain: '',
      practiceStyle: '',
      profile: '',
    },
    title: 'Incident review onboarding',
    topics: [],
    updatedAt: createdAt,
  };
};

describe('Coursition AI provider config', () => {
  test('uses the local OpenAI-compatible provider in development without remote env', () => {
    withProviderEnv({ NODE_ENV: 'development' }, () => {
      expect(aiProviderConfig()).toEqual({
        apiKey: 'droid-local-key',
        baseURL: 'http://localhost:8317/v1',
        model: 'gpt-5.3-codex-spark',
        provider: 'ax/openai-compatible',
      });
      expect(isAiProviderConfigured()).toBe(true);
    });
  });

  test('keeps production remote deployments unconfigured without provider credentials', () => {
    withProviderEnv(
      {
        MODERN_PUBLIC_SITE_URL: 'https://coursition.example',
        NODE_ENV: 'production',
      },
      () => {
        expect(aiProviderConfig()).toBeNull();
        expect(isAiProviderConfigured()).toBe(false);
      },
    );
  });

  test('ignores explicit local fallback in production mode', () => {
    withProviderEnv(
      {
        COURSITION_AI_LOCAL_FALLBACK: 'true',
        MODERN_PUBLIC_SITE_URL: 'https://coursition.example',
        NODE_ENV: 'production',
      },
      () => {
        expect(aiProviderConfig()).toBeNull();
        expect(isAiProviderConfigured()).toBe(false);
      },
    );
  });

  test('accepts OpenAI-compatible env and custom model values', () => {
    withProviderEnv(
      {
        COURSITION_AI_MODEL: 'gpt-5.3-codex-spark',
        NODE_ENV: 'production',
        OPENAI_API_KEY: 'remote-key',
        OPENAI_BASE_URL: 'https://api.openai-compatible.example/v1',
      },
      () => {
        expect(aiProviderConfig()).toEqual({
          apiKey: 'remote-key',
          baseURL: 'https://api.openai-compatible.example/v1',
          model: 'gpt-5.3-codex-spark',
          provider: 'ax/openai-compatible',
        });
      },
    );
  });

  test('requires a real key for non-local provider URLs', () => {
    withProviderEnv(
      {
        COURSITION_AI_BASE_URL: 'https://api.openai-compatible.example/v1',
        NODE_ENV: 'development',
      },
      () => {
        expect(aiProviderConfig()).toBeNull();
      },
    );
  });

  test('local deterministic topic fallback avoids weak labels and generic descriptions', async () => {
    await withProviderEnvAsync({ NODE_ENV: 'test' }, async () => {
      const firstResult = await generateTopicsWithAi(topicFallbackDraft());
      const secondResult = await generateTopicsWithAi(topicFallbackDraft());

      expect(firstResult.value).toEqual(secondResult.value);
      expect(firstResult.provider).toBe('local-deterministic-fallback');
      expect(firstResult.value.length).toBeGreaterThan(0);

      for (const topic of firstResult.value) {
        expect(topic.sourceSupport).toBe('source_backed');
        expect(topic.name.split(/\s+/u).length).toBeGreaterThanOrEqual(2);
        expect(topic.name).not.toMatch(/\b(junior|github|klubu)\b/iu);
        expect(topic.name).not.toMatch(/\b([\p{L}\p{N}]+)\s+\1\b/iu);
        expect(topic.description).not.toMatch(/^Teach the learner how\b/iu);
        expect(topic.description).not.toMatch(/\b(local|fallback|openai|provider|github)\b/iu);
      }

      expect(firstResult.value.map((topic) => topic.name).join(' ')).toMatch(
        /\b(Incident|Escalation|Evidence|Review|Triage)\b/u,
      );
    });
  });
});
