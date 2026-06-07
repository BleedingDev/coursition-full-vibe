import type {
  ActivityBrief,
  CoursePreparation,
  GeneratedActivity,
  LearningObjective,
  SourceAsset,
  SourceReference,
} from '../../shared/coursition/workflow.ts';

const generatedAt = '2026-06-06T00:00:00.000Z';

export const coursitionActivityGenerationSourceFixtures = [
  {
    content: [
      'New hire onboarding policy.',
      'During the first shift, each coordinator must complete identity verification, read the incident escalation policy, and confirm their buddy assignment before accessing production tools.',
      'If a customer-impacting incident is reported, the coordinator records the evidence, assigns an incident owner, and escalates only when severity criteria are met.',
      'The handoff note must name the owner, include the evidence link, state the severity, and list the next action.',
    ].join('\n\n'),
    createdAt: generatedAt,
    id: 'source_fixture_onboarding_policy',
    name: 'Onboarding policy notes',
    processor: 'fixture',
    sizeLabel: '520 chars',
    status: 'processed',
    type: 'notes',
  },
  {
    content: [
      'Practical cache invalidation runbook.',
      'When stale catalogue data appears, first reproduce the stale value, then check the cache key, then invalidate only the affected tenant key.',
      'After invalidation, verify the fresh value with a read-through request and record the request id in the change log.',
      'Do not clear the global cache unless the tenant-scoped invalidation fails and the incident owner approves the wider action.',
    ].join('\n\n'),
    createdAt: generatedAt,
    id: 'source_fixture_cache_runbook',
    name: 'Cache invalidation runbook',
    processor: 'fixture',
    sizeLabel: '500 chars',
    status: 'processed',
    type: 'notes',
  },
] as const satisfies readonly SourceAsset[];

const onboardingReference = {
  heading: 'Onboarding policy notes',
  position: 'chunk-1',
  sourceAssetId: 'source_fixture_onboarding_policy',
} as const satisfies SourceReference;

const cacheReference = {
  heading: 'Cache invalidation runbook',
  position: 'chunk-1',
  sourceAssetId: 'source_fixture_cache_runbook',
} as const satisfies SourceReference;

export const coursitionActivityGenerationGoldenPreparation = {
  activityMixPreference: 'retrieval, scenario, ordering, practice, and rubric activities',
  audience: 'new operations coordinators',
  constraints: 'Use only the supplied onboarding policy and cache runbook evidence.',
  depth: 'practical',
  desiredOutcome:
    'Learners can apply source-backed operating rules in onboarding and cache incident workflows.',
  language: 'en',
  languagePreference: 'source',
  priorKnowledge: 'Basic incident and support workflow vocabulary.',
  sourceStrictness: 'strict',
  tone: 'clear, concrete, and action-oriented',
} as const satisfies CoursePreparation;

export const coursitionActivityGenerationGoldenObjectives = [
  {
    capability: 'Choose the required onboarding actions before production access.',
    id: 'objective_onboarding_access_gate',
    sourceConfidence: 'high',
    sourceReferences: [onboardingReference],
    sourceSupport: 'source_backed',
    status: 'generated',
    title: 'Complete onboarding access gates',
    topicName: 'Onboarding policy',
    updatedAt: generatedAt,
  },
  {
    capability: 'Escalate customer-impacting incidents only after evidence and severity are clear.',
    id: 'objective_incident_escalation',
    sourceConfidence: 'high',
    sourceReferences: [onboardingReference],
    sourceSupport: 'source_backed',
    status: 'generated',
    title: 'Make source-backed escalation decisions',
    topicName: 'Incident escalation',
    updatedAt: generatedAt,
  },
  {
    capability: 'Sequence a tenant-scoped cache invalidation and verification workflow.',
    id: 'objective_cache_sequence',
    sourceConfidence: 'high',
    sourceReferences: [cacheReference],
    sourceSupport: 'source_backed',
    status: 'generated',
    title: 'Run tenant-scoped cache invalidation',
    topicName: 'Cache invalidation',
    updatedAt: generatedAt,
  },
  {
    capability: 'Write handoff and change-log notes with the required observable details.',
    id: 'objective_operational_notes',
    sourceConfidence: 'high',
    sourceReferences: [onboardingReference, cacheReference],
    sourceSupport: 'source_backed',
    status: 'generated',
    title: 'Create useful operational notes',
    topicName: 'Operational documentation',
    updatedAt: generatedAt,
  },
] as const satisfies readonly LearningObjective[];

export const coursitionActivityGenerationGoldenBriefs = [
  {
    feedbackGuidance:
      'Explain why production access waits until all source-required onboarding gates are complete.',
    id: 'brief_recall_onboarding_gate',
    instructions: 'Choose the source-backed requirement that must happen before production access.',
    learnerAction: 'Recognize the access gate rule.',
    objectiveId: 'objective_onboarding_access_gate',
    objectiveIds: ['objective_onboarding_access_gate'],
    sourceConfidence: 'high',
    sourceReferences: [onboardingReference],
    status: 'generated',
    successCriteria: 'Selects identity verification, policy review, and buddy confirmation.',
    title: 'Recall Sprint: onboarding access gate',
    type: 'retrieval_check',
    updatedAt: generatedAt,
  },
  {
    feedbackGuidance:
      'Tie each option to the source rule about evidence, ownership, severity, and escalation timing.',
    id: 'brief_scenario_incident_escalation',
    instructions: 'Choose the next action in a customer-impacting incident scenario.',
    learnerAction: 'Decide whether escalation is justified yet.',
    objectiveId: 'objective_incident_escalation',
    objectiveIds: ['objective_incident_escalation'],
    sourceConfidence: 'high',
    sourceReferences: [onboardingReference],
    status: 'generated',
    successCriteria:
      'Chooses the action that records evidence, assigns ownership, and checks severity.',
    title: 'Mission Decision: escalation timing',
    type: 'scenario_decision',
    updatedAt: generatedAt,
  },
  {
    feedbackGuidance:
      'Show how reproducing, key checking, tenant invalidation, verification, and logging fit together.',
    id: 'brief_order_cache_workflow',
    instructions: 'Put the cache invalidation workflow into the source-backed order.',
    learnerAction: 'Sequence the tenant-scoped cache repair steps.',
    objectiveId: 'objective_cache_sequence',
    objectiveIds: ['objective_cache_sequence'],
    sourceConfidence: 'high',
    sourceReferences: [cacheReference],
    status: 'generated',
    successCriteria: 'Orders all steps before any wider cache action is considered.',
    title: 'Build the Machine: cache invalidation sequence',
    type: 'ordering_matching',
    updatedAt: generatedAt,
  },
  {
    feedbackGuidance:
      'Compare the note against required owner, evidence, severity, and next-action details.',
    id: 'brief_practice_handoff_note',
    instructions: 'Draft a short handoff note for a customer-impacting incident.',
    learnerAction: 'Write the operational handoff note.',
    objectiveId: 'objective_operational_notes',
    objectiveIds: ['objective_operational_notes', 'objective_incident_escalation'],
    sourceConfidence: 'high',
    sourceReferences: [onboardingReference],
    status: 'generated',
    successCriteria: 'Names the owner\nIncludes evidence\nStates severity\nLists the next action',
    title: 'Tiny Mission: incident handoff note',
    type: 'practice_task',
    updatedAt: generatedAt,
  },
  {
    feedbackGuidance:
      'Evaluate whether the change-log note proves the tenant-scoped invalidation was verified.',
    id: 'brief_rubric_change_log',
    instructions: 'Review a cache change-log note against the runbook criteria.',
    learnerAction: 'Judge and improve the note.',
    objectiveId: 'objective_operational_notes',
    objectiveIds: ['objective_operational_notes', 'objective_cache_sequence'],
    sourceConfidence: 'high',
    sourceReferences: [cacheReference],
    status: 'generated',
    successCriteria:
      'Mentions tenant key\nIncludes read-through verification\nRecords request id\nAvoids unsupported global cache clearing',
    title: 'Reviewer Mode: cache change log',
    type: 'rubric_answer',
    updatedAt: generatedAt,
  },
] as const satisfies readonly ActivityBrief[];

export const coursitionActivityGenerationGoldenActivities = [
  {
    briefId: 'brief_recall_onboarding_gate',
    id: 'activity_recall_onboarding_gate',
    interaction: {
      choices: [
        {
          feedback: 'Correct: the policy requires all three gates before production tool access.',
          id: 'choice_onboarding_correct',
          isCorrect: true,
          text: 'Complete identity verification, read the escalation policy, and confirm the buddy assignment.',
        },
        {
          feedback:
            'That skips the buddy assignment, so the learner would still be missing a required access gate.',
          id: 'choice_onboarding_missing_buddy',
          isCorrect: false,
          text: 'Read the escalation policy and ask for production access after the first incident.',
        },
        {
          feedback:
            'That reverses the policy: access comes after the onboarding gates, not before them.',
          id: 'choice_onboarding_access_first',
          isCorrect: false,
          text: 'Open production tools first, then complete identity verification during the shift.',
        },
      ],
      explanationPrompt: 'Name the access gate that would be missing from a wrong choice.',
      feedback: 'Use the onboarding source to check which gates must happen before access.',
      kind: 'retrieval_check',
      question: 'What must a coordinator do before accessing production tools?',
    },
    objectiveIds: ['objective_onboarding_access_gate'],
    sourceConfidence: 'high',
    sourceReferences: [onboardingReference],
    status: 'generated',
    type: 'retrieval_check',
  },
  {
    briefId: 'brief_scenario_incident_escalation',
    id: 'activity_scenario_incident_escalation',
    interaction: {
      choices: [
        {
          consequence:
            'The incident has evidence, ownership, and a severity check before escalation.',
          feedback:
            'Preferred: this follows the source order before deciding whether escalation is justified.',
          id: 'choice_escalation_preferred',
          isPreferred: true,
          text: 'Record the evidence, assign an owner, check severity criteria, then escalate if the criteria are met.',
        },
        {
          consequence: 'The team escalates without a reliable handoff or severity basis.',
          feedback:
            'This is premature because the policy says evidence, ownership, and severity drive escalation timing.',
          id: 'choice_escalation_too_early',
          isPreferred: false,
          text: 'Escalate immediately because a customer was mentioned.',
        },
        {
          consequence:
            'The incident loses momentum and the customer-impacting signal is not handled.',
          feedback:
            'Waiting without assigning ownership misses the handoff responsibility in the source.',
          id: 'choice_escalation_wait',
          isPreferred: false,
          text: 'Wait until the next shift and ask someone else to decide.',
        },
      ],
      feedback: 'A good decision preserves evidence and ownership before escalation.',
      justificationPrompt: 'Which source signal made the preferred action safer?',
      kind: 'scenario_decision',
      scenario:
        'A new coordinator sees a customer-impacting incident report with partial logs and no named owner.',
    },
    objectiveIds: ['objective_incident_escalation'],
    sourceConfidence: 'high',
    sourceReferences: [onboardingReference],
    status: 'generated',
    type: 'scenario_decision',
  },
  {
    briefId: 'brief_order_cache_workflow',
    id: 'activity_order_cache_workflow',
    interaction: {
      feedback:
        'The runbook keeps the repair tenant-scoped: reproduce, identify the key, invalidate it, verify freshness, then log the request id.',
      items: [
        {
          correctPosition: 1,
          id: 'item_cache_reproduce',
          text: 'Reproduce the stale catalogue value.',
        },
        {
          correctPosition: 2,
          id: 'item_cache_key',
          text: 'Check the cache key for the affected tenant.',
        },
        {
          correctPosition: 3,
          id: 'item_cache_invalidate',
          text: 'Invalidate only the affected tenant key.',
        },
        {
          correctPosition: 4,
          id: 'item_cache_verify',
          text: 'Verify the fresh value with a read-through request.',
        },
        {
          correctPosition: 5,
          id: 'item_cache_log',
          text: 'Record the request id in the change log.',
        },
      ],
      kind: 'ordering_matching',
      mode: 'ordering',
      prompt: 'Put the tenant-scoped cache invalidation workflow in order.',
    },
    objectiveIds: ['objective_cache_sequence'],
    sourceConfidence: 'high',
    sourceReferences: [cacheReference],
    status: 'generated',
    type: 'ordering_matching',
  },
  {
    briefId: 'brief_practice_handoff_note',
    id: 'activity_practice_handoff_note',
    interaction: {
      checklist: [
        'Names the incident owner.',
        'Includes the evidence link or evidence location.',
        'States the severity.',
        'Lists the next action.',
      ],
      feedback:
        'A usable handoff lets the next person see ownership, evidence, severity, and the next move without asking follow-up questions.',
      kind: 'practice_task',
      prompt:
        'Draft a two-sentence handoff note for a customer-impacting incident with logs attached and severity criteria met.',
      submissionLabel: 'Incident handoff note',
    },
    objectiveIds: ['objective_operational_notes', 'objective_incident_escalation'],
    sourceConfidence: 'high',
    sourceReferences: [onboardingReference],
    status: 'generated',
    type: 'practice_task',
  },
  {
    briefId: 'brief_rubric_change_log',
    id: 'activity_rubric_change_log',
    interaction: {
      criteria: [
        'Identifies the affected tenant cache key.',
        'Confirms a read-through request verified the fresh value.',
        'Records the request id in the change log.',
        'Does not claim a global cache clear without owner approval.',
      ],
      feedback:
        'A strong review checks whether the note proves a tenant-scoped fix and avoids unsupported global action.',
      kind: 'rubric_answer',
      prompt:
        'Review this note: "Cleared cache and it looks fixed." What is missing against the runbook criteria, and how would you improve it?',
    },
    objectiveIds: ['objective_operational_notes', 'objective_cache_sequence'],
    sourceConfidence: 'high',
    sourceReferences: [cacheReference],
    status: 'generated',
    type: 'rubric_answer',
  },
] as const satisfies readonly GeneratedActivity[];

export const coursitionActivityGenerationGoldenOutput = {
  activityBriefs: coursitionActivityGenerationGoldenBriefs,
  assumptions: [
    'Learners already understand basic incident and support vocabulary.',
    'Strict source grounding is required for workflow steps and escalation timing.',
  ],
  coursePreparation: coursitionActivityGenerationGoldenPreparation,
  generatedActivities: coursitionActivityGenerationGoldenActivities,
  objectives: coursitionActivityGenerationGoldenObjectives,
  qualityReview:
    'The activity pack covers all five reusable engines, stays source-grounded, and gives learner-facing feedback.',
  qualityScore: 0.93,
} as const;
