/*
 * Coursition domain model.
 *
 * The domain types are defined once as Effect schemas in ./effect-api and
 * re-exported here so the wire contract, runtime validation, and these
 * TypeScript types share a single source of truth. This module layers the
 * workflow ordering, prerequisite gates, findings, and staleness rules on top
 * of that model.
 */
import type {
  ActivityType,
  CourseContent,
  CourseDraft,
  CourseLanguage,
  CoursePreparation,
  DraftStep,
  GeneratedActivity,
  LearningBlueprint,
  ReviewFinding,
} from './effect-api';

export type {
  ActivityEvaluationCriterion,
  ActivityEvaluationRequest,
  ActivityEvaluationResponse,
  ActivityBrief,
  ActivityInteraction,
  ActivityType,
  AiMode,
  AiRun,
  AiRunStatus,
  AiRunType,
  ContentBlockType,
  CourseContent,
  CourseContentBlock,
  CourseDraft,
  CourseDraftSummary,
  CourseLanguage,
  CourseLanguagePreference,
  CoursePreparation,
  CourseSection,
  DerivedSourceDocument,
  DraftStep,
  GeneratedActivity,
  GeneratedStatus,
  KnowledgeChunk,
  LearningBlueprint,
  LearningObjective,
  NotPlayableInteraction,
  OrderingMatchingInteraction,
  OrderingMatchingItem,
  PracticeTaskInteraction,
  RetrievalCheckInteraction,
  RetrievalChoice,
  ReviewFinding,
  RubricAnswerInteraction,
  ScenarioChoice,
  ScenarioDecisionInteraction,
  SourceAsset,
  SourceConfidence,
  SourceReference,
  SourceStatus,
  SourceSupport,
  SourceType,
  WorkflowAction,
  WorkflowSnapshot,
} from './effect-api';

export const workflowSteps = [
  'mode',
  'sources',
  'preparation',
  'objectives',
  'activityPlan',
  'courseContent',
] as const satisfies readonly DraftStep[];

export type WorkflowStep = (typeof workflowSteps)[number];

export const activityTypes = [
  'retrieval_check',
  'practice_task',
  'scenario_decision',
  'ordering_matching',
  'rubric_answer',
] as const satisfies readonly ActivityType[];

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

export const isPlayableGeneratedActivity = (activity: GeneratedActivity) =>
  activity.type !== 'not_playable' && activity.status !== 'empty' && activity.status !== 'stale';

export const hasGeneratedActivities = (draft: CourseDraft) =>
  draft.learningBlueprint.generatedActivities.some(isPlayableGeneratedActivity);

export const missingPlayableActivityBriefIds = (draft: CourseDraft) => {
  const playableBriefIds = new Set(
    draft.learningBlueprint.generatedActivities
      .filter(isPlayableGeneratedActivity)
      .map((activity) => activity.briefId),
  );
  return draft.learningBlueprint.activityBriefs
    .filter((brief) => brief.status !== 'empty')
    .map((brief) => brief.id)
    .filter((briefId) => !playableBriefIds.has(briefId));
};

export const hasPlayableGeneratedActivityCoverage = (draft: CourseDraft) =>
  hasActivityPlan(draft) && missingPlayableActivityBriefIds(draft).length === 0;

export const hasCourseContent = (draft: CourseDraft) =>
  draft.courseContent.sections.some((section) =>
    section.blocks.some((block) => block.title.trim().length > 0 || block.body.trim().length > 0),
  );

export const hasGeneratedCourse = (draft: CourseDraft) =>
  hasCoursePreparation(draft) &&
  hasObjectiveMap(draft) &&
  hasActivityPlan(draft) &&
  hasPlayableGeneratedActivityCoverage(draft) &&
  hasCourseContent(draft);

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
  return workflowSteps.indexOf(step);
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
  if (
    targetIndex >= workflowStepIndex('courseContent') &&
    !hasPlayableGeneratedActivityCoverage(draft)
  ) {
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

  const missingActivityBriefIds = missingPlayableActivityBriefIds(draft);
  if (hasActivityPlan(draft) && missingActivityBriefIds.length > 0) {
    findings.push(
      findingWithPreservedStatus(draft, {
        detail:
          'Every activity brief should have a generated learner interaction before the preview is validated with users.',
        fingerprint: `${draft.id}:missing-generated-activities:${missingActivityBriefIds.join(',')}`,
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
