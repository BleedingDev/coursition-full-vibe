// @effect-diagnostics nodeBuiltinImport:off globalDate:off globalFetch:off cryptoRandomUUID:off processEnv:off asyncFunction:off strictBooleanExpressions:off
import fs from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import {
  buildFindings,
  emptyQuestions,
  emptyTargetLearner,
  getWorkflowPrerequisiteGate,
  getWorkflowPreviewGate,
  getWorkflowStepGate,
  hasUsableTargetLearner,
  topicsForCourse,
  targetLearnerWithQuestionFallbacks,
} from '../../shared/coursition/workflow.ts';
import type {
  AiRun,
  AiRunType,
  Chapter,
  CourseDraft,
  CourseDraftSummary,
  DerivedSourceDocument,
  KnowledgeChunk,
  Lesson,
  LessonBlock,
  LessonBlockType,
  SourceAsset,
  TargetLearner,
  Topic,
  WorkflowSnapshot,
} from '../../shared/coursition/workflow.ts';
import type { WorkflowAction } from '../../shared/coursition/effect-api.ts';
import {
  generateChaptersWithAi,
  generateLessonsWithAi,
  generateQuestionsWithAi,
  generateTargetLearnerWithAi,
  generateTopicsWithAi,
  isAiProviderConfigured,
} from './ai-provider.ts';

interface StoreFile {
  drafts: CourseDraft[];
}

const dataDirectory = path.join(process.cwd(), '.coursition-data');
const dataPath = path.join(dataDirectory, 'workflow.json');
let storeMutationQueue: Promise<void> = Promise.resolve();
const completeStoreMutation = () => Promise.resolve();

const now = () => new Date().toISOString();
const createId = (prefix: string) => `${prefix}_${crypto.randomUUID().replaceAll('-', '')}`;
const textLikeFileExtensions = new Set([
  '.csv',
  '.json',
  '.md',
  '.mdx',
  '.rtf',
  '.text',
  '.tsv',
  '.txt',
  '.xml',
  '.yaml',
  '.yml',
]);
const llamaParseBaseUrl = process.env['LLAMA_CLOUD_BASE_URL'] ?? 'https://api.cloud.llamaindex.ai';
const deepgramBaseUrl = process.env['DEEPGRAM_BASE_URL'] ?? 'https://api.deepgram.com';
const firecrawlBaseUrl = process.env['FIRECRAWL_BASE_URL'] ?? 'https://api.firecrawl.dev';
const tavilyBaseUrl = process.env['TAVILY_BASE_URL'] ?? 'https://api.tavily.com';
const exaBaseUrl = process.env['EXA_BASE_URL'] ?? 'https://api.exa.ai';
const llamaParseMarkdownTiers = ['cost_effective', 'agentic', 'agentic_plus'] as const;
type LlamaParseMarkdownTier = (typeof llamaParseMarkdownTiers)[number];

interface BinarySourcePayload {
  bytes: Uint8Array;
  mimeType: string;
}

interface ProviderProcessingResult {
  content: string;
  mimeType?: string;
  providerJobId?: string;
  storageReference?: string;
}

interface WebExtractionResult extends ProviderProcessingResult {
  processor: string;
  providerName: string;
}

interface WebExtractionProvider {
  apiKey: string | undefined;
  extract: (targetUrl: URL) => Promise<WebExtractionResult>;
  name: string;
}

const readStore = async (): Promise<StoreFile> => {
  try {
    const content = await fs.readFile(dataPath, 'utf-8');
    return JSON.parse(content) as StoreFile;
  } catch {
    return { drafts: [] };
  }
};

const difficultyFor = (index: number): Chapter['difficulty'] => {
  if (index > 2) {
    return 'advanced';
  }
  return index > 0 ? 'intermediate' : 'introductory';
};

const hasBeginnerOrUnclearTarget = (targetLearner: TargetLearner) =>
  /\b(beginner|beginners|basic|junior|limited formal|new to|no experience|little experience|novice|starter|starting|technical beginners|začátečník|začátečníci|základy|nováček|bez zkušeností)\b/u.test(
    `${targetLearner.profile} ${targetLearner.currentKnowledge}`.toLowerCase(),
  );

const hasAdvancedTarget = (targetLearner: TargetLearner) =>
  /\b(advanced|senior|expert|experienced|lead|principal|production incident|triage|pokročilý|seniorní|expert)\b/u.test(
    `${targetLearner.profile} ${targetLearner.currentKnowledge}`.toLowerCase(),
  );

const generatedDifficultyFor = (
  index: number,
  targetLearner: TargetLearner,
): Chapter['difficulty'] => {
  if (hasBeginnerOrUnclearTarget(targetLearner) && index > 0) {
    return 'intermediate';
  }
  if (!hasAdvancedTarget(targetLearner) && index > 0) {
    return 'intermediate';
  }
  return difficultyFor(index);
};

const chapterWithDefaults = (chapter: Chapter, index: number): Chapter => ({
  ...chapter,
  coveredTopicIds: Array.isArray(chapter.coveredTopicIds) ? chapter.coveredTopicIds : [],
  description:
    typeof chapter.description === 'string' && chapter.description.length > 0
      ? chapter.description
      : chapter.outcome,
  difficulty: chapter.difficulty ?? difficultyFor(index),
  plannedLessonCount: chapter.plannedLessonCount ?? Math.max(1, chapter.lessons.length),
  sourceSupport: chapter.sourceSupport ?? 'manual',
  status: chapter.status ?? 'draft',
});

const topicWithDefaults = (topic: Topic & { status?: unknown }): Topic => ({
  description: topic.description ?? '',
  id: topic.id,
  importance: topic.importance ?? 'medium',
  name: topic.name ?? 'Untitled topic',
  sourceSupport: topic.sourceSupport ?? 'manual',
});

const normalizeTopics = (topics: Topic[]): Topic[] => topics.map(topicWithDefaults);

const reindexChapterTitles = (chapters: Chapter[]) =>
  chapters.map((chapter, index) => ({
    ...chapter,
    title: `${index + 1}. ${chapter.title.replace(/^\d+\.\s*/u, '')}`,
  }));

const sourceToDerivedDocument = (
  source: SourceAsset,
  createdAt: string,
): DerivedSourceDocument => ({
  content: source.content,
  createdAt,
  id: createId(`derived_${source.id}`),
  outputType: source.processor.includes('deepgram') ? 'transcript' : 'markdown',
  processor: source.processor,
  processorVersion: 'v1',
  quality: source.status === 'partially_processed' ? 'medium' : 'high',
  sourceAssetId: source.id,
});

const chunkDocument = (
  source: SourceAsset,
  document: DerivedSourceDocument,
  createdAt: string,
): KnowledgeChunk[] => {
  const paragraphs = document.content
    .split(/\n{2,}|(?<=\.)\s+(?=[A-Z0-9])/u)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  const chunks = paragraphs.length > 0 ? paragraphs : [document.content.trim()].filter(Boolean);
  const confidenceFor = (index: number): KnowledgeChunk['confidence'] => {
    if (document.quality === 'low') {
      return 'low';
    }
    return index === 0 ? 'high' : 'medium';
  };
  return chunks.slice(0, 24).map((content, index) => ({
    confidence: confidenceFor(index),
    content: content.slice(0, 1200),
    createdAt,
    derivedSourceDocumentId: document.id,
    id: createId(`chunk_${document.id}`),
    reference: {
      heading: source.name,
      position: `chunk-${index + 1}`,
      sourceAssetId: source.id,
    },
    sourceAssetId: source.id,
  }));
};

const documentsAndChunksForSource = (source: SourceAsset, createdAt: string) => {
  if (
    (source.status !== 'processed' && source.status !== 'partially_processed') ||
    source.content.trim().length === 0
  ) {
    return {
      derivedSourceDocuments: [],
      knowledgeChunks: [],
    };
  }
  const document = sourceToDerivedDocument(source, createdAt);
  return {
    derivedSourceDocuments: [document],
    knowledgeChunks: chunkDocument(source, document, createdAt),
  };
};

const normalizeDraft = (draft: CourseDraft): CourseDraft => {
  const createdAt = now();
  const generatedSourceData = draft.sources.flatMap((source) => {
    const result = documentsAndChunksForSource(source, source.createdAt ?? createdAt);
    return result.derivedSourceDocuments.map((document) => ({
      chunks: result.knowledgeChunks.filter(
        (chunk) => chunk.derivedSourceDocumentId === document.id,
      ),
      document,
    }));
  });
  const fallbackDocuments = generatedSourceData.map((entry) => entry.document);
  const fallbackChunks = generatedSourceData.flatMap((entry) => entry.chunks);
  return {
    ...draft,
    aiRuns: Array.isArray(draft.aiRuns) ? draft.aiRuns : [],
    chapters: Array.isArray(draft.chapters)
      ? draft.chapters.map((chapter, index) => chapterWithDefaults(chapter, index))
      : [],
    derivedSourceDocuments: Array.isArray(draft.derivedSourceDocuments)
      ? draft.derivedSourceDocuments
      : fallbackDocuments,
    findings: Array.isArray(draft.findings)
      ? draft.findings.map((finding) => ({
          ...finding,
          fingerprint: finding.fingerprint ?? finding.id,
          status: finding.status ?? 'open',
          step: finding.step ?? 'builder',
          targetId: finding.targetId ?? draft.id,
          targetType: finding.targetType ?? 'course',
        }))
      : [],
    knowledgeChunks: Array.isArray(draft.knowledgeChunks) ? draft.knowledgeChunks : fallbackChunks,
    mode: draft.mode === 'generate' ? 'generate' : 'assist',
    sourceProcessingIncomplete: draft.sources.some(
      (source) => source.status === 'queued' || source.status === 'processing',
    ),
    topics: Array.isArray(draft.topics) ? normalizeTopics(draft.topics) : [],
  };
};

const writeStore = async (store: StoreFile) => {
  await fs.mkdir(dataDirectory, { recursive: true });
  const temporaryPath = `${dataPath}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(temporaryPath, JSON.stringify(store, null, 2));
  await fs.rename(temporaryPath, dataPath);
};

const withStoreMutation = <Value>(operation: () => Promise<Value>) => {
  // Promise chaining is intentional here: this is the low-level queue that serializes JSON writes.
  // eslint-disable-next-line promise/prefer-await-to-then
  const mutation = storeMutationQueue.then(operation, operation);
  // eslint-disable-next-line promise/prefer-await-to-then
  storeMutationQueue = mutation.then(completeStoreMutation, completeStoreMutation);
  return mutation;
};

const saveDraft = (draft: CourseDraft) =>
  withStoreMutation(async () => {
    const store = await readStore();
    const nextDraft = normalizeDraft({ ...draft, updatedAt: now() });
    const draftIndex = store.drafts.findIndex((candidate) => candidate.id === draft.id);
    if (draftIndex === -1) {
      store.drafts.push(nextDraft);
    } else {
      store.drafts[draftIndex] = nextDraft;
    }
    await writeStore(store);
    return nextDraft;
  });

const requireDraft = async (ownerId: string, draftId: string) => {
  const store = await readStore();
  const draft = store.drafts.find(
    (candidate) => candidate.id === draftId && candidate.ownerId === ownerId,
  );
  if (!draft) {
    throw new Error('Course draft not found for signed-in creator.');
  }
  return normalizeDraft(draft);
};

const deleteDraft = (ownerId: string, draftId: string) =>
  withStoreMutation(async () => {
    const store = await readStore();
    const draftIndex = store.drafts.findIndex(
      (candidate) => candidate.id === draftId && candidate.ownerId === ownerId,
    );
    if (draftIndex === -1) {
      throw new Error('Course draft not found for signed-in creator.');
    }
    store.drafts.splice(draftIndex, 1);
    await writeStore(store);
  });

const latestDraft = async (ownerId: string) => {
  const store = await readStore();
  const draft =
    store.drafts
      .filter((candidate) => candidate.ownerId === ownerId)
      .toSorted((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null;
  return draft ? normalizeDraft(draft) : null;
};

const draftSummaryFor = (draft: CourseDraft): CourseDraftSummary => ({
  chapterCount: draft.chapters.length,
  id: draft.id,
  language: draft.language,
  lessonCount: draft.chapters.reduce((count, chapter) => count + chapter.lessons.length, 0),
  mode: draft.mode,
  sourceCount: draft.sources.filter((source) => source.status !== 'deleted').length,
  step: draft.step,
  title: draft.title,
  updatedAt: draft.updatedAt,
});

const draftSummariesFor = async (ownerId: string) => {
  const store = await readStore();
  return store.drafts
    .filter((candidate) => candidate.ownerId === ownerId)
    .map(normalizeDraft)
    .toSorted((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .map(draftSummaryFor);
};

const processorFor = (sourceType: SourceAsset['type']) => {
  if (sourceType === 'url') {
    return 'url_cleaner';
  }
  if (sourceType === 'notes') {
    return 'raw_text';
  }
  return 'local_text';
};

const processorForFileName = (name: string, hasReadableText: boolean) => {
  const extension = path.extname(name).toLowerCase();
  if (hasReadableText && textLikeFileExtensions.has(extension)) {
    return 'local_text';
  }
  if (['.pdf', '.doc', '.docx', '.odt', '.ppt', '.pptx'].includes(extension)) {
    return 'llamaparse_document';
  }
  if (['.mp3', '.wav', '.m4a'].includes(extension)) {
    return 'deepgram_audio';
  }
  if (['.mp4', '.mov', '.webm'].includes(extension)) {
    return 'deepgram_video';
  }
  if (['.png', '.jpg', '.jpeg', '.webp'].includes(extension)) {
    return 'image_text_extractor';
  }
  return 'unsupported_file';
};

const sourceProcessingIncomplete = (sources: SourceAsset[]) =>
  sources.some((source) => source.status === 'queued' || source.status === 'processing');

const parseHttpUrl = (value: string) => {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
};

const isReadableFileName = (name: string) =>
  textLikeFileExtensions.has(path.extname(name).toLowerCase());

const dataUrlPrefix = /^data:([^;,]+)?(?:;[^,]*)?;base64,(.*)$/su;

const decodeDataUrl = (value: string): BinarySourcePayload | null => {
  const match = dataUrlPrefix.exec(value.trim());
  if (!match) {
    return null;
  }
  const [, rawMimeType, data] = match;
  const mimeType = rawMimeType || 'application/octet-stream';
  if (!data) {
    return null;
  }
  return {
    bytes: Uint8Array.from(Buffer.from(data, 'base64')),
    mimeType,
  };
};

const arrayBufferFor = (bytes: Uint8Array) =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

const textFromUnknownJson = (value: unknown, preferredKeys: string[]): string => {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (!value || typeof value !== 'object') {
    return '';
  }
  for (const key of preferredKeys) {
    const record = value as Record<string, unknown>;
    const direct = textFromUnknownJson(record[key], preferredKeys);
    if (direct.length > 0) {
      return direct;
    }
  }
  if (Array.isArray(value)) {
    return value
      .map((entry) => textFromUnknownJson(entry, preferredKeys))
      .filter(Boolean)
      .join('\n\n');
  }
  return '';
};

const requireProviderKey = (value: string | undefined, providerName: string) => {
  if (!value) {
    throw new Error(`${providerName} API key is not configured.`);
  }
  return value;
};

const isLlamaParseMarkdownTier = (value: string): value is LlamaParseMarkdownTier =>
  llamaParseMarkdownTiers.some((tier) => tier === value);

const llamaParseTierForMarkdown = (): LlamaParseMarkdownTier => {
  const tier = process.env['LLAMA_PARSE_TIER'] ?? 'cost_effective';
  if (isLlamaParseMarkdownTier(tier)) {
    return tier;
  }
  throw new Error(
    `LLAMA_PARSE_TIER=${tier} cannot produce Markdown. Use cost_effective, agentic, or agentic_plus.`,
  );
};

const configuredWebExtractionProviderCount = () =>
  [
    process.env['FIRECRAWL_API_KEY'],
    process.env['TAVILY_API_KEY'],
    process.env['EXA_API_KEY'],
  ].filter(Boolean).length;

const isWebExtractionConfigured = () => configuredWebExtractionProviderCount() > 0;

const providerBaseUrl = (value: string) => value.replace(/\/+$/u, '');

const fetchJson = async (url: string, init: RequestInit) => {
  const response = await fetch(url, init);
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Provider request failed with ${response.status}.`);
  }
  return (await response.json()) as unknown;
};

const providerContentFromJson = (providerName: string, value: unknown) => {
  const content = textFromUnknownJson(value, [
    'markdown',
    'raw_content',
    'text',
    'content',
    'data',
    'results',
  ]);
  if (content.length === 0) {
    throw new Error(`${providerName} returned no readable Markdown.`);
  }
  return content;
};

const providerFailureMessage = (providerName: string, error: unknown) => {
  const message =
    error instanceof Error ? error.message : 'Provider request failed without a readable message.';
  return `${providerName}: ${message.slice(0, 280)}`;
};

const llamaParseJobRecord = (value: Record<string, unknown>) => {
  const nestedJob = value['job'];
  if (nestedJob && typeof nestedJob === 'object') {
    return nestedJob as Record<string, unknown>;
  }
  return value;
};

const llamaParseJobContent = async (jobId: string) => {
  let latestJob: Record<string, unknown> = {};
  for (let attempt = 0; attempt < 30; attempt += 1) {
    latestJob = (await fetchJson(`${llamaParseBaseUrl}/api/v2/parse/${jobId}?expand=markdown`, {
      headers: {
        Authorization: `Bearer ${requireProviderKey(
          process.env['LLAMA_CLOUD_API_KEY'],
          'LlamaParse',
        )}`,
      },
      method: 'GET',
    })) as Record<string, unknown>;
    const job = llamaParseJobRecord(latestJob);
    const status = String(job['status'] ?? '').toUpperCase();
    if (status === 'COMPLETED' || status === 'SUCCESS' || status === 'PARTIAL_SUCCESS') {
      const content = textFromUnknownJson(latestJob, [
        'markdown_full',
        'markdown',
        'markdown_content',
        'content',
        'pages',
      ]);
      if (content.length === 0) {
        throw new Error('LlamaParse completed without readable markdown.');
      }
      return content;
    }
    if (status === 'FAILED' || status === 'ERROR' || status === 'CANCELLED') {
      throw new Error(String(job['error_message'] ?? 'LlamaParse processing failed.'));
    }
    await sleep(2000);
  }
  throw new Error('LlamaParse processing did not finish before the local timeout.');
};

const createLlamaParseJob = async (body: Record<string, unknown>) => {
  const apiKey = requireProviderKey(process.env['LLAMA_CLOUD_API_KEY'], 'LlamaParse');
  const parseJob = (await fetchJson(`${llamaParseBaseUrl}/api/v2/parse`, {
    body: JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    method: 'POST',
  })) as Record<string, unknown>;
  const jobId = typeof parseJob['id'] === 'string' ? parseJob['id'] : '';
  if (jobId.length === 0) {
    throw new Error('LlamaParse did not return a parse job id.');
  }
  return jobId;
};

const parseLlamaDocument = async (
  sourceName: string,
  binary: BinarySourcePayload,
): Promise<ProviderProcessingResult> => {
  const apiKey = requireProviderKey(process.env['LLAMA_CLOUD_API_KEY'], 'LlamaParse');
  const formData = new FormData();
  formData.append('purpose', 'parse');
  formData.append(
    'file',
    new Blob([arrayBufferFor(binary.bytes)], { type: binary.mimeType }),
    sourceName,
  );
  const uploaded = (await fetchJson(`${llamaParseBaseUrl}/api/v1/beta/files`, {
    body: formData,
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    method: 'POST',
  })) as Record<string, unknown>;
  const fileId = typeof uploaded['id'] === 'string' ? uploaded['id'] : '';
  if (fileId.length === 0) {
    throw new Error('LlamaParse did not return an uploaded file id.');
  }
  const jobId = await createLlamaParseJob({
    file_id: fileId,
    tier: llamaParseTierForMarkdown(),
    version: process.env['LLAMA_PARSE_VERSION'] ?? 'latest',
  });
  return {
    content: await llamaParseJobContent(jobId),
    mimeType: binary.mimeType,
    providerJobId: jobId,
    storageReference: `llamacloud:${fileId}:${jobId}`,
  };
};

const extractWithFirecrawl = async (url: URL): Promise<WebExtractionResult> => {
  const providerName = 'Firecrawl';
  const response = (await fetchJson(`${providerBaseUrl(firecrawlBaseUrl)}/v1/scrape`, {
    body: JSON.stringify({
      formats: ['markdown'],
      onlyMainContent: true,
      url: url.toString(),
    }),
    headers: {
      Authorization: `Bearer ${requireProviderKey(process.env['FIRECRAWL_API_KEY'], providerName)}`,
      'content-type': 'application/json',
    },
    method: 'POST',
  })) as Record<string, unknown>;
  return {
    content: providerContentFromJson(providerName, response),
    processor: 'firecrawl_url',
    providerName,
    storageReference: `firecrawl:${url.toString()}`,
  };
};

const extractWithTavily = async (url: URL): Promise<WebExtractionResult> => {
  const providerName = 'Tavily';
  const response = (await fetchJson(`${providerBaseUrl(tavilyBaseUrl)}/extract`, {
    body: JSON.stringify({
      extract_depth: 'basic',
      format: 'markdown',
      urls: [url.toString()],
    }),
    headers: {
      Authorization: `Bearer ${requireProviderKey(process.env['TAVILY_API_KEY'], providerName)}`,
      'content-type': 'application/json',
    },
    method: 'POST',
  })) as Record<string, unknown>;
  return {
    content: providerContentFromJson(providerName, response),
    processor: 'tavily_url',
    providerName,
    storageReference: `tavily:${url.toString()}`,
  };
};

const extractWithExa = async (url: URL): Promise<WebExtractionResult> => {
  const providerName = 'Exa';
  const response = (await fetchJson(`${providerBaseUrl(exaBaseUrl)}/contents`, {
    body: JSON.stringify({
      text: true,
      urls: [url.toString()],
    }),
    headers: {
      'content-type': 'application/json',
      'x-api-key': requireProviderKey(process.env['EXA_API_KEY'], providerName),
    },
    method: 'POST',
  })) as Record<string, unknown>;
  return {
    content: providerContentFromJson(providerName, response),
    processor: 'exa_url',
    providerName,
    storageReference: `exa:${url.toString()}`,
  };
};

const extractWebUrl = async (url: URL): Promise<WebExtractionResult> => {
  const providers: WebExtractionProvider[] = [
    { apiKey: process.env['FIRECRAWL_API_KEY'], extract: extractWithFirecrawl, name: 'Firecrawl' },
    { apiKey: process.env['TAVILY_API_KEY'], extract: extractWithTavily, name: 'Tavily' },
    { apiKey: process.env['EXA_API_KEY'], extract: extractWithExa, name: 'Exa' },
  ];
  const failures: string[] = [];
  for (const provider of providers) {
    if (!provider.apiKey) {
      continue;
    }
    try {
      return await provider.extract(url);
    } catch (error) {
      failures.push(providerFailureMessage(provider.name, error));
    }
  }
  if (failures.length === 0) {
    throw new Error(
      'Web extraction provider is not configured. Set FIRECRAWL_API_KEY, TAVILY_API_KEY, or EXA_API_KEY and restart the dev server.',
    );
  }
  throw new Error(`Web extraction failed. ${failures.join(' | ')}`);
};

const transcribeWithDeepgram = async (
  sourceName: string,
  binary: BinarySourcePayload,
): Promise<ProviderProcessingResult> => {
  const apiKey = requireProviderKey(process.env['DEEPGRAM_API_KEY'], 'Deepgram');
  const model = process.env['DEEPGRAM_MODEL'] ?? 'nova-3';
  const response = (await fetchJson(
    `${deepgramBaseUrl}/v1/listen?model=${encodeURIComponent(model)}&smart_format=true&paragraphs=true&utterances=true&diarize_model=latest`,
    {
      body: arrayBufferFor(binary.bytes),
      headers: {
        Authorization: `Token ${apiKey}`,
        'content-type': binary.mimeType,
      },
      method: 'POST',
    },
  )) as Record<string, unknown>;
  const transcript = textFromUnknownJson(response, ['transcript']);
  if (transcript.length === 0) {
    throw new Error('Deepgram completed without a readable transcript.');
  }
  const metadata = response['metadata'] as Record<string, unknown> | undefined;
  const requestId =
    typeof metadata?.['request_id'] === 'string' ? metadata['request_id'] : undefined;
  return {
    content: transcript,
    mimeType: binary.mimeType,
    storageReference: `deepgram:${requestId ?? sourceName}`,
    ...(requestId ? { providerJobId: requestId } : {}),
  };
};

// eslint-disable-next-line complexity
const processSource = async (
  draftId: string,
  source: Extract<WorkflowAction, { action: 'addSource' }>['source'],
): Promise<SourceAsset> => {
  const createdAt = now();
  const trimmedContent = source.content.trim();
  const sourceType = source.type;
  const sourceName = source.name.trim() || source.type;
  if (sourceType === 'url') {
    const url = parseHttpUrl(trimmedContent);
    if (url) {
      try {
        const providerResult = await extractWebUrl(url);
        return {
          content: providerResult.content,
          createdAt,
          id: createId(`source_${draftId}`),
          name: sourceName,
          originalInput: trimmedContent,
          processor: providerResult.processor,
          sizeLabel: source.sizeLabel ?? `${providerResult.content.length} chars`,
          status: 'processed',
          type: source.type,
          ...(providerResult.providerJobId ? { providerJobId: providerResult.providerJobId } : {}),
          ...(providerResult.storageReference
            ? { storageReference: providerResult.storageReference }
            : {}),
        };
      } catch (error) {
        return {
          content: '',
          createdAt,
          failureReason:
            error instanceof Error
              ? error.message
              : 'The web extraction providers could not process this URL.',
          id: createId(`source_${draftId}`),
          name: sourceName,
          originalInput: trimmedContent,
          processor: 'web_extraction_url',
          sizeLabel: source.sizeLabel ?? '0 chars',
          status: 'failed',
          type: source.type,
        };
      }
    }
  }
  const isSupported =
    sourceType === 'notes' ||
    sourceType === 'url' ||
    (trimmedContent.length > 0 && isReadableFileName(sourceName));
  const fileProcessor =
    sourceType === 'file' ? processorForFileName(sourceName, trimmedContent.length > 0) : null;
  const isProviderBackedFile = Boolean(
    fileProcessor &&
    fileProcessor !== 'local_text' &&
    fileProcessor !== 'unsupported_file' &&
    processorForFileName(sourceName, false) !== 'unsupported_file',
  );
  if (sourceType === 'file' && isProviderBackedFile && fileProcessor) {
    const binary = decodeDataUrl(trimmedContent);
    if (binary) {
      try {
        const providerResult = fileProcessor.includes('deepgram')
          ? await transcribeWithDeepgram(sourceName, binary)
          : await parseLlamaDocument(sourceName, binary);
        return {
          content: providerResult.content,
          createdAt,
          id: createId(`source_${draftId}`),
          name: sourceName,
          originalInput: trimmedContent,
          processor: fileProcessor,
          sizeLabel: source.sizeLabel ?? `${providerResult.content.length} chars`,
          status: providerResult.content.length > 0 ? 'processed' : 'failed',
          type: source.type,
          ...(providerResult.mimeType ? { mimeType: providerResult.mimeType } : {}),
          ...(providerResult.providerJobId ? { providerJobId: providerResult.providerJobId } : {}),
          ...(providerResult.storageReference
            ? { storageReference: providerResult.storageReference }
            : {}),
          ...(providerResult.content.length > 0
            ? {}
            : { failureReason: 'The provider did not return readable content.' }),
        };
      } catch (error) {
        return {
          content: '',
          createdAt,
          failureReason:
            error instanceof Error
              ? error.message
              : 'The source provider could not process this file.',
          id: createId(`source_${draftId}`),
          mimeType: binary.mimeType,
          name: sourceName,
          originalInput: trimmedContent,
          processor: fileProcessor,
          sizeLabel: source.sizeLabel ?? `${binary.bytes.byteLength} bytes`,
          status: 'failed',
          type: source.type,
        };
      }
    }
    if (trimmedContent.length > 0) {
      return {
        content: trimmedContent,
        createdAt,
        failureReason: 'Upload the original binary file so the provider can process it.',
        id: createId(`source_${draftId}`),
        name: sourceName,
        originalInput: trimmedContent,
        processor: fileProcessor,
        sizeLabel: source.sizeLabel ?? `${trimmedContent.length} chars`,
        status: 'failed',
        type: source.type,
      };
    }
  }
  return {
    content: trimmedContent,
    createdAt,
    id: createId(`source_${draftId}`),
    name: sourceName,
    originalInput: trimmedContent,
    processor: fileProcessor ?? processorFor(sourceType),
    sizeLabel: source.sizeLabel ?? `${trimmedContent.length} chars`,
    status: isSupported ? 'processed' : 'unsupported',
    type: source.type,
    ...(isSupported ? {} : { failureReason: 'No readable content was supplied.' }),
  };
};

const failedAiRun = (draft: CourseDraft, run: AiRun, error: unknown): CourseDraft => ({
  ...draft,
  aiRuns: [
    ...draft.aiRuns.filter((candidate) => candidate.id !== run.id),
    {
      ...run,
      failureReason: error instanceof Error ? error.message : 'AI generation failed.',
      status: 'failed',
      updatedAt: now(),
    },
  ],
});

const createAiRun = (draft: CourseDraft, type: AiRunType): AiRun => ({
  createdAt: now(),
  draftId: draft.id,
  id: createId(`airun_${draft.id}`),
  inputSummary: `${type} for ${draft.title}`,
  model: process.env['COURSITION_AI_MODEL'] ?? 'gpt-5.3-codex-spark',
  provider: 'ax/openai-compatible',
  status: 'running',
  type,
  updatedAt: now(),
});

const appliedAiRun = (run: AiRun, outputText: string, model: string, provider: string): AiRun => ({
  ...run,
  appliedAt: now(),
  model,
  outputText,
  provider,
  status: 'applied',
  updatedAt: now(),
});

const reviewableAiRun = (
  run: AiRun,
  outputText: string,
  model: string,
  provider: string,
): AiRun => ({
  ...run,
  model,
  outputText,
  provider,
  status: 'needs_review',
  updatedAt: now(),
});

const applyReviewedRuns = (runs: AiRun[], types: AiRunType[]) =>
  runs.map((run) =>
    types.includes(run.type) && run.status === 'needs_review'
      ? {
          ...run,
          appliedAt: now(),
          status: 'applied' as const,
          updatedAt: now(),
        }
      : run,
  );

const createManualTopic = (draft: CourseDraft, name: string, description: string): Topic => ({
  description: description.trim() || 'Manually added course topic.',
  id: createId(`topic_${draft.id}`),
  importance: 'medium',
  name: name.trim() || 'Untitled topic',
  sourceSupport: 'manual',
});

const normalizedTopicName = (topic: Topic) => topic.name.trim().toLowerCase();

const mergeGeneratedTopics = (currentTopics: Topic[], generatedTopics: Topic[]) => {
  const currentTopicIds = new Set(currentTopics.map((topic) => topic.id));
  const currentTopicNames = new Set(currentTopics.map(normalizedTopicName));
  return [
    ...currentTopics,
    ...generatedTopics.filter(
      (topic) =>
        !currentTopicIds.has(topic.id) && !currentTopicNames.has(normalizedTopicName(topic)),
    ),
  ];
};

const createManualChapter = (
  draft: CourseDraft,
  title: string,
  outcome: string,
  description: string,
): Chapter => {
  const chapterTitle = title.trim() || 'Untitled chapter';
  return {
    coveredTopicIds: [],
    description: description.trim() || outcome.trim() || chapterTitle,
    difficulty: difficultyFor(draft.chapters.length),
    id: createId(`chapter_${draft.id}`),
    lessons: [],
    outcome: outcome.trim() || `Learners can apply ${chapterTitle}.`,
    plannedLessonCount: 1,
    sourceSupport: 'manual',
    status: 'draft',
    title: chapterTitle,
  };
};

const createManualLesson = (chapterId: string, title: string): Lesson => ({
  blocks: [],
  durationMinutes: 10,
  id: createId(`lesson_${chapterId}`),
  title: title.trim() || 'Untitled lesson',
});

const createManualBlock = (
  lessonId: string,
  type: LessonBlockType,
  title: string,
  body: string,
): LessonBlock => ({
  body: body.trim(),
  id: createId(`block_${lessonId}`),
  provenance: 'manual',
  sourceReferences: [],
  title: title.trim() || 'Untitled block',
  type,
});

const moveById = <Item extends { id: string }>(
  items: Item[],
  itemId: string,
  direction: 'up' | 'down',
) => {
  const index = items.findIndex((item) => item.id === itemId);
  if (index === -1) {
    return items;
  }
  const nextIndex = direction === 'up' ? index - 1 : index + 1;
  if (nextIndex < 0 || nextIndex >= items.length) {
    return items;
  }
  const nextItems = [...items];
  const currentItem = nextItems[index];
  const nextItem = nextItems[nextIndex];
  if (!currentItem || !nextItem) {
    return items;
  }
  nextItems[index] = nextItem;
  nextItems[nextIndex] = currentItem;
  return nextItems;
};

const chapterHasManualLessonEdits = (chapter: Chapter) =>
  chapter.lessons.some((lesson) => lesson.blocks.some((block) => block.provenance === 'manual'));

const lessonHasManualEdits = (lesson: Lesson) =>
  lesson.blocks.some((block) => block.provenance === 'manual');

const requiredSnapshotDraft = (draft: WorkflowSnapshot['draft']) => {
  if (!draft) {
    throw new Error('Expected workflow action to return a draft.');
  }
  return draft;
};

const gateFailureReason = (gate: ReturnType<typeof getWorkflowPrerequisiteGate>) => {
  if (gate.reason === 'blockingFinding') {
    return gate.finding?.title ?? 'Resolve blocking review findings before continuing.';
  }
  if (gate.reason === 'topicsRequired') {
    return 'Select at least one topic before generating chapters.';
  }
  if (gate.reason === 'generatedTopicsRequired') {
    return 'Generate topics before continuing.';
  }
  if (gate.reason === 'questionsRequired') {
    return 'Answer the required teaching questions before continuing.';
  }
  if (gate.reason === 'sourceRequired') {
    return 'Add source material before generating the course.';
  }
  if (gate.reason === 'targetLearnerRequired') {
    return 'Confirm target learner before generating chapters.';
  }
  if (gate.reason === 'chaptersRequired') {
    return 'Generate chapters before generating lessons.';
  }
  if (gate.reason === 'chapterConfirmationRequired') {
    return 'Confirm chapter structure before generating lessons.';
  }
  if (gate.reason === 'fullCourseGenerationRequired') {
    return 'Generate the course before reviewing skipped planning steps.';
  }
  if (gate.reason === 'lessonsRequired') {
    return 'Generate lessons before opening preview.';
  }
  return 'Complete the required previous step before continuing.';
};

const assertWorkflowGate = (gate: ReturnType<typeof getWorkflowPrerequisiteGate>) => {
  if (!gate.allowed) {
    throw new Error(gateFailureReason(gate));
  }
};

const draftForStep = (draft: CourseDraft, step: CourseDraft['step']): CourseDraft => ({
  ...draft,
  findings: buildFindings(draft),
  step,
});

const mergeGeneratedLessons = (currentChapters: Chapter[], generatedChapters: Chapter[]) =>
  generatedChapters.map((generatedChapter) => {
    const currentChapter = currentChapters.find((chapter) => chapter.id === generatedChapter.id);
    const hasManualEdits = currentChapter ? chapterHasManualLessonEdits(currentChapter) : false;
    return hasManualEdits && currentChapter ? currentChapter : generatedChapter;
  });

const mergeGeneratedChapters = (
  currentChapters: Chapter[],
  generatedChapters: Chapter[],
  topics: Topic[],
  targetLearner: TargetLearner,
) => {
  const normalizedGeneratedChapters = generatedChapters.map((chapter, index) => ({
    ...chapter,
    difficulty: generatedDifficultyFor(index, targetLearner),
  }));
  const generatedById = new Map(
    normalizedGeneratedChapters.map((chapter) => [chapter.id, chapter]),
  );
  const mergedChapters = currentChapters.flatMap((currentChapter) => {
    const generatedChapter = generatedById.get(currentChapter.id);
    if (!generatedChapter) {
      return /^chapter_.+_\d+$/u.test(currentChapter.id) ? [] : [currentChapter];
    }
    generatedById.delete(currentChapter.id);
    return [
      {
        ...currentChapter,
        coveredTopicIds: generatedChapter.coveredTopicIds,
        difficulty: generatedChapter.difficulty,
        plannedLessonCount: generatedChapter.plannedLessonCount,
        sourceSupport: generatedChapter.sourceSupport,
        status: generatedChapter.status,
      },
    ];
  });

  const chapters = reindexChapterTitles([...mergedChapters, ...generatedById.values()]);
  const coveredTopicIds = new Set(
    chapters.flatMap((chapter) => chapter.coveredTopicIds.filter(Boolean)),
  );
  const uncoveredTopics = topicsForCourse(topics).filter((topic) => !coveredTopicIds.has(topic.id));
  if (uncoveredTopics.length === 0 || chapters.length === 0) {
    return chapters;
  }

  return chapters.map((chapter, index) => {
    const topic = uncoveredTopics[index % uncoveredTopics.length];
    if (!topic) {
      return chapter;
    }
    return {
      ...chapter,
      coveredTopicIds: [...new Set([...chapter.coveredTopicIds, topic.id])],
    };
  });
};

const updateFindingStatus = (
  findings: CourseDraft['findings'],
  findingId: string,
  status: CourseDraft['findings'][number]['status'],
) =>
  findings.map((finding) =>
    finding.id === findingId
      ? {
          ...finding,
          status,
        }
      : finding,
  );

export const snapshotFor = async (ownerId: string): Promise<WorkflowSnapshot> => ({
  config: {
    aiProviderConfigured: isAiProviderConfigured(),
    auth: 'better-auth',
    deepgramConfigured: Boolean(process.env['DEEPGRAM_API_KEY']),
    llamaParseConfigured: Boolean(process.env['LLAMA_CLOUD_API_KEY']),
    storage: 'json-file',
    webExtractionConfigured: isWebExtractionConfigured(),
  },
  draft: await latestDraft(ownerId),
  drafts: await draftSummariesFor(ownerId),
});

export const snapshotForRoute = async (
  ownerId: string,
  draftId: string,
  step: CourseDraft['step'],
): Promise<WorkflowSnapshot> => {
  const draft = await requireDraft(ownerId, draftId);
  const routeDraft = draftForStep(draft, step);
  const gate =
    step === 'preview'
      ? getWorkflowPreviewGate(routeDraft, { blockOpenFindings: true })
      : getWorkflowStepGate(draft, step);
  if (!gate.allowed) {
    const fallbackStep = gate.blockedStep ?? 'mode';
    return {
      ...(await snapshotFor(ownerId)),
      draft: draftForStep(draft, fallbackStep),
    };
  }
  return {
    ...(await snapshotFor(ownerId)),
    draft: routeDraft,
  };
};

// eslint-disable-next-line complexity
export const applyWorkflowAction = async (
  ownerId: string,
  action: WorkflowAction,
): Promise<WorkflowSnapshot> => {
  if (action.action === 'getState') {
    return snapshotFor(ownerId);
  }

  if (action.action === 'createDraft') {
    const title = action.title.trim();
    if (title.length === 0) {
      throw new Error('Course title is required.');
    }
    const createdAt = now();
    const draft = await saveDraft({
      aiRuns: [],
      chapters: [],
      createdAt,
      derivedSourceDocuments: [],
      findings: [],
      id: createId('course'),
      knowledgeChunks: [],
      language: action.language,
      mode: 'assist',
      ownerId,
      questions: emptyQuestions(),
      sourceProcessingIncomplete: false,
      sources: [],
      step: 'mode',
      targetLearner: emptyTargetLearner(),
      title,
      topics: [],
      updatedAt: createdAt,
    });
    return { ...(await snapshotFor(ownerId)), draft };
  }

  if (action.action === 'selectDraft') {
    return {
      ...(await snapshotFor(ownerId)),
      draft: await requireDraft(ownerId, action.draftId),
    };
  }

  if (action.action === 'deleteDraft') {
    await deleteDraft(ownerId, action.draftId);
    return {
      ...(await snapshotFor(ownerId)),
      draft: null,
    };
  }

  const draft = await requireDraft(ownerId, action.draftId);

  switch (action.action) {
    case 'updateDraftTitle': {
      const draftForTitleUpdate = await requireDraft(ownerId, action.draftId);
      return {
        ...(await snapshotFor(ownerId)),
        draft: await saveDraft({
          ...draftForTitleUpdate,
          title: action.title.trim() || draftForTitleUpdate.title,
        }),
      };
    }
    case 'goToStep': {
      assertWorkflowGate(getWorkflowStepGate(draft, action.step));
      return {
        ...(await snapshotFor(ownerId)),
        draft: await saveDraft(draftForStep(draft, action.step)),
      };
    }
    case 'setMode': {
      if (action.mode !== 'generate' && action.mode !== 'assist') {
        throw new Error('Unsupported course mode.');
      }
      return {
        ...(await snapshotFor(ownerId)),
        draft: await saveDraft({
          ...draft,
          mode: action.mode,
        }),
      };
    }
    case 'buildFullCourse': {
      if (draft.mode !== 'generate') {
        throw new Error('Full course generation is only available in generate mode.');
      }
      assertWorkflowGate(getWorkflowPrerequisiteGate(draft, 'questions'));
      const questionResult = await generateQuestionsWithAi(draft);
      let currentDraft = await saveDraft({
        ...draft,
        findings: buildFindings({
          ...draft,
          findings: [],
          questions: questionResult.value,
        }),
        questions: questionResult.value,
      });
      const topicSnapshot = await applyWorkflowAction(ownerId, {
        action: 'generateTopics',
        draftId: currentDraft.id,
      });
      currentDraft = requiredSnapshotDraft(topicSnapshot.draft);
      if (topicsForCourse(currentDraft.topics).length === 0) {
        throw new Error('Add at least one topic before continuing.');
      }
      const targetSnapshot = await applyWorkflowAction(ownerId, {
        action: 'generateTargetLearner',
        draftId: currentDraft.id,
      });
      currentDraft = requiredSnapshotDraft(targetSnapshot.draft);
      if (!hasUsableTargetLearner(currentDraft)) {
        throw new Error('Target learner profile and outcome are required.');
      }
      const targetLearner = targetLearnerWithQuestionFallbacks(
        currentDraft,
        currentDraft.targetLearner,
      );
      const confirmedTargetSnapshot = await applyWorkflowAction(ownerId, {
        action: 'confirmTarget',
        draftId: currentDraft.id,
        targetLearner,
      });
      currentDraft = requiredSnapshotDraft(confirmedTargetSnapshot.draft);
      const chapterSnapshot = await applyWorkflowAction(ownerId, {
        action: 'generateChapters',
        draftId: currentDraft.id,
      });
      currentDraft = requiredSnapshotDraft(chapterSnapshot.draft);
      const confirmedChapterSnapshot = await applyWorkflowAction(ownerId, {
        action: 'confirmChapters',
        draftId: currentDraft.id,
      });
      currentDraft = requiredSnapshotDraft(confirmedChapterSnapshot.draft);
      return applyWorkflowAction(ownerId, { action: 'generateLessons', draftId: currentDraft.id });
    }
    case 'addSource': {
      if (action.source.name.trim().length === 0) {
        throw new Error('Source name is required.');
      }
      if (action.source.type !== 'file' && action.source.content.trim().length === 0) {
        throw new Error('Source content is required.');
      }
      const source = await processSource(draft.id, action.source);
      const sources = [...draft.sources, source];
      const derived = documentsAndChunksForSource(source, source.createdAt ?? now());
      return {
        ...(await snapshotFor(ownerId)),
        draft: await saveDraft({
          ...draft,
          derivedSourceDocuments: [
            ...draft.derivedSourceDocuments,
            ...derived.derivedSourceDocuments,
          ],
          knowledgeChunks: [...draft.knowledgeChunks, ...derived.knowledgeChunks],
          sourceProcessingIncomplete: sourceProcessingIncomplete(sources),
          sources,
          step: 'knowledge',
        }),
      };
    }
    case 'deleteSource': {
      const sources = draft.sources.map((source) =>
        source.id === action.sourceId
          ? { ...source, deletedAt: now(), status: 'deleted' as const }
          : source,
      );
      return {
        ...(await snapshotFor(ownerId)),
        draft: await saveDraft({
          ...draft,
          derivedSourceDocuments: draft.derivedSourceDocuments.filter(
            (document) => document.sourceAssetId !== action.sourceId,
          ),
          knowledgeChunks: draft.knowledgeChunks.filter(
            (chunk) => chunk.sourceAssetId !== action.sourceId,
          ),
          sourceProcessingIncomplete: sourceProcessingIncomplete(sources),
          sources,
        }),
      };
    }
    case 'retrySource': {
      const existingSource = draft.sources.find((source) => source.id === action.sourceId);
      if (!existingSource) {
        throw new Error('Source not found for signed-in creator.');
      }
      const retriedSource = await processSource(draft.id, {
        content: existingSource.originalInput ?? existingSource.content,
        name: existingSource.name,
        sizeLabel: existingSource.sizeLabel,
        type: existingSource.type,
      });
      const replacementSource = { ...retriedSource, id: existingSource.id };
      const derived = documentsAndChunksForSource(
        replacementSource,
        replacementSource.createdAt ?? now(),
      );
      const sources = draft.sources.map((source) =>
        source.id === action.sourceId ? replacementSource : source,
      );
      return {
        ...(await snapshotFor(ownerId)),
        draft: await saveDraft({
          ...draft,
          derivedSourceDocuments: [
            ...draft.derivedSourceDocuments.filter(
              (document) => document.sourceAssetId !== action.sourceId,
            ),
            ...derived.derivedSourceDocuments,
          ],
          knowledgeChunks: [
            ...draft.knowledgeChunks.filter((chunk) => chunk.sourceAssetId !== action.sourceId),
            ...derived.knowledgeChunks,
          ],
          sourceProcessingIncomplete: sourceProcessingIncomplete(sources),
          sources,
        }),
      };
    }
    case 'retryAiRun': {
      const run = draft.aiRuns.find((candidate) => candidate.id === action.runId);
      if (!run) {
        throw new Error('AI run not found for signed-in creator.');
      }
      if (run.status !== 'failed') {
        throw new Error('Only failed AI runs can be retried.');
      }
      switch (run.type) {
        case 'topic_generation': {
          return applyWorkflowAction(ownerId, { action: 'generateTopics', draftId: draft.id });
        }
        case 'target_learner_generation': {
          return applyWorkflowAction(ownerId, {
            action: 'generateTargetLearner',
            draftId: draft.id,
          });
        }
        case 'chapter_generation': {
          return applyWorkflowAction(ownerId, { action: 'generateChapters', draftId: draft.id });
        }
        case 'lesson_generation': {
          return applyWorkflowAction(ownerId, { action: 'generateLessons', draftId: draft.id });
        }
        default: {
          throw new Error('This AI run type cannot be retried yet.');
        }
      }
    }
    case 'autosaveQuestions': {
      const draftForQuestionAutosave = await requireDraft(ownerId, action.draftId);
      const questionsDraft = {
        ...draftForQuestionAutosave,
        questions: action.questions,
      };
      return {
        ...(await snapshotFor(ownerId)),
        draft: await saveDraft({
          ...questionsDraft,
          findings: buildFindings(questionsDraft),
        }),
      };
    }
    case 'saveQuestions': {
      const findings = buildFindings({ ...draft, questions: action.questions });
      const hasRequiredQuestionGap = findings.some(
        (finding) => finding.id === `finding_${draft.id}_required_questions`,
      );
      return {
        ...(await snapshotFor(ownerId)),
        draft: await saveDraft({
          ...draft,
          findings,
          questions: action.questions,
          step:
            hasRequiredQuestionGap || (draft.mode === 'generate' && draft.topics.length === 0)
              ? 'questions'
              : 'topics',
        }),
      };
    }
    case 'generateTopics': {
      assertWorkflowGate(getWorkflowPrerequisiteGate(draft, 'questions'));
      const requiredQuestionFinding = buildFindings(draft).find(
        (finding) => finding.id === `finding_${draft.id}_required_questions`,
      );
      if (draft.mode === 'generate' && requiredQuestionFinding) {
        throw new Error(requiredQuestionFinding.title);
      }
      const aiRun = createAiRun(draft, 'topic_generation');
      const draftWithRunningRun = await saveDraft({
        ...draft,
        aiRuns: [...draft.aiRuns, aiRun],
      });
      try {
        const result = await generateTopicsWithAi(draftWithRunningRun);
        const nextDraft: CourseDraft = {
          ...draftWithRunningRun,
          aiRuns: [
            ...draftWithRunningRun.aiRuns.filter((run) => run.id !== aiRun.id),
            appliedAiRun(aiRun, result.text, result.model, result.provider),
          ],
          step: 'topics',
          topics: mergeGeneratedTopics(draftWithRunningRun.topics, result.value),
        };
        return {
          ...(await snapshotFor(ownerId)),
          draft: await saveDraft({
            ...nextDraft,
            findings: buildFindings({ ...nextDraft, findings: [] }),
          }),
        };
      } catch (error) {
        return {
          ...(await snapshotFor(ownerId)),
          draft: await saveDraft(failedAiRun(draftWithRunningRun, aiRun, error)),
        };
      }
    }
    case 'addTopic': {
      if (action.name.trim().length === 0) {
        throw new Error('Topic name is required.');
      }
      return {
        ...(await snapshotFor(ownerId)),
        draft: await saveDraft({
          ...draft,
          topics: [...draft.topics, createManualTopic(draft, action.name, action.description)],
        }),
      };
    }
    case 'updateTopic': {
      return {
        ...(await snapshotFor(ownerId)),
        draft: await saveDraft({
          ...draft,
          topics: draft.topics.map((topic) =>
            topic.id === action.topicId
              ? {
                  ...topic,
                  description: action.description.trim() || topic.description,
                  name: action.name.trim() || topic.name,
                }
              : topic,
          ),
        }),
      };
    }
    case 'deleteTopic': {
      return {
        ...(await snapshotFor(ownerId)),
        draft: await saveDraft({
          ...draft,
          topics: draft.topics.filter((topic) => topic.id !== action.topicId),
        }),
      };
    }
    case 'generateTargetLearner': {
      const targetLearnerRun = createAiRun(draft, 'target_learner_generation');
      const draftWithRunningRun = await saveDraft({
        ...draft,
        aiRuns: [...draft.aiRuns, targetLearnerRun],
      });
      try {
        const targetLearnerResult = await generateTargetLearnerWithAi(draftWithRunningRun);
        const targetDraft = {
          ...draftWithRunningRun,
          aiRuns: [
            ...draftWithRunningRun.aiRuns.filter((run) => run.id !== targetLearnerRun.id),
            reviewableAiRun(
              targetLearnerRun,
              targetLearnerResult.text,
              targetLearnerResult.model,
              targetLearnerResult.provider,
            ),
          ],
          step: 'target' as const,
          targetLearner: targetLearnerResult.value,
        };
        return {
          ...(await snapshotFor(ownerId)),
          draft: await saveDraft({
            ...targetDraft,
            findings: buildFindings(targetDraft),
          }),
        };
      } catch (error) {
        return {
          ...(await snapshotFor(ownerId)),
          draft: await saveDraft(failedAiRun(draftWithRunningRun, targetLearnerRun, error)),
        };
      }
    }
    case 'updateTargetLearner': {
      const targetDraft: CourseDraft = {
        ...draft,
        targetLearner: action.targetLearner,
      };
      return {
        ...(await snapshotFor(ownerId)),
        draft: await saveDraft({
          ...targetDraft,
          findings: buildFindings(targetDraft),
        }),
      };
    }
    case 'confirmTarget': {
      const targetDraft: CourseDraft = {
        ...draft,
        aiRuns: applyReviewedRuns(draft.aiRuns, ['target_learner_generation']),
        step: 'chapters',
        targetLearner: action.targetLearner,
      };
      if (!hasUsableTargetLearner(targetDraft)) {
        throw new Error('Target learner profile and outcome are required.');
      }
      return {
        ...(await snapshotFor(ownerId)),
        draft: await saveDraft({
          ...targetDraft,
          findings: buildFindings(targetDraft),
        }),
      };
    }
    case 'addChapter': {
      if (action.title.trim().length === 0) {
        throw new Error('Chapter title is required.');
      }
      const chapters = reindexChapterTitles([
        ...draft.chapters,
        createManualChapter(draft, action.title, action.outcome, action.description),
      ]);
      return {
        ...(await snapshotFor(ownerId)),
        draft: await saveDraft({
          ...draft,
          chapters,
          step: 'chapters',
        }),
      };
    }
    case 'updateChapter': {
      return {
        ...(await snapshotFor(ownerId)),
        draft: await saveDraft({
          ...draft,
          chapters: draft.chapters.map((chapter) =>
            chapter.id === action.chapterId
              ? {
                  ...chapter,
                  description: action.description.trim() || chapter.description,
                  outcome: action.outcome.trim() || chapter.outcome,
                  title: action.title.trim() || chapter.title,
                }
              : chapter,
          ),
          step: 'chapters',
        }),
      };
    }
    case 'deleteChapter': {
      return {
        ...(await snapshotFor(ownerId)),
        draft: await saveDraft({
          ...draft,
          chapters: reindexChapterTitles(
            draft.chapters.filter((chapter) => chapter.id !== action.chapterId),
          ),
          step: 'chapters',
        }),
      };
    }
    case 'moveChapter': {
      return {
        ...(await snapshotFor(ownerId)),
        draft: await saveDraft({
          ...draft,
          chapters: reindexChapterTitles(
            moveById(draft.chapters, action.chapterId, action.direction),
          ),
          step: 'chapters',
        }),
      };
    }
    case 'confirmChapters': {
      const confirmedDraft = {
        ...draft,
        chapters: draft.chapters.map((chapter) => ({ ...chapter, status: 'confirmed' as const })),
      };
      assertWorkflowGate(
        getWorkflowPrerequisiteGate(
          { ...confirmedDraft, findings: buildFindings(confirmedDraft) },
          'chapters',
          { blockOpenFindings: true, includeTargetFindings: true },
        ),
      );
      if (draft.chapters.length === 0) {
        throw new Error('Generate chapters before generating lessons.');
      }
      return {
        ...(await snapshotFor(ownerId)),
        draft: await saveDraft({
          ...confirmedDraft,
          aiRuns: applyReviewedRuns(draft.aiRuns, ['chapter_generation']),
          step: 'lessons',
        }),
      };
    }
    case 'generateChapters': {
      assertWorkflowGate(getWorkflowPrerequisiteGate(draft, 'chapters'));
      const targetLearnerRun =
        draft.targetLearner.profile.length === 0
          ? createAiRun(draft, 'target_learner_generation')
          : null;
      const chapterRun = createAiRun(draft, 'chapter_generation');
      const draftWithRunningRuns = await saveDraft({
        ...draft,
        aiRuns: [...draft.aiRuns, ...(targetLearnerRun ? [targetLearnerRun] : []), chapterRun],
      });
      try {
        const targetLearnerResult = targetLearnerRun
          ? await generateTargetLearnerWithAi(draftWithRunningRuns)
          : null;
        const targetLearner = targetLearnerResult?.value ?? draft.targetLearner;
        const chapterResult = await generateChaptersWithAi(
          { ...draftWithRunningRuns, targetLearner },
          targetLearner,
        );
        const appliedRuns = [
          ...draftWithRunningRuns.aiRuns.filter(
            (run) => run.id !== chapterRun.id && run.id !== targetLearnerRun?.id,
          ),
          ...(targetLearnerRun && targetLearnerResult
            ? [
                appliedAiRun(
                  targetLearnerRun,
                  targetLearnerResult.text,
                  targetLearnerResult.model,
                  targetLearnerResult.provider,
                ),
              ]
            : []),
          reviewableAiRun(
            chapterRun,
            chapterResult.text,
            chapterResult.model,
            chapterResult.provider,
          ),
        ];
        const nextDraft: CourseDraft = {
          ...draftWithRunningRuns,
          aiRuns: appliedRuns,
          chapters: mergeGeneratedChapters(
            draftWithRunningRuns.chapters,
            chapterResult.value,
            draftWithRunningRuns.topics,
            targetLearner,
          ),
          step: 'chapters',
          targetLearner,
        };
        return {
          ...(await snapshotFor(ownerId)),
          draft: await saveDraft({
            ...nextDraft,
            findings: buildFindings({ ...nextDraft, findings: [] }),
          }),
        };
      } catch (error) {
        return {
          ...(await snapshotFor(ownerId)),
          draft: await saveDraft(
            failedAiRun(
              {
                ...draftWithRunningRuns,
                aiRuns: targetLearnerRun
                  ? [
                      ...draftWithRunningRuns.aiRuns.filter(
                        (run) => run.id !== targetLearnerRun.id,
                      ),
                      {
                        ...targetLearnerRun,
                        status: 'cancelled',
                        updatedAt: now(),
                      },
                    ]
                  : draftWithRunningRuns.aiRuns,
              },
              chapterRun,
              error,
            ),
          ),
        };
      }
    }
    case 'generateLessons': {
      const aiRun = createAiRun(draft, 'lesson_generation');
      const draftWithRunningRun = await saveDraft({ ...draft, aiRuns: [...draft.aiRuns, aiRun] });
      const lessonGate = getWorkflowPrerequisiteGate(draft, 'lessons');
      if (!lessonGate.allowed) {
        return {
          ...(await snapshotFor(ownerId)),
          draft: await saveDraft(
            failedAiRun(draftWithRunningRun, aiRun, new Error(gateFailureReason(lessonGate))),
          ),
        };
      }
      try {
        const allLessonsHaveManualEdits = draftWithRunningRun.chapters.every((chapter) =>
          chapter.lessons.some((lesson) =>
            lesson.blocks.some((block) => block.provenance === 'manual'),
          ),
        );
        if (allLessonsHaveManualEdits) {
          const nextDraft = {
            ...draftWithRunningRun,
            aiRuns: [
              ...draftWithRunningRun.aiRuns.filter((run) => run.id !== aiRun.id),
              {
                ...aiRun,
                failureReason: 'Lesson regeneration skipped to preserve manual edits.',
                status: 'cancelled' as const,
                updatedAt: now(),
              },
            ],
            findings: buildFindings(draftWithRunningRun),
            step: 'builder' as const,
          };
          return { ...(await snapshotFor(ownerId)), draft: await saveDraft(nextDraft) };
        }
        const result = await generateLessonsWithAi(draftWithRunningRun);
        const chapters = mergeGeneratedLessons(draftWithRunningRun.chapters, result.value);
        const nextDraft = {
          ...draftWithRunningRun,
          aiRuns: [
            ...draftWithRunningRun.aiRuns.filter((run) => run.id !== aiRun.id),
            appliedAiRun(aiRun, result.text, result.model, result.provider),
          ],
          chapters,
          findings: buildFindings({ ...draftWithRunningRun, chapters }),
          step: 'builder' as const,
        };
        return { ...(await snapshotFor(ownerId)), draft: await saveDraft(nextDraft) };
      } catch (error) {
        return {
          ...(await snapshotFor(ownerId)),
          draft: await saveDraft(failedAiRun(draftWithRunningRun, aiRun, error)),
        };
      }
    }
    case 'generateChapterLessons': {
      const chapter = draft.chapters.find((candidate) => candidate.id === action.chapterId);
      if (!chapter) {
        throw new Error('Chapter not found for signed-in creator.');
      }
      const aiRun = createAiRun(draft, 'lesson_generation');
      const draftWithRunningRun = await saveDraft({ ...draft, aiRuns: [...draft.aiRuns, aiRun] });
      const lessonGate = getWorkflowPrerequisiteGate(draft, 'lessons');
      if (!lessonGate.allowed) {
        return {
          ...(await snapshotFor(ownerId)),
          draft: await saveDraft(
            failedAiRun(draftWithRunningRun, aiRun, new Error(gateFailureReason(lessonGate))),
          ),
        };
      }
      if (chapter.status !== 'confirmed') {
        return {
          ...(await snapshotFor(ownerId)),
          draft: await saveDraft(
            failedAiRun(
              draftWithRunningRun,
              aiRun,
              new Error('Confirm chapter structure before generating lessons.'),
            ),
          ),
        };
      }
      try {
        if (chapterHasManualLessonEdits(chapter)) {
          const nextDraft = {
            ...draftWithRunningRun,
            aiRuns: [
              ...draftWithRunningRun.aiRuns.filter((run) => run.id !== aiRun.id),
              {
                ...aiRun,
                failureReason: 'Chapter lesson regeneration skipped to preserve manual edits.',
                status: 'cancelled' as const,
                updatedAt: now(),
              },
            ],
            findings: buildFindings(draftWithRunningRun),
            step: 'builder' as const,
          };
          return { ...(await snapshotFor(ownerId)), draft: await saveDraft(nextDraft) };
        }
        const scopedDraft = { ...draftWithRunningRun, chapters: [chapter] };
        const result = await generateLessonsWithAi(scopedDraft);
        const [generatedChapter] = mergeGeneratedLessons([chapter], result.value);
        const chapters = draftWithRunningRun.chapters.map((candidate) =>
          candidate.id === action.chapterId ? (generatedChapter ?? candidate) : candidate,
        );
        const nextDraft = {
          ...draftWithRunningRun,
          aiRuns: [
            ...draftWithRunningRun.aiRuns.filter((run) => run.id !== aiRun.id),
            appliedAiRun(aiRun, result.text, result.model, result.provider),
          ],
          chapters,
          findings: buildFindings({ ...draftWithRunningRun, chapters }),
          step: 'builder' as const,
        };
        return { ...(await snapshotFor(ownerId)), draft: await saveDraft(nextDraft) };
      } catch (error) {
        return {
          ...(await snapshotFor(ownerId)),
          draft: await saveDraft(failedAiRun(draftWithRunningRun, aiRun, error)),
        };
      }
    }
    case 'regenerateLesson': {
      assertWorkflowGate(getWorkflowPrerequisiteGate(draft, 'builder'));
      const chapter = draft.chapters.find((candidate) =>
        candidate.lessons.some((lesson) => lesson.id === action.lessonId),
      );
      const lesson = chapter?.lessons.find((candidate) => candidate.id === action.lessonId);
      if (!chapter || !lesson) {
        throw new Error('Lesson not found for signed-in creator.');
      }
      const aiRun = createAiRun(draft, 'lesson_generation');
      const draftWithRunningRun = await saveDraft({ ...draft, aiRuns: [...draft.aiRuns, aiRun] });
      try {
        if (lessonHasManualEdits(lesson)) {
          const nextDraft = {
            ...draftWithRunningRun,
            aiRuns: [
              ...draftWithRunningRun.aiRuns.filter((run) => run.id !== aiRun.id),
              {
                ...aiRun,
                failureReason: 'Lesson regeneration skipped to preserve manual edits.',
                status: 'cancelled' as const,
                updatedAt: now(),
              },
            ],
            findings: buildFindings(draftWithRunningRun),
            step: 'builder' as const,
          };
          return { ...(await snapshotFor(ownerId)), draft: await saveDraft(nextDraft) };
        }
        const scopedDraft = { ...draftWithRunningRun, chapters: [chapter] };
        const result = await generateLessonsWithAi(scopedDraft);
        const [generatedChapter] = mergeGeneratedLessons([chapter], result.value);
        const generatedLesson = generatedChapter?.lessons[0];
        if (!generatedLesson) {
          throw new Error('AI did not return a replacement lesson.');
        }
        const chapters = draftWithRunningRun.chapters.map((candidate) =>
          candidate.id === chapter.id
            ? {
                ...candidate,
                lessons: candidate.lessons.map((candidateLesson) =>
                  candidateLesson.id === action.lessonId
                    ? { ...generatedLesson, id: candidateLesson.id }
                    : candidateLesson,
                ),
              }
            : candidate,
        );
        const nextDraft = {
          ...draftWithRunningRun,
          aiRuns: [
            ...draftWithRunningRun.aiRuns.filter((run) => run.id !== aiRun.id),
            appliedAiRun(aiRun, result.text, result.model, result.provider),
          ],
          chapters,
          findings: buildFindings({ ...draftWithRunningRun, chapters }),
          step: 'builder' as const,
        };
        return { ...(await snapshotFor(ownerId)), draft: await saveDraft(nextDraft) };
      } catch (error) {
        return {
          ...(await snapshotFor(ownerId)),
          draft: await saveDraft(failedAiRun(draftWithRunningRun, aiRun, error)),
        };
      }
    }
    case 'addLesson': {
      if (action.title.trim().length === 0) {
        throw new Error('Lesson title is required.');
      }
      if (!draft.chapters.some((chapter) => chapter.id === action.chapterId)) {
        throw new Error('Chapter not found for signed-in creator.');
      }
      return {
        ...(await snapshotFor(ownerId)),
        draft: await saveDraft({
          ...draft,
          chapters: draft.chapters.map((chapter) =>
            chapter.id === action.chapterId
              ? {
                  ...chapter,
                  lessons: [...chapter.lessons, createManualLesson(chapter.id, action.title)],
                  plannedLessonCount: Math.max(
                    chapter.plannedLessonCount,
                    chapter.lessons.length + 1,
                  ),
                }
              : chapter,
          ),
          step: 'builder',
        }),
      };
    }
    case 'updateLesson': {
      return {
        ...(await snapshotFor(ownerId)),
        draft: await saveDraft({
          ...draft,
          chapters: draft.chapters.map((chapter) => ({
            ...chapter,
            lessons: chapter.lessons.map((lesson) =>
              lesson.id === action.lessonId
                ? {
                    ...lesson,
                    durationMinutes: Math.max(1, action.durationMinutes),
                    title: action.title.trim() || lesson.title,
                  }
                : lesson,
            ),
          })),
          step: 'builder',
        }),
      };
    }
    case 'deleteLesson': {
      return {
        ...(await snapshotFor(ownerId)),
        draft: await saveDraft({
          ...draft,
          chapters: draft.chapters.map((chapter) => ({
            ...chapter,
            lessons: chapter.lessons.filter((lesson) => lesson.id !== action.lessonId),
          })),
          step: 'builder',
        }),
      };
    }
    case 'moveLesson': {
      return {
        ...(await snapshotFor(ownerId)),
        draft: await saveDraft({
          ...draft,
          chapters: draft.chapters.map((chapter) => ({
            ...chapter,
            lessons: moveById(chapter.lessons, action.lessonId, action.direction),
          })),
          step: 'builder',
        }),
      };
    }
    case 'addBlock': {
      if (action.title.trim().length === 0 || action.body.trim().length === 0) {
        throw new Error('Block title and body are required.');
      }
      if (
        !draft.chapters.some((chapter) =>
          chapter.lessons.some((lesson) => lesson.id === action.lessonId),
        )
      ) {
        throw new Error('Lesson not found for signed-in creator.');
      }
      return {
        ...(await snapshotFor(ownerId)),
        draft: await saveDraft({
          ...draft,
          chapters: draft.chapters.map((chapter) => ({
            ...chapter,
            lessons: chapter.lessons.map((lesson) =>
              lesson.id === action.lessonId
                ? {
                    ...lesson,
                    blocks: [
                      ...lesson.blocks,
                      createManualBlock(
                        action.lessonId,
                        action.blockType,
                        action.title,
                        action.body,
                      ),
                    ],
                  }
                : lesson,
            ),
          })),
          step: 'builder',
        }),
      };
    }
    case 'updateBlock': {
      return {
        ...(await snapshotFor(ownerId)),
        draft: await saveDraft({
          ...draft,
          chapters: draft.chapters.map((chapter) => ({
            ...chapter,
            lessons: chapter.lessons.map((lesson) => ({
              ...lesson,
              blocks: lesson.blocks.map((block) =>
                block.id === action.blockId
                  ? {
                      ...block,
                      body: action.body,
                      provenance: 'manual',
                      sourceReferences: [],
                      title: action.title,
                    }
                  : block,
              ),
            })),
          })),
          step: 'builder',
        }),
      };
    }
    case 'deleteBlock': {
      return {
        ...(await snapshotFor(ownerId)),
        draft: await saveDraft({
          ...draft,
          chapters: draft.chapters.map((chapter) => ({
            ...chapter,
            lessons: chapter.lessons.map((lesson) => ({
              ...lesson,
              blocks: lesson.blocks.filter((block) => block.id !== action.blockId),
            })),
          })),
          step: 'builder',
        }),
      };
    }
    case 'moveBlock': {
      return {
        ...(await snapshotFor(ownerId)),
        draft: await saveDraft({
          ...draft,
          chapters: draft.chapters.map((chapter) => ({
            ...chapter,
            lessons: chapter.lessons.map((lesson) => ({
              ...lesson,
              blocks: moveById(lesson.blocks, action.blockId, action.direction),
            })),
          })),
          step: 'builder',
        }),
      };
    }
    case 'setFindingStatus': {
      const currentFindings = buildFindings(draft);
      return {
        ...(await snapshotFor(ownerId)),
        draft: await saveDraft({
          ...draft,
          findings: updateFindingStatus(currentFindings, action.findingId, action.status),
        }),
      };
    }
    case 'openPreview': {
      const previewDraft = { ...draft, findings: buildFindings(draft) };
      if (!getWorkflowPreviewGate(previewDraft).allowed) {
        return {
          ...(await snapshotFor(ownerId)),
          draft: await saveDraft({
            ...previewDraft,
            step: draft.step === 'preview' ? 'builder' : draft.step,
          }),
        };
      }
      return {
        ...(await snapshotFor(ownerId)),
        draft: await saveDraft({
          ...previewDraft,
          step: 'preview',
        }),
      };
    }
    default: {
      return snapshotFor(ownerId);
    }
  }
};
