/* eslint-disable max-classes-per-file */
import {
  HttpApi,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
  Schema,
} from '@modern-js/plugin-bff/effect-client';

const aiModeSchema = Schema.Literals(['generate', 'assist']);
const draftStepSchema = Schema.Literals([
  'mode',
  'knowledge',
  'questions',
  'topics',
  'target',
  'chapters',
  'lessons',
  'builder',
  'preview',
]);
const sourceStatusSchema = Schema.Literals([
  'uploaded',
  'queued',
  'processing',
  'processed',
  'partially_processed',
  'failed',
  'unsupported',
  'deleted',
]);
const sourceTypeSchema = Schema.Literals(['file', 'url', 'notes']);
const sourceSupportSchema = Schema.Literals(['source_backed', 'partially_source_backed', 'manual']);
const importanceSchema = Schema.Literals(['low', 'medium', 'high', 'critical']);
const confidenceSchema = Schema.Literals(['high', 'medium', 'low']);
const lessonBlockTypeSchema = Schema.Literals([
  'heading',
  'rich_text',
  'callout',
  'image',
  'media',
  'file',
  'quiz',
  'exercise',
  'code',
  'reflection',
  'objective',
  'explanation',
  'check',
  'summary',
]);
const provenanceSchema = Schema.Literals(['source-backed', 'AI-inferred', 'manual', 'mixed']);
const aiRunStatusSchema = Schema.Literals([
  'queued',
  'running',
  'needs_review',
  'applied',
  'failed',
  'cancelled',
]);
const aiRunTypeSchema = Schema.Literals([
  'topic_generation',
  'target_learner_generation',
  'chapter_generation',
  'lesson_generation',
  'teaching_quality_review',
]);

export const sourceReferenceSchema = Schema.Struct({
  heading: Schema.optional(Schema.String),
  page: Schema.optional(Schema.Number),
  position: Schema.String,
  slide: Schema.optional(Schema.Number),
  sourceAssetId: Schema.String,
  timestampSeconds: Schema.optional(Schema.Number),
});

export const sourceAssetSchema = Schema.Struct({
  content: Schema.String,
  createdAt: Schema.optional(Schema.String),
  deletedAt: Schema.optional(Schema.String),
  failureReason: Schema.optional(Schema.String),
  id: Schema.String,
  mimeType: Schema.optional(Schema.String),
  name: Schema.String,
  originalInput: Schema.optional(Schema.String),
  processor: Schema.String,
  providerJobId: Schema.optional(Schema.String),
  sizeLabel: Schema.String,
  status: sourceStatusSchema,
  storageReference: Schema.optional(Schema.String),
  type: sourceTypeSchema,
});

export const derivedSourceDocumentSchema = Schema.Struct({
  content: Schema.String,
  createdAt: Schema.String,
  id: Schema.String,
  outputType: Schema.Literals(['markdown', 'transcript', 'text']),
  processor: Schema.String,
  processorVersion: Schema.String,
  quality: confidenceSchema,
  sourceAssetId: Schema.String,
});

export const knowledgeChunkSchema = Schema.Struct({
  confidence: confidenceSchema,
  content: Schema.String,
  createdAt: Schema.String,
  derivedSourceDocumentId: Schema.String,
  id: Schema.String,
  reference: sourceReferenceSchema,
  sourceAssetId: Schema.String,
});

export const guidedQuestionsSchema = Schema.Struct({
  audience: Schema.String,
  avoid: Schema.String,
  depth: Schema.String,
  outcome: Schema.String,
  practice: Schema.String,
  priorKnowledge: Schema.String,
  strictSourceOnly: Schema.Boolean,
});
export type GuidedQuestions = Schema.Schema.Type<typeof guidedQuestionsSchema>;

export const topicSchema = Schema.Struct({
  description: Schema.String,
  id: Schema.String,
  importance: importanceSchema,
  name: Schema.String,
  sourceSupport: sourceSupportSchema,
});
export type Topic = Schema.Schema.Type<typeof topicSchema>;

export const targetLearnerSchema = Schema.Struct({
  constraints: Schema.String,
  currentKnowledge: Schema.String,
  desiredOutcome: Schema.String,
  motivation: Schema.String,
  pain: Schema.String,
  practiceStyle: Schema.String,
  profile: Schema.String,
});
export type TargetLearner = Schema.Schema.Type<typeof targetLearnerSchema>;

export const lessonBlockSchema = Schema.Struct({
  body: Schema.String,
  id: Schema.String,
  provenance: provenanceSchema,
  sourceReferences: Schema.optional(Schema.Array(sourceReferenceSchema)),
  title: Schema.String,
  type: lessonBlockTypeSchema,
});
export type LessonBlock = Schema.Schema.Type<typeof lessonBlockSchema>;

export const lessonSchema = Schema.Struct({
  blocks: Schema.Array(lessonBlockSchema),
  durationMinutes: Schema.Number,
  id: Schema.String,
  title: Schema.String,
});
export type Lesson = Schema.Schema.Type<typeof lessonSchema>;

export const chapterSchema = Schema.Struct({
  coveredTopicIds: Schema.Array(Schema.String),
  description: Schema.String,
  difficulty: Schema.Literals(['introductory', 'intermediate', 'advanced']),
  id: Schema.String,
  lessons: Schema.Array(lessonSchema),
  outcome: Schema.String,
  plannedLessonCount: Schema.Number,
  sourceSupport: sourceSupportSchema,
  status: Schema.Literals(['draft', 'confirmed']),
  title: Schema.String,
});
export type Chapter = Schema.Schema.Type<typeof chapterSchema>;

export const reviewFindingSchema = Schema.Struct({
  detail: Schema.String,
  fingerprint: Schema.String,
  id: Schema.String,
  severity: Schema.Literals(['info', 'warning', 'blocking']),
  status: Schema.Literals(['open', 'resolved', 'dismissed']),
  step: draftStepSchema,
  targetId: Schema.String,
  targetType: Schema.Literals(['block', 'chapter', 'course', 'lesson', 'source', 'topic']),
  title: Schema.String,
});

export const aiRunSchema = Schema.Struct({
  appliedAt: Schema.optional(Schema.String),
  createdAt: Schema.String,
  draftId: Schema.String,
  failureReason: Schema.optional(Schema.String),
  id: Schema.String,
  inputSummary: Schema.String,
  model: Schema.String,
  outputText: Schema.optional(Schema.String),
  provider: Schema.String,
  providerRequestId: Schema.optional(Schema.String),
  status: aiRunStatusSchema,
  type: aiRunTypeSchema,
  updatedAt: Schema.String,
});

export const courseDraftSchema = Schema.Struct({
  aiRuns: Schema.Array(aiRunSchema),
  chapters: Schema.Array(chapterSchema),
  createdAt: Schema.String,
  derivedSourceDocuments: Schema.Array(derivedSourceDocumentSchema),
  findings: Schema.Array(reviewFindingSchema),
  id: Schema.String,
  knowledgeChunks: Schema.Array(knowledgeChunkSchema),
  language: Schema.Literals(['en', 'cs']),
  mode: aiModeSchema,
  ownerId: Schema.String,
  questions: guidedQuestionsSchema,
  sourceProcessingIncomplete: Schema.Boolean,
  sources: Schema.Array(sourceAssetSchema),
  step: draftStepSchema,
  targetLearner: targetLearnerSchema,
  title: Schema.String,
  topics: Schema.Array(topicSchema),
  updatedAt: Schema.String,
});

export const courseDraftSummarySchema = Schema.Struct({
  chapterCount: Schema.Number,
  id: Schema.String,
  language: Schema.Literals(['en', 'cs']),
  lessonCount: Schema.Number,
  mode: aiModeSchema,
  sourceCount: Schema.Number,
  step: draftStepSchema,
  title: Schema.String,
  updatedAt: Schema.String,
});

export const workflowSnapshotSchema = Schema.Struct({
  config: Schema.Struct({
    aiProviderConfigured: Schema.Boolean,
    auth: Schema.Literal('better-auth'),
    deepgramConfigured: Schema.Boolean,
    llamaParseConfigured: Schema.Boolean,
    storage: Schema.Literal('json-file'),
    webExtractionConfigured: Schema.Boolean,
  }),
  draft: Schema.NullOr(courseDraftSchema),
  drafts: Schema.Array(courseDraftSummarySchema),
});

export type WorkflowSnapshot = Schema.Schema.Type<typeof workflowSnapshotSchema>;

const sourceInputSchema = Schema.Struct({
  content: Schema.String,
  name: Schema.String,
  sizeLabel: Schema.optional(Schema.String),
  type: sourceTypeSchema,
});

export const workflowActionSchema = Schema.Union([
  Schema.Struct({ action: Schema.Literal('getState') }),
  Schema.Struct({
    action: Schema.Literal('createDraft'),
    language: Schema.Literals(['en', 'cs']),
    title: Schema.String,
  }),
  Schema.Struct({ action: Schema.Literal('selectDraft'), draftId: Schema.String }),
  Schema.Struct({
    action: Schema.Literal('deleteDraft'),
    confirm: Schema.Literal(true),
    draftId: Schema.String,
  }),
  Schema.Struct({
    action: Schema.Literal('updateDraftTitle'),
    draftId: Schema.String,
    title: Schema.String,
  }),
  Schema.Struct({
    action: Schema.Literal('goToStep'),
    draftId: Schema.String,
    step: draftStepSchema,
  }),
  Schema.Struct({ action: Schema.Literal('setMode'), draftId: Schema.String, mode: aiModeSchema }),
  Schema.Struct({ action: Schema.Literal('buildFullCourse'), draftId: Schema.String }),
  Schema.Struct({
    action: Schema.Literal('addSource'),
    draftId: Schema.String,
    source: sourceInputSchema,
  }),
  Schema.Struct({
    action: Schema.Literal('deleteSource'),
    draftId: Schema.String,
    sourceId: Schema.String,
  }),
  Schema.Struct({
    action: Schema.Literal('retrySource'),
    draftId: Schema.String,
    sourceId: Schema.String,
  }),
  Schema.Struct({
    action: Schema.Literal('retryAiRun'),
    draftId: Schema.String,
    runId: Schema.String,
  }),
  Schema.Struct({
    action: Schema.Literal('autosaveQuestions'),
    draftId: Schema.String,
    questions: guidedQuestionsSchema,
  }),
  Schema.Struct({
    action: Schema.Literal('saveQuestions'),
    draftId: Schema.String,
    questions: guidedQuestionsSchema,
  }),
  Schema.Struct({ action: Schema.Literal('generateTopics'), draftId: Schema.String }),
  Schema.Struct({
    action: Schema.Literal('addTopic'),
    description: Schema.String,
    draftId: Schema.String,
    name: Schema.String,
  }),
  Schema.Struct({
    action: Schema.Literal('updateTopic'),
    description: Schema.String,
    draftId: Schema.String,
    name: Schema.String,
    topicId: Schema.String,
  }),
  Schema.Struct({
    action: Schema.Literal('deleteTopic'),
    draftId: Schema.String,
    topicId: Schema.String,
  }),
  Schema.Struct({
    action: Schema.Literal('generateTargetLearner'),
    draftId: Schema.String,
  }),
  Schema.Struct({
    action: Schema.Literal('updateTargetLearner'),
    draftId: Schema.String,
    targetLearner: targetLearnerSchema,
  }),
  Schema.Struct({
    action: Schema.Literal('confirmTarget'),
    draftId: Schema.String,
    targetLearner: targetLearnerSchema,
  }),
  Schema.Struct({
    action: Schema.Literal('addChapter'),
    description: Schema.String,
    draftId: Schema.String,
    outcome: Schema.String,
    title: Schema.String,
  }),
  Schema.Struct({
    action: Schema.Literal('updateChapter'),
    chapterId: Schema.String,
    description: Schema.String,
    draftId: Schema.String,
    outcome: Schema.String,
    title: Schema.String,
  }),
  Schema.Struct({
    action: Schema.Literal('deleteChapter'),
    chapterId: Schema.String,
    draftId: Schema.String,
  }),
  Schema.Struct({
    action: Schema.Literal('moveChapter'),
    chapterId: Schema.String,
    direction: Schema.Literals(['up', 'down']),
    draftId: Schema.String,
  }),
  Schema.Struct({ action: Schema.Literal('confirmChapters'), draftId: Schema.String }),
  Schema.Struct({ action: Schema.Literal('generateChapters'), draftId: Schema.String }),
  Schema.Struct({ action: Schema.Literal('generateLessons'), draftId: Schema.String }),
  Schema.Struct({
    action: Schema.Literal('generateChapterLessons'),
    chapterId: Schema.String,
    draftId: Schema.String,
  }),
  Schema.Struct({
    action: Schema.Literal('regenerateLesson'),
    draftId: Schema.String,
    lessonId: Schema.String,
  }),
  Schema.Struct({
    action: Schema.Literal('addLesson'),
    chapterId: Schema.String,
    draftId: Schema.String,
    title: Schema.String,
  }),
  Schema.Struct({
    action: Schema.Literal('updateLesson'),
    draftId: Schema.String,
    durationMinutes: Schema.Number,
    lessonId: Schema.String,
    title: Schema.String,
  }),
  Schema.Struct({
    action: Schema.Literal('deleteLesson'),
    draftId: Schema.String,
    lessonId: Schema.String,
  }),
  Schema.Struct({
    action: Schema.Literal('moveLesson'),
    direction: Schema.Literals(['up', 'down']),
    draftId: Schema.String,
    lessonId: Schema.String,
  }),
  Schema.Struct({
    action: Schema.Literal('addBlock'),
    blockType: lessonBlockTypeSchema,
    body: Schema.String,
    draftId: Schema.String,
    lessonId: Schema.String,
    title: Schema.String,
  }),
  Schema.Struct({
    action: Schema.Literal('updateBlock'),
    blockId: Schema.String,
    body: Schema.String,
    draftId: Schema.String,
    title: Schema.String,
  }),
  Schema.Struct({
    action: Schema.Literal('deleteBlock'),
    blockId: Schema.String,
    draftId: Schema.String,
  }),
  Schema.Struct({
    action: Schema.Literal('moveBlock'),
    blockId: Schema.String,
    direction: Schema.Literals(['up', 'down']),
    draftId: Schema.String,
  }),
  Schema.Struct({
    action: Schema.Literal('setFindingStatus'),
    draftId: Schema.String,
    findingId: Schema.String,
    status: Schema.Literals(['resolved', 'dismissed']),
  }),
  Schema.Struct({ action: Schema.Literal('openPreview'), draftId: Schema.String }),
]);

export type WorkflowAction = Schema.Schema.Type<typeof workflowActionSchema>;

export const sessionUserSchema = Schema.Struct({
  email: Schema.String,
  id: Schema.String,
  name: Schema.optional(Schema.String),
});

export const sessionPayloadSchema = Schema.Struct({
  session: Schema.NullOr(Schema.Struct({ user: sessionUserSchema })),
});

export type SessionPayload = Schema.Schema.Type<typeof sessionPayloadSchema>;
export type SessionUser = Schema.Schema.Type<typeof sessionUserSchema>;

export const authCredentialsSchema = Schema.Struct({
  email: Schema.String,
  name: Schema.optional(Schema.String),
  password: Schema.String,
});

export const signOutPayloadSchema = Schema.Struct({
  ok: Schema.Boolean,
});

export class CoursitionUnauthorized extends Schema.TaggedErrorClass<CoursitionUnauthorized>()(
  'CoursitionUnauthorized',
  {
    message: Schema.String,
  },
) {}

export class CoursitionServerError extends Schema.TaggedErrorClass<CoursitionServerError>()(
  'CoursitionServerError',
  {
    message: Schema.String,
  },
) {}

const unauthorizedSchema = CoursitionUnauthorized.pipe(HttpApiSchema.status(401));
const serverErrorSchema = CoursitionServerError.pipe(HttpApiSchema.status(500));
const endpointErrors = [unauthorizedSchema, serverErrorSchema] as const;

export const coursitionEffectApi = HttpApi.make('CoursitionEffectApi')
  .add(
    HttpApiGroup.make('auth')
      .add(
        HttpApiEndpoint.get('session', '/auth/session', {
          error: endpointErrors,
          success: sessionPayloadSchema,
        }),
      )
      .add(
        HttpApiEndpoint.post('signUp', '/auth/sign-up', {
          error: endpointErrors,
          payload: authCredentialsSchema,
          success: sessionPayloadSchema,
        }),
      )
      .add(
        HttpApiEndpoint.post('signIn', '/auth/sign-in', {
          error: endpointErrors,
          payload: authCredentialsSchema,
          success: sessionPayloadSchema,
        }),
      )
      .add(
        HttpApiEndpoint.post('signOut', '/auth/sign-out', {
          error: endpointErrors,
          success: signOutPayloadSchema,
        }),
      ),
  )
  .add(
    HttpApiGroup.make('workflow').add(
      HttpApiEndpoint.post('apply', '/coursition/workflow', {
        error: endpointErrors,
        payload: workflowActionSchema,
        success: workflowSnapshotSchema,
      }),
    ),
  );
