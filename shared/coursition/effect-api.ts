/* eslint-disable max-classes-per-file */
import {
  HttpApi,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
  Schema,
} from '@modern-js/plugin-bff/effect-client';

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
  sourceReferences: Schema.optional(Schema.Array(sourceReferenceSchema)),
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
  sourceReferences: Schema.optional(Schema.Array(sourceReferenceSchema)),
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
  sourceReferences: Schema.optional(Schema.Array(sourceReferenceSchema)),
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
  sourceReferences: Schema.optional(Schema.Array(sourceReferenceSchema)),
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
  sourceReferences: Schema.optional(Schema.Array(sourceReferenceSchema)),
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
  Schema.Struct({ action: Schema.Literal('generateCourse'), draftId: Schema.String }),
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
    action: Schema.Literal('updateCoursePreparation'),
    draftId: Schema.String,
    preparation: coursePreparationSchema,
  }),
  Schema.Struct({ action: Schema.Literal('generateLearningBlueprint'), draftId: Schema.String }),
  Schema.Struct({ action: Schema.Literal('generateActivities'), draftId: Schema.String }),
  Schema.Struct({
    action: Schema.Literal('updateLearningObjective'),
    capability: Schema.String,
    draftId: Schema.String,
    objectiveId: Schema.String,
    title: Schema.String,
  }),
  Schema.Struct({
    action: Schema.Literal('updateActivityBrief'),
    briefId: Schema.String,
    draftId: Schema.String,
    feedbackGuidance: Schema.String,
    instructions: Schema.String,
    learnerAction: Schema.String,
    successCriteria: Schema.String,
    title: Schema.String,
    type: activityTypeSchema,
  }),
  Schema.Struct({ action: Schema.Literal('generateCourseContent'), draftId: Schema.String }),
  Schema.Struct({
    action: Schema.Literal('setFindingStatus'),
    draftId: Schema.String,
    findingId: Schema.String,
    status: Schema.Literals(['resolved', 'dismissed']),
  }),
  Schema.Struct({ action: Schema.Literal('openPreview'), draftId: Schema.String }),
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
