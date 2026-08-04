import * as NodeCrypto from '@effect/platform-node/NodeCrypto';
import { Crypto, Data, DateTime, Effect, Option, Schema } from 'effect';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import { FetchHttpClient } from 'effect/unstable/http';
import {
  CoursitionWorkflowConflict,
  courseContentSchema,
  courseDraftSchema,
  learningBlueprintSchema,
} from '../../shared/api.ts';
import {
  buildFindings,
  emptyCourseContent,
  emptyLearningBlueprint,
  getWorkflowPreviewGate,
  getWorkflowStepGate,
  hasActivityPlan,
  hasCourseContent,
  hasCoursePreparation,
  hasObjectiveMap,
  hasPlayableGeneratedActivityCoverage,
  hasUsableSourceMaterial,
  isPlayableGeneratedActivity,
  staleCourseContent,
  staleLearningBlueprint,
} from '../../shared/coursition/workflow.ts';
import type {
  ActivityBrief,
  AiRun,
  AiRunType,
  CourseDraft,
  CourseDraftSummary,
  DerivedSourceDocument,
  GeneratedActivity,
  KnowledgeChunk,
  LearningBlueprint,
  LearningObjective,
  SourceAsset,
  WorkflowAction,
  WorkflowSnapshot,
} from '../../shared/coursition/workflow.ts';
import { isAiProviderConfigured, isFreeAiModel } from './ai-provider-config.ts';
import { loadCoursitionSourceProviderConfig, providerKeyConfigured } from './config.ts';
import {
  isWebExtractionConfigured,
  processSource,
  SourceProcessingError,
} from './source-processing.ts';
import type { SourceProcessorDeps } from './source-processing.ts';
import {
  cloudflareSourceCleanupRepository,
  deleteSourceBlobOrSchedule,
  drainSourceCleanup,
} from './source-cleanup.ts';
import type {
  ScheduleSourceCleanup,
  SourceCleanupError,
  SourceCleanupRepository,
} from './source-cleanup.ts';
import { defaultSeedStoreJsonText } from './default-seed.generated.ts';
import { cloudflareDraftRepository } from './d1-draft-repository.ts';
import {
  DraftNotFound,
  DraftOperationReuse,
  DraftRepositoryError,
  DraftRevisionConflict,
} from './draft-repository.ts';
import type { DraftOperationCommit, DraftRepository, OwnerDraftState } from './draft-repository.ts';
import type * as AiProviderModule from './ai-provider.ts';
import { inMemoryDraftRepository, jsonFileDraftRepository } from './local-draft-repository.ts';
import {
  cloudflareSourceBlobStore,
  inMemorySourceBlobStore,
  isSourceBlobReference,
  localSourceBlobStore,
} from './source-blob-store.ts';
import type { SourceBlobStore, SourceBlobStoreError } from './source-blob-store.ts';

const defaultSeedSchema = Schema.Struct({ drafts: Schema.Array(courseDraftSchema) });
const activityRunSummaryJsonSchema = Schema.fromJsonString(
  Schema.Struct({
    failedCount: Schema.Finite,
    generatedCount: Schema.Finite,
    totalCount: Schema.Finite,
  }),
);
const courseGenerationSummaryJsonSchema = Schema.fromJsonString(
  Schema.Struct({
    content: courseContentSchema,
    learningBlueprint: learningBlueprintSchema,
  }),
);
const unknownRecordOptionFromUnknown = Schema.decodeUnknownOption(
  Schema.Record(Schema.String, Schema.Unknown),
);

class CoursitionStoreError extends Data.TaggedError('CoursitionStoreError')<{
  readonly message: string;
  readonly schemaError?: Schema.SchemaError;
}> {}

type StoreError = CoursitionStoreError | DraftRevisionConflict;

const toStoreError = (cause: unknown): CoursitionStoreError | DraftRevisionConflict => {
  if (cause instanceof DraftRevisionConflict) {
    return cause;
  }
  if (cause instanceof DraftNotFound) {
    return new CoursitionStoreError({
      message: 'Course draft not found for signed-in creator.',
    });
  }
  if (cause instanceof DraftOperationReuse) {
    return new CoursitionStoreError({
      message: 'Operation identity was reused for a different request.',
    });
  }
  if (cause instanceof DraftRepositoryError) {
    return new CoursitionStoreError({ message: cause.message });
  }
  if (cause instanceof CoursitionStoreError) {
    return cause;
  }
  return new CoursitionStoreError({
    message:
      cause instanceof Error && cause.message.trim().length > 0
        ? cause.message.trim()
        : 'Course draft storage failed.',
  });
};

interface OperationContext {
  committed: boolean;
  readonly commit: DraftOperationCommit;
}

const operationLeaseDurationMs = 15 * 60 * 1000;
const aiRunTimeoutMs = 15 * 60 * 1000;

const canonicalJson = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  if (typeof value === 'object' && value !== null) {
    return `{${Object.entries(value)
      .toSorted(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
};

const sha256Hex = (value: string) =>
  Effect.tryPromise({
    catch: toStoreError,
    try: () => crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
  }).pipe(
    Effect.map((digest) =>
      Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join(''),
    ),
  );

const operationRequestFingerprint = (action: OperationBackedAction) =>
  action.action === 'addSource' && action.source.type === 'file'
    ? sha256Hex(action.source.content).pipe(
        Effect.map((digest) =>
          canonicalJson({
            ...action,
            source: {
              ...action.source,
              content: `sha256:${digest}:${action.source.content.length}`,
            },
          }),
        ),
      )
    : Effect.succeed(canonicalJson(action));

const now = () => DateTime.formatIso(DateTime.nowUnsafe());
const currentEpochMillis = () => DateTime.toEpochMillis(DateTime.nowUnsafe());
const cryptoRuntime = ManagedRuntime.make(NodeCrypto.layer);
const sourceProcessingRuntime = ManagedRuntime.make(FetchHttpClient.layer);
const randomUuidV4 = () =>
  cryptoRuntime.runSync(
    Effect.gen(function* randomUuidV4Program() {
      const crypto = yield* Crypto.Crypto;
      return yield* crypto.randomUUIDv4;
    }),
  );
const createId = (prefix: string) => `${prefix}_${randomUuidV4()}`;
const sourceProviderConfig = () => loadCoursitionSourceProviderConfig();

const defaultSeedDrafts = Schema.decodeUnknownSync(defaultSeedSchema)(
  JSON.parse(defaultSeedStoreJsonText),
).drafts;

const configuredDataDirectory = () => {
  const value = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env?.['COURSITION_DATA_DIR'];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : '.coursition-data';
};

const configuredStoreBackend = () => {
  const value = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env?.['COURSITION_STORE_BACKEND'];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : 'json-file';
};

let activeDraftRepository: DraftRepository | undefined;
let activeSourceBlobStore: SourceBlobStore | undefined;
let activeSourceCleanupRepository: SourceCleanupRepository | undefined;
let activeBackendSeedsDefaults = true;

const configureStorage = () => {
  if (activeDraftRepository !== undefined && activeSourceBlobStore !== undefined) {
    return;
  }
  const backend = configuredStoreBackend();
  if (backend === 'cloudflare') {
    activeDraftRepository = cloudflareDraftRepository();
    activeSourceBlobStore = cloudflareSourceBlobStore();
    activeSourceCleanupRepository = cloudflareSourceCleanupRepository();
    activeBackendSeedsDefaults = false;
  } else if (backend === 'memory') {
    activeDraftRepository = inMemoryDraftRepository();
    activeSourceBlobStore = inMemorySourceBlobStore();
    activeSourceCleanupRepository = undefined;
  } else {
    const rootDirectory = configuredDataDirectory();
    activeDraftRepository = jsonFileDraftRepository(rootDirectory);
    activeSourceBlobStore = localSourceBlobStore(rootDirectory);
    activeSourceCleanupRepository = undefined;
  }
};

const currentDraftRepository = () => {
  configureStorage();
  if (activeDraftRepository === undefined) {
    throw new CoursitionStoreError({ message: 'Course draft repository is unavailable.' });
  }
  return activeDraftRepository;
};

const currentSourceBlobStore = () => {
  configureStorage();
  if (activeSourceBlobStore === undefined) {
    throw new CoursitionStoreError({ message: 'Source blob store is unavailable.' });
  }
  return activeSourceBlobStore;
};

export const setStorageAdapters = (
  draftRepository: DraftRepository,
  sourceBlobStore: SourceBlobStore = inMemorySourceBlobStore(),
  sourceCleanupRepository?: SourceCleanupRepository,
) => {
  activeDraftRepository = draftRepository;
  activeSourceBlobStore = sourceBlobStore;
  activeSourceCleanupRepository = sourceCleanupRepository;
  activeBackendSeedsDefaults = false;
};

export const resetStorageAdapters = () => {
  activeDraftRepository = undefined;
  activeSourceBlobStore = undefined;
  activeSourceCleanupRepository = undefined;
  activeBackendSeedsDefaults = true;
};

const seedOwnerIdToken = '__coursition_seed_owner__';

const seedOwnerKey = (ownerId: string) => {
  const key = ownerId.replaceAll(/[^\w-]+/gu, '_').slice(0, 48);
  return key.length > 0 ? key : 'owner';
};

const replaceSeedString = (
  value: string,
  sourceDraftId: string,
  seededDraftId: string,
  ownerId: string,
) => value.replaceAll(sourceDraftId, seededDraftId).replaceAll(seedOwnerIdToken, ownerId);

const replaceSeedValues = (
  value: unknown,
  sourceDraftId: string,
  seededDraftId: string,
  ownerId: string,
): unknown => {
  if (typeof value === 'string') {
    return replaceSeedString(value, sourceDraftId, seededDraftId, ownerId);
  }
  if (Array.isArray(value)) {
    return value.map((item) => replaceSeedValues(item, sourceDraftId, seededDraftId, ownerId));
  }
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        replaceSeedValues(entry, sourceDraftId, seededDraftId, ownerId),
      ]),
    );
  }
  return value;
};

const seedDraftsForOwner = (ownerId: string): CourseDraft[] =>
  defaultSeedDrafts.map((draft, index) => {
    const seededDraftId = `${draft.id}_seed_${seedOwnerKey(ownerId)}_${index + 1}`;
    const seededDraft = Schema.decodeUnknownSync(courseDraftSchema)(
      replaceSeedValues(draft, draft.id, seededDraftId, ownerId),
    );
    return {
      ...seededDraft,
      ownerId,
    };
  });

const loadFileSourcePayload = (source: SourceAsset) =>
  currentSourceBlobStore()
    .read(source.storageReference)
    .pipe(
      Effect.map(
        Option.map((bytes) => ({
          bytes,
          declaredMimeType: source.mimeType ?? 'application/octet-stream',
        })),
      ),
    );

/*
 * Source Material processing lives in its own module with its own HttpClient
 * runtime. The store supplies the persistence dependency by running the
 * FileSystem-backed blob write through the store runtime and surfacing failures
 * as the module's tagged error.
 */
const sourceProcessorDeps: SourceProcessorDeps = {
  deleteSourceBlob: (reference) =>
    currentSourceBlobStore()
      .delete(reference)
      .pipe(
        Effect.mapError(
          (cause) =>
            new SourceProcessingError({
              message:
                cause instanceof Error ? cause.message : 'Failed to delete source asset bytes.',
            }),
        ),
      ),
  newSourceId: (draftId) => createId(`source_${draftId}`),
  now,
  writeSourceBlob: (draftId, sourceId, bytes) =>
    currentSourceBlobStore()
      .write(draftId, sourceId, bytes)
      .pipe(
        Effect.mapError(
          (cause) =>
            new SourceProcessingError({
              message:
                cause instanceof Error ? cause.message : 'Failed to store source asset bytes.',
            }),
        ),
      ),
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

const ensureDefaultDraftsForOwner = (ownerId: string) => {
  configureStorage();
  if (!activeBackendSeedsDefaults) {
    return Effect.void;
  }
  return Effect.gen(function* ensureDefaultDraftsProgram() {
    const state = yield* currentDraftRepository().readOwnerState(ownerId);
    if (state.drafts.length > 0) {
      return;
    }
    for (const draft of seedDraftsForOwner(ownerId)) {
      yield* currentDraftRepository().create({ ...draft, revision: 0 });
    }
  }).pipe(Effect.mapError(toStoreError));
};

const operationCommitFor = (operation: OperationContext | undefined) =>
  operation?.committed === false ? operation.commit : undefined;

const markOperationCommitted = (operation: OperationContext | undefined) => {
  if (operation !== undefined) {
    operation.committed = true;
  }
};

const deleteCommittedLocalSourceBlobs = (
  sourceCleanup: readonly { readonly reference: string; readonly sourceId?: string }[] = [],
) => {
  if (activeSourceCleanupRepository !== undefined || sourceCleanup.length === 0) {
    return Effect.void;
  }
  return Effect.forEach(
    sourceCleanup,
    ({ reference }) => currentSourceBlobStore().delete(reference),
    { concurrency: 1, discard: true },
  ).pipe(Effect.exit, Effect.asVoid);
};

const deleteSourceBlobAfterRollback = (
  request: ScheduleSourceCleanup,
): Effect.Effect<void, SourceBlobStoreError | SourceCleanupError> => {
  configureStorage();
  const blobStore = currentSourceBlobStore();
  return activeSourceCleanupRepository === undefined
    ? blobStore.delete(request.reference)
    : deleteSourceBlobOrSchedule(activeSourceCleanupRepository, blobStore, request);
};

export const drainPendingSourceCleanup = (limit = 5) => {
  configureStorage();
  return activeSourceCleanupRepository === undefined
    ? Promise.resolve({ completed: 0, failed: 0, processed: 0 })
    : Effect.runPromise(
        drainSourceCleanup(activeSourceCleanupRepository, currentSourceBlobStore(), { limit }),
      );
};

const saveDraft = (
  draft: CourseDraft,
  operation?: OperationContext,
  sourceCleanup?: readonly { readonly reference: string; readonly sourceId?: string }[],
) => {
  const commit = operationCommitFor(operation);
  return (
    draft.revision === 0
      ? currentDraftRepository().create(draft, commit)
      : currentDraftRepository().update(draft, draft.revision, commit, sourceCleanup)
  ).pipe(
    Effect.tap(() => Effect.sync(() => markOperationCommitted(operation))),
    Effect.tap(() => deleteCommittedLocalSourceBlobs(sourceCleanup)),
    Effect.mapError(toStoreError),
  );
};

const requireStoredDraft = (ownerId: string, draftId: string) => {
  const { find } = currentDraftRepository();
  return find(ownerId, draftId).pipe(Effect.mapError(toStoreError));
};

const runningRunIsExpired = (run: AiRun, timestamp: number) => {
  if (run.status !== 'running') {
    return false;
  }
  const updatedAt = globalThis.Date.parse(run.updatedAt);
  return !Number.isFinite(updatedAt) || timestamp - updatedAt >= aiRunTimeoutMs;
};

const recoveredDraft = (draft: CourseDraft, timestamp: number) => {
  const expiredRuns = draft.aiRuns.filter((run) => runningRunIsExpired(run, timestamp));
  if (expiredRuns.length === 0) {
    return null;
  }
  const expiredIds = new Set(expiredRuns.map((run) => run.id));
  const candidate: CourseDraft = {
    ...draft,
    aiRuns: draft.aiRuns.map((run) =>
      expiredIds.has(run.id)
        ? {
            ...run,
            failureReason: 'AI generation was interrupted and can be retried safely.',
            status: 'failed' as const,
            updatedAt: now(),
          }
        : run,
    ),
  };
  return { ...candidate, findings: buildFindings(candidate) };
};

const recoverStaleRuns = (
  ownerId: string,
  draft: CourseDraft,
  attempts = 2,
): Effect.Effect<CourseDraft, StoreError> => {
  const recovered = recoveredDraft(draft, currentEpochMillis());
  if (recovered === null) {
    return Effect.succeed(draft);
  }
  return saveDraft(recovered).pipe(
    Effect.catchTag('DraftRevisionConflict', (conflict) =>
      attempts > 0
        ? requireStoredDraft(ownerId, draft.id).pipe(
            Effect.flatMap((latest) => recoverStaleRuns(ownerId, latest, attempts - 1)),
          )
        : Effect.fail(conflict),
    ),
  );
};

const requireDraft = (ownerId: string, draftId: string) =>
  requireStoredDraft(ownerId, draftId).pipe(
    Effect.flatMap((draft) => recoverStaleRuns(ownerId, draft)),
  );

export const draftForOwner = (ownerId: string, draftId: string): Promise<CourseDraft> =>
  Effect.runPromise(requireDraft(ownerId, draftId));

const deleteDraft = (
  ownerId: string,
  draftId: string,
  expectedRevision: number,
  operation?: OperationContext,
  sourceCleanup?: readonly { readonly reference: string; readonly sourceId?: string }[],
) =>
  currentDraftRepository()
    .delete(ownerId, draftId, expectedRevision, operationCommitFor(operation), sourceCleanup)
    .pipe(
      Effect.tap(() => Effect.sync(() => markOperationCommitted(operation))),
      Effect.tap(() => deleteCommittedLocalSourceBlobs(sourceCleanup)),
      Effect.mapError(toStoreError),
    );

const draftSummaryFor = (draft: CourseDraft): CourseDraftSummary => ({
  activityCount: draft.learningBlueprint.generatedActivities.length,
  id: draft.id,
  language: draft.language,
  mode: draft.mode,
  objectiveCount: draft.learningBlueprint.objectives.length,
  revision: draft.revision,
  sectionCount: draft.courseContent.sections.length,
  sourceCount: draft.sources.filter((source) => source.status !== 'deleted').length,
  step: draft.step,
  title: draft.title,
  updatedAt: draft.updatedAt,
});

const sourceProcessingIncomplete = (sources: SourceAsset[]) =>
  sources.some((source) => source.status === 'queued' || source.status === 'processing');

const cleanupForSource = (source: SourceAsset) => {
  const { storageReference } = source;
  return typeof storageReference === 'string' && isSourceBlobReference(storageReference)
    ? [{ reference: storageReference, sourceId: source.id }]
    : [];
};

const errorMessageFromUnknown = (error: unknown, depth = 0): string | null => {
  if (depth > 4) {
    return null;
  }
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }
  if (typeof error === 'string' && error.trim().length > 0) {
    return error.trim();
  }
  if (typeof error !== 'object' || error === null) {
    return null;
  }
  const record = unknownRecordOptionFromUnknown(error);
  if (Option.isNone(record)) {
    return null;
  }
  const { message } = record.value;
  if (typeof message === 'string' && message.trim().length > 0) {
    return message.trim();
  }
  return errorMessageFromUnknown(record.value['cause'], depth + 1);
};

const errorFailureReason = (error: unknown) =>
  errorMessageFromUnknown(error) ?? 'AI generation failed without a readable provider error.';

const failedAiRun = (draft: CourseDraft, run: AiRun, error: unknown): CourseDraft => ({
  ...draft,
  aiRuns: [
    ...draft.aiRuns.filter((candidate) => candidate.id !== run.id),
    {
      ...run,
      failureReason: errorFailureReason(error),
      status: 'failed',
      updatedAt: now(),
    },
  ],
});

const withFinalFindings = (draft: CourseDraft): CourseDraft => ({
  ...draft,
  findings: buildFindings(draft),
});

const mergeLatestDraft = (
  ownerId: string,
  draftId: string,
  merge: (current: CourseDraft) => CourseDraft,
  attempts = 4,
): Effect.Effect<CourseDraft, StoreError | Schema.SchemaError | DraftRevisionConflict> =>
  requireDraft(ownerId, draftId).pipe(
    Effect.flatMap((current) => saveDraft(withFinalFindings(merge(current)))),
    Effect.catchTag('DraftRevisionConflict', (conflict) =>
      attempts > 0
        ? mergeLatestDraft(ownerId, draftId, merge, attempts - 1)
        : Effect.fail(conflict),
    ),
  );

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

const objectiveForBrief = (
  draft: CourseDraft,
  brief: ActivityBrief,
): LearningObjective | undefined => {
  const objectiveIds = brief.objectiveIds.length > 0 ? brief.objectiveIds : [brief.objectiveId];
  return draft.learningBlueprint.objectives.find((objective) =>
    objectiveIds.includes(objective.id),
  );
};

const replaceGeneratedActivity = (
  activities: readonly GeneratedActivity[],
  activity: GeneratedActivity,
) => [...activities.filter((candidate) => candidate.briefId !== activity.briefId), activity];

const replaceGeneratedActivities = (
  activities: readonly GeneratedActivity[],
  replacements: readonly GeneratedActivity[],
) => {
  let nextActivities = [...activities];
  for (const activity of replacements) {
    nextActivities = replaceGeneratedActivity(nextActivities, activity);
  }
  return nextActivities;
};

const needsLearningPlan = (draft: CourseDraft) =>
  !hasCoursePreparation(draft) ||
  !hasObjectiveMap(draft) ||
  !hasActivityPlan(draft) ||
  draft.learningBlueprint.objectives.some((objective) => objective.status === 'stale') ||
  draft.learningBlueprint.activityBriefs.some((brief) => brief.status === 'stale');

const needsCoursePreparation = (draft: CourseDraft) => !hasCoursePreparation(draft);

const needsActivities = (draft: CourseDraft) =>
  hasActivityPlan(draft) &&
  (!hasPlayableGeneratedActivityCoverage(draft) ||
    draft.learningBlueprint.activityBriefs.some((brief) => brief.status === 'stale') ||
    draft.learningBlueprint.generatedActivities.some((activity) => activity.status === 'stale'));

const needsCourseContent = (draft: CourseDraft) =>
  !hasCourseContent(draft) ||
  draft.courseContent.status === 'stale' ||
  draft.courseContent.sections.some(
    (section) =>
      section.status === 'stale' || section.blocks.some((block) => block.status === 'stale'),
  );

const needsGeneratedCourseRefresh = (draft: CourseDraft) =>
  [needsLearningPlan(draft), needsActivities(draft), needsCourseContent(draft)].some(Boolean);

const generatedActivityBriefIds = (draft: CourseDraft) =>
  new Set(
    draft.learningBlueprint.generatedActivities
      .filter(isPlayableGeneratedActivity)
      .map((activity) => activity.briefId),
  );

const pendingActivityBriefs = (draft: CourseDraft, options: { force: boolean }) => {
  if (options.force) {
    return draft.learningBlueprint.activityBriefs.filter((brief) => brief.status !== 'empty');
  }
  const generatedBriefIds = generatedActivityBriefIds(draft);
  return draft.learningBlueprint.activityBriefs.filter(
    (brief) =>
      brief.status !== 'empty' && (brief.status === 'stale' || !generatedBriefIds.has(brief.id)),
  );
};

const aiGeneration = <A>(thunk: () => Promise<A>) =>
  Effect.tryPromise({
    catch: (cause) => new CoursitionStoreError({ message: errorFailureReason(cause) }),
    try: thunk,
  });

type AiProviderModuleLoader = () => Promise<typeof AiProviderModule>;

let activeAiProviderModuleLoader: AiProviderModuleLoader = () => import('./ai-provider.ts');

export const setAiProviderModuleLoaderForTests = (loader: AiProviderModuleLoader) => {
  activeAiProviderModuleLoader = loader;
};

export const resetAiProviderModuleLoaderForTests = () => {
  activeAiProviderModuleLoader = () => import('./ai-provider.ts');
};

const aiProviderModule = () => activeAiProviderModuleLoader();

const failedActivityFromBrief = (brief: ActivityBrief, reason: string): GeneratedActivity => ({
  briefId: brief.id,
  id: `generated_activity_${brief.id}`,
  interaction: {
    feedback: reason,
    kind: 'not_playable',
    prompt: 'The playable activity was not generated.',
    reason,
  },
  objectiveIds: brief.objectiveIds.length > 0 ? brief.objectiveIds : [brief.objectiveId],
  sourceConfidence: brief.sourceConfidence,
  sourceReferences: brief.sourceReferences ?? [],
  status: 'stale',
  type: 'not_playable',
});

const activityRunSummary = (generatedCount: number, failedCount: number, totalCount: number) =>
  Schema.encodeEffect(activityRunSummaryJsonSchema)({ failedCount, generatedCount, totalCount });

const courseGenerationSummary = (draft: CourseDraft) =>
  Schema.encodeEffect(courseGenerationSummaryJsonSchema)({
    content: draft.courseContent,
    learningBlueprint: draft.learningBlueprint,
  });

const saveGeneratedActivity = (
  ownerId: string,
  draftId: string,
  activity: GeneratedActivity,
  operation?: OperationContext,
  attempts = 4,
): Effect.Effect<CourseDraft, StoreError> =>
  Effect.gen(function* saveGeneratedActivityProgram() {
    const currentDraft = yield* requireDraft(ownerId, draftId);
    const currentBrief = currentDraft.learningBlueprint.activityBriefs.find(
      (brief) => brief.id === activity.briefId,
    );
    if (currentBrief === undefined) {
      return yield* new CoursitionStoreError({
        message: 'Activity brief is no longer available for generation.',
      });
    }
    const timestamp = now();
    const nextActivity =
      activity.type === 'not_playable' ? activity : { ...activity, status: 'generated' as const };
    const nextDraft: CourseDraft = {
      ...currentDraft,
      courseContent: staleCourseContent(currentDraft.courseContent, timestamp),
      learningBlueprint: {
        ...currentDraft.learningBlueprint,
        activityBriefs: currentDraft.learningBlueprint.activityBriefs.map((brief) =>
          brief.id === activity.briefId && isPlayableGeneratedActivity(nextActivity)
            ? { ...brief, status: 'generated', updatedAt: timestamp }
            : brief,
        ),
        generatedActivities: replaceGeneratedActivity(
          currentDraft.learningBlueprint.generatedActivities,
          nextActivity,
        ),
        updatedAt: timestamp,
      },
      step: 'activityPlan',
    };
    return yield* saveDraft(withFinalFindings(nextDraft), operation).pipe(
      Effect.catchTag('DraftRevisionConflict', (conflict) =>
        attempts > 0
          ? saveGeneratedActivity(ownerId, draftId, activity, operation, attempts - 1)
          : Effect.fail(conflict),
      ),
    );
  });

const generateAndSaveActivity = (
  ownerId: string,
  draft: CourseDraft,
  brief: ActivityBrief,
  operation?: OperationContext,
) =>
  Effect.gen(function* generateAndSaveActivityProgram() {
    const objective = objectiveForBrief(draft, brief);
    if (objective === undefined) {
      const activity = failedActivityFromBrief(
        brief,
        `No learning objective was found for activity brief: ${brief.title}.`,
      );
      yield* saveGeneratedActivity(ownerId, draft.id, activity, operation);
      return activity;
    }
    const activity = yield* aiGeneration(() =>
      aiProviderModule().then(({ generateActivityWithAi }) =>
        generateActivityWithAi(draft, objective, brief),
      ),
    ).pipe(
      Effect.match({
        onFailure: (error) => failedActivityFromBrief(brief, error.message),
        onSuccess: (result) => result.value,
      }),
    );
    yield* saveGeneratedActivity(ownerId, draft.id, activity, operation);
    return activity;
  });

export const learningBlueprintAfterPlanning = (
  current: CourseDraft,
  generated: LearningBlueprint,
): LearningBlueprint => ({
  ...generated,
  coursePreparation:
    current.mode === 'generate'
      ? generated.coursePreparation
      : current.learningBlueprint.coursePreparation,
});

const runLearningPlanPhase = (
  ownerId: string,
  draft: CourseDraft,
  options: { force: boolean; step: CourseDraft['step'] },
  operation?: OperationContext,
) =>
  Effect.gen(function* runLearningPlanPhaseProgram() {
    if (!options.force && !needsLearningPlan(draft)) {
      return draft;
    }
    const aiRun = createAiRun(draft, 'learning_blueprint_generation');
    const draftWithRunningRun = yield* saveDraft(
      { ...draft, aiRuns: [...draft.aiRuns, aiRun] },
      operation,
    );
    const result = yield* aiGeneration(() =>
      aiProviderModule().then(({ generateLearningPlanWithAi }) =>
        generateLearningPlanWithAi(draftWithRunningRun),
      ),
    ).pipe(
      Effect.catch((error) =>
        mergeLatestDraft(ownerId, draft.id, (current) => failedAiRun(current, aiRun, error)).pipe(
          Effect.flatMap(() => Effect.fail(error)),
        ),
      ),
    );
    return yield* mergeLatestDraft(ownerId, draft.id, (current) => ({
      ...current,
      aiRuns: [
        ...current.aiRuns.filter((run) => run.id !== aiRun.id),
        appliedAiRun(aiRun, result.text, result.model, result.provider),
      ],
      courseContent: staleCourseContent(current.courseContent, now()),
      learningBlueprint: learningBlueprintAfterPlanning(current, result.value),
      step: options.step,
    }));
  });

const runCoursePreparationPhase = (
  ownerId: string,
  draft: CourseDraft,
  options: { force: boolean },
  operation?: OperationContext,
) =>
  Effect.gen(function* runCoursePreparationPhaseProgram() {
    if (!options.force && !needsCoursePreparation(draft)) {
      return draft;
    }
    const aiRun = createAiRun(draft, 'course_preparation_generation');
    const draftWithRunningRun = yield* saveDraft(
      { ...draft, aiRuns: [...draft.aiRuns, aiRun] },
      operation,
    );
    const result = yield* aiGeneration(() =>
      aiProviderModule().then(({ generateCoursePreparationWithAi }) =>
        generateCoursePreparationWithAi(draftWithRunningRun),
      ),
    ).pipe(
      Effect.catch((error) =>
        mergeLatestDraft(ownerId, draft.id, (current) => failedAiRun(current, aiRun, error)).pipe(
          Effect.flatMap(() => Effect.fail(error)),
        ),
      ),
    );
    return yield* mergeLatestDraft(ownerId, draft.id, (current) => {
      const timestamp = now();
      return {
        ...current,
        aiRuns: [
          ...current.aiRuns.filter((run) => run.id !== aiRun.id),
          appliedAiRun(aiRun, result.text, result.model, result.provider),
        ],
        courseContent: staleCourseContent(current.courseContent, timestamp),
        learningBlueprint: staleLearningBlueprint(
          {
            ...current.learningBlueprint,
            assumptions: result.value.assumptions,
            coursePreparation: result.value.coursePreparation,
          },
          timestamp,
        ),
        step: 'preparation',
      };
    });
  });

const runActivityPhase = (
  ownerId: string,
  draft: CourseDraft,
  options: { force: boolean },
  operation?: OperationContext,
) =>
  Effect.gen(function* runActivityPhaseProgram() {
    if (!options.force && !needsActivities(draft)) {
      return draft;
    }
    const aiRun = createAiRun(draft, 'activity_generation');
    const draftWithRunningRun = yield* saveDraft(
      { ...draft, aiRuns: [...draft.aiRuns, aiRun] },
      operation,
    );
    const briefs = pendingActivityBriefs(draftWithRunningRun, options);
    const usesFreeModel = isFreeAiModel(sourceProviderConfig().aiModel);
    const activityResultsEffect = usesFreeModel
      ? aiGeneration(() =>
          aiProviderModule().then(({ renderPlayableActivityFromBrief }) =>
            briefs.map((brief) => renderPlayableActivityFromBrief(draftWithRunningRun, brief)),
          ),
        )
      : Effect.all(
          briefs.map((brief) =>
            generateAndSaveActivity(ownerId, draftWithRunningRun, brief, operation),
          ),
          // The D1 adapter stores the course aggregate in one row. Serial writes
          // ensure each generated activity reads the result of the previous write.
          { concurrency: 1 },
        );
    const activityResults = yield* activityResultsEffect.pipe(
      Effect.catch((error) =>
        mergeLatestDraft(ownerId, draft.id, (current) => failedAiRun(current, aiRun, error)).pipe(
          Effect.flatMap(() => Effect.fail(error)),
        ),
      ),
    );
    const generatedCount = activityResults.filter(isPlayableGeneratedActivity).length;
    const failedCount = activityResults.length - generatedCount;
    const runSummary = yield* activityRunSummary(
      generatedCount,
      failedCount,
      activityResults.length,
    );
    if (generatedCount === 0 && failedCount > 0) {
      const message = `Activity generation failed for all ${failedCount} activity briefs.`;
      yield* mergeLatestDraft(ownerId, draft.id, (current) =>
        failedAiRun(
          { ...current, step: 'activityPlan' },
          aiRun,
          new CoursitionStoreError({ message }),
        ),
      );
      return yield* new CoursitionStoreError({ message });
    }
    return yield* mergeLatestDraft(ownerId, draft.id, (current) => {
      const currentBriefIds = new Set(
        current.learningBlueprint.activityBriefs.map((brief) => brief.id),
      );
      const applicableResults = activityResults.filter((activity) =>
        currentBriefIds.has(activity.briefId),
      );
      return {
        ...current,
        aiRuns: [
          ...current.aiRuns.filter((run) => run.id !== aiRun.id),
          appliedAiRun(aiRun, runSummary, aiRun.model, aiRun.provider),
        ],
        learningBlueprint: usesFreeModel
          ? {
              ...current.learningBlueprint,
              activityBriefs: current.learningBlueprint.activityBriefs.map((brief) =>
                applicableResults.some(
                  (activity) =>
                    activity.briefId === brief.id && isPlayableGeneratedActivity(activity),
                )
                  ? { ...brief, status: 'generated' as const, updatedAt: now() }
                  : brief,
              ),
              generatedActivities: replaceGeneratedActivities(
                current.learningBlueprint.generatedActivities,
                applicableResults,
              ),
              updatedAt: now(),
            }
          : current.learningBlueprint,
        step: 'activityPlan',
      };
    });
  });

const runCourseContentPhase = (
  ownerId: string,
  draft: CourseDraft,
  options: { force: boolean },
  operation?: OperationContext,
) =>
  Effect.gen(function* runCourseContentPhaseProgram() {
    if (!options.force && !needsCourseContent(draft)) {
      return draft;
    }
    const aiRun = createAiRun(draft, 'course_content_generation');
    const draftWithRunningRun = yield* saveDraft(
      { ...draft, aiRuns: [...draft.aiRuns, aiRun] },
      operation,
    );
    const result = yield* aiGeneration(() =>
      aiProviderModule().then(({ generateCourseContentWithAi }) =>
        generateCourseContentWithAi(draftWithRunningRun),
      ),
    ).pipe(
      Effect.catch((error) =>
        mergeLatestDraft(ownerId, draft.id, (current) => failedAiRun(current, aiRun, error)).pipe(
          Effect.flatMap(() => Effect.fail(error)),
        ),
      ),
    );
    return yield* mergeLatestDraft(ownerId, draft.id, (current) => ({
      ...current,
      aiRuns: [
        ...current.aiRuns.filter((run) => run.id !== aiRun.id),
        appliedAiRun(aiRun, result.text, result.model, result.provider),
      ],
      courseContent: result.value,
      step: 'courseContent',
    }));
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

const assertWorkflowGate = (gate: ReturnType<typeof getWorkflowStepGate>) =>
  gate.allowed
    ? Effect.void
    : Effect.fail(new CoursitionStoreError({ message: gateFailureReason(gate) }));

const assertCourseContentGenerationReady = (draft: CourseDraft) => {
  if (!hasUsableSourceMaterial(draft)) {
    return Effect.fail(
      new CoursitionStoreError({ message: 'Add source material before continuing.' }),
    );
  }
  if (!hasCoursePreparation(draft)) {
    return Effect.fail(
      new CoursitionStoreError({ message: 'Complete course preparation before continuing.' }),
    );
  }
  if (!hasObjectiveMap(draft)) {
    return Effect.fail(
      new CoursitionStoreError({ message: 'Generate the objective map before continuing.' }),
    );
  }
  if (!hasActivityPlan(draft) || !hasPlayableGeneratedActivityCoverage(draft)) {
    return Effect.fail(
      new CoursitionStoreError({ message: 'Generate the activity plan before continuing.' }),
    );
  }
  return Effect.void;
};

const draftForStep = (draft: CourseDraft, step: CourseDraft['step']): CourseDraft => ({
  ...draft,
  findings: buildFindings(draft),
  step,
});

const workflowConfig = (): WorkflowSnapshot['config'] => {
  const config = sourceProviderConfig();
  return {
    aiProviderConfigured: isAiProviderConfigured(),
    auth: 'better-auth',
    deepgramConfigured: providerKeyConfigured(config.deepgramApiKey),
    llamaParseConfigured: providerKeyConfigured(config.llamaCloudApiKey),
    storage: configuredStoreBackend() === 'cloudflare' ? 'cloudflare-d1-r2' : 'json-file',
    webExtractionConfigured: isWebExtractionConfigured(),
  };
};

const snapshotFromOwnerState = (
  ownerState: OwnerDraftState,
  selectedDraftId?: string,
): WorkflowSnapshot => {
  const ownerDrafts = ownerState.drafts;
  return {
    config: workflowConfig(),
    draft:
      (selectedDraftId === undefined
        ? ownerDrafts[0]
        : ownerDrafts.find((draft) => draft.id === selectedDraftId)) ?? null,
    drafts: ownerDrafts.map(draftSummaryFor),
    revision: ownerState.revision,
  };
};

const snapshotForProgram = (ownerId: string, selectedDraftId?: string) =>
  Effect.gen(function* snapshotProgram() {
    let ownerState = yield* currentDraftRepository()
      .readOwnerState(ownerId)
      .pipe(Effect.mapError(toStoreError));
    const needsRecovery = ownerState.drafts.some(
      (draft) => recoveredDraft(draft, currentEpochMillis()) !== null,
    );
    if (needsRecovery) {
      yield* Effect.all(
        ownerState.drafts.map((draft) => recoverStaleRuns(ownerId, draft)),
        { concurrency: 1 },
      );
      ownerState = yield* currentDraftRepository()
        .readOwnerState(ownerId)
        .pipe(Effect.mapError(toStoreError));
    }
    return snapshotFromOwnerState(ownerState, selectedDraftId);
  });

const snapshotWith = (
  ownerId: string,
  draft: WorkflowSnapshot['draft'],
): Effect.Effect<WorkflowSnapshot, StoreError> =>
  snapshotForProgram(ownerId, draft?.id).pipe(
    Effect.map((snapshot) => (draft === null ? { ...snapshot, draft: null } : snapshot)),
  );

const snapshotForRouteProgram = (ownerId: string, draftId: string, step: CourseDraft['step']) =>
  Effect.gen(function* snapshotRouteProgram() {
    const snapshot = yield* snapshotForProgram(ownerId, draftId);
    const { draft } = snapshot;
    if (draft === null) {
      return yield* new CoursitionStoreError({
        message: 'Course draft not found for signed-in creator.',
      });
    }
    const draftWithFindings = draftForStep(draft, draft.step);
    const routeDraft = draftForStep(draftWithFindings, step);
    const gate =
      step === 'preview'
        ? getWorkflowPreviewGate(routeDraft, { blockOpenFindings: draft.mode !== 'generate' })
        : getWorkflowStepGate(draftWithFindings, step);
    if (!gate.allowed) {
      const fallbackStep = gate.blockedStep ?? 'mode';
      return { ...snapshot, draft: draftForStep(draft, fallbackStep) };
    }
    return { ...snapshot, draft: routeDraft };
  });

type DraftAction<K extends WorkflowAction['action']> = Extract<WorkflowAction, { action: K }>;
type OperationBackedAction = Extract<WorkflowAction, { operationId: string }>;
type DraftScopedAction = Exclude<
  WorkflowAction,
  { action: 'getState' | 'getRouteState' | 'createDraft' | 'selectDraft' | 'deleteDraft' }
>;
type WorkflowSnapshotEffect = Effect.Effect<
  WorkflowSnapshot,
  CoursitionStoreError | DraftRevisionConflict | Schema.SchemaError
>;

const isOperationBackedAction = (action: WorkflowAction): action is OperationBackedAction =>
  'operationId' in action;

const operationContextOrFail = (operation: OperationContext | undefined) =>
  operation === undefined
    ? Effect.fail(
        new CoursitionStoreError({ message: 'Workflow operation context is unavailable.' }),
      )
    : Effect.succeed(operation);

const assertExpectedRevision = (ownerId: string, draft: CourseDraft, expectedRevision: number) =>
  draft.revision === expectedRevision
    ? Effect.void
    : currentDraftRepository()
        .readOwnerState(ownerId)
        .pipe(
          Effect.mapError(toStoreError),
          Effect.flatMap((current) =>
            Effect.fail(
              new DraftRevisionConflict({
                current,
                draftId: draft.id,
                expectedRevision,
                ownerId,
              }),
            ),
          ),
        );

const reserveOperation = (ownerId: string, action: OperationBackedAction) =>
  Effect.gen(function* reserveOperationProgram() {
    const leaseToken = randomUuidV4();
    const requestFingerprint = yield* operationRequestFingerprint(action);
    return yield* currentDraftRepository().reserveOperation({
      action: action.action,
      ...('draftId' in action ? { draftId: action.draftId } : {}),
      ...('expectedRevision' in action ? { expectedRevision: action.expectedRevision } : {}),
      leaseDurationMs: operationLeaseDurationMs,
      leaseToken,
      operationId: action.operationId,
      ownerId,
      requestFingerprint,
    });
  }).pipe(Effect.mapError(toStoreError));

const failUncommittedOperation = (
  ownerId: string,
  action: OperationBackedAction,
  operation: OperationContext,
  error: unknown,
) =>
  operation.committed
    ? Effect.void
    : currentDraftRepository()
        .failOperation(
          ownerId,
          action.operationId,
          operation.commit.leaseToken,
          errorFailureReason(error),
        )
        .pipe(Effect.ignore);

const applyGoToStep = (
  ownerId: string,
  draft: CourseDraft,
  action: DraftAction<'goToStep'>,
  operation?: OperationContext,
): WorkflowSnapshotEffect =>
  Effect.gen(function* goToStepProgram() {
    const draftWithFindings = draftForStep(draft, draft.step);
    yield* assertWorkflowGate(getWorkflowStepGate(draftWithFindings, action.step));
    return yield* snapshotWith(
      ownerId,
      yield* saveDraft(draftForStep(draftWithFindings, action.step), operation),
    );
  });

const applyCreateDraft = (
  ownerId: string,
  action: DraftAction<'createDraft'>,
  operation: OperationContext,
): WorkflowSnapshotEffect =>
  Effect.gen(function* createDraftProgram() {
    const title = action.title.trim();
    if (title.length === 0) {
      return yield* new CoursitionStoreError({ message: 'Course title is required.' });
    }
    const createdAt = now();
    const draft = yield* saveDraft(
      {
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
        revision: 0,
        sourceProcessingIncomplete: false,
        sources: [],
        step: 'mode',
        title,
        updatedAt: createdAt,
      },
      operation,
    );
    return yield* snapshotWith(ownerId, draft);
  });

const applyDeleteDraft = (
  ownerId: string,
  draft: CourseDraft,
  action: DraftAction<'deleteDraft'>,
  operation: OperationContext,
): WorkflowSnapshotEffect =>
  Effect.gen(function* deleteDraftActionProgram() {
    const sourceCleanup = draft.sources.flatMap(cleanupForSource);
    yield* deleteDraft(ownerId, action.draftId, action.expectedRevision, operation, sourceCleanup);
    return yield* snapshotWith(ownerId, null);
  });

const applyUpdateDraftTitle = (
  ownerId: string,
  draft: CourseDraft,
  action: DraftAction<'updateDraftTitle'>,
): WorkflowSnapshotEffect =>
  saveDraft({ ...draft, title: action.title.trim() || draft.title }).pipe(
    Effect.flatMap((saved) => snapshotWith(ownerId, saved)),
  );

const applySetMode = (
  ownerId: string,
  draft: CourseDraft,
  action: DraftAction<'setMode'>,
): WorkflowSnapshotEffect =>
  Effect.gen(function* setModeProgram() {
    if (action.mode !== 'generate' && action.mode !== 'assist') {
      return yield* new CoursitionStoreError({ message: 'Unsupported course mode.' });
    }
    return yield* snapshotWith(ownerId, yield* saveDraft({ ...draft, mode: action.mode }));
  });

const applyGenerateCourse = (
  ownerId: string,
  draft: CourseDraft,
  operation: OperationContext,
): WorkflowSnapshotEffect =>
  Effect.gen(function* generateCourseProgram() {
    if (draft.mode !== 'generate') {
      return yield* new CoursitionStoreError({
        message: 'Course generation is only available in generate mode.',
      });
    }
    if (!hasUsableSourceMaterial(draft)) {
      return yield* new CoursitionStoreError({
        message: 'Add source material before generating the course.',
      });
    }
    const aiRun = createAiRun(draft, 'course_generation');
    const draftWithRunningRun = yield* saveDraft(
      { ...draft, aiRuns: [...draft.aiRuns, aiRun] },
      operation,
    );
    const courseDraft = yield* Effect.gen(function* generateFullCourse() {
      const plannedDraft = yield* runLearningPlanPhase(ownerId, draftWithRunningRun, {
        force: false,
        step: 'activityPlan',
      });
      const activityDraft = yield* runActivityPhase(ownerId, plannedDraft, { force: false });
      const activityDraftWithFindings = draftForStep(activityDraft, activityDraft.step);
      yield* assertCourseContentGenerationReady(activityDraftWithFindings);
      const contentDraft = yield* runCourseContentPhase(ownerId, activityDraft, { force: false });
      const runSummary = yield* courseGenerationSummary(contentDraft);
      return yield* mergeLatestDraft(ownerId, draft.id, (current) => ({
        ...current,
        aiRuns: [
          ...current.aiRuns.filter((run) => run.id !== aiRun.id),
          appliedAiRun(aiRun, runSummary, aiRun.model, aiRun.provider),
        ],
        step: 'preview' as const,
      }));
    }).pipe(
      Effect.matchEffect({
        onFailure: (error) =>
          mergeLatestDraft(ownerId, draft.id, (current) => failedAiRun(current, aiRun, error)),
        onSuccess: (saved) => Effect.succeed(saved),
      }),
    );
    return yield* snapshotWith(ownerId, courseDraft);
  });

const applyAddSource = (
  ownerId: string,
  draft: CourseDraft,
  action: DraftAction<'addSource'>,
  operation: OperationContext,
): WorkflowSnapshotEffect =>
  Effect.gen(function* addSourceProgram() {
    if (action.source.name.trim().length === 0) {
      return yield* new CoursitionStoreError({ message: 'Source name is required.' });
    }
    if (action.source.type !== 'file' && action.source.content.trim().length === 0) {
      return yield* new CoursitionStoreError({ message: 'Source content is required.' });
    }
    const source = yield* Effect.tryPromise({
      catch: toStoreError,
      try: () =>
        sourceProcessingRuntime.runPromise(
          processSource(
            {
              ...sourceProcessorDeps,
              deleteSourceBlob: (reference) =>
                deleteSourceBlobAfterRollback({ draftId: draft.id, ownerId, reference }).pipe(
                  Effect.mapError((cause) => new SourceProcessingError({ message: cause.message })),
                ),
            },
            draft.id,
            action.source,
          ),
        ),
    });
    const sources = [...draft.sources, source];
    const derived = documentsAndChunksForSource(source, source.createdAt ?? now());
    const timestamp = now();
    const saved = yield* saveDraft(
      withFinalFindings({
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
      operation,
    ).pipe(
      Effect.catch((error) =>
        typeof source.storageReference === 'string'
          ? deleteSourceBlobAfterRollback({
              draftId: draft.id,
              ownerId,
              reference: source.storageReference,
              sourceId: source.id,
            }).pipe(
              Effect.mapError((cause) => new CoursitionStoreError({ message: cause.message })),
              Effect.flatMap(() => Effect.fail(error)),
            )
          : Effect.fail(error),
      ),
    );
    return yield* snapshotWith(ownerId, saved);
  });

const applyDeleteSource = (
  ownerId: string,
  draft: CourseDraft,
  action: DraftAction<'deleteSource'>,
  operation: OperationContext,
): WorkflowSnapshotEffect =>
  Effect.gen(function* deleteSourceProgram() {
    const existingSource = draft.sources.find((source) => source.id === action.sourceId);
    if (existingSource === undefined || existingSource.status === 'deleted') {
      return yield* new CoursitionStoreError({
        message: 'Source is no longer available for deletion.',
      });
    }
    const sources = draft.sources.map((source) =>
      source.id === action.sourceId
        ? { ...source, deletedAt: now(), status: 'deleted' as const }
        : source,
    );
    return yield* snapshotWith(
      ownerId,
      yield* saveDraft(
        withFinalFindings({
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
        operation,
        cleanupForSource(existingSource),
      ),
    );
  });

const applyRetrySource = (
  ownerId: string,
  draft: CourseDraft,
  action: DraftAction<'retrySource'>,
  operation: OperationContext,
): WorkflowSnapshotEffect =>
  Effect.gen(function* retrySourceProgram() {
    const existingSource = draft.sources.find((source) => source.id === action.sourceId);
    if (existingSource === undefined || existingSource.status === 'deleted') {
      return yield* new CoursitionStoreError({
        message: 'Source not found for signed-in creator.',
      });
    }
    const filePayloadOption =
      existingSource.type === 'file'
        ? yield* loadFileSourcePayload(existingSource).pipe(Effect.mapError(toStoreError))
        : Option.none();
    if (
      existingSource.type === 'file' &&
      Option.isNone(filePayloadOption) &&
      existingSource.processor !== 'local_text'
    ) {
      return yield* new CoursitionStoreError({
        message: 'Original file bytes are not available for retry.',
      });
    }
    const filePayload = Option.getOrNull(filePayloadOption);
    const retriedSource = yield* Effect.tryPromise({
      catch: toStoreError,
      try: () =>
        sourceProcessingRuntime.runPromise(
          processSource(sourceProcessorDeps, draft.id, {
            content: existingSource.content,
            filePayload,
            name: existingSource.name,
            sizeLabel: existingSource.sizeLabel,
            sourceId: existingSource.id,
            storageReference: existingSource.storageReference,
            type: existingSource.type,
          }),
        ),
    });
    const replacementSource = retriedSource;
    const derived = documentsAndChunksForSource(
      replacementSource,
      replacementSource.createdAt ?? now(),
    );
    const sources = draft.sources.map((source) =>
      source.id === action.sourceId ? replacementSource : source,
    );
    return yield* snapshotWith(
      ownerId,
      yield* saveDraft(
        withFinalFindings({
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
        operation,
      ),
    );
  });

const applyRetryAiRun = (
  ownerId: string,
  draft: CourseDraft,
  action: DraftAction<'retryAiRun'>,
  operation: OperationContext,
): WorkflowSnapshotEffect =>
  Effect.gen(function* retryAiRunProgram() {
    const run = draft.aiRuns.find((candidate) => candidate.id === action.runId);
    if (run === undefined) {
      return yield* new CoursitionStoreError({
        message: 'AI run not found for signed-in creator.',
      });
    }
    if (run.status !== 'failed') {
      return yield* new CoursitionStoreError({ message: 'Only failed AI runs can be retried.' });
    }
    switch (run.type) {
      case 'course_generation': {
        if (draft.mode !== 'generate') {
          return yield* new CoursitionStoreError({
            message: 'Course generation is only available in generate mode.',
          });
        }
        if (!hasUsableSourceMaterial(draft)) {
          return yield* new CoursitionStoreError({
            message: 'Add source material before generating the course.',
          });
        }
        const plannedDraft = yield* runLearningPlanPhase(
          ownerId,
          draft,
          { force: false, step: 'activityPlan' },
          operation,
        );
        const activityDraft = yield* runActivityPhase(
          ownerId,
          plannedDraft,
          { force: false },
          operation,
        );
        const activityDraftWithFindings = draftForStep(activityDraft, activityDraft.step);
        yield* assertCourseContentGenerationReady(activityDraftWithFindings);
        const contentDraft = yield* runCourseContentPhase(
          ownerId,
          activityDraft,
          { force: false },
          operation,
        );
        return yield* snapshotWith(
          ownerId,
          yield* saveDraft(withFinalFindings({ ...contentDraft, step: 'preview' }), operation),
        );
      }
      case 'course_preparation_generation': {
        const nextDraft = yield* runCoursePreparationPhase(
          ownerId,
          draft,
          { force: true },
          operation,
        );
        return yield* snapshotWith(ownerId, nextDraft);
      }
      case 'learning_blueprint_generation': {
        const draftWithFindings = draftForStep(draft, draft.step);
        yield* assertWorkflowGate(getWorkflowStepGate(draftWithFindings, 'objectives'));
        const nextDraft = yield* runLearningPlanPhase(
          ownerId,
          draftWithFindings,
          { force: true, step: 'objectives' },
          operation,
        );
        return yield* snapshotWith(ownerId, nextDraft);
      }
      case 'activity_generation': {
        const draftWithFindings = draftForStep(draft, draft.step);
        yield* assertWorkflowGate(getWorkflowStepGate(draftWithFindings, 'activityPlan'));
        const nextDraft = yield* runActivityPhase(
          ownerId,
          draftWithFindings,
          { force: true },
          operation,
        );
        return yield* snapshotWith(ownerId, nextDraft);
      }
      case 'course_content_generation': {
        const draftWithFindings = draftForStep(draft, draft.step);
        yield* assertWorkflowGate(getWorkflowStepGate(draftWithFindings, 'courseContent'));
        const nextDraft = yield* runCourseContentPhase(
          ownerId,
          draftWithFindings,
          { force: true },
          operation,
        );
        return yield* snapshotWith(ownerId, nextDraft);
      }
      case 'teaching_quality_review': {
        return yield* new CoursitionStoreError({
          message: 'Teaching quality review runs are not retried by this workflow.',
        });
      }
      default: {
        const unsupportedRunType: never = run.type;
        return yield* new CoursitionStoreError({
          message: `Unsupported AI run type: ${unsupportedRunType}`,
        });
      }
    }
  });

const applyGenerateLearningBlueprint = (
  ownerId: string,
  draft: CourseDraft,
  operation: OperationContext,
): WorkflowSnapshotEffect =>
  Effect.gen(function* generateLearningBlueprintProgram() {
    const draftWithFindings = draftForStep(draft, draft.step);
    yield* assertWorkflowGate(getWorkflowStepGate(draftWithFindings, 'objectives'));
    const nextDraft = yield* runLearningPlanPhase(
      ownerId,
      draftWithFindings,
      { force: true, step: 'objectives' },
      operation,
    );
    return yield* snapshotWith(ownerId, nextDraft);
  });

const applyGenerateActivities = (
  ownerId: string,
  draft: CourseDraft,
  operation: OperationContext,
): WorkflowSnapshotEffect =>
  Effect.gen(function* generateActivitiesProgram() {
    const draftWithFindings = draftForStep(draft, draft.step);
    yield* assertWorkflowGate(getWorkflowStepGate(draftWithFindings, 'activityPlan'));
    const nextDraft = yield* runActivityPhase(
      ownerId,
      draftWithFindings,
      { force: true },
      operation,
    );
    return yield* snapshotWith(ownerId, nextDraft);
  });

const applyUpdateCoursePreparation = (
  ownerId: string,
  draft: CourseDraft,
  action: DraftAction<'updateCoursePreparation'>,
): WorkflowSnapshotEffect =>
  Effect.gen(function* updateCoursePreparationProgram() {
    const timestamp = now();
    const preparation = {
      ...action.preparation,
      language:
        action.preparation.languagePreference === 'source'
          ? action.preparation.language
          : action.preparation.languagePreference,
    };
    const nextBlueprint = staleLearningBlueprint(
      { ...draft.learningBlueprint, coursePreparation: preparation },
      timestamp,
    );
    const nextDraft = {
      ...draft,
      courseContent: staleCourseContent(draft.courseContent, timestamp),
      learningBlueprint: nextBlueprint,
      step: 'preparation' as const,
    };
    return yield* snapshotWith(
      ownerId,
      yield* saveDraft({ ...nextDraft, findings: buildFindings(nextDraft) }),
    );
  });

const applyUpdateLearningObjective = (
  ownerId: string,
  draft: CourseDraft,
  action: DraftAction<'updateLearningObjective'>,
): WorkflowSnapshotEffect =>
  Effect.gen(function* updateLearningObjectiveProgram() {
    if (
      !draft.learningBlueprint.objectives.some((objective) => objective.id === action.objectiveId)
    ) {
      return yield* new CoursitionStoreError({
        message: 'Learning objective is no longer available for editing.',
      });
    }
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
      brief.objectiveId === action.objectiveId || brief.objectiveIds.includes(action.objectiveId)
        ? { ...brief, status: staleStatusFor(brief.status), updatedAt: timestamp }
        : brief,
    );
    const nextGeneratedActivities = draft.learningBlueprint.generatedActivities.map((activity) =>
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
    const finalDraft = withFinalFindings({
      ...nextDraft,
      courseContent: staleCourseContent(nextDraft.courseContent, timestamp),
      step: 'objectives',
    });
    return yield* snapshotWith(ownerId, yield* saveDraft(finalDraft));
  });

const applyUpdateActivityBrief = (
  ownerId: string,
  draft: CourseDraft,
  action: DraftAction<'updateActivityBrief'>,
): WorkflowSnapshotEffect =>
  Effect.gen(function* updateActivityBriefProgram() {
    if (!draft.learningBlueprint.activityBriefs.some((brief) => brief.id === action.briefId)) {
      return yield* new CoursitionStoreError({
        message: 'Activity brief is no longer available for editing.',
      });
    }
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
    const nextGeneratedActivities = draft.learningBlueprint.generatedActivities.map((activity) =>
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
    const finalDraft = withFinalFindings({
      ...nextDraft,
      courseContent: staleCourseContent(nextDraft.courseContent, timestamp),
      step: 'activityPlan',
    });
    return yield* snapshotWith(ownerId, yield* saveDraft(finalDraft));
  });

const applyGenerateCourseContent = (
  ownerId: string,
  draft: CourseDraft,
  operation: OperationContext,
): WorkflowSnapshotEffect =>
  Effect.gen(function* generateCourseContentProgram() {
    const draftWithFindings = draftForStep(draft, draft.step);
    yield* assertWorkflowGate(getWorkflowStepGate(draftWithFindings, 'courseContent'));
    const nextDraft = yield* runCourseContentPhase(
      ownerId,
      draftWithFindings,
      { force: true },
      operation,
    );
    return yield* snapshotWith(ownerId, nextDraft);
  });

const applySetFindingStatus = (
  ownerId: string,
  draft: CourseDraft,
  action: DraftAction<'setFindingStatus'>,
): WorkflowSnapshotEffect =>
  Effect.gen(function* setFindingStatusProgram() {
    const currentFindings = buildFindings(draft);
    if (!currentFindings.some((finding) => finding.id === action.findingId)) {
      return yield* new CoursitionStoreError({
        message: 'Review finding is no longer available for updating.',
      });
    }
    return yield* snapshotWith(
      ownerId,
      yield* saveDraft({
        ...draft,
        findings: updateFindingStatus(currentFindings, action.findingId, action.status),
      }),
    );
  });

const applyOpenPreview = (ownerId: string, draft: CourseDraft): WorkflowSnapshotEffect =>
  Effect.gen(function* openPreviewProgram() {
    const previewDraft = { ...draft, findings: buildFindings(draft) };
    if (
      !getWorkflowPreviewGate(previewDraft, { blockOpenFindings: draft.mode !== 'generate' })
        .allowed
    ) {
      return yield* snapshotWith(
        ownerId,
        yield* saveDraft({
          ...previewDraft,
          step: draft.step === 'preview' ? 'courseContent' : draft.step,
        }),
      );
    }
    return yield* snapshotWith(ownerId, yield* saveDraft({ ...previewDraft, step: 'preview' }));
  });

const applyAdvanceDraft = (
  ownerId: string,
  storedDraft: CourseDraft,
  action: DraftAction<'advanceDraft'>,
  operation: OperationContext,
): WorkflowSnapshotEffect =>
  Effect.gen(function* advanceDraftProgram() {
    if (action.step === 'preview') {
      yield* assertWorkflowGate(getWorkflowPreviewGate(storedDraft));
      return yield* snapshotWith(ownerId, draftForStep(storedDraft, 'preview'));
    }

    yield* assertWorkflowGate(getWorkflowStepGate(storedDraft, action.step));
    const draft = draftForStep(storedDraft, action.step);

    if (draft.step === 'preview') {
      return yield* snapshotWith(ownerId, draft);
    }

    if (draft.step === 'mode') {
      return yield* applyGoToStep(
        ownerId,
        draft,
        {
          action: 'goToStep',
          draftId: action.draftId,
          expectedRevision: action.expectedRevision,
          operationId: action.operationId,
          step: 'sources',
        },
        operation,
      );
    }

    if (draft.mode === 'generate') {
      if (needsGeneratedCourseRefresh(draft)) {
        return yield* applyGenerateCourse(ownerId, draft, operation);
      }
      return yield* applyOpenPreview(ownerId, draft);
    }

    if (draft.step === 'sources') {
      yield* assertWorkflowGate(getWorkflowStepGate(draft, 'preparation'));
      const preparedDraft = needsCoursePreparation(draft)
        ? yield* runCoursePreparationPhase(ownerId, draft, { force: false }, operation)
        : yield* saveDraft(draftForStep(draft, 'preparation'), operation);
      return yield* snapshotWith(ownerId, preparedDraft);
    }

    if (draft.step === 'preparation') {
      yield* assertWorkflowGate(getWorkflowStepGate(draft, 'objectives'));
      const plannedDraft = needsLearningPlan(draft)
        ? yield* runLearningPlanPhase(
            ownerId,
            draftForStep(draft, 'preparation'),
            { force: false, step: 'objectives' },
            operation,
          )
        : yield* saveDraft(draftForStep(draft, 'objectives'), operation);
      return yield* snapshotWith(ownerId, plannedDraft);
    }

    if (draft.step === 'objectives') {
      yield* assertWorkflowGate(getWorkflowStepGate(draft, 'activityPlan'));
      const needsObjectiveRefresh =
        !hasObjectiveMap(draft) ||
        !hasActivityPlan(draft) ||
        draft.learningBlueprint.objectives.some((objective) => objective.status === 'stale');
      const plannedDraft = needsObjectiveRefresh
        ? yield* runLearningPlanPhase(
            ownerId,
            draftForStep(draft, 'objectives'),
            { force: false, step: 'objectives' },
            operation,
          )
        : draft;
      const activityDraft = needsActivities(plannedDraft)
        ? yield* runActivityPhase(ownerId, plannedDraft, { force: false }, operation)
        : yield* saveDraft(draftForStep(plannedDraft, 'activityPlan'), operation);
      return yield* snapshotWith(ownerId, draftForStep(activityDraft, 'activityPlan'));
    }

    if (draft.step === 'activityPlan') {
      const activityDraft = needsActivities(draft)
        ? yield* runActivityPhase(ownerId, draft, { force: false }, operation)
        : draft;
      yield* assertWorkflowGate(getWorkflowStepGate(activityDraft, 'courseContent'));
      const contentDraft = needsCourseContent(activityDraft)
        ? yield* runCourseContentPhase(ownerId, activityDraft, { force: false }, operation)
        : yield* saveDraft(draftForStep(activityDraft, 'courseContent'), operation);
      return yield* snapshotWith(ownerId, draftForStep(contentDraft, 'courseContent'));
    }

    if (draft.step === 'courseContent') {
      const contentDraft = needsCourseContent(draft)
        ? yield* runCourseContentPhase(ownerId, draft, { force: false }, operation)
        : draft;
      return yield* applyOpenPreview(ownerId, contentDraft);
    }

    return yield* new CoursitionStoreError({ message: 'Unsupported workflow step.' });
  });

const applyDraftAction = (
  ownerId: string,
  action: DraftScopedAction,
  operation?: OperationContext,
): WorkflowSnapshotEffect =>
  Effect.gen(function* draftActionProgram() {
    const draft = yield* requireDraft(ownerId, action.draftId);
    yield* assertExpectedRevision(ownerId, draft, action.expectedRevision);
    switch (action.action) {
      case 'advanceDraft': {
        return yield* applyAdvanceDraft(
          ownerId,
          draft,
          action,
          yield* operationContextOrFail(operation),
        );
      }
      case 'updateDraftTitle': {
        return yield* applyUpdateDraftTitle(ownerId, draft, action);
      }
      case 'goToStep': {
        return yield* applyGoToStep(
          ownerId,
          draft,
          action,
          yield* operationContextOrFail(operation),
        );
      }
      case 'setMode': {
        return yield* applySetMode(ownerId, draft, action);
      }
      case 'generateCourse': {
        return yield* applyGenerateCourse(ownerId, draft, yield* operationContextOrFail(operation));
      }
      case 'addSource': {
        return yield* applyAddSource(
          ownerId,
          draft,
          action,
          yield* operationContextOrFail(operation),
        );
      }
      case 'deleteSource': {
        return yield* applyDeleteSource(
          ownerId,
          draft,
          action,
          yield* operationContextOrFail(operation),
        );
      }
      case 'retrySource': {
        return yield* applyRetrySource(
          ownerId,
          draft,
          action,
          yield* operationContextOrFail(operation),
        );
      }
      case 'retryAiRun': {
        return yield* applyRetryAiRun(
          ownerId,
          draft,
          action,
          yield* operationContextOrFail(operation),
        );
      }
      case 'generateLearningBlueprint': {
        return yield* applyGenerateLearningBlueprint(
          ownerId,
          draft,
          yield* operationContextOrFail(operation),
        );
      }
      case 'generateActivities': {
        return yield* applyGenerateActivities(
          ownerId,
          draft,
          yield* operationContextOrFail(operation),
        );
      }
      case 'updateCoursePreparation': {
        return yield* applyUpdateCoursePreparation(ownerId, draft, action);
      }
      case 'updateLearningObjective': {
        return yield* applyUpdateLearningObjective(ownerId, draft, action);
      }
      case 'updateActivityBrief': {
        return yield* applyUpdateActivityBrief(ownerId, draft, action);
      }
      case 'generateCourseContent': {
        return yield* applyGenerateCourseContent(
          ownerId,
          draft,
          yield* operationContextOrFail(operation),
        );
      }
      case 'setFindingStatus': {
        return yield* applySetFindingStatus(ownerId, draft, action);
      }
      case 'openPreview': {
        return yield* applyOpenPreview(ownerId, draft);
      }
      default: {
        const unsupportedAction: never = action;
        return yield* new CoursitionStoreError({
          message: `Unsupported workflow action: ${String(unsupportedAction)}`,
        });
      }
    }
  });

const applyWorkflowActionProgram = (
  ownerId: string,
  action: WorkflowAction,
): WorkflowSnapshotEffect =>
  Effect.gen(function* dispatchProgram() {
    if (isOperationBackedAction(action)) {
      const reservation = yield* reserveOperation(ownerId, action);
      if (reservation.kind === 'committed' || reservation.kind === 'pending') {
        return yield* snapshotForProgram(ownerId, 'draftId' in action ? action.draftId : undefined);
      }
      if (reservation.kind === 'failed') {
        return yield* new CoursitionStoreError({
          message:
            reservation.operation.failureCode ??
            'The previous workflow operation failed and must be retried explicitly.',
        });
      }
      const operation: OperationContext = {
        commit: {
          leaseToken: reservation.operation.leaseToken,
          operationId: reservation.operation.operationId,
        },
        committed: false,
      };
      const program = Effect.gen(function* acquiredOperationProgram() {
        if (action.action === 'createDraft') {
          return yield* applyCreateDraft(ownerId, action, operation);
        }
        const draft = yield* requireDraft(ownerId, action.draftId);
        yield* assertExpectedRevision(ownerId, draft, action.expectedRevision);
        if (action.action === 'deleteDraft') {
          return yield* applyDeleteDraft(ownerId, draft, action, operation);
        }
        return yield* applyDraftAction(ownerId, action, operation);
      });
      return yield* program.pipe(
        Effect.tapError((error) => failUncommittedOperation(ownerId, action, operation, error)),
      );
    }
    switch (action.action) {
      case 'getState': {
        yield* ensureDefaultDraftsForOwner(ownerId);
        return yield* snapshotForProgram(ownerId);
      }
      case 'getRouteState': {
        return yield* snapshotForRouteProgram(ownerId, action.draftId, action.step);
      }
      case 'selectDraft': {
        return yield* snapshotWith(ownerId, yield* requireDraft(ownerId, action.draftId));
      }
      default: {
        return yield* applyDraftAction(ownerId, action);
      }
    }
  });

export const snapshotFor = (ownerId: string): Promise<WorkflowSnapshot> =>
  Effect.runPromise(
    ensureDefaultDraftsForOwner(ownerId).pipe(Effect.flatMap(() => snapshotForProgram(ownerId))),
  );

export const snapshotForRoute = (
  ownerId: string,
  draftId: string,
  step: CourseDraft['step'],
): Promise<WorkflowSnapshot> => Effect.runPromise(snapshotForRouteProgram(ownerId, draftId, step));

const workflowActionEffect = (ownerId: string, action: WorkflowAction) =>
  applyWorkflowActionProgram(ownerId, action).pipe(
    Effect.catchTag('DraftRevisionConflict', (conflict) => {
      const currentDraft = conflict.current.drafts.find((draft) => draft.id === conflict.draftId);
      return Effect.fail(
        new CoursitionWorkflowConflict({
          currentRevision: currentDraft?.revision ?? conflict.expectedRevision,
          currentSnapshot: snapshotFromOwnerState(conflict.current, conflict.draftId),
          draftId: conflict.draftId,
          expectedRevision: conflict.expectedRevision,
          message: 'The course changed in another request. Current data was restored.',
        }),
      );
    }),
  );

export const applyWorkflowAction = (
  ownerId: string,
  action: WorkflowAction,
): Promise<WorkflowSnapshot> => Effect.runPromise(workflowActionEffect(ownerId, action));

export const applyWorkflowActionWithCleanup = (
  ownerId: string,
  action: WorkflowAction,
): Promise<WorkflowSnapshot> =>
  Effect.runPromise(
    workflowActionEffect(ownerId, action).pipe(
      Effect.tap(() =>
        Effect.tryPromise({
          catch: toStoreError,
          try: () => drainPendingSourceCleanup(),
        }).pipe(Effect.exit, Effect.asVoid),
      ),
    ),
  );
