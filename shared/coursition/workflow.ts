// @effect-diagnostics strictBooleanExpressions:off
export type AiMode = 'generate' | 'assist';
export type DraftStep =
  | 'mode'
  | 'knowledge'
  | 'questions'
  | 'topics'
  | 'target'
  | 'chapters'
  | 'lessons'
  | 'builder'
  | 'preview';

export const workflowSteps = [
  'mode',
  'knowledge',
  'questions',
  'topics',
  'target',
  'chapters',
  'lessons',
  'builder',
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
  originalInput?: string;
  failureReason?: string;
  createdAt?: string;
  deletedAt?: string;
  storageReference?: string;
  mimeType?: string;
  providerJobId?: string;
}

export interface SourceReference {
  sourceAssetId: string;
  position: string;
  heading?: string;
  page?: number;
  slide?: number;
  timestampSeconds?: number;
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

export type SourceSupport = 'source_backed' | 'partially_source_backed' | 'manual';
export type ActivityType =
  | 'retrieval_check'
  | 'practice_task'
  | 'scenario_decision'
  | 'ordering_matching'
  | 'rubric_answer';

export interface GuidedQuestions {
  outcome: string;
  audience: string;
  priorKnowledge: string;
  depth: string;
  avoid: string;
  practice: string;
  strictSourceOnly: boolean;
}

export interface Topic {
  id: string;
  name: string;
  description: string;
  importance: 'low' | 'medium' | 'high' | 'critical';
  sourceSupport: SourceSupport;
}

export interface LearningObjective {
  id: string;
  title: string;
  capability: string;
  topicName: string;
  sourceSupport: SourceSupport;
  sourceReferences?: SourceReference[];
}

export interface ActivityBrief {
  id: string;
  objectiveId: string;
  type: ActivityType;
  title: string;
  learnerAction: string;
  successCriteria: string;
  feedbackGuidance: string;
  sourceReferences?: SourceReference[];
}

export interface LearningBlueprint {
  assumptions: string[];
  objectives: LearningObjective[];
  activityBriefs: ActivityBrief[];
  sourceCoverage: SourceSupport;
  createdAt: string;
  updatedAt: string;
}

export type LessonBlockType =
  | 'heading'
  | 'rich_text'
  | 'callout'
  | 'image'
  | 'media'
  | 'file'
  | 'quiz'
  | 'exercise'
  | 'code'
  | 'reflection'
  | 'objective'
  | 'explanation'
  | 'check'
  | 'summary';

export interface TargetLearner {
  profile: string;
  currentKnowledge: string;
  motivation: string;
  pain: string;
  desiredOutcome: string;
  constraints: string;
  practiceStyle: string;
}

export interface LessonBlock {
  id: string;
  type: LessonBlockType;
  title: string;
  body: string;
  provenance: 'source-backed' | 'AI-inferred' | 'manual' | 'mixed';
  sourceReferences?: SourceReference[];
}

export interface Lesson {
  id: string;
  title: string;
  durationMinutes: number;
  blocks: LessonBlock[];
}

export interface Chapter {
  id: string;
  title: string;
  description: string;
  outcome: string;
  coveredTopicIds: string[];
  difficulty: 'introductory' | 'intermediate' | 'advanced';
  lessons: Lesson[];
  plannedLessonCount: number;
  sourceSupport: Topic['sourceSupport'];
  status: 'draft' | 'confirmed';
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
  targetType:
    | 'activity'
    | 'block'
    | 'chapter'
    | 'course'
    | 'lesson'
    | 'objective'
    | 'source'
    | 'topic';
}

export type AiRunStatus =
  | 'queued'
  | 'running'
  | 'needs_review'
  | 'applied'
  | 'failed'
  | 'cancelled';
export type AiRunType =
  | 'learning_blueprint_generation'
  | 'topic_generation'
  | 'target_learner_generation'
  | 'chapter_generation'
  | 'lesson_generation'
  | 'teaching_quality_review';

export interface AiRun {
  id: string;
  draftId: string;
  type: AiRunType;
  status: AiRunStatus;
  provider: string;
  model: string;
  inputSummary: string;
  createdAt: string;
  updatedAt: string;
  appliedAt?: string;
  failureReason?: string;
  outputText?: string;
  providerRequestId?: string;
}

export interface CourseDraft {
  id: string;
  ownerId: string;
  title: string;
  language: 'en' | 'cs';
  mode: AiMode;
  step: DraftStep;
  sources: SourceAsset[];
  derivedSourceDocuments: DerivedSourceDocument[];
  knowledgeChunks: KnowledgeChunk[];
  questions: GuidedQuestions;
  learningBlueprint: LearningBlueprint;
  topics: Topic[];
  targetLearner: TargetLearner;
  chapters: Chapter[];
  findings: ReviewFinding[];
  aiRuns: AiRun[];
  sourceProcessingIncomplete: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CourseDraftSummary {
  id: string;
  title: string;
  language: CourseDraft['language'];
  mode: AiMode;
  step: DraftStep;
  sourceCount: number;
  chapterCount: number;
  lessonCount: number;
  updatedAt: string;
}

export interface WorkflowSnapshot {
  draft: CourseDraft | null;
  drafts: CourseDraftSummary[];
  config: {
    auth: 'better-auth';
    storage: 'json-file';
    aiProviderConfigured: boolean;
    llamaParseConfigured: boolean;
    deepgramConfigured: boolean;
    webExtractionConfigured: boolean;
  };
}

export type WorkflowAction =
  | { action: 'getState' }
  | { action: 'createDraft'; title: string; language: 'en' | 'cs' }
  | { action: 'selectDraft'; draftId: string }
  | { action: 'deleteDraft'; confirm: true; draftId: string }
  | { action: 'updateDraftTitle'; draftId: string; title: string }
  | { action: 'goToStep'; draftId: string; step: DraftStep }
  | { action: 'setMode'; draftId: string; mode: AiMode }
  | { action: 'buildFullCourse'; draftId: string }
  | {
      action: 'addSource';
      draftId: string;
      source: Pick<SourceAsset, 'type' | 'name' | 'content'> & { sizeLabel?: string };
    }
  | { action: 'deleteSource'; draftId: string; sourceId: string }
  | { action: 'retrySource'; draftId: string; sourceId: string }
  | { action: 'retryAiRun'; draftId: string; runId: string }
  | { action: 'autosaveQuestions'; draftId: string; questions: GuidedQuestions }
  | { action: 'saveQuestions'; draftId: string; questions: GuidedQuestions }
  | { action: 'generateTopics'; draftId: string }
  | { action: 'addTopic'; draftId: string; name: string; description: string }
  | { action: 'updateTopic'; draftId: string; topicId: string; name: string; description: string }
  | { action: 'deleteTopic'; draftId: string; topicId: string }
  | { action: 'generateTargetLearner'; draftId: string }
  | { action: 'updateTargetLearner'; draftId: string; targetLearner: TargetLearner }
  | { action: 'confirmTarget'; draftId: string; targetLearner: TargetLearner }
  | { action: 'addChapter'; draftId: string; title: string; outcome: string; description: string }
  | {
      action: 'updateChapter';
      draftId: string;
      chapterId: string;
      title: string;
      outcome: string;
      description: string;
    }
  | { action: 'deleteChapter'; draftId: string; chapterId: string }
  | { action: 'moveChapter'; draftId: string; chapterId: string; direction: 'up' | 'down' }
  | { action: 'confirmChapters'; draftId: string }
  | { action: 'generateChapters'; draftId: string }
  | { action: 'generateLessons'; draftId: string }
  | { action: 'generateChapterLessons'; draftId: string; chapterId: string }
  | { action: 'regenerateLesson'; draftId: string; lessonId: string }
  | { action: 'addLesson'; draftId: string; chapterId: string; title: string }
  | {
      action: 'updateLesson';
      draftId: string;
      lessonId: string;
      title: string;
      durationMinutes: number;
    }
  | { action: 'deleteLesson'; draftId: string; lessonId: string }
  | { action: 'moveLesson'; draftId: string; lessonId: string; direction: 'up' | 'down' }
  | {
      action: 'addBlock';
      draftId: string;
      lessonId: string;
      blockType: LessonBlockType;
      title: string;
      body: string;
    }
  | {
      action: 'updateBlock';
      draftId: string;
      blockId: string;
      title: string;
      body: string;
    }
  | { action: 'deleteBlock'; draftId: string; blockId: string }
  | { action: 'moveBlock'; draftId: string; blockId: string; direction: 'up' | 'down' }
  | {
      action: 'setFindingStatus';
      draftId: string;
      findingId: string;
      status: ReviewFinding['status'];
    }
  | { action: 'openPreview'; draftId: string };

export const emptyQuestions = (): GuidedQuestions => ({
  audience: '',
  avoid: '',
  depth: 'practical',
  outcome: '',
  practice: '',
  priorKnowledge: '',
  strictSourceOnly: false,
});

const hasGeneratedQuestionSeed = (questions: GuidedQuestions) =>
  questions.outcome.trim().length > 0 ||
  questions.audience.trim().length > 0 ||
  questions.practice.trim().length > 0;

export const emptyTargetLearner = (): TargetLearner => ({
  constraints: '',
  currentKnowledge: '',
  desiredOutcome: '',
  motivation: '',
  pain: '',
  practiceStyle: 'project_tasks',
  profile: '',
});

const stopWords = new Set([
  'about',
  'after',
  'before',
  'build',
  'course',
  'from',
  'into',
  'learn',
  'material',
  'should',
  'source',
  'that',
  'their',
  'they',
  'this',
  'with',
]);

const wordsFrom = (value: string) =>
  value
    .toLowerCase()
    .replaceAll(/[^a-z0-9\s-]/gu, ' ')
    .split(/\s+/u)
    .filter((word) => word.length > 4 && !stopWords.has(word));

const titleCase = (value: string) =>
  value
    .split(/[\s-]+/u)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ');

const workflowCopy = {
  cs: {
    apply: (chapterTitle: string) => `Použít ${chapterTitle}`,
    chapterOutcome: (topicName: string, outcome: string) =>
      `Studenti umí použít ${topicName} na ${outcome}.`,
    chapterTooAdvancedDetail: (chapterTitle: string) =>
      `Kapitola ${chapterTitle} je označená jako pokročilá, ale cílový student má začátečnický nebo nejasný vstup. Přidejte předchozí průpravnou kapitolu, upravte obtížnost, nebo zpřesněte vstupní znalosti.`,
    chapterTooAdvancedTitle: 'Obtížnost kapitoly neodpovídá cílovému studentovi',
    checkBlock:
      'Ověřte, zda student umí vysvětlit výsledek, dokončit praktický úkol a pojmenovat jeden důvod podložený zdrojem.',
    checkTitle: 'Kontrola',
    defaultAudience: 'Autoři, kteří potřebují soustředěnou praktickou výukovou cestu.',
    defaultConstraints: 'Omezený čas a potřeba přímé praktické práce.',
    defaultCurrentKnowledge: 'Znají kontext, ale potřebují vedenou cestu.',
    defaultPain: 'Materiál je roztříštěný a těžko se převádí na výuku.',
    defaultPractice: 'projektové úkoly',
    defaultSummary: 'Shrňte rozhodnutí, podporu ze zdrojů a další krok před pokračováním.',
    defaultTopicDescription: (draftTitle: string) => `Ujasnit hlavní výsledek pro ${draftTitle}.`,
    desiredOutcome: (draftTitle: string) =>
      `Umí použít ${draftTitle} ve skutečném pracovním postupu.`,
    exerciseFallback:
      'Požádejte studenta, aby použil myšlenku kapitoly na jeden skutečný úkol a zapsal podmínku úspěchu.',
    exercisePrefix: 'Praxe',
    exerciseTitle: 'Praxe',
    explanationBlock: (chapterTitle: string, learnerProfile: string) =>
      `Vysvětlete ${chapterTitle} pomocí zpracovaných zdrojů a profilu studenta: ${learnerProfile}.`,
    explanationTitle: 'Vysvětlení',
    generatedPractice: (sourceFocus: string) =>
      `Vytvořit praktický výstup pomocí zdroje ${sourceFocus}.`,
    incompleteSourceDetail:
      'Zatím není dostupný žádný zpracovaný zdroj, takže vygenerovaný obsah není plně podložen zdroji.',
    incompleteSourceTitle: 'Pokrytí zdroji je neúplné',
    lessonQualityDetail: (lessonTitle: string, missing: string) =>
      `${lessonTitle} postrádá ${missing}.`,
    lessonQualityTitle: 'Pravidlo kvality lekce selhalo',
    motivation: 'Potřebují kurz, který přemění zdrojový materiál na použitelné dovednosti.',
    objectiveTitle: 'Cíl',
    requiredQuestionDetail: (missing: string) =>
      `Režim generování potřebuje doplnit: ${missing}. Bez těchto údajů by AI vytvořila příliš obecný kurz.`,
    requiredQuestionTitle: 'Doplňte povinné výukové otázky',
    sourceOnlyGapBlock: (chapterTitle: string) =>
      `Vysvětlení pro ${chapterTitle} zatím potřebuje zpracovaný zdroj. Doplňte zdrojový materiál, aby tato část mohla být podložená a připravená k publikování.`,
    summaryTitle: 'Shrnutí',
    targetAudienceBroadDetail:
      'Profil studenta je příliš široký. Zúžte ho na konkrétní roli, kontext nebo odpovědnost.',
    targetAudienceBroadTitle: 'Cílový student je příliš široký',
    targetOutcomeWeakDetail:
      'Výsledek kurzu by měl popisovat pozorovatelnou schopnost, například co student vytvoří, použije, vyhodnotí nebo dokončí.',
    targetOutcomeWeakTitle: 'Výsledek kurzu není měřitelný',
    targetPrerequisiteMissingDetail:
      'Doplňte, co už student zná nebo zvládá, aby kapitoly nezačaly příliš jednoduše nebo příliš pokročile.',
    targetPrerequisiteMissingTitle: 'Chybí vstupní znalosti studenta',
    topicCoverageDetail: (topicName: string) =>
      `Přijaté téma ${topicName} zatím nepokrývá žádná kapitola. Přidejte ho do struktury, nebo téma odmítněte.`,
    topicCoverageTitle: 'Přijaté téma chybí v kapitolách',
    topicDescription: (topicName: string, outcome: string) =>
      `Naučit studenta, jak ${topicName} ovlivňuje ${outcome}.`,
    topicDuplicateDetail: (topicName: string, count: number) =>
      `Téma ${topicName} se objevuje ${count}x. Sloučením nebo odmítnutím duplicit zůstane struktura kurzu čistá.`,
    topicDuplicateTitle: 'Duplicitní téma',
    topicName: (word: string) => word.toLowerCase(),
    topicSourceGapDetail: (topicName: string) =>
      `Téma ${topicName} je vybrané, ale zpracované zdroje ho jasně nepodporují. Přidejte zdroj, upravte téma, nebo ho ponechte jako ruční záměr.`,
    topicSourceGapTitle: 'Téma potřebuje podporu zdroji',
    unsupportedClaimDetail: (blockTitle: string, lessonTitle: string) =>
      `Blok ${blockTitle} v lekci ${lessonTitle} je AI odvozený, ale nemá žádný odkaz na zdroj. Doplňte zdroj, přepište tvrzení ručně, nebo ho označte jako úkol k doplnění.`,
    unsupportedClaimTitle: 'Blok obsahuje nepodložené AI tvrzení',
  },
  en: {
    apply: (chapterTitle: string) => `Apply ${chapterTitle}`,
    chapterOutcome: (topicName: string, outcome: string) =>
      `Learners can apply ${topicName} to ${outcome}.`,
    chapterTooAdvancedDetail: (chapterTitle: string) =>
      `${chapterTitle} is marked advanced, but the target learner has beginner or unclear prerequisites. Add a preparatory chapter, lower the difficulty, or clarify learner prerequisites.`,
    chapterTooAdvancedTitle: 'Chapter difficulty does not match the target learner',
    checkBlock:
      'Check whether the learner can explain the outcome, complete the practice task, and identify one source-backed reason.',
    checkTitle: 'Check',
    defaultAudience: 'Creators who need a focused, practical learning path.',
    defaultConstraints: 'Limited time and a need for direct practical work.',
    defaultCurrentKnowledge: 'They know the context but need a guided path.',
    defaultPain: 'The material is scattered and hard to turn into a teachable sequence.',
    defaultPractice: 'project tasks',
    defaultSummary:
      'Summarize the decision, the source support, and the next action before continuing.',
    defaultTopicDescription: (draftTitle: string) => `Clarify the main outcome for ${draftTitle}.`,
    desiredOutcome: (draftTitle: string) => `They can apply ${draftTitle} in a real workflow.`,
    exerciseFallback:
      'Ask the learner to apply the chapter idea to one real task and write the success condition.',
    exercisePrefix: 'Practice',
    exerciseTitle: 'Practice',
    explanationBlock: (chapterTitle: string, learnerProfile: string) =>
      `Explain ${chapterTitle} using the processed sources and the learner profile: ${learnerProfile}.`,
    explanationTitle: 'Explanation',
    generatedPractice: (sourceFocus: string) => `Build a practical output using ${sourceFocus}.`,
    incompleteSourceDetail:
      'No processed source is available yet, so generated content is not fully source-backed.',
    incompleteSourceTitle: 'Source coverage is incomplete',
    lessonQualityDetail: (lessonTitle: string, missing: string) =>
      `${lessonTitle} is missing ${missing}.`,
    lessonQualityTitle: 'Lesson quality rule failed',
    motivation: 'They need a course that turns source material into usable skills.',
    objectiveTitle: 'Objective',
    requiredQuestionDetail: (missing: string) =>
      `Generate mode needs: ${missing}. Without these inputs, AI would create a generic course.`,
    requiredQuestionTitle: 'Complete required teaching questions',
    sourceOnlyGapBlock: (chapterTitle: string) =>
      `The explanation for ${chapterTitle} needs processed source material before it is ready to publish. Add source evidence so this section can stay source-backed.`,
    summaryTitle: 'Summary',
    targetAudienceBroadDetail:
      'The learner profile is too broad. Narrow it to a specific role, context, or responsibility.',
    targetAudienceBroadTitle: 'Target learner is too broad',
    targetOutcomeWeakDetail:
      'The course outcome should describe an observable capability, such as what learners will create, apply, evaluate, or complete.',
    targetOutcomeWeakTitle: 'Course outcome is not measurable',
    targetPrerequisiteMissingDetail:
      'Add what learners already know or can do so chapters do not start too basic or too advanced.',
    targetPrerequisiteMissingTitle: 'Learner prerequisites are missing',
    topicCoverageDetail: (topicName: string) =>
      `Topic ${topicName} is not covered by any chapter yet. Add it to the structure or delete the topic.`,
    topicCoverageTitle: 'Topic missing from chapters',
    topicDescription: (topicName: string, outcome: string) =>
      `Teach the learner how ${topicName} affects ${outcome}.`,
    topicDuplicateDetail: (topicName: string, count: number) =>
      `${topicName} appears ${count} times. Merge or delete duplicates to keep the course structure focused.`,
    topicDuplicateTitle: 'Duplicate topic',
    topicName: titleCase,
    topicSourceGapDetail: (topicName: string) =>
      `${topicName} is selected, but processed sources do not clearly support it. Add source material, revise the topic, or keep it as manual intent.`,
    topicSourceGapTitle: 'Topic needs source support',
    unsupportedClaimDetail: (blockTitle: string, lessonTitle: string) =>
      `${blockTitle} in ${lessonTitle} is AI-inferred, but it has no source reference. Add source material, rewrite the claim manually, or mark it as a source gap.`,
    unsupportedClaimTitle: 'Block contains an unsupported AI claim',
  },
};

const copyFor = (draft: CourseDraft) => workflowCopy[draft.language];

export const sourceOnlyGapBlockFor = (language: CourseDraft['language'], chapterTitle: string) =>
  workflowCopy[language].sourceOnlyGapBlock(chapterTitle);

export const lessonBlockTitlesFor = (language: CourseDraft['language']) => {
  const copy = workflowCopy[language];
  return {
    check: copy.checkTitle,
    exercise: copy.exerciseTitle,
    explanation: copy.explanationTitle,
    objective: copy.objectiveTitle,
    summary: copy.summaryTitle,
  };
};

const sourceNameForQuestions = (draft: CourseDraft) =>
  draft.sources.find((source) => source.status === 'processed' && source.name.trim().length > 0)
    ?.name ?? draft.title;

const questionFocusFor = (draft: CourseDraft) => {
  const sourceCorpus = [
    draft.knowledgeChunks.map((chunk) => chunk.content).join(' '),
    draft.sources
      .filter((source) => source.status === 'processed')
      .map((source) => `${source.name} ${source.content}`)
      .join(' '),
    draft.title,
  ].join(' ');
  const focusWords = wordsFrom(sourceCorpus).slice(0, 3);
  if (focusWords.length === 0) {
    return draft.title.trim() || (draft.language === 'cs' ? 'téma kurzu' : 'the course topic');
  }
  const focus = titleCase(focusWords.join(' '));
  return draft.language === 'cs' ? focus.toLowerCase() : focus;
};

export const suggestQuestions = (draft: CourseDraft): GuidedQuestions => {
  if (hasGeneratedQuestionSeed(draft.questions)) {
    return draft.questions;
  }
  const focus = questionFocusFor(draft);
  const sourceFocus = sourceNameForQuestions(draft);

  if (draft.language === 'cs') {
    return {
      ...draft.questions,
      audience: `Lidé, kteří potřebují prakticky zvládnout ${focus}.`,
      avoid: `Vyhnout se obecné výuce, která nevychází ze zdroje ${sourceFocus}.`,
      depth: draft.questions.depth || 'practical',
      outcome: `Umí použít ${focus} v konkrétním pracovním postupu.`,
      practice: `Vytvořit praktický plán pro ${focus} pomocí zdroje ${sourceFocus}.`,
      priorKnowledge: `Znají základní kontext zdroje ${sourceFocus}, ale potřebují z něj vytvořit použitelný postup.`,
      strictSourceOnly: draft.sources.some((source) => source.status === 'processed'),
    };
  }

  return {
    ...draft.questions,
    audience: `Learners who need to apply ${focus} in a practical workflow.`,
    avoid: `Avoid generic coverage that is not supported by ${sourceFocus}.`,
    depth: draft.questions.depth || 'practical',
    outcome: `They can create and apply ${focus} in a concrete workflow.`,
    practice: `Create a practical plan for ${focus} using ${sourceFocus}.`,
    priorKnowledge: `They know the context in ${sourceFocus}, but need a structured way to apply it.`,
    strictSourceOnly: draft.sources.some((source) => source.status === 'processed'),
  };
};

const importanceFor = (index: number): Topic['importance'] => {
  if (index < 1) {
    return 'critical';
  }
  if (index < 3) {
    return 'high';
  }
  return 'medium';
};

const missingPrerequisiteValues = new Set(['n/a', 'none', 'not sure', 'unknown']);
const beginnerPrerequisitePattern =
  /\b(beginner|beginners|basic|junior|new to|no experience|little experience|novice|starter|starting|začátečník|začátečníci|základy|junior|nováček|bez zkušeností)\b/u;

const hasAdvancedTarget = (targetLearner: TargetLearner) =>
  /\b(advanced|senior|expert|experienced|lead|principal|production incident|triage|pokročilý|seniorní|expert)\b/u.test(
    `${targetLearner.profile} ${targetLearner.currentKnowledge}`.toLowerCase(),
  );

const hasBeginnerOrUnclearPrerequisites = (targetLearner: TargetLearner) => {
  const prerequisites = targetLearner.currentKnowledge.trim().toLowerCase();
  const learnerProfile = targetLearner.profile.trim().toLowerCase();
  return (
    prerequisites.length === 0 ||
    missingPrerequisiteValues.has(prerequisites) ||
    beginnerPrerequisitePattern.test(`${learnerProfile} ${prerequisites}`)
  );
};

const difficultyFor = (index: number, targetLearner?: TargetLearner): Chapter['difficulty'] => {
  if (targetLearner && hasBeginnerOrUnclearPrerequisites(targetLearner) && index > 0) {
    return 'intermediate';
  }
  if (targetLearner && !hasAdvancedTarget(targetLearner) && index > 0) {
    return 'intermediate';
  }
  if (index > 2) {
    return 'advanced';
  }
  if (index > 0) {
    return 'intermediate';
  }
  return 'introductory';
};

export const suggestTopics = (draft: CourseDraft): Topic[] => {
  const copy = copyFor(draft);
  const processedSources = draft.sources.filter((source) => source.status === 'processed');
  const corpus = [
    draft.title,
    draft.questions.outcome,
    draft.questions.audience,
    draft.questions.practice,
    processedSources.map((source) => source.content).join(' '),
  ].join(' ');
  const counts = new Map<string, number>();
  for (const word of wordsFrom(corpus)) {
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  const selected = [...counts.entries()]
    .toSorted((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 5)
    .map(([word], index): Topic => {
      const name = copy.topicName(word);
      return {
        description: copy.topicDescription(
          name.toLowerCase(),
          draft.questions.outcome || draft.title,
        ),
        id: `topic_${draft.id}_${index + 1}`,
        importance: importanceFor(index),
        name,
        sourceSupport: processedSources.length > 0 ? 'source_backed' : 'manual',
      };
    });

  if (selected.length > 0) {
    return selected;
  }

  return [
    {
      description: copy.defaultTopicDescription(draft.title),
      id: `topic_${draft.id}_1`,
      importance: 'critical',
      name: draft.title,
      sourceSupport: 'manual',
    },
  ];
};

export const buildTargetLearner = (draft: CourseDraft): TargetLearner => {
  const copy = copyFor(draft);
  return {
    constraints: draft.questions.avoid || copy.defaultConstraints,
    currentKnowledge: draft.questions.priorKnowledge || copy.defaultCurrentKnowledge,
    desiredOutcome: draft.questions.outcome || copy.desiredOutcome(draft.title),
    motivation: copy.motivation,
    pain: copy.defaultPain,
    practiceStyle: draft.questions.practice || copy.defaultPractice,
    profile: draft.questions.audience || copy.defaultAudience,
  };
};

export const topicsForCourse = (topics: Topic[]) => topics;

export type WorkflowGateReason =
  | 'blockingFinding'
  | 'chaptersRequired'
  | 'chapterConfirmationRequired'
  | 'fullCourseGenerationRequired'
  | 'generatedTopicsRequired'
  | 'lessonsRequired'
  | 'questionsRequired'
  | 'sourceRequired'
  | 'targetLearnerRequired'
  | 'topicsRequired';

export interface WorkflowGate {
  allowed: boolean;
  blockedStep?: DraftStep;
  finding?: ReviewFinding;
  reason?: WorkflowGateReason;
}

const allowedWorkflowGate: WorkflowGate = { allowed: true };

const hasReadableSource = (draft: CourseDraft) =>
  draft.sources.some((source) => source.status !== 'deleted' && source.content.trim().length > 0);

const hasRequiredQuestions = (draft: CourseDraft) =>
  draft.questions.outcome.trim().length > 0 &&
  draft.questions.audience.trim().length > 0 &&
  draft.questions.practice.trim().length > 0;

export const workflowStepIndex = (step: DraftStep) => {
  const activeStep = step === 'preview' ? 'builder' : step;
  return workflowSteps.indexOf(activeStep);
};

export const hasUsableTargetLearner = (draft: CourseDraft) =>
  draft.targetLearner.profile.trim().length > 0 &&
  draft.targetLearner.desiredOutcome.trim().length > 0;

export const hasConfirmedTargetLearner = (draft: CourseDraft) =>
  hasUsableTargetLearner(draft) &&
  !draft.aiRuns.some(
    (run) =>
      run.type === 'target_learner_generation' &&
      (run.status === 'queued' || run.status === 'running' || run.status === 'needs_review'),
  );

export const hasConfirmedChapters = (draft: CourseDraft) =>
  draft.chapters.length > 0 && draft.chapters.every((chapter) => chapter.status === 'confirmed');

export const buildChapters = (draft: CourseDraft): Chapter[] => {
  const copy = copyFor(draft);
  const topics = topicsForCourse(draft.topics);
  return topics.slice(0, 4).map((topic, index) => ({
    coveredTopicIds: [topic.id],
    description: topic.description,
    difficulty: difficultyFor(index, draft.targetLearner),
    id: `chapter_${draft.id}_${index + 1}`,
    lessons: [],
    outcome: copy.chapterOutcome(topic.name.toLowerCase(), draft.questions.outcome || draft.title),
    plannedLessonCount: 1,
    sourceSupport: topic.sourceSupport,
    status: 'draft',
    title: `${index + 1}. ${topic.name}`,
  }));
};

export const buildLessons = (draft: CourseDraft): Chapter[] =>
  draft.chapters.map((chapter, chapterIndex) => {
    const copy = copyFor(draft);
    const sourceReferences = draft.knowledgeChunks.slice(0, 3).map((chunk) => chunk.reference);
    const hasProcessedSources = sourceReferences.length > 0;
    const needsSourceOnlyGap = draft.questions.strictSourceOnly && !hasProcessedSources;
    const lessonId = `lesson_${chapter.id}_1`;
    const chapterTitle = chapter.title.replace(/^\d+\.\s*/u, '');
    return {
      ...chapter,
      lessons: [
        {
          blocks: [
            {
              body: chapter.outcome,
              id: `block_${lessonId}_objective`,
              provenance: 'AI-inferred',
              title: copy.objectiveTitle,
              type: 'objective',
            },
            {
              body: needsSourceOnlyGap
                ? copy.sourceOnlyGapBlock(chapterTitle)
                : copy.explanationBlock(chapterTitle, draft.targetLearner.profile),
              id: `block_${lessonId}_explanation`,
              provenance: hasProcessedSources ? 'source-backed' : 'AI-inferred',
              ...(hasProcessedSources ? { sourceReferences } : {}),
              title: copy.explanationTitle,
              type: 'explanation',
            },
            {
              body: draft.questions.practice
                ? `${copy.exercisePrefix}: ${draft.questions.practice}.`
                : copy.exerciseFallback,
              id: `block_${lessonId}_exercise`,
              provenance: 'mixed',
              title: copy.exerciseTitle,
              type: 'exercise',
            },
            {
              body: copy.checkBlock,
              id: `block_${lessonId}_check`,
              provenance: 'AI-inferred',
              title: copy.checkTitle,
              type: 'check',
            },
            {
              body: copy.defaultSummary,
              id: `block_${lessonId}_summary`,
              provenance: 'AI-inferred',
              title: copy.summaryTitle,
              type: 'summary',
            },
          ],
          durationMinutes: 12 + chapterIndex * 3,
          id: lessonId,
          title: copy.apply(chapterTitle),
        },
      ],
    };
  });

type PreserveFindingStatus = (finding: Omit<ReviewFinding, 'status'>) => ReviewFinding;

const buildTopicSourceSupportFindings = (
  draft: CourseDraft,
  findingWithPreservedStatus: PreserveFindingStatus,
): ReviewFinding[] => {
  const copy = copyFor(draft);
  const processedSourceEvidence = [
    ...draft.knowledgeChunks.map((chunk) => chunk.content),
    ...draft.sources
      .filter((source) => source.status === 'processed')
      .map((source) => source.content),
  ].join(' ');
  const processedEvidenceWords = new Set(wordsFrom(processedSourceEvidence));
  if (processedEvidenceWords.size === 0) {
    return [];
  }
  const processedSourceFingerprint = draft.sources
    .filter((source) => source.status === 'processed')
    .map((source) => `${source.id}:${source.status}:${source.processor}:${source.content.length}`)
    .join('|');

  return draft.topics
    .filter((candidate) => candidate.sourceSupport !== 'source_backed')
    .flatMap((topic) => {
      const topicWords = [...new Set(wordsFrom(topic.name))];
      const supportedWords = topicWords.filter((word) => processedEvidenceWords.has(word));
      if (topicWords.length === 0 || supportedWords.length > 0) {
        return [];
      }
      return [
        findingWithPreservedStatus({
          detail: copy.topicSourceGapDetail(topic.name),
          fingerprint: [
            topic.id,
            topic.sourceSupport,
            topic.name.trim().toLowerCase(),
            topicWords.join(','),
            processedSourceFingerprint,
          ].join('|'),
          id: `finding_${topic.id}_source_support`,
          severity: 'warning',
          step: 'topics',
          targetId: topic.id,
          targetType: 'topic',
          title: copy.topicSourceGapTitle,
        }),
      ];
    });
};

const buildTopicChapterCoverageFindings = (
  draft: CourseDraft,
  findingWithPreservedStatus: PreserveFindingStatus,
): ReviewFinding[] => {
  if (draft.chapters.length === 0) {
    return [];
  }
  const copy = copyFor(draft);
  const coveredTopicIds = new Set(
    draft.chapters.flatMap((chapter) => chapter.coveredTopicIds.filter(Boolean)),
  );
  const chapterCoverageFingerprint = draft.chapters.map(
    (chapter) => `${chapter.id}:${chapter.coveredTopicIds.join(',')}`,
  );

  return draft.topics
    .filter((candidate) => !coveredTopicIds.has(candidate.id))
    .map((topic) =>
      findingWithPreservedStatus({
        detail: copy.topicCoverageDetail(topic.name),
        fingerprint: [
          topic.id,
          topic.name.trim().toLowerCase(),
          ...chapterCoverageFingerprint,
        ].join('|'),
        id: `finding_${topic.id}_chapter_coverage`,
        severity: 'warning',
        step: 'chapters',
        targetId: topic.id,
        targetType: 'topic',
        title: copy.topicCoverageTitle,
      }),
    );
};

const broadAudiencePattern =
  /\b(anyone|everyone|all learners|all users|beginners|general audience|students)\b/u;
const measurableOutcomeVerbs = new Set([
  'apply',
  'analyze',
  'assess',
  'build',
  'complete',
  'create',
  'debug',
  'decide',
  'deliver',
  'design',
  'evaluate',
  'explain',
  'identify',
  'implement',
  'improve',
  'produce',
  'review',
  'ship',
  'write',
]);
const sourceClaimBlockTypes = new Set<LessonBlockType>(['callout', 'explanation', 'rich_text']);
const sourceGapPattern =
  /\b(todo:\s*add source evidence|needs processed source material|doplňte zdrojový důkaz|potřebuje zpracovaný zdroj)\b/u;

const hasTargetLearnerInput = (targetLearner: TargetLearner) =>
  [
    targetLearner.profile,
    targetLearner.currentKnowledge,
    targetLearner.desiredOutcome,
    targetLearner.practiceStyle,
  ].some((value) => value.trim().length > 0);

const hasMeasurableOutcome = (value: string) => {
  const words = wordsFrom(value);
  return words.some((word) => measurableOutcomeVerbs.has(word));
};

const hasBroadLearnerProfile = (value: string) => {
  const words = wordsFrom(value);
  return words.length < 2 || (words.length < 8 && broadAudiencePattern.test(value));
};

interface TargetLearnerQuestionFallbackDraft {
  language: CourseDraft['language'];
  questions: Readonly<GuidedQuestions>;
  targetLearner: Readonly<TargetLearner>;
  title: string;
}

export const targetLearnerWithQuestionFallbacks = (
  draft: TargetLearnerQuestionFallbackDraft,
  targetLearner: Readonly<TargetLearner> = draft.targetLearner,
): TargetLearner => {
  const copy = workflowCopy[draft.language];
  const fallback: TargetLearner = {
    constraints: draft.questions.avoid || copy.defaultConstraints,
    currentKnowledge: draft.questions.priorKnowledge || copy.defaultCurrentKnowledge,
    desiredOutcome: draft.questions.outcome || copy.desiredOutcome(draft.title),
    motivation: copy.motivation,
    pain: copy.defaultPain,
    practiceStyle: draft.questions.practice || copy.defaultPractice,
    profile: draft.questions.audience || copy.defaultAudience,
  };
  const profile = targetLearner.profile.trim();
  const currentKnowledge = targetLearner.currentKnowledge.trim();
  const desiredOutcome = targetLearner.desiredOutcome.trim();
  return {
    constraints: targetLearner.constraints.trim() || fallback.constraints,
    currentKnowledge:
      currentKnowledge.length === 0 || missingPrerequisiteValues.has(currentKnowledge.toLowerCase())
        ? fallback.currentKnowledge
        : currentKnowledge,
    desiredOutcome: hasMeasurableOutcome(desiredOutcome) ? desiredOutcome : fallback.desiredOutcome,
    motivation: targetLearner.motivation.trim() || fallback.motivation,
    pain: targetLearner.pain.trim() || fallback.pain,
    practiceStyle: targetLearner.practiceStyle.trim() || fallback.practiceStyle,
    profile:
      profile.length === 0 || hasBroadLearnerProfile(profile.toLowerCase())
        ? fallback.profile
        : profile,
  };
};

const buildTargetLearnerFindings = (
  draft: CourseDraft,
  findingWithPreservedStatus: PreserveFindingStatus,
): ReviewFinding[] => {
  const { targetLearner } = draft;
  if (!hasTargetLearnerInput(targetLearner)) {
    return [];
  }
  const copy = copyFor(draft);
  const findings: ReviewFinding[] = [];
  const normalizedProfile = targetLearner.profile.trim().toLowerCase();
  const normalizedPrerequisites = targetLearner.currentKnowledge.trim().toLowerCase();
  const normalizedOutcome = targetLearner.desiredOutcome.trim().toLowerCase();

  if (normalizedProfile.length > 0 && hasBroadLearnerProfile(normalizedProfile)) {
    findings.push(
      findingWithPreservedStatus({
        detail: copy.targetAudienceBroadDetail,
        fingerprint: normalizedProfile,
        id: `finding_${draft.id}_target_audience_broad`,
        severity: 'warning',
        step: 'target',
        targetId: draft.id,
        targetType: 'course',
        title: copy.targetAudienceBroadTitle,
      }),
    );
  }
  if (
    normalizedPrerequisites.length === 0 ||
    missingPrerequisiteValues.has(normalizedPrerequisites)
  ) {
    findings.push(
      findingWithPreservedStatus({
        detail: copy.targetPrerequisiteMissingDetail,
        fingerprint: normalizedPrerequisites || 'missing',
        id: `finding_${draft.id}_target_prerequisites_missing`,
        severity: 'warning',
        step: 'target',
        targetId: draft.id,
        targetType: 'course',
        title: copy.targetPrerequisiteMissingTitle,
      }),
    );
  }
  if (normalizedOutcome.length === 0 || !hasMeasurableOutcome(normalizedOutcome)) {
    findings.push(
      findingWithPreservedStatus({
        detail: copy.targetOutcomeWeakDetail,
        fingerprint: normalizedOutcome || 'missing',
        id: `finding_${draft.id}_target_outcome_weak`,
        severity: 'warning',
        step: 'target',
        targetId: draft.id,
        targetType: 'course',
        title: copy.targetOutcomeWeakTitle,
      }),
    );
  }
  return findings;
};

const buildChapterDifficultyFindings = (
  draft: CourseDraft,
  findingWithPreservedStatus: PreserveFindingStatus,
): ReviewFinding[] => {
  if (!hasTargetLearnerInput(draft.targetLearner)) {
    return [];
  }
  if (!hasBeginnerOrUnclearPrerequisites(draft.targetLearner)) {
    return [];
  }
  const copy = copyFor(draft);
  const targetFingerprint = [
    draft.targetLearner.profile.trim().toLowerCase(),
    draft.targetLearner.currentKnowledge.trim().toLowerCase(),
  ].join('|');

  return draft.chapters
    .filter((chapter) => chapter.difficulty === 'advanced')
    .map((chapter) =>
      findingWithPreservedStatus({
        detail: copy.chapterTooAdvancedDetail(chapter.title),
        fingerprint: [
          chapter.id,
          chapter.title.trim().toLowerCase(),
          chapter.difficulty,
          targetFingerprint,
        ].join('|'),
        id: `finding_${chapter.id}_difficulty`,
        severity: 'warning',
        step: 'chapters',
        targetId: chapter.id,
        targetType: 'chapter',
        title: copy.chapterTooAdvancedTitle,
      }),
    );
};

const buildUnsupportedClaimFindings = (
  draft: CourseDraft,
  findingWithPreservedStatus: PreserveFindingStatus,
): ReviewFinding[] => {
  const copy = copyFor(draft);
  const findings: ReviewFinding[] = [];
  for (const chapter of draft.chapters) {
    for (const lesson of chapter.lessons) {
      for (const block of lesson.blocks) {
        if (!sourceClaimBlockTypes.has(block.type)) {
          continue;
        }
        if (block.provenance !== 'AI-inferred') {
          continue;
        }
        if ((block.sourceReferences?.length ?? 0) > 0) {
          continue;
        }
        if (sourceGapPattern.test(block.body.toLowerCase())) {
          continue;
        }
        findings.push(
          findingWithPreservedStatus({
            detail: copy.unsupportedClaimDetail(block.title, lesson.title),
            fingerprint: [
              block.id,
              block.type,
              block.provenance,
              block.title.trim().toLowerCase(),
              block.body.trim().toLowerCase(),
            ].join('|'),
            id: `finding_${block.id}_unsupported_claim`,
            severity: 'warning',
            step: 'builder',
            targetId: block.id,
            targetType: 'block',
            title: copy.unsupportedClaimTitle,
          }),
        );
      }
    }
  }
  return findings;
};

export const buildFindings = (draft: CourseDraft): ReviewFinding[] => {
  const copy = copyFor(draft);
  const findings: ReviewFinding[] = [];
  const findingWithPreservedStatus = (finding: Omit<ReviewFinding, 'status'>): ReviewFinding => {
    const previous = draft.findings.find(
      (candidate) => candidate.id === finding.id && candidate.fingerprint === finding.fingerprint,
    );
    return {
      ...finding,
      status: previous?.status ?? 'open',
    };
  };
  if (draft.sources.every((source) => source.status !== 'processed')) {
    findings.push(
      findingWithPreservedStatus({
        detail: copy.incompleteSourceDetail,
        fingerprint: draft.sources
          .filter((source) => source.status !== 'deleted')
          .map((source) => `${source.id}:${source.status}:${source.processor}`)
          .join('|'),
        id: `finding_${draft.id}_sources`,
        severity: 'warning',
        step: 'knowledge',
        targetId: draft.id,
        targetType: 'course',
        title: copy.incompleteSourceTitle,
      }),
    );
  }
  findings.push(...buildTargetLearnerFindings(draft, findingWithPreservedStatus));
  findings.push(...buildTopicSourceSupportFindings(draft, findingWithPreservedStatus));
  const generateQuestionInputs: [string, string][] = [
    ['outcome', draft.questions.outcome],
    ['audience', draft.questions.audience],
    ['practice', draft.questions.practice],
  ];
  const missingGenerateQuestions = generateQuestionInputs.flatMap(([name, value]) =>
    value.trim().length === 0 ? [name] : [],
  );
  if (draft.mode === 'generate' && missingGenerateQuestions.length > 0) {
    findings.push(
      findingWithPreservedStatus({
        detail: copy.requiredQuestionDetail(missingGenerateQuestions.join(', ')),
        fingerprint: missingGenerateQuestions.join('|'),
        id: `finding_${draft.id}_required_questions`,
        severity: 'blocking',
        step: 'questions',
        targetId: draft.id,
        targetType: 'course',
        title: copy.requiredQuestionTitle,
      }),
    );
  }
  const topicsByNormalizedName = new Map<string, Topic[]>();
  for (const topic of draft.topics) {
    const key = topic.name.trim().toLowerCase();
    if (key.length === 0) {
      continue;
    }
    topicsByNormalizedName.set(key, [...(topicsByNormalizedName.get(key) ?? []), topic]);
  }
  for (const duplicateTopics of topicsByNormalizedName.values()) {
    if (duplicateTopics.length < 2) {
      continue;
    }
    const [firstTopic] = duplicateTopics;
    if (!firstTopic) {
      continue;
    }
    findings.push(
      findingWithPreservedStatus({
        detail: copy.topicDuplicateDetail(firstTopic.name, duplicateTopics.length),
        fingerprint: duplicateTopics
          .map((topic) => `${topic.id}:${topic.name.trim().toLowerCase()}`)
          .join('|'),
        id: `finding_${draft.id}_topic_duplicate_${firstTopic.name.trim().toLowerCase()}`,
        severity: 'warning',
        step: 'topics',
        targetId: firstTopic.id,
        targetType: 'topic',
        title: copy.topicDuplicateTitle,
      }),
    );
  }
  findings.push(...buildTopicChapterCoverageFindings(draft, findingWithPreservedStatus));
  findings.push(...buildChapterDifficultyFindings(draft, findingWithPreservedStatus));
  findings.push(...buildUnsupportedClaimFindings(draft, findingWithPreservedStatus));
  for (const chapter of draft.chapters) {
    for (const lesson of chapter.lessons) {
      const required = new Set(['objective', 'explanation', 'exercise', 'summary']);
      for (const block of lesson.blocks) {
        required.delete(block.type);
      }
      if (required.size > 0) {
        const missing = [...required].join(', ');
        findings.push(
          findingWithPreservedStatus({
            detail: copy.lessonQualityDetail(lesson.title, missing),
            fingerprint: `${lesson.id}:${lesson.title}:${missing}:${lesson.blocks
              .map((block) => block.type)
              .join('|')}`,
            id: `finding_${lesson.id}_quality`,
            severity: 'blocking',
            step: 'builder',
            targetId: lesson.id,
            targetType: 'lesson',
            title: copy.lessonQualityTitle,
          }),
        );
      }
    }
  }
  return findings;
};

interface WorkflowPrerequisiteGateOptions {
  allowExistingCreatorStructure?: boolean;
  blockOpenFindings?: boolean;
  includeTargetFindings?: boolean;
}

const firstOpenFindingForStep = (
  draft: CourseDraft,
  targetStep: DraftStep,
  options: WorkflowPrerequisiteGateOptions = {},
) => {
  const targetIndex = workflowStepIndex(targetStep);
  return buildFindings({ ...draft, findings: [] }).find(
    (finding) =>
      finding.status === 'open' &&
      (options.blockOpenFindings || finding.severity === 'blocking') &&
      (options.includeTargetFindings
        ? workflowStepIndex(finding.step) <= targetIndex
        : workflowStepIndex(finding.step) < targetIndex),
  );
};

// eslint-disable-next-line complexity
export const getWorkflowPrerequisiteGate = (
  draft: CourseDraft,
  targetStep: DraftStep,
  options: WorkflowPrerequisiteGateOptions = {},
): WorkflowGate => {
  const targetIndex = workflowStepIndex(targetStep);
  if (targetIndex < 0) {
    return allowedWorkflowGate;
  }
  const openFinding = firstOpenFindingForStep(draft, targetStep, options);
  if (openFinding) {
    return {
      allowed: false,
      blockedStep: openFinding.step,
      finding: openFinding,
      reason: 'blockingFinding',
    };
  }
  if (
    draft.mode === 'generate' &&
    targetIndex > workflowStepIndex('knowledge') &&
    !hasReadableSource(draft)
  ) {
    return { allowed: false, blockedStep: 'knowledge', reason: 'sourceRequired' };
  }
  if (targetIndex > workflowStepIndex('questions') && !hasRequiredQuestions(draft)) {
    return { allowed: false, blockedStep: 'questions', reason: 'questionsRequired' };
  }
  if (
    draft.mode === 'generate' &&
    targetIndex > workflowStepIndex('questions') &&
    draft.topics.length === 0
  ) {
    return { allowed: false, blockedStep: 'questions', reason: 'generatedTopicsRequired' };
  }
  if (
    targetIndex > workflowStepIndex('topics') &&
    topicsForCourse(draft.topics).length === 0 &&
    draft.chapters.length === 0
  ) {
    return { allowed: false, blockedStep: 'topics', reason: 'topicsRequired' };
  }
  if (targetIndex > workflowStepIndex('target') && !hasConfirmedTargetLearner(draft)) {
    return { allowed: false, blockedStep: 'target', reason: 'targetLearnerRequired' };
  }
  if (
    targetIndex > workflowStepIndex('chapters') &&
    !hasConfirmedChapters(draft) &&
    !(
      options.allowExistingCreatorStructure &&
      draft.chapters.some((chapter) => chapter.lessons.length > 0)
    )
  ) {
    return {
      allowed: false,
      blockedStep: 'chapters',
      reason: draft.chapters.length === 0 ? 'chaptersRequired' : 'chapterConfirmationRequired',
    };
  }
  if (
    targetIndex > workflowStepIndex('lessons') &&
    draft.chapters.flatMap((chapter) => chapter.lessons).length === 0
  ) {
    return { allowed: false, blockedStep: 'lessons', reason: 'lessonsRequired' };
  }
  return allowedWorkflowGate;
};

export const getWorkflowStepGate = (draft: CourseDraft, targetStep: DraftStep): WorkflowGate => {
  const currentIndex = workflowStepIndex(draft.step);
  const targetIndex = workflowStepIndex(targetStep);
  if (targetIndex < 0 || targetIndex <= currentIndex) {
    return allowedWorkflowGate;
  }
  if (
    draft.mode === 'generate' &&
    targetIndex > workflowStepIndex('knowledge') &&
    !hasRequiredQuestions(draft)
  ) {
    return {
      allowed: false,
      blockedStep: 'knowledge',
      reason: 'fullCourseGenerationRequired',
    };
  }
  return getWorkflowPrerequisiteGate(draft, targetStep, { blockOpenFindings: true });
};

export const getWorkflowPreviewGate = (
  draft: CourseDraft,
  options: WorkflowPrerequisiteGateOptions = {},
): WorkflowGate => {
  if (draft.chapters.flatMap((chapter) => chapter.lessons).length === 0) {
    return { allowed: false, blockedStep: 'lessons', reason: 'lessonsRequired' };
  }
  return getWorkflowPrerequisiteGate(draft, 'builder', {
    ...options,
    allowExistingCreatorStructure: true,
  });
};
