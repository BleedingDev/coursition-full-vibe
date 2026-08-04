import { describe, expect, test } from '@rstest/core';
import { Schema } from 'effect';
import * as HttpApiSchema from 'effect/unstable/httpapi/HttpApiSchema';
import {
  CoursitionWorkflowConflict,
  workflowActionSchema,
  workflowConflictSchema,
  workflowSnapshotSchema,
} from '../shared/api.ts';

const decodeAction = Schema.decodeUnknownSync(workflowActionSchema);
const decodeSnapshot = Schema.decodeUnknownSync(workflowSnapshotSchema);
const decodeConflict = Schema.decodeUnknownSync(CoursitionWorkflowConflict);

const emptySnapshot = () =>
  decodeSnapshot({
    config: {
      aiProviderConfigured: false,
      auth: 'better-auth',
      deepgramConfigured: false,
      llamaParseConfigured: false,
      storage: 'cloudflare-d1-r2',
      webExtractionConfigured: false,
    },
    draft: null,
    drafts: [],
    revision: 7,
  });

describe('Coursition revision and idempotency API contract', () => {
  test('requires the current draft revision for every draft mutation', () => {
    expect(() =>
      decodeAction({
        action: 'updateDraftTitle',
        draftId: 'course_1',
        title: 'New title',
      }),
    ).toThrow();

    expect(
      decodeAction({
        action: 'updateDraftTitle',
        draftId: 'course_1',
        expectedRevision: 4,
        title: 'New title',
      }),
    ).toMatchObject({ expectedRevision: 4 });
  });

  test('requires one stable operation identity for non-repeatable work', () => {
    expect(() =>
      decodeAction({
        action: 'generateCourse',
        draftId: 'course_1',
        expectedRevision: 4,
      }),
    ).toThrow();

    expect(
      decodeAction({
        action: 'generateCourse',
        draftId: 'course_1',
        expectedRevision: 4,
        operationId: 'operation_1',
      }),
    ).toMatchObject({ operationId: 'operation_1' });

    expect(
      decodeAction({
        action: 'advanceDraft',
        draftId: 'course_1',
        expectedRevision: 4,
        operationId: 'operation_2',
        step: 'sources',
      }),
    ).toMatchObject({ action: 'advanceDraft', operationId: 'operation_2' });
  });

  test('carries a monotonic owner revision on every workflow snapshot', () => {
    expect(emptySnapshot().revision).toBe(7);
    expect(() =>
      decodeSnapshot({
        config: emptySnapshot().config,
        draft: null,
        drafts: [],
      }),
    ).toThrow();
  });

  test('exposes a typed 409 with the authoritative current snapshot', () => {
    const currentSnapshot = emptySnapshot();
    const conflict = decodeConflict({
      _tag: 'CoursitionWorkflowConflict',
      currentRevision: 9,
      currentSnapshot,
      draftId: 'course_1',
      expectedRevision: 8,
      message: 'The course changed in another request.',
    });

    expect(conflict.currentSnapshot.revision).toBe(7);
    expect(conflict.currentRevision).toBe(9);
    expect(HttpApiSchema.getStatusError(workflowConflictSchema.ast)).toBe(409);
  });
});
