import { ai as createAxAI, ax, f } from '@ax-llm/ax';
import type { AxAIOpenAIModel, AxForwardable } from '@ax-llm/ax';
import * as Data from 'effect/Data';
import { DateTime } from 'effect';
import * as Effect from 'effect/Effect';
import { activityTypes, emptyCoursePreparation } from '../../shared/coursition/workflow.ts';
import type {
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
import type { CoursitionAiRuntimeConfig } from './config.ts';
import { loadCoursitionAiRuntimeConfig } from './config.ts';

interface AiProviderConfig {
  apiKey: string;
  baseURL: string;
  model: string;
  provider: string;
}

interface AiJsonResult<T> {
  model: string;
  provider: string;
  text: string;
  value: T;
}

interface GeneratedLearningBlueprintObject {
  activityBriefs?: unknown;
  assumptions?: unknown;
  coursePreparation?: unknown;
  generatedActivities?: unknown;
  objectives?: unknown;
}

interface GeneratedObjectiveObject {
  capability?: unknown;
  title?: unknown;
  topicName?: unknown;
}

interface GeneratedActivityBriefObject {
  feedbackGuidance?: unknown;
  instructions?: unknown;
  learnerAction?: unknown;
  objectiveTitle?: unknown;
  successCriteria?: unknown;
  title?: unknown;
  type?: unknown;
}

interface GeneratedPlayableActivityObject {
  choices?: unknown;
  criteria?: unknown;
  explanationPrompt?: unknown;
  feedback?: unknown;
  items?: unknown;
  justificationPrompt?: unknown;
  mode?: unknown;
  objectiveTitle?: unknown;
  prompt?: unknown;
  question?: unknown;
  submissionLabel?: unknown;
  type?: unknown;
}

interface GeneratedPlayableItemObject {
  correctPosition?: unknown;
  matchLabel?: unknown;
  text?: unknown;
}

interface GeneratedPlayableChoiceObject {
  consequence?: unknown;
  feedback?: unknown;
  isPreferred?: unknown;
  isCorrect?: unknown;
  text?: unknown;
}

class AiProviderEffectError extends Data.TaggedError('AiProviderEffectError')<{
  readonly cause: unknown;
}> {}

const defaultLocalBaseUrl = 'http://localhost:8317/v1';
const defaultLocalApiKey = 'droid-local-key';
const defaultModel = 'gpt-5.3-codex-spark';
const localCourseContentRendererProvider = 'local-course-content-renderer';
const axProviderLabel = 'ax/openai-compatible';

const configuredAxOpenAiModel = (model: string) => model as AxAIOpenAIModel;

const isLocalAiBaseUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1';
  } catch {
    return false;
  }
};

const isLocalSiteUrl = (value: string | undefined) => {
  if (value === undefined) {
    return true;
  }
  try {
    const url = new URL(value);
    return url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1';
  } catch {
    return false;
  }
};

const shouldUseDefaultLocalAiProvider = (config: CoursitionAiRuntimeConfig) =>
  config.nodeEnv !== 'production' || isLocalSiteUrl(config.modernPublicSiteUrl);

const aiCallTimeoutMs = () => {
  const config = loadCoursitionAiRuntimeConfig();
  if (config.aiTimeoutMs !== undefined) {
    return config.aiTimeoutMs;
  }
  return config.nodeEnv === 'test' ? 1500 : 20_000;
};

export const aiProviderConfig = (): AiProviderConfig | null => {
  const config = loadCoursitionAiRuntimeConfig();
  const baseURL =
    config.aiBaseUrl ??
    config.openAiBaseUrl ??
    (shouldUseDefaultLocalAiProvider(config) ? defaultLocalBaseUrl : '');
  const apiKey =
    config.aiProviderApiKey ??
    config.openAiApiKey ??
    (isLocalAiBaseUrl(baseURL) ? defaultLocalApiKey : '');
  const model = config.aiModel ?? defaultModel;
  if (baseURL.length === 0 || apiKey.length === 0) {
    return null;
  }
  return {
    apiKey,
    baseURL,
    model,
    provider: axProviderLabel,
  };
};

export const isAiProviderConfigured = () => aiProviderConfig() !== null;

const createCoursitionAxAi = (config: AiProviderConfig) =>
  createAxAI({
    apiKey: config.apiKey,
    apiURL: config.baseURL,
    config: {
      model: configuredAxOpenAiModel(config.model),
      temperature: 0,
    },
    name: 'openai',
    options: {
      includeRequestBodyInErrors: false,
      stream: true,
      timeout: aiCallTimeoutMs(),
    },
  });

const jsonTextFrom = (value: unknown) => JSON.stringify(value);

const localCourseContentRendererResult = <T>(value: T): AiJsonResult<T> => ({
  model: `${defaultModel}/deterministic`,
  provider: localCourseContentRendererProvider,
  text: jsonTextFrom(value),
  value,
});

const foreignPromise = <Value>(evaluate: () => PromiseLike<Value>) =>
  Effect.tryPromise({
    catch: (cause) => new AiProviderEffectError({ cause }),
    try: evaluate,
  });

const generateStructuredObjectEffect = <TInput, TOutput>(
  program: AxForwardable<TInput, TOutput, string>,
  input: TInput,
): Effect.Effect<AiJsonResult<TOutput>, AiProviderEffectError> => {
  const config = aiProviderConfig();
  if (config === null) {
    return Effect.fail(
      new AiProviderEffectError({
        cause: new Error('AI provider is not configured.'),
      }),
    );
  }
  const provider = createCoursitionAxAi(config);
  return foreignPromise(() =>
    program.forward(provider, input, {
      stream: true,
      timeout: aiCallTimeoutMs(),
    }),
  ).pipe(
    Effect.map((value) => ({
      model: config.model,
      provider: config.provider,
      text: jsonTextFrom(value),
      value,
    })),
  );
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const asText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const firstNonEmptyText = (...values: readonly string[]) =>
  values.find((value) => value.trim().length > 0)?.trim() ?? '';

const currentIsoTimestamp = () => DateTime.formatIso(DateTime.nowUnsafe());

const processedSourceEvidence = (draft: CourseDraft) => {
  if (draft.knowledgeChunks.length > 0) {
    return draft.knowledgeChunks
      .slice(0, 16)
      .map(
        (chunk, index) =>
          `Chunk ${index + 1} (${chunk.reference.heading ?? chunk.sourceAssetId}, ${
            chunk.reference.position
          })\n${chunk.content.slice(0, 1600)}`,
      )
      .join('\n\n');
  }
  return draft.sources
    .filter((source) => source.status === 'processed' || source.status === 'partially_processed')
    .slice(0, 8)
    .map((source, index) => `Source ${index + 1}: ${source.name}\n${source.content.slice(0, 4000)}`)
    .join('\n\n');
};

const courseOutputLanguage = (draft: CourseDraft): CourseDraft['language'] => {
  const preference = draft.learningBlueprint.coursePreparation.languagePreference;
  return preference === 'source' ? draft.learningBlueprint.coursePreparation.language : preference;
};

const fallbackTokens = (value: string) =>
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

const fallbackTitle = (draft: CourseDraft, index: number) => {
  const tokens = fallbackTokens(`${draft.title} ${processedSourceEvidence(draft)}`).slice(
    index,
    index + 3,
  );
  if (tokens.length === 0) {
    return draft.language === 'cs' ? `Cíl ${index + 1}` : `Objective ${index + 1}`;
  }
  const title = tokens.map((word) => `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`).join(' ');
  return draft.language === 'cs' ? title.toLowerCase() : title;
};

const objectiveEvidenceFor = (draft: CourseDraft, query: string) => {
  const queryTokens = new Set(fallbackTokens(query));
  const scoredChunks = draft.knowledgeChunks
    .map((chunk, index) => {
      const score = fallbackTokens(`${chunk.reference.heading ?? ''} ${chunk.content}`).filter(
        (token) => queryTokens.has(token),
      ).length;
      return { chunk, index, score };
    })
    .toSorted((left, right) => right.score - left.score || left.index - right.index);
  const selectedChunks = scoredChunks.filter((entry) => entry.score > 0).slice(0, 3);
  const fallbackChunks = scoredChunks.slice(0, 2);
  const chunks = selectedChunks.length > 0 ? selectedChunks : fallbackChunks;
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

const normalizedActivityType = (value: unknown, index: number): ActivityType => {
  if (typeof value === 'string' && activityTypes.some((activityType) => activityType === value)) {
    return value as ActivityType;
  }
  return activityTypes[index % activityTypes.length] ?? 'retrieval_check';
};

const generatedActivityType = (value: unknown): ActivityType | null =>
  typeof value === 'string' && activityTypes.some((activityType) => activityType === value)
    ? (value as ActivityType)
    : null;

const learningBlueprintProgram = ax(
  f()
    .description(
      'Create a source-grounded course preparation, objective map, and interactive activity plan.',
    )
    .input('languageCode', f.string('Language code for all generated course copy'))
    .input('courseTitle', f.string('Course title'))
    .input('existingPreparation', f.string('Creator-edited course preparation fields'))
    .input('sourceEvidence', f.string('Source excerpts that define the course scope'))
    .output(
      'coursePreparation',
      f.object(
        {
          activityMixPreference: f.string('Preferred mix of learner practice activities'),
          audience: f.string('Specific intended learner group'),
          constraints: f.string('Constraints and exclusions for the course'),
          depth: f.string('Course depth'),
          desiredOutcome: f.string('Observable learner outcome'),
          priorKnowledge: f.string('Expected prior knowledge'),
          sourceStrictness: f.class(['standard', 'strict'] as const, 'Source strictness mode'),
          tone: f.string('Tone for learner-facing content'),
        },
        'Course preparation',
      ),
    )
    .output(
      'assumptions',
      f.string('One assumption per line about inferred audience, outcome, depth, or constraints'),
    )
    .output(
      'objectives',
      f
        .object({
          capability: f.string('Observable learner capability'),
          title: f.string('Short objective title'),
          topicName: f.string('Source topic or grouping for this objective'),
        })
        .array('Three to six learning objectives'),
    )
    .output(
      'activityBriefs',
      f
        .object({
          feedbackGuidance: f.string('Feedback or rubric guidance'),
          instructions: f.string('Learner-facing instructions'),
          learnerAction: f.string('What the learner must do'),
          objectiveTitle: f.string('Objective title this brief supports'),
          successCriteria: f.string('What a good answer or action must include'),
          title: f.string('Activity brief title'),
          type: f.class(activityTypes, 'One approved activity type'),
        })
        .array('One activity brief per objective or objective cluster'),
    )
    .output(
      'generatedActivities',
      f
        .object({
          choices: f
            .object({
              consequence: f.string(
                'Learner-facing consequence for this choice; empty string when not used',
              ),
              feedback: f.string('Immediate feedback for this choice; empty string when not used'),
              isCorrect: f.boolean('True only for correct retrieval-check choices'),
              isPreferred: f.boolean('True only for the strongest scenario decision'),
              text: f.string('Learner-facing choice text; empty string when not used'),
            })
            .array('Choices for retrieval_check or scenario_decision; empty for other types'),
          criteria: f.string(
            'One learner-facing checklist or rubric criterion per line; no assessor-only text',
          ),
          explanationPrompt: f.string(
            'Short learner-facing explanation prompt for retrieval checks; empty when not used',
          ),
          feedback: f.string('Learner-facing feedback after checking the activity'),
          items: f
            .object({
              correctPosition: f.number(
                '1-based correct order for ordering items; use 0 when not an ordering item',
              ),
              matchLabel: f.string(
                'Correct label for matching items; empty string when not a matching item',
              ),
              text: f.string('Learner-facing card/item text; empty string when not used'),
            })
            .array('Cards/items for matching or ordering; empty for other types'),
          justificationPrompt: f.string(
            'Short learner-facing justification prompt for scenario decisions; empty when not used',
          ),
          mode: f.class(
            ['matching', 'ordering', 'none'] as const,
            'Use matching/order for ordering_matching, otherwise none',
          ),
          objectiveTitle: f.string('Objective title this generated activity supports'),
          prompt: f.string(
            'Self-contained playable prompt. If the task needs a sample, include the sample here.',
          ),
          question: f.string(
            'Question text for retrieval checks; empty string for other activity types',
          ),
          submissionLabel: f.string(
            'Learner-facing input label for practice/rubric tasks; empty when not used',
          ),
          type: f.class(activityTypes, 'One approved activity type'),
        })
        .array(
          'One complete playable activity per activity brief. Do not reference missing samples. Do not use success criteria or evaluator guidance as answer text.',
        ),
    )
    .build(),
  { stream: true },
);

const firstProcessedSourceName = (draft: CourseDraft) =>
  draft.sources.find(
    (source) =>
      (source.status === 'processed' || source.status === 'partially_processed') &&
      source.name.trim().length > 0,
  )?.name ?? draft.title;

const fallbackPreparationFor = (
  draft: CourseDraft,
  language: CourseDraft['language'],
): LearningBlueprint['coursePreparation'] => {
  const sourceName = firstProcessedSourceName(draft);
  const focus = fallbackTitle({ ...draft, language }, 0);
  if (language === 'cs') {
    return {
      ...emptyCoursePreparation(language),
      activityMixPreference: 'Krátké vybavovací kontroly, praktické úkoly a scénářová rozhodnutí.',
      audience: `Studenti, kteří potřebují prakticky použít materiál ${sourceName}.`,
      constraints: `Držet se zdrojového materiálu ${sourceName} a jasně označit odvozené části.`,
      depth: 'practical',
      desiredOutcome: `Student umí použít ${focus} v konkrétní praktické situaci.`,
      priorKnowledge: `Student zná základní kontext zdroje ${sourceName}, ale potřebuje vedenou praxi.`,
      tone: 'jasný, praktický a konkrétní',
    };
  }
  return {
    ...emptyCoursePreparation(language),
    activityMixPreference: 'Short retrieval checks, practical tasks, and scenario decisions.',
    audience: `Learners who need to apply the material in ${sourceName}.`,
    constraints: `Stay grounded in ${sourceName} and clearly mark inferred material.`,
    depth: 'practical',
    desiredOutcome: `Learners can apply ${focus} in a concrete practical situation.`,
    priorKnowledge: `Learners know the basic context of ${sourceName}, but need guided practice.`,
    tone: 'clear, practical, and specific',
  };
};

const preparationFromDraft = (
  draft: CourseDraft,
  generated: Record<string, unknown> = {},
): LearningBlueprint['coursePreparation'] => {
  const outputLanguage = courseOutputLanguage(draft);
  const existing = draft.learningBlueprint.coursePreparation;
  const fallback = fallbackPreparationFor(draft, outputLanguage);
  return {
    activityMixPreference: firstNonEmptyText(
      asText(generated['activityMixPreference']),
      existing.activityMixPreference,
      fallback.activityMixPreference,
    ),
    audience: firstNonEmptyText(
      asText(generated['audience']),
      existing.audience,
      fallback.audience,
    ),
    constraints: firstNonEmptyText(
      asText(generated['constraints']),
      existing.constraints,
      fallback.constraints,
    ),
    depth: firstNonEmptyText(asText(generated['depth']), existing.depth, fallback.depth),
    desiredOutcome: firstNonEmptyText(
      asText(generated['desiredOutcome']),
      existing.desiredOutcome,
      fallback.desiredOutcome,
    ),
    language: outputLanguage,
    languagePreference: existing.languagePreference,
    priorKnowledge: firstNonEmptyText(
      asText(generated['priorKnowledge']),
      existing.priorKnowledge,
      fallback.priorKnowledge,
    ),
    sourceStrictness:
      generated['sourceStrictness'] === 'strict' || existing.sourceStrictness === 'strict'
        ? 'strict'
        : 'standard',
    tone: firstNonEmptyText(asText(generated['tone']), existing.tone, fallback.tone),
  };
};

const normalizeObjectives = (
  draft: CourseDraft,
  generatedObjectives: unknown[],
  timestamp: string,
): LearningObjective[] => {
  const objectiveInputs =
    generatedObjectives.length > 0
      ? generatedObjectives.map((objective) => {
          const record = asRecord(objective) as GeneratedObjectiveObject;
          return {
            capability: asText(record.capability),
            title: asText(record.title),
            topicName: asText(record.topicName),
          };
        })
      : Array.from({ length: 4 }, (_, index) => ({
          capability:
            draft.language === 'cs'
              ? `Student umí prakticky použít ${fallbackTitle(draft, index)}.`
              : `Learner can apply ${fallbackTitle(draft, index)} in a practical situation.`,
          title: fallbackTitle(draft, index),
          topicName: fallbackTitle(draft, index),
        }));

  const usedTitles = new Set<string>();
  return objectiveInputs.slice(0, 6).flatMap((objective, index): LearningObjective[] => {
    const title = firstNonEmptyText(
      objective.title,
      objective.topicName,
      fallbackTitle(draft, index),
    );
    const normalizedTitle = title.toLowerCase();
    if (usedTitles.has(normalizedTitle)) {
      return [];
    }
    usedTitles.add(normalizedTitle);
    const capability = firstNonEmptyText(
      objective.capability,
      draft.language === 'cs'
        ? `Student umí prakticky použít ${title}.`
        : `Learner can apply ${title} in a practical situation.`,
    );
    const evidence = objectiveEvidenceFor(draft, `${title} ${capability} ${objective.topicName}`);
    return [
      {
        capability,
        id: `objective_${draft.id}_${index + 1}`,
        sourceConfidence: evidence.sourceConfidence,
        sourceReferences: evidence.sourceReferences,
        sourceSupport: evidence.sourceSupport,
        status: 'generated',
        title,
        topicName: firstNonEmptyText(objective.topicName, title),
        updatedAt: timestamp,
      },
    ];
  });
};

const activityBriefCopy = (
  draft: CourseDraft,
  objective: LearningObjective,
  type: ActivityType,
) => {
  if (draft.language === 'cs') {
    const learnerAction =
      type === 'retrieval_check'
        ? `Vybavit si nebo rozpoznat klíčové prvky pro ${objective.title}.`
        : `Použít ${objective.title} v praktické situaci.`;
    return {
      feedbackGuidance: `Zpětná vazba má porovnat odpověď s cílem: ${objective.capability}`,
      instructions: `Vypracujte úkol k cíli ${objective.title}.`,
      learnerAction,
      successCriteria: `Odpověď musí prokázat, že student zvládá: ${objective.capability}`,
      title: `${objective.title}: ${type.replaceAll('_', ' ')}`,
    };
  }
  const learnerAction =
    type === 'retrieval_check'
      ? `Recall or recognize the key elements of ${objective.title}.`
      : `Apply ${objective.title} to a practical situation.`;
  return {
    feedbackGuidance: `Feedback should compare the answer against this objective: ${objective.capability}`,
    instructions: `Complete the task for ${objective.title}.`,
    learnerAction,
    successCriteria: `The response must show that the learner can: ${objective.capability}`,
    title: `${objective.title}: ${type.replaceAll('_', ' ')}`,
  };
};

const normalizeActivityBriefs = (
  draft: CourseDraft,
  objectives: readonly LearningObjective[],
  generatedBriefs: unknown[],
  timestamp: string,
): ActivityBrief[] => {
  const briefsByObjectiveTitle = new Map<string, GeneratedActivityBriefObject>();
  for (const brief of generatedBriefs) {
    const record = asRecord(brief) as GeneratedActivityBriefObject;
    const objectiveTitle = asText(record.objectiveTitle).toLowerCase();
    if (objectiveTitle.length > 0) {
      briefsByObjectiveTitle.set(objectiveTitle, record);
    }
  }

  return objectives.map((objective, index): ActivityBrief => {
    const generatedBrief =
      briefsByObjectiveTitle.get(objective.title.toLowerCase()) ??
      (asRecord(generatedBriefs[index]) as GeneratedActivityBriefObject | undefined) ??
      {};
    const type = normalizedActivityType(generatedBrief.type, index);
    const copy = activityBriefCopy(draft, objective, type);
    const sourceReferences = objective.sourceReferences ?? [];
    return {
      feedbackGuidance: firstNonEmptyText(
        asText(generatedBrief.feedbackGuidance),
        copy.feedbackGuidance,
      ),
      id: `activity_brief_${draft.id}_${index + 1}`,
      instructions: firstNonEmptyText(asText(generatedBrief.instructions), copy.instructions),
      learnerAction: firstNonEmptyText(asText(generatedBrief.learnerAction), copy.learnerAction),
      objectiveId: objective.id,
      objectiveIds: [objective.id],
      sourceConfidence: objective.sourceConfidence,
      sourceReferences,
      status: 'generated',
      successCriteria: firstNonEmptyText(
        asText(generatedBrief.successCriteria),
        copy.successCriteria,
      ),
      title: firstNonEmptyText(asText(generatedBrief.title), copy.title),
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
  status: brief.status === 'stale' ? ('stale' as const) : ('generated' as const),
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

const hasAssessorOnlyShape = (value: string) =>
  /\b(?:assessment-only|target-answer|evaluator|hodnot[ií]m|d[aá]v[aá]m body|pova[zž]uj za spr[aá]vn[eé]|spr[aá]vn[eé] pl[aá]ny|target answer)\b/iu.test(
    value,
  );

const validLearnerText = (value: string) => value.trim().length > 0 && !hasAssessorOnlyShape(value);

const normalizeGeneratedRetrievalActivity = (
  brief: ActivityBrief,
  generated: GeneratedPlayableActivityObject,
): GeneratedActivity | null => {
  const question = asText(generated.question);
  const feedback = asText(generated.feedback);
  const explanationPrompt = asText(generated.explanationPrompt);
  const choices = asArray(generated.choices)
    .map((choice, index) => {
      const record = asRecord(choice) as GeneratedPlayableChoiceObject;
      const text = asText(record.text);
      const choiceFeedback = asText(record.feedback);
      if (!validLearnerText(text) || !validLearnerText(choiceFeedback)) {
        return null;
      }
      const isCorrect = generatedBoolean(record.isCorrect);
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
    !validLearnerText(question) ||
    !validLearnerText(feedback) ||
    !validLearnerText(explanationPrompt) ||
    choices.length < 2 ||
    !choices.some((choice) => choice.isCorrect)
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
  generated: GeneratedPlayableActivityObject,
): GeneratedActivity | null => {
  if (generated.mode !== 'matching' && generated.mode !== 'ordering') {
    return null;
  }
  const mode = generated.mode;
  const prompt = asText(generated.prompt);
  const feedback = asText(generated.feedback);
  const items = asArray(generated.items)
    .map((item, index) => {
      const record = asRecord(item) as GeneratedPlayableItemObject;
      const text = asText(record.text);
      if (!validLearnerText(text)) {
        return null;
      }
      if (mode === 'matching') {
        const { matchLabel: generatedMatchLabel } = record;
        const validMatchLabel = asText(generatedMatchLabel);
        if (!validLearnerText(validMatchLabel)) {
          return null;
        }
        return {
          id: `${brief.id}_match_${index + 1}`,
          matchLabel: validMatchLabel,
          text,
        };
      }
      const correctPosition = generatedPosition(record.correctPosition);
      if (correctPosition === null) {
        return null;
      }
      return {
        correctPosition,
        id: `${brief.id}_order_${index + 1}`,
        matchLabel: undefined,
        text,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
  const enoughItems = mode === 'matching' ? items.length >= 2 : items.length >= 3;
  const orderPositions = mode === 'ordering' ? items.map((item) => item.correctPosition) : [];
  const positionsAreUnique =
    mode !== 'ordering' ||
    (orderPositions.every((position): position is number => typeof position === 'number') &&
      new Set(orderPositions).size === orderPositions.length);
  if (
    !validLearnerText(prompt) ||
    !validLearnerText(feedback) ||
    !enoughItems ||
    !positionsAreUnique
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
  generated: GeneratedPlayableActivityObject,
): GeneratedActivity | null => {
  const scenario = asText(generated.prompt);
  const feedback = asText(generated.feedback);
  const justificationPrompt = asText(generated.justificationPrompt);
  const choices = asArray(generated.choices)
    .map((choice, index) => {
      const record = asRecord(choice) as GeneratedPlayableChoiceObject;
      const text = asText(record.text);
      const consequence = asText(record.consequence);
      const choiceFeedback = asText(record.feedback);
      if (
        !validLearnerText(text) ||
        !validLearnerText(consequence) ||
        !validLearnerText(choiceFeedback)
      ) {
        return null;
      }
      const isPreferred = generatedBoolean(record.isPreferred);
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
    !validLearnerText(scenario) ||
    !validLearnerText(feedback) ||
    !validLearnerText(justificationPrompt) ||
    choices.length < 2 ||
    !choices.some((choice) => choice.isPreferred)
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
  generated: GeneratedPlayableActivityObject,
): GeneratedActivity | null => {
  const prompt = asText(generated.prompt);
  const feedback = asText(generated.feedback);
  const submissionLabel = asText(generated.submissionLabel);
  const checklist = lineItemsFrom(generated.criteria).filter(validLearnerText);
  if (
    !validLearnerText(prompt) ||
    !validLearnerText(feedback) ||
    !validLearnerText(submissionLabel) ||
    checklist.length === 0
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
  generated: GeneratedPlayableActivityObject,
): GeneratedActivity | null => {
  const prompt = asText(generated.prompt);
  const feedback = asText(generated.feedback);
  const criteria = lineItemsFrom(generated.criteria).filter(validLearnerText);
  if (!validLearnerText(prompt) || !validLearnerText(feedback) || criteria.length === 0) {
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

export const normalizeGeneratedPlayableActivity = (
  brief: ActivityBrief,
  generated: unknown,
): GeneratedActivity | null => {
  const record = asRecord(generated) as GeneratedPlayableActivityObject;
  const type = generatedActivityType(record.type);
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

const normalizeGeneratedPlayableActivities = (
  activityBriefs: readonly ActivityBrief[],
  objectives: readonly LearningObjective[],
  generatedActivities: unknown[],
): GeneratedActivity[] => {
  const byObjectiveTitle = new Map<string, unknown>();
  for (const generated of generatedActivities) {
    const record = asRecord(generated) as GeneratedPlayableActivityObject;
    const objectiveTitle = asText(record.objectiveTitle).toLowerCase();
    if (objectiveTitle.length > 0) {
      byObjectiveTitle.set(objectiveTitle, generated);
    }
  }
  return activityBriefs.map((brief, index) => {
    const generated =
      byObjectiveTitle.get(objectives[index]?.title.toLowerCase() ?? '') ??
      generatedActivities[index];
    const activity = normalizeGeneratedPlayableActivity(brief, generated);
    if (activity === null) {
      throw new Error(
        `Ax generatedActivities is missing a valid playable spec for activity brief "${brief.title}" (${brief.id}).`,
      );
    }
    return activity;
  });
};

export const generatedActivityFromPlayableSpec = (
  brief: ActivityBrief,
  generated: unknown,
): GeneratedActivity | null => normalizeGeneratedPlayableActivity(brief, generated);

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

const normalizeLearningBlueprint = (
  draft: CourseDraft,
  generated: GeneratedLearningBlueprintObject,
): LearningBlueprint => {
  const timestamp = currentIsoTimestamp();
  const generatedPreparation = asRecord(generated.coursePreparation);
  const coursePreparation = preparationFromDraft(draft, generatedPreparation);
  const objectives = normalizeObjectives(draft, asArray(generated.objectives), timestamp);
  const activityBriefs = normalizeActivityBriefs(
    { ...draft, language: coursePreparation.language },
    objectives,
    asArray(generated.activityBriefs),
    timestamp,
  );
  const assumptions =
    typeof generated.assumptions === 'string'
      ? generated.assumptions
          .split(/\n+/u)
          .map((assumption) => assumption.trim())
          .filter(Boolean)
      : asArray(generated.assumptions).map(asText).filter(Boolean);
  return {
    activityBriefs,
    assumptions,
    coursePreparation,
    createdAt: timestamp,
    generatedActivities: normalizeGeneratedPlayableActivities(
      activityBriefs,
      objectives,
      asArray(generated.generatedActivities),
    ),
    objectives,
    sourceCoverage: sourceCoverageFor(objectives),
    updatedAt: timestamp,
  };
};

export const generateLearningBlueprintWithAi = (
  draft: CourseDraft,
): Promise<AiJsonResult<LearningBlueprint>> =>
  Effect.runPromise(
    generateStructuredObjectEffect(learningBlueprintProgram, {
      courseTitle: draft.title,
      existingPreparation: jsonTextFrom(draft.learningBlueprint.coursePreparation),
      languageCode: courseOutputLanguage(draft),
      sourceEvidence: processedSourceEvidence(draft),
    }).pipe(
      Effect.map((structuredResult) => ({
        ...structuredResult,
        value: normalizeLearningBlueprint(
          { ...draft, language: courseOutputLanguage(draft) },
          structuredResult.value as GeneratedLearningBlueprintObject,
        ),
      })),
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

const activityPrompt = (activity: GeneratedActivity | undefined, fallback: string) => {
  if (activity === undefined) {
    return fallback;
  }
  switch (activity.interaction.kind) {
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
      const unsupportedInteraction: never = activity.interaction;
      return unsupportedInteraction;
    }
  }
};

const activityFeedback = (activity: GeneratedActivity | undefined, fallback: string) =>
  activity?.interaction.feedback ?? fallback;

const sectionBlocksFor = (
  draft: CourseDraft,
  objective: LearningObjective,
  activity: GeneratedActivity | undefined,
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
      activityId: activity?.id,
      body: activityPrompt(activity, objective.capability),
      id: `content_block_${objective.id}_activity`,
      objectiveIds: [objective.id],
      sourceConfidence: activity?.sourceConfidence ?? sourceConfidence,
      sourceReferences: activity?.sourceReferences ?? references,
      status: 'generated' as const,
      title: activityPrompt(
        activity,
        draft.language === 'cs' ? 'Interaktivní úkol' : 'Interactive task',
      ),
      type: 'interactive_activity' as const,
    },
    {
      body: activityFeedback(activity, objective.capability),
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
): Promise<AiJsonResult<CourseContent>> => {
  const timestamp = currentIsoTimestamp();
  const activitiesByObjective = new Map(
    draft.learningBlueprint.generatedActivities.flatMap((activity) =>
      activity.objectiveIds.map((objectiveId) => [objectiveId, activity] as const),
    ),
  );
  const sections: CourseSection[] = draft.learningBlueprint.objectives.map((objective, index) => {
    const activity = activitiesByObjective.get(objective.id);
    const references = sourceReferencesForObjective(objective);
    return {
      blocks: sectionBlocksFor(draft, objective, activity, index),
      id: `content_section_${objective.id}`,
      objectiveIds: [objective.id],
      sourceConfidence: objective.sourceConfidence,
      sourceReferences: references,
      status: 'generated' as const,
      summary: objective.capability,
      title: objective.title,
    };
  });
  return Effect.runPromise(
    Effect.succeed(
      localCourseContentRendererResult({
        createdAt: timestamp,
        sections,
        status: sections.length > 0 ? 'generated' : 'empty',
        updatedAt: timestamp,
      }),
    ),
  );
};
