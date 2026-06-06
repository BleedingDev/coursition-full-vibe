// @effect-diagnostics globalDate:off globalFetch:off processEnv:off asyncFunction:off strictBooleanExpressions:off
import { setTimeout as wait } from 'node:timers/promises';
import { ai as createAxAI, ax, f } from '@ax-llm/ax';
import type { AxAIOpenAIModel, AxChatResponse, AxForwardable } from '@ax-llm/ax';
import {
  buildChapters,
  buildLessons,
  buildTargetLearner,
  lessonBlockTitlesFor,
  topicsForCourse,
  sourceOnlyGapBlockFor,
  suggestQuestions,
} from '../../shared/coursition/workflow.ts';
import type {
  Chapter,
  CourseDraft,
  GuidedQuestions,
  LessonBlock,
  TargetLearner,
  Topic,
} from '../../shared/coursition/workflow.ts';

interface AiProviderConfig {
  apiKey: string;
  baseURL: string;
  model: string;
  provider: string;
}

interface GeneratedTopic {
  name?: unknown;
  description?: unknown;
  importance?: unknown;
}

interface GeneratedQuestionsObject {
  questions: Partial<Record<keyof GuidedQuestions, unknown>>;
}

interface GeneratedChapter {
  title?: unknown;
  outcome?: unknown;
}

interface GeneratedLesson {
  chapterTitle?: unknown;
  lessonTitle?: unknown;
  objective?: unknown;
  explanation?: unknown;
  exercise?: unknown;
  check?: unknown;
  summary?: unknown;
}

interface AiJsonResult<T> {
  model: string;
  provider: string;
  text: string;
  value: T;
}

const defaultLocalBaseUrl = 'http://localhost:8317/v1';
const defaultLocalApiKey = 'droid-local-key';
const defaultModel = 'gpt-5.3-codex-spark';
const localFallbackProvider = 'local-deterministic-fallback';
const axProviderLabel = 'ax/openai-compatible';
const trueValues = new Set(['1', 'true', 'yes', 'on']);
const falseValues = new Set(['0', 'false', 'no', 'off']);

const configuredEnvValue = (name: string) => {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : undefined;
};

const configuredBoolean = (name: string): boolean | undefined => {
  const value = configuredEnvValue(name)?.toLowerCase();
  if (!value) {
    return undefined;
  }
  if (trueValues.has(value)) {
    return true;
  }
  if (falseValues.has(value)) {
    return false;
  }
  return undefined;
};

const isLocalAiBaseUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1';
  } catch {
    return false;
  }
};

const isLocalSiteUrl = (value: string | undefined) => {
  if (!value) {
    return true;
  }
  try {
    const url = new URL(value);
    return url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1';
  } catch {
    return false;
  }
};

const shouldUseDefaultLocalAiProvider = () =>
  process.env['NODE_ENV'] !== 'production' || isLocalSiteUrl(process.env['MODERN_PUBLIC_SITE_URL']);

const shouldUseLocalAiFallback = () => {
  if (process.env['NODE_ENV'] === 'production') {
    return false;
  }
  const configured = configuredBoolean('COURSITION_AI_LOCAL_FALLBACK');
  return configured === true;
};

const aiCallTimeoutMs = () => {
  const configured = Number.parseInt(process.env['COURSITION_AI_TIMEOUT_MS'] ?? '', 10);
  if (Number.isFinite(configured) && configured > 0) {
    return configured;
  }
  if (process.env['NODE_ENV'] === 'test' || shouldUseLocalAiFallback()) {
    return 1500;
  }
  return 20_000;
};

const aiOutputAttempts = () => {
  const configured = Number.parseInt(process.env['COURSITION_AI_ATTEMPTS'] ?? '', 10);
  if (Number.isFinite(configured) && configured > 0) {
    return configured;
  }
  return 3;
};

const withAiOutputRetries = async <T>(
  operation: () => Promise<AiJsonResult<T>>,
): Promise<AiJsonResult<T>> => {
  let lastError: unknown;
  for (let attempt = 1; attempt <= aiOutputAttempts(); attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < aiOutputAttempts()) {
        await wait(250 * attempt);
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
};

export const aiProviderConfig = (): AiProviderConfig | null => {
  const baseURL =
    configuredEnvValue('COURSITION_AI_BASE_URL') ??
    configuredEnvValue('OPENAI_BASE_URL') ??
    (shouldUseDefaultLocalAiProvider() ? defaultLocalBaseUrl : '');
  const apiKey =
    configuredEnvValue('COURSITION_AI_PROVIDER_API_KEY') ??
    configuredEnvValue('OPENAI_API_KEY') ??
    (isLocalAiBaseUrl(baseURL) ? defaultLocalApiKey : '');
  const model = configuredEnvValue('COURSITION_AI_MODEL') ?? defaultModel;
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

const processedSourceEvidence = (draft: CourseDraft) =>
  draft.knowledgeChunks.length > 0
    ? draft.knowledgeChunks
        .slice(0, 16)
        .map(
          (chunk, index) =>
            `Chunk ${index + 1} (${chunk.reference.heading ?? chunk.sourceAssetId}, ${
              chunk.reference.position
            })\n${chunk.content.slice(0, 1600)}`,
        )
        .join('\n\n')
    : draft.sources
        .filter((source) => source.status === 'processed')
        .slice(0, 8)
        .map(
          (source, index) =>
            `Source ${index + 1}: ${source.name}\n${source.content.slice(0, 4000)}`,
        )
        .join('\n\n');

const topicEvidence = (draft: CourseDraft) =>
  topicsForCourse(draft.topics)
    .map((topic) => `${topic.name}: ${topic.description}`)
    .join('\n');

const questionsProgram = ax(
  f()
    .description('Create source-grounded course planning answers for an automatic course build.')
    .input('languageCode', f.string('Language code for all generated course copy'))
    .input('courseTitle', f.string('Course title'))
    .input('sourceEvidence', f.string('Processed source excerpts that define the course scope'))
    .output(
      'questions',
      f.object(
        {
          audience: f.string('Specific learners served by the source material'),
          avoid: f.string('Coverage or assumptions to avoid for this course'),
          depth: f.class(
            ['practical', 'introductory', 'intermediate', 'advanced'] as const,
            'Course depth',
          ),
          outcome: f.string('Observable capability learners should gain'),
          practice: f.string('Concrete task learners will complete'),
          priorKnowledge: f.string('Knowledge learners can be expected to have'),
          strictSourceOnly: f.boolean('Whether course claims should stay source-only'),
        },
        'Guided planning answers',
      ),
    )
    .build(),
  { stream: true },
);

const topicsProgram = ax(
  f()
    .description('Create course topic suggestions grounded in source evidence and learner goals.')
    .input('languageCode', f.string('Language code for all generated course copy'))
    .input('courseTitle', f.string('Course title'))
    .input('learningOutcome', f.string('Learner outcome'))
    .input('audience', f.string('Target audience'))
    .input('practiceStyle', f.string('Practice learners should complete'))
    .input('sourceEvidence', f.string('Processed source excerpts that define topic scope'))
    .output(
      'topics',
      f
        .object({
          description: f.string('One-sentence topic role in the course'),
          importance: f.class(['critical', 'high', 'medium', 'low'] as const, 'Topic priority'),
          name: f.string('Short specific topic name'),
        })
        .array('One to six source-backed course topics'),
    )
    .build(),
  { stream: true },
);

const targetLearnerProgram = ax(
  f()
    .description('Create a target learner profile from course planning answers and topics.')
    .input('languageCode', f.string('Language code for all generated course copy'))
    .input('courseTitle', f.string('Course title'))
    .input('learningOutcome', f.string('Learner outcome'))
    .input('audience', f.string('Target audience answer'))
    .input('priorKnowledge', f.string('Learner prior knowledge answer'))
    .input('practiceStyle', f.string('Practice learners should complete'))
    .input('topics', f.string('Course topics and descriptions'))
    .output(
      'targetLearner',
      f.object(
        {
          constraints: f.string('Constraints or boundaries for the learning experience'),
          currentKnowledge: f.string('What learners already understand'),
          desiredOutcome: f.string('Outcome learners want from the course'),
          motivation: f.string('Why learners care about the course'),
          pain: f.string('Current pain or blocker learners face'),
          practiceStyle: f.string('Best-fit practice style for these learners'),
          profile: f.string('Specific learner profile'),
        },
        'Target learner profile',
      ),
    )
    .build(),
  { stream: true },
);

const chaptersProgram = ax(
  f()
    .description('Create a compact chapter outline from target learner needs and topics.')
    .input('languageCode', f.string('Language code for all generated course copy'))
    .input('courseTitle', f.string('Course title'))
    .input('targetLearnerProfile', f.string('Target learner profile'))
    .input('desiredOutcome', f.string('Desired learner outcome'))
    .input('topics', f.string('Course topics and descriptions'))
    .output(
      'chapters',
      f
        .object({
          outcome: f.string('Measurable learning outcome for this chapter'),
          title: f.string('Chapter title without numeric prefix'),
        })
        .array('One to six ordered course chapters'),
    )
    .build(),
  { stream: true },
);

const lessonsProgram = ax(
  f()
    .description('Create one editable lesson for each supplied chapter.')
    .input('languageCode', f.string('Language code for all generated course copy'))
    .input('courseTitle', f.string('Course title'))
    .input('targetLearnerProfile', f.string('Target learner profile'))
    .input('practiceStyle', f.string('Practice learners should complete'))
    .input('strictSourceOnly', f.boolean('Whether explanations must stay source-only'))
    .input('chapters', f.string('Chapter titles and outcomes requiring lessons'))
    .input('sourceEvidence', f.string('Processed source excerpts that ground lesson content'))
    .output(
      'lessons',
      f
        .object({
          chapterTitle: f.string('Matching chapter title'),
          check: f.string('Understanding check for the lesson'),
          exercise: f.string('Learner exercise for the lesson'),
          explanation: f.string('Main explanation for the lesson'),
          lessonTitle: f.string('Lesson title'),
          objective: f.string('Lesson objective'),
          summary: f.string('Lesson summary'),
        })
        .array('One lesson per supplied chapter'),
    )
    .build(),
  { stream: true },
);

const configuredAxOpenAiModel = (model: string) => model as AxAIOpenAIModel;

const normalizeCliProxyChatResponse = (response: AxChatResponse): AxChatResponse => ({
  ...response,
  results: response.results.map((result) => {
    const normalized = { ...result } as typeof result & {
      content?: string | null;
      thought?: string | null;
    };
    if (normalized.content === null) {
      Reflect.deleteProperty(normalized, 'content');
    }
    if (normalized.thought === null) {
      Reflect.deleteProperty(normalized, 'thought');
    }
    return normalized;
  }),
});

const normalizeCliProxyPayload = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(normalizeCliProxyPayload);
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  const normalized: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if ((key === 'content' || key === 'reasoning_content' || key === 'thought') && entry === null) {
      continue;
    }
    normalized[key] = normalizeCliProxyPayload(entry);
  }
  return normalized;
};

const cliProxyCompatibleFetch: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return response;
  }
  const body = await response.text();
  if (body.trim().length === 0) {
    return new Response(body, response);
  }
  try {
    const headers = new Headers(response.headers);
    headers.delete('content-length');
    return Response.json(normalizeCliProxyPayload(JSON.parse(body)), {
      headers,
      status: response.status,
      statusText: response.statusText,
    });
  } catch {
    return new Response(body, response);
  }
};

const createCoursitionAxAi = (config: AiProviderConfig) =>
  createAxAI({
    apiKey: config.apiKey,
    apiURL: config.baseURL,
    chatRespProcessor: normalizeCliProxyChatResponse,
    chatStreamRespProcessor: normalizeCliProxyChatResponse,
    config: {
      model: configuredAxOpenAiModel(config.model),
      temperature: 0,
    },
    name: 'openai',
    options: {
      fetch: cliProxyCompatibleFetch,
      includeRequestBodyInErrors: false,
      stream: true,
      timeout: aiCallTimeoutMs(),
    },
  });

const generateStructuredObject = async <TInput, TOutput>(
  program: AxForwardable<TInput, TOutput, string>,
  input: TInput,
): Promise<AiJsonResult<TOutput>> => {
  const config = aiProviderConfig();
  if (!config) {
    throw new Error('AI provider is not configured.');
  }
  const provider = createCoursitionAxAi(config);
  const value = await program.forward(provider, input, {
    stream: true,
    timeout: aiCallTimeoutMs(),
  });
  return {
    model: config.model,
    provider: config.provider,
    text: JSON.stringify(value, null, 2),
    value,
  };
};

const canUseLocalDeterministicFallback = () => {
  const config = aiProviderConfig();
  return config ? isLocalAiBaseUrl(config.baseURL) && shouldUseLocalAiFallback() : false;
};

const localFallbackResult = <T>(value: T): AiJsonResult<T> => ({
  model: `${defaultModel}/deterministic`,
  provider: localFallbackProvider,
  text: JSON.stringify(value, null, 2),
  value,
});

const shouldBypassAiInTests = () =>
  process.env['NODE_ENV'] === 'test' &&
  configuredEnvValue('COURSITION_AI_BASE_URL') === undefined &&
  configuredEnvValue('OPENAI_BASE_URL') === undefined &&
  configuredEnvValue('COURSITION_AI_PROVIDER_API_KEY') === undefined &&
  configuredEnvValue('OPENAI_API_KEY') === undefined;

const localAiTimeout = async <T>(timeoutMs: number): Promise<AiJsonResult<T>> => {
  await wait(timeoutMs);
  throw new Error('Local AI generation timed out.');
};

const withLocalFallbackDeadline = <T>(
  operation: () => Promise<AiJsonResult<T>>,
): Promise<AiJsonResult<T>> => {
  if (!canUseLocalDeterministicFallback()) {
    return operation();
  }
  const timeoutMs = aiCallTimeoutMs() + 500;
  return Promise.race([operation(), localAiTimeout<T>(timeoutMs)]);
};

const withLocalAiFallback = async <T>(
  operation: () => Promise<AiJsonResult<T>>,
  fallback: () => T,
): Promise<AiJsonResult<T>> => {
  if (shouldBypassAiInTests()) {
    return localFallbackResult(fallback());
  }
  try {
    return await withLocalFallbackDeadline(operation);
  } catch (error) {
    if (!canUseLocalDeterministicFallback()) {
      throw error;
    }
    return localFallbackResult(fallback());
  }
};

const asText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const recordFrom = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const objectFieldFrom = (value: unknown, field: string): Record<string, unknown> => {
  const record = recordFrom(value);
  if (!record) {
    return {};
  }
  return recordFrom(record[field]) ?? record;
};

const arrayFieldFrom = (value: unknown, field: string): unknown[] => {
  if (Array.isArray(value)) {
    return value;
  }
  const record = recordFrom(value);
  const nested = record ? record[field] : undefined;
  return Array.isArray(nested) ? nested : [];
};

const userVisibleProviderLabelPattern =
  /\b(local[-\s]?deterministic[-\s]?fallback|ai[-\s]?sdk|openai|anthropic|vercel|github|provider|gpt[-\w.]*)\b/giu;

const fallbackTopicStopWords = new Set([
  'about',
  'after',
  'again',
  'against',
  'also',
  'and',
  'are',
  'around',
  'as',
  'before',
  'being',
  'can',
  'course',
  'create',
  'creates',
  'creating',
  'define',
  'defines',
  'does',
  'during',
  'each',
  'for',
  'from',
  'have',
  'in',
  'into',
  'is',
  'junior',
  'juniors',
  'learner',
  'learners',
  'learning',
  'local',
  'material',
  'materials',
  'need',
  'needs',
  'not',
  'of',
  'on',
  'openai',
  'practice',
  'practical',
  'provider',
  'source',
  'sources',
  'student',
  'students',
  'teach',
  'teaching',
  'that',
  'the',
  'their',
  'they',
  'this',
  'through',
  'to',
  'using',
  'with',
  'without',
  'work',
  'workflow',
  'workflows',
  'za',
  'aby',
  'ale',
  'bez',
  'bude',
  'budou',
  'co',
  'do',
  'jak',
  'jsou',
  'junior',
  'juniori',
  'klub',
  'klubu',
  'kurz',
  'kurzu',
  'lekce',
  'maji',
  'mají',
  'material',
  'materiál',
  'na',
  'nebo',
  'podle',
  'pomoci',
  'pomocí',
  'praxe',
  'prakticky',
  'pro',
  'student',
  'studenti',
  'tema',
  'téma',
  'ucit',
  'učit',
  'zdroj',
  'zdroje',
  'zdrojů',
]);

const fallbackTopicLabelWords = new Set([
  'anthropic',
  'fallback',
  'github',
  'gpt',
  'local',
  'openai',
  'provider',
  'vercel',
]);

const fallbackTopicTokenPattern = /[\p{L}\p{N}][\p{L}\p{N}+#./-]*/gu;

interface FallbackTopicCandidate {
  firstSeen: number;
  key: string;
  score: number;
  words: string[];
}

const safeUserVisibleText = (value: string) =>
  value
    .replaceAll(userVisibleProviderLabelPattern, (label) =>
      label.toLowerCase() === 'github' ? 'repository' : 'platform',
    )
    .replaceAll(/\s+/gu, ' ')
    .trim();

const fallbackTopicTokens = (value: string) =>
  [...safeUserVisibleText(value).matchAll(fallbackTopicTokenPattern)]
    .map((match) => match[0]?.toLowerCase().replaceAll(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
    .filter((word): word is string => Boolean(word && word.length > 2))
    .filter((word) => !fallbackTopicStopWords.has(word) && !fallbackTopicLabelWords.has(word));

const fallbackTitleCase = (words: string[]) =>
  words
    .map((word) =>
      word.length <= 3 && /^[a-z0-9]+$/u.test(word)
        ? word.toUpperCase()
        : `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`,
    )
    .join(' ');

const fallbackTopicName = (draft: CourseDraft, words: string[]) => {
  const safeWords = words.filter((word) => !fallbackTopicLabelWords.has(word));
  if (draft.language === 'cs') {
    return safeWords.join(' ');
  }
  return fallbackTitleCase(safeWords);
};

const fallbackDescription = (draft: CourseDraft, topicName: string) => {
  const outcome = safeUserVisibleText(draft.questions.outcome || draft.title);
  const audience = safeUserVisibleText(draft.questions.audience || 'the target learners');
  const practice = safeUserVisibleText(draft.questions.practice || 'guided practice');
  const normalizedTopic = draft.language === 'cs' ? topicName : topicName.toLowerCase();

  if (draft.language === 'cs') {
    return `Propojuje ${normalizedTopic} s cílem ${outcome} pro ${audience} a procvičením ${practice}.`;
  }
  return `Connects ${normalizedTopic} to ${outcome} for ${audience} through ${practice}.`;
};

const hasProcessedSourceEvidence = (draft: CourseDraft) =>
  draft.knowledgeChunks.length > 0 ||
  draft.sources.some((source) => source.status === 'processed' && source.content.trim().length > 0);

const fallbackTopicCorpusSections = (draft: CourseDraft) => [
  {
    text: draft.knowledgeChunks.map((chunk) => chunk.content).join(' '),
    weight: 8,
  },
  {
    text: draft.sources
      .filter((source) => source.status === 'processed')
      .map((source) => `${source.name} ${source.content}`)
      .join(' '),
    weight: 7,
  },
  { text: draft.questions.outcome, weight: 5 },
  { text: draft.questions.practice, weight: 4 },
  { text: draft.title, weight: 3 },
  { text: draft.questions.audience, weight: 1 },
];

const addFallbackTopicCandidate = (
  candidates: Map<string, FallbackTopicCandidate>,
  words: string[],
  score: number,
  firstSeen: number,
) => {
  if (
    words.length < 2 ||
    words.some((word) => fallbackTopicLabelWords.has(word)) ||
    new Set(words).size !== words.length
  ) {
    return;
  }
  const key = words.join(' ');
  const existing = candidates.get(key);
  if (existing) {
    candidates.set(key, {
      ...existing,
      firstSeen: Math.min(existing.firstSeen, firstSeen),
      score: existing.score + score,
    });
    return;
  }
  candidates.set(key, { firstSeen, key, score, words });
};

const collectFallbackTopicCandidates = (draft: CourseDraft) => {
  const candidates = new Map<string, FallbackTopicCandidate>();
  let sequence = 0;
  for (const section of fallbackTopicCorpusSections(draft)) {
    const sentences = safeUserVisibleText(section.text)
      .split(/[.!?;:\n]+/u)
      .map((sentence) => fallbackTopicTokens(sentence))
      .filter((tokens) => tokens.length > 0);
    for (const tokens of sentences) {
      for (let start = 0; start < tokens.length; start += 1) {
        for (let length = 3; length >= 2; length -= 1) {
          const words = tokens.slice(start, start + length);
          if (words.length === length) {
            addFallbackTopicCandidate(candidates, words, section.weight + length * 0.5, sequence);
            sequence += 1;
          }
        }
      }
    }
  }
  return candidates;
};

const fallbackTopicOverlap = (left: string[], right: string[]) => {
  const rightWords = new Set(right);
  return left.filter((word) => rightWords.has(word)).length / Math.min(left.length, right.length);
};

const selectedFallbackTopicCandidates = (draft: CourseDraft) => {
  const selected: FallbackTopicCandidate[] = [];
  const sortedCandidates = [...collectFallbackTopicCandidates(draft).values()].toSorted(
    (left, right) =>
      right.score - left.score ||
      left.firstSeen - right.firstSeen ||
      left.key.localeCompare(right.key),
  );
  for (const candidate of sortedCandidates) {
    if (selected.some((existing) => fallbackTopicOverlap(existing.words, candidate.words) > 0.66)) {
      continue;
    }
    selected.push(candidate);
    if (selected.length >= 5) {
      break;
    }
  }
  return selected;
};

const fallbackTopicSeed = (draft: CourseDraft) => {
  const seedWords = fallbackTopicTokens(
    [draft.questions.outcome, draft.questions.practice, draft.title].join(' '),
  ).slice(0, 3);
  if (seedWords.length >= 2) {
    return seedWords;
  }
  const titleWords = fallbackTopicTokens(draft.title);
  if (titleWords.length > 0) {
    return [...titleWords, draft.language === 'cs' ? 'postup' : 'practice'].slice(0, 3);
  }
  return draft.language === 'cs' ? ['prakticky', 'postup'] : ['practical', 'workflow'];
};

const fallbackTopicImportance = (index: number): Topic['importance'] => {
  if (index === 0) {
    return 'critical';
  }
  if (index < 3) {
    return 'high';
  }
  return 'medium';
};

const buildFallbackTopics = (draft: CourseDraft): Topic[] => {
  const candidates = selectedFallbackTopicCandidates(draft);
  const seed = fallbackTopicSeed(draft);
  const candidateWords =
    candidates.length > 0
      ? candidates.map((candidate) => candidate.words)
      : [
          seed,
          [...seed.slice(0, 2), draft.language === 'cs' ? 'praxe' : 'practice'],
          [...seed.slice(0, 2), draft.language === 'cs' ? 'rozhodnuti' : 'decisions'],
        ];
  const usedNames = new Set<string>();
  const sourceSupport = hasProcessedSourceEvidence(draft) ? 'source_backed' : 'manual';
  return candidateWords.slice(0, 5).flatMap((words, index): Topic[] => {
    const name = fallbackTopicName(draft, words).trim();
    const normalizedName = name.toLowerCase();
    if (name.length === 0 || usedNames.has(normalizedName)) {
      return [];
    }
    usedNames.add(normalizedName);
    return [
      {
        description: fallbackDescription(draft, name),
        id: `topic_${draft.id}_${index + 1}`,
        importance: fallbackTopicImportance(index),
        name,
        sourceSupport,
      },
    ];
  });
};

const hasWeakTopicShape = (name: string, description: string) => {
  const rawNameTokens = [
    ...safeUserVisibleText(name.toLowerCase()).matchAll(fallbackTopicTokenPattern),
  ].map((match) => match[0] ?? '');
  const nameTokens = fallbackTopicTokens(name);
  if (
    nameTokens.length < 2 &&
    rawNameTokens.some(
      (word) => fallbackTopicStopWords.has(word) || fallbackTopicLabelWords.has(word),
    )
  ) {
    return true;
  }
  if (nameTokens.some((word) => fallbackTopicLabelWords.has(word))) {
    return true;
  }
  return /^teach the learner how\b/iu.test(description);
};

const normalizeImportance = (value: unknown, index: number): Topic['importance'] => {
  if (value === 'critical' || value === 'high' || value === 'medium' || value === 'low') {
    return value;
  }
  if (index === 0) {
    return 'critical';
  }
  if (index < 3) {
    return 'high';
  }
  return 'medium';
};

const hasBeginnerOrUnclearTarget = (targetLearner: TargetLearner) =>
  /\b(beginner|beginners|basic|junior|limited formal|new to|no experience|little experience|novice|starter|starting|technical beginners|začátečník|začátečníci|základy|nováček|bez zkušeností)\b/u.test(
    `${targetLearner.profile} ${targetLearner.currentKnowledge}`.toLowerCase(),
  );

const hasAdvancedTarget = (targetLearner: TargetLearner) =>
  /\b(advanced|senior|expert|experienced|lead|principal|production incident|triage|pokročilý|seniorní|expert)\b/u.test(
    `${targetLearner.profile} ${targetLearner.currentKnowledge}`.toLowerCase(),
  );

const difficultyFor = (index: number, targetLearner?: TargetLearner): Chapter['difficulty'] => {
  if (targetLearner && hasBeginnerOrUnclearTarget(targetLearner) && index > 0) {
    return 'intermediate';
  }
  if (targetLearner && !hasAdvancedTarget(targetLearner) && index > 0) {
    return 'intermediate';
  }
  if (index > 2) {
    return 'advanced';
  }
  if (index > 0) {
    return 'intermediate';
  }
  return 'introductory';
};

const generatedQuestionsLookGeneric = (draft: CourseDraft, questions: GuidedQuestions) => {
  const sourceTokens = fallbackTopicTokens(
    [
      draft.knowledgeChunks.map((chunk) => chunk.content).join(' '),
      draft.sources
        .filter((source) => source.status === 'processed')
        .map((source) => `${source.name} ${source.content}`)
        .join(' '),
    ].join(' '),
  ).slice(0, 8);
  if (sourceTokens.length === 0) {
    return false;
  }
  const combinedQuestions = safeUserVisibleText(
    [
      questions.outcome,
      questions.audience,
      questions.priorKnowledge,
      questions.avoid,
      questions.practice,
    ].join(' '),
  ).toLowerCase();
  const mentionsSourceContent = sourceTokens.some((token) => combinedQuestions.includes(token));
  const genericQuestionPattern =
    /\b(creators who need a focused\W+practical learning path|guided path|limited time|real workflow|build\W+a\W+practical output)\b/iu;
  return !mentionsSourceContent || genericQuestionPattern.test(combinedQuestions);
};

const normalizeGeneratedQuestions = (
  draft: CourseDraft,
  generatedQuestions: GeneratedQuestionsObject['questions'],
): GuidedQuestions => {
  const fallback = suggestQuestions(draft);
  const questions = {
    audience: asText(generatedQuestions.audience) || fallback.audience,
    avoid: asText(generatedQuestions.avoid) || fallback.avoid,
    depth: asText(generatedQuestions.depth) || fallback.depth,
    outcome: asText(generatedQuestions.outcome) || fallback.outcome,
    practice: asText(generatedQuestions.practice) || fallback.practice,
    priorKnowledge: asText(generatedQuestions.priorKnowledge) || fallback.priorKnowledge,
    strictSourceOnly:
      typeof generatedQuestions.strictSourceOnly === 'boolean'
        ? generatedQuestions.strictSourceOnly
        : fallback.strictSourceOnly,
  };
  return generatedQuestionsLookGeneric(draft, questions) ? fallback : questions;
};

export const generateQuestionsWithAi = (
  draft: CourseDraft,
): Promise<AiJsonResult<GuidedQuestions>> =>
  withLocalAiFallback(
    () =>
      withAiOutputRetries(async () => {
        const result = await generateStructuredObject(questionsProgram, {
          courseTitle: draft.title,
          languageCode: draft.language,
          sourceEvidence: processedSourceEvidence(draft),
        });
        return {
          ...result,
          value: normalizeGeneratedQuestions(draft, objectFieldFrom(result.value, 'questions')),
        };
      }),
    () => suggestQuestions(draft),
  );

export const generateTopicsWithAi = (draft: CourseDraft): Promise<AiJsonResult<Topic[]>> =>
  withLocalAiFallback(
    () =>
      withAiOutputRetries(async () => {
        const result = await generateStructuredObject(topicsProgram, {
          audience: draft.questions.audience,
          courseTitle: draft.title,
          languageCode: draft.language,
          learningOutcome: draft.questions.outcome,
          practiceStyle: draft.questions.practice,
          sourceEvidence: processedSourceEvidence(draft),
        });
        const generatedTopics = arrayFieldFrom(result.value, 'topics');
        const topics = generatedTopics
          .slice(0, 6)
          .map((topic, index): Topic | null => {
            const generatedTopic = topic as GeneratedTopic;
            const name = asText(generatedTopic.name);
            const description = asText(generatedTopic.description);
            if (
              name.length === 0 ||
              description.length === 0 ||
              hasWeakTopicShape(name, description)
            ) {
              return null;
            }
            return {
              description,
              id: `topic_${draft.id}_${index + 1}`,
              importance: normalizeImportance(generatedTopic.importance, index),
              name,
              sourceSupport: 'source_backed',
            };
          })
          .filter((topic): topic is Topic => topic !== null);
        if (topics.length === 0) {
          throw new Error('AI topic output did not include valid topics.');
        }
        return { ...result, value: topics };
      }),
    () => buildFallbackTopics(draft),
  );

export const generateTargetLearnerWithAi = (
  draft: CourseDraft,
): Promise<AiJsonResult<TargetLearner>> =>
  withLocalAiFallback(
    () =>
      withAiOutputRetries(async () => {
        const result = await generateStructuredObject(targetLearnerProgram, {
          audience: draft.questions.audience,
          courseTitle: draft.title,
          languageCode: draft.language,
          learningOutcome: draft.questions.outcome,
          practiceStyle: draft.questions.practice,
          priorKnowledge: draft.questions.priorKnowledge,
          topics: topicEvidence(draft),
        });
        const target = objectFieldFrom(result.value, 'targetLearner');
        const targetLearner: TargetLearner = {
          constraints: asText(target['constraints']),
          currentKnowledge: asText(target['currentKnowledge']),
          desiredOutcome: asText(target['desiredOutcome']),
          motivation: asText(target['motivation']),
          pain: asText(target['pain']),
          practiceStyle: asText(target['practiceStyle']),
          profile: asText(target['profile']),
        };
        if (targetLearner.profile.length === 0 || targetLearner.desiredOutcome.length === 0) {
          throw new Error('AI target learner output was incomplete.');
        }
        return { ...result, value: targetLearner };
      }),
    () => buildTargetLearner(draft),
  );

export const generateChaptersWithAi = (
  draft: CourseDraft,
  targetLearner: TargetLearner,
): Promise<AiJsonResult<Chapter[]>> =>
  withLocalAiFallback(
    () =>
      withAiOutputRetries(async () => {
        const result = await generateStructuredObject(chaptersProgram, {
          courseTitle: draft.title,
          desiredOutcome: targetLearner.desiredOutcome,
          languageCode: draft.language,
          targetLearnerProfile: targetLearner.profile,
          topics: topicEvidence(draft),
        });
        const generatedChapters = arrayFieldFrom(result.value, 'chapters');
        const topics = topicsForCourse(draft.topics);
        const chapters = generatedChapters
          .slice(0, 6)
          .map((chapter, index): Chapter | null => {
            const generatedChapter = chapter as GeneratedChapter;
            const title = asText(generatedChapter.title);
            const outcome = asText(generatedChapter.outcome);
            if (title.length === 0 || outcome.length === 0) {
              return null;
            }
            const matchingTopic = draft.topics.find((topic) =>
              title.toLowerCase().includes(topic.name.toLowerCase()),
            );
            const coveredTopic = matchingTopic ?? topics[index];
            return {
              coveredTopicIds: coveredTopic ? [coveredTopic.id] : [],
              description: outcome,
              difficulty: difficultyFor(index, targetLearner),
              id: `chapter_${draft.id}_${index + 1}`,
              lessons: [],
              outcome,
              plannedLessonCount: 1,
              sourceSupport: coveredTopic?.sourceSupport ?? 'source_backed',
              status: 'draft',
              title: `${index + 1}. ${title.replace(/^\d+\.\s*/u, '')}`,
            };
          })
          .filter((chapter): chapter is Chapter => chapter !== null);
        if (chapters.length === 0) {
          throw new Error('AI chapter output did not include valid chapters.');
        }
        return { ...result, value: chapters };
      }),
    () => buildChapters({ ...draft, targetLearner }),
  );

const lessonBlock = (
  lessonId: string,
  type: LessonBlock['type'],
  title: string,
  body: string,
  provenance: LessonBlock['provenance'],
  sourceReferences: LessonBlock['sourceReferences'] = [],
): LessonBlock => ({
  body,
  id: `block_${lessonId}_${type}`,
  provenance,
  ...(sourceReferences.length > 0 ? { sourceReferences } : {}),
  title,
  type,
});

const cleanGeneratedLessonBody = (body: string) =>
  body
    .replace(/^source-gap instruction:\s*/iu, '')
    .replace(/^source[- ]only instruction:\s*/iu, '')
    .replace(/^developer instruction:\s*/iu, '')
    .trim();

const generatedLessonForChapter = (
  generatedLessons: GeneratedLesson[],
  chapter: Chapter,
  index: number,
) =>
  (generatedLessons.find((lesson) =>
    asText(lesson.chapterTitle)
      .toLowerCase()
      .includes(chapter.title.replace(/^\d+\.\s*/u, '').toLowerCase()),
  ) as GeneratedLesson | undefined) ?? (generatedLessons[index] as GeneratedLesson | undefined);

const chapterWithGeneratedLesson = (
  draft: CourseDraft,
  chapter: Chapter,
  index: number,
  generatedLesson: GeneratedLesson,
): Chapter => {
  const lessonTitle = asText(generatedLesson.lessonTitle);
  const objective = cleanGeneratedLessonBody(asText(generatedLesson.objective));
  const explanation = cleanGeneratedLessonBody(asText(generatedLesson.explanation));
  const exercise = cleanGeneratedLessonBody(asText(generatedLesson.exercise));
  const check = cleanGeneratedLessonBody(asText(generatedLesson.check));
  const summary = cleanGeneratedLessonBody(asText(generatedLesson.summary));
  if (
    lessonTitle.length === 0 ||
    objective.length === 0 ||
    explanation.length === 0 ||
    exercise.length === 0 ||
    check.length === 0 ||
    summary.length === 0
  ) {
    throw new Error(`AI lesson output for ${chapter.title} was incomplete.`);
  }
  const lessonId = `lesson_${chapter.id}_1`;
  const sourceReferences = draft.knowledgeChunks.slice(0, 3).map((chunk) => chunk.reference);
  const hasProcessedSources = sourceReferences.length > 0;
  const needsSourceOnlyGap = draft.questions.strictSourceOnly && !hasProcessedSources;
  const titles = lessonBlockTitlesFor(draft.language);
  return {
    ...chapter,
    lessons: [
      {
        blocks: [
          lessonBlock(lessonId, 'objective', titles.objective, objective, 'AI-inferred'),
          lessonBlock(
            lessonId,
            'explanation',
            titles.explanation,
            needsSourceOnlyGap ? sourceOnlyGapBlockFor(draft.language, chapter.title) : explanation,
            hasProcessedSources ? 'source-backed' : 'AI-inferred',
            sourceReferences,
          ),
          lessonBlock(lessonId, 'exercise', titles.exercise, exercise, 'mixed'),
          lessonBlock(lessonId, 'check', titles.check, check, 'AI-inferred'),
          lessonBlock(lessonId, 'summary', titles.summary, summary, 'AI-inferred'),
        ],
        durationMinutes: 12 + index * 3,
        id: lessonId,
        title: lessonTitle,
      },
    ],
  };
};

export const generateLessonsWithAi = (draft: CourseDraft): Promise<AiJsonResult<Chapter[]>> =>
  withLocalAiFallback(
    () =>
      withAiOutputRetries(async () => {
        const result = await generateStructuredObject(lessonsProgram, {
          chapters: draft.chapters
            .map((chapter) => `${chapter.title}: ${chapter.outcome}`)
            .join('\n'),
          courseTitle: draft.title,
          languageCode: draft.language,
          practiceStyle: draft.questions.practice,
          sourceEvidence: processedSourceEvidence(draft),
          strictSourceOnly: draft.questions.strictSourceOnly,
          targetLearnerProfile: draft.targetLearner.profile,
        });
        const generatedLessons = arrayFieldFrom(result.value, 'lessons') as GeneratedLesson[];
        if (generatedLessons.length === 0) {
          throw new Error('AI lesson output did not include any lessons.');
        }
        const chapters = draft.chapters.map((chapter, index) => {
          const generatedLesson = generatedLessonForChapter(generatedLessons, chapter, index);
          if (!generatedLesson) {
            throw new Error(`AI lesson output did not include a lesson for ${chapter.title}.`);
          }
          return chapterWithGeneratedLesson(draft, chapter, index, generatedLesson);
        });
        return { ...result, value: chapters };
      }),
    () => buildLessons(draft),
  );
