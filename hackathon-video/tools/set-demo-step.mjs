// Attaches a Statistics demo draft (clone of the real seeded course) to the
// demo user and pins it to a given workflow step, so the running app renders
// that exact screen for screenshot capture.
//
// Usage: node hackathon-video/tools/set-demo-step.mjs <step>
//   step in: mode | sources | preparation | objectives | activityPlan | courseContent | preview

import fs from 'node:fs';

const STORE = '.coursition-data/workflow.json';
const SOURCE_DRAFT_ID = 'course_44037d63-aae2-4e66-afd5-fe88babe03a3';
const DEMO_DRAFT_ID = 'course_demostats00000000000000000001';
const OWNER_ID = 'ETfhy2qfe5DAqKgyMFefwko9LVkI2Ihu';

const VALID = [
  'mode',
  'sources',
  'preparation',
  'objectives',
  'activityPlan',
  'courseContent',
  'preview',
];

const [step] = process.argv.slice(2);
if (!VALID.includes(step)) {
  console.error(`Invalid step "${step}". Use one of: ${VALID.join(', ')}`);
  process.exit(1);
}

const store = JSON.parse(fs.readFileSync(STORE, 'utf-8'));
const source = store.drafts.find((d) => d.id === SOURCE_DRAFT_ID);
if (!source) {
  console.error(`Source draft ${SOURCE_DRAFT_ID} not found.`);
  process.exit(1);
}

// Deep clone the real draft, retarget owner + id, keep source storageReference
// (blob lookup is by reference path, not draftId, so the PDF still resolves).
const clone = structuredClone(source);
clone.id = DEMO_DRAFT_ID;
clone.ownerId = OWNER_ID;
clone.step = step;
clone.updatedAt = new Date().toISOString();

store.drafts = store.drafts.filter((d) => d.id !== DEMO_DRAFT_ID);
store.drafts.push(clone);

fs.writeFileSync(STORE, JSON.stringify(store, null, 2));
console.log(`Demo draft pinned to step "${step}" for owner ${OWNER_ID}.`);
console.log(`URL: /en/course-creation/${DEMO_DRAFT_ID}/<slug>`);
