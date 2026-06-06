import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, test } from '@rstest/core';

const execFileAsync = promisify(execFile);
const root = process.cwd();
const runnerPath = path.join(root, 'tests/coursition.workflow.runner.ts');
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

  if (resultLine === undefined) {
    throw new Error(`Scenario ${scenario} did not print a JSON result.`);
  }

  return JSON.parse(resultLine) as T;
};

describe.sequential('source-first Coursition workflow contract', () => {
  test('generate mode builds a grounded course from source material only', async () => {
    const result = await runScenario<{
      activityBriefCount: number;
      blockingFindingCount: number;
      courseContentRenderable: boolean;
      generatedActivityCount: number;
      hasCoursePreparation: boolean;
      objectiveCount: number;
      preparationLanguage?: string;
      sourceCoverage?: string;
      sourceGrounded: boolean;
      sourceStatuses: string[];
      step?: string;
    }>('sourceFirstGenerate');

    expect(result.step).toBe('preview');
    expect(result.sourceStatuses).toEqual(['processed']);
    expect(result.hasCoursePreparation).toBe(true);
    expect(result.preparationLanguage).toBe('en');
    expect(result.objectiveCount).toBeGreaterThan(0);
    expect(result.activityBriefCount).toBeGreaterThan(0);
    expect(result.generatedActivityCount).toBeGreaterThan(0);
    expect(result.courseContentRenderable).toBe(true);
    expect(result.blockingFindingCount).toBe(0);
    expect(result.sourceCoverage).not.toBe('manual');
    expect(result.sourceGrounded).toBe(true);
  }, 60_000);

  test('assist mode advances through editable preparation, objectives, activity plan, course content, and preview', async () => {
    const result = await runScenario<{
      activityBriefCount: number;
      courseContentRenderable: boolean;
      generatedActivityCount: number;
      objectiveCount: number;
      preparationAudience?: string;
      stepAfterActivityPlan?: string;
      stepAfterCourseContent?: string;
      stepAfterObjectives?: string;
      stepAfterPreparation?: string;
      stepAfterPreview?: string;
      stepAfterSources?: string;
    }>('assistModeGates');

    expect(result.stepAfterSources).toBe('sources');
    expect(result.stepAfterPreparation).toBe('preparation');
    expect(result.stepAfterObjectives).toBe('objectives');
    expect(result.stepAfterActivityPlan).toBe('activityPlan');
    expect(result.stepAfterCourseContent).toBe('courseContent');
    expect(result.stepAfterPreview).toBe('preview');
    expect(result.preparationAudience).toContain('incident coordinators');
    expect(result.objectiveCount).toBeGreaterThan(0);
    expect(result.activityBriefCount).toBeGreaterThan(0);
    expect(result.generatedActivityCount).toBeGreaterThan(0);
    expect(result.courseContentRenderable).toBe(true);
  }, 60_000);

  test('source lifecycle classifies notes, URL, and provider-backed files without old wizard steps', async () => {
    const result = await runScenario<{
      deletedSourceStatus?: string;
      fileProcessors: string[];
      finalStep?: string;
      noteStatus?: string;
      retriedSourceStatus?: string;
      sourceNames: string[];
      sourceTypes: string[];
      spoofedProcessor?: string;
      spoofedStatus?: string;
      urlProcessor?: string;
      urlStatus?: string;
    }>('sourceLifecycle');

    expect(result.finalStep).toBe('sources');
    expect(result.noteStatus).toBe('processed');
    expect(result.urlStatus).toBe('processed');
    expect(result.urlProcessor).toBe('tavily_url');
    expect(result.fileProcessors).toEqual([
      'llamaparse_document',
      'deepgram_audio',
      'unsupported_file',
    ]);
    expect(result.spoofedProcessor).toBe('unsupported_file');
    expect(result.spoofedStatus).toBe('unsupported');
    expect(result.deletedSourceStatus).toBe('deleted');
    expect(result.retriedSourceStatus).toBe('processed');
    expect(result.sourceTypes).toEqual(expect.arrayContaining(['notes', 'url', 'file']));
    expect(result.sourceNames).not.toContain('Deleted notes');
  }, 60_000);

  test('PDF sources use LlamaParse for initial parsing and retry', async () => {
    const result = await runScenario<{
      jobBodies: { file_id?: string; tier?: string; version?: string }[];
      parsedContent?: string;
      parsedProcessor?: string;
      parsedProviderJobId?: string;
      parsedStatus?: string;
      pollCount: number;
      pollExpands: (string | null)[];
      retriedContent?: string;
      retriedOriginalInputPreserved: boolean;
      retriedProviderJobId?: string;
      retriedStatus?: string;
      sameSourceId: boolean;
      uploadCount: number;
    }>('llamaParsePdfLifecycle');

    expect(result.parsedStatus).toBe('processed');
    expect(result.parsedProcessor).toBe('llamaparse_document');
    expect(result.parsedProviderJobId).toBe('job-1');
    expect(result.parsedContent).toContain('Parsed PDF job-1');
    expect(result.retriedStatus).toBe('processed');
    expect(result.retriedProviderJobId).toBe('job-2');
    expect(result.retriedContent).toContain('Parsed PDF job-2');
    expect(result.sameSourceId).toBe(true);
    expect(result.retriedOriginalInputPreserved).toBe(true);
    expect(result.uploadCount).toBe(2);
    expect(result.pollCount).toBe(2);
    expect(result.pollExpands).toEqual(['markdown', 'markdown']);
    expect(result.jobBodies).toEqual([
      { file_id: 'file-1', tier: 'cost_effective', version: 'latest' },
      { file_id: 'file-2', tier: 'cost_effective', version: 'latest' },
    ]);
  }, 60_000);

  test('draft lists, selected drafts, and mutations stay isolated per owner', async () => {
    const result = await runScenario<{
      aliceDraftId: string;
      aliceSnapshotDraftId?: string;
      aliceSnapshotTitle?: string;
      bobDraftId: string;
      bobSnapshotDraftId?: string;
      bobSnapshotTitle?: string;
      crossOwnerError: string;
      latestDraftId?: string;
      selectedDraftId?: string;
      selectedStep?: string;
      summaryCount: number;
      summaryTitles: string[];
    }>('ownerIsolationAndResume');

    expect(result.aliceSnapshotDraftId).toBe(result.aliceDraftId);
    expect(result.aliceSnapshotTitle).toBe('Alice source-first draft');
    expect(result.bobSnapshotDraftId).toBe(result.bobDraftId);
    expect(result.bobSnapshotTitle).toBe('Bob source-first draft');
    expect(result.crossOwnerError).toBe('Course draft not found for signed-in creator.');
    expect(result.summaryCount).toBe(2);
    expect(result.summaryTitles).toEqual(['Second source draft', 'First source draft']);
    expect(result.latestDraftId).not.toBe(result.selectedDraftId);
    expect(result.selectedStep).toBe('sources');
  });

  test('course output language defaults to source and can be set to Czech or English', async () => {
    const result = await runScenario<{
      blueprintLanguageAfterCs?: string;
      blueprintLanguageAfterEn?: string;
      blueprintLanguageAfterSource?: string;
      preferenceAfterCs?: string;
      preferenceAfterEn?: string;
      preferenceAfterSource?: string;
      sourceDetectedLanguage?: string;
    }>('courseOutputLanguage');

    expect(result.sourceDetectedLanguage).toBe('cs');
    expect(result.preferenceAfterSource).toBe('source');
    expect(result.blueprintLanguageAfterSource).toBe('cs');
    expect(result.preferenceAfterCs).toBe('cs');
    expect(result.blueprintLanguageAfterCs).toBe('cs');
    expect(result.preferenceAfterEn).toBe('en');
    expect(result.blueprintLanguageAfterEn).toBe('en');
  }, 60_000);

  test('stale warnings after source or preparation edits do not block navigation', async () => {
    const result = await runScenario<{
      blockingFindingCount: number;
      openWarningCount: number;
      stepAfterPreparationEdit?: string;
      stepAfterSourceEdit?: string;
      staleActivityBriefCount: number;
      staleObjectiveCount: number;
    }>('staleWarningNavigation');

    expect(result.staleObjectiveCount).toBeGreaterThan(0);
    expect(result.staleActivityBriefCount).toBeGreaterThan(0);
    expect(result.openWarningCount).toBeGreaterThan(0);
    expect(result.blockingFindingCount).toBe(0);
    expect(result.stepAfterPreparationEdit).toBe('objectives');
    expect(result.stepAfterSourceEdit).toBe('activityPlan');
  }, 60_000);
});
