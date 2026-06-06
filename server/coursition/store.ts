import * as NodeCrypto from '@effect/platform-node/NodeCrypto';
import { Crypto, DateTime, Effect } from 'effect';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import {
  buildFindings,
  emptyCourseContent,
  emptyLearningBlueprint,
  getWorkflowPreviewGate,
  getWorkflowStepGate,
  hasUsableSourceMaterial,
  staleCourseContent,
  staleLearningBlueprint,
} from '../../shared/coursition/workflow.ts';
import type {
  ActivityBrief,
  ActivityType,
  AiRun,
  AiRunType,
  ContentBlockType,
  CourseContent,
  CourseContentBlock,
  CoursePreparation,
  CourseDraft,
  CourseDraftSummary,
  CourseSection,
  DerivedSourceDocument,
  GeneratedActivity,
  KnowledgeChunk,
  LearningBlueprint,
  LearningObjective,
  SourceConfidence,
  SourceAsset,
  SourceSupport,
  WorkflowAction,
  WorkflowSnapshot,
} from '../../shared/coursition/workflow.ts';
import {
  generateCourseContentWithAi,
  generateLearningBlueprintWithAi,
  isAiProviderConfigured,
} from './ai-provider.ts';
import { loadCoursitionSourceProviderConfig } from './config.ts';

interface StoreFile {
  drafts: CourseDraft[];
}

const dataDirectory = '.coursition-data';
const dataPath = `${dataDirectory}/workflow.json`;
let storeMutationQueue: Promise<void> = Promise.resolve();
const completeStoreMutation = () => Promise.resolve();

const now = () => DateTime.formatIso(DateTime.nowUnsafe());
const cryptoRuntime = ManagedRuntime.make(NodeCrypto.layer);
const randomUuidV4 = () =>
  cryptoRuntime.runSync(
    Effect.gen(function* randomUuidV4Program() {
      const crypto = yield* Crypto.Crypto;
      return yield* crypto.randomUUIDv4;
    }),
  );
const createId = (prefix: string) => `${prefix}_${randomUuidV4()}`;
const nodeFs = () => import('node:fs/promises');
const sourceProviderConfig = () => loadCoursitionSourceProviderConfig();
const providerKeyConfigured = (value: string | undefined): value is string =>
  typeof value === 'string' && value.length > 0;
const sleep = (milliseconds: number) => Effect.runPromise(Effect.sleep(milliseconds));
const providerFetch = (url: string, init: RequestInit) =>
  Effect.runPromise(Effect.promise(() => globalThis['fetch'](url, init)));
/* eslint-disable promise/prefer-await-to-callbacks, promise/prefer-await-to-then */
const runPromiseGenerator = <Value>(
  operation: () => Generator<PromiseLike<unknown>, Value, unknown>,
): Promise<Value> => {
  const iterator = operation();
  const step = (result: IteratorResult<PromiseLike<unknown>, Value>): Promise<Value> => {
    if (result.done === true) {
      return Promise.resolve(result.value);
    }
    return Promise.resolve(result.value).then(
      (value) => step(iterator.next(value)),
      (error: unknown) => step(iterator.throw(error)),
    );
  };

  return Effect.runPromise(Effect.promise(() => step(iterator.next())));
};
/* eslint-enable promise/prefer-await-to-callbacks, promise/prefer-await-to-then */
const waitFor = function* waitFor<Value>(
  promise: PromiseLike<Value>,
): Generator<PromiseLike<unknown>, Value, unknown> {
  return (yield promise) as Value;
};
const fileExtension = (name: string) => {
  const basename = name.split(/[\\/]/u).at(-1) ?? name;
  const index = basename.lastIndexOf('.');
  return index > 0 ? basename.slice(index).toLowerCase() : '';
};
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

const readStore = (): Promise<StoreFile> =>
  runPromiseGenerator(function* storeProgram() {
    try {
      const fs = yield* waitFor(nodeFs());
      const content = yield* waitFor(fs.readFile(dataPath, 'utf-8'));
      return JSON.parse(content) as StoreFile;
    } catch {
      return { drafts: [] };
    }
  });

const writeStore = (store: StoreFile) =>
  runPromiseGenerator(function* storeProgram() {
    const fs = yield* waitFor(nodeFs());
    yield* waitFor(fs.mkdir(dataDirectory, { recursive: true }));
    const temporaryPath = `${dataPath}.${randomUuidV4()}.tmp`;
    yield* waitFor(fs.writeFile(temporaryPath, JSON.stringify(store, null, 2)));
    yield* waitFor(fs.rename(temporaryPath, dataPath));
  });

const activityTypes = new Set<ActivityType>([
  'retrieval_check',
  'practice_task',
  'scenario_decision',
  'ordering_matching',
  'rubric_answer',
]);
const generatedActivityTypes = new Set<GeneratedActivity['type']>([
  'retrieval_check',
  'practice_task',
  'scenario_decision',
  'ordering_matching',
  'rubric_answer',
  'not_playable',
]);
const contentBlockTypes = new Set<ContentBlockType>([
  'objective',
  'source_explanation',
  'worked_example',
  'interactive_activity',
  'reflection',
  'summary',
]);
const sourceSupports = new Set(['source_backed', 'partially_source_backed', 'inferred'] as const);
const sourceConfidences = new Set(['high', 'medium', 'low', 'none'] as const);
const generatedStatuses = new Set(['empty', 'generated', 'edited', 'stale'] as const);

const sourceSupportFor = (value: unknown): SourceSupport =>
  sourceSupports.has(value as SourceSupport) ? (value as SourceSupport) : 'inferred';

const sourceConfidenceFor = (value: unknown): SourceConfidence =>
  sourceConfidences.has(value as SourceConfidence) ? (value as SourceConfidence) : 'none';

const generatedStatusFor = (value: unknown) =>
  generatedStatuses.has(value as LearningObjective['status'])
    ? (value as LearningObjective['status'])
    : 'empty';

const activityTypeFor = (value: unknown): ActivityType =>
  activityTypes.has(value as ActivityType) ? (value as ActivityType) : 'retrieval_check';

const contentBlockTypeFor = (value: unknown): ContentBlockType =>
  contentBlockTypes.has(value as ContentBlockType)
    ? (value as ContentBlockType)
    : 'source_explanation';

const stringFor = (value: unknown, fallback = '') => (typeof value === 'string' ? value : fallback);

const stringArrayFor = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const recordFor = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const nonEmptyStringFor = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

const booleanFor = (value: unknown): value is boolean => typeof value === 'boolean';

const numberFor = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const validStringArrayFor = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(nonEmptyStringFor);

const hasValidGeneratedActivityBase = (activity: Record<string, unknown>) =>
  nonEmptyStringFor(activity['id']) &&
  nonEmptyStringFor(activity['briefId']) &&
  validStringArrayFor(activity['objectiveIds']) &&
  sourceConfidences.has(activity['sourceConfidence'] as SourceConfidence) &&
  generatedStatuses.has(activity['status'] as LearningObjective['status']);

const isValidRetrievalChoice = (value: unknown) => {
  const choice = recordFor(value);
  return (
    choice !== null &&
    nonEmptyStringFor(choice['id']) &&
    nonEmptyStringFor(choice['text']) &&
    booleanFor(choice['isCorrect']) &&
    nonEmptyStringFor(choice['feedback'])
  );
};

const isValidScenarioChoice = (value: unknown) => {
  const choice = recordFor(value);
  return (
    choice !== null &&
    nonEmptyStringFor(choice['id']) &&
    nonEmptyStringFor(choice['text']) &&
    booleanFor(choice['isPreferred']) &&
    nonEmptyStringFor(choice['consequence']) &&
    nonEmptyStringFor(choice['feedback'])
  );
};

const isValidOrderingMatchingItem = (value: unknown) => {
  const item = recordFor(value);
  return (
    item !== null &&
    nonEmptyStringFor(item['id']) &&
    nonEmptyStringFor(item['text']) &&
    (item['correctPosition'] === undefined || numberFor(item['correctPosition'])) &&
    (item['matchLabel'] === undefined || nonEmptyStringFor(item['matchLabel']))
  );
};

const isValidRetrievalInteraction = (interaction: Record<string, unknown>) =>
  nonEmptyStringFor(interaction['question']) &&
  Array.isArray(interaction['choices']) &&
  interaction['choices'].length > 0 &&
  interaction['choices'].every(isValidRetrievalChoice) &&
  nonEmptyStringFor(interaction['explanationPrompt']) &&
  nonEmptyStringFor(interaction['feedback']);

const isValidPracticeInteraction = (interaction: Record<string, unknown>) =>
  nonEmptyStringFor(interaction['prompt']) &&
  nonEmptyStringFor(interaction['submissionLabel']) &&
  validStringArrayFor(interaction['checklist']) &&
  interaction['checklist'].length > 0 &&
  nonEmptyStringFor(interaction['feedback']);

const isValidScenarioInteraction = (interaction: Record<string, unknown>) =>
  nonEmptyStringFor(interaction['scenario']) &&
  Array.isArray(interaction['choices']) &&
  interaction['choices'].length > 0 &&
  interaction['choices'].every(isValidScenarioChoice) &&
  nonEmptyStringFor(interaction['justificationPrompt']) &&
  nonEmptyStringFor(interaction['feedback']);

const isValidOrderingMatchingInteraction = (interaction: Record<string, unknown>) =>
  (interaction['mode'] === 'matching' || interaction['mode'] === 'ordering') &&
  nonEmptyStringFor(interaction['prompt']) &&
  Array.isArray(interaction['items']) &&
  interaction['items'].length > 0 &&
  interaction['items'].every(isValidOrderingMatchingItem) &&
  nonEmptyStringFor(interaction['feedback']);

const isValidRubricInteraction = (interaction: Record<string, unknown>) =>
  nonEmptyStringFor(interaction['prompt']) &&
  validStringArrayFor(interaction['criteria']) &&
  interaction['criteria'].length > 0 &&
  nonEmptyStringFor(interaction['feedback']);

const isValidNotPlayableInteraction = (interaction: Record<string, unknown>) =>
  nonEmptyStringFor(interaction['prompt']) &&
  nonEmptyStringFor(interaction['reason']) &&
  nonEmptyStringFor(interaction['feedback']);

const isValidGeneratedInteraction = (
  type: GeneratedActivity['type'],
  interactionValue: unknown,
) => {
  const interaction = recordFor(interactionValue);
  if (interaction === null || interaction['kind'] !== type) {
    return false;
  }
  switch (type) {
    case 'retrieval_check': {
      return isValidRetrievalInteraction(interaction);
    }
    case 'practice_task': {
      return isValidPracticeInteraction(interaction);
    }
    case 'scenario_decision': {
      return isValidScenarioInteraction(interaction);
    }
    case 'ordering_matching': {
      return isValidOrderingMatchingInteraction(interaction);
    }
    case 'rubric_answer': {
      return isValidRubricInteraction(interaction);
    }
    case 'not_playable': {
      return isValidNotPlayableInteraction(interaction);
    }
    default: {
      const unsupportedType: never = type;
      return unsupportedType;
    }
  }
};

const generatedActivityFor = (value: unknown): GeneratedActivity | null => {
  const activity = recordFor(value);
  if (
    activity === null ||
    !generatedActivityTypes.has(activity['type'] as GeneratedActivity['type'])
  ) {
    return null;
  }
  const type = activity['type'] as GeneratedActivity['type'];
  return hasValidGeneratedActivityBase(activity) &&
    isValidGeneratedInteraction(type, activity['interaction'])
    ? (activity as unknown as GeneratedActivity)
    : null;
};

const generatedActivitiesFor = (value: unknown) =>
  Array.isArray(value)
    ? value.flatMap((activity) => {
        const generatedActivity = generatedActivityFor(activity);
        return generatedActivity === null ? [] : [generatedActivity];
      })
    : [];

const sourceReferencesFor = (value: unknown): NonNullable<LearningObjective['sourceReferences']> =>
  Array.isArray(value)
    ? value
        .filter(
          (reference): reference is NonNullable<LearningObjective['sourceReferences']>[number] =>
            Boolean(
              reference &&
              typeof reference === 'object' &&
              typeof (reference as { sourceAssetId?: unknown }).sourceAssetId === 'string' &&
              typeof (reference as { position?: unknown }).position === 'string',
            ),
        )
        .map((reference) => ({
          ...reference,
          heading: stringFor(reference.heading),
        }))
    : [];

const coursePreparationField = (
  preparation: Partial<CoursePreparation> | undefined,
  field: keyof Pick<
    CoursePreparation,
    | 'activityMixPreference'
    | 'audience'
    | 'constraints'
    | 'depth'
    | 'desiredOutcome'
    | 'priorKnowledge'
    | 'tone'
  >,
  fallback = '',
) => stringFor(preparation?.[field], fallback);

const coursePreparationStrictness = (
  preparation: Partial<CoursePreparation> | undefined,
): CoursePreparation['sourceStrictness'] => {
  if (preparation?.sourceStrictness === 'strict') {
    return 'strict';
  }
  return 'standard';
};

const isCourseLanguage = (value: unknown): value is CoursePreparation['language'] =>
  value === 'en' || value === 'cs';

const coursePreparationLanguagePreference = (
  preparation: Partial<CoursePreparation> | undefined,
): CoursePreparation['languagePreference'] => {
  const preference = (preparation as Partial<CoursePreparation> | undefined)?.languagePreference;
  if (preference === 'source' || isCourseLanguage(preference)) {
    return preference;
  }
  return 'source';
};

const czechSignalPattern = /[áčďéěíňóřšťúůýž]/giu;
const czechWordPattern =
  /\b(a|aby|ale|bez|bude|by|byl|byla|co|do|jak|jako|je|jsou|když|kter[ýáé]|má|na|nebo|od|po|podle|pro|při|se|si|tak|tento|to|ve|v|že)\b/giu;
const englishWordPattern =
  /\b(and|apply|are|as|can|course|for|from|how|in|is|learn|learners|of|practice|source|the|they|this|to|with|you)\b/giu;

const matchCount = (value: string, pattern: RegExp) => [...value.matchAll(pattern)].length;

const inferLanguageFromText = (value: string): CoursePreparation['language'] | null => {
  const sample = value.slice(0, 30_000);
  if (sample.trim().length === 0) {
    return null;
  }
  const czechScore =
    matchCount(sample, czechSignalPattern) * 3 + matchCount(sample, czechWordPattern);
  const englishScore = matchCount(sample, englishWordPattern);
  if (czechScore >= 3 && czechScore >= englishScore) {
    return 'cs';
  }
  if (englishScore >= 5 && englishScore > czechScore * 1.4) {
    return 'en';
  }
  return null;
};

const inferCourseSourceLanguage = (draft: CourseDraft): CoursePreparation['language'] | null =>
  inferLanguageFromText(
    [
      draft.sources
        .filter((source) => source.status !== 'deleted')
        .map((source) => `${source.name}\n${source.content}`)
        .join('\n\n'),
      draft.derivedSourceDocuments.map((document) => document.content).join('\n\n'),
      draft.knowledgeChunks.map((chunk) => chunk.content).join('\n\n'),
    ].join('\n\n'),
  );

const coursePreparationLanguage = (
  draft: CourseDraft,
  preparation: Partial<CoursePreparation> | undefined,
): CoursePreparation['language'] => {
  const preference = coursePreparationLanguagePreference(preparation);
  if (isCourseLanguage(preference)) {
    return preference;
  }
  return (
    inferCourseSourceLanguage(draft) ??
    (isCourseLanguage(preparation?.language) ? preparation.language : draft.language)
  );
};

const normalizeCoursePreparation = (
  draft: CourseDraft,
  preparation: Partial<CoursePreparation> | undefined,
): CoursePreparation => ({
  activityMixPreference: coursePreparationField(preparation, 'activityMixPreference'),
  audience: coursePreparationField(preparation, 'audience'),
  constraints: coursePreparationField(preparation, 'constraints'),
  depth: coursePreparationField(preparation, 'depth', 'practical'),
  desiredOutcome: coursePreparationField(preparation, 'desiredOutcome'),
  language: coursePreparationLanguage(draft, preparation),
  languagePreference: coursePreparationLanguagePreference(preparation),
  priorKnowledge: coursePreparationField(preparation, 'priorKnowledge'),
  sourceStrictness: coursePreparationStrictness(preparation),
  tone: coursePreparationField(preparation, 'tone'),
});

const normalizeLearningObjective = (
  draft: CourseDraft,
  objective: Partial<LearningObjective>,
  index: number,
): LearningObjective => ({
  capability: stringFor(objective.capability, stringFor(objective.title, draft.title)),
  id: stringFor(objective.id, `objective_${draft.id}_${index + 1}`),
  sourceConfidence: sourceConfidenceFor(objective.sourceConfidence),
  sourceReferences: sourceReferencesFor(objective.sourceReferences),
  sourceSupport: sourceSupportFor(objective.sourceSupport),
  status: generatedStatusFor(objective.status),
  title: stringFor(objective.title, `Objective ${index + 1}`),
  topicName: stringFor(objective.topicName, stringFor(objective.title, draft.title)),
  updatedAt: stringFor(objective.updatedAt, draft.updatedAt),
});

const normalizeActivityBrief = (
  draft: CourseDraft,
  brief: Partial<ActivityBrief>,
  objectives: readonly LearningObjective[],
  index: number,
): ActivityBrief => {
  const objectiveId = stringFor(
    brief.objectiveId,
    objectives[index]?.id ?? objectives[0]?.id ?? '',
  );
  const objectiveIds =
    Array.isArray(brief.objectiveIds) && brief.objectiveIds.length > 0
      ? brief.objectiveIds.filter((id): id is string => typeof id === 'string')
      : [objectiveId].filter(Boolean);
  return {
    feedbackGuidance: stringFor(brief.feedbackGuidance),
    id: stringFor(brief.id, `activity_brief_${draft.id}_${index + 1}`),
    instructions: stringFor(brief.instructions, stringFor(brief.learnerAction)),
    learnerAction: stringFor(brief.learnerAction),
    objectiveId,
    objectiveIds,
    sourceConfidence: sourceConfidenceFor(brief.sourceConfidence),
    sourceReferences: sourceReferencesFor(brief.sourceReferences),
    status: generatedStatusFor(brief.status),
    successCriteria: stringFor(brief.successCriteria),
    title: stringFor(brief.title, `Activity ${index + 1}`),
    type: activityTypeFor(brief.type),
    updatedAt: stringFor(brief.updatedAt, draft.updatedAt),
  };
};

const normalizeLearningBlueprint = (draft: CourseDraft): LearningBlueprint => {
  const fallback = emptyLearningBlueprint(draft.language);
  const candidate = (draft as CourseDraft & { learningBlueprint?: Partial<LearningBlueprint> })
    .learningBlueprint;
  const coursePreparation = candidate?.coursePreparation;
  const createdAt = stringFor(candidate?.createdAt, draft.createdAt);
  const updatedAt = stringFor(candidate?.updatedAt, draft.updatedAt);
  const objectives = Array.isArray(candidate?.objectives)
    ? candidate.objectives.map((objective, index) =>
        normalizeLearningObjective(draft, objective, index),
      )
    : fallback.objectives;
  const activityBriefs = Array.isArray(candidate?.activityBriefs)
    ? candidate.activityBriefs.map((brief, index) =>
        normalizeActivityBrief(draft, brief, objectives, index),
      )
    : fallback.activityBriefs;
  return {
    activityBriefs,
    assumptions: stringArrayFor(candidate?.assumptions),
    coursePreparation: normalizeCoursePreparation(draft, coursePreparation),
    createdAt,
    generatedActivities: generatedActivitiesFor(candidate?.generatedActivities),
    objectives,
    sourceCoverage: sourceSupportFor(candidate?.sourceCoverage),
    updatedAt,
  };
};

const staleStatusFor = (status: LearningObjective['status']): LearningObjective['status'] =>
  status === 'empty' ? 'empty' : 'stale';

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

const normalizeCourseContentBlock = (
  block: Partial<CourseContentBlock>,
  fallbackId: string,
): CourseContentBlock => ({
  body: stringFor(block.body),
  id: stringFor(block.id, fallbackId),
  objectiveIds: stringArrayFor(block.objectiveIds),
  sourceConfidence: sourceConfidenceFor(block.sourceConfidence),
  sourceReferences: sourceReferencesFor(block.sourceReferences),
  status: generatedStatusFor(block.status),
  title: stringFor(block.title, 'Course content'),
  type: contentBlockTypeFor(block.type),
  ...(typeof block.activityId === 'string' && block.activityId.length > 0
    ? { activityId: block.activityId }
    : {}),
});

const normalizeCourseSection = (
  section: Partial<CourseSection>,
  draft: CourseDraft,
  index: number,
): CourseSection => {
  const fallbackId = `section_${draft.id}_${index + 1}`;
  const rawBlocks = Array.isArray(section.blocks) ? section.blocks : [];
  return {
    blocks: rawBlocks.map((block, blockIndex) =>
      normalizeCourseContentBlock(block, `block_${fallbackId}_${blockIndex + 1}`),
    ),
    id: stringFor(section.id, fallbackId),
    objectiveIds: stringArrayFor(section.objectiveIds),
    sourceConfidence: sourceConfidenceFor(section.sourceConfidence),
    sourceReferences: sourceReferencesFor(section.sourceReferences),
    status: generatedStatusFor(section.status),
    summary: stringFor(section.summary),
    title: stringFor(section.title, `Section ${index + 1}`),
  };
};

const normalizeCourseContent = (draft: CourseDraft): CourseContent => {
  const fallback = emptyCourseContent();
  const candidate = (draft as CourseDraft & { courseContent?: Partial<CourseContent> })
    .courseContent;
  return {
    createdAt: stringFor(candidate?.createdAt, draft.createdAt),
    sections: Array.isArray(candidate?.sections)
      ? candidate.sections.map((section, index) => normalizeCourseSection(section, draft, index))
      : fallback.sections,
    status: generatedStatusFor(candidate?.status),
    updatedAt: stringFor(candidate?.updatedAt, draft.updatedAt),
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
    courseContent: normalizeCourseContent(draft),
    derivedSourceDocuments: Array.isArray(draft.derivedSourceDocuments)
      ? draft.derivedSourceDocuments
      : fallbackDocuments,
    findings: Array.isArray(draft.findings)
      ? draft.findings.map((finding) => ({
          ...finding,
          fingerprint: finding.fingerprint ?? finding.id,
          status: finding.status ?? 'open',
          step: finding.step ?? 'courseContent',
          targetId: finding.targetId ?? draft.id,
          targetType: finding.targetType ?? 'course',
        }))
      : [],
    knowledgeChunks: Array.isArray(draft.knowledgeChunks) ? draft.knowledgeChunks : fallbackChunks,
    learningBlueprint: normalizeLearningBlueprint(draft),
    mode: draft.mode === 'generate' ? 'generate' : 'assist',
    sourceProcessingIncomplete: draft.sources.some(
      (source) => source.status === 'queued' || source.status === 'processing',
    ),
  };
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
  withStoreMutation(() =>
    runPromiseGenerator(function* storeProgram() {
      const store = yield* waitFor(readStore());
      const nextDraft = normalizeDraft({ ...draft, updatedAt: now() });
      const draftIndex = store.drafts.findIndex((candidate) => candidate.id === draft.id);
      if (draftIndex === -1) {
        store.drafts.push(nextDraft);
      } else {
        store.drafts[draftIndex] = nextDraft;
      }
      yield* waitFor(writeStore(store));
      return nextDraft;
    }),
  );

const requireDraft = (ownerId: string, draftId: string) =>
  runPromiseGenerator(function* storeProgram() {
    const store = yield* waitFor(readStore());
    const draft = store.drafts.find(
      (candidate) => candidate.id === draftId && candidate.ownerId === ownerId,
    );
    if (draft === undefined) {
      throw new Error('Course draft not found for signed-in creator.');
    }
    return normalizeDraft(draft);
  });

const deleteDraft = (ownerId: string, draftId: string) =>
  withStoreMutation(() =>
    runPromiseGenerator(function* storeProgram() {
      const store = yield* waitFor(readStore());
      const draftIndex = store.drafts.findIndex(
        (candidate) => candidate.id === draftId && candidate.ownerId === ownerId,
      );
      if (draftIndex === -1) {
        throw new Error('Course draft not found for signed-in creator.');
      }
      store.drafts.splice(draftIndex, 1);
      yield* waitFor(writeStore(store));
    }),
  );

const latestDraft = (ownerId: string) =>
  runPromiseGenerator(function* storeProgram() {
    const store = yield* waitFor(readStore());
    const draft =
      store.drafts
        .filter((candidate) => candidate.ownerId === ownerId)
        .toSorted((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null;
    return draft === null ? null : normalizeDraft(draft);
  });

const draftSummaryFor = (draft: CourseDraft): CourseDraftSummary => ({
  activityCount: draft.learningBlueprint.generatedActivities.length,
  id: draft.id,
  language: draft.language,
  mode: draft.mode,
  objectiveCount: draft.learningBlueprint.objectives.length,
  sectionCount: draft.courseContent.sections.length,
  sourceCount: draft.sources.filter((source) => source.status !== 'deleted').length,
  step: draft.step,
  title: draft.title,
  updatedAt: draft.updatedAt,
});

const draftSummariesFor = (ownerId: string) =>
  runPromiseGenerator(function* storeProgram() {
    const store = yield* waitFor(readStore());
    return store.drafts
      .filter((candidate) => candidate.ownerId === ownerId)
      .map(normalizeDraft)
      .toSorted((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map(draftSummaryFor);
  });

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
  const extension = fileExtension(name);
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

const isReadableFileName = (name: string) => textLikeFileExtensions.has(fileExtension(name));

const dataUrlPrefix = /^data:([^;,]+)?(?:;[^,]*)?;base64,(.*)$/su;

const decodeDataUrl = (value: string): BinarySourcePayload | null => {
  const match = dataUrlPrefix.exec(value.trim());
  if (match === null) {
    return null;
  }
  const [, rawMimeType, data] = match;
  const mimeType =
    typeof rawMimeType === 'string' && rawMimeType.length > 0
      ? rawMimeType
      : 'application/octet-stream';
  if (typeof data !== 'string' || data.length === 0) {
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
  if (value === null || value === undefined || typeof value !== 'object') {
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
  if (!providerKeyConfigured(value)) {
    throw new Error(`${providerName} API key is not configured.`);
  }
  return value;
};

const isLlamaParseMarkdownTier = (value: string): value is LlamaParseMarkdownTier =>
  llamaParseMarkdownTiers.some((tier) => tier === value);

const llamaParseTierForMarkdown = (): LlamaParseMarkdownTier => {
  const tier = sourceProviderConfig().llamaParseTier;
  if (isLlamaParseMarkdownTier(tier)) {
    return tier;
  }
  throw new Error(
    `LLAMA_PARSE_TIER=${tier} cannot produce Markdown. Use cost_effective, agentic, or agentic_plus.`,
  );
};

const configuredWebExtractionProviderCount = () => {
  const config = sourceProviderConfig();
  return [config.firecrawlApiKey, config.tavilyApiKey, config.exaApiKey].filter(
    providerKeyConfigured,
  ).length;
};

const isWebExtractionConfigured = () => configuredWebExtractionProviderCount() > 0;

const providerBaseUrl = (value: string) => value.replace(/\/+$/u, '');

const fetchJson = (url: string, init: RequestInit) =>
  runPromiseGenerator(function* storeProgram() {
    const response = yield* waitFor(providerFetch(url, init));
    if (!response.ok) {
      const detail = yield* waitFor(response.text());
      throw new Error(detail || `Provider request failed with ${response.status}.`);
    }
    return (yield* waitFor(response.json())) as unknown;
  });

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
  if (nestedJob !== null && nestedJob !== undefined && typeof nestedJob === 'object') {
    return nestedJob as Record<string, unknown>;
  }
  return value;
};

const llamaParseJobContent = (jobId: string) =>
  runPromiseGenerator(function* storeProgram() {
    const config = sourceProviderConfig();
    let latestJob: Record<string, unknown> = {};
    for (let attempt = 0; attempt < 30; attempt += 1) {
      latestJob = (yield* waitFor(
        fetchJson(`${config.llamaCloudBaseUrl}/api/v2/parse/${jobId}?expand=markdown`, {
          headers: {
            Authorization: `Bearer ${requireProviderKey(config.llamaCloudApiKey, 'LlamaParse')}`,
          },
          method: 'GET',
        }),
      )) as Record<string, unknown>;
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
      yield* waitFor(sleep(2000));
    }
    throw new Error('LlamaParse processing did not finish before the local timeout.');
  });

const createLlamaParseJob = (body: Record<string, unknown>) =>
  runPromiseGenerator(function* storeProgram() {
    const config = sourceProviderConfig();
    const apiKey = requireProviderKey(config.llamaCloudApiKey, 'LlamaParse');
    const parseJob = (yield* waitFor(
      fetchJson(`${config.llamaCloudBaseUrl}/api/v2/parse`, {
        body: JSON.stringify(body),
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        method: 'POST',
      }),
    )) as Record<string, unknown>;
    const jobId = typeof parseJob['id'] === 'string' ? parseJob['id'] : '';
    if (jobId.length === 0) {
      throw new Error('LlamaParse did not return a parse job id.');
    }
    return jobId;
  });

const parseLlamaDocument = (
  sourceName: string,
  binary: BinarySourcePayload,
): Promise<ProviderProcessingResult> =>
  runPromiseGenerator(function* storeProgram() {
    const config = sourceProviderConfig();
    const apiKey = requireProviderKey(config.llamaCloudApiKey, 'LlamaParse');
    const formData = new FormData();
    formData.append('purpose', 'parse');
    formData.append(
      'file',
      new Blob([arrayBufferFor(binary.bytes)], { type: binary.mimeType }),
      sourceName,
    );
    const uploaded = (yield* waitFor(
      fetchJson(`${config.llamaCloudBaseUrl}/api/v1/beta/files`, {
        body: formData,
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        method: 'POST',
      }),
    )) as Record<string, unknown>;
    const fileId = typeof uploaded['id'] === 'string' ? uploaded['id'] : '';
    if (fileId.length === 0) {
      throw new Error('LlamaParse did not return an uploaded file id.');
    }
    const jobId = yield* waitFor(
      createLlamaParseJob({
        file_id: fileId,
        tier: llamaParseTierForMarkdown(),
        version: config.llamaParseVersion,
      }),
    );
    return {
      content: yield* waitFor(llamaParseJobContent(jobId)),
      mimeType: binary.mimeType,
      providerJobId: jobId,
      storageReference: `llamacloud:${fileId}:${jobId}`,
    };
  });

const extractWithFirecrawl = (url: URL): Promise<WebExtractionResult> =>
  runPromiseGenerator(function* storeProgram() {
    const config = sourceProviderConfig();
    const providerName = 'Firecrawl';
    const response = (yield* waitFor(
      fetchJson(`${providerBaseUrl(config.firecrawlBaseUrl)}/v1/scrape`, {
        body: JSON.stringify({
          formats: ['markdown'],
          onlyMainContent: true,
          url: url.toString(),
        }),
        headers: {
          Authorization: `Bearer ${requireProviderKey(config.firecrawlApiKey, providerName)}`,
          'content-type': 'application/json',
        },
        method: 'POST',
      }),
    )) as Record<string, unknown>;
    return {
      content: providerContentFromJson(providerName, response),
      processor: 'firecrawl_url',
      providerName,
      storageReference: `firecrawl:${url.toString()}`,
    };
  });

const extractWithTavily = (url: URL): Promise<WebExtractionResult> =>
  runPromiseGenerator(function* storeProgram() {
    const config = sourceProviderConfig();
    const providerName = 'Tavily';
    const response = (yield* waitFor(
      fetchJson(`${providerBaseUrl(config.tavilyBaseUrl)}/extract`, {
        body: JSON.stringify({
          extract_depth: 'basic',
          format: 'markdown',
          urls: [url.toString()],
        }),
        headers: {
          Authorization: `Bearer ${requireProviderKey(config.tavilyApiKey, providerName)}`,
          'content-type': 'application/json',
        },
        method: 'POST',
      }),
    )) as Record<string, unknown>;
    return {
      content: providerContentFromJson(providerName, response),
      processor: 'tavily_url',
      providerName,
      storageReference: `tavily:${url.toString()}`,
    };
  });

const extractWithExa = (url: URL): Promise<WebExtractionResult> =>
  runPromiseGenerator(function* storeProgram() {
    const config = sourceProviderConfig();
    const providerName = 'Exa';
    const response = (yield* waitFor(
      fetchJson(`${providerBaseUrl(config.exaBaseUrl)}/contents`, {
        body: JSON.stringify({
          text: true,
          urls: [url.toString()],
        }),
        headers: {
          'content-type': 'application/json',
          'x-api-key': requireProviderKey(config.exaApiKey, providerName),
        },
        method: 'POST',
      }),
    )) as Record<string, unknown>;
    return {
      content: providerContentFromJson(providerName, response),
      processor: 'exa_url',
      providerName,
      storageReference: `exa:${url.toString()}`,
    };
  });

const extractWebUrl = (url: URL): Promise<WebExtractionResult> =>
  runPromiseGenerator(function* storeProgram() {
    const config = sourceProviderConfig();
    const providers: WebExtractionProvider[] = [
      { apiKey: config.firecrawlApiKey, extract: extractWithFirecrawl, name: 'Firecrawl' },
      { apiKey: config.tavilyApiKey, extract: extractWithTavily, name: 'Tavily' },
      { apiKey: config.exaApiKey, extract: extractWithExa, name: 'Exa' },
    ];
    const failures: string[] = [];
    for (const provider of providers) {
      if (!providerKeyConfigured(provider.apiKey)) {
        continue;
      }
      try {
        return yield* waitFor(provider.extract(url));
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
  });

const transcribeWithDeepgram = (
  sourceName: string,
  binary: BinarySourcePayload,
): Promise<ProviderProcessingResult> =>
  runPromiseGenerator(function* storeProgram() {
    const config = sourceProviderConfig();
    const apiKey = requireProviderKey(config.deepgramApiKey, 'Deepgram');
    const model = config.deepgramModel;
    const response = (yield* waitFor(
      fetchJson(
        `${config.deepgramBaseUrl}/v1/listen?model=${encodeURIComponent(model)}&smart_format=true&paragraphs=true&utterances=true&diarize_model=latest`,
        {
          body: arrayBufferFor(binary.bytes),
          headers: {
            Authorization: `Token ${apiKey}`,
            'content-type': binary.mimeType,
          },
          method: 'POST',
        },
      ),
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
      ...(typeof requestId === 'string' ? { providerJobId: requestId } : {}),
    };
  });

// eslint-disable-next-line complexity
const processSource = (
  draftId: string,
  source: Extract<WorkflowAction, { action: 'addSource' }>['source'],
): Promise<SourceAsset> =>
  // eslint-disable-next-line complexity
  runPromiseGenerator(function* storeProgram() {
    const createdAt = now();
    const trimmedContent = source.content.trim();
    const sourceType = source.type;
    const trimmedSourceName = source.name.trim();
    const sourceName = trimmedSourceName.length > 0 ? trimmedSourceName : source.type;
    if (sourceType === 'url') {
      const url = parseHttpUrl(trimmedContent);
      if (url !== null) {
        try {
          const providerResult = yield* waitFor(extractWebUrl(url));
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
            ...(typeof providerResult.providerJobId === 'string'
              ? { providerJobId: providerResult.providerJobId }
              : {}),
            ...(typeof providerResult.storageReference === 'string'
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
    const isProviderBackedFile =
      fileProcessor !== null &&
      fileProcessor !== 'local_text' &&
      fileProcessor !== 'unsupported_file' &&
      processorForFileName(sourceName, false) !== 'unsupported_file';
    if (sourceType === 'file' && isProviderBackedFile && fileProcessor !== null) {
      const binary = decodeDataUrl(trimmedContent);
      if (binary !== null) {
        try {
          const providerResult = fileProcessor.includes('deepgram')
            ? yield* waitFor(transcribeWithDeepgram(sourceName, binary))
            : yield* waitFor(parseLlamaDocument(sourceName, binary));
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
            ...(typeof providerResult.mimeType === 'string'
              ? { mimeType: providerResult.mimeType }
              : {}),
            ...(typeof providerResult.providerJobId === 'string'
              ? { providerJobId: providerResult.providerJobId }
              : {}),
            ...(typeof providerResult.storageReference === 'string'
              ? { storageReference: providerResult.storageReference }
              : {}),
            ...(providerResult.content.length === 0
              ? { failureReason: 'The provider did not return readable content.' }
              : {}),
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
  });

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
  model: sourceProviderConfig().aiModel ?? 'gpt-5.3-codex-spark',
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

const gateFailureReason = (gate: ReturnType<typeof getWorkflowStepGate>) => {
  if (gate.reason === 'blockingFinding') {
    return gate.finding?.title ?? 'Resolve blocking review findings before continuing.';
  }
  if (gate.reason === 'sourceRequired') {
    return 'Add source material before continuing.';
  }
  if (gate.reason === 'preparationRequired') {
    return 'Complete course preparation before continuing.';
  }
  if (gate.reason === 'objectivesRequired') {
    return 'Generate the objective map before continuing.';
  }
  if (gate.reason === 'activityPlanRequired') {
    return 'Generate the activity plan before continuing.';
  }
  if (gate.reason === 'courseContentRequired') {
    return 'Generate course content before opening preview.';
  }
  if (gate.reason === 'fullCourseGenerationRequired') {
    return 'Generate the course before reviewing generated steps.';
  }
  return 'Complete the required previous step before continuing.';
};

const assertWorkflowGate = (gate: ReturnType<typeof getWorkflowStepGate>) => {
  if (!gate.allowed) {
    throw new Error(gateFailureReason(gate));
  }
};

const draftForStep = (draft: CourseDraft, step: CourseDraft['step']): CourseDraft => ({
  ...draft,
  findings: buildFindings(draft),
  step,
});

export const snapshotFor = (ownerId: string): Promise<WorkflowSnapshot> =>
  runPromiseGenerator(function* storeProgram() {
    const config = sourceProviderConfig();
    return {
      config: {
        aiProviderConfigured: isAiProviderConfigured(),
        auth: 'better-auth',
        deepgramConfigured: providerKeyConfigured(config.deepgramApiKey),
        llamaParseConfigured: providerKeyConfigured(config.llamaCloudApiKey),
        storage: 'json-file',
        webExtractionConfigured: isWebExtractionConfigured(),
      },
      draft: yield* waitFor(latestDraft(ownerId)),
      drafts: yield* waitFor(draftSummariesFor(ownerId)),
    };
  });

export const snapshotForRoute = (
  ownerId: string,
  draftId: string,
  step: CourseDraft['step'],
): Promise<WorkflowSnapshot> =>
  runPromiseGenerator(function* storeProgram() {
    const draft = yield* waitFor(requireDraft(ownerId, draftId));
    const draftWithFindings = draftForStep(draft, draft.step);
    const routeDraft = draftForStep(draftWithFindings, step);
    const gate =
      step === 'preview'
        ? getWorkflowPreviewGate(routeDraft, { blockOpenFindings: draft.mode !== 'generate' })
        : getWorkflowStepGate(draftWithFindings, step);
    if (!gate.allowed) {
      const fallbackStep = gate.blockedStep ?? 'mode';
      return {
        ...(yield* waitFor(snapshotFor(ownerId))),
        draft: draftForStep(draft, fallbackStep),
      };
    }
    return {
      ...(yield* waitFor(snapshotFor(ownerId))),
      draft: routeDraft,
    };
  });

export const applyWorkflowAction = (
  ownerId: string,
  action: WorkflowAction,
): Promise<WorkflowSnapshot> =>
  // eslint-disable-next-line complexity
  runPromiseGenerator(function* storeProgram() {
    if (action.action === 'getState') {
      return yield* waitFor(snapshotFor(ownerId));
    }

    if (action.action === 'createDraft') {
      const title = action.title.trim();
      if (title.length === 0) {
        throw new Error('Course title is required.');
      }
      const createdAt = now();
      const draft = yield* waitFor(
        saveDraft({
          aiRuns: [],
          courseContent: emptyCourseContent(),
          createdAt,
          derivedSourceDocuments: [],
          findings: [],
          id: createId('course'),
          knowledgeChunks: [],
          language: action.language,
          learningBlueprint: emptyLearningBlueprint(action.language),
          mode: 'assist',
          ownerId,
          sourceProcessingIncomplete: false,
          sources: [],
          step: 'mode',
          title,
          updatedAt: createdAt,
        }),
      );
      return { ...(yield* waitFor(snapshotFor(ownerId))), draft };
    }

    if (action.action === 'selectDraft') {
      return {
        ...(yield* waitFor(snapshotFor(ownerId))),
        draft: yield* waitFor(requireDraft(ownerId, action.draftId)),
      };
    }

    if (action.action === 'deleteDraft') {
      yield* waitFor(deleteDraft(ownerId, action.draftId));
      return {
        ...(yield* waitFor(snapshotFor(ownerId))),
        draft: null,
      };
    }

    const draft = yield* waitFor(requireDraft(ownerId, action.draftId));

    switch (action.action) {
      case 'updateDraftTitle': {
        return {
          ...(yield* waitFor(snapshotFor(ownerId))),
          draft: yield* waitFor(
            saveDraft({
              ...draft,
              title: action.title.trim() || draft.title,
            }),
          ),
        };
      }
      case 'goToStep': {
        const draftWithFindings = draftForStep(draft, draft.step);
        assertWorkflowGate(getWorkflowStepGate(draftWithFindings, action.step));
        return {
          ...(yield* waitFor(snapshotFor(ownerId))),
          draft: yield* waitFor(saveDraft(draftForStep(draftWithFindings, action.step))),
        };
      }
      case 'setMode': {
        if (action.mode !== 'generate' && action.mode !== 'assist') {
          throw new Error('Unsupported course mode.');
        }
        return {
          ...(yield* waitFor(snapshotFor(ownerId))),
          draft: yield* waitFor(
            saveDraft({
              ...draft,
              mode: action.mode,
            }),
          ),
        };
      }
      case 'generateCourse': {
        if (draft.mode !== 'generate') {
          throw new Error('Course generation is only available in generate mode.');
        }
        if (!hasUsableSourceMaterial(draft)) {
          throw new Error('Add source material before generating the course.');
        }
        const aiRun = createAiRun(draft, 'course_generation');
        const draftWithRunningRun = yield* waitFor(
          saveDraft({
            ...draft,
            aiRuns: [...draft.aiRuns, aiRun],
          }),
        );
        try {
          const blueprintResult = yield* waitFor(
            generateLearningBlueprintWithAi(draftWithRunningRun),
          );
          const contentResult = yield* waitFor(
            generateCourseContentWithAi({
              ...draftWithRunningRun,
              learningBlueprint: blueprintResult.value,
            }),
          );
          const nextDraft = {
            ...draftWithRunningRun,
            aiRuns: [
              ...draftWithRunningRun.aiRuns.filter((run) => run.id !== aiRun.id),
              appliedAiRun(
                aiRun,
                JSON.stringify({
                  content: contentResult.value,
                  learningBlueprint: blueprintResult.value,
                }),
                contentResult.model,
                contentResult.provider,
              ),
            ],
            courseContent: contentResult.value,
            learningBlueprint: blueprintResult.value,
            step: 'preview' as const,
          };
          return {
            ...(yield* waitFor(snapshotFor(ownerId))),
            draft: yield* waitFor(
              saveDraft({
                ...nextDraft,
                findings: buildFindings({ ...nextDraft, findings: [] }),
              }),
            ),
          };
        } catch (error) {
          return {
            ...(yield* waitFor(snapshotFor(ownerId))),
            draft: yield* waitFor(saveDraft(failedAiRun(draftWithRunningRun, aiRun, error))),
          };
        }
      }
      case 'addSource': {
        if (action.source.name.trim().length === 0) {
          throw new Error('Source name is required.');
        }
        if (action.source.type !== 'file' && action.source.content.trim().length === 0) {
          throw new Error('Source content is required.');
        }
        const source = yield* waitFor(processSource(draft.id, action.source));
        const sources = [...draft.sources, source];
        const derived = documentsAndChunksForSource(source, source.createdAt ?? now());
        const timestamp = now();
        return {
          ...(yield* waitFor(snapshotFor(ownerId))),
          draft: yield* waitFor(
            saveDraft({
              ...draft,
              courseContent: staleCourseContent(draft.courseContent, timestamp),
              derivedSourceDocuments: [
                ...draft.derivedSourceDocuments,
                ...derived.derivedSourceDocuments,
              ],
              knowledgeChunks: [...draft.knowledgeChunks, ...derived.knowledgeChunks],
              learningBlueprint: staleLearningBlueprint(draft.learningBlueprint, timestamp),
              sourceProcessingIncomplete: sourceProcessingIncomplete(sources),
              sources,
              step: 'sources',
            }),
          ),
        };
      }
      case 'deleteSource': {
        const sources = draft.sources.map((source) =>
          source.id === action.sourceId
            ? { ...source, deletedAt: now(), status: 'deleted' as const }
            : source,
        );
        return {
          ...(yield* waitFor(snapshotFor(ownerId))),
          draft: yield* waitFor(
            saveDraft({
              ...draft,
              courseContent: staleCourseContent(draft.courseContent, now()),
              derivedSourceDocuments: draft.derivedSourceDocuments.filter(
                (document) => document.sourceAssetId !== action.sourceId,
              ),
              knowledgeChunks: draft.knowledgeChunks.filter(
                (chunk) => chunk.sourceAssetId !== action.sourceId,
              ),
              learningBlueprint: staleLearningBlueprint(draft.learningBlueprint, now()),
              sourceProcessingIncomplete: sourceProcessingIncomplete(sources),
              sources,
            }),
          ),
        };
      }
      case 'retrySource': {
        const existingSource = draft.sources.find((source) => source.id === action.sourceId);
        if (existingSource === undefined) {
          throw new Error('Source not found for signed-in creator.');
        }
        const retriedSource = yield* waitFor(
          processSource(draft.id, {
            content: existingSource.originalInput ?? existingSource.content,
            name: existingSource.name,
            sizeLabel: existingSource.sizeLabel,
            type: existingSource.type,
          }),
        );
        const replacementSource = { ...retriedSource, id: existingSource.id };
        const derived = documentsAndChunksForSource(
          replacementSource,
          replacementSource.createdAt ?? now(),
        );
        const sources = draft.sources.map((source) =>
          source.id === action.sourceId ? replacementSource : source,
        );
        return {
          ...(yield* waitFor(snapshotFor(ownerId))),
          draft: yield* waitFor(
            saveDraft({
              ...draft,
              courseContent: staleCourseContent(draft.courseContent, now()),
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
              learningBlueprint: staleLearningBlueprint(draft.learningBlueprint, now()),
              sourceProcessingIncomplete: sourceProcessingIncomplete(sources),
              sources,
            }),
          ),
        };
      }
      case 'retryAiRun': {
        const run = draft.aiRuns.find((candidate) => candidate.id === action.runId);
        if (run === undefined) {
          throw new Error('AI run not found for signed-in creator.');
        }
        if (run.status !== 'failed') {
          throw new Error('Only failed AI runs can be retried.');
        }
        switch (run.type) {
          case 'course_generation': {
            return yield* waitFor(
              applyWorkflowAction(ownerId, { action: 'generateCourse', draftId: draft.id }),
            );
          }
          case 'learning_blueprint_generation': {
            return yield* waitFor(
              applyWorkflowAction(ownerId, {
                action: 'generateLearningBlueprint',
                draftId: draft.id,
              }),
            );
          }
          case 'course_content_generation': {
            return yield* waitFor(
              applyWorkflowAction(ownerId, { action: 'generateCourseContent', draftId: draft.id }),
            );
          }
          case 'teaching_quality_review': {
            throw new Error('Teaching quality review runs are not retried by this workflow.');
          }
          default: {
            const unsupportedRunType: never = run.type;
            throw new Error(`Unsupported AI run type: ${unsupportedRunType}`);
          }
        }
      }
      case 'generateLearningBlueprint': {
        const draftWithFindings = draftForStep(draft, draft.step);
        assertWorkflowGate(getWorkflowStepGate(draftWithFindings, 'objectives'));
        const aiRun = createAiRun(draft, 'learning_blueprint_generation');
        const draftWithRunningRun = yield* waitFor(
          saveDraft({
            ...draft,
            aiRuns: [...draft.aiRuns, aiRun],
          }),
        );
        try {
          const result = yield* waitFor(generateLearningBlueprintWithAi(draftWithRunningRun));
          const nextDraft: CourseDraft = {
            ...draftWithRunningRun,
            aiRuns: [
              ...draftWithRunningRun.aiRuns.filter((run) => run.id !== aiRun.id),
              appliedAiRun(aiRun, result.text, result.model, result.provider),
            ],
            learningBlueprint: result.value,
            step:
              result.value.activityBriefs.length > 0
                ? ('activityPlan' as const)
                : ('objectives' as const),
          };
          return {
            ...(yield* waitFor(snapshotFor(ownerId))),
            draft: yield* waitFor(
              saveDraft({
                ...nextDraft,
                findings: buildFindings({ ...nextDraft, findings: [] }),
              }),
            ),
          };
        } catch (error) {
          return {
            ...(yield* waitFor(snapshotFor(ownerId))),
            draft: yield* waitFor(saveDraft(failedAiRun(draftWithRunningRun, aiRun, error))),
          };
        }
      }
      case 'updateCoursePreparation': {
        const timestamp = now();
        const preparation = normalizeCoursePreparation(draft, action.preparation);
        const nextBlueprint = staleLearningBlueprint(
          {
            ...draft.learningBlueprint,
            coursePreparation: preparation,
          },
          timestamp,
        );
        const nextDraft = {
          ...draft,
          courseContent: staleCourseContent(draft.courseContent, timestamp),
          learningBlueprint: nextBlueprint,
          step: 'preparation' as const,
        };
        return {
          ...(yield* waitFor(snapshotFor(ownerId))),
          draft: yield* waitFor(
            saveDraft({
              ...nextDraft,
              findings: buildFindings(nextDraft),
            }),
          ),
        };
      }
      case 'updateLearningObjective': {
        const timestamp = now();
        const nextObjectives = draft.learningBlueprint.objectives.map((objective) =>
          objective.id === action.objectiveId
            ? {
                ...objective,
                capability: action.capability.trim() || objective.capability,
                status: 'edited' as const,
                title: action.title.trim() || objective.title,
                updatedAt: timestamp,
              }
            : objective,
        );
        const nextActivityBriefs = draft.learningBlueprint.activityBriefs.map((brief) =>
          brief.objectiveId === action.objectiveId ||
          brief.objectiveIds.includes(action.objectiveId)
            ? { ...brief, status: staleStatusFor(brief.status), updatedAt: timestamp }
            : brief,
        );
        const nextGeneratedActivities = draft.learningBlueprint.generatedActivities.map(
          (activity) =>
            activity.objectiveIds.includes(action.objectiveId)
              ? { ...activity, status: staleStatusFor(activity.status) }
              : activity,
        );
        const nextDraft = {
          ...draft,
          learningBlueprint: {
            ...draft.learningBlueprint,
            activityBriefs: nextActivityBriefs,
            generatedActivities: nextGeneratedActivities,
            objectives: nextObjectives,
            updatedAt: timestamp,
          },
        };
        return {
          ...(yield* waitFor(snapshotFor(ownerId))),
          draft: yield* waitFor(
            saveDraft({
              ...nextDraft,
              courseContent: staleCourseContent(nextDraft.courseContent, timestamp),
              findings: buildFindings(nextDraft),
              step: 'objectives',
            }),
          ),
        };
      }
      case 'updateActivityBrief': {
        const timestamp = now();
        let activityBriefUpdated = false;
        const nextActivityBriefs = draft.learningBlueprint.activityBriefs.map((brief) => {
          if (brief.id !== action.briefId) {
            return brief;
          }
          activityBriefUpdated = true;
          return {
            ...brief,
            feedbackGuidance: action.feedbackGuidance.trim() || brief.feedbackGuidance,
            instructions: action.instructions.trim() || brief.instructions,
            learnerAction: action.learnerAction.trim() || brief.learnerAction,
            status: 'edited' as const,
            successCriteria: action.successCriteria.trim() || brief.successCriteria,
            title: action.title.trim() || brief.title,
            type: action.type,
            updatedAt: timestamp,
          };
        });
        const nextGeneratedActivities = draft.learningBlueprint.generatedActivities.map(
          (activity) =>
            activity.briefId === action.briefId && activityBriefUpdated
              ? { ...activity, status: staleStatusFor(activity.status) }
              : activity,
        );
        const nextDraft = {
          ...draft,
          learningBlueprint: {
            ...draft.learningBlueprint,
            activityBriefs: nextActivityBriefs,
            generatedActivities: nextGeneratedActivities,
            updatedAt: timestamp,
          },
        };
        return {
          ...(yield* waitFor(snapshotFor(ownerId))),
          draft: yield* waitFor(
            saveDraft({
              ...nextDraft,
              courseContent: staleCourseContent(nextDraft.courseContent, timestamp),
              findings: buildFindings(nextDraft),
              step: 'activityPlan',
            }),
          ),
        };
      }
      case 'generateCourseContent': {
        const draftWithFindings = draftForStep(draft, draft.step);
        assertWorkflowGate(getWorkflowStepGate(draftWithFindings, 'courseContent'));
        const aiRun = createAiRun(draft, 'course_content_generation');
        const draftWithRunningRun = yield* waitFor(
          saveDraft({ ...draft, aiRuns: [...draft.aiRuns, aiRun] }),
        );
        try {
          const result = yield* waitFor(generateCourseContentWithAi(draftWithRunningRun));
          const nextDraft = {
            ...draftWithRunningRun,
            aiRuns: [
              ...draftWithRunningRun.aiRuns.filter((run) => run.id !== aiRun.id),
              appliedAiRun(aiRun, result.text, result.model, result.provider),
            ],
            courseContent: result.value,
            step: 'courseContent' as const,
          };
          return {
            ...(yield* waitFor(snapshotFor(ownerId))),
            draft: yield* waitFor(
              saveDraft({
                ...nextDraft,
                findings: buildFindings({ ...nextDraft, findings: [] }),
              }),
            ),
          };
        } catch (error) {
          return {
            ...(yield* waitFor(snapshotFor(ownerId))),
            draft: yield* waitFor(saveDraft(failedAiRun(draftWithRunningRun, aiRun, error))),
          };
        }
      }
      case 'setFindingStatus': {
        const currentFindings = buildFindings(draft);
        return {
          ...(yield* waitFor(snapshotFor(ownerId))),
          draft: yield* waitFor(
            saveDraft({
              ...draft,
              findings: updateFindingStatus(currentFindings, action.findingId, action.status),
            }),
          ),
        };
      }
      case 'openPreview': {
        const previewDraft = { ...draft, findings: buildFindings(draft) };
        if (
          !getWorkflowPreviewGate(previewDraft, {
            blockOpenFindings: draft.mode !== 'generate',
          }).allowed
        ) {
          return {
            ...(yield* waitFor(snapshotFor(ownerId))),
            draft: yield* waitFor(
              saveDraft({
                ...previewDraft,
                step: draft.step === 'preview' ? 'courseContent' : draft.step,
              }),
            ),
          };
        }
        return {
          ...(yield* waitFor(snapshotFor(ownerId))),
          draft: yield* waitFor(
            saveDraft({
              ...previewDraft,
              step: 'preview',
            }),
          ),
        };
      }
      default: {
        const unsupportedAction: never = action;
        throw new Error(`Unsupported workflow action: ${JSON.stringify(unsupportedAction)}`);
      }
    }
  });
