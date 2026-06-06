import { describe, expect, test } from '@rstest/core';
import type {
  ActivityBrief,
  CourseDraft,
  CoursePreparation,
} from '../shared/coursition/workflow.ts';
import {
  aiProviderConfig,
  generatedActivityFromAxSpec,
  generateCourseContentWithAi,
  isAiProviderConfigured,
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
    feedbackGuidance: 'Assessment-only guidance that tells the evaluator what to look for.',
    id: 'activity_quality_guard',
    instructions: 'Solve the learner-facing task.',
    learnerAction: 'Do the exercise and explain your decision.',
    objectiveId: 'objective_quality_guard',
    objectiveIds: ['objective_quality_guard'],
    sourceConfidence: 'high',
    status: 'generated',
    successCriteria: 'Target-answer rubric text that should stay out of answer options.',
    title: 'Internal activity title',
    type: 'retrieval_check',
    updatedAt: createdAt,
    ...overrides,
  };
};

const expectNotPlayableActivity = (activity: ReturnType<typeof generatedActivityFromAxSpec>) => {
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

describe('Coursition AI provider', () => {
  test('reports the configured local Ax provider when available', () => {
    const config = aiProviderConfig();

    expect(isAiProviderConfigured()).toBe(config !== null);
    if (config !== null) {
      expect(config.provider).toBe('ax/openai-compatible');
      expect(config.model.length).toBeGreaterThan(0);
      expect(config.baseURL.length).toBeGreaterThan(0);
    }
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

  test('requires an Ax playable spec instead of inventing activity content from a brief', () => {
    const brief = activityBrief({
      feedbackGuidance:
        'Assessment-only guidance: correct only when the learner keeps the intended distinction.',
      instructions:
        'For each source excerpt, complete the table and add one sentence explaining your placement.',
      learnerAction:
        'Classify the excerpts into the categories supplied by the generated playable activity.',
      successCriteria: 'Target-answer rubric text that should stay out of generated card text.',
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
    ]);
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

  test('rejects invalid Ax specs as non-playable generation failures', () => {
    const brief = activityBrief({
      instructions: 'Use the generated activity.',
      type: 'ordering_matching',
    });
    const activity = generatedActivityFromAxSpec(brief, {
      feedback: 'Assessment-only guidance that tells the evaluator what to look for.',
      items: [
        { correctPosition: 0, matchLabel: 'Label A', text: 'Target-answer rubric text' },
        { correctPosition: 0, matchLabel: 'Label B', text: 'Another learner card' },
      ],
      mode: 'matching',
      objectiveTitle: 'Objective',
      prompt: 'Assessment-only prompt',
      type: 'ordering_matching',
    });

    expectNotPlayableActivity(activity);
    expect(JSON.stringify(activity)).not.toContain('Assessment-only');
    expect(JSON.stringify(activity)).not.toContain('Target-answer');
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

    expect(activity.type).toBe('practice_task');
    if (activity.type !== 'practice_task') {
      throw new Error(`Expected practice_task, received ${activity.type}`);
    }
    expect(activity.interaction).toMatchObject({
      feedback: 'Compare the answer with the checklist before continuing.',
      kind: 'practice_task',
      prompt: 'Write a compact incident review note using the generated checklist.',
      submissionLabel: 'Incident review note',
    });
    expect(activity.interaction.checklist).toEqual([
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

    expect(activity.type).toBe('rubric_answer');
    if (activity.type !== 'rubric_answer') {
      throw new Error(`Expected rubric_answer, received ${activity.type}`);
    }
    expect(activity.interaction.prompt).toContain('sample text generated by Ax');
    expect(activity.interaction.criteria).toEqual(['Criterion one', 'Criterion two']);
  });
});
