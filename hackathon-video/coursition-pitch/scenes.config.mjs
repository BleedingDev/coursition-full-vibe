// =============================================================================
// Coursition pitch video — single source of truth.
//
// One config drives BOTH:
//   • tools/build-voiceover.mjs  -> assets/voiceover.mp3 + data/timeline.json
//   • tools/build-subtitles.mjs  -> coursition-pitch.en.srt (soft, toggleable)
//   • tools/build-html.mjs       -> index.html (static HyperFrames composition)
//
// Re-cut:  npm run build   (voiceover + subtitles + index.html)
//          npm run render  (MP4)   |   npm run package (render + soft subs)
//
// Markup convention: wrap a word in «guillemets» to give it the red marker
// underline, e.g. "Good learning is «hard»."
// =============================================================================

// Voiceover engine: "boson" (Higgs Audio v3, needs BOSON_API_KEY) or "say"
// (macOS placeholder fallback). Auto-falls back to "say" when no key is found.
export const TTS = {
  provider: process.env.TTS_PROVIDER || 'auto', // auto | boson | say
  bosonVoice: process.env.BOSON_TTS_VOICE || 'eleanor',
  bosonModel: 'higgs-audio-v3-tts',
  bosonEndpoint: 'https://api.boson.ai/v1/audio/speech',
  sayVoice: 'Daniel',
  sayRate: 178,
};

// Pacing (seconds) — tightened for a punchy cut.
export const PRE_ROLL = 0.25;
export const GAP_WITHIN_SCENE = 0.16;
export const GAP_BETWEEN_SCENES = 0.38;
export const POST_ROLL = 0.7;

// Editorial section labels shown top-right per scene.
export const SCENES = [
  {
    id: 'hook',
    type: 'hook',
    section: 'The premise',
    eyebrow: '36 hours · one risky bet',
    title: ['Course text is easy.', 'Good learning is «hard».'],
    lines: [{ id: 'hook-1', text: 'Course text is easy. Good learning is hard.' }],
  },
  {
    id: 'positioning',
    type: 'positioning',
    section: 'The category',
    eyebrow: 'Not another LMS',
    rivals: 'Teachable · Thinkific · Moodle',
    rivalsLabel: 'host & sell courses',
    headline: 'Coursition prepares the «learning».',
    pipeline: ['PDF / raw text', 'Objectives', 'Activities', 'Playable preview'],
    lines: [
      {
        id: 'pos-1',
        text: 'Teachable, Thinkific and Moodle host and sell courses. Coursition prepares the learning.',
      },
    ],
  },
  {
    id: 'fight',
    type: 'fight',
    section: 'The pivot',
    eyebrow: 'What I learned the hard way',
    headline: "The hard part wasn't content.",
    em: 'It was practice.',
    contrast: [
      { tone: 'bad', mark: '✕', label: 'AI, invent a fun mini-game' },
      { tone: 'good', mark: '✓', label: 'AI, fill a learning-activity contract' },
    ],
    lines: [
      {
        id: 'fight-1',
        text: 'I came in with a rough prototype and one risky bet: that A.I. could turn raw material into practice that actually teaches.',
      },
      {
        id: 'fight-2',
        text: 'Generating content is easy. Generating practice is hard. So I stopped asking the model for random mini-games.',
      },
    ],
  },
  {
    id: 'engines',
    type: 'engines',
    section: 'The engines',
    eyebrow: 'Constrained, not random',
    headline: 'Five reusable «engines».',
    engines: ['Retrieval check', 'Scenario decision', 'Ordering / matching', 'Practice task', 'Rubric answer'],
    lines: [
      {
        id: 'eng-1',
        text: 'It fills reusable activity engines: retrieval checks, scenario decisions, ordering, practice tasks, and rubric answers.',
      },
    ],
  },
  {
    id: 'demo',
    type: 'demo',
    section: 'The product',
    eyebrow: 'Source to practice',
    headline: 'One source. A whole course.',
    lines: [
      {
        id: 'demo-1',
        text: 'Add a source — here, a dense German statistics PDF.',
        shot: '02-sources.png',
        label: 'Add source',
      },
      {
        id: 'demo-2',
        text: 'Coursition drafts the course preparation,',
        shot: '03-preparation.png',
        label: 'Course preparation',
      },
      {
        id: 'demo-3',
        text: 'the learning objectives,',
        shot: '04-objectives.png',
        label: 'Objectives',
      },
      {
        id: 'demo-4',
        text: 'an activity plan built from those engines,',
        shot: '05-activity-plan.png',
        label: 'Activity plan',
      },
      {
        id: 'demo-5',
        text: 'and a playable preview, where content becomes practice.',
        shot: '06-preview-top.png',
        label: 'Playable preview',
      },
    ],
  },
  {
    id: 'result',
    type: 'result',
    section: 'Honest',
    eyebrow: 'Where it stands',
    title: ['Not sold.', 'Not finished.'],
    em: 'But the wedge is sharper.',
    next: ['2k newsletter', '10k on LinkedIn', 'Test source-to-activity'],
    lines: [
      {
        id: 'res-1',
        text: "It's not sold, and it's not finished. But the wedge is sharper. Next: real creators — two thousand on my newsletter, ten thousand on LinkedIn.",
      },
    ],
  },
  {
    id: 'close',
    type: 'close',
    section: 'Coursition',
    wordmark: 'Coursition',
    tagline: 'Course preparation for reusable, interactive learning.',
    lines: [
      {
        id: 'close-1',
        text: 'Coursition. Course preparation for reusable, interactive learning.',
      },
    ],
  },
];
