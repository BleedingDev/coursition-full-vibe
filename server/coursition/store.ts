import * as NodeCrypto from '@effect/platform-node/NodeCrypto';
import * as NodeFileSystem from '@effect/platform-node/NodeFileSystem';
import { Crypto, Data, DateTime, Effect, FileSystem, Option, Schema, Semaphore } from 'effect';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import { FetchHttpClient } from 'effect/unstable/http';
import {
  courseContentSchema,
  courseDraftSchema,
  learningBlueprintSchema,
} from '../../shared/coursition/effect-api.ts';
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
  LearningObjective,
  SourceAsset,
  WorkflowAction,
  WorkflowSnapshot,
} from '../../shared/coursition/workflow.ts';
import {
  failedActivityFromBrief,
  generateActivityWithAi,
  generateCourseContentWithAi,
  generateCoursePreparationWithAi,
  generateLearningPlanWithAi,
  isAiProviderConfigured,
} from './ai-provider.ts';
import { loadCoursitionSourceProviderConfig, providerKeyConfigured } from './config.ts';
import {
  isWebExtractionConfigured,
  processSource,
  SourceProcessingError,
} from './source-processing.ts';
import type { SourceProcessorDeps } from './source-processing.ts';
import defaultSeedStoreJson from './default-seed.json' with { type: 'json' };

interface StoreFile {
  defaultSeededOwnerIds?: string[];
  defaultSeedVersion?: string;
  drafts: CourseDraft[];
}

const storeFileSchema = Schema.Struct({
  defaultSeedVersion: Schema.optional(Schema.String),
  defaultSeededOwnerIds: Schema.optional(Schema.Array(Schema.String)),
  drafts: Schema.Array(courseDraftSchema),
});
const storeFileJsonSchema = Schema.fromJsonString(storeFileSchema);
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

type StoreError = CoursitionStoreError;

const toStoreError = (cause: unknown): CoursitionStoreError =>
  cause instanceof CoursitionStoreError
    ? cause
    : new CoursitionStoreError({
        message:
          cause instanceof Error && cause.message.trim().length > 0
            ? cause.message.trim()
            : 'Course draft storage failed.',
      });

// One permit serializes all store writes, replacing the hand-rolled promise queue.
const storeMutationSemaphore = Semaphore.makeUnsafe(1);

const now = () => DateTime.formatIso(DateTime.nowUnsafe());
const cryptoRuntime = ManagedRuntime.make(NodeCrypto.layer);
const sourceProcessingRuntime = ManagedRuntime.make(FetchHttpClient.layer);
const storeRuntime = ManagedRuntime.make(NodeFileSystem.layer);
const randomUuidV4 = () =>
  cryptoRuntime.runSync(
    Effect.gen(function* randomUuidV4Program() {
      const crypto = yield* Crypto.Crypto;
      return yield* crypto.randomUUIDv4;
    }),
  );
const createId = (prefix: string) => `${prefix}_${randomUuidV4()}`;
const sourceProviderConfig = () => loadCoursitionSourceProviderConfig();

/*
 * Persistence seam. All durable state for the Course Draft store lives behind a
 * StoreBackend: the JSON-file adapter is used in production, and the in-memory
 * adapter lets callers and tests exercise the full workflow with no disk and no
 * process.chdir. Two adapters, one interface.
 */
interface StoreBackend {
  read(): Effect.Effect<StoreFile, StoreError, FileSystem.FileSystem>;
  readSourceBlob(
    reference: string | undefined,
  ): Effect.Effect<Option.Option<Uint8Array>, CoursitionStoreError, FileSystem.FileSystem>;
  write(store: StoreFile): Effect.Effect<void, StoreError, FileSystem.FileSystem>;
  writeSourceBlob(
    draftId: string,
    sourceId: string,
    bytes: Uint8Array,
  ): Effect.Effect<string, CoursitionStoreError, FileSystem.FileSystem>;
}

const emptyStoreFile = (): StoreFile => ({ drafts: [] });

const storeFileFromSchema = (store: Schema.Schema.Type<typeof storeFileSchema>): StoreFile => ({
  ...('defaultSeededOwnerIds' in store && Array.isArray(store.defaultSeededOwnerIds)
    ? { defaultSeededOwnerIds: [...store.defaultSeededOwnerIds] }
    : {}),
  ...('defaultSeedVersion' in store && typeof store.defaultSeedVersion === 'string'
    ? { defaultSeedVersion: store.defaultSeedVersion }
    : {}),
  drafts: [...store.drafts],
});

const defaultSeedVersion = '2026-06-07-pdf-showcase-v1';

const defaultSeedStore = storeFileFromSchema(
  Schema.decodeUnknownSync(storeFileSchema)(defaultSeedStoreJson),
);

const decodeStoreFile = (content: string) =>
  Schema.decodeUnknownEffect(storeFileJsonSchema)(content).pipe(
    Effect.mapError(
      (schemaError) =>
        new CoursitionStoreError({
          message: 'Stored course draft data does not match the current schema.',
          schemaError,
        }),
    ),
    Effect.map(storeFileFromSchema),
  );

const serializeStoreFile = (store: StoreFile) =>
  Schema.encodeEffect(storeFileJsonSchema)(store).pipe(
    Effect.mapError(
      (schemaError) =>
        new CoursitionStoreError({
          message: 'Course draft data cannot be encoded with the current schema.',
          schemaError,
        }),
    ),
  );

const sourceAssetStorageReferencePrefix = 'json-file:source-assets/';

const sourceAssetStorageReferenceFor = (draftId: string, sourceId: string) =>
  `${sourceAssetStorageReferencePrefix}${draftId}/${sourceId}.bin`;

const sourceAssetRelativePath = (reference: string | undefined) => {
  if (typeof reference !== 'string' || !reference.startsWith(sourceAssetStorageReferencePrefix)) {
    return null;
  }
  const relativePath = reference.slice('json-file:'.length);
  return /^[\w-]+\/[\w-]+\.bin$/u.test(relativePath.replace(/^source-assets\//u, ''))
    ? relativePath
    : null;
};

export const jsonFileStoreBackend = (rootDirectory: string): StoreBackend => {
  const storeFilePath = `${rootDirectory}/workflow.json`;
  return {
    read: () =>
      Effect.gen(function* readStoreProgram() {
        const fs = yield* FileSystem.FileSystem;
        const exists = yield* fs.exists(storeFilePath).pipe(Effect.mapError(toStoreError));
        if (!exists) {
          return emptyStoreFile();
        }
        const content = yield* fs.readFileString(storeFilePath).pipe(Effect.mapError(toStoreError));
        return yield* decodeStoreFile(content);
      }),
    readSourceBlob: (reference) =>
      Effect.gen(function* readSourceBlobProgram() {
        const relativePath = sourceAssetRelativePath(reference);
        if (relativePath === null) {
          return Option.none();
        }
        const fs = yield* FileSystem.FileSystem;
        const bytes = yield* fs.readFile(`${rootDirectory}/${relativePath}`);
        return Option.some(bytes);
      }).pipe(Effect.mapError(toStoreError)),
    write: (store) =>
      Effect.gen(function* writeStoreProgram() {
        const fs = yield* FileSystem.FileSystem;
        yield* fs
          .makeDirectory(rootDirectory, { recursive: true })
          .pipe(Effect.mapError(toStoreError));
        const temporaryPath = `${storeFilePath}.${randomUuidV4()}.tmp`;
        const content = yield* serializeStoreFile(store);
        yield* fs.writeFileString(temporaryPath, content).pipe(Effect.mapError(toStoreError));
        yield* fs.rename(temporaryPath, storeFilePath).pipe(Effect.mapError(toStoreError));
      }),
    writeSourceBlob: (draftId, sourceId, bytes) =>
      Effect.gen(function* writeSourceBlobProgram() {
        const reference = sourceAssetStorageReferenceFor(draftId, sourceId);
        const relativePath = sourceAssetRelativePath(reference);
        if (relativePath === null) {
          return yield* new CoursitionStoreError({
            message: 'Invalid source asset storage reference.',
          });
        }
        const fs = yield* FileSystem.FileSystem;
        yield* fs.makeDirectory(`${rootDirectory}/source-assets/${draftId}`, { recursive: true });
        yield* fs.writeFile(`${rootDirectory}/${relativePath}`, bytes);
        return reference;
      }).pipe(Effect.mapError(toStoreError)),
  };
};

const cloneStoreFile = (store: StoreFile): StoreFile => structuredClone(store);

const inMemoryStoreBackend = (): StoreBackend => {
  const blobs = new Map<string, Uint8Array>();
  let storeFile: StoreFile = { drafts: [] };
  return {
    read: () => Effect.sync(() => cloneStoreFile(storeFile)),
    readSourceBlob: (reference) =>
      Effect.sync(() =>
        typeof reference === 'string' ? Option.fromNullishOr(blobs.get(reference)) : Option.none(),
      ),
    write: (store) =>
      Effect.sync(() => {
        storeFile = cloneStoreFile(store);
      }),
    writeSourceBlob: (draftId, sourceId, bytes) =>
      Effect.sync(() => {
        const reference = sourceAssetStorageReferenceFor(draftId, sourceId);
        blobs.set(reference, bytes);
        return reference;
      }),
  };
};

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

let activeBackend: StoreBackend =
  configuredStoreBackend() === 'memory'
    ? inMemoryStoreBackend()
    : jsonFileStoreBackend(configuredDataDirectory());
let activeBackendSeedsDefaults = true;

export const setStoreBackend = (backend: StoreBackend) => {
  activeBackend = backend;
  activeBackendSeedsDefaults = false;
};

export const resetStoreBackend = () => {
  activeBackend = jsonFileStoreBackend(configuredDataDirectory());
  activeBackendSeedsDefaults = true;
};

export { inMemoryStoreBackend };
export type { StoreBackend };

const readStore = () => activeBackend.read();

const writeStore = (store: StoreFile) => activeBackend.write(store);

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
  defaultSeedStore.drafts.map((draft, index) => {
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
  activeBackend.readSourceBlob(source.storageReference).pipe(
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
  newSourceId: (draftId) => createId(`source_${draftId}`),
  now,
  writeSourceBlob: (draftId, sourceId, bytes) =>
    Effect.tryPromise({
      catch: (cause) =>
        new SourceProcessingError({
          message: cause instanceof Error ? cause.message : 'Failed to store source asset bytes.',
        }),
      try: () => storeRuntime.runPromise(activeBackend.writeSourceBlob(draftId, sourceId, bytes)),
    }),
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

const withStoreMutation = storeMutationSemaphore.withPermits(1);

const ensureDefaultDraftsForOwner = (ownerId: string) => {
  if (!activeBackendSeedsDefaults) {
    return Effect.void;
  }
  return withStoreMutation(
    Effect.gen(function* ensureDefaultDraftsProgram() {
      const store = yield* readStore();
      const seededOwnerIds = store.defaultSeededOwnerIds ?? [];
      if (
        seededOwnerIds.includes(ownerId) ||
        store.drafts.some((draft) => draft.ownerId === ownerId)
      ) {
        return;
      }
      yield* writeStore({
        ...store,
        defaultSeedVersion,
        defaultSeededOwnerIds: [...seededOwnerIds, ownerId],
        drafts: [...store.drafts, ...seedDraftsForOwner(ownerId)],
      });
    }),
  );
};

const saveDraft = (draft: CourseDraft) =>
  withStoreMutation(
    Effect.gen(function* saveDraftProgram() {
      const store = yield* readStore();
      const nextDraft = { ...draft, updatedAt: now() };
      const draftIndex = store.drafts.findIndex((candidate) => candidate.id === draft.id);
      if (draftIndex === -1) {
        store.drafts.push(nextDraft);
      } else {
        store.drafts[draftIndex] = nextDraft;
      }
      yield* writeStore(store);
      return nextDraft;
    }),
  );

const requireDraft = (ownerId: string, draftId: string) =>
  Effect.gen(function* requireDraftProgram() {
    const store = yield* readStore();
    const draft = store.drafts.find(
      (candidate) => candidate.id === draftId && candidate.ownerId === ownerId,
    );
    if (draft === undefined) {
      return yield* new CoursitionStoreError({
        message: 'Course draft not found for signed-in creator.',
      });
    }
    return draft;
  });

export const draftForOwner = (ownerId: string, draftId: string): Promise<CourseDraft> =>
  storeRuntime.runPromise(requireDraft(ownerId, draftId));

const deleteDraft = (ownerId: string, draftId: string) =>
  withStoreMutation(
    Effect.gen(function* deleteDraftProgram() {
      const store = yield* readStore();
      const draftIndex = store.drafts.findIndex(
        (candidate) => candidate.id === draftId && candidate.ownerId === ownerId,
      );
      if (draftIndex === -1) {
        return yield* new CoursitionStoreError({
          message: 'Course draft not found for signed-in creator.',
        });
      }
      store.drafts.splice(draftIndex, 1);
      yield* writeStore(store);
    }),
  );

const latestDraft = (ownerId: string) =>
  readStore().pipe(
    Effect.map((store) =>
      Option.fromNullishOr(
        store.drafts
          .filter((candidate) => candidate.ownerId === ownerId)
          .toSorted((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0],
      ),
    ),
  );

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
  Effect.gen(function* draftSummariesForProgram() {
    const store = yield* readStore();
    return store.drafts
      .filter((candidate) => candidate.ownerId === ownerId)
      .toSorted((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map(draftSummaryFor);
  });

const sourceProcessingIncomplete = (sources: SourceAsset[]) =>
  sources.some((source) => source.status === 'queued' || source.status === 'processing');

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

const activityRunSummary = (generatedCount: number, failedCount: number, totalCount: number) =>
  Schema.encodeEffect(activityRunSummaryJsonSchema)({ failedCount, generatedCount, totalCount });

const courseGenerationSummary = (draft: CourseDraft) =>
  Schema.encodeEffect(courseGenerationSummaryJsonSchema)({
    content: draft.courseContent,
    learningBlueprint: draft.learningBlueprint,
  });

const saveGeneratedActivity = (ownerId: string, draftId: string, activity: GeneratedActivity) =>
  Effect.gen(function* saveGeneratedActivityProgram() {
    const currentDraft = yield* requireDraft(ownerId, draftId);
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
    return yield* saveDraft({ ...nextDraft, findings: buildFindings(nextDraft) });
  });

const generateAndSaveActivity = (ownerId: string, draft: CourseDraft, brief: ActivityBrief) =>
  Effect.gen(function* generateAndSaveActivityProgram() {
    const objective = objectiveForBrief(draft, brief);
    if (objective === undefined) {
      const activity = failedActivityFromBrief(
        brief,
        `No learning objective was found for activity brief: ${brief.title}.`,
      );
      yield* saveGeneratedActivity(ownerId, draft.id, activity);
      return activity;
    }
    const activity = yield* aiGeneration(() =>
      generateActivityWithAi(draft, objective, brief),
    ).pipe(
      Effect.match({
        onFailure: (error) => failedActivityFromBrief(brief, error.message),
        onSuccess: (result) => result.value,
      }),
    );
    yield* saveGeneratedActivity(ownerId, draft.id, activity);
    return activity;
  });

const runLearningPlanPhase = (
  draft: CourseDraft,
  options: { force: boolean; step: CourseDraft['step'] },
) =>
  Effect.gen(function* runLearningPlanPhaseProgram() {
    if (!options.force && !needsLearningPlan(draft)) {
      return draft;
    }
    const aiRun = createAiRun(draft, 'learning_blueprint_generation');
    const draftWithRunningRun = yield* saveDraft({ ...draft, aiRuns: [...draft.aiRuns, aiRun] });
    const result = yield* aiGeneration(() => generateLearningPlanWithAi(draftWithRunningRun)).pipe(
      Effect.tapError((error) => saveDraft(failedAiRun(draftWithRunningRun, aiRun, error))),
    );
    const nextDraft: CourseDraft = {
      ...draftWithRunningRun,
      aiRuns: [
        ...draftWithRunningRun.aiRuns.filter((run) => run.id !== aiRun.id),
        appliedAiRun(aiRun, result.text, result.model, result.provider),
      ],
      courseContent: staleCourseContent(draftWithRunningRun.courseContent, now()),
      learningBlueprint: result.value,
      step: options.step,
    };
    return yield* saveDraft({
      ...nextDraft,
      findings: buildFindings({ ...nextDraft, findings: [] }),
    });
  });

const runCoursePreparationPhase = (draft: CourseDraft, options: { force: boolean }) =>
  Effect.gen(function* runCoursePreparationPhaseProgram() {
    if (!options.force && !needsCoursePreparation(draft)) {
      return draft;
    }
    const aiRun = createAiRun(draft, 'course_preparation_generation');
    const draftWithRunningRun = yield* saveDraft({ ...draft, aiRuns: [...draft.aiRuns, aiRun] });
    const result = yield* aiGeneration(() =>
      generateCoursePreparationWithAi(draftWithRunningRun),
    ).pipe(Effect.tapError((error) => saveDraft(failedAiRun(draftWithRunningRun, aiRun, error))));
    const timestamp = now();
    const nextBlueprint = staleLearningBlueprint(
      {
        ...draftWithRunningRun.learningBlueprint,
        assumptions: result.value.assumptions,
        coursePreparation: result.value.coursePreparation,
      },
      timestamp,
    );
    const nextDraft: CourseDraft = {
      ...draftWithRunningRun,
      aiRuns: [
        ...draftWithRunningRun.aiRuns.filter((run) => run.id !== aiRun.id),
        appliedAiRun(aiRun, result.text, result.model, result.provider),
      ],
      courseContent: staleCourseContent(draftWithRunningRun.courseContent, timestamp),
      learningBlueprint: nextBlueprint,
      step: 'preparation',
    };
    return yield* saveDraft({
      ...nextDraft,
      findings: buildFindings({ ...nextDraft, findings: [] }),
    });
  });

const runActivityPhase = (ownerId: string, draft: CourseDraft, options: { force: boolean }) =>
  Effect.gen(function* runActivityPhaseProgram() {
    if (!options.force && !needsActivities(draft)) {
      return draft;
    }
    const aiRun = createAiRun(draft, 'activity_generation');
    const draftWithRunningRun = yield* saveDraft({ ...draft, aiRuns: [...draft.aiRuns, aiRun] });
    const briefs = pendingActivityBriefs(draftWithRunningRun, options);
    const activityResults = yield* Effect.all(
      briefs.map((brief) => generateAndSaveActivity(ownerId, draftWithRunningRun, brief)),
      { concurrency: 'unbounded' },
    );
    const activityPhaseDraft = yield* requireDraft(ownerId, draft.id);
    const generatedCount = activityResults.filter(isPlayableGeneratedActivity).length;
    const failedCount = activityResults.length - generatedCount;
    const runSummary = yield* activityRunSummary(
      generatedCount,
      failedCount,
      activityResults.length,
    );
    if (generatedCount === 0 && failedCount > 0) {
      const message = `Activity generation failed for all ${failedCount} activity briefs.`;
      yield* saveDraft(
        failedAiRun(
          {
            ...activityPhaseDraft,
            findings: buildFindings({ ...activityPhaseDraft, findings: [] }),
            step: 'activityPlan',
          },
          aiRun,
          new CoursitionStoreError({ message }),
        ),
      );
      return yield* new CoursitionStoreError({ message });
    }
    const nextDraft: CourseDraft = {
      ...activityPhaseDraft,
      aiRuns: [
        ...activityPhaseDraft.aiRuns.filter((run) => run.id !== aiRun.id),
        appliedAiRun(aiRun, runSummary, aiRun.model, aiRun.provider),
      ],
      findings: buildFindings({ ...activityPhaseDraft, findings: [] }),
      step: 'activityPlan',
    };
    return yield* saveDraft(nextDraft);
  });

const runCourseContentPhase = (draft: CourseDraft, options: { force: boolean }) =>
  Effect.gen(function* runCourseContentPhaseProgram() {
    if (!options.force && !needsCourseContent(draft)) {
      return draft;
    }
    const aiRun = createAiRun(draft, 'course_content_generation');
    const draftWithRunningRun = yield* saveDraft({ ...draft, aiRuns: [...draft.aiRuns, aiRun] });
    const result = yield* aiGeneration(() => generateCourseContentWithAi(draftWithRunningRun)).pipe(
      Effect.tapError((error) => saveDraft(failedAiRun(draftWithRunningRun, aiRun, error))),
    );
    const nextDraft = {
      ...draftWithRunningRun,
      aiRuns: [
        ...draftWithRunningRun.aiRuns.filter((run) => run.id !== aiRun.id),
        appliedAiRun(aiRun, result.text, result.model, result.provider),
      ],
      courseContent: result.value,
      step: 'courseContent' as const,
    };
    return yield* saveDraft({
      ...nextDraft,
      findings: buildFindings({ ...nextDraft, findings: [] }),
    });
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

const snapshotForProgram = (ownerId: string) =>
  Effect.gen(function* snapshotProgram() {
    const config = sourceProviderConfig();
    return {
      config: {
        aiProviderConfigured: isAiProviderConfigured(),
        auth: 'better-auth' as const,
        deepgramConfigured: providerKeyConfigured(config.deepgramApiKey),
        llamaParseConfigured: providerKeyConfigured(config.llamaCloudApiKey),
        storage: 'json-file' as const,
        webExtractionConfigured: isWebExtractionConfigured(),
      },
      draft: Option.getOrNull(yield* latestDraft(ownerId)),
      drafts: yield* draftSummariesFor(ownerId),
    };
  });

// Returns the post-mutation snapshot with the acted-on draft attached. Callers
// run their mutation first, so the drafts list always reflects the new state.
const snapshotWith = (
  ownerId: string,
  draft: WorkflowSnapshot['draft'],
): Effect.Effect<WorkflowSnapshot, StoreError, FileSystem.FileSystem> =>
  snapshotForProgram(ownerId).pipe(Effect.map((snapshot) => ({ ...snapshot, draft })));

const snapshotForRouteProgram = (ownerId: string, draftId: string, step: CourseDraft['step']) =>
  Effect.gen(function* snapshotRouteProgram() {
    const draft = yield* requireDraft(ownerId, draftId);
    const draftWithFindings = draftForStep(draft, draft.step);
    const routeDraft = draftForStep(draftWithFindings, step);
    const gate =
      step === 'preview'
        ? getWorkflowPreviewGate(routeDraft, { blockOpenFindings: draft.mode !== 'generate' })
        : getWorkflowStepGate(draftWithFindings, step);
    if (!gate.allowed) {
      const fallbackStep = gate.blockedStep ?? 'mode';
      return yield* snapshotWith(ownerId, draftForStep(draft, fallbackStep));
    }
    return yield* snapshotWith(ownerId, routeDraft);
  });

type DraftAction<K extends WorkflowAction['action']> = Extract<WorkflowAction, { action: K }>;
type DraftScopedAction = Exclude<
  WorkflowAction,
  { action: 'getState' | 'createDraft' | 'selectDraft' | 'deleteDraft' }
>;
type WorkflowSnapshotEffect = Effect.Effect<
  WorkflowSnapshot,
  CoursitionStoreError | Schema.SchemaError,
  FileSystem.FileSystem
>;

interface StepTransition {
  readonly from: CourseDraft['step'];
  readonly to: CourseDraft['step'];
  readonly ready: (draft: CourseDraft) => boolean;
  readonly advance: (
    ownerId: string,
    draft: CourseDraft,
  ) => Effect.Effect<CourseDraft, CoursitionStoreError | Schema.SchemaError, FileSystem.FileSystem>;
}

// Assist-mode auto-advance: navigating to a step whose phase has not run yet
// generates it on the way. The double-phase activity->content jump is handled
// inline in applyGoToStep because it must run before the destination gate.
const assistStepTransitions: readonly StepTransition[] = [
  {
    advance: (ownerId, draft) => runCoursePreparationPhase(draft, { force: false }),
    from: 'sources',
    ready: (draft) => hasUsableSourceMaterial(draft) && needsCoursePreparation(draft),
    to: 'preparation',
  },
  {
    advance: (ownerId, draft) => runLearningPlanPhase(draft, { force: false, step: 'objectives' }),
    from: 'preparation',
    ready: (draft) =>
      hasUsableSourceMaterial(draft) && hasCoursePreparation(draft) && needsLearningPlan(draft),
    to: 'objectives',
  },
  {
    advance: (ownerId, draft) =>
      runActivityPhase(ownerId, draft, { force: false }).pipe(
        Effect.map((next) => draftForStep(next, 'activityPlan')),
      ),
    from: 'objectives',
    ready: (draft) => hasObjectiveMap(draft) && needsActivities(draft),
    to: 'activityPlan',
  },
  {
    advance: (ownerId, draft) =>
      runCourseContentPhase(draft, { force: false }).pipe(
        Effect.map((next) => draftForStep(next, 'courseContent')),
      ),
    from: 'activityPlan',
    ready: (draft) => !needsActivities(draft) && needsCourseContent(draft),
    to: 'courseContent',
  },
];

const applyGoToStep = (
  ownerId: string,
  draft: CourseDraft,
  action: DraftAction<'goToStep'>,
): WorkflowSnapshotEffect =>
  Effect.gen(function* goToStepProgram() {
    const draftWithFindings = draftForStep(draft, draft.step);
    if (
      action.step === 'courseContent' &&
      draftWithFindings.step === 'activityPlan' &&
      draftWithFindings.mode === 'assist' &&
      hasActivityPlan(draftWithFindings) &&
      needsActivities(draftWithFindings)
    ) {
      yield* assertWorkflowGate(getWorkflowStepGate(draftWithFindings, 'activityPlan'));
      const activityDraft = yield* runActivityPhase(ownerId, draftWithFindings, { force: false });
      const activityDraftWithFindings = draftForStep(activityDraft, 'activityPlan');
      yield* assertWorkflowGate(getWorkflowStepGate(activityDraftWithFindings, 'courseContent'));
      const contentDraft = yield* runCourseContentPhase(activityDraftWithFindings, {
        force: false,
      });
      return yield* snapshotWith(ownerId, draftForStep(contentDraft, 'courseContent'));
    }
    yield* assertWorkflowGate(getWorkflowStepGate(draftWithFindings, action.step));
    const transition = assistStepTransitions.find(
      (candidate) =>
        candidate.from === draftWithFindings.step &&
        candidate.to === action.step &&
        draftWithFindings.mode === 'assist' &&
        candidate.ready(draftWithFindings),
    );
    if (transition !== undefined) {
      return yield* snapshotWith(ownerId, yield* transition.advance(ownerId, draftWithFindings));
    }
    return yield* snapshotWith(
      ownerId,
      yield* saveDraft(draftForStep(draftWithFindings, action.step)),
    );
  });

const applyCreateDraft = (
  ownerId: string,
  action: DraftAction<'createDraft'>,
): WorkflowSnapshotEffect =>
  Effect.gen(function* createDraftProgram() {
    const title = action.title.trim();
    if (title.length === 0) {
      return yield* new CoursitionStoreError({ message: 'Course title is required.' });
    }
    const createdAt = now();
    const draft = yield* saveDraft({
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
    });
    return yield* snapshotWith(ownerId, draft);
  });

const applyDeleteDraft = (
  ownerId: string,
  action: DraftAction<'deleteDraft'>,
): WorkflowSnapshotEffect =>
  Effect.gen(function* deleteDraftActionProgram() {
    yield* deleteDraft(ownerId, action.draftId);
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

const applyGenerateCourse = (ownerId: string, draft: CourseDraft): WorkflowSnapshotEffect =>
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
    const draftWithRunningRun = yield* saveDraft({ ...draft, aiRuns: [...draft.aiRuns, aiRun] });
    const courseDraft = yield* Effect.gen(function* generateFullCourse() {
      const plannedDraft = yield* runLearningPlanPhase(draftWithRunningRun, {
        force: false,
        step: 'activityPlan',
      });
      const activityDraft = yield* runActivityPhase(ownerId, plannedDraft, { force: false });
      const activityDraftWithFindings = draftForStep(activityDraft, activityDraft.step);
      yield* assertCourseContentGenerationReady(activityDraftWithFindings);
      const contentDraft = yield* runCourseContentPhase(activityDraft, { force: false });
      const runSummary = yield* courseGenerationSummary(contentDraft);
      const nextDraft = {
        ...contentDraft,
        aiRuns: [
          ...contentDraft.aiRuns.filter((run) => run.id !== aiRun.id),
          appliedAiRun(aiRun, runSummary, aiRun.model, aiRun.provider),
        ],
        step: 'preview' as const,
      };
      return yield* saveDraft({
        ...nextDraft,
        findings: buildFindings({ ...nextDraft, findings: [] }),
      });
    }).pipe(
      Effect.matchEffect({
        onFailure: (error) =>
          requireDraft(ownerId, draft.id).pipe(
            Effect.flatMap((failedCourseDraft) =>
              saveDraft(failedAiRun(failedCourseDraft, aiRun, error)),
            ),
          ),
        onSuccess: (saved) => Effect.succeed(saved),
      }),
    );
    return yield* snapshotWith(ownerId, courseDraft);
  });

const applyAddSource = (
  ownerId: string,
  draft: CourseDraft,
  action: DraftAction<'addSource'>,
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
          processSource(sourceProcessorDeps, draft.id, action.source),
        ),
    });
    const sources = [...draft.sources, source];
    const derived = documentsAndChunksForSource(source, source.createdAt ?? now());
    const timestamp = now();
    return yield* snapshotWith(
      ownerId,
      yield* saveDraft({
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
    );
  });

const applyDeleteSource = (
  ownerId: string,
  draft: CourseDraft,
  action: DraftAction<'deleteSource'>,
): WorkflowSnapshotEffect =>
  Effect.gen(function* deleteSourceProgram() {
    const sources = draft.sources.map((source) =>
      source.id === action.sourceId
        ? { ...source, deletedAt: now(), status: 'deleted' as const }
        : source,
    );
    return yield* snapshotWith(
      ownerId,
      yield* saveDraft({
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
    );
  });

const applyRetrySource = (
  ownerId: string,
  draft: CourseDraft,
  action: DraftAction<'retrySource'>,
): WorkflowSnapshotEffect =>
  Effect.gen(function* retrySourceProgram() {
    const existingSource = draft.sources.find((source) => source.id === action.sourceId);
    if (existingSource === undefined) {
      return yield* new CoursitionStoreError({
        message: 'Source not found for signed-in creator.',
      });
    }
    const filePayloadOption =
      existingSource.type === 'file' ? yield* loadFileSourcePayload(existingSource) : Option.none();
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
      yield* saveDraft({
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
    );
  });

const applyRetryAiRun = (
  ownerId: string,
  draft: CourseDraft,
  action: DraftAction<'retryAiRun'>,
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
        const plannedDraft = yield* runLearningPlanPhase(draft, {
          force: false,
          step: 'activityPlan',
        });
        const activityDraft = yield* runActivityPhase(ownerId, plannedDraft, { force: false });
        const activityDraftWithFindings = draftForStep(activityDraft, activityDraft.step);
        yield* assertCourseContentGenerationReady(activityDraftWithFindings);
        const contentDraft = yield* runCourseContentPhase(activityDraft, { force: false });
        return yield* snapshotWith(
          ownerId,
          yield* saveDraft({
            ...contentDraft,
            findings: buildFindings({ ...contentDraft, findings: [] }),
            step: 'preview',
          }),
        );
      }
      case 'course_preparation_generation': {
        const nextDraft = yield* runCoursePreparationPhase(draft, { force: true });
        return yield* snapshotWith(ownerId, nextDraft);
      }
      case 'learning_blueprint_generation': {
        const draftWithFindings = draftForStep(draft, draft.step);
        yield* assertWorkflowGate(getWorkflowStepGate(draftWithFindings, 'objectives'));
        const nextDraft = yield* runLearningPlanPhase(draftWithFindings, {
          force: true,
          step: 'objectives',
        });
        return yield* snapshotWith(ownerId, nextDraft);
      }
      case 'activity_generation': {
        const draftWithFindings = draftForStep(draft, draft.step);
        yield* assertWorkflowGate(getWorkflowStepGate(draftWithFindings, 'activityPlan'));
        const nextDraft = yield* runActivityPhase(ownerId, draftWithFindings, { force: true });
        return yield* snapshotWith(ownerId, nextDraft);
      }
      case 'course_content_generation': {
        const draftWithFindings = draftForStep(draft, draft.step);
        yield* assertWorkflowGate(getWorkflowStepGate(draftWithFindings, 'courseContent'));
        const nextDraft = yield* runCourseContentPhase(draftWithFindings, { force: true });
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
): WorkflowSnapshotEffect =>
  Effect.gen(function* generateLearningBlueprintProgram() {
    const draftWithFindings = draftForStep(draft, draft.step);
    yield* assertWorkflowGate(getWorkflowStepGate(draftWithFindings, 'objectives'));
    const nextDraft = yield* runLearningPlanPhase(draftWithFindings, {
      force: true,
      step: 'objectives',
    });
    return yield* snapshotWith(ownerId, nextDraft);
  });

const applyGenerateActivities = (ownerId: string, draft: CourseDraft): WorkflowSnapshotEffect =>
  Effect.gen(function* generateActivitiesProgram() {
    const draftWithFindings = draftForStep(draft, draft.step);
    yield* assertWorkflowGate(getWorkflowStepGate(draftWithFindings, 'activityPlan'));
    const nextDraft = yield* runActivityPhase(ownerId, draftWithFindings, { force: true });
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
    return yield* snapshotWith(
      ownerId,
      yield* saveDraft({
        ...nextDraft,
        courseContent: staleCourseContent(nextDraft.courseContent, timestamp),
        findings: buildFindings(nextDraft),
        step: 'objectives',
      }),
    );
  });

const applyUpdateActivityBrief = (
  ownerId: string,
  draft: CourseDraft,
  action: DraftAction<'updateActivityBrief'>,
): WorkflowSnapshotEffect =>
  Effect.gen(function* updateActivityBriefProgram() {
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
    return yield* snapshotWith(
      ownerId,
      yield* saveDraft({
        ...nextDraft,
        courseContent: staleCourseContent(nextDraft.courseContent, timestamp),
        findings: buildFindings(nextDraft),
        step: 'activityPlan',
      }),
    );
  });

const applyGenerateCourseContent = (ownerId: string, draft: CourseDraft): WorkflowSnapshotEffect =>
  Effect.gen(function* generateCourseContentProgram() {
    const draftWithFindings = draftForStep(draft, draft.step);
    yield* assertWorkflowGate(getWorkflowStepGate(draftWithFindings, 'courseContent'));
    const nextDraft = yield* runCourseContentPhase(draftWithFindings, { force: true });
    return yield* snapshotWith(ownerId, nextDraft);
  });

const applySetFindingStatus = (
  ownerId: string,
  draft: CourseDraft,
  action: DraftAction<'setFindingStatus'>,
): WorkflowSnapshotEffect =>
  Effect.gen(function* setFindingStatusProgram() {
    const currentFindings = buildFindings(draft);
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

const applyDraftAction = (ownerId: string, action: DraftScopedAction): WorkflowSnapshotEffect =>
  Effect.gen(function* draftActionProgram() {
    const draft = yield* requireDraft(ownerId, action.draftId);
    switch (action.action) {
      case 'updateDraftTitle': {
        return yield* applyUpdateDraftTitle(ownerId, draft, action);
      }
      case 'goToStep': {
        return yield* applyGoToStep(ownerId, draft, action);
      }
      case 'setMode': {
        return yield* applySetMode(ownerId, draft, action);
      }
      case 'generateCourse': {
        return yield* applyGenerateCourse(ownerId, draft);
      }
      case 'addSource': {
        return yield* applyAddSource(ownerId, draft, action);
      }
      case 'deleteSource': {
        return yield* applyDeleteSource(ownerId, draft, action);
      }
      case 'retrySource': {
        return yield* applyRetrySource(ownerId, draft, action);
      }
      case 'retryAiRun': {
        return yield* applyRetryAiRun(ownerId, draft, action);
      }
      case 'generateLearningBlueprint': {
        return yield* applyGenerateLearningBlueprint(ownerId, draft);
      }
      case 'generateActivities': {
        return yield* applyGenerateActivities(ownerId, draft);
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
        return yield* applyGenerateCourseContent(ownerId, draft);
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
    switch (action.action) {
      case 'getState': {
        yield* ensureDefaultDraftsForOwner(ownerId);
        return yield* snapshotForProgram(ownerId);
      }
      case 'createDraft': {
        return yield* applyCreateDraft(ownerId, action);
      }
      case 'selectDraft': {
        return yield* snapshotWith(ownerId, yield* requireDraft(ownerId, action.draftId));
      }
      case 'deleteDraft': {
        return yield* applyDeleteDraft(ownerId, action);
      }
      default: {
        return yield* applyDraftAction(ownerId, action);
      }
    }
  });

export const snapshotFor = (ownerId: string): Promise<WorkflowSnapshot> =>
  storeRuntime.runPromise(
    ensureDefaultDraftsForOwner(ownerId).pipe(Effect.flatMap(() => snapshotForProgram(ownerId))),
  );

export const snapshotForRoute = (
  ownerId: string,
  draftId: string,
  step: CourseDraft['step'],
): Promise<WorkflowSnapshot> =>
  storeRuntime.runPromise(snapshotForRouteProgram(ownerId, draftId, step));

export const applyWorkflowAction = (
  ownerId: string,
  action: WorkflowAction,
): Promise<WorkflowSnapshot> =>
  storeRuntime.runPromise(applyWorkflowActionProgram(ownerId, action));
