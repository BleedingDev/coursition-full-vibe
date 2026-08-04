/* eslint-disable promise/avoid-new, unicorn/consistent-function-scoping -- Deferred saves make the in-flight race ordering deterministic. */
import { describe, expect, test } from '@rstest/core';

import {
  addedSourceAfterSubmission,
  commitEditBuffer,
  editBuffer,
  emptySourceFormDrafts,
  ExclusiveActionGate,
  focusLeftContainer,
  PendingDraftSaveRegistry,
  reconcileEditBuffer,
  resetSubmittedSourceDraft,
  restorableSourceFormDrafts,
  selectSourceFile,
  transientDraftCacheKey,
  updateEditBuffer,
  updateSourceFormDraft,
  updateSourceName,
} from '../src/features/coursition/workflow-form-integrity.ts';

const nextMicrotask = () => Promise.resolve().then(() => {});

describe('Coursition form integrity', () => {
  test('keeps each source tab draft independent', () => {
    const notesEdited = updateSourceFormDraft(emptySourceFormDrafts(), 'notes', {
      content: 'Workshop notes',
      name: 'Notes',
    });
    const urlEdited = updateSourceFormDraft(notesEdited, 'url', {
      content: 'https://example.com',
      name: 'Reference',
    });

    expect(urlEdited.notes).toMatchObject({ content: 'Workshop notes', name: 'Notes' });
    expect(urlEdited.url).toMatchObject({ content: 'https://example.com', name: 'Reference' });
  });

  test('does not clear newer source input when an older submit finishes', () => {
    const submitted = updateSourceFormDraft(emptySourceFormDrafts(), 'notes', {
      content: 'First notes',
      name: 'First',
    });
    const submittedVersion = submitted.notes.version;
    const typedDuringRequest = updateSourceFormDraft(submitted, 'notes', {
      content: 'Second notes',
      name: 'Second',
    });

    const afterOlderSuccess = resetSubmittedSourceDraft(
      typedDuringRequest,
      'notes',
      submittedVersion,
    );
    expect(afterOlderSuccess.notes).toMatchObject({ content: 'Second notes', name: 'Second' });
    expect(resetSubmittedSourceDraft(submitted, 'notes', submittedVersion).notes.content).toBe('');
  });

  test('updates only automatic file names and never restores file bytes', () => {
    const firstFile = new File(['first'], 'first.pdf', { type: 'application/pdf' });
    const secondFile = new File(['second'], 'second.pdf', { type: 'application/pdf' });
    const automatic = selectSourceFile(emptySourceFormDrafts(), firstFile);
    expect(automatic.file.name).toBe('first.pdf');

    const userNamed = updateSourceName(automatic, 'file', 'Workshop handout');
    const replaced = selectSourceFile(userNamed, secondFile);
    expect(replaced.file.name).toBe('Workshop handout');
    expect(replaced.file.file).toBe(secondFile);

    const restored = restorableSourceFormDrafts(replaced);
    expect(restored.file.file).toBeNull();
    expect(restored.file.fileSelectionLost).toBe(true);
    expect(restored.file.name).toBe('Workshop handout');
  });

  test('clears the submitted file selection but preserves a newer replacement', () => {
    const firstFile = new File(['first'], 'first.pdf', { type: 'application/pdf' });
    const secondFile = new File(['second'], 'second.pdf', { type: 'application/pdf' });
    const submitted = selectSourceFile(emptySourceFormDrafts(), firstFile);
    const submittedVersion = submitted.file.version;

    const cleared = resetSubmittedSourceDraft(submitted, 'file', submittedVersion);
    expect(cleared.file).toMatchObject({ file: null, name: '' });
    expect(cleared.file.version).toBe(submittedVersion + 1);

    const replacedDuringRequest = selectSourceFile(submitted, secondFile);
    const afterOlderSuccess = resetSubmittedSourceDraft(
      replacedDuringRequest,
      'file',
      submittedVersion,
    );
    expect(afterOlderSuccess.file.file).toBe(secondFile);
    expect(afterOlderSuccess.file.name).toBe('second.pdf');
  });

  test('identifies the persisted result for the submitted source only', () => {
    const previousSourceIds = new Set(['source-existing']);
    const sources = [
      { id: 'source-existing', name: 'Existing.pdf', type: 'file' as const },
      { id: 'source-other', name: 'Other notes', type: 'notes' as const },
      { id: 'source-added', name: 'Guide.pdf', type: 'file' as const },
    ];

    expect(addedSourceAfterSubmission(previousSourceIds, sources, 'file', 'Guide.pdf')).toEqual(
      sources[2],
    );
    expect(
      addedSourceAfterSubmission(previousSourceIds, sources, 'file', 'Missing.pdf'),
    ).toBeNull();
  });

  test('preserves dirty edits across server revisions and syncs pristine buffers', () => {
    const pristine = editBuffer('Server v1', 1);
    expect(reconcileEditBuffer(pristine, 'Server v2', 2)).toMatchObject({
      baseRevision: 2,
      dirty: false,
      value: 'Server v2',
    });

    const dirty = updateEditBuffer(pristine, 'Local edit');
    expect(reconcileEditBuffer(dirty, 'Server v2', 2)).toBe(dirty);
    expect(commitEditBuffer(dirty, dirty.version - 1, 'Older response', 2)).toBe(dirty);
    expect(commitEditBuffer(dirty, dirty.version, 'Committed edit', 3)).toMatchObject({
      baseRevision: 3,
      dirty: false,
      value: 'Committed edit',
    });
  });

  test('debounces a key and flushes the newest scheduled value before navigation', async () => {
    const registry = new PendingDraftSaveRegistry();
    const saved: string[] = [];
    registry.schedule(
      'course:title',
      () => {
        saved.push('old');
        return Promise.resolve(true);
      },
      10_000,
    );
    registry.schedule(
      'course:title',
      () => {
        saved.push('new');
        return Promise.resolve(true);
      },
      10_000,
    );

    expect(await registry.flushAll()).toBe(true);
    expect(saved).toEqual(['new']);
  });

  test('runs a newer save queued while the previous save is in flight', async () => {
    const registry = new PendingDraftSaveRegistry();
    const saved: string[] = [];
    let releaseFirst = () => {};
    const firstFinished = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    registry.schedule(
      'course:objective',
      async () => {
        saved.push('first');
        await firstFinished;
        return true;
      },
      10_000,
    );
    const flushing = registry.flush('course:objective');
    await nextMicrotask();
    registry.schedule(
      'course:objective',
      () => {
        saved.push('second');
        return Promise.resolve(true);
      },
      10_000,
    );
    releaseFirst();

    expect(await flushing).toBe(true);
    expect(saved).toEqual(['first', 'second']);
  });

  test('retains a failed save so a second transition retries before navigation', async () => {
    const registry = new PendingDraftSaveRegistry();
    let attempts = 0;
    registry.schedule(
      'course:preparation',
      () => {
        attempts += 1;
        return Promise.resolve(attempts > 1);
      },
      10_000,
    );

    expect(await registry.flushAll()).toBe(false);
    expect(registry.hasPending).toBe(true);
    expect(attempts).toBe(1);

    expect(await registry.flushAll()).toBe(true);
    expect(registry.hasPending).toBe(false);
    expect(attempts).toBe(2);
  });

  test('does not save when focus moves between fields inside one panel', () => {
    const panel = document.createElement('div');
    const first = document.createElement('input');
    const second = document.createElement('textarea');
    panel.append(first, second);

    expect(focusLeftContainer(panel, second)).toBe(false);
    expect(focusLeftContainer(panel, document.body)).toBe(true);
  });

  test('serializes conflicting actions and uses a locale-independent transient key', () => {
    const gate = new ExclusiveActionGate();
    expect(gate.acquire('generation')).toBe(true);
    expect(gate.acquire('delete')).toBe(false);
    gate.release('delete');
    expect(gate.acquire('retry')).toBe(false);
    gate.release('generation');
    expect(gate.acquire('retry')).toBe(true);

    expect(transientDraftCacheKey('owner_1', 'course_1')).toBe('owner_1:course_1');
  });
});
