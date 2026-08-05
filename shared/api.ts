/* eslint-disable max-classes-per-file */
import * as Schema from 'effect/Schema';
import * as HttpApi from 'effect/unstable/httpapi/HttpApi';
import * as HttpApiEndpoint from 'effect/unstable/httpapi/HttpApiEndpoint';
import * as HttpApiGroup from 'effect/unstable/httpapi/HttpApiGroup';
import * as HttpApiSchema from 'effect/unstable/httpapi/HttpApiSchema';

const aiModeSchema = Schema.Literals(['generate', 'assist']);
export const draftStepSchema = Schema.Literals([
  'mode',
  'sources',
  'preparation',
  'objectives',
  'activityPlan',
  'courseContent',
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
const sourceSupportSchema = Schema.Literals([
  'source_backed',
  'partially_source_backed',
  'inferred',
]);
const sourceConfidenceSchema = Schema.Literals(['high', 'medium', 'low', 'none']);
const generatedStatusSchema = Schema.Literals(['empty', 'generated', 'edited', 'stale']);
const confidenceSchema = Schema.Literals(['high', 'medium', 'low']);
export const activityTypeSchema = Schema.Literals([
  'retrieval_check',
  'practice_task',
  'scenario_decision',
  'ordering_matching',
  'rubric_answer',
]);
const contentBlockTypeSchema = Schema.Literals([
  'objective',
  'source_explanation',
  'worked_example',
  'interactive_activity',
  'reflection',
  'summary',
]);
const aiRunStatusSchema = Schema.Literals([
  'queued',
  'running',
  'needs_review',
  'applied',
  'failed',
  'cancelled',
]);
const aiRunTypeSchema = Schema.Literals([
  'course_generation',
  'course_preparation_generation',
  'learning_blueprint_generation',
  'activity_generation',
  'course_content_generation',
  'teaching_quality_review',
]);

export const sourceReferenceSchema = Schema.Struct({
  heading: Schema.optional(Schema.String),
  page: Schema.optional(Schema.Finite),
  position: Schema.String,
  slide: Schema.optional(Schema.Finite),
  sourceAssetId: Schema.String,
  timestampSeconds: Schema.optional(Schema.Finite),
});

export const sourceAssetSchema = Schema.Struct({
  content: Schema.String,
  createdAt: Schema.optional(Schema.String),
  deletedAt: Schema.optional(Schema.String),
  failureReason: Schema.optional(Schema.String),
  id: Schema.String,
  mimeType: Schema.optional(Schema.String),
  name: Schema.String,
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

export const coursePreparationSchema = Schema.Struct({
  activityMixPreference: Schema.String,
  audience: Schema.String,
  constraints: Schema.String,
  depth: Schema.String,
  desiredOutcome: Schema.String,
  language: Schema.Literals(['en', 'cs']),
  languagePreference: Schema.Literals(['source', 'en', 'cs']),
  priorKnowledge: Schema.String,
  sourceStrictness: Schema.Literals(['standard', 'strict']),
  tone: Schema.String,
});
export type CoursePreparation = Schema.Schema.Type<typeof coursePreparationSchema>;

export const learningObjectiveSchema = Schema.Struct({
  capability: Schema.String,
  id: Schema.String,
  sourceConfidence: sourceConfidenceSchema,
  sourceReferences: sourceReferenceSchema.pipe(Schema.Array, Schema.optional),
  sourceSupport: sourceSupportSchema,
  status: generatedStatusSchema,
  title: Schema.String,
  topicName: Schema.String,
  updatedAt: Schema.String,
});
export type LearningObjective = Schema.Schema.Type<typeof learningObjectiveSchema>;

export const activityBriefSchema = Schema.Struct({
  feedbackGuidance: Schema.String,
  id: Schema.String,
  instructions: Schema.String,
  learnerAction: Schema.String,
  objectiveId: Schema.String,
  objectiveIds: Schema.Array(Schema.String),
  sourceConfidence: sourceConfidenceSchema,
  sourceReferences: sourceReferenceSchema.pipe(Schema.Array, Schema.optional),
  status: generatedStatusSchema,
  successCriteria: Schema.String,
  title: Schema.String,
  type: activityTypeSchema,
  updatedAt: Schema.String,
});
export type ActivityBrief = Schema.Schema.Type<typeof activityBriefSchema>;

const retrievalChoiceSchema = Schema.Struct({
  feedback: Schema.String,
  id: Schema.String,
  isCorrect: Schema.Boolean,
  text: Schema.String,
});

const retrievalCheckInteractionSchema = Schema.Struct({
  choices: Schema.Array(retrievalChoiceSchema),
  explanationPrompt: Schema.String,
  feedback: Schema.String,
  kind: Schema.Literal('retrieval_check'),
  question: Schema.String,
});

const practiceTaskInteractionSchema = Schema.Struct({
  checklist: Schema.Array(Schema.String),
  feedback: Schema.String,
  kind: Schema.Literal('practice_task'),
  prompt: Schema.String,
  submissionLabel: Schema.String,
});

const scenarioChoiceSchema = Schema.Struct({
  consequence: Schema.String,
  feedback: Schema.String,
  id: Schema.String,
  isPreferred: Schema.Boolean,
  text: Schema.String,
});

const scenarioDecisionInteractionSchema = Schema.Struct({
  choices: Schema.Array(scenarioChoiceSchema),
  feedback: Schema.String,
  justificationPrompt: Schema.String,
  kind: Schema.Literal('scenario_decision'),
  scenario: Schema.String,
});

const orderingMatchingItemSchema = Schema.Struct({
  correctPosition: Schema.optional(Schema.Finite),
  id: Schema.String,
  matchLabel: Schema.optional(Schema.String),
  text: Schema.String,
});

const orderingMatchingInteractionSchema = Schema.Struct({
  feedback: Schema.String,
  items: Schema.Array(orderingMatchingItemSchema),
  kind: Schema.Literal('ordering_matching'),
  mode: Schema.Literals(['matching', 'ordering']),
  prompt: Schema.String,
});

const rubricAnswerInteractionSchema = Schema.Struct({
  criteria: Schema.Array(Schema.String),
  feedback: Schema.String,
  kind: Schema.Literal('rubric_answer'),
  prompt: Schema.String,
});

const notPlayableInteractionSchema = Schema.Struct({
  feedback: Schema.String,
  kind: Schema.Literal('not_playable'),
  prompt: Schema.String,
  reason: Schema.String,
});

const generatedActivityBaseSchema = {
  briefId: Schema.String,
  id: Schema.String,
  objectiveIds: Schema.Array(Schema.String),
  sourceConfidence: sourceConfidenceSchema,
  sourceReferences: sourceReferenceSchema.pipe(Schema.Array, Schema.optional),
  status: generatedStatusSchema,
} as const;

export const generatedActivitySchema = Schema.Union([
  Schema.Struct({
    ...generatedActivityBaseSchema,
    interaction: retrievalCheckInteractionSchema,
    type: Schema.Literal('retrieval_check'),
  }),
  Schema.Struct({
    ...generatedActivityBaseSchema,
    interaction: practiceTaskInteractionSchema,
    type: Schema.Literal('practice_task'),
  }),
  Schema.Struct({
    ...generatedActivityBaseSchema,
    interaction: scenarioDecisionInteractionSchema,
    type: Schema.Literal('scenario_decision'),
  }),
  Schema.Struct({
    ...generatedActivityBaseSchema,
    interaction: orderingMatchingInteractionSchema,
    type: Schema.Literal('ordering_matching'),
  }),
  Schema.Struct({
    ...generatedActivityBaseSchema,
    interaction: rubricAnswerInteractionSchema,
    type: Schema.Literal('rubric_answer'),
  }),
  Schema.Struct({
    ...generatedActivityBaseSchema,
    interaction: notPlayableInteractionSchema,
    type: Schema.Literal('not_playable'),
  }),
]);
export type GeneratedActivity = Schema.Schema.Type<typeof generatedActivitySchema>;

export const learningBlueprintSchema = Schema.Struct({
  activityBriefs: Schema.Array(activityBriefSchema),
  assumptions: Schema.Array(Schema.String),
  coursePreparation: coursePreparationSchema,
  createdAt: Schema.String,
  generatedActivities: Schema.Array(generatedActivitySchema),
  objectives: Schema.Array(learningObjectiveSchema),
  sourceCoverage: sourceSupportSchema,
  updatedAt: Schema.String,
});
export type LearningBlueprint = Schema.Schema.Type<typeof learningBlueprintSchema>;

export const courseContentBlockSchema = Schema.Struct({
  activityId: Schema.optional(Schema.String),
  body: Schema.String,
  id: Schema.String,
  objectiveIds: Schema.Array(Schema.String),
  sourceConfidence: sourceConfidenceSchema,
  sourceReferences: sourceReferenceSchema.pipe(Schema.Array, Schema.optional),
  status: generatedStatusSchema,
  title: Schema.String,
  type: contentBlockTypeSchema,
});
export type CourseContentBlock = Schema.Schema.Type<typeof courseContentBlockSchema>;

export const courseSectionSchema = Schema.Struct({
  blocks: Schema.Array(courseContentBlockSchema),
  id: Schema.String,
  objectiveIds: Schema.Array(Schema.String),
  sourceConfidence: sourceConfidenceSchema,
  sourceReferences: sourceReferenceSchema.pipe(Schema.Array, Schema.optional),
  status: generatedStatusSchema,
  summary: Schema.String,
  title: Schema.String,
});
export type CourseSection = Schema.Schema.Type<typeof courseSectionSchema>;

export const courseContentSchema = Schema.Struct({
  createdAt: Schema.String,
  sections: Schema.Array(courseSectionSchema),
  status: generatedStatusSchema,
  updatedAt: Schema.String,
});
export type CourseContent = Schema.Schema.Type<typeof courseContentSchema>;

export const reviewFindingSchema = Schema.Struct({
  detail: Schema.String,
  fingerprint: Schema.String,
  id: Schema.String,
  severity: Schema.Literals(['info', 'warning', 'blocking']),
  status: Schema.Literals(['open', 'resolved', 'dismissed']),
  step: draftStepSchema,
  targetId: Schema.String,
  targetType: Schema.Literals([
    'activity',
    'block',
    'course',
    'objective',
    'preparation',
    'section',
    'source',
  ]),
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
  courseContent: courseContentSchema,
  createdAt: Schema.String,
  derivedSourceDocuments: Schema.Array(derivedSourceDocumentSchema),
  findings: Schema.Array(reviewFindingSchema),
  id: Schema.String,
  knowledgeChunks: Schema.Array(knowledgeChunkSchema),
  language: Schema.Literals(['en', 'cs']),
  learningBlueprint: learningBlueprintSchema,
  mode: aiModeSchema,
  ownerId: Schema.String,
  revision: Schema.Int,
  sourceProcessingIncomplete: Schema.Boolean,
  sources: Schema.Array(sourceAssetSchema),
  step: draftStepSchema,
  title: Schema.String,
  updatedAt: Schema.String,
});

export const courseDraftSummarySchema = Schema.Struct({
  activityCount: Schema.Finite,
  id: Schema.String,
  language: Schema.Literals(['en', 'cs']),
  mode: aiModeSchema,
  objectiveCount: Schema.Finite,
  revision: Schema.Int,
  sectionCount: Schema.Finite,
  sourceCount: Schema.Finite,
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
    storage: Schema.Literals(['cloudflare-d1-r2', 'json-file']),
    webExtractionConfigured: Schema.Boolean,
  }),
  draft: Schema.NullOr(courseDraftSchema),
  drafts: Schema.Array(courseDraftSummarySchema),
  revision: Schema.Int,
});

export type WorkflowSnapshot = Schema.Schema.Type<typeof workflowSnapshotSchema>;

export const MAX_SOURCE_FILE_BYTES = 10 * 1024 * 1024;
const maxSourceFileDataUrlLength = Math.ceil(MAX_SOURCE_FILE_BYTES / 3) * 4 + 256;
const sourceFileContentByteLength = (content: string) => {
  const commaIndex = content.indexOf(',');
  if (!content.startsWith('data:') || commaIndex === -1) {
    return new TextEncoder().encode(content).byteLength;
  }
  const metadata = content.slice(5, commaIndex);
  const payload = content.slice(commaIndex + 1);
  if (!metadata.split(';').includes('base64')) {
    try {
      return new TextEncoder().encode(decodeURIComponent(payload)).byteLength;
    } catch {
      return Number.POSITIVE_INFINITY;
    }
  }
  const normalizedLength = payload.replaceAll(/\s/gu, '').length;
  let padding = 0;
  if (payload.endsWith('==')) {
    padding = 2;
  } else if (payload.endsWith('=')) {
    padding = 1;
  }
  return Math.max(0, Math.floor((normalizedLength * 3) / 4) - padding);
};
const sourceFileWithinByteLimit = Schema.makeFilter<string>(
  (content) => sourceFileContentByteLength(content) <= MAX_SOURCE_FILE_BYTES,
  { expected: `source file content of at most ${MAX_SOURCE_FILE_BYTES} bytes` },
);
/* Client-side AnyDoc extraction travels with the uploaded file bytes. The
 * server only trusts it after re-verifying the hash, format, version, and
 * size caps against the decoded original, so the schema pins every field. */
export const ANYDOC_WASM_VERSION = '0.1.4';
export const MAX_ANYDOC_MARKDOWN_CHARS = 2 * 1024 * 1024;
export const anydocFormatSchema = Schema.Literals([
  'csv',
  'doc',
  'docx',
  'epub',
  'odp',
  'ods',
  'odt',
  'pdf',
  'ppt',
  'pptx',
  'rtf',
  'xlsx',
]);
const sha256HexFilter = Schema.makeFilter<string>((value) => /^[0-9a-f]{64}$/u.test(value), {
  expected: 'a lowercase hex sha-256 digest',
});
export const anydocExtractionSchema = Schema.Struct({
  contentMarkdown: Schema.String.check(Schema.isMaxLength(MAX_ANYDOC_MARKDOWN_CHARS)),
  format: anydocFormatSchema,
  processor: Schema.Literal('anydoc_wasm'),
  sourceSha256: Schema.String.check(sha256HexFilter),
  version: Schema.Literal(ANYDOC_WASM_VERSION),
});
export type AnydocExtraction = Schema.Schema.Type<typeof anydocExtractionSchema>;
export type AnydocFormat = Schema.Schema.Type<typeof anydocFormatSchema>;

const commonSourceInputSchema = {
  name: Schema.String,
  sizeLabel: Schema.optional(Schema.String),
} as const;
const sourceInputSchema = Schema.Union([
  Schema.Struct({
    ...commonSourceInputSchema,
    content: Schema.String,
    type: Schema.Literal('notes'),
  }),
  Schema.Struct({
    ...commonSourceInputSchema,
    content: Schema.String,
    type: Schema.Literal('url'),
  }),
  Schema.Struct({
    ...commonSourceInputSchema,
    content: Schema.String.check(
      Schema.isMaxLength(maxSourceFileDataUrlLength),
      sourceFileWithinByteLimit,
    ),
    localExtraction: Schema.optional(anydocExtractionSchema),
    type: Schema.Literal('file'),
  }),
]);

const draftMutationSchema = {
  draftId: Schema.String,
  expectedRevision: Schema.Int,
} as const;

const idempotentOperationSchema = {
  operationId: Schema.String,
} as const;

export const workflowActionSchema = Schema.Union([
  Schema.Struct({ action: Schema.Literal('getState') }),
  Schema.Struct({
    action: Schema.Literal('getRouteState'),
    draftId: Schema.String,
    step: draftStepSchema,
  }),
  Schema.Struct({
    action: Schema.Literal('createDraft'),
    ...idempotentOperationSchema,
    language: Schema.Literals(['en', 'cs']),
    title: Schema.String,
  }),
  Schema.Struct({ action: Schema.Literal('selectDraft'), draftId: Schema.String }),
  Schema.Struct({
    action: Schema.Literal('advanceDraft'),
    ...draftMutationSchema,
    ...idempotentOperationSchema,
    step: draftStepSchema,
  }),
  Schema.Struct({
    action: Schema.Literal('deleteDraft'),
    ...draftMutationSchema,
    ...idempotentOperationSchema,
    confirm: Schema.Literal(true),
  }),
  Schema.Struct({
    action: Schema.Literal('updateDraftTitle'),
    ...draftMutationSchema,
    title: Schema.String,
  }),
  Schema.Struct({
    action: Schema.Literal('goToStep'),
    ...draftMutationSchema,
    ...idempotentOperationSchema,
    step: draftStepSchema,
  }),
  Schema.Struct({
    action: Schema.Literal('setMode'),
    ...draftMutationSchema,
    mode: aiModeSchema,
  }),
  Schema.Struct({
    action: Schema.Literal('generateCourse'),
    ...draftMutationSchema,
    ...idempotentOperationSchema,
  }),
  Schema.Struct({
    action: Schema.Literal('addSource'),
    ...draftMutationSchema,
    ...idempotentOperationSchema,
    source: sourceInputSchema,
  }),
  Schema.Struct({
    action: Schema.Literal('deleteSource'),
    ...draftMutationSchema,
    ...idempotentOperationSchema,
    sourceId: Schema.String,
  }),
  Schema.Struct({
    action: Schema.Literal('retrySource'),
    ...draftMutationSchema,
    ...idempotentOperationSchema,
    sourceId: Schema.String,
  }),
  Schema.Struct({
    action: Schema.Literal('retryAiRun'),
    ...draftMutationSchema,
    ...idempotentOperationSchema,
    runId: Schema.String,
  }),
  Schema.Struct({
    action: Schema.Literal('updateCoursePreparation'),
    ...draftMutationSchema,
    preparation: coursePreparationSchema,
  }),
  Schema.Struct({
    action: Schema.Literal('generateLearningBlueprint'),
    ...draftMutationSchema,
    ...idempotentOperationSchema,
  }),
  Schema.Struct({
    action: Schema.Literal('generateActivities'),
    ...draftMutationSchema,
    ...idempotentOperationSchema,
  }),
  Schema.Struct({
    action: Schema.Literal('updateLearningObjective'),
    ...draftMutationSchema,
    capability: Schema.String,
    objectiveId: Schema.String,
    title: Schema.String,
  }),
  Schema.Struct({
    action: Schema.Literal('updateActivityBrief'),
    ...draftMutationSchema,
    briefId: Schema.String,
    feedbackGuidance: Schema.String,
    instructions: Schema.String,
    learnerAction: Schema.String,
    successCriteria: Schema.String,
    title: Schema.String,
    type: activityTypeSchema,
  }),
  Schema.Struct({
    action: Schema.Literal('generateCourseContent'),
    ...draftMutationSchema,
    ...idempotentOperationSchema,
  }),
  Schema.Struct({
    action: Schema.Literal('setFindingStatus'),
    ...draftMutationSchema,
    findingId: Schema.String,
    status: Schema.Literals(['resolved', 'dismissed']),
  }),
  Schema.Struct({ action: Schema.Literal('openPreview'), ...draftMutationSchema }),
]);

export type WorkflowAction = Schema.Schema.Type<typeof workflowActionSchema>;

/*
 * Derived domain types. The schemas above are the single source of truth for
 * the Coursition domain model: the wire contract, runtime validation, and
 * these TypeScript types all come from one definition, so they can never
 * drift. shared/coursition/workflow.ts re-exports these names.
 */
export type AiMode = Schema.Schema.Type<typeof aiModeSchema>;
export type DraftStep = Schema.Schema.Type<typeof draftStepSchema>;
export type SourceStatus = Schema.Schema.Type<typeof sourceStatusSchema>;
export type SourceType = Schema.Schema.Type<typeof sourceTypeSchema>;
export type SourceSupport = Schema.Schema.Type<typeof sourceSupportSchema>;
export type SourceConfidence = Schema.Schema.Type<typeof sourceConfidenceSchema>;
export type GeneratedStatus = Schema.Schema.Type<typeof generatedStatusSchema>;
export type ActivityType = Schema.Schema.Type<typeof activityTypeSchema>;
export type ContentBlockType = Schema.Schema.Type<typeof contentBlockTypeSchema>;
export type AiRunStatus = Schema.Schema.Type<typeof aiRunStatusSchema>;
export type AiRunType = Schema.Schema.Type<typeof aiRunTypeSchema>;
export type CourseLanguage = 'en' | 'cs';
export type CourseLanguagePreference = 'source' | CourseLanguage;
export type SourceReference = Schema.Schema.Type<typeof sourceReferenceSchema>;
export type SourceAsset = Schema.Schema.Type<typeof sourceAssetSchema>;
export type DerivedSourceDocument = Schema.Schema.Type<typeof derivedSourceDocumentSchema>;
export type KnowledgeChunk = Schema.Schema.Type<typeof knowledgeChunkSchema>;
export type RetrievalChoice = Schema.Schema.Type<typeof retrievalChoiceSchema>;
export type RetrievalCheckInteraction = Schema.Schema.Type<typeof retrievalCheckInteractionSchema>;
export type PracticeTaskInteraction = Schema.Schema.Type<typeof practiceTaskInteractionSchema>;
export type ScenarioChoice = Schema.Schema.Type<typeof scenarioChoiceSchema>;
export type ScenarioDecisionInteraction = Schema.Schema.Type<
  typeof scenarioDecisionInteractionSchema
>;
export type OrderingMatchingItem = Schema.Schema.Type<typeof orderingMatchingItemSchema>;
export type OrderingMatchingInteraction = Schema.Schema.Type<
  typeof orderingMatchingInteractionSchema
>;
export type RubricAnswerInteraction = Schema.Schema.Type<typeof rubricAnswerInteractionSchema>;
export type NotPlayableInteraction = Schema.Schema.Type<typeof notPlayableInteractionSchema>;
export type ActivityInteraction =
  | RetrievalCheckInteraction
  | PracticeTaskInteraction
  | ScenarioDecisionInteraction
  | OrderingMatchingInteraction
  | RubricAnswerInteraction
  | NotPlayableInteraction;
export type ReviewFinding = Schema.Schema.Type<typeof reviewFindingSchema>;
export type AiRun = Schema.Schema.Type<typeof aiRunSchema>;
export type CourseDraft = Schema.Schema.Type<typeof courseDraftSchema>;
export type CourseDraftSummary = Schema.Schema.Type<typeof courseDraftSummarySchema>;

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

export const activityEvaluationRequestSchema = Schema.Struct({
  activityId: Schema.String,
  answer: Schema.String,
  checkedCriteria: Schema.Array(Schema.String),
  draftId: Schema.String,
});

export const activityEvaluationCriterionSchema = Schema.Struct({
  criterion: Schema.String,
  feedback: Schema.String,
  met: Schema.Boolean,
});

export const activityEvaluationResponseSchema = Schema.Struct({
  criteria: Schema.Array(activityEvaluationCriterionSchema),
  feedbackMarkdown: Schema.String,
  nextStep: Schema.String,
  score: Schema.Finite,
});

export type ActivityEvaluationRequest = Schema.Schema.Type<typeof activityEvaluationRequestSchema>;
export type ActivityEvaluationCriterion = Schema.Schema.Type<
  typeof activityEvaluationCriterionSchema
>;
export type ActivityEvaluationResponse = Schema.Schema.Type<
  typeof activityEvaluationResponseSchema
>;

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

export class CoursitionWorkflowConflict extends Schema.TaggedErrorClass<CoursitionWorkflowConflict>()(
  'CoursitionWorkflowConflict',
  {
    currentRevision: Schema.Int,
    currentSnapshot: workflowSnapshotSchema,
    draftId: Schema.String,
    expectedRevision: Schema.Int,
    message: Schema.String,
  },
) {}

const unauthorizedSchema = CoursitionUnauthorized.pipe(HttpApiSchema.status(401));
const serverErrorSchema = CoursitionServerError.pipe(HttpApiSchema.status(500));
export const workflowConflictSchema = CoursitionWorkflowConflict.pipe(HttpApiSchema.status(409));
const endpointErrors = [unauthorizedSchema, serverErrorSchema] as const;
const workflowEndpointErrors = [
  unauthorizedSchema,
  workflowConflictSchema,
  serverErrorSchema,
] as const;

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
        error: workflowEndpointErrors,
        payload: workflowActionSchema,
        success: workflowSnapshotSchema,
      }),
    ),
  )
  .add(
    HttpApiGroup.make('activityEvaluation').add(
      HttpApiEndpoint.post('evaluate', '/coursition/activity-evaluation', {
        error: endpointErrors,
        payload: activityEvaluationRequestSchema,
        success: activityEvaluationResponseSchema,
      }),
    ),
  );
