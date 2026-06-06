---
name: hackathon-activity-generation-fast-lane
overview: Stabilize the course activity experience for the hackathon demo by keeping reusable activity engines and using Ax as a constrained activity-spec generator rather than a one-off mini-game generator.
isProject: false
todos:
  - id: repair-current-build
    content: Run ultramodern gates, fix compile/type/test drift first, and do not start activity work until the app can demo end-to-end.
    status: pending
  - id: add-activity-spec-contract
    content: Treat GeneratedActivity as a finite playable spec for the five reusable engines; do not add arbitrary new game types or generated UI code.
    status: pending
  - id: split-ax-pipeline
    content: Split generation into source evidence -> objective -> activity brief -> one playable activity spec -> deterministic validation -> narrow repair.
    status: pending
  - id: improve-ax-signature-guidance
    content: Update Ax generation descriptions to require concrete learner action, plausible distractors, misconception-specific feedback, and self-contained prompts.
    status: pending
  - id: add-demo-fixtures
    content: Add two short source fixtures and golden generated outputs for retrieval, scenario, ordering, practice, and rubric activities.
    status: pending
  - id: user-test-script
    content: Prepare a 15-minute real-person test script focused on whether learners know what to do, try the activity, understand feedback, and want to continue.
    status: pending
---

# Hackathon activity generation fast lane

## Decision

Do not generate new mini-games. Keep the five reusable activity engines:

- Retrieval Check
- Scenario Decision
- Ordering / Matching
- Practice Task
- Rubric Answer

Ax should generate strict playable activity specs for those engines. React renders the same polished engines every time.

## Why

The product promise is better learning, not novelty. New generated game mechanics are unstable, hard to validate, and impossible to polish before the hackathon. Reusable engines can be validated, styled, explained, and tested with real learners.

## Eight-hour execution order

1. **First 45 minutes: repair gates.** Run the local check path. Fix compile/type/test drift only. Do not add new features while the app cannot demo.
2. **Next 60 minutes: tighten Ax instructions.** Strengthen the existing Ax output descriptions so generated activities must be self-contained, source-grounded, concrete, and feedback-rich.
3. **Next 90 minutes: add deterministic activity quality checks.** Reject vague prompts, assessor-only text, missing feedback, duplicate choices, no correct/preferred choice, and unsupported strict-source activities.
4. **Next 90 minutes: improve preview UX copy and feedback.** Keep the current engines but make the prompt, action, check button, and feedback panels obvious.
5. **Next 60 minutes: add demo fixtures.** Use one short onboarding/policy source and one practical technical source. Save stable expected activity outputs for the demo.
6. **Final 90 minutes: test with people.** Ask them to complete one course in preview. Record confusion, where they hesitate, whether feedback helps, and whether they want to continue.

## Ax usage direction

Use Ax as a workflow/spec generator:

```txt
source evidence
-> learning objective
-> activity brief
-> activity engine choice
-> playable activity spec
-> deterministic validation
-> narrow repair if validation fails
```

Do not use Ax as:

```txt
new UI generator
new game mechanic generator
unbounded JSON generator
one-shot course + activities + content generator
```

## AxFlow target architecture

Once the hackathon fire is under control, replace the one-shot blueprint call with an AxFlow:

```ts
import { flow } from '@ax-llm/ax';

const activityGenerationFlow = flow<
  {
    courseTitle: string;
    languageCode: string;
    existingPreparation: string;
    sourceEvidence: string;
  },
  {
    activitySpecsJson: string;
    repairNotes: string;
  }
>()
  .node('objectivePlanner', 'courseTitle:string, existingPreparation:string, sourceEvidence:string -> objectivesJson:string')
  .node('activityBriefPlanner', 'objectivesJson:string, sourceEvidence:string -> activityBriefsJson:string')
  .node('playableSpecWriter', 'activityBriefsJson:string, sourceEvidence:string -> activitySpecsJson:string')
  .node('activityCritic', 'activitySpecsJson:string -> qualityScore:number, repairNotes:string')
  .execute('objectivePlanner', (state) => ({
    courseTitle: state.courseTitle,
    existingPreparation: state.existingPreparation,
    sourceEvidence: state.sourceEvidence,
  }))
  .execute('activityBriefPlanner', (state) => ({
    objectivesJson: state.objectivePlannerResult.objectivesJson,
    sourceEvidence: state.sourceEvidence,
  }))
  .label('repair')
    .execute('playableSpecWriter', (state) => ({
      activityBriefsJson: state.activityBriefPlannerResult.activityBriefsJson,
      sourceEvidence: state.sourceEvidence,
    }))
    .execute('activityCritic', (state) => ({
      activitySpecsJson: state.playableSpecWriterResult.activitySpecsJson,
    }))
  .feedback((state) => state.activityCriticResult.qualityScore < 0.82, 'repair')
  .returns((state) => ({
    activitySpecsJson: state.playableSpecWriterResult.activitySpecsJson,
    repairNotes: state.activityCriticResult.repairNotes,
  }));
```

Use the flow for orchestration later. For the hackathon, the fastest safe change is better signatures + deterministic validators around the current Ax call.

## AxAgent later, not now

AxAgent is useful for a creator-facing activity coach after the demo:

- inspect an activity brief
- call a source lookup tool
- propose exactly one repair
- explain why the repair helps learning

Do not put an open-ended agent in the critical demo path today.

## Demo quality bar

A generated activity is demo-ready only if a real person can answer yes to all of these:

1. I know what to do within 5 seconds.
2. The challenge is related to the source/course.
3. The wrong answer feedback teaches me something.
4. I can retry or revise.
5. This feels like practice, not filler.

## Forbidden today

- new custom mini-game types
- generated React code
- leaderboard, badges, points, or streaks
- LLM grading
- GEPA optimization
- learner personalization
- large refactors
- database migration
- visual redesign
