import { describe, expect, test } from '@rstest/core';
import type {
  ActivityBrief,
  CourseDraft,
  CoursePreparation,
} from '../shared/coursition/workflow.ts';
import {
  activityEvaluationFromAxResult,
  aiProviderConfig,
  coursePreparationFromAxPlanningResult,
  generatedActivityFromAxSpec,
  generateCourseContentWithAi,
  isAiProviderConfigured,
  learningBlueprintFromAxPlanningResult,
  renderPlayableActivityFromBrief,
} from '../server/coursition/ai-provider.ts';

const preparation = (language: CoursePreparation['language']): CoursePreparation => ({
  activityMixPreference: 'scenario review drills with short retrieval checks',
  audience: 'new incident coordinators',
  constraints: 'avoid provider setup details',
  depth: 'practical',
  desiredOutcome: 'run a repeatable incident review workflow',
  language,
  languagePreference: 'source',
  priorKnowledge: 'basic incident response vocabulary',
  sourceStrictness: 'standard',
  tone: 'clear and direct',
});

const sourceFirstDraft = (): CourseDraft => {
  const createdAt = '2026-06-04T00:00:00.000Z';
  const sourceContent =
    'Incident triage playbooks define escalation paths, ownership handoff, evidence capture, and post-incident review drills. The teachable work is the repeatable review process and source-backed escalation decisions.';
  return {
    aiRuns: [],
    courseContent: {
      createdAt,
      sections: [],
      status: 'empty',
      updatedAt: createdAt,
    },
    createdAt,
    derivedSourceDocuments: [],
    findings: [],
    id: 'draft_source_first_quality',
    knowledgeChunks: [
      {
        confidence: 'high',
        content: sourceContent,
        createdAt,
        derivedSourceDocumentId: 'document_source_first_quality',
        id: 'chunk_source_first_quality_1',
        reference: {
          heading: 'Incident review notes',
          position: 'chunk-1',
          sourceAssetId: 'source_source_first_quality',
        },
        sourceAssetId: 'source_source_first_quality',
      },
    ],
    language: 'en',
    learningBlueprint: {
      activityBriefs: [],
      assumptions: [],
      coursePreparation: preparation('en'),
      createdAt,
      generatedActivities: [],
      objectives: [],
      sourceCoverage: 'source_backed',
      updatedAt: createdAt,
    },
    mode: 'assist',
    ownerId: 'owner_source_first_quality',
    sourceProcessingIncomplete: false,
    sources: [
      {
        content: sourceContent,
        createdAt,
        id: 'source_source_first_quality',
        name: 'Incident review notes',
        processor: 'test',
        sizeLabel: '220 chars',
        status: 'processed',
        type: 'notes',
      },
    ],
    step: 'preparation',
    title: 'Incident review onboarding',
    updatedAt: createdAt,
  };
};

const activityBrief = (overrides: Partial<ActivityBrief>): ActivityBrief => {
  const createdAt = '2026-06-04T00:00:00.000Z';
  return {
    createdAt,
    feedbackGuidance: 'Brief-level feedback guidance for the generated activity.',
    id: 'activity_quality_guard',
    instructions: 'Solve the learner-facing task.',
    learnerAction: 'Do the exercise and explain your decision.',
    objectiveId: 'objective_quality_guard',
    objectiveIds: ['objective_quality_guard'],
    sourceConfidence: 'high',
    status: 'generated',
    successCriteria: 'Brief-level success criteria for the generated activity.',
    title: 'Internal activity title',
    type: 'retrieval_check',
    updatedAt: createdAt,
    ...overrides,
  };
};

type GeneratedActivityResult = ReturnType<typeof generatedActivityFromAxSpec>;
type PracticeTaskActivity = Extract<GeneratedActivityResult, { type: 'practice_task' }>;
type RubricAnswerActivity = Extract<GeneratedActivityResult, { type: 'rubric_answer' }>;

const expectNotPlayableActivity = (activity: GeneratedActivityResult) => {
  expect(activity.type).toBe('not_playable');
  if (activity.type !== 'not_playable') {
    throw new Error(`Expected not_playable, received ${activity.type}`);
  }
  expect(activity.status).toBe('stale');
  expect(activity.interaction.kind).toBe('not_playable');
  expect(activity.interaction.prompt).toMatch(/\S/u);
  expect(activity.interaction.reason).toMatch(/Ax-generated playable activity/iu);
  expect(activity.interaction.feedback).toMatch(/\S/u);
};

const expectPracticeTaskActivity = (activity: GeneratedActivityResult): PracticeTaskActivity => {
  expect(activity.type).toBe('practice_task');
  if (activity.type !== 'practice_task') {
    throw new Error(`Expected practice_task, received ${activity.type}`);
  }
  return activity;
};

const expectRubricAnswerActivity = (activity: GeneratedActivityResult): RubricAnswerActivity => {
  expect(activity.type).toBe('rubric_answer');
  if (activity.type !== 'rubric_answer') {
    throw new Error(`Expected rubric_answer, received ${activity.type}`);
  }
  return activity;
};

describe('Coursition AI provider', () => {
  test('renders every Ax-planned activity brief into a playable local engine', () => {
    const draft = sourceFirstDraft();
    const activityTypes = [
      'retrieval_check',
      'scenario_decision',
      'ordering_matching',
      'practice_task',
      'rubric_answer',
    ] as const;

    for (const type of activityTypes) {
      const rendered = renderPlayableActivityFromBrief(
        draft,
        activityBrief({ id: `brief_${type}`, type }),
      );

      expect(rendered.type).toBe(type);
      expect(rendered.status).toBe('generated');
      expect(rendered.interaction.kind).toBe(type);
    }
  });

  test('omits matching-only labels from locally rendered ordering items', () => {
    const rendered = renderPlayableActivityFromBrief(
      sourceFirstDraft(),
      activityBrief({ id: 'brief_ordering', type: 'ordering_matching' }),
    );

    expect(rendered.type).toBe('ordering_matching');
    if (rendered.type !== 'ordering_matching') {
      throw new Error(`Expected ordering_matching, received ${rendered.type}`);
    }
    for (const item of rendered.interaction.items) {
      expect(Object.hasOwn(item, 'matchLabel')).toBe(false);
    }
  });

  test('reports the configured local Ax provider when available', () => {
    const config = aiProviderConfig();

    expect(isAiProviderConfigured()).toBe(config !== null);
    if (config !== null) {
      expect(config.provider).toBe('ax/openai-compatible');
      expect(config.model.length).toBeGreaterThan(0);
      expect(config.baseURL.length).toBeGreaterThan(0);
    }
  });

  test('accepts native Ax JSON objects for course preparation output', () => {
    const draft = sourceFirstDraft();
    const generated = coursePreparationFromAxPlanningResult(draft, {
      assumptions: 'Zdroj je cesky, proto bude kurz v cestine.',
      coursePreparation: {
        activityMixPreference: 'kratke scenare a prakticke ukoly',
        audience: 'autori, kteri se uci psat romany a povidky',
        constraints: 'nepridavat tematiku mimo zdrojovy dokument',
        depth: 'prakticky postup od napadu po revizi textu',
        desiredOutcome: 'Ucastnici navrhnou zanrovy pribeh a pripravi ukazku textu.',
        priorKnowledge: 'zakladni chut psat beletrii',
        sourceStrictness: 'strict',
        tone: 'prakticky a vecny',
      },
      outputLanguage: 'cs',
    });

    expect(generated.coursePreparation.language).toBe('cs');
    expect(generated.coursePreparation.languagePreference).toBe('source');
    expect(generated.coursePreparation.desiredOutcome).toContain('zanrovy pribeh');
    expect(generated.coursePreparation.sourceStrictness).toBe('strict');
    expect(generated.assumptions).toEqual(['Zdroj je cesky, proto bude kurz v cestine.']);
  });

  test('accepts native Ax JSON arrays for planning output', () => {
    const draft = sourceFirstDraft();
    const generatedAt = '2026-06-04T00:00:00.000Z';
    const sourceReference = {
      heading: 'Incident review notes',
      position: 'chunk-1',
      sourceAssetId: 'source_source_first_quality',
    };
    const learningBlueprint = learningBlueprintFromAxPlanningResult(draft, {
      activityBriefs: [
        {
          feedbackGuidance: 'Explain why evidence and ownership come before escalation.',
          id: 'brief_incident_decision',
          instructions: 'Choose the best next action in the incident review workflow.',
          learnerAction: 'Select the source-backed next decision.',
          objectiveId: 'objective_incident_decision',
          objectiveIds: ['objective_incident_decision'],
          sourceConfidence: 'high',
          sourceReferences: [sourceReference],
          status: 'generated',
          successCriteria: 'The choice preserves evidence and ownership before escalation.',
          title: 'Mission Decision: incident handoff',
          type: 'scenario_decision',
          updatedAt: generatedAt,
        },
      ],
      assumptions: 'Use the incident review source as the course basis.',
      coursePreparation: {
        activityMixPreference: 'scenario decision and retrieval practice',
        audience: 'incident coordinators',
        constraints: 'Stay grounded in the supplied source.',
        depth: 'practical',
        desiredOutcome: 'Learners can make source-backed incident review decisions.',
        priorKnowledge: 'Basic incident workflow terms.',
        sourceStrictness: 'strict',
        tone: 'clear and direct',
      },
      objectives: [
        {
          capability: 'Apply evidence and ownership rules before escalation.',
          id: 'objective_incident_decision',
          sourceConfidence: 'high',
          sourceReferences: [sourceReference],
          sourceSupport: 'source_backed',
          status: 'generated',
          title: 'Make source-backed escalation decisions',
          topicName: 'Incident review',
          updatedAt: generatedAt,
        },
      ],
      outputLanguage: 'en',
    });

    expect(learningBlueprint.coursePreparation.language).toBe('en');
    expect(learningBlueprint.objectives).toHaveLength(1);
    expect(learningBlueprint.activityBriefs).toHaveLength(5);
    expect(learningBlueprint.generatedActivities).toHaveLength(0);
  });

  test('materializes deterministic Czech activity briefs for a Czech plan', () => {
    const draft = {
      ...sourceFirstDraft(),
      language: 'cs' as const,
      learningBlueprint: {
        ...sourceFirstDraft().learningBlueprint,
        coursePreparation: {
          ...preparation('cs'),
          languagePreference: 'cs' as const,
        },
      },
    };
    const learningBlueprint = learningBlueprintFromAxPlanningResult(draft, {
      activityBriefs: [],
      assumptions: 'Kurz je v češtině.',
      coursePreparation: draft.learningBlueprint.coursePreparation,
      objectives: [
        {
          capability: 'Bezpečně předat odpovědnost před eskalací.',
          sourceConfidence: 'high',
          sourceSupport: 'source_backed',
          title: 'Bezpečné předání odpovědnosti',
          topicName: 'Řízení incidentu',
        },
      ],
      outputLanguage: 'cs',
    });

    expect(learningBlueprint.activityBriefs[0]?.title).toContain('kontrola vybavení');
    expect(learningBlueprint.activityBriefs[0]?.instructions).toContain('Procvičte si schopnost');
    expect(learningBlueprint.activityBriefs[0]?.feedbackGuidance).toContain('co zlepšit');
  });

  test('materializes at least one activity brief for every generated objective', () => {
    const draft = sourceFirstDraft();
    const objectives = Array.from({ length: 6 }, (_, index) => ({
      capability: `Apply source-backed capability ${index + 1}.`,
      id: `objective_${index + 1}`,
      sourceConfidence: 'high' as const,
      sourceSupport: 'source_backed' as const,
      title: `Objective ${index + 1}`,
      topicName: 'Incident review',
    }));
    const learningBlueprint = learningBlueprintFromAxPlanningResult(draft, {
      activityBriefs: [],
      assumptions: 'Every objective needs a playable activity.',
      coursePreparation: draft.learningBlueprint.coursePreparation,
      objectives,
      outputLanguage: 'en',
    });

    expect(learningBlueprint.activityBriefs).toHaveLength(objectives.length);
    expect(
      new Set(learningBlueprint.activityBriefs.flatMap((brief) => brief.objectiveIds)),
    ).toEqual(new Set(learningBlueprint.objectives.map((objective) => objective.id)));
  });

  test('rejects wrapped Ax activity brief arrays instead of unwrapping them', () => {
    const draft = sourceFirstDraft();

    expect(() =>
      learningBlueprintFromAxPlanningResult(draft, {
        activityBriefs: { activityBriefs: [] },
        assumptions: 'Wrapped output should fail the planning contract.',
        coursePreparation: preparation('en'),
        objectives: [],
        outputLanguage: 'en',
      }),
    ).toThrow(/activityBriefs must be a JSON array/u);
  });

  test('renders course content from Ax-generated playable activities', async () => {
    const draft = sourceFirstDraft();
    const brief = activityBrief({
      id: 'activity_incident_handoff',
      objectiveId: 'objective_incident_handoff',
      objectiveIds: ['objective_incident_handoff'],
      type: 'retrieval_check',
    });
    const activity = generatedActivityFromAxSpec(brief, {
      choices: [
        {
          feedback: 'Correct: ownership and evidence are preserved before escalation.',
          isCorrect: true,
          text: 'Capture evidence, name the owner, and then choose the escalation path.',
        },
        {
          feedback: 'This starts escalation before the review has a reliable handoff.',
          isCorrect: false,
          text: 'Escalate first and reconstruct ownership after the review call.',
        },
        {
          feedback: 'This captures evidence but leaves the handoff owner ambiguous.',
          isCorrect: false,
          text: 'Capture evidence and leave escalation ownership for the next meeting.',
        },
      ],
      explanationPrompt: 'Explain why the handoff comes first.',
      feedback: 'Use the source-backed handoff and evidence rules.',
      objectiveTitle: 'Incident handoff',
      question: 'Which action creates a reliable incident handoff?',
      type: 'retrieval_check',
    });
    if (activity.type !== 'retrieval_check') {
      throw new Error(`Expected retrieval_check, received ${activity.type}`);
    }

    const contentResult = await generateCourseContentWithAi({
      ...draft,
      learningBlueprint: {
        ...draft.learningBlueprint,
        activityBriefs: [brief],
        generatedActivities: [activity],
        objectives: [
          {
            capability: 'Run a source-backed incident handoff before escalation.',
            id: 'objective_incident_handoff',
            sourceConfidence: 'high',
            sourceReferences: [
              {
                heading: 'Incident review notes',
                position: 'chunk-1',
                sourceAssetId: 'source_source_first_quality',
              },
            ],
            sourceSupport: 'source_backed',
            status: 'generated',
            title: 'Incident handoff',
            topicName: 'Incident review notes',
            updatedAt: draft.updatedAt,
          },
        ],
      },
    });

    expect(contentResult.provider).toBe('local-course-content-renderer');
    expect(contentResult.value.sections.length).toBeGreaterThan(0);
    expect(contentResult.value.sections[0]?.blocks.map((block) => block.type)).toEqual(
      expect.arrayContaining(['source_explanation', 'interactive_activity']),
    );
  });

  test('successful activity generation clears stale brief activity status', () => {
    const brief = activityBrief({ status: 'stale' });
    const activity = generatedActivityFromAxSpec(brief, {
      choices: [
        {
          feedback: 'Correct.',
          isCorrect: true,
          text: 'Capture evidence before escalation.',
        },
        {
          feedback: 'This skips evidence.',
          isCorrect: false,
          text: 'Escalate immediately.',
        },
        {
          feedback: 'This captures evidence but leaves ownership unclear.',
          isCorrect: false,
          text: 'Capture evidence and leave the owner blank.',
        },
      ],
      explanationPrompt: 'Explain the evidence cue.',
      feedback: 'Compare the choice with the source rule.',
      question: 'What should happen first?',
      type: 'retrieval_check',
    });

    expect(activity.type).toBe('retrieval_check');
    expect(activity.status).toBe('generated');
  });

  test('requires an Ax playable spec instead of inventing activity content from a brief', () => {
    const brief = activityBrief({
      feedbackGuidance: 'Brief-level guidance for the intended classification distinction.',
      instructions:
        'For each source excerpt, complete the table and add one sentence explaining your placement.',
      learnerAction:
        'Classify the excerpts into the categories supplied by the generated playable activity.',
      successCriteria: 'Brief-level success criteria for generated card text.',
      title: 'Classification exercise',
      type: 'retrieval_check',
    });

    const activity = generatedActivityFromAxSpec(brief, null);

    expectNotPlayableActivity(activity);
    expect(JSON.stringify(activity)).not.toContain(brief.instructions);
    expect(JSON.stringify(activity)).not.toContain(brief.successCriteria);
  });

  test('accepts Ax-generated retrieval specs', () => {
    const brief = activityBrief({
      instructions: 'Answer the generated retrieval check.',
      type: 'retrieval_check',
    });
    const activity = generatedActivityFromAxSpec(brief, {
      choices: [
        {
          feedback: 'Correct: the handoff preserves evidence and ownership.',
          isCorrect: true,
          text: 'Capture the evidence and confirm the next owner before handoff.',
        },
        {
          feedback: 'This skips the source-backed ownership check.',
          isCorrect: false,
          text: 'Close the review once the first responder has a theory.',
        },
        {
          feedback: 'This captures context but still misses the owner handoff.',
          isCorrect: false,
          text: 'Write the context summary and let the escalation owner emerge later.',
        },
      ],
      explanationPrompt: 'Explain which source rule makes this answer work.',
      feedback: 'Use the handoff and evidence-capture rules from the source.',
      objectiveTitle: 'Objective',
      question: 'Which action creates a reliable incident handoff?',
      type: 'retrieval_check',
    });

    expect(activity.type).toBe('retrieval_check');
    if (activity.type !== 'retrieval_check') {
      throw new Error(`Expected retrieval_check, received ${activity.type}`);
    }
    expect(activity.interaction).toMatchObject({
      explanationPrompt: 'Explain which source rule makes this answer work.',
      feedback: 'Use the handoff and evidence-capture rules from the source.',
      kind: 'retrieval_check',
      question: 'Which action creates a reliable incident handoff?',
    });
    expect(activity.interaction.choices.map((choice) => [choice.text, choice.isCorrect])).toEqual([
      ['Capture the evidence and confirm the next owner before handoff.', true],
      ['Close the review once the first responder has a theory.', false],
      ['Write the context summary and let the escalation owner emerge later.', false],
    ]);
  });

  test('rejects retrieval checks without exactly one correct answer', () => {
    const brief = activityBrief({
      instructions: 'Answer the generated retrieval check.',
      type: 'retrieval_check',
    });
    const activity = generatedActivityFromAxSpec(brief, {
      choices: [
        {
          feedback: 'Feedback for answer A.',
          isCorrect: true,
          text: 'Answer A',
        },
        {
          feedback: 'Feedback for answer B.',
          isCorrect: true,
          text: 'Answer B',
        },
        {
          feedback: 'Feedback for answer C.',
          isCorrect: false,
          text: 'Answer C',
        },
      ],
      explanationPrompt: 'Explain the source-backed distinction.',
      feedback: 'Compare each option with the source.',
      objectiveTitle: 'Objective',
      question: 'Which answer follows the source?',
      type: 'retrieval_check',
    });

    expectNotPlayableActivity(activity);
  });

  test('rejects retrieval checks with duplicate choice text', () => {
    const brief = activityBrief({
      instructions: 'Answer the generated retrieval check.',
      type: 'retrieval_check',
    });
    const activity = generatedActivityFromAxSpec(brief, {
      choices: [
        {
          feedback: 'Correct feedback.',
          isCorrect: true,
          text: 'Capture evidence before escalation.',
        },
        {
          feedback: 'Incorrect feedback.',
          isCorrect: false,
          text: 'Capture evidence before escalation.',
        },
        {
          feedback: 'Incorrect feedback.',
          isCorrect: false,
          text: 'Escalate before capturing evidence.',
        },
      ],
      explanationPrompt: 'Explain the source-backed distinction.',
      feedback: 'Compare each option with the source.',
      objectiveTitle: 'Objective',
      question: 'Which answer follows the source?',
      type: 'retrieval_check',
    });

    expectNotPlayableActivity(activity);
  });

  test('accepts Ax-generated matching specs', () => {
    const brief = activityBrief({
      instructions: 'Match the generated cards.',
      type: 'ordering_matching',
    });
    const activity = generatedActivityFromAxSpec(brief, {
      feedback: 'Review the labels and fix any mismatch.',
      items: [
        { correctPosition: 0, matchLabel: 'Category A', text: 'Generated card one' },
        { correctPosition: 0, matchLabel: 'Category B', text: 'Generated card two' },
      ],
      mode: 'matching',
      objectiveTitle: 'Objective',
      prompt: 'Match each generated card to its label.',
      type: 'ordering_matching',
    });

    expect(activity.type).toBe('ordering_matching');
    if (activity.type !== 'ordering_matching') {
      throw new Error(`Expected ordering_matching, received ${activity.type}`);
    }
    expect(activity.interaction).toMatchObject({
      feedback: 'Review the labels and fix any mismatch.',
      mode: 'matching',
      prompt: 'Match each generated card to its label.',
    });
    expect(activity.interaction.items.map((item) => [item.text, item.matchLabel])).toEqual([
      ['Generated card one', 'Category A'],
      ['Generated card two', 'Category B'],
    ]);
  });

  test('accepts Ax-generated ordering specs and preserves item order metadata', () => {
    const brief = activityBrief({
      instructions: 'Order the generated process cards.',
      type: 'ordering_matching',
    });
    const activity = generatedActivityFromAxSpec(brief, {
      feedback: 'Check the sequence before moving on.',
      items: [
        { correctPosition: 1, matchLabel: '', text: 'Generated first step' },
        { correctPosition: 2, matchLabel: '', text: 'Generated second step' },
        { correctPosition: 3, matchLabel: '', text: 'Generated third step' },
      ],
      mode: 'ordering',
      objectiveTitle: 'Objective',
      prompt: 'Put the generated process cards in order.',
      type: 'ordering_matching',
    });

    expect(activity.type).toBe('ordering_matching');
    if (activity.type !== 'ordering_matching') {
      throw new Error(`Expected ordering_matching, received ${activity.type}`);
    }
    expect(activity.interaction.mode).toBe('ordering');
    expect(activity.interaction.items.map((item) => [item.text, item.correctPosition])).toEqual([
      ['Generated first step', 1],
      ['Generated second step', 2],
      ['Generated third step', 3],
    ]);
  });

  test('rejects structurally invalid Ax specs as non-playable generation failures', () => {
    const brief = activityBrief({
      instructions: 'Use the generated activity.',
      type: 'ordering_matching',
    });
    const activity = generatedActivityFromAxSpec(brief, {
      feedback: 'Review the sequence and fix the duplicated item.',
      items: [
        { correctPosition: 1, matchLabel: '', text: 'Capture evidence' },
        { correctPosition: 2, matchLabel: '', text: 'Capture evidence' },
        { correctPosition: 3, matchLabel: '', text: 'Choose escalation path' },
      ],
      mode: 'ordering',
      objectiveTitle: 'Objective',
      prompt: 'Put the generated process cards in order.',
      type: 'ordering_matching',
    });

    expectNotPlayableActivity(activity);
  });

  test('rejects ordering specs with duplicate positions', () => {
    const brief = activityBrief({
      instructions: 'Order the generated process cards.',
      type: 'ordering_matching',
    });
    const activity = generatedActivityFromAxSpec(brief, {
      feedback: 'Check the sequence before moving on.',
      items: [
        { correctPosition: 1, matchLabel: '', text: 'Generated first step' },
        { correctPosition: 1, matchLabel: '', text: 'Generated second step' },
        { correctPosition: 3, matchLabel: '', text: 'Generated third step' },
      ],
      mode: 'ordering',
      objectiveTitle: 'Objective',
      prompt: 'Put the generated process cards in order.',
      type: 'ordering_matching',
    });

    expectNotPlayableActivity(activity);
  });

  test('accepts Ax-generated scenario specs', () => {
    const brief = activityBrief({
      instructions: 'Choose the generated scenario decision.',
      type: 'scenario_decision',
    });
    const activity = generatedActivityFromAxSpec(brief, {
      choices: [
        {
          consequence: 'The review keeps one accountable owner and a clear evidence trail.',
          feedback: 'Preferred: it preserves the workflow before analysis expands.',
          isPreferred: true,
          text: 'Assign one owner, capture evidence, then decide the escalation path.',
        },
        {
          consequence: 'The team moves quickly but loses the reason for the handoff.',
          feedback: 'This weakens the repeatable review process.',
          isPreferred: false,
          text: 'Escalate immediately and document the context after the call.',
        },
      ],
      feedback: 'Compare each option with the source-backed review workflow.',
      justificationPrompt: 'Justify the decision in one sentence.',
      objectiveTitle: 'Objective',
      prompt:
        'A review starts with unclear ownership and incomplete evidence. What do you do first?',
      type: 'scenario_decision',
    });

    expect(activity.type).toBe('scenario_decision');
    if (activity.type !== 'scenario_decision') {
      throw new Error(`Expected scenario_decision, received ${activity.type}`);
    }
    expect(activity.interaction).toMatchObject({
      feedback: 'Compare each option with the source-backed review workflow.',
      justificationPrompt: 'Justify the decision in one sentence.',
      kind: 'scenario_decision',
      scenario:
        'A review starts with unclear ownership and incomplete evidence. What do you do first?',
    });
    expect(activity.interaction.choices.map((choice) => [choice.text, choice.isPreferred])).toEqual(
      [
        ['Assign one owner, capture evidence, then decide the escalation path.', true],
        ['Escalate immediately and document the context after the call.', false],
      ],
    );
  });

  test('rejects scenario decisions without exactly one preferred answer', () => {
    const brief = activityBrief({
      instructions: 'Choose the generated scenario decision.',
      type: 'scenario_decision',
    });
    const activity = generatedActivityFromAxSpec(brief, {
      choices: [
        {
          consequence: 'The review has ownership and evidence before escalation.',
          feedback: 'This preserves the workflow.',
          isPreferred: true,
          text: 'Assign one owner and capture evidence before escalation.',
        },
        {
          consequence: 'The review also preserves the workflow.',
          feedback: 'This is also marked preferred and should be rejected structurally.',
          isPreferred: true,
          text: 'Confirm ownership, capture evidence, then pick the escalation path.',
        },
        {
          consequence: 'The review moves quickly but loses handoff clarity.',
          feedback: 'This skips a required workflow step.',
          isPreferred: false,
          text: 'Escalate immediately and write notes later.',
        },
      ],
      feedback: 'Compare each option with the source-backed workflow.',
      justificationPrompt: 'Justify the decision in one sentence.',
      objectiveTitle: 'Objective',
      prompt: 'A review starts with unclear ownership. What should happen first?',
      type: 'scenario_decision',
    });

    expectNotPlayableActivity(activity);
  });

  test('accepts Ax-generated practice specs', () => {
    const brief = activityBrief({
      instructions: 'Complete the generated practice task.',
      type: 'practice_task',
    });
    const activity = generatedActivityFromAxSpec(brief, {
      criteria: 'Names the handoff owner\nCaptures evidence\nStates the review decision',
      feedback: 'Compare the answer with the checklist before continuing.',
      objectiveTitle: 'Objective',
      prompt: 'Write a compact incident review note using the generated checklist.',
      submissionLabel: 'Incident review note',
      type: 'practice_task',
    });

    const practiceActivity = expectPracticeTaskActivity(activity);
    expect(practiceActivity.interaction).toMatchObject({
      feedback: 'Compare the answer with the checklist before continuing.',
      kind: 'practice_task',
      prompt: 'Write a compact incident review note using the generated checklist.',
      submissionLabel: 'Incident review note',
    });
    expect(practiceActivity.interaction.checklist).toEqual([
      'Names the handoff owner',
      'Captures evidence',
      'States the review decision',
    ]);
  });

  test('accepts Ax-generated rubric specs', () => {
    const brief = activityBrief({
      instructions: 'Complete a rubric answer.',
      type: 'rubric_answer',
    });
    const activity = generatedActivityFromAxSpec(brief, {
      criteria: 'Criterion one\nCriterion two',
      feedback: 'Compare your answer with the criteria.',
      objectiveTitle: 'Objective',
      prompt: 'Use this included sample: sample text generated by Ax. Then complete the rubric.',
      type: 'rubric_answer',
    });

    const rubricActivity = expectRubricAnswerActivity(activity);
    expect(rubricActivity.interaction.prompt).toContain('sample text generated by Ax');
    expect(rubricActivity.interaction.criteria).toEqual(['Criterion one', 'Criterion two']);
  });

  test('normalizes Ax-generated open-ended activity evaluation feedback', () => {
    const brief = activityBrief({
      instructions: 'Complete the generated practice task.',
      type: 'practice_task',
    });
    const activity = expectPracticeTaskActivity(
      generatedActivityFromAxSpec(brief, {
        criteria: 'Names the owner\nStates the evidence',
        feedback: 'Compare your answer with the checklist.',
        objectiveTitle: 'Objective',
        prompt: 'Write an incident review note.',
        submissionLabel: 'Review note',
        type: 'practice_task',
      }),
    );

    const evaluation = activityEvaluationFromAxResult(activity, {
      criteriaEvaluationJson: JSON.stringify([
        {
          criterion: 'Names the owner',
          feedback: 'The note assigns a clear owner.',
          met: true,
        },
        {
          criterion: 'States the evidence',
          feedback: 'Add the specific captured evidence.',
          met: false,
        },
      ]),
      feedbackMarkdown: '**Good start.** The owner is clear, but the evidence is vague.',
      nextStep: 'Add one concrete evidence sentence.',
      score: 1.4,
    });

    expect(evaluation.score).toBe(1);
    expect(evaluation.feedbackMarkdown).toContain('Good start');
    expect(evaluation.nextStep).toBe('Add one concrete evidence sentence.');
    expect(evaluation.criteria).toEqual([
      {
        criterion: 'Names the owner',
        feedback: 'The note assigns a clear owner.',
        met: true,
      },
      {
        criterion: 'States the evidence',
        feedback: 'Add the specific captured evidence.',
        met: false,
      },
    ]);
  });

  test('rejects missing practice specs instead of inventing a practice task', () => {
    const brief = activityBrief({
      feedbackGuidance: 'Compare the answer against the concrete criteria.',
      instructions: 'Write a short incident review note.',
      learnerAction: 'Draft the note.',
      successCriteria: 'Names the owner\nStates the evidence\nDefines the next action',
      type: 'practice_task',
    });

    const activity = generatedActivityFromAxSpec(brief, null);

    expectNotPlayableActivity(activity);
  });

  test('rejects missing rubric specs instead of inventing a rubric answer', () => {
    const brief = activityBrief({
      feedbackGuidance: 'Use the rubric to improve the answer.',
      instructions: 'Review the sample incident note and improve it.',
      learnerAction: 'Revise the answer.',
      successCriteria: 'Mentions ownership\nUses captured evidence\nStates the escalation decision',
      type: 'rubric_answer',
    });

    const activity = generatedActivityFromAxSpec(brief, null);

    expectNotPlayableActivity(activity);
  });
});
