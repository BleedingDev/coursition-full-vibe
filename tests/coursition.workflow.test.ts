// @effect-diagnostics nodeBuiltinImport:off processEnv:off processGlobal:off
import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, test } from '@rstest/core';

const execFileAsync = promisify(execFile);
const root = process.cwd();
const runnerPath = path.join(root, 'tests/coursition.workflow.runner.cjs');
const esbuildRegisterPath = path.join(
  root,
  'node_modules/.pnpm/esbuild-register@3.6.0_esbuild@0.28.0/node_modules/esbuild-register/register.js',
);
const tsconfigPathsRegisterPath = path.join(
  root,
  'node_modules/.pnpm/tsconfig-paths@4.2.0/node_modules/tsconfig-paths/register.js',
);

const runScenario = async <T>(scenario: string): Promise<T> => {
  const { stdout } = await execFileAsync(
    process.execPath,
    ['-r', esbuildRegisterPath, '-r', tsconfigPathsRegisterPath, runnerPath, scenario],
    {
      cwd: root,
      env: {
        ...process.env,
        NODE_ENV: 'test',
      },
    },
  );

  const resultLine = stdout
    .trim()
    .split('\n')
    .findLast((line) => line.trim().startsWith('{'));

  if (!resultLine) {
    throw new Error(`Scenario ${scenario} did not print a JSON result.`);
  }

  return JSON.parse(resultLine) as T;
};

describe.sequential('real Coursition workflow', () => {
  test('derives topics, chapters, and lessons from user and source input instead of fixtures', async () => {
    const result = await runScenario<{
      chapterTitles: string[];
      courseTopicName?: string;
      courseTopicSupport?: string;
      explanationBody?: string;
      explanationProvenance?: string;
      explanationReferenceCount?: number;
      explanationReferenceSourceId?: string;
      firstKnowledgeChunkSourceId?: string;
      lessonGenerationRunStatus?: string;
      practiceBody?: string;
      topicGenerationRunStatus?: string;
      topicNames: string[];
    }>('derived');

    expect(result.topicNames.length).toBeGreaterThan(0);
    expect(result.courseTopicName?.length).toBeGreaterThan(0);
    expect(result.courseTopicSupport).toBe('source_backed');
    expect(result.topicGenerationRunStatus).toBe('applied');
    expect(result.lessonGenerationRunStatus).toBe('applied');
    expect(result.chapterTitles[0]?.length).toBeGreaterThan(0);
    expect(result.explanationBody?.length).toBeGreaterThan(40);
    expect(result.explanationProvenance).toBe('source-backed');
    expect(result.explanationReferenceCount).toBeGreaterThan(0);
    expect(result.explanationReferenceSourceId).toBe(result.firstKnowledgeChunkSourceId);
    expect(result.practiceBody?.length).toBeGreaterThan(20);
  }, 60_000);

  test('uses source gaps instead of unsupported explanations in strict source-only mode', async () => {
    const result = await runScenario<{
      blockedConfirmError?: string;
      lessonGenerationRunCount: number;
      sourceFindingSeverity?: string;
      step?: string;
      unsupportedClaimFindingCount: number;
    }>('strictSourceOnlyGap');

    expect(result.blockedConfirmError).toBe('Source coverage is incomplete');
    expect(result.step).toBe('chapters');
    expect(result.lessonGenerationRunCount).toBe(0);
    expect(result.sourceFindingSeverity).toBe('warning');
    expect(result.unsupportedClaimFindingCount).toBe(0);
  }, 60_000);

  test('marks AI output as incomplete when the creator continues while sources process', async () => {
    const result = await runScenario<{
      blockedConfirmError?: string;
      derivedDocumentCount: number;
      knowledgeChunkCount: number;
      lessonGenerationRunCount: number;
      sourceFindingDetail?: string;
      sourceFindingSeverity?: string;
      sourceFindingStatus?: string;
      sourceFindingStep?: string;
      sourceFindingTitle?: string;
      sourceProcessingIncomplete: boolean;
      sourceStatus?: string;
      step?: string;
    }>('continueWithProcessingSourceWarning');

    expect(result.sourceStatus).toBe('processing');
    expect(result.sourceProcessingIncomplete).toBe(true);
    expect(result.derivedDocumentCount).toBe(0);
    expect(result.knowledgeChunkCount).toBe(0);
    expect(result.blockedConfirmError).toBe('Source coverage is incomplete');
    expect(result.lessonGenerationRunCount).toBe(0);
    expect(result.sourceFindingTitle).toBe('Source coverage is incomplete');
    expect(result.sourceFindingDetail).toContain('not fully source-backed');
    expect(result.sourceFindingSeverity).toBe('warning');
    expect(result.sourceFindingStatus).toBe('open');
    expect(result.sourceFindingStep).toBe('knowledge');
    expect(result.step).toBe('chapters');
  }, 60_000);

  test('flags AI-inferred claim blocks without source references', async () => {
    const result = await runScenario<{
      detail?: string;
      explanationProvenance?: string;
      explanationReferenceCount: number;
      resolvedUnsupportedFindingCount: number;
      severity?: string;
      step?: string;
      targetId?: string;
      targetType?: string;
      title?: string;
    }>('unsupportedClaimFinding');

    expect(result.title).toBe('Block contains an unsupported AI claim');
    expect(result.detail).toContain('is AI-inferred');
    expect(result.detail).toContain('has no source reference');
    expect(result.explanationProvenance).toBe('AI-inferred');
    expect(result.explanationReferenceCount).toBe(0);
    expect(result.severity).toBe('warning');
    expect(result.step).toBe('builder');
    expect(result.targetType).toBe('block');
    expect(result.targetId).toBeTruthy();
    expect(result.resolvedUnsupportedFindingCount).toBe(0);
  }, 60_000);

  test('isolates draft reads and mutations by owner', async () => {
    const result = await runScenario<{
      aliceDraftId: string;
      aliceSnapshotDraftId?: string;
      aliceSnapshotTitle?: string;
      bobDraftId: string;
      bobSnapshotDraftId?: string;
      bobSnapshotTitle?: string;
      crossOwnerError: string;
    }>('ownerIsolation');

    expect(result.aliceSnapshotDraftId).toBe(result.aliceDraftId);
    expect(result.aliceSnapshotTitle).toBe('Alice only draft');
    expect(result.bobSnapshotDraftId).toBe(result.bobDraftId);
    expect(result.bobSnapshotTitle).toBe('Bob only draft');
    expect(result.crossOwnerError).toBe('Course draft not found for signed-in creator.');
  });

  test('lists owned drafts and resumes a selected unfinished draft', async () => {
    const result = await runScenario<{
      crossOwnerError: string;
      latestDraftId?: string;
      selectedDraftId?: string;
      selectedStep?: string;
      summaryCount: number;
      summaryCountAfterDelete: number;
      summaryIds: string[];
      summaryIdsAfterDelete: string[];
      summaryLessons: number[];
      summarySources: number[];
      summaryTitles: string[];
    }>('draftResumeList');

    expect(result.summaryCount).toBe(2);
    expect(result.summaryTitles).toEqual(['Second latest draft', 'First unfinished draft']);
    expect(result.latestDraftId).toBe(result.summaryIds[0]);
    expect(result.selectedDraftId).toBe(result.summaryIds[1]);
    expect(result.selectedStep).toBe('knowledge');
    expect(result.summarySources).toEqual([0, 1]);
    expect(result.summaryLessons).toEqual([0, 0]);
    expect(result.summaryCountAfterDelete).toBe(1);
    expect(result.summaryIdsAfterDelete).toEqual([result.summaryIds[1]]);
    expect(result.crossOwnerError).toBe('Course draft not found for signed-in creator.');
  });

  test('marks updated lesson block provenance as manual', async () => {
    const result = await runScenario<{
      body?: string;
      provenance?: string;
      sourceReferenceCount?: number;
      saveStep?: string;
      step?: string;
      title?: string;
    }>('manualProvenance');

    expect(result.title).toBe('Instructor handoff');
    expect(result.body).toBe('Manual instructor note for the varintseeding handoff.');
    expect(result.provenance).toBe('manual');
    expect(result.sourceReferenceCount).toBe(0);
    expect(result.saveStep).toBe('builder');
    expect(result.step).toBe('preview');
  }, 60_000);

  test('adds generated topics directly to the course topic list', async () => {
    const result = await runScenario<{
      generatedStatus?: string;
      topicCount: number;
    }>('topicReviewGate');

    expect(result.generatedStatus).toBe('applied');
    expect(result.topicCount).toBeGreaterThan(0);
  }, 60_000);

  test('preserves manually edited topics when topics are regenerated', async () => {
    const result = await runScenario<{
      generatedTopicId?: string;
      manualTopicId?: string;
      preservedGeneratedDescription?: string;
      preservedGeneratedName?: string;
      preservedManualName?: string;
      regeneratedRunStatus?: string;
      step?: string;
      topicCount: number;
    }>('preserveManualTopicEdits');

    expect(result.generatedTopicId).toBeTruthy();
    expect(result.manualTopicId).toBeTruthy();
    expect(result.topicCount).toBeGreaterThanOrEqual(2);
    expect(result.preservedGeneratedName).toBe('Manual edited topic');
    expect(result.preservedGeneratedDescription).toBe(
      'Manual edited topic description must survive AI regeneration.',
    );
    expect(result.preservedManualName).toBe('Manual inserted topic');
    expect(result.regeneratedRunStatus).toBe('applied');
    expect(result.step).toBe('topics');
  }, 60_000);

  test('supports manual topic, chapter, lesson, block, and preview controls', async () => {
    const result = await runScenario<{
      blockBody?: string;
      blockCount?: number;
      blockProvenance?: string;
      blockTitle?: string;
      blockType?: string;
      courseTopicName?: string;
      firstChapterTitle?: string;
      initialMode?: string;
      initialStep?: string;
      lessonDuration?: number;
      lessonTitle?: string;
      previewStep?: string;
    }>('builderControls');

    expect(result.initialMode).toBe('assist');
    expect(result.initialStep).toBe('mode');
    expect(result.courseTopicName).toBe('Durable handoff review');
    expect(result.firstChapterTitle).toBe('1. Review practice');
    expect(result.lessonTitle).toBe('Edited review lesson');
    expect(result.lessonDuration).toBe(17);
    expect(result.blockTitle).toBe('Edited exercise');
    expect(result.blockBody).toBe('Edited practical exercise survives preview.');
    expect(result.blockType).toBe('exercise');
    expect(result.blockCount).toBe(1);
    expect(result.blockProvenance).toBe('manual');
    expect(result.previewStep).toBe('preview');
  });

  test('persists wizard navigation and generate-mode skipped-step gates', async () => {
    const result = await runScenario<{
      assistMode?: string;
      assistStep?: string;
      backStep?: string;
      blockedQuestionsStepError?: string;
      blockedFutureStepError?: string;
      generatedModeStep?: string;
      questionAudienceBeforeBuild?: string;
      questionOutcomeBeforeBuild?: string;
      questionPracticeBeforeBuild?: string;
      resumedStep?: string;
    }>('wizardNavigation');

    expect(result.generatedModeStep).toBe('mode');
    expect(result.blockedFutureStepError).toBe(
      'Generate the course before reviewing skipped planning steps.',
    );
    expect(result.blockedQuestionsStepError).toBe(
      'Generate the course before reviewing skipped planning steps.',
    );
    expect(result.questionAudienceBeforeBuild).toBe('');
    expect(result.questionOutcomeBeforeBuild).toBe('');
    expect(result.questionPracticeBeforeBuild).toBe('');
    expect(result.backStep).toBe('knowledge');
    expect(result.assistMode).toBe('assist');
    expect(result.assistStep).toBe('knowledge');
    expect(result.resumedStep).toBe('knowledge');
  });

  test('allows switching between Generate and Assist after lessons are generated', async () => {
    const result = await runScenario<{
      assistFromMode?: string;
      assistFromModeBuilderStep?: string;
      assistFromModeStep?: string;
      generateFromMode?: string;
      generateFromModeBuilderStep?: string;
      generateFromModeStep?: string;
      generateMode?: string;
      generateModeStep?: string;
      initialMode?: string;
      initialStep?: string;
      lessonRunFailureReason?: string;
      lessonRunStatus?: string;
      modeStep?: string;
    }>('modeChangesAfterLessonGeneration');

    expect(result.lessonRunStatus).toBe('applied');
    expect(result.initialMode).toBe('assist');
    expect(result.initialStep).toBe('builder');
    expect(result.generateMode).toBe('generate');
    expect(result.generateModeStep).toBe('builder');
    expect(result.modeStep).toBe('mode');
    expect(result.assistFromMode).toBe('assist');
    expect(result.assistFromModeStep).toBe('mode');
    expect(result.assistFromModeBuilderStep).toBe('builder');
    expect(result.generateFromMode).toBe('generate');
    expect(result.generateFromModeStep).toBe('mode');
    expect(result.generateFromModeBuilderStep).toBe('builder');
  }, 60_000);

  test('requires core teaching questions only in generate mode', async () => {
    const result = await runScenario<{
      assistRequiredFindingCount: number;
      assistStep?: string;
      blockedStep?: string;
      completedRequiredFindingCount: number;
      completedStep?: string;
      requiredFindingDetail?: string;
      requiredFindingSeverity?: string;
      requiredFindingStatus?: string;
      requiredFindingStep?: string;
      requiredFindingTargetType?: string;
      requiredFindingTitle?: string;
    }>('modeRequiredQuestions');

    expect(result.blockedStep).toBe('questions');
    expect(result.requiredFindingTitle).toBe('Complete required teaching questions');
    expect(result.requiredFindingDetail).toContain('outcome');
    expect(result.requiredFindingDetail).toContain('audience');
    expect(result.requiredFindingDetail).toContain('practice');
    expect(result.requiredFindingSeverity).toBe('blocking');
    expect(result.requiredFindingStatus).toBe('open');
    expect(result.requiredFindingStep).toBe('questions');
    expect(result.requiredFindingTargetType).toBe('course');
    expect(result.completedStep).toBe('questions');
    expect(result.completedRequiredFindingCount).toBe(0);
    expect(result.assistStep).toBe('topics');
    expect(result.assistRequiredFindingCount).toBe(0);
  });

  test('requires explicit questions before topic generation in full AI mode', async () => {
    const result = await runScenario<{
      missingQuestionsError?: string;
      questionAudienceBeforeTopics?: string;
      requiredFindingCount: number;
      sourceFindingCount: number;
      step?: string;
      topicCount: number;
      topicRunStatus?: string;
    }>('generateModeTopicsRequireQuestions');

    expect(result.missingQuestionsError).toBe('Complete required teaching questions');
    expect(result.questionAudienceBeforeTopics).toBe('');
    expect(result.step).toBe('topics');
    expect(result.topicCount).toBeGreaterThan(0);
    expect(result.topicRunStatus).toBe('applied');
    expect(result.requiredFindingCount).toBe(0);
    expect(result.sourceFindingCount).toBe(0);
  }, 60_000);

  test('full AI mode builds the complete course from sources', async () => {
    const result = await runScenario<{
      appliedRunTypes: string[];
      chapterCount: number;
      confirmedChapterCount: number;
      lessonCount: number;
      routeSteps: Record<string, string>;
      questionOutcome?: string;
      step?: string;
      targetProfile?: string;
      topicCount: number;
    }>('fullAiBuildCourse');

    expect(result.step).toBe('builder');
    expect(result.questionOutcome?.length).toBeGreaterThan(0);
    expect(result.topicCount).toBeGreaterThan(0);
    expect(result.targetProfile?.length).toBeGreaterThan(0);
    expect(result.chapterCount).toBeGreaterThan(0);
    expect(result.confirmedChapterCount).toBe(result.chapterCount);
    expect(result.lessonCount).toBeGreaterThan(0);
    expect(result.routeSteps).toEqual({
      chapters: 'chapters',
      lessons: 'lessons',
      questions: 'questions',
      target: 'target',
      topics: 'topics',
    });
    expect(result.appliedRunTypes).toEqual([
      'chapter_generation',
      'lesson_generation',
      'target_learner_generation',
      'topic_generation',
    ]);
  }, 60_000);

  test('keeps generated chapters reviewable until the creator confirms them', async () => {
    const result = await runScenario<{
      confirmedChapterRunStatus?: string;
      confirmedStep?: string;
      generatedChapterCount?: number;
      generatedChapterRunStatus?: string;
      generatedStep?: string;
    }>('chapterReviewGate');

    expect(result.generatedChapterCount).toBeGreaterThan(0);
    expect(result.generatedStep).toBe('chapters');
    expect(result.generatedChapterRunStatus).toBe('needs_review');
    expect(result.confirmedStep).toBe('lessons');
    expect(result.confirmedChapterRunStatus).toBe('applied');
  }, 60_000);

  test('preserves manually edited chapters when chapters are regenerated', async () => {
    const result = await runScenario<{
      chapterCount: number;
      generatedChapterId?: string;
      manualChapterId?: string;
      preservedGeneratedDescription?: string;
      preservedGeneratedTitle?: string;
      preservedManualDescription?: string;
      preservedManualTitle?: string;
      regeneratedRunStatus?: string;
      step?: string;
    }>('preserveManualChapterEdits');

    expect(result.generatedChapterId).toBeTruthy();
    expect(result.manualChapterId).toBeTruthy();
    expect(result.chapterCount).toBeGreaterThanOrEqual(2);
    expect(result.preservedGeneratedTitle).toBe('1. Manual edited chapter');
    expect(result.preservedGeneratedDescription).toBe(
      'Manual edited description must survive AI regeneration.',
    );
    expect(result.preservedManualTitle).toContain('Manual inserted chapter');
    expect(result.preservedManualDescription).toBe(
      'A manually inserted chapter must stay in the outline.',
    );
    expect(result.regeneratedRunStatus).toBe('needs_review');
    expect(result.step).toBe('chapters');
  }, 60_000);

  test('refreshes generated chapter validation metadata during regeneration', async () => {
    const result = await runScenario<{
      repairedDescription?: string;
      repairedDifficulty?: string;
      repairedTitle?: string;
      staleDifficulty?: string;
      staleExtraPresent: boolean;
    }>('regeneratedChaptersRefreshValidationMetadata');

    expect(result.staleDifficulty).toBe('advanced');
    expect(result.repairedDifficulty).toBe('intermediate');
    expect(result.repairedTitle).toBe('2. Edited generated chapter');
    expect(result.repairedDescription).toBe('Creator wording must remain after metadata refresh.');
    expect(result.staleExtraPresent).toBe(false);
  }, 60_000);

  test('preserves resolved review findings until the underlying issue changes', async () => {
    const result = await runScenario<{
      changedFingerprint?: string;
      changedStatus?: string;
      initialFingerprint: string;
      initialStatus: string;
      repeatedFingerprint?: string;
      repeatedStatus?: string;
      resolvedStatus?: string;
      targetStep?: string;
      targetType?: string;
    }>('reviewFindings');

    expect(result.initialStatus).toBe('open');
    expect(result.resolvedStatus).toBe('resolved');
    expect(result.repeatedStatus).toBe('resolved');
    expect(result.repeatedFingerprint).toBe(result.initialFingerprint);
    expect(result.changedStatus).toBe('open');
    expect(result.changedFingerprint).not.toBe(result.initialFingerprint);
    expect(result.targetStep).toBe('builder');
    expect(result.targetType).toBe('lesson');
  });

  test('flags duplicate topics as topic-attached review findings', async () => {
    const result = await runScenario<{
      detail?: string;
      dismissedStatus?: string;
      firstTopicId?: string;
      repeatedStatus?: string;
      resolvedTopicFindingCount: number;
      severity?: string;
      step?: string;
      targetId?: string;
      targetType?: string;
      title?: string;
    }>('duplicateTopicFindings');

    expect(result.title).toBe('Duplicate topic');
    expect(result.detail).toContain('Source coverage appears 2 times');
    expect(result.severity).toBe('warning');
    expect(result.step).toBe('topics');
    expect(result.targetType).toBe('topic');
    expect(result.targetId).toBe(result.firstTopicId);
    expect(result.dismissedStatus).toBe('dismissed');
    expect(result.repeatedStatus).toBe('dismissed');
    expect(result.resolvedTopicFindingCount).toBe(0);
  });

  test('flags selected topics that are unsupported by processed sources', async () => {
    const result = await runScenario<{
      detail?: string;
      resolvedSourceFindingCount: number;
      resolvedStatusBeforeEvidence?: string;
      severity?: string;
      step?: string;
      targetGateAllowed: boolean;
      targetId?: string;
      targetType?: string;
      title?: string;
      topicId?: string;
    }>('unsupportedTopicSourceFinding');

    expect(result.title).toBe('Topic needs source support');
    expect(result.detail).toContain('Payment compliance is selected');
    expect(result.detail).toContain('processed sources do not clearly support it');
    expect(result.severity).toBe('warning');
    expect(result.step).toBe('topics');
    expect(result.targetGateAllowed).toBe(false);
    expect(result.resolvedStatusBeforeEvidence).toBe('resolved');
    expect(result.targetType).toBe('topic');
    expect(result.targetId).toBe(result.topicId);
    expect(result.resolvedSourceFindingCount).toBe(0);
  });

  test('flags topics that are missing from the chapter structure', async () => {
    const result = await runScenario<{
      blockedConfirmError: string;
      coveredTopicIds: string[];
      detail?: string;
      generatedChapterRunStatus?: string;
      resolvedCoverageFindingCount: number;
      severity?: string;
      step?: string;
      targetId?: string;
      targetType?: string;
      title?: string;
      topicId?: string;
      topicName?: string;
    }>('chapterTopicCoverageFinding');

    expect(result.title).toBe('Topic missing from chapters');
    expect(result.detail).toContain(`Topic ${result.topicName}`);
    expect(result.detail).toContain('not covered by any chapter');
    expect(result.severity).toBe('warning');
    expect(result.step).toBe('chapters');
    expect(result.targetType).toBe('topic');
    expect(result.targetId).toBe(result.topicId);
    expect(result.blockedConfirmError).toContain('Topic missing from chapters');
    expect(result.coveredTopicIds).toContain(result.topicId);
    expect(result.generatedChapterRunStatus).toBe('needs_review');
    expect(result.resolvedCoverageFindingCount).toBe(0);
  }, 60_000);

  test('requires a topic before chapter generation', async () => {
    const result = await runScenario<{
      blockedChapterCount: number;
      blockedError?: string;
      blockedRunCount: number;
      retriedCoveredTopicIds: string[];
      retriedRunStatus?: string;
      retriedStep?: string;
      topicId?: string;
    }>('chapterGenerationRequiresSelectedTopic');

    expect(result.blockedError).toBe('Select at least one topic before generating chapters.');
    expect(result.blockedChapterCount).toBe(0);
    expect(result.blockedRunCount).toBe(0);
    expect(result.retriedRunStatus).toBeTruthy();
    if (result.retriedRunStatus === 'needs_review') {
      expect(result.retriedStep).toBe('chapters');
      expect(result.retriedCoveredTopicIds).toContain(result.topicId);
    }
  }, 60_000);

  test('keeps generated target learner reviewable until the creator confirms it', async () => {
    const result = await runScenario<{
      confirmedRunStatus?: string;
      confirmedStep?: string;
      generatedChapterGateAllowed: boolean;
      generatedOutcome?: string;
      generatedProfile?: string;
      generatedRunStatus?: string;
      generatedStep?: string;
      generatedTargetFindingCount: number;
    }>('generateTargetLearnerReviewable');

    expect(result.generatedProfile?.length).toBeGreaterThan(0);
    expect(result.generatedOutcome?.length).toBeGreaterThan(0);
    expect(result.generatedStep).toBe('target');
    expect(result.generatedRunStatus).toBe('needs_review');
    expect(result.generatedTargetFindingCount).toBe(0);
    expect(result.generatedChapterGateAllowed).toBe(false);
    expect(result.confirmedRunStatus).toBe('applied');
    expect(result.confirmedStep).toBe('chapters');
  }, 60_000);

  test('autosaves target learner edits without confirming the step', async () => {
    const result = await runScenario<{
      aiRunCount: number;
      desiredOutcome?: string;
      profile?: string;
      step?: string;
    }>('targetLearnerAutosave');

    expect(result.profile).toBe('Release incident leads in platform operations');
    expect(result.desiredOutcome).toBe(
      'They can triage a release incident using observable evidence.',
    );
    expect(result.step).toBe('mode');
    expect(result.aiRunCount).toBe(0);
  });

  test('flags broad target learners, missing prerequisites, and weak outcomes', async () => {
    const result = await runScenario<{
      resolvedTargetFindingCount: number;
      step?: string;
      targetFindingDetails: string[];
      targetFindingSeverities: string[];
      targetFindingSteps: string[];
      targetFindingTargetTypes: string[];
      targetFindingTitles: string[];
    }>('targetLearnerFindings');

    expect(result.step).toBe('chapters');
    expect(result.targetFindingTitles).toEqual([
      'Course outcome is not measurable',
      'Learner prerequisites are missing',
      'Target learner is too broad',
    ]);
    expect(result.targetFindingDetails.join(' ')).toContain('specific role');
    expect(result.targetFindingDetails.join(' ')).toContain('already know');
    expect(result.targetFindingDetails.join(' ')).toContain('observable capability');
    expect(result.targetFindingSeverities).toEqual(['warning', 'warning', 'warning']);
    expect(result.targetFindingSteps).toEqual(['target', 'target', 'target']);
    expect(result.targetFindingTargetTypes).toEqual(['course', 'course', 'course']);
    expect(result.resolvedTargetFindingCount).toBe(0);
  });

  test('flags advanced chapters for beginner or unclear target learners', async () => {
    const result = await runScenario<{
      advancedChapterDifficulty?: string;
      advancedChapterTitle?: string;
      detail?: string;
      resolvedDifficultyFindingCount: number;
      severity?: string;
      step?: string;
      targetId?: string;
      targetType?: string;
      title?: string;
    }>('chapterDifficultyMismatchFinding');

    expect(result.title).toBe('Chapter difficulty does not match the target learner');
    expect(result.detail).toContain(`${result.advancedChapterTitle} is marked advanced`);
    expect(result.detail).toContain('target learner has beginner or unclear prerequisites');
    expect(result.advancedChapterDifficulty).toBe('advanced');
    expect(result.severity).toBe('warning');
    expect(result.step).toBe('chapters');
    expect(result.targetType).toBe('chapter');
    expect(result.targetId).toBeTruthy();
    expect(result.resolvedDifficultyFindingCount).toBe(0);
  });

  test('generates lessons for a selected chapter without filling every chapter', async () => {
    const result = await runScenario<{
      firstChapterLessonCount?: number;
      generatedBlockTypes?: string[];
      generatedChapterLessonCount?: number;
      generatedLessonTitle?: string;
      lessonRunStatus?: string;
      step?: string;
    }>('chapterLessonGeneration');

    expect(result.firstChapterLessonCount).toBe(0);
    expect(result.generatedChapterLessonCount).toBeGreaterThan(0);
    expect(result.generatedLessonTitle?.length).toBeGreaterThan(0);
    expect(result.generatedBlockTypes).toEqual(
      expect.arrayContaining(['objective', 'explanation', 'exercise', 'summary']),
    );
    expect(result.lessonRunStatus).toBe('applied');
    expect(result.step).toBe('builder');
  }, 60_000);

  test('regenerates one lesson and cancels instead of overwriting manual edits', async () => {
    const result = await runScenario<{
      cancelledRunFailureReason?: string;
      cancelledRunStatus?: string;
      originalReferenceCount: number;
      preservedSummaryBody?: string;
      preservedSummaryProvenance?: string;
      regeneratedBlockTypes?: string[];
      regeneratedLessonId?: string;
      regeneratedReferenceCount: number;
      regeneratedRunStatus?: string;
      selectedLessonId: string;
      step?: string;
      untouchedManualBlockCount: number;
    }>('lessonRegeneration');

    expect(result.regeneratedLessonId).toBe(result.selectedLessonId);
    expect(result.regeneratedBlockTypes).toEqual(
      expect.arrayContaining(['objective', 'explanation', 'exercise', 'check', 'summary']),
    );
    expect(result.regeneratedRunStatus).toBe('applied');
    expect(result.regeneratedReferenceCount).toBe(result.originalReferenceCount);
    expect(result.step).toBe('builder');
    expect(result.untouchedManualBlockCount).toBe(1);
    expect(result.cancelledRunStatus).toBe('cancelled');
    expect(result.cancelledRunFailureReason).toBe(
      'Lesson regeneration skipped to preserve manual edits.',
    );
    expect(result.preservedSummaryBody).toBe('Manual regenerated summary must not be overwritten.');
    expect(result.preservedSummaryProvenance).toBe('manual');
  }, 60_000);

  test('blocks AI lesson generation until the creator fixes prerequisites', async () => {
    const result = await runScenario<{
      blockedGenerationError?: string;
      blockedRunCount: number;
      blockedRunStatus?: string;
      chapterCountBeforeRetry: number;
      generatedRunStatus?: string;
      lessonBlockTypes?: string[];
      lessonCount?: number;
      runCount: number;
      step?: string;
    }>('retryFailedAiRun');

    expect(result.blockedGenerationError).toBe(
      'Answer the required teaching questions before continuing.',
    );
    expect(result.blockedRunStatus).toBe('failed');
    expect(result.blockedRunCount).toBe(1);
    expect(result.chapterCountBeforeRetry).toBe(1);
    expect(result.generatedRunStatus).toBe('applied');
    expect(result.runCount).toBe(2);
    expect(result.lessonCount).toBeGreaterThan(0);
    expect(result.lessonBlockTypes).toEqual(
      expect.arrayContaining(['objective', 'explanation', 'exercise', 'check', 'summary']),
    );
    expect(result.step).toBe('builder');
  }, 60_000);

  test('requires confirmed target learner before AI lesson generation', async () => {
    const result = await runScenario<{
      blockedConfirmError?: string;
      blockedRunCount: number;
      generatedRunStatus?: string;
      lessonBlockTypes?: string[];
      lessonCount?: number;
      step?: string;
    }>('targetRequiredForLessonGeneration');

    expect(result.blockedConfirmError).toBe('Learner prerequisites are missing');
    expect(result.blockedRunCount).toBe(0);
    expect(result.generatedRunStatus).toBe('applied');
    expect(result.lessonCount).toBeGreaterThan(0);
    expect(result.lessonBlockTypes).toEqual(
      expect.arrayContaining(['objective', 'explanation', 'exercise', 'check', 'summary']),
    );
    expect(result.step).toBe('builder');
  }, 60_000);

  test('requires confirmed chapter structure before AI lesson generation', async () => {
    const result = await runScenario<{
      blockedAllError?: string;
      blockedChapterError?: string;
      blockedRunCount: number;
      chapterStatusAfterConfirm?: string;
      generatedRunStatus?: string;
      lessonBlockTypes?: string[];
      lessonCount?: number;
      runCount: number;
      step?: string;
    }>('chapterConfirmationRequiredForLessonGeneration');

    expect(result.blockedAllError).toBe('Confirm chapter structure before generating lessons.');
    expect(result.blockedChapterError).toBe('Confirm chapter structure before generating lessons.');
    expect(result.blockedRunCount).toBe(2);
    expect(result.chapterStatusAfterConfirm).toBe('confirmed');
    expect(result.generatedRunStatus).toBe('applied');
    expect(result.runCount).toBe(3);
    expect(result.lessonCount).toBeGreaterThan(0);
    expect(result.lessonBlockTypes).toEqual(
      expect.arrayContaining(['objective', 'explanation', 'exercise', 'check', 'summary']),
    );
    expect(result.step).toBe('builder');
  }, 60_000);

  test('preserves manual lesson edits when lessons are regenerated', async () => {
    const result = await runScenario<{
      lessonRunCount: number;
      manualStep?: string;
      preservedBody?: string;
      preservedProvenance?: string;
    }>('preserveManualEdits');

    expect(result.manualStep).toBe('builder');
    expect(result.preservedBody).toBe('Manual summary must survive regeneration.');
    expect(result.preservedProvenance).toBe('manual');
    expect(result.lessonRunCount).toBeGreaterThan(1);
  }, 60_000);

  test('processes URL sources and supports source retry and delete', async () => {
    const result = await runScenario<{
      deletedChunkCount: number;
      deletedStatus?: string;
      derivedDocumentContent?: string;
      derivedDocumentCount: number;
      derivedDocumentProcessor?: string;
      firstChunkContent?: string;
      firstChunkPosition?: string;
      knowledgeChunkCount: number;
      providerAudioFailureReason?: string;
      providerAudioProcessor?: string;
      providerAudioStatus?: string;
      providerDocumentFailureReason?: string;
      providerDocumentProcessor?: string;
      providerDocumentStatus?: string;
      sourceProcessingIncomplete: boolean;
      topicNames: string[];
      unknownFileProcessor?: string;
      unknownFileStatus?: string;
      unsupportedRetryStatus?: string;
      unsupportedStatus?: string;
      urlContent?: string;
      urlProcessor?: string;
      urlStatus?: string;
    }>('sourceLifecycle');

    expect(result.urlStatus).toBe('processed');
    expect(result.urlProcessor).toBe('tavily_url');
    expect(result.urlContent).toContain('quasarwoven');
    expect(result.urlContent).not.toContain('script text must not leak');
    expect(result.derivedDocumentCount).toBeGreaterThan(0);
    expect(result.derivedDocumentProcessor).toBe('tavily_url');
    expect(result.derivedDocumentContent).toContain('quasarwoven');
    expect(result.knowledgeChunkCount).toBeGreaterThan(0);
    expect(result.firstChunkContent).toContain('quasarwoven');
    expect(result.firstChunkPosition).toBe('chunk-1');
    expect(result.providerDocumentStatus).toBe('failed');
    expect(result.providerDocumentProcessor).toBe('llamaparse_document');
    expect(result.providerDocumentFailureReason).toBe('LlamaParse API key is not configured.');
    expect(result.providerAudioStatus).toBe('failed');
    expect(result.providerAudioProcessor).toBe('deepgram_audio');
    expect(result.providerAudioFailureReason).toBe('Deepgram API key is not configured.');
    expect(result.unknownFileStatus).toBe('unsupported');
    expect(result.unknownFileProcessor).toBe('unsupported_file');
    expect(result.unsupportedStatus).toBe('unsupported');
    expect(result.unsupportedRetryStatus).toBe('unsupported');
    expect(result.deletedStatus).toBe('deleted');
    expect(result.deletedChunkCount).toBe(0);
    expect(result.topicNames.length).toBeGreaterThan(0);
    expect(result.topicNames).not.toContain('Phantompacket');
    expect(result.sourceProcessingIncomplete).toBe(false);
  }, 20_000);

  test('uses web extractor fallbacks for URL sources without parallel fan-out', async () => {
    const result = await runScenario<{
      content?: string;
      derivedDocumentContent?: string;
      derivedDocumentProcessor?: string;
      exaRequestCount: number;
      firecrawlRequestCount: number;
      firecrawlRequestFormats?: string[];
      firecrawlRequestUrl?: string;
      processor?: string;
      status?: string;
      storageReference?: string;
      tavilyRequestCount: number;
      tavilyRequestFormat?: string;
      tavilyRequestUrls?: string[];
    }>('webExtractorUrlFallback');

    expect(result.status).toBe('processed');
    expect(result.processor).toBe('tavily_url');
    expect(result.content).toContain('# Meaningful quasarwoven material');
    expect(result.content).not.toContain('script text must not leak');
    expect(result.derivedDocumentProcessor).toBe('tavily_url');
    expect(result.derivedDocumentContent).toBe(result.content);
    expect(result.firecrawlRequestCount).toBe(1);
    expect(result.firecrawlRequestUrl).toBe('https://example.com/noisy-source-page');
    expect(result.firecrawlRequestFormats).toEqual(['markdown']);
    expect(result.tavilyRequestCount).toBe(1);
    expect(result.tavilyRequestUrls).toEqual(['https://example.com/noisy-source-page']);
    expect(result.tavilyRequestFormat).toBe('markdown');
    expect(result.exaRequestCount).toBe(0);
    expect(result.storageReference).toBe('tavily:https://example.com/noisy-source-page');
  }, 20_000);

  test('returns 401 when the course API is called without an authenticated session', async () => {
    const result = await runScenario<{
      body: unknown;
      isResponse: boolean;
      status: number;
    }>('unauthenticatedApi');

    expect(result.isResponse).toBe(true);
    expect(result.status).toBe(401);
    expect(result.body).toEqual({
      _tag: 'CoursitionUnauthorized',
      message: 'Sign in before creating a course draft.',
    });
  });
});
