// =============================================================================
// Coursition pitch video — single source of truth.
//
// This one config drives BOTH:
//   • tools/build-voiceover.mjs  -> assets/voiceover.mp3 + data/timeline.json
//   • tools/build-html.mjs       -> index.html (static HyperFrames composition)
//
// To re-cut the video: edit copy / narration / screenshots below, then run:
//   npm run build      (regenerates voiceover + timeline + index.html)
//   npm run dev        (preview)   |   npm run render   (MP4)
//
// Keep narration short. Keep slides quiet. Let the product carry it.
// =============================================================================

// macOS `say` voice used for the PLACEHOLDER voiceover. Swap for a real
// founder VO later by dropping a file at assets/voiceover.mp3 and skipping
// the voiceover build step. See README.
export const VOICE = 'Daniel';
// Words per minute for `say`.
export const SPEAKING_RATE = 178;

// Pacing (seconds). Tweak to taste; everything else re-flows automatically.
// Silence before first word.
export const PRE_ROLL = 0.6;
// Pause between lines in the same scene.
export const GAP_WITHIN_SCENE = 0.32;
// Pause when the scene changes.
export const GAP_BETWEEN_SCENES = 0.7;
// Tail after the last word.
export const POST_ROLL = 1.1;

// -----------------------------------------------------------------------------
// Scenes. Each `line` becomes one synthesized clip; captions + visuals are
// timed to it. `shot` (optional) is a screenshot file under assets/screens/.
// -----------------------------------------------------------------------------
export const SCENES = [
  {
    eyebrow: '36 HOURS · ONE RISKY BET',
    id: 'hook',
    lines: [{ id: 'hook-1', text: 'Course text is easy. Good learning is hard.' }],
    title: ['Course text is easy.', 'Good learning is hard.'],
    type: 'hook',
  },
  {
    id: 'positioning',
    kicker: 'They host courses. Coursition prepares learning.',
    lines: [
      {
        id: 'pos-1',
        text: 'Teachable, Thinkific, and Moodle help you host and sell courses. Coursition helps you prepare better learning.',
      },
    ],
    pipeline: ['PDF / raw text', 'Objectives', 'Activities', 'Playable preview'],
    rivals: ['Teachable', 'Thinkific', 'Moodle'],
    type: 'positioning',
  },
  {
    contrast: [
      { label: 'AI, invent a fun mini-game', mark: '✕', tone: 'bad' },
      { label: 'AI, fill a learning-activity contract', mark: '✓', tone: 'good' },
    ],
    id: 'fight',
    lines: [
      {
        id: 'fight-1',
        text: 'I came in with a rough prototype and one risky bet: that A.I. could turn source material into activities that actually help people learn.',
      },
      {
        id: 'fight-2',
        text: 'The surprise? Generating content is easy. Generating practice is hard. So I stopped asking the model to invent random mini-games.',
      },
    ],
    title: 'The hard part was not content.',
    type: 'fight',
  },
  {
    engines: [
      'Retrieval Check',
      'Scenario Decision',
      'Ordering / Matching',
      'Practice Task',
      'Rubric Answer',
    ],
    id: 'engines',
    lines: [
      {
        id: 'eng-1',
        text: 'Instead, it fills reusable activity engines: retrieval checks, scenario decisions, ordering and matching, practice tasks, and rubric answers.',
      },
    ],
    note: 'Constrained activities are easier to validate, improve, and teach with.',
    title: 'Reusable activity engines',
    type: 'engines',
  },
  {
    id: 'demo',
    lines: [
      {
        id: 'demo-1',
        label: 'Add source · real PDF',
        shot: '02-sources.png',
        text: 'Here is the flow. Choose how much help you want, then add a source — a dense German statistics PDF.',
      },
      {
        id: 'demo-2',
        label: 'Course preparation',
        shot: '03-preparation.png',
        text: 'Coursition writes the course preparation — who it is for and what they should be able to do.',
      },
      {
        id: 'demo-3',
        label: 'Learning objectives',
        shot: '04-objectives.png',
        text: 'It maps the learning objectives,',
      },
      {
        id: 'demo-4',
        label: 'Activity plan',
        shot: '05-activity-plan.png',
        text: 'and an activity plan, where every activity is one of those reusable engines.',
      },
      {
        id: 'demo-5',
        label: 'Playable preview',
        shot: '06-preview-top.png',
        text: 'Then a playable preview — where the course stops being text and becomes practice.',
      },
    ],
    title: 'Source material to practice',
    type: 'demo',
  },
  {
    id: 'result',
    lines: [
      {
        id: 'res-1',
        text: 'It is not sold yet, and it is not finished. But the wedge is sharper. Next, I test it with real creators — two thousand on my newsletter, ten thousand on LinkedIn.',
      },
    ],
    next: [
      '2k newsletter subscribers',
      '10k LinkedIn network',
      'Test: source-to-activity vs blank builders',
    ],
    title: 'Not sold yet. Not finished. But sharper.',
    type: 'result',
  },
  {
    id: 'close',
    lines: [
      {
        id: 'close-1',
        text: 'Coursition. AI-native course preparation for reusable, interactive learning.',
      },
    ],
    tagline: 'AI-native course preparation for reusable interactive learning.',
    type: 'close',
    wordmark: 'Coursition',
  },
];
