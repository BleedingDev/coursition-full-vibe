export type AiMode = 'generate' | 'assist';

export type DraftStep =
  | 'mode'
  | 'sources'
  | 'preparation'
  | 'objectives'
  | 'activityPlan'
  | 'courseContent'
  | 'preview';

export const workflowSteps = [
  'mode',
  'sources',
  'preparation',
  'objectives',
  'activityPlan',
  'courseContent',
] as const satisfies readonly DraftStep[];

export type WorkflowStep = (typeof workflowSteps)[number];

export type SourceStatus =
  | 'uploaded'
  | 'queued'
  | 'processing'
  | 'processed'
  | 'partially_processed'
  | 'failed'
  | 'unsupported'
  | 'deleted';
export type SourceType = 'file' | 'url' | 'notes';

export interface SourceAsset {
  id: string;
  type: SourceType;
  name: string;
  sizeLabel: string;
  status: SourceStatus;
  processor: string;
  content: string;
  originalInput?: string | undefined;
  failureReason?: string | undefined;
  createdAt?: string | undefined;
  deletedAt?: string | undefined;
  storageReference?: string | undefined;
  mimeType?: string | undefined;
  providerJobId?: string | undefined;
}

export interface SourceReference {
  sourceAssetId: string;
  position: string;
  heading?: string | undefined;
  page?: number | undefined;
  slide?: number | undefined;
  timestampSeconds?: number | undefined;
}

export interface DerivedSourceDocument {
  id: string;
  sourceAssetId: string;
  processor: string;
  processorVersion: string;
  outputType: 'markdown' | 'transcript' | 'text';
  content: string;
  quality: 'high' | 'medium' | 'low';
  createdAt: string;
}

export interface KnowledgeChunk {
  id: string;
  derivedSourceDocumentId: string;
  sourceAssetId: string;
  content: string;
  reference: SourceReference;
  confidence: 'high' | 'medium' | 'low';
  createdAt: string;
}

export type SourceSupport = 'source_backed' | 'partially_source_backed' | 'inferred';
export type SourceConfidence = 'high' | 'medium' | 'low' | 'none';
export type GeneratedStatus = 'empty' | 'generated' | 'edited' | 'stale';
export type ActivityType =
  | 'retrieval_check'
  | 'practice_task'
  | 'scenario_decision'
  | 'ordering_matching'
  | 'rubric_answer';

export const activityTypes = [
  'retrieval_check',
  'practice_task',
  'scenario_decision',
  'ordering_matching',
  'rubric_answer',
] as const satisfies readonly ActivityType[];

export type CourseLanguage = 'en' | 'cs';
export type CourseLanguagePreference = 'source' | CourseLanguage;

export interface CoursePreparation {
  activityMixPreference: string;
  audience: string;
  constraints: string;
  depth: string;
  desiredOutcome: string;
  language: CourseLanguage;
  languagePreference: CourseLanguagePreference;
  priorKnowledge: string;
  sourceStrictness: 'standard' | 'strict';
  tone: string;
}

export interface LearningObjective {
  id: string;
  title: string;
  capability: string;
  topicName: string;
  sourceSupport: SourceSupport;
  sourceConfidence: SourceConfidence;
  sourceReferences?: readonly SourceReference[] | undefined;
  status: GeneratedStatus;
  updatedAt: string;
}

export interface ActivityBrief {
  id: string;
  objectiveId: string;
  objectiveIds: readonly string[];
  type: ActivityType;
  title: string;
  instructions: string;
  learnerAction: string;
  successCriteria: string;
  feedbackGuidance: string;
  sourceConfidence: SourceConfidence;
  sourceReferences?: readonly SourceReference[] | undefined;
  status: GeneratedStatus;
  updatedAt: string;
}

export interface RetrievalChoice {
  id: string;
  text: string;
  isCorrect: boolean;
  feedback: string;
}

export interface RetrievalCheckInteraction {
  kind: 'retrieval_check';
  question: string;
  choices: readonly RetrievalChoice[];
  explanationPrompt: string;
  feedback: string;
}

export interface PracticeTaskInteraction {
  kind: 'practice_task';
  prompt: string;
  submissionLabel: string;
  checklist: readonly string[];
  feedback: string;
}

export interface ScenarioChoice {
  id: string;
  text: string;
  isPreferred: boolean;
  consequence: string;
  feedback: string;
}

export interface ScenarioDecisionInteraction {
  kind: 'scenario_decision';
  scenario: string;
  choices: readonly ScenarioChoice[];
  justificationPrompt: string;
  feedback: string;
}

export interface OrderingMatchingItem {
  id: string;
  text: string;
  correctPosition?: number | undefined;
  matchLabel?: string | undefined;
}

export interface OrderingMatchingInteraction {
  kind: 'ordering_matching';
  mode: 'matching' | 'ordering';
  prompt: string;
  items: readonly OrderingMatchingItem[];
  feedback: string;
}

export interface RubricAnswerInteraction {
  kind: 'rubric_answer';
  prompt: string;
  criteria: readonly string[];
  feedback: string;
}

export interface NotPlayableInteraction {
  kind: 'not_playable';
  prompt: string;
  reason: string;
  feedback: string;
}

export type ActivityInteraction =
  | RetrievalCheckInteraction
  | PracticeTaskInteraction
  | ScenarioDecisionInteraction
  | OrderingMatchingInteraction
  | RubricAnswerInteraction
  | NotPlayableInteraction;

interface GeneratedActivityBase {
  id: string;
  briefId: string;
  objectiveIds: readonly string[];
  sourceConfidence: SourceConfidence;
  status: GeneratedStatus;
  sourceReferences?: readonly SourceReference[] | undefined;
}

export type GeneratedActivity =
  | (GeneratedActivityBase & {
      interaction: RetrievalCheckInteraction;
      type: 'retrieval_check';
    })
  | (GeneratedActivityBase & {
      interaction: PracticeTaskInteraction;
      type: 'practice_task';
    })
  | (GeneratedActivityBase & {
      interaction: ScenarioDecisionInteraction;
      type: 'scenario_decision';
    })
  | (GeneratedActivityBase & {
      interaction: OrderingMatchingInteraction;
      type: 'ordering_matching';
    })
  | (GeneratedActivityBase & {
      interaction: RubricAnswerInteraction;
      type: 'rubric_answer';
    })
  | (GeneratedActivityBase & {
      interaction: NotPlayableInteraction;
      type: 'not_playable';
    });

export interface LearningBlueprint {
  coursePreparation: CoursePreparation;
  assumptions: readonly string[];
  objectives: readonly LearningObjective[];
  activityBriefs: readonly ActivityBrief[];
  generatedActivities: readonly GeneratedActivity[];
  sourceCoverage: SourceSupport;
  createdAt: string;
  updatedAt: string;
}

export type ContentBlockType =
  | 'objective'
  | 'source_explanation'
  | 'worked_example'
  | 'interactive_activity'
  | 'reflection'
  | 'summary';

export interface CourseContentBlock {
  id: string;
  type: ContentBlockType;
  title: string;
  body: string;
  objectiveIds: readonly string[];
  sourceConfidence: SourceConfidence;
  status: GeneratedStatus;
  activityId?: string | undefined;
  sourceReferences?: readonly SourceReference[] | undefined;
}

export interface CourseSection {
  id: string;
  title: string;
  summary: string;
  objectiveIds: readonly string[];
  blocks: readonly CourseContentBlock[];
  sourceConfidence: SourceConfidence;
  status: GeneratedStatus;
  sourceReferences?: readonly SourceReference[] | undefined;
}

export interface CourseContent {
  sections: readonly CourseSection[];
  createdAt: string;
  updatedAt: string;
  status: GeneratedStatus;
}

export interface ReviewFinding {
  id: string;
  severity: 'info' | 'warning' | 'blocking';
  title: string;
  detail: string;
  status: 'open' | 'resolved' | 'dismissed';
  fingerprint: string;
  step: DraftStep;
  targetId: string;
  targetType: 'activity' | 'block' | 'course' | 'objective' | 'preparation' | 'section' | 'source';
}

export type AiRunStatus =
  | 'queued'
  | 'running'
  | 'needs_review'
  | 'applied'
  | 'failed'
  | 'cancelled';

export type AiRunType =
  | 'course_generation'
  | 'learning_blueprint_generation'
  | 'course_content_generation'
  | 'teaching_quality_review';

export interface AiRun {
  id: string;
  draftId: string;
  type: AiRunType;
  status: AiRunStatus;
  provider: string;
  model: string;
  inputSummary: string;
  outputText?: string | undefined;
  failureReason?: string | undefined;
  providerRequestId?: string | undefined;
  createdAt: string;
  updatedAt: string;
  appliedAt?: string | undefined;
}

export interface CourseDraft {
  id: string;
  ownerId: string;
  title: string;
  mode: AiMode;
  step: DraftStep;
  language: CourseLanguage;
  sources: readonly SourceAsset[];
  derivedSourceDocuments: readonly DerivedSourceDocument[];
  knowledgeChunks: readonly KnowledgeChunk[];
  sourceProcessingIncomplete: boolean;
  learningBlueprint: LearningBlueprint;
  courseContent: CourseContent;
  findings: readonly ReviewFinding[];
  aiRuns: readonly AiRun[];
  createdAt: string;
  updatedAt: string;
}

export interface CourseDraftSummary {
  id: string;
  title: string;
  mode: AiMode;
  step: DraftStep;
  language: CourseLanguage;
  sourceCount: number;
  objectiveCount: number;
  activityCount: number;
  sectionCount: number;
  updatedAt: string;
}

export interface WorkflowSnapshot {
  config: {
    aiProviderConfigured: boolean;
    auth: 'better-auth';
    deepgramConfigured: boolean;
    llamaParseConfigured: boolean;
    storage: 'json-file';
    webExtractionConfigured: boolean;
  };
  draft: CourseDraft | null;
  drafts: readonly CourseDraftSummary[];
}

export type WorkflowAction =
  | { action: 'getState' }
  | { action: 'createDraft'; title: string; language: CourseLanguage }
  | { action: 'selectDraft'; draftId: string }
  | { action: 'deleteDraft'; confirm: true; draftId: string }
  | { action: 'updateDraftTitle'; draftId: string; title: string }
  | { action: 'goToStep'; draftId: string; step: DraftStep }
  | { action: 'setMode'; draftId: string; mode: AiMode }
  | { action: 'generateCourse'; draftId: string }
  | {
      action: 'addSource';
      draftId: string;
      source: { type: SourceType; name: string; content: string; sizeLabel?: string | undefined };
    }
  | { action: 'deleteSource'; draftId: string; sourceId: string }
  | { action: 'retrySource'; draftId: string; sourceId: string }
  | { action: 'retryAiRun'; draftId: string; runId: string }
  | { action: 'updateCoursePreparation'; draftId: string; preparation: CoursePreparation }
  | { action: 'generateLearningBlueprint'; draftId: string }
  | {
      action: 'updateLearningObjective';
      draftId: string;
      objectiveId: string;
      title: string;
      capability: string;
    }
  | {
      action: 'updateActivityBrief';
      draftId: string;
      briefId: string;
      type: ActivityType;
      title: string;
      instructions: string;
      learnerAction: string;
      successCriteria: string;
      feedbackGuidance: string;
    }
  | { action: 'generateCourseContent'; draftId: string }
  | {
      action: 'setFindingStatus';
      draftId: string;
      findingId: string;
      status: 'resolved' | 'dismissed';
    }
  | { action: 'openPreview'; draftId: string };

export const emptyCoursePreparation = (language: CourseLanguage): CoursePreparation => ({
  activityMixPreference: '',
  audience: '',
  constraints: '',
  depth: '',
  desiredOutcome: '',
  language,
  languagePreference: 'source',
  priorKnowledge: '',
  sourceStrictness: 'standard',
  tone: '',
});

const emptyTimestamp = '1970-01-01T00:00:00.000Z';

export const emptyLearningBlueprint = (language: CourseLanguage): LearningBlueprint => {
  const timestamp = emptyTimestamp;
  return {
    activityBriefs: [],
    assumptions: [],
    coursePreparation: emptyCoursePreparation(language),
    createdAt: timestamp,
    generatedActivities: [],
    objectives: [],
    sourceCoverage: 'inferred',
    updatedAt: timestamp,
  };
};

export const emptyCourseContent = (): CourseContent => {
  const timestamp = emptyTimestamp;
  return {
    createdAt: timestamp,
    sections: [],
    status: 'empty',
    updatedAt: timestamp,
  };
};

const activeSources = (draft: CourseDraft) =>
  draft.sources.filter((source) => source.status !== 'deleted');

export const hasUsableSourceMaterial = (draft: CourseDraft) =>
  activeSources(draft).some(
    (source) =>
      (source.status === 'processed' || source.status === 'partially_processed') &&
      source.content.trim().length > 0,
  );

export const hasCoursePreparation = (draft: CourseDraft) => {
  const preparation = draft.learningBlueprint.coursePreparation;
  return [
    preparation.desiredOutcome,
    preparation.audience,
    preparation.activityMixPreference,
    preparation.priorKnowledge,
    preparation.depth,
    preparation.constraints,
  ].some((value) => value.trim().length > 0);
};

export const hasObjectiveMap = (draft: CourseDraft) =>
  draft.learningBlueprint.objectives.some((objective) => objective.title.trim().length > 0);

export const hasActivityPlan = (draft: CourseDraft) =>
  draft.learningBlueprint.activityBriefs.some(
    (brief) =>
      brief.title.trim().length > 0 &&
      brief.learnerAction.trim().length > 0 &&
      brief.successCriteria.trim().length > 0,
  );

export const hasGeneratedActivities = (draft: CourseDraft) =>
  draft.learningBlueprint.generatedActivities.length > 0;

export const hasCourseContent = (draft: CourseDraft) =>
  draft.courseContent.sections.some((section) =>
    section.blocks.some((block) => block.title.trim().length > 0 || block.body.trim().length > 0),
  );

export const hasGeneratedCourse = (draft: CourseDraft) =>
  hasCoursePreparation(draft) &&
  hasObjectiveMap(draft) &&
  hasActivityPlan(draft) &&
  (hasCourseContent(draft) || hasGeneratedActivities(draft));

export type WorkflowGateReason =
  | 'sourceRequired'
  | 'preparationRequired'
  | 'objectivesRequired'
  | 'activityPlanRequired'
  | 'courseContentRequired'
  | 'fullCourseGenerationRequired'
  | 'blockingFinding';

export interface WorkflowGate {
  allowed: boolean;
  reason?: WorkflowGateReason;
  blockedStep?: DraftStep;
  finding?: ReviewFinding;
}

export interface WorkflowGateOptions {
  blockOpenFindings?: boolean;
}

export const workflowStepIndex = (step: DraftStep) => {
  if (step === 'preview') {
    return workflowSteps.length;
  }
  return workflowSteps.indexOf(step as WorkflowStep);
};

const firstOpenBlockingFinding = (draft: CourseDraft, targetStep: DraftStep) => {
  const targetIndex = workflowStepIndex(targetStep);
  return draft.findings.find(
    (finding) =>
      finding.status === 'open' &&
      finding.severity === 'blocking' &&
      workflowStepIndex(finding.step) <= targetIndex,
  );
};

export const getWorkflowPrerequisiteGate = (
  draft: CourseDraft,
  targetStep: DraftStep,
  options: WorkflowGateOptions = {},
): WorkflowGate => {
  const targetIndex = workflowStepIndex(targetStep);
  if (targetIndex < 0) {
    return { allowed: false };
  }

  if (options.blockOpenFindings === true) {
    const finding = firstOpenBlockingFinding(draft, targetStep);
    if (finding !== undefined) {
      return {
        allowed: false,
        blockedStep: finding.step,
        finding,
        reason: 'blockingFinding',
      };
    }
  }

  if (targetIndex > workflowStepIndex('sources') && !hasUsableSourceMaterial(draft)) {
    return { allowed: false, blockedStep: 'sources', reason: 'sourceRequired' };
  }

  if (draft.mode === 'generate' && targetIndex > workflowStepIndex('sources')) {
    return hasGeneratedCourse(draft)
      ? { allowed: true }
      : { allowed: false, blockedStep: 'sources', reason: 'fullCourseGenerationRequired' };
  }

  if (targetIndex > workflowStepIndex('preparation') && !hasCoursePreparation(draft)) {
    return { allowed: false, blockedStep: 'preparation', reason: 'preparationRequired' };
  }
  if (targetIndex > workflowStepIndex('objectives') && !hasObjectiveMap(draft)) {
    return { allowed: false, blockedStep: 'objectives', reason: 'objectivesRequired' };
  }
  if (targetIndex > workflowStepIndex('activityPlan') && !hasActivityPlan(draft)) {
    return { allowed: false, blockedStep: 'activityPlan', reason: 'activityPlanRequired' };
  }
  if (targetIndex > workflowStepIndex('courseContent') && !hasCourseContent(draft)) {
    return { allowed: false, blockedStep: 'courseContent', reason: 'courseContentRequired' };
  }

  return { allowed: true };
};

export const getWorkflowStepGate = (draft: CourseDraft, targetStep: DraftStep): WorkflowGate => {
  const currentIndex = workflowStepIndex(draft.step);
  const targetIndex = workflowStepIndex(targetStep);
  if (targetIndex < 0) {
    return { allowed: false };
  }
  if (targetIndex <= currentIndex) {
    return { allowed: true };
  }
  return getWorkflowPrerequisiteGate(draft, targetStep, { blockOpenFindings: true });
};

export const getWorkflowPreviewGate = (
  draft: CourseDraft,
  options: WorkflowGateOptions = {},
): WorkflowGate => getWorkflowPrerequisiteGate(draft, 'preview', options);

const findingWithPreservedStatus = (
  draft: CourseDraft,
  finding: Omit<ReviewFinding, 'status'>,
): ReviewFinding => {
  const existing = draft.findings.find(
    (candidate) => candidate.fingerprint === finding.fingerprint,
  );
  return {
    ...finding,
    status: existing?.status ?? 'open',
  };
};

export const buildFindings = (draft: CourseDraft): ReviewFinding[] => {
  const findings: ReviewFinding[] = [];
  const staleObjectiveCount = draft.learningBlueprint.objectives.filter(
    (objective) => objective.status === 'stale',
  ).length;
  const staleActivityCount = [
    ...draft.learningBlueprint.activityBriefs,
    ...draft.learningBlueprint.generatedActivities,
  ].filter((item) => item.status === 'stale').length;
  const staleContentCount =
    (draft.courseContent.status === 'stale' ? 1 : 0) +
    draft.courseContent.sections.filter((section) => section.status === 'stale').length +
    draft.courseContent.sections
      .flatMap((section) => section.blocks)
      .filter((block) => block.status === 'stale').length;

  if (draft.sourceProcessingIncomplete) {
    findings.push(
      findingWithPreservedStatus(draft, {
        detail:
          'Some source material is still processing. Generated objectives and activities may need regeneration after processing finishes.',
        fingerprint: `${draft.id}:source-processing-incomplete`,
        id: `finding_${draft.id}_source_processing`,
        severity: 'blocking',
        step: 'sources',
        targetId: draft.id,
        targetType: 'source',
        title: 'Source processing is incomplete',
      }),
    );
  }

  if (staleObjectiveCount > 0 || staleActivityCount > 0 || staleContentCount > 0) {
    findings.push(
      findingWithPreservedStatus(draft, {
        detail:
          'Source material or preparation changed after generation. Regenerate affected objectives, activities, or course content before validating the course with learners.',
        fingerprint: [
          draft.id,
          'stale-generated-learning',
          staleObjectiveCount,
          staleActivityCount,
          staleContentCount,
        ].join(':'),
        id: `finding_${draft.id}_stale_generated_learning`,
        severity: 'warning',
        step: staleObjectiveCount > 0 ? 'objectives' : 'activityPlan',
        targetId: draft.id,
        targetType: 'course',
        title: 'Generated learning plan is stale',
      }),
    );
  }

  if (
    draft.learningBlueprint.coursePreparation.sourceStrictness === 'strict' &&
    draft.learningBlueprint.objectives.some((objective) => objective.sourceConfidence === 'none')
  ) {
    findings.push(
      findingWithPreservedStatus(draft, {
        detail:
          'Strict source mode is enabled, but at least one objective has no source confidence. Regenerate from stronger source material or relax source strictness.',
        fingerprint: `${draft.id}:strict-objective-source-gap`,
        id: `finding_${draft.id}_strict_objective_source_gap`,
        severity: 'blocking',
        step: 'objectives',
        targetId: draft.id,
        targetType: 'objective',
        title: 'Objective is not source-backed',
      }),
    );
  }

  if (
    hasActivityPlan(draft) &&
    draft.learningBlueprint.generatedActivities.length <
      draft.learningBlueprint.activityBriefs.length
  ) {
    findings.push(
      findingWithPreservedStatus(draft, {
        detail:
          'Every activity brief should have a generated learner interaction before the preview is validated with users.',
        fingerprint: `${draft.id}:missing-generated-activities`,
        id: `finding_${draft.id}_missing_generated_activities`,
        severity: 'warning',
        step: 'activityPlan',
        targetId: draft.id,
        targetType: 'activity',
        title: 'Activity interaction is missing',
      }),
    );
  }

  return findings;
};

export const staleLearningBlueprint = (
  blueprint: LearningBlueprint,
  timestamp: string,
): LearningBlueprint => ({
  ...blueprint,
  activityBriefs: blueprint.activityBriefs.map((brief) => ({
    ...brief,
    status: brief.status === 'empty' ? 'empty' : 'stale',
    updatedAt: timestamp,
  })),
  generatedActivities: blueprint.generatedActivities.map((activity) => ({
    ...activity,
    status: activity.status === 'empty' ? 'empty' : 'stale',
  })),
  objectives: blueprint.objectives.map((objective) => ({
    ...objective,
    status: objective.status === 'empty' ? 'empty' : 'stale',
    updatedAt: timestamp,
  })),
  updatedAt: timestamp,
});

export const staleCourseContent = (content: CourseContent, timestamp: string): CourseContent => ({
  ...content,
  sections: content.sections.map((section) => ({
    ...section,
    blocks: section.blocks.map((block) => ({
      ...block,
      status: block.status === 'empty' ? 'empty' : 'stale',
    })),
    status: section.status === 'empty' ? 'empty' : 'stale',
  })),
  status: content.status === 'empty' ? 'empty' : 'stale',
  updatedAt: timestamp,
});
