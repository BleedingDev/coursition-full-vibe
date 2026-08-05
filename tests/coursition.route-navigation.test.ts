import { describe, expect, test } from '@rstest/core';
import * as Schema from 'effect/Schema';

import { workflowSnapshotSchema } from '../shared/api.ts';
import { emptyCourseContent, emptyLearningBlueprint } from '../shared/coursition/workflow.ts';
import type { DraftStep } from '../shared/coursition/workflow.ts';
import {
  preferredNavigationStep,
  routeRedirectStepFor,
  sourceFileAccept,
} from '../src/features/coursition/coursition-workflow-app.tsx';

const decodeSnapshot = Schema.decodeUnknownSync(workflowSnapshotSchema);

type CourseDraft = NonNullable<ReturnType<typeof decodeSnapshot>['draft']>;

const timestamp = '2026-08-05T00:00:00.000Z';

const processedSource = (id: string) => ({
  content: 'Readable source material for the course.',
  createdAt: timestamp,
  id,
  name: id,
  processor: 'local_text',
  sizeLabel: '39 chars',
  status: 'processed',
  type: 'file',
});

const draftAt = ({
  mode = 'assist',
  sourceProcessingIncomplete = false,
  sources = [] as readonly ReturnType<typeof processedSource>[],
  step,
}: {
  mode?: 'assist' | 'generate';
  sourceProcessingIncomplete?: boolean;
  sources?: readonly ReturnType<typeof processedSource>[];
  step: DraftStep;
}): CourseDraft => {
  const snapshot = decodeSnapshot({
    config: {
      aiProviderConfigured: false,
      auth: 'better-auth',
      deepgramConfigured: false,
      llamaParseConfigured: false,
      storage: 'cloudflare-d1-r2',
      webExtractionConfigured: false,
    },
    draft: {
      aiRuns: [],
      courseContent: emptyCourseContent(),
      createdAt: timestamp,
      derivedSourceDocuments: [],
      findings: [],
      id: 'course_1',
      knowledgeChunks: [],
      language: 'en',
      learningBlueprint: emptyLearningBlueprint('en'),
      mode,
      ownerId: 'owner_1',
      revision: 1,
      sourceProcessingIncomplete,
      sources,
      step,
      title: 'Course one',
      updatedAt: timestamp,
    },
    drafts: [],
    revision: 1,
  });
  if (snapshot.draft === null) {
    throw new Error('The fixture snapshot must carry a draft.');
  }
  return snapshot.draft;
};

describe('Coursition URL-driven step navigation', () => {
  test('keeps the routed step when a mutation response reports an earlier merged step', () => {
    /* The regression: the first source upload on a freshly created course
     * returned a snapshot merged back to `mode` while the URL sat on `sources`,
     * and the app navigated to the returned step. */
    const draft = draftAt({ sources: [processedSource('source_1')], step: 'mode' });

    expect(preferredNavigationStep(draft, 'sources')).toBe('sources');
  });

  test('keeps the routed step while an uploaded source is still processing', () => {
    const draft = draftAt({
      sourceProcessingIncomplete: true,
      sources: [processedSource('source_1')],
      step: 'mode',
    });

    expect(preferredNavigationStep(draft, 'sources')).toBe('sources');
    expect(routeRedirectStepFor(draft, 'sources')).toBeNull();
  });

  test('follows a genuine server advance beyond the routed step', () => {
    const draft = draftAt({ sources: [processedSource('source_1')], step: 'preparation' });

    expect(preferredNavigationStep(draft, 'sources')).toBe('preparation');
  });

  test('refuses a routed step the draft cannot reach', () => {
    const draft = draftAt({ step: 'mode' });

    expect(preferredNavigationStep(draft, 'objectives')).toBe('mode');
  });

  test('falls back to the returned step when no course route is active', () => {
    const draft = draftAt({ step: 'sources' });

    expect(preferredNavigationStep(draft, null)).toBe('sources');
  });

  test('never redirects away from a reachable routed step', () => {
    const draft = draftAt({ sources: [processedSource('source_1')], step: 'mode' });

    expect(routeRedirectStepFor(draft, 'sources')).toBeNull();
    expect(routeRedirectStepFor(draft, 'mode')).toBeNull();
  });

  test('redirects an unreachable routed step to the step that blocks it', () => {
    const draft = draftAt({ step: 'mode' });

    expect(routeRedirectStepFor(draft, 'objectives')).toBe('sources');
  });

  test('redirects a generate-mode preview that has no generated course', () => {
    const draft = draftAt({
      mode: 'generate',
      sources: [processedSource('source_1')],
      step: 'sources',
    });

    expect(routeRedirectStepFor(draft, 'preview')).toBe('sources');
  });
});

describe('Coursition source file input', () => {
  const acceptedTokens = sourceFileAccept.split(',');

  test('accepts every document format the server can convert', () => {
    expect(acceptedTokens).toContain('application/pdf');
    expect(acceptedTokens).toContain('application/msword');
    expect(acceptedTokens).toContain(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    expect(acceptedTokens).toContain('application/vnd.ms-powerpoint');
    expect(acceptedTokens).toContain(
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    );
    expect(acceptedTokens).toContain('application/vnd.oasis.opendocument.text');
  });

  test('accepts every format the browser AnyDoc conversion produces', () => {
    for (const extension of [
      '.csv',
      '.doc',
      '.docx',
      '.epub',
      '.odp',
      '.ods',
      '.odt',
      '.pdf',
      '.ppt',
      '.pptx',
      '.rtf',
      '.xlsx',
    ]) {
      expect(acceptedTokens).toContain(extension);
    }
  });

  test('accepts the media and text families the server processes', () => {
    expect(acceptedTokens).toContain('audio/*');
    expect(acceptedTokens).toContain('video/*');
    expect(acceptedTokens).toContain('image/*');
    expect(acceptedTokens).toContain('text/*');
    expect(acceptedTokens).toContain('application/json');
    expect(acceptedTokens).toContain('application/xml');
    expect(acceptedTokens).toContain('application/yaml');
    expect(acceptedTokens).toContain('application/rtf');
  });

  test('carries no blank or duplicated token', () => {
    expect(acceptedTokens.every((token) => token.trim() === token && token.length > 0)).toBe(true);
    expect(new Set(acceptedTokens).size).toBe(acceptedTokens.length);
  });
});
