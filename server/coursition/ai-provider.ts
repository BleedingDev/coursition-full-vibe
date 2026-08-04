import { ai as createAxAI, flow } from '@ax-llm/ax/ai-flow';
import type { AxAIOpenAIModel, AxForwardable } from '@ax-llm/ax';
import * as Data from 'effect/Data';
import { DateTime } from 'effect';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import * as Schema from 'effect/Schema';
import { activityTypeSchema } from '../../shared/api.ts';
import { activityTypes } from '../../shared/coursition/workflow.ts';
import type { AiProviderConfig } from './ai-provider-config.ts';
import type {
  ActivityEvaluationCriterion,
  ActivityEvaluationResponse,
  ActivityBrief,
  ActivityType,
  CourseContent,
  CourseContentBlock,
  CourseDraft,
  CourseSection,
  GeneratedActivity,
  LearningBlueprint,
  LearningObjective,
  SourceConfidence,
  SourceReference,
  SourceSupport,
} from '../../shared/coursition/workflow.ts';
import {
  aiCallTimeoutMs,
  aiProviderConfig,
  defaultAiModel,
  isFreeAiModel,
} from './ai-provider-config.ts';

export { aiProviderConfig, isAiProviderConfigured } from './ai-provider-config.ts';

interface AiJsonResult<T> {
  model: string;
  provider: string;
  text: string;
  value: T;
}

class AiProviderEffectError extends Data.TaggedError('AiProviderEffectError')<{
  readonly cause: unknown;
  readonly message: string;
}> {}

class AiProviderContractError extends Data.TaggedError('AiProviderContractError')<{
  readonly field?: string;
  readonly message: string;
}> {}

class AiProviderConfigurationError extends Data.TaggedError('AiProviderConfigurationError')<{
  readonly message: string;
}> {}

const localCourseContentRendererProvider = 'local-course-content-renderer';

interface ActivityGenerationFlowInput {
  activityPolicy: string;
  courseTitle: string;
  existingPreparation: string;
  languageCode: string;
  sourceEvidence: string;
}

interface ActivityGenerationFlowOutput {
  activityBriefs: unknown;
  assumptions: string;
  coursePreparation: unknown;
  objectives: unknown;
  outputLanguage: string;
}

interface CoursePreparationFlowInput {
  activityPolicy: string;
  courseTitle: string;
  existingPreparation: string;
  languageCode: string;
  sourceEvidence: string;
}

interface CoursePreparationFlowOutput {
  assumptions: string;
  coursePreparation: unknown;
  outputLanguage: string;
}

interface PlayableActivityFlowInput {
  activityBriefJson: string;
  activityPolicy: string;
  objectiveJson: string;
  outputLanguage: string;
  sourceEvidence: string;
}

interface PlayableActivityFlowOutput {
  generatedActivityJson: string;
  qualityReview: string;
  qualityScore: number;
}

interface ActivityEvaluationFlowInput {
  activityContextJson: string;
  answer: string;
  checkedCriteriaJson: string;
  criteriaInputJson: string;
  evaluatorPolicy: string;
  inputMaterial: string;
  outputLanguage: string;
  question: string;
  sourceEvidence: string;
}

interface ActivityEvaluationFlowOutput {
  criteriaEvaluationJson: string;
  feedbackMarkdown: string;
  nextStep: string;
  score: number;
}

const coursePlannerResultSchema = Schema.Struct({
  assumptions: Schema.String,
  coursePreparation: Schema.Unknown,
  objectives: Schema.Unknown,
  outputLanguage: Schema.String,
});
const coursePreparationPlannerResultSchema = Schema.Struct({
  assumptions: Schema.String,
  coursePreparation: Schema.Unknown,
  outputLanguage: Schema.String,
});
const playableActivityWriterResultSchema = Schema.Struct({
  generatedActivityJson: Schema.String,
});
const activityQualityJudgeResultSchema = Schema.Struct({
  passed: Schema.Boolean,
  qualityReview: Schema.String,
  qualityScore: Schema.Finite,
  repairGuidance: Schema.String,
});
const activityEvaluationFlowResultSchema = Schema.Struct({
  criteriaEvaluationJson: Schema.String,
  feedbackMarkdown: Schema.String,
  nextStep: Schema.String,
  score: Schema.Finite,
});

const coursePlannerResultFrom = Schema.decodeUnknownSync(coursePlannerResultSchema);
const coursePreparationPlannerResultFrom = Schema.decodeUnknownSync(
  coursePreparationPlannerResultSchema,
);
const playableActivityWriterResultFrom = Schema.decodeUnknownSync(
  playableActivityWriterResultSchema,
);
const activityQualityJudgeResultFrom = Schema.decodeUnknownSync(activityQualityJudgeResultSchema);
const activityEvaluationFlowResultFrom = Schema.decodeUnknownSync(
  activityEvaluationFlowResultSchema,
);

const activityJudgeRubric = [
  'Score from 0 to 1.',
  '',
  'A generated activity pack passes only if:',
  '1. Every activity uses exactly one of the five reusable engines.',
  '2. Every activity has a clear learner action.',
  '3. Every activity is self-contained.',
  '4. Every activity is grounded in the supplied source evidence or clearly simple enough for the evidence.',
  '5. Wrong-answer feedback teaches a misconception, missing condition, or better strategy.',
  '6. Open-ended activities have observable criteria.',
  '7. The set contains variety: not only retrieval checks.',
  '8. At least one activity asks for transfer or application, not only recognition.',
  '9. No activity depends on hidden evaluator notes.',
  '10. No activity is merely decorative.',
  '',
  'Return passed=false if the activity pack would embarrass a course creator in front of a real learner.',
  'Repair guidance must be specific enough for the playableActivityWriter to fix the activity pack.',
].join('\n');

const learningPlanOutputContract = [
  'Planning output contract:',
  '',
  'coursePreparation must be one JSON object with exactly these learner-facing string fields:',
  '- audience',
  '- desiredOutcome',
  '- priorKnowledge',
  '- tone',
  '- depth',
  '- constraints',
  '- activityMixPreference',
  '- sourceStrictness with value "strict" or "standard"',
  '',
  'Every objective object in objectives must use these exact keys:',
  '- title: short learner-facing title',
  '- topicName: source-backed topic name',
  '- capability: observable learner capability',
  '- sourceSupport: "source_backed" or "inferred"',
  '- sourceConfidence: "high", "medium", "low", or "none"',
  '',
  'Every activity brief object in activityBriefs must use these exact keys:',
  '- objectiveIds: array of objective ids from the objectives output',
  '- title: short internal activity title',
  '- type: one of retrieval_check, scenario_decision, ordering_matching, practice_task, rubric_answer',
  '- learnerAction: one concrete learner action',
  '- instructions: learner-facing activity instructions',
  '- successCriteria: observable completion criteria',
  '- feedbackGuidance: how feedback should teach the source-backed point',
  '- sourceConfidence: "high", "medium", "low", or "none"',
  '',
  'Do not rename these keys.',
  'Do not output arrays of strings.',
  'Do not wrap arrays inside objects.',
  'Do not include markdown around JSON values.',
].join('\n');

const coursePreparationOutputContract = [
  'Course preparation output contract:',
  '',
  'coursePreparation must be one JSON object with exactly these learner-facing string fields:',
  '- audience',
  '- desiredOutcome',
  '- priorKnowledge',
  '- tone',
  '- depth',
  '- constraints',
  '- activityMixPreference',
  '- sourceStrictness with value "strict" or "standard"',
  '',
  'Do not rename these keys.',
  'Do not wrap coursePreparation inside another object.',
  'Do not include objectives or activity briefs.',
  'Do not include markdown around JSON values.',
].join('\n');

const playableActivityOutputContract = [
  'Playable activity output contract:',
  '',
  'generatedActivityJson must be one JSON object for the requested activity brief type.',
  'Do not wrap it in another object.',
  'Do not include markdown.',
  'Use exactly the keys listed for the selected type.',
  '',
  'retrieval_check keys:',
  '- type: "retrieval_check"',
  '- question: learner-facing question',
  '- choices: array of 3 or 4 objects with text, isCorrect, feedback',
  '- explanationPrompt: short prompt asking learner to explain the source cue',
  '- feedback: overall feedback guidance',
  'Exactly one retrieval_check choice must have isCorrect=true.',
  '',
  'scenario_decision keys:',
  '- type: "scenario_decision"',
  '- prompt: concrete scenario text',
  '- choices: array of 2 to 4 objects with text, isPreferred, consequence, feedback',
  '- justificationPrompt: short prompt asking learner to justify the decision',
  '- feedback: overall feedback guidance',
  'Exactly one scenario_decision choice must have isPreferred=true.',
  '',
  'ordering_matching keys:',
  '- type: "ordering_matching"',
  '- mode: "ordering" or "matching"',
  '- prompt: learner-facing task prompt',
  '- items: array of objects',
  '- feedback: overall feedback guidance',
  'For mode="ordering", each item must have text and unique correctPosition starting at 1.',
  'For mode="matching", each item must have text and matchLabel, with at least two distinct labels.',
  '',
  'practice_task keys:',
  '- type: "practice_task"',
  '- prompt: learner-facing production task',
  '- submissionLabel: short label for the learner response',
  '- criteria: array of at least 2 observable checklist strings',
  '- feedback: overall feedback guidance',
  '',
  'rubric_answer keys:',
  '- type: "rubric_answer"',
  '- prompt: learner-facing critique or improvement task',
  '- criteria: array of at least 2 rubric criterion strings',
  '- feedback: overall feedback guidance',
].join('\n');

const activityEvaluationOutputContract = [
  'Activity evaluation output contract:',
  '',
  'Evaluate the learner answer against the supplied question, input material, source evidence, activity context, criteria, and learner-selected criteria.',
  'Return feedback in the requested outputLanguage.',
  'feedbackMarkdown must be concise Markdown with:',
  '- one short overall judgment',
  '- specific evidence from the learner answer',
  '- missing or weak points tied to the criteria',
  '- one concrete improvement instruction',
  'Do not invent requirements outside the provided activity context and criteria.',
  'Be direct but useful. Do not merely praise. Do not say you cannot grade open-ended work.',
  'score is 0 to 1.',
  'criteriaEvaluationJson must be a JSON array. Each item has exact keys criterion, met, feedback.',
  'nextStep is one short learner-facing action.',
].join('\n');

const activityPolicyForDraft = (draft: CourseDraft) => {
  const {
    learningBlueprint: {
      coursePreparation: { languagePreference },
    },
  } = draft;
  const languageInstruction =
    languagePreference === 'source'
      ? [
          'The coursePlanner must choose outputLanguage from the supplied sourceEvidence.',
          'Use the dominant learner-facing language of the input documents.',
          'If documents conflict, choose the language that best matches the course source material.',
        ].join('\n')
      : [
          `The creator explicitly selected outputLanguage=${languagePreference}.`,
          `The coursePlanner must return outputLanguage="${languagePreference}".`,
          `Every learner-facing string in coursePreparation and objectives must be written in ${languagePreference}.`,
          languagePreference === 'cs'
            ? 'Translate learner-facing content into Czech even when the course title, existing preparation, or source evidence is English. Do not copy English objective titles or capabilities.'
            : 'Translate learner-facing content into English even when the course title, existing preparation, or source evidence uses another language.',
        ].join('\n');

  return [
    languageInstruction,
    'Supported outputLanguage values are "en" and "cs".',
    'All learner-facing content must use the chosen outputLanguage.',
    '',
    'Coursition has exactly five reusable activity engines:',
    '1. retrieval_check - recall or recognize one source-backed concept, rule, fact, or small procedure step.',
    '2. scenario_decision - choose a realistic next action in a concrete situation and see consequences.',
    '3. ordering_matching - sequence steps, match concepts to examples, or classify cards into groups.',
    '4. practice_task - produce a small artifact, answer, plan, note, fix, or decision.',
    '5. rubric_answer - write, critique, or improve an answer against explicit criteria.',
    '',
    'Never invent new game mechanics.',
    'Never generate UI code.',
    'Never generate a custom mini-app.',
    'Never output iframe/script/component instructions.',
    '',
    'Every activity must be:',
    '- source-related',
    '- self-contained',
    '- concrete',
    '- doable without reading hidden evaluator notes',
    '- useful even if the learner gets it wrong',
    '- focused on one learner action',
    '',
    'Good activities create learning through:',
    '- retrieval',
    '- discrimination',
    '- decision making',
    '- sequencing',
    '- classification',
    '- production',
    '- self-explanation',
    '- revision',
    '',
    'For wrong answers, feedback must explain the misconception or missing criterion.',
    'For correct answers, feedback must explain the principle, not only praise the learner.',
    'For open-ended tasks, criteria must be observable in the learner response.',
    '',
    'Prefer playful framing without changing mechanics:',
    '- Recall Sprint for retrieval_check',
    '- Mission Decision for scenario_decision',
    '- Build the Machine for ordering_matching',
    '- Tiny Mission for practice_task',
    '- Reviewer Mode for rubric_answer',
    '',
    'Quality judge rubric:',
    activityJudgeRubric,
    '',
    learningPlanOutputContract,
  ].join('\n');
};

const coursitionLearningPlanFlow = flow<ActivityGenerationFlowInput, ActivityGenerationFlowOutput>({
  autoParallel: false,
})
  .node(
    'coursePlanner',
    [
      'courseTitle:string,',
      'languageCode:string,',
      'existingPreparation:string,',
      'sourceEvidence:string,',
      'activityPolicy:string',
      '-> outputLanguage:string "Supported values: en or cs.",',
      'coursePreparation:json "Top-level JSON object. Every learner-facing string must be written in languageCode; when languageCode is cs, translate English source content into Czech. Do not stringify. Do not wrap in another object.",',
      'assumptions:string,',
      'objectives:string "Serialized top-level JSON array of objects, including the opening and closing square brackets. Each object must include exact keys title, topicName, capability, sourceSupport, and sourceConfidence. Every title, topicName, and capability must be written in languageCode; when languageCode is cs, translate English source content into Czech. Do not wrap the array in another object or a Markdown fence."',
    ].join(' '),
  )
  .execute('coursePlanner', (state) => ({
    activityPolicy: state.activityPolicy,
    courseTitle: state.courseTitle,
    existingPreparation: state.existingPreparation,
    languageCode: state.languageCode,
    sourceEvidence: state.sourceEvidence,
  }))
  .returns((state) => {
    const coursePlannerResult = coursePlannerResultFrom(state.coursePlannerResult);
    return {
      // The five supported activity engines are materialized deterministically
      // from the generated objectives. One advance action therefore performs
      // one remote Ax call instead of holding the Worker open for a second model.
      activityBriefs: [],
      assumptions: coursePlannerResult.assumptions,
      coursePreparation: coursePlannerResult.coursePreparation,
      objectives: coursePlannerResult.objectives,
      outputLanguage: coursePlannerResult.outputLanguage,
    };
  });

const coursitionCoursePreparationFlow = flow<
  CoursePreparationFlowInput,
  CoursePreparationFlowOutput
>({ autoParallel: false })
  .node(
    'coursePreparationPlanner',
    [
      'courseTitle:string,',
      'languageCode:string,',
      'existingPreparation:string,',
      'sourceEvidence:string,',
      'activityPolicy:string',
      '-> outputLanguage:string "Supported values: en or cs.",',
      'coursePreparation:json "Top-level JSON object with exact keys audience, desiredOutcome, priorKnowledge, tone, depth, constraints, activityMixPreference, and sourceStrictness. Every learner-facing string must be written in languageCode; when languageCode is cs, translate English source content into Czech. Do not stringify. Do not wrap in another object.",',
      'assumptions:string',
    ].join(' '),
  )
  .execute('coursePreparationPlanner', (state) => ({
    activityPolicy: [state.activityPolicy, coursePreparationOutputContract].join('\n\n'),
    courseTitle: state.courseTitle,
    existingPreparation: state.existingPreparation,
    languageCode: state.languageCode,
    sourceEvidence: state.sourceEvidence,
  }))
  .returns((state) => {
    const coursePlannerResult = coursePreparationPlannerResultFrom(
      state.coursePreparationPlannerResult,
    );
    return {
      assumptions: coursePlannerResult.assumptions,
      coursePreparation: coursePlannerResult.coursePreparation,
      outputLanguage: coursePlannerResult.outputLanguage,
    };
  });

const coursitionPlayableActivityFlow = flow<PlayableActivityFlowInput, PlayableActivityFlowOutput>({
  autoParallel: false,
})
  .node(
    'playableActivityWriter',
    [
      'outputLanguage:string,',
      'objectiveJson:string,',
      'activityBriefJson:string,',
      'sourceEvidence:string,',
      'activityPolicy:string,',
      'repairGuidance:string',
      '-> generatedActivityJson:string',
    ].join(' '),
  )
  .node(
    'activityQualityJudge',
    [
      'outputLanguage:string,',
      'objectiveJson:string,',
      'activityBriefJson:string,',
      'generatedActivityJson:string,',
      'sourceEvidence:string,',
      'activityPolicy:string',
      '-> qualityScore:number, passed:boolean, qualityReview:string, repairGuidance:string',
    ].join(' '),
  )
  .map((state) => ({
    ...state,
    repairAttempt: 0,
    repairGuidance: 'First attempt: write one valid playable activity from the brief and policy.',
  }))
  .label('writeAndJudgeActivity')
  .map((state) => ({
    ...state,
    repairAttempt: state.repairAttempt + 1,
  }))
  .execute('playableActivityWriter', (state) => ({
    activityBriefJson: state.activityBriefJson,
    activityPolicy: state.activityPolicy,
    objectiveJson: state.objectiveJson,
    outputLanguage: state.outputLanguage,
    repairGuidance:
      state.repairGuidance ||
      'First attempt: write one valid playable activity from the brief and policy.',
    sourceEvidence: state.sourceEvidence,
  }))
  .execute('activityQualityJudge', (state) => {
    const playableActivityWriterResult = playableActivityWriterResultFrom(
      state.playableActivityWriterResult,
    );
    return {
      activityBriefJson: state.activityBriefJson,
      activityPolicy: state.activityPolicy,
      generatedActivityJson: playableActivityWriterResult.generatedActivityJson,
      objectiveJson: state.objectiveJson,
      outputLanguage: state.outputLanguage,
      sourceEvidence: state.sourceEvidence,
    };
  })
  .map((state) => {
    const activityQualityJudgeResult = activityQualityJudgeResultFrom(
      state.activityQualityJudgeResult,
    );
    return {
      ...state,
      repairGuidance: activityQualityJudgeResult.repairGuidance,
    };
  })
  .feedback((state) => {
    const activityQualityJudgeResult = activityQualityJudgeResultFrom(
      state.activityQualityJudgeResult,
    );
    return (
      activityQualityJudgeResult.passed === false &&
      activityQualityJudgeResult.qualityScore < 0.82 &&
      state.repairAttempt < 3
    );
  }, 'writeAndJudgeActivity')
  .returns((state) => {
    const activityQualityJudgeResult = activityQualityJudgeResultFrom(
      state.activityQualityJudgeResult,
    );
    const playableActivityWriterResult = playableActivityWriterResultFrom(
      state.playableActivityWriterResult,
    );
    return {
      generatedActivityJson: playableActivityWriterResult.generatedActivityJson,
      qualityReview: activityQualityJudgeResult.qualityReview,
      qualityScore: activityQualityJudgeResult.qualityScore,
    };
  });

const coursitionActivityEvaluationFlow = flow<
  ActivityEvaluationFlowInput,
  ActivityEvaluationFlowOutput
>({
  autoParallel: false,
})
  .node(
    'activityEvaluator',
    [
      'outputLanguage:string,',
      'question:string,',
      'inputMaterial:string,',
      'sourceEvidence:string,',
      'activityContextJson:string,',
      'criteriaInputJson:string,',
      'checkedCriteriaJson:string,',
      'answer:string,',
      'evaluatorPolicy:string',
      '-> feedbackMarkdown:string, score:number, criteriaEvaluationJson:string, nextStep:string',
    ].join(' '),
  )
  .execute('activityEvaluator', (state) => ({
    activityContextJson: state.activityContextJson,
    answer: state.answer,
    checkedCriteriaJson: state.checkedCriteriaJson,
    criteriaInputJson: state.criteriaInputJson,
    evaluatorPolicy: state.evaluatorPolicy,
    inputMaterial: state.inputMaterial,
    outputLanguage: state.outputLanguage,
    question: state.question,
    sourceEvidence: state.sourceEvidence,
  }))
  .returns((state) => {
    const evaluatorResult = activityEvaluationFlowResultFrom(state.activityEvaluatorResult);
    return {
      criteriaEvaluationJson: evaluatorResult.criteriaEvaluationJson,
      feedbackMarkdown: evaluatorResult.feedbackMarkdown,
      nextStep: evaluatorResult.nextStep,
      score: evaluatorResult.score,
    };
  });

const configuredAxOpenAiModel = (model: string) => model as AxAIOpenAIModel;

const createCoursitionAxAi = (config: AiProviderConfig) =>
  createAxAI({
    apiKey: config.apiKey,
    apiURL: config.baseURL,
    config: {
      model: configuredAxOpenAiModel(config.model),
      temperature: 0,
    },
    ...(isFreeAiModel(config.model)
      ? {
          modelInfo: [
            {
              name: config.model,
              supported: { structuredOutputs: true },
            },
          ],
        }
      : {}),
    name: 'openai',
    options: {
      includeRequestBodyInErrors: false,
      stream: false,
      timeout: aiCallTimeoutMs(),
    },
  });

const unknownRecordSchema = Schema.Record(Schema.String, Schema.Unknown);
const unknownJsonStringSchema = Schema.UnknownFromJsonString;
const unknownRecordJsonStringSchema = Schema.fromJsonString(unknownRecordSchema);
const activityTypeFromUnknown = Schema.decodeUnknownOption(activityTypeSchema);

const jsonTextFrom = Schema.encodeSync(unknownJsonStringSchema);

const localCourseContentRendererResult = <T>(value: T): AiJsonResult<T> => ({
  model: `${defaultAiModel}/deterministic`,
  provider: localCourseContentRendererProvider,
  text: jsonTextFrom(value),
  value,
});

const aiProviderMessageFrom = (cause: unknown) =>
  typeof cause === 'object' &&
  cause !== null &&
  'message' in cause &&
  typeof cause.message === 'string' &&
  cause.message.trim().length > 0
    ? cause.message.trim()
    : 'AI provider failed without a readable message.';

const isAiProviderEffectError = (cause: unknown): cause is AiProviderEffectError =>
  typeof cause === 'object' &&
  cause !== null &&
  '_tag' in cause &&
  cause._tag === 'AiProviderEffectError';

const toAiProviderEffectError = (cause: unknown) =>
  isAiProviderEffectError(cause)
    ? cause
    : new AiProviderEffectError({
        cause,
        message: aiProviderMessageFrom(cause),
      });

const aiProviderContractError = (message: string, field?: string) =>
  new AiProviderEffectError({
    cause: new AiProviderContractError({
      ...(field === undefined ? {} : { field }),
      message,
    }),
    message,
  });

const throwAiProviderContractError = (message: string, field?: string): never => {
  throw aiProviderContractError(message, field);
};

const generateStructuredObjectEffect = <TInput, TOutput>(
  program: AxForwardable<TInput, TOutput, string>,
  input: TInput,
) => {
  const config = aiProviderConfig();
  if (config === null) {
    const message = 'AI provider is not configured.';
    return Effect.fail(
      new AiProviderEffectError({
        cause: new AiProviderConfigurationError({
          message,
        }),
        message,
      }),
    );
  }
  const provider = createCoursitionAxAi(config);
  const timeoutMs = aiCallTimeoutMs();
  return Effect.tryPromise({
    catch: toAiProviderEffectError,
    try: () =>
      program.forward(provider, input, {
        abortSignal: AbortSignal.timeout(timeoutMs),
        stream: false,
        timeout: timeoutMs,
      }),
  }).pipe(
    Effect.map((value) => ({
      model: config.model,
      provider: config.provider,
      text: jsonTextFrom(value),
      value,
    })),
  );
};

const asRecord = Schema.decodeUnknownSync(unknownRecordSchema);

const parseGeneratedArrayValue = (value: unknown, fieldName: string): unknown[] => {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value !== 'string') {
    return throwAiProviderContractError(`${fieldName} must be a JSON array.`, fieldName);
  }
  const trimmed = value
    .trim()
    .replace(/^```(?:json)?\s*/u, '')
    .replace(/\s*```$/u, '');
  const candidates = [trimmed, `[${trimmed}]`];
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (Array.isArray(parsed)) {
        return parsed;
      }
      if (typeof parsed === 'string') {
        const reparsed = JSON.parse(parsed) as unknown;
        if (Array.isArray(reparsed)) {
          return reparsed;
        }
      }
    } catch {
      // Try the next supported serialization shape.
    }
  }
  return throwAiProviderContractError(`${fieldName} must be a JSON array.`, fieldName);
};

const parseGeneratedRecordValue = (value: unknown, fieldName: string): Record<string, unknown> => {
  const parsed =
    typeof value === 'string'
      ? Schema.decodeUnknownSync(unknownRecordJsonStringSchema)(value)
      : value;
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throwAiProviderContractError(`${fieldName} must be a JSON object.`, fieldName);
  }
  return asRecord(parsed);
};

const parseGeneratedRecordArrayValue = (
  value: unknown,
  fieldName: string,
): Record<string, unknown>[] =>
  parseGeneratedArrayValue(value, fieldName).map((item, index) => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      throwAiProviderContractError(`${fieldName}[${index}] must be a JSON object.`, fieldName);
    }
    return asRecord(item);
  });

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const asText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const firstNonEmptyText = (...values: readonly string[]) =>
  values.find((value) => value.trim().length > 0)?.trim() ?? '';

const requiredText = (value: unknown, fieldName: string): string => {
  const text = asText(value);
  if (text.length === 0) {
    throwAiProviderContractError(`AI provider returned empty ${fieldName}.`, fieldName);
  }
  return text;
};

const currentIsoTimestamp = () => DateTime.formatIso(DateTime.nowUnsafe());

const processedSourceEvidence = (draft: CourseDraft) => {
  if (draft.derivedSourceDocuments.length > 0) {
    return draft.derivedSourceDocuments
      .map((document, index) => {
        const sourceName =
          draft.sources.find((source) => source.id === document.sourceAssetId)?.name ??
          document.sourceAssetId;
        return `Document ${index + 1}: ${sourceName}\n${document.content}`;
      })
      .join('\n\n');
  }
  return draft.sources
    .filter((source) => source.status === 'processed' || source.status === 'partially_processed')
    .map((source, index) => `Source ${index + 1}: ${source.name}\n${source.content}`)
    .join('\n\n');
};

const requestedOutputLanguage = (draft: CourseDraft) =>
  draft.learningBlueprint.coursePreparation.languagePreference;

const courseContentLanguage = (draft: CourseDraft): CourseDraft['language'] => {
  const preference = draft.learningBlueprint.coursePreparation.languagePreference;
  return preference === 'source' ? draft.learningBlueprint.coursePreparation.language : preference;
};

const generatedOutputLanguage = (value: unknown): CourseDraft['language'] => {
  if (value === 'en' || value === 'cs') {
    return value;
  }
  return throwAiProviderContractError(
    'AI provider returned unsupported outputLanguage.',
    'outputLanguage',
  );
};

const sourceMatchTokens = (value: string) =>
  [...value.matchAll(/[\p{L}\p{N}][\p{L}\p{N}+#./-]*/gu)]
    .map((match) => match[0]?.toLowerCase() ?? '')
    .filter((word) => word.length > 2)
    .filter(
      (word) =>
        !new Set([
          'and',
          'are',
          'course',
          'from',
          'learn',
          'learning',
          'source',
          'that',
          'the',
          'this',
          'with',
          'kurz',
          'kurzu',
          'pro',
          'zdroj',
          'zdroje',
        ]).has(word),
    );

const objectiveEvidenceFor = (draft: CourseDraft, query: string) => {
  const queryTokens = new Set(sourceMatchTokens(query));
  const scoredChunks = draft.knowledgeChunks
    .map((chunk, index) => {
      const score = sourceMatchTokens(`${chunk.reference.heading ?? ''} ${chunk.content}`).filter(
        (token) => queryTokens.has(token),
      ).length;
      return { chunk, index, score };
    })
    .toSorted((left, right) => right.score - left.score || left.index - right.index);
  const chunks = scoredChunks.filter((entry) => entry.score > 0).slice(0, 3);
  const sourceReferences = chunks.map((entry) => entry.chunk.reference);
  let sourceConfidence: SourceConfidence = 'none';
  if (sourceReferences.length > 0) {
    const [topChunk] = chunks;
    sourceConfidence = topChunk !== undefined && topChunk.score > 2 ? 'high' : 'medium';
  }
  const sourceSupport: SourceSupport = sourceConfidence === 'none' ? 'inferred' : 'source_backed';
  return {
    sourceConfidence,
    sourceReferences,
    sourceSupport,
  };
};

const generatedActivityType = (value: unknown): ActivityType | null =>
  Option.getOrNull(activityTypeFromUnknown(value));

const preparationFromDraft = (
  draft: CourseDraft,
  generated: Record<string, unknown>,
  outputLanguage: CourseDraft['language'],
): LearningBlueprint['coursePreparation'] => {
  const existing = draft.learningBlueprint.coursePreparation;
  const fallbackText =
    outputLanguage === 'cs'
      ? {
          activityMixPreference: 'Vyvážená kombinace všech podporovaných typů aktivit.',
          audience: 'Účastníci, kteří se potřebují prakticky naučit obsah kurzu.',
          constraints: 'Používej pouze informace z dodaných zdrojů.',
          depth: 'Praktický přehled s konkrétní aplikací.',
          desiredOutcome: `Účastník dokáže prakticky použít hlavní principy kurzu ${draft.title}.`,
          priorKnowledge: 'Nejsou vyžadovány žádné předchozí znalosti.',
          tone: 'Srozumitelný, praktický a profesionální.',
        }
      : {
          activityMixPreference: 'A balanced mix of every supported activity type.',
          audience: 'Learners who need to apply the course material in practice.',
          constraints: 'Use only information grounded in the supplied sources.',
          depth: 'A practical overview with concrete application.',
          desiredOutcome: `Learners can apply the core principles of ${draft.title}.`,
          priorKnowledge: 'No prior knowledge is required.',
          tone: 'Clear, practical, and professional.',
        };
  const generatedOrExistingText = (
    fieldName: keyof Omit<
      LearningBlueprint['coursePreparation'],
      'language' | 'languagePreference' | 'sourceStrictness'
    >,
  ) =>
    firstNonEmptyText(asText(generated[fieldName]), existing[fieldName], fallbackText[fieldName]);
  return {
    activityMixPreference: generatedOrExistingText('activityMixPreference'),
    audience: generatedOrExistingText('audience'),
    constraints: generatedOrExistingText('constraints'),
    depth: generatedOrExistingText('depth'),
    desiredOutcome: generatedOrExistingText('desiredOutcome'),
    language: outputLanguage,
    languagePreference: existing.languagePreference,
    priorKnowledge: generatedOrExistingText('priorKnowledge'),
    sourceStrictness:
      generated['sourceStrictness'] === 'strict' || existing.sourceStrictness === 'strict'
        ? 'strict'
        : 'standard',
    tone: generatedOrExistingText('tone'),
  };
};

const generatedAssumptions = (value: unknown): string[] =>
  typeof value === 'string'
    ? value
        .split(/\n+/u)
        .map((assumption) => assumption.trim())
        .filter(Boolean)
    : asArray(value).map(asText).filter(Boolean);

const normalizeObjectives = (
  draft: CourseDraft,
  generatedObjectives: unknown[],
  timestamp: string,
): LearningObjective[] => {
  if (generatedObjectives.length === 0) {
    throwAiProviderContractError('AI provider returned no learning objectives.', 'objectives');
  }

  const usedTitles = new Set<string>();
  return generatedObjectives.slice(0, 6).map((generatedObjective, index): LearningObjective => {
    const objective = asRecord(generatedObjective);
    const title = firstNonEmptyText(asText(objective['title']), asText(objective['topicName']));
    if (title.length === 0) {
      throwAiProviderContractError(
        `AI provider returned objective ${index + 1} without a title.`,
        'objectives',
      );
    }
    const normalizedTitle = title.toLowerCase();
    if (usedTitles.has(normalizedTitle)) {
      throwAiProviderContractError(
        `AI provider returned duplicate objective title: ${title}.`,
        'objectives',
      );
    }
    usedTitles.add(normalizedTitle);
    const capability = requiredText(objective['capability'], `objective ${index + 1} capability`);
    const topicName = firstNonEmptyText(asText(objective['topicName']), title);
    const evidence = objectiveEvidenceFor(draft, `${title} ${capability} ${topicName}`);
    return {
      capability,
      id: `objective_${draft.id}_${index + 1}`,
      sourceConfidence: evidence.sourceConfidence,
      sourceReferences: evidence.sourceReferences,
      sourceSupport: evidence.sourceSupport,
      status: 'generated',
      title,
      topicName,
      updatedAt: timestamp,
    };
  });
};

const normalizeActivityBriefs = (
  draft: CourseDraft,
  objectives: readonly LearningObjective[],
  generatedBriefs: unknown[],
  timestamp: string,
): ActivityBrief[] => {
  const generatedRecords = generatedBriefs.map((brief) => asRecord(brief)).slice(0, 8);
  const briefCount = Math.max(activityTypes.length, generatedRecords.length, objectives.length);
  const isCzech = draft.language === 'cs';
  const activityTypeTitle = (type: ActivityType) => {
    if (!isCzech) {
      return type.replaceAll('_', ' ');
    }
    switch (type) {
      case 'retrieval_check': {
        return 'kontrola vybavení';
      }
      case 'scenario_decision': {
        return 'rozhodnutí ve scénáři';
      }
      case 'ordering_matching': {
        return 'řazení a přiřazování';
      }
      case 'practice_task': {
        return 'praktický úkol';
      }
      case 'rubric_answer': {
        return 'odpověď podle kritérií';
      }
      default: {
        const unsupportedType: never = type;
        return unsupportedType;
      }
    }
  };

  return Array.from({ length: briefCount }, (_, index): ActivityBrief => {
    const generatedBrief = generatedRecords[index] ?? {};
    const requestedObjectiveTokens = [
      ...asArray(generatedBrief['objectiveIds']).map(asText),
      asText(generatedBrief['objectiveId']),
      asText(generatedBrief['objectiveTitle']),
    ]
      .map((value) => value.toLowerCase())
      .filter(Boolean);
    const objective =
      objectives.find((candidate) =>
        requestedObjectiveTokens.some(
          (token) =>
            token === candidate.id.toLowerCase() || token === candidate.title.toLowerCase(),
        ),
      ) ??
      objectives[index % objectives.length] ??
      objectives[0];
    if (objective === undefined) {
      throw aiProviderContractError('AI provider returned no learning objectives.', 'objectives');
    }
    const fallbackType = activityTypes[index % activityTypes.length] ?? 'retrieval_check';
    const type: ActivityType =
      index < activityTypes.length
        ? fallbackType
        : (generatedActivityType(generatedBrief['type']) ?? fallbackType);
    const sourceReferences = objective.sourceReferences ?? [];
    return {
      feedbackGuidance: firstNonEmptyText(
        asText(generatedBrief['feedbackGuidance']),
        isCzech
          ? `Vysvětlete, co je správně a co zlepšit s využitím podkladů k cíli ${objective.title}.`
          : `Explain what is correct and what to improve using evidence for ${objective.title}.`,
      ),
      id: `activity_brief_${draft.id}_${index + 1}`,
      instructions: firstNonEmptyText(
        asText(generatedBrief['instructions']),
        isCzech
          ? `Procvičte si schopnost „${objective.capability}“ pouze s využitím dodaných podkladů.`
          : `Practice ${objective.capability} using only the supplied source material.`,
      ),
      learnerAction: firstNonEmptyText(
        asText(generatedBrief['learnerAction']),
        isCzech
          ? `Použijte tuto schopnost: ${objective.capability}.`
          : `Apply this capability: ${objective.capability}.`,
      ),
      objectiveId: objective.id,
      objectiveIds: [objective.id],
      sourceConfidence: objective.sourceConfidence,
      sourceReferences,
      status: 'generated',
      successCriteria: firstNonEmptyText(
        asText(generatedBrief['successCriteria']),
        isCzech
          ? `Odpověď správně prokazuje schopnost: ${objective.capability}.`
          : `The response correctly demonstrates ${objective.capability}.`,
      ),
      title: firstNonEmptyText(
        asText(generatedBrief['title']),
        `${objective.title} — ${activityTypeTitle(type)}`,
      ),
      type,
      updatedAt: timestamp,
    };
  });
};

const cleanLearningToken = (value: string): string =>
  value
    .trim()
    .replaceAll(/^[\s"'„“”]+|[\s"'„“”.!,;:]+$/gu, '')
    .replaceAll(/\s+/gu, ' ');

const generatedActivityBaseFromBrief = (brief: ActivityBrief) => ({
  briefId: brief.id,
  id: `generated_activity_${brief.id}`,
  objectiveIds: brief.objectiveIds.length > 0 ? brief.objectiveIds : [brief.objectiveId],
  sourceConfidence: brief.sourceConfidence,
  sourceReferences: brief.sourceReferences ?? [],
  status: 'generated' as const,
});

const notPlayableActivityFromBrief = (
  brief: ActivityBrief,
  reason?: string,
): GeneratedActivity => ({
  ...generatedActivityBaseFromBrief(brief),
  interaction: {
    feedback:
      reason === undefined
        ? 'Regenerate the activity plan through Ax so it produces a real playable interaction.'
        : reason,
    kind: 'not_playable',
    prompt: 'The playable activity was not generated.',
    reason:
      reason ?? 'The Ax-generated playable activity is missing or failed the validation contract.',
  },
  status: 'stale',
  type: 'not_playable',
});

const lineItemsFrom = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map(asText).filter((item) => item.length > 0);
  }
  return asText(value)
    .split(/\n+/u)
    .map(cleanLearningToken)
    .filter((item) => item.length > 0);
};

const generatedBoolean = (value: unknown) => (typeof value === 'boolean' ? value : null);

const generatedPosition = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.trunc(value) : null;

const nonEmptyText = (value: string) => value.trim().length > 0;

const normalizedTextKey = (value: string) => value.trim().toLowerCase();

const hasDuplicateNormalizedTexts = (values: readonly string[]) => {
  const normalized = values.map(normalizedTextKey).filter(nonEmptyText);
  return new Set(normalized).size !== normalized.length;
};

const exactlyOne = <Value>(values: readonly Value[], predicate: (value: Value) => boolean) =>
  values.filter(predicate).length === 1;

const generatedEvaluationBoolean = (value: unknown) => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', 'yes', 'met'].includes(normalized)) {
      return true;
    }
    if (['false', 'no', 'not met', 'unmet'].includes(normalized)) {
      return false;
    }
  }
  return false;
};

const normalizedEvaluationScore = (value: number) => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
};

const evaluationCriteriaForActivity = (activity: GeneratedActivity): readonly string[] => {
  switch (activity.type) {
    case 'practice_task': {
      return activity.interaction.checklist;
    }
    case 'rubric_answer': {
      return activity.interaction.criteria;
    }
    default: {
      return [];
    }
  }
};

const evaluationQuestionForActivity = (activity: GeneratedActivity) => {
  switch (activity.type) {
    case 'practice_task':
    case 'ordering_matching':
    case 'rubric_answer': {
      return activity.interaction.prompt;
    }
    case 'retrieval_check': {
      return activity.interaction.question;
    }
    case 'scenario_decision': {
      return activity.interaction.scenario;
    }
    case 'not_playable': {
      return activity.interaction.prompt;
    }
    default: {
      const unsupportedActivity: never = activity;
      return unsupportedActivity;
    }
  }
};

const normalizeActivityEvaluationResult = (
  activity: GeneratedActivity,
  flowValue: ActivityEvaluationFlowOutput,
): ActivityEvaluationResponse => {
  const sourceCriteria = evaluationCriteriaForActivity(activity).filter(nonEmptyText);
  const criteria = parseGeneratedRecordArrayValue(
    flowValue.criteriaEvaluationJson,
    'criteriaEvaluationJson',
  )
    .map((criterion): ActivityEvaluationCriterion | null => {
      const criterionText = asText(criterion['criterion']);
      const feedback = asText(criterion['feedback']);
      if (!nonEmptyText(criterionText) || !nonEmptyText(feedback)) {
        return null;
      }
      return {
        criterion: criterionText,
        feedback,
        met: generatedEvaluationBoolean(criterion['met']),
      };
    })
    .filter((criterion): criterion is ActivityEvaluationCriterion => criterion !== null);
  const fallbackCriteria = sourceCriteria.map((criterion) => ({
    criterion,
    feedback: flowValue.feedbackMarkdown,
    met: false,
  }));
  const feedbackMarkdown = requiredText(flowValue.feedbackMarkdown, 'feedbackMarkdown');
  const nextStep = requiredText(flowValue.nextStep, 'nextStep');
  return {
    criteria: criteria.length > 0 ? criteria : fallbackCriteria,
    feedbackMarkdown,
    nextStep,
    score: normalizedEvaluationScore(flowValue.score),
  };
};

export const activityEvaluationFromAxResult = normalizeActivityEvaluationResult;

const normalizeGeneratedRetrievalActivity = (
  brief: ActivityBrief,
  generated: Record<string, unknown>,
): GeneratedActivity | null => {
  const question = asText(generated['question']);
  const feedback = asText(generated['feedback']);
  const explanationPrompt = asText(generated['explanationPrompt']);
  const choices = asArray(generated['choices'])
    .map((choice, index) => {
      const record = asRecord(choice);
      const text = asText(record['text']);
      const choiceFeedback = asText(record['feedback']);
      if (!nonEmptyText(text) || !nonEmptyText(choiceFeedback)) {
        return null;
      }
      const isCorrect = generatedBoolean(record['isCorrect']);
      if (isCorrect === null) {
        return null;
      }
      return {
        feedback: choiceFeedback,
        id: `${brief.id}_choice_${index + 1}`,
        isCorrect,
        text,
      };
    })
    .filter((choice): choice is NonNullable<typeof choice> => choice !== null);
  if (
    !nonEmptyText(question) ||
    !nonEmptyText(feedback) ||
    !nonEmptyText(explanationPrompt) ||
    choices.length < 3 ||
    choices.length > 4 ||
    hasDuplicateNormalizedTexts(choices.map((choice) => choice.text)) ||
    !exactlyOne(choices, (choice) => choice.isCorrect)
  ) {
    return null;
  }
  return {
    ...generatedActivityBaseFromBrief(brief),
    interaction: {
      choices,
      explanationPrompt,
      feedback,
      kind: 'retrieval_check',
      question,
    },
    type: 'retrieval_check',
  };
};

const normalizeGeneratedOrderingMatchingActivity = (
  brief: ActivityBrief,
  generated: Record<string, unknown>,
): GeneratedActivity | null => {
  const { mode } = generated;
  if (mode !== 'matching' && mode !== 'ordering') {
    return null;
  }
  const prompt = asText(generated['prompt']);
  const feedback = asText(generated['feedback']);
  const items = asArray(generated['items'])
    .map((item, index) => {
      const record = asRecord(item);
      const text = asText(record['text']);
      if (!nonEmptyText(text)) {
        return null;
      }
      if (mode === 'matching') {
        const generatedMatchLabel = record['matchLabel'];
        const validMatchLabel = asText(generatedMatchLabel);
        if (!nonEmptyText(validMatchLabel)) {
          return null;
        }
        return {
          id: `${brief.id}_match_${index + 1}`,
          matchLabel: validMatchLabel,
          text,
        };
      }
      const correctPosition = generatedPosition(record['correctPosition']);
      if (correctPosition === null) {
        return null;
      }
      return {
        correctPosition,
        id: `${brief.id}_order_${index + 1}`,
        text,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
  const enoughItems = mode === 'matching' ? items.length >= 2 : items.length >= 3;
  const matchLabelCount = new Set(
    items.map((item) => item.matchLabel ?? '').filter((label) => label.trim().length > 0),
  ).size;
  const enoughLabels = mode === 'ordering' || matchLabelCount >= 2;
  const orderPositions = mode === 'ordering' ? items.map((item) => item.correctPosition) : [];
  const positionsAreUnique =
    mode !== 'ordering' ||
    (orderPositions.every((position): position is number => typeof position === 'number') &&
      new Set(orderPositions).size === orderPositions.length);
  if (
    !nonEmptyText(prompt) ||
    !nonEmptyText(feedback) ||
    !enoughItems ||
    !positionsAreUnique ||
    !enoughLabels ||
    hasDuplicateNormalizedTexts(items.map((item) => item.text))
  ) {
    return null;
  }
  return {
    ...generatedActivityBaseFromBrief(brief),
    interaction: {
      feedback,
      items,
      kind: 'ordering_matching',
      mode,
      prompt,
    },
    type: 'ordering_matching',
  };
};

const normalizeGeneratedScenarioActivity = (
  brief: ActivityBrief,
  generated: Record<string, unknown>,
): GeneratedActivity | null => {
  const scenario = asText(generated['prompt']);
  const feedback = asText(generated['feedback']);
  const justificationPrompt = asText(generated['justificationPrompt']);
  const choices = asArray(generated['choices'])
    .map((choice, index) => {
      const record = asRecord(choice);
      const text = asText(record['text']);
      const consequence = asText(record['consequence']);
      const choiceFeedback = asText(record['feedback']);
      if (!nonEmptyText(text) || !nonEmptyText(consequence) || !nonEmptyText(choiceFeedback)) {
        return null;
      }
      const isPreferred = generatedBoolean(record['isPreferred']);
      if (isPreferred === null) {
        return null;
      }
      return {
        consequence,
        feedback: choiceFeedback,
        id: `${brief.id}_decision_${index + 1}`,
        isPreferred,
        text,
      };
    })
    .filter((choice): choice is NonNullable<typeof choice> => choice !== null);
  if (
    !nonEmptyText(scenario) ||
    !nonEmptyText(feedback) ||
    !nonEmptyText(justificationPrompt) ||
    choices.length < 2 ||
    choices.length > 4 ||
    hasDuplicateNormalizedTexts(choices.map((choice) => choice.text)) ||
    !exactlyOne(choices, (choice) => choice.isPreferred)
  ) {
    return null;
  }
  return {
    ...generatedActivityBaseFromBrief(brief),
    interaction: {
      choices,
      feedback,
      justificationPrompt,
      kind: 'scenario_decision',
      scenario,
    },
    type: 'scenario_decision',
  };
};

const normalizeGeneratedPracticeActivity = (
  brief: ActivityBrief,
  generated: Record<string, unknown>,
): GeneratedActivity | null => {
  const prompt = asText(generated['prompt']);
  const feedback = asText(generated['feedback']);
  const submissionLabel = asText(generated['submissionLabel']);
  const checklist = lineItemsFrom(generated['criteria']).filter(nonEmptyText);
  if (
    !nonEmptyText(prompt) ||
    !nonEmptyText(feedback) ||
    !nonEmptyText(submissionLabel) ||
    checklist.length < 2 ||
    hasDuplicateNormalizedTexts(checklist)
  ) {
    return null;
  }
  return {
    ...generatedActivityBaseFromBrief(brief),
    interaction: {
      checklist,
      feedback,
      kind: 'practice_task',
      prompt,
      submissionLabel,
    },
    type: 'practice_task',
  };
};

const normalizeGeneratedRubricActivity = (
  brief: ActivityBrief,
  generated: Record<string, unknown>,
): GeneratedActivity | null => {
  const prompt = asText(generated['prompt']);
  const feedback = asText(generated['feedback']);
  const criteria = lineItemsFrom(generated['criteria']).filter(nonEmptyText);
  if (
    !nonEmptyText(prompt) ||
    !nonEmptyText(feedback) ||
    criteria.length < 2 ||
    hasDuplicateNormalizedTexts(criteria)
  ) {
    return null;
  }
  return {
    ...generatedActivityBaseFromBrief(brief),
    interaction: {
      criteria,
      feedback,
      kind: 'rubric_answer',
      prompt,
    },
    type: 'rubric_answer',
  };
};

const normalizeGeneratedPlayableActivity = (
  brief: ActivityBrief,
  generated: unknown,
): GeneratedActivity | null => {
  const decoded = Schema.decodeUnknownOption(unknownRecordSchema)(generated);
  if (Option.isNone(decoded)) {
    return null;
  }
  const record = decoded.value;
  const type = generatedActivityType(record['type']);
  if (type === null) {
    return null;
  }
  switch (type) {
    case 'retrieval_check': {
      return normalizeGeneratedRetrievalActivity(brief, record);
    }
    case 'ordering_matching': {
      return normalizeGeneratedOrderingMatchingActivity(brief, record);
    }
    case 'scenario_decision': {
      return normalizeGeneratedScenarioActivity(brief, record);
    }
    case 'practice_task': {
      return normalizeGeneratedPracticeActivity(brief, record);
    }
    case 'rubric_answer': {
      return normalizeGeneratedRubricActivity(brief, record);
    }
    default: {
      const unsupportedType: never = type;
      return unsupportedType;
    }
  }
};

export const generatedActivityFromAxSpec = (
  brief: ActivityBrief,
  generated: unknown,
): GeneratedActivity =>
  normalizeGeneratedPlayableActivity(brief, generated) ?? notPlayableActivityFromBrief(brief);

export const failedActivityFromBrief = (brief: ActivityBrief, reason: string): GeneratedActivity =>
  notPlayableActivityFromBrief(brief, reason);

const sourceCoverageFor = (objectives: readonly LearningObjective[]): SourceSupport => {
  if (objectives.length === 0) {
    return 'inferred';
  }
  if (objectives.every((objective) => objective.sourceSupport === 'source_backed')) {
    return 'source_backed';
  }
  if (objectives.some((objective) => objective.sourceSupport !== 'inferred')) {
    return 'partially_source_backed';
  }
  return 'inferred';
};

const normalizeLearningPlan = (
  draft: CourseDraft,
  generated: Record<string, unknown>,
): LearningBlueprint => {
  const timestamp = currentIsoTimestamp();
  const outputLanguage = generatedOutputLanguage(generated['outputLanguage']);
  const generatedPreparation = asRecord(generated['coursePreparation']);
  const coursePreparation = preparationFromDraft(draft, generatedPreparation, outputLanguage);
  const objectives = normalizeObjectives(draft, asArray(generated['objectives']), timestamp);
  const activityBriefs = normalizeActivityBriefs(
    { ...draft, language: coursePreparation.language },
    objectives,
    asArray(generated['activityBriefs']),
    timestamp,
  );
  const assumptions = generatedAssumptions(generated['assumptions']);
  return {
    activityBriefs,
    assumptions,
    coursePreparation,
    createdAt: timestamp,
    generatedActivities: [],
    objectives,
    sourceCoverage: sourceCoverageFor(objectives),
    updatedAt: timestamp,
  };
};

export const coursePreparationFromAxPlanningResult = (
  draft: CourseDraft,
  flowValue: CoursePreparationFlowOutput,
): Pick<LearningBlueprint, 'assumptions' | 'coursePreparation'> => {
  const outputLanguage = generatedOutputLanguage(flowValue.outputLanguage);
  return {
    assumptions: generatedAssumptions(flowValue.assumptions),
    coursePreparation: preparationFromDraft(
      draft,
      parseGeneratedRecordValue(flowValue.coursePreparation, 'coursePreparation'),
      outputLanguage,
    ),
  };
};

export const learningBlueprintFromAxPlanningResult = (
  draft: CourseDraft,
  flowValue: ActivityGenerationFlowOutput,
): LearningBlueprint => {
  const generated = {
    activityBriefs: parseGeneratedArrayValue(flowValue.activityBriefs, 'activityBriefs'),
    assumptions: flowValue.assumptions,
    coursePreparation: parseGeneratedRecordValue(flowValue.coursePreparation, 'coursePreparation'),
    objectives: parseGeneratedArrayValue(flowValue.objectives, 'objectives'),
    outputLanguage: flowValue.outputLanguage,
  };
  return normalizeLearningPlan(draft, generated);
};

const locallyRenderedActivitySpec = (
  draft: CourseDraft,
  brief: ActivityBrief,
): Record<string, unknown> => {
  const isCzech = courseContentLanguage(draft) === 'cs';
  const preferredChoice = isCzech
    ? `Postup splňující kritérium: ${brief.successCriteria}`
    : `Approach meeting this criterion: ${brief.successCriteria}`;
  const unsafeChoice = isCzech
    ? 'Pokračovat bez ověření kritérií a zdrojů.'
    : 'Continue without checking the criteria or sources.';
  const reviewPrompt = isCzech
    ? 'Vysvětlete, které pravidlo ze zdroje vaše rozhodnutí podporuje.'
    : 'Explain which source-backed rule supports your decision.';
  switch (brief.type) {
    case 'retrieval_check': {
      return {
        choices: [
          {
            feedback: brief.feedbackGuidance,
            isCorrect: true,
            text: preferredChoice,
          },
          {
            feedback: brief.feedbackGuidance,
            isCorrect: false,
            text: unsafeChoice,
          },
          {
            feedback: brief.feedbackGuidance,
            isCorrect: false,
            text: isCzech
              ? 'Rozhodnout pouze podle rychlosti bez kontroly dopadů.'
              : 'Decide only by speed without checking the impact.',
          },
        ],
        explanationPrompt: reviewPrompt,
        feedback: brief.feedbackGuidance,
        question: brief.instructions,
        type: 'retrieval_check',
      };
    }
    case 'scenario_decision': {
      return {
        choices: [
          {
            consequence: brief.successCriteria,
            feedback: brief.feedbackGuidance,
            isPreferred: true,
            text: preferredChoice,
          },
          {
            consequence: brief.feedbackGuidance,
            feedback: brief.feedbackGuidance,
            isPreferred: false,
            text: unsafeChoice,
          },
        ],
        feedback: brief.feedbackGuidance,
        justificationPrompt: reviewPrompt,
        prompt: brief.instructions,
        type: 'scenario_decision',
      };
    }
    case 'ordering_matching': {
      return {
        feedback: brief.feedbackGuidance,
        items: [
          { correctPosition: 1, text: brief.learnerAction },
          { correctPosition: 2, text: brief.successCriteria },
          { correctPosition: 3, text: brief.feedbackGuidance },
        ],
        mode: 'ordering',
        prompt: brief.instructions,
        type: 'ordering_matching',
      };
    }
    case 'practice_task': {
      return {
        criteria: [brief.successCriteria, brief.feedbackGuidance],
        feedback: brief.feedbackGuidance,
        prompt: brief.instructions,
        submissionLabel: brief.learnerAction,
        type: 'practice_task',
      };
    }
    case 'rubric_answer': {
      return {
        criteria: [brief.successCriteria, brief.feedbackGuidance],
        feedback: brief.feedbackGuidance,
        prompt: brief.instructions,
        type: 'rubric_answer',
      };
    }
    default: {
      const unsupportedType: never = brief.type;
      return unsupportedType;
    }
  }
};

export const renderPlayableActivityFromBrief = (
  draft: CourseDraft,
  brief: ActivityBrief,
): GeneratedActivity =>
  generatedActivityFromAxSpec(brief, locallyRenderedActivitySpec(draft, brief));

const locallyRenderedActivityResult = (
  draft: CourseDraft,
  brief: ActivityBrief,
): AiJsonResult<GeneratedActivity> => {
  const value = renderPlayableActivityFromBrief(draft, brief);
  return {
    model: `${aiProviderConfig()?.model ?? defaultAiModel}/brief-renderer`,
    provider: 'local-playable-activity-renderer',
    text: jsonTextFrom(value),
    value,
  };
};

export const generateLearningPlanWithAi = (
  draft: CourseDraft,
): Promise<AiJsonResult<LearningBlueprint>> =>
  Effect.runPromise(
    generateStructuredObjectEffect(coursitionLearningPlanFlow, {
      activityPolicy: activityPolicyForDraft(draft),
      courseTitle: draft.title,
      existingPreparation: jsonTextFrom(draft.learningBlueprint.coursePreparation),
      languageCode: requestedOutputLanguage(draft),
      sourceEvidence: processedSourceEvidence(draft),
    }).pipe(
      Effect.flatMap((flowResult) =>
        Effect.try({
          catch: toAiProviderEffectError,
          try: () => {
            const learningBlueprint = learningBlueprintFromAxPlanningResult(
              draft,
              flowResult.value,
            );

            return {
              ...flowResult,
              text: jsonTextFrom({
                ...flowResult.value,
                generated: learningBlueprint,
              }),
              value: learningBlueprint,
            };
          },
        }),
      ),
    ),
  );

export const generateCoursePreparationWithAi = (
  draft: CourseDraft,
): Promise<AiJsonResult<Pick<LearningBlueprint, 'assumptions' | 'coursePreparation'>>> =>
  Effect.runPromise(
    generateStructuredObjectEffect(coursitionCoursePreparationFlow, {
      activityPolicy: activityPolicyForDraft(draft),
      courseTitle: draft.title,
      existingPreparation: jsonTextFrom(draft.learningBlueprint.coursePreparation),
      languageCode: requestedOutputLanguage(draft),
      sourceEvidence: processedSourceEvidence(draft),
    }).pipe(
      Effect.flatMap((flowResult) =>
        Effect.try({
          catch: toAiProviderEffectError,
          try: () => {
            const coursePreparation = coursePreparationFromAxPlanningResult(
              draft,
              flowResult.value,
            );

            return {
              ...flowResult,
              text: jsonTextFrom({
                ...flowResult.value,
                generated: coursePreparation,
              }),
              value: coursePreparation,
            };
          },
        }),
      ),
    ),
  );

export const generateActivityWithAi = (
  draft: CourseDraft,
  objective: LearningObjective,
  brief: ActivityBrief,
): Promise<AiJsonResult<GeneratedActivity>> => {
  if (isFreeAiModel(aiProviderConfig()?.model)) {
    return Promise.resolve(locallyRenderedActivityResult(draft, brief));
  }
  return Effect.runPromise(
    generateStructuredObjectEffect(coursitionPlayableActivityFlow, {
      activityBriefJson: jsonTextFrom(brief),
      activityPolicy: [activityPolicyForDraft(draft), playableActivityOutputContract].join('\n\n'),
      objectiveJson: jsonTextFrom(objective),
      outputLanguage: courseContentLanguage(draft),
      sourceEvidence: processedSourceEvidence(draft),
    }).pipe(
      Effect.flatMap((flowResult) =>
        Effect.gen(function* generatedActivityProgram() {
          const playableGeneration = yield* Effect.try({
            catch: toAiProviderEffectError,
            try: () => {
              const playableGeneratedRecord = parseGeneratedRecordValue(
                flowResult.value.generatedActivityJson,
                'generatedActivityJson',
              );
              const playableActivity = normalizeGeneratedPlayableActivity(
                brief,
                playableGeneratedRecord,
              );
              return {
                playableActivity,
                playableGeneratedRecord,
              };
            },
          });
          if (playableGeneration.playableActivity === null) {
            return yield* aiProviderContractError(
              `AI provider returned invalid playable activity for: ${brief.title}.`,
              'generatedActivityJson',
            );
          }
          return {
            ...flowResult,
            text: jsonTextFrom({
              ...flowResult.value,
              generated: playableGeneration.playableGeneratedRecord,
            }),
            value: playableGeneration.playableActivity,
          };
        }),
      ),
    ),
  );
};

const objectiveContextForActivity = (draft: CourseDraft, activity: GeneratedActivity) =>
  draft.learningBlueprint.objectives.filter((objective) =>
    activity.objectiveIds.includes(objective.id),
  );

const activityBriefContextForActivity = (draft: CourseDraft, activity: GeneratedActivity) =>
  draft.learningBlueprint.activityBriefs.find((brief) => brief.id === activity.briefId) ?? null;

const evaluationActivityContext = (draft: CourseDraft, activity: GeneratedActivity) =>
  jsonTextFrom({
    activity,
    activityBrief: activityBriefContextForActivity(draft, activity),
    coursePreparation: draft.learningBlueprint.coursePreparation,
    courseTitle: draft.title,
    objectives: objectiveContextForActivity(draft, activity),
  });

const evaluationInputMaterial = (draft: CourseDraft) =>
  [
    draft.learningBlueprint.coursePreparation.desiredOutcome,
    draft.learningBlueprint.coursePreparation.audience,
    draft.learningBlueprint.coursePreparation.constraints,
    ...draft.sources.map((source) => `${source.name}\n${source.content}`),
  ]
    .filter((value) => value.trim().length > 0)
    .join('\n\n');

export const evaluateActivityAnswerWithAi = (
  draft: CourseDraft,
  activity: GeneratedActivity,
  answer: string,
  checkedCriteria: readonly string[],
): Promise<AiJsonResult<ActivityEvaluationResponse>> =>
  Effect.runPromise(
    generateStructuredObjectEffect(coursitionActivityEvaluationFlow, {
      activityContextJson: evaluationActivityContext(draft, activity),
      answer,
      checkedCriteriaJson: jsonTextFrom(checkedCriteria),
      criteriaInputJson: jsonTextFrom(evaluationCriteriaForActivity(activity)),
      evaluatorPolicy: activityEvaluationOutputContract,
      inputMaterial: evaluationInputMaterial(draft),
      outputLanguage: courseContentLanguage(draft),
      question: evaluationQuestionForActivity(activity),
      sourceEvidence: processedSourceEvidence(draft),
    }).pipe(
      Effect.flatMap((flowResult) =>
        Effect.try({
          catch: toAiProviderEffectError,
          try: () => {
            const evaluation = normalizeActivityEvaluationResult(activity, flowResult.value);
            return {
              ...flowResult,
              text: jsonTextFrom({
                ...flowResult.value,
                generated: evaluation,
              }),
              value: evaluation,
            };
          },
        }),
      ),
    ),
  );

const sourceReferencesForObjective = (objective: LearningObjective): SourceReference[] => [
  ...(objective.sourceReferences ?? []),
];

const sourceExplanationBody = (
  draft: CourseDraft,
  objective: LearningObjective,
  references: readonly SourceReference[],
) => {
  if (references.length > 0 && draft.language === 'cs') {
    return `Tato část vychází z přiložených zdrojů a vede studenta k praktickému použití: ${objective.capability}`;
  }
  if (references.length > 0) {
    return `This section is grounded in the attached sources and moves the learner toward practical use: ${objective.capability}`;
  }
  if (draft.language === 'cs') {
    return 'Tato část je odvozená z přípravy kurzu a měla by být zkontrolovaná proti lepším zdrojům.';
  }
  return 'This section is inferred from course preparation and should be checked against stronger source material.';
};

const activityPrompt = (activity: GeneratedActivity) => {
  switch (activity.type) {
    case 'retrieval_check': {
      return activity.interaction.question;
    }
    case 'practice_task':
    case 'ordering_matching':
    case 'rubric_answer': {
      return activity.interaction.prompt;
    }
    case 'scenario_decision': {
      return activity.interaction.scenario;
    }
    case 'not_playable': {
      return activity.interaction.prompt;
    }
    default: {
      const unsupportedActivity: never = activity;
      return unsupportedActivity;
    }
  }
};

const activityFeedback = (activity: GeneratedActivity) => activity.interaction.feedback;

const sectionBlocksFor = (
  draft: CourseDraft,
  objective: LearningObjective,
  activity: GeneratedActivity,
  index: number,
): CourseContentBlock[] => {
  const references = sourceReferencesForObjective(objective);
  const { sourceConfidence } = objective;
  const prefix = draft.language === 'cs' ? `${index + 1}.` : `${index + 1}.`;
  return [
    {
      body: objective.capability,
      id: `content_block_${objective.id}_objective`,
      objectiveIds: [objective.id],
      sourceConfidence,
      sourceReferences: references,
      status: 'generated' as const,
      title: `${prefix} ${objective.title}`,
      type: 'objective' as const,
    },
    {
      body: sourceExplanationBody(draft, objective, references),
      id: `content_block_${objective.id}_source_explanation`,
      objectiveIds: [objective.id],
      sourceConfidence,
      sourceReferences: references,
      status: 'generated' as const,
      title: draft.language === 'cs' ? 'Vysvětlení ze zdrojů' : 'Source-grounded explanation',
      type: 'source_explanation' as const,
    },
    {
      activityId: activity.id,
      body: activityPrompt(activity),
      id: `content_block_${objective.id}_activity`,
      objectiveIds: [objective.id],
      sourceConfidence: activity.sourceConfidence,
      sourceReferences: activity.sourceReferences,
      status: 'generated' as const,
      title: activityPrompt(activity),
      type: 'interactive_activity' as const,
    },
    {
      body: activityFeedback(activity),
      id: `content_block_${objective.id}_summary`,
      objectiveIds: [objective.id],
      sourceConfidence,
      sourceReferences: references,
      status: 'generated' as const,
      title: draft.language === 'cs' ? 'Zpětná vazba a shrnutí' : 'Feedback and summary',
      type: 'summary' as const,
    },
  ];
};

export const generateCourseContentWithAi = (
  draft: CourseDraft,
): Promise<AiJsonResult<CourseContent>> =>
  Effect.runPromise(
    Effect.gen(function* generateCourseContentProgram() {
      const timestamp = currentIsoTimestamp();
      const outputDraft = { ...draft, language: courseContentLanguage(draft) };
      const activitiesByObjective = new Map(
        draft.learningBlueprint.generatedActivities.flatMap((activity) =>
          activity.objectiveIds.map((objectiveId) => [objectiveId, activity] as const),
        ),
      );
      const sections: CourseSection[] = [];
      for (const [index, objective] of draft.learningBlueprint.objectives.entries()) {
        const activity = activitiesByObjective.get(objective.id);
        if (activity === undefined) {
          return yield* aiProviderContractError(
            `Missing generated activity for objective: ${objective.title}.`,
            'generatedActivities',
          );
        }
        const references = sourceReferencesForObjective(objective);
        sections.push({
          blocks: sectionBlocksFor(outputDraft, objective, activity, index),
          id: `content_section_${objective.id}`,
          objectiveIds: [objective.id],
          sourceConfidence: objective.sourceConfidence,
          sourceReferences: references,
          status: 'generated' as const,
          summary: objective.capability,
          title: objective.title,
        });
      }
      return localCourseContentRendererResult({
        createdAt: timestamp,
        sections,
        status: sections.length > 0 ? 'generated' : 'empty',
        updatedAt: timestamp,
      });
    }),
  );
