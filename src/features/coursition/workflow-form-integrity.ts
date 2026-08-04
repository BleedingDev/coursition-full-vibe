import type { ActivityType, SourceType } from '@shared/coursition/workflow';
import type { CoursePreparation, WorkflowSnapshot } from '@shared/api';
import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';

type CourseDraft = NonNullable<WorkflowSnapshot['draft']>;

export interface EditBuffer<Value> {
  readonly baseRevision: number;
  readonly dirty: boolean;
  readonly value: Value;
  readonly version: number;
}

export interface ObjectiveEditValue {
  readonly capability: string;
  readonly title: string;
}

export interface ActivityBriefEditValue {
  readonly feedbackGuidance: string;
  readonly instructions: string;
  readonly learnerAction: string;
  readonly successCriteria: string;
  readonly title: string;
  readonly type: ActivityType;
}

export interface SourceFormDraft {
  readonly content: string;
  readonly file: File | null;
  readonly fileNameOwnership: 'automatic' | 'user';
  readonly fileSelectionLost: boolean;
  readonly name: string;
  readonly version: number;
}

export type SourceFormDrafts = Record<SourceType, SourceFormDraft>;

export interface TransientDraftState {
  readonly activityBriefs: Readonly<Record<string, EditBuffer<ActivityBriefEditValue>>>;
  readonly courseTitle: EditBuffer<string>;
  readonly objectives: Readonly<Record<string, EditBuffer<ObjectiveEditValue>>>;
  readonly preparation: EditBuffer<CoursePreparation>;
  readonly sources: SourceFormDrafts;
}

type SaveTask = () => Promise<boolean>;

interface PendingSave {
  readonly cancel: () => void;
  readonly task: SaveTask;
}

export class PendingDraftSaveRegistry {
  readonly #pending = new Map<string, PendingSave>();
  readonly #running = new Map<string, Promise<boolean>>();

  get hasPending(): boolean {
    return this.#pending.size > 0 || this.#running.size > 0;
  }

  schedule(key: string, task: SaveTask, delayMs: number): void {
    const previous = this.#pending.get(key);
    if (previous !== undefined) {
      previous.cancel();
    }
    let timerStartedFlush = false;
    const timerFiber = Effect.runFork(
      Effect.sleep(delayMs).pipe(
        Effect.tap(() =>
          Effect.sync(() => {
            timerStartedFlush = true;
          }),
        ),
        Effect.flatMap(() => Effect.promise(() => this.flush(key))),
        Effect.asVoid,
      ),
    );
    this.#pending.set(key, {
      cancel: () => {
        if (!timerStartedFlush) {
          Effect.runFork(timerFiber.pipe(Fiber.interrupt));
        }
      },
      task,
    });
  }

  flush(key: string): Promise<boolean> {
    const running = this.#running.get(key);
    if (running !== undefined) {
      return running.then((runningSucceeded) =>
        this.#pending.has(key) || this.#running.has(key)
          ? this.flush(key).then((nextSucceeded) => runningSucceeded && nextSucceeded)
          : runningSucceeded,
      );
    }
    const pending = this.#pending.get(key);
    if (pending === undefined) {
      return Promise.resolve(true);
    }
    pending.cancel();
    this.#pending.delete(key);
    const save = pending.task().catch(() => false);
    this.#running.set(key, save);
    return save
      .finally(() => {
        if (this.#running.get(key) === save) {
          this.#running.delete(key);
        }
      })
      .then((saveSucceeded) => {
        const newerPending = this.#pending.get(key);
        if (!saveSucceeded && newerPending === undefined) {
          this.#pending.set(key, pending);
          return false;
        }
        if (newerPending === undefined) {
          return saveSucceeded;
        }
        return this.flush(key).then((nextSucceeded) => saveSucceeded && nextSucceeded);
      });
  }

  flushAll(): Promise<boolean> {
    const keys = new Set([...this.#pending.keys(), ...this.#running.keys()]);
    if (keys.size === 0) {
      return Promise.resolve(true);
    }
    return Promise.all([...keys].map((key) => this.flush(key))).then((outcomes) => {
      const succeeded = outcomes.every(Boolean);
      if (!succeeded) {
        return false;
      }
      return this.hasPending ? this.flushAll() : true;
    });
  }
}

export class ExclusiveActionGate {
  #activeToken: string | null = null;

  acquire(token: string): boolean {
    if (this.#activeToken !== null) {
      return false;
    }
    this.#activeToken = token;
    return true;
  }

  release(token: string): void {
    if (this.#activeToken === token) {
      this.#activeToken = null;
    }
  }
}

export const coursitionPendingDraftSaves = new PendingDraftSaveRegistry();

export const flushAllPendingCoursitionDraftSaves = () => coursitionPendingDraftSaves.flushAll();

export const focusLeftContainer = (
  container: { readonly contains: (node: Node | null) => boolean },
  nextFocusedElement: EventTarget | null,
) => !(nextFocusedElement instanceof Node && container.contains(nextFocusedElement));

export const editBuffer = <Value>(value: Value, baseRevision: number): EditBuffer<Value> => ({
  baseRevision,
  dirty: false,
  value,
  version: 0,
});

export const updateEditBuffer = <Value>(
  current: EditBuffer<Value>,
  value: Value,
): EditBuffer<Value> => ({
  ...current,
  dirty: true,
  value,
  version: current.version + 1,
});

export const reconcileEditBuffer = <Value>(
  current: EditBuffer<Value>,
  serverValue: Value,
  serverRevision: number,
  isEqual: (left: Value, right: Value) => boolean = Object.is,
): EditBuffer<Value> => {
  if (current.dirty) {
    return current;
  }
  if (current.baseRevision === serverRevision && isEqual(current.value, serverValue)) {
    return current;
  }
  return editBuffer(serverValue, serverRevision);
};

export const commitEditBuffer = <Value>(
  current: EditBuffer<Value>,
  submittedVersion: number,
  committedValue: Value,
  committedRevision: number,
): EditBuffer<Value> =>
  current.version === submittedVersion ? editBuffer(committedValue, committedRevision) : current;

export const emptySourceFormDraft = (version = 0): SourceFormDraft => ({
  content: '',
  file: null,
  fileNameOwnership: 'automatic',
  fileSelectionLost: false,
  name: '',
  version,
});

export const emptySourceFormDrafts = (): SourceFormDrafts => ({
  file: emptySourceFormDraft(),
  notes: emptySourceFormDraft(),
  url: emptySourceFormDraft(),
});

export const updateSourceFormDraft = (
  drafts: SourceFormDrafts,
  type: SourceType,
  changes: Partial<Omit<SourceFormDraft, 'version'>>,
): SourceFormDrafts => ({
  ...drafts,
  [type]: {
    ...drafts[type],
    ...changes,
    version: drafts[type].version + 1,
  },
});

export const updateSourceName = (
  drafts: SourceFormDrafts,
  type: SourceType,
  name: string,
): SourceFormDrafts =>
  updateSourceFormDraft(drafts, type, {
    fileNameOwnership: type === 'file' ? 'user' : drafts[type].fileNameOwnership,
    name,
  });

export const selectSourceFile = (drafts: SourceFormDrafts, file: File | null): SourceFormDrafts => {
  const current = drafts.file;
  return updateSourceFormDraft(drafts, 'file', {
    file,
    fileSelectionLost: false,
    name: current.fileNameOwnership === 'automatic' ? (file?.name ?? '') : current.name,
  });
};

export const resetSubmittedSourceDraft = (
  drafts: SourceFormDrafts,
  type: SourceType,
  submittedVersion: number,
): SourceFormDrafts =>
  drafts[type].version === submittedVersion
    ? {
        ...drafts,
        [type]: emptySourceFormDraft(submittedVersion + 1),
      }
    : drafts;

export const addedSourceAfterSubmission = <
  Source extends { readonly id: string; readonly name: string; readonly type: SourceType },
>(
  previousSourceIds: ReadonlySet<string>,
  sources: readonly Source[],
  submittedType: SourceType,
  submittedName: string,
): Source | null =>
  sources.find(
    (source) =>
      !previousSourceIds.has(source.id) &&
      source.type === submittedType &&
      source.name === submittedName,
  ) ?? null;

export const restorableSourceFormDrafts = (drafts: SourceFormDrafts): SourceFormDrafts => ({
  ...drafts,
  file: {
    ...drafts.file,
    file: null,
    fileSelectionLost: drafts.file.file !== null || drafts.file.fileSelectionLost,
    name: drafts.file.fileNameOwnership === 'automatic' ? '' : drafts.file.name,
  },
});

const objectiveValuesFor = (draft: CourseDraft, normalizeText: (value: string) => string) =>
  Object.fromEntries(
    draft.learningBlueprint.objectives.map((objective) => [
      objective.id,
      editBuffer(
        { capability: normalizeText(objective.capability), title: objective.title },
        draft.revision,
      ),
    ]),
  );

const activityBriefValuesFor = (draft: CourseDraft, normalizeText: (value: string) => string) =>
  Object.fromEntries(
    draft.learningBlueprint.activityBriefs.map((brief) => [
      brief.id,
      editBuffer(
        {
          feedbackGuidance: normalizeText(brief.feedbackGuidance),
          instructions: normalizeText(brief.instructions),
          learnerAction: normalizeText(brief.learnerAction),
          successCriteria: normalizeText(brief.successCriteria),
          title: brief.title,
          type: brief.type,
        },
        draft.revision,
      ),
    ]),
  );

export const transientDraftStateFor = (
  draft: CourseDraft,
  normalizeText: (value: string) => string = (value) => value,
): TransientDraftState => ({
  activityBriefs: activityBriefValuesFor(draft, normalizeText),
  courseTitle: editBuffer(draft.title, draft.revision),
  objectives: objectiveValuesFor(draft, normalizeText),
  preparation: editBuffer(draft.learningBlueprint.coursePreparation, draft.revision),
  sources: emptySourceFormDrafts(),
});

export const transientDraftCacheKey = (ownerId: string, draftId: string) => `${ownerId}:${draftId}`;

export const restorableTransientDraftState = (state: TransientDraftState): TransientDraftState => ({
  ...state,
  sources: restorableSourceFormDrafts(state.sources),
});
