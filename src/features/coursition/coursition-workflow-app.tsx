/* eslint-disable jsx-a11y/no-noninteractive-element-interactions, unicorn/require-post-message-target-origin -- Objective and activity forms autosave at the form boundary; BroadcastChannel.postMessage has no target-origin parameter. */
import { Badge } from '@techsio/ui-kit/atoms/badge';
import { Button } from '@techsio/ui-kit/atoms/button';
import { Icon } from '@techsio/ui-kit/atoms/icon';
import { Input } from '@techsio/ui-kit/atoms/input';
import { Accordion } from '@techsio/ui-kit/molecules/accordion';
import { FormCheckbox } from '@techsio/ui-kit/molecules/form-checkbox';
import { FormInput } from '@techsio/ui-kit/molecules/form-input';
import { FormTextarea } from '@techsio/ui-kit/molecules/form-textarea';
import { RadioCard } from '@techsio/ui-kit/molecules/radio-card';
import { Steps } from '@techsio/ui-kit/molecules/steps';
import { Tabs } from '@techsio/ui-kit/molecules/tabs';
import { Toaster, useToast } from '@techsio/ui-kit/molecules/toast';
import { SelectTemplate } from '@techsio/ui-kit/templates/select';
import * as Cause from 'effect/Cause';
import * as Data from 'effect/Data';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Option from 'effect/Option';
import * as Schema from 'effect/Schema';
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ChangeEvent, FocusEvent, FormEvent } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import effectBff from '@api/index';
import { ConfirmDeleteButton } from '@/features/coursition/confirm-delete-button';
import type {
  ActivityEvaluationResponse,
  AiMode,
  CourseLanguagePreference,
  DraftStep,
  SourceAsset,
  SourceType,
} from '@shared/coursition/workflow';
import {
  activityTypes,
  emptyCoursePreparation,
  getWorkflowPreviewGate,
  getWorkflowStepGate,
  hasCourseContent as draftHasCourseContent,
  hasCoursePreparation as draftHasCoursePreparation,
  hasGeneratedCourse as draftHasGeneratedCourse,
  hasObjectiveMap as draftHasObjectiveMap,
  hasPlayableGeneratedActivityCoverage as draftHasPlayableGeneratedActivityCoverage,
  hasUsableSourceMaterial,
  workflowStepIndex,
  workflowSteps,
} from '@shared/coursition/workflow';
import type {
  AnydocExtraction,
  CoursePreparation,
  SessionUser,
  WorkflowAction,
  WorkflowSnapshot,
} from '@shared/api';
import {
  activityEvaluationRequestSchema,
  activityEvaluationResponseSchema,
  CoursitionWorkflowConflict,
  coursePreparationSchema,
  MAX_SOURCE_FILE_BYTES,
  sessionPayloadSchema,
  workflowActionSchema,
  workflowSnapshotSchema,
} from '@shared/api';
import { authRoutePath, courseRoutePattern, courseRouteStepSlug } from '@shared/coursition/routes';
import type { CoursitionWorkflowAppProps } from './coursition-workflow-app.types';
import { extractAnydocFromFile } from './anydoc-extraction';
import { CoursitionLoadingView } from './coursition-loading-view';
import { sessionRedirectPathFor, snapshotLoadStatusFor, snapshotRouteKeyFor } from './route-state';
import type { Translate } from './translation';
import {
  addedSourceAfterSubmission,
  commitEditBuffer,
  coursitionPendingDraftSaves,
  editBuffer,
  emptySourceFormDrafts,
  ExclusiveActionGate,
  focusLeftContainer,
  reconcileEditBuffer,
  resetSubmittedSourceDraft,
  restorableTransientDraftState,
  selectSourceFile,
  transientDraftCacheKey,
  transientDraftStateFor,
  updateEditBuffer,
  updateSourceFormDraft as updateVersionedSourceFormDraft,
  updateSourceName,
} from './workflow-form-integrity';
import type {
  ActivityBriefEditValue,
  EditBuffer,
  ObjectiveEditValue,
  SourceFormDraft,
  SourceFormDrafts,
  TransientDraftState,
} from './workflow-form-integrity';
import { updateModeWithoutNavigation } from './workflow-navigation';
import {
  browserOperationId,
  initialSessionStateFor,
  shouldRevalidateWorkflow,
  WorkflowTransportError,
  workflowInvalidationKindForSession,
  workflowRequestCoordinatorForBrowser,
} from './workflow-request-coordinator';
import type { WorkflowActionIntent, WorkflowConflictPayload } from './workflow-request-coordinator';

type BusyAction = WorkflowAction['action'] | 'auth' | 'file';
type CourseDraft = NonNullable<WorkflowSnapshot['draft']>;
type AiRun = CourseDraft['aiRuns'][number];
type GeneratedActivity = CourseDraft['learningBlueprint']['generatedActivities'][number];
type WorkflowRunner = (action: WorkflowActionIntent, shouldNavigate?: boolean) => void;
type InputChangeEvent = ChangeEvent<HTMLInputElement>;
type TextareaChangeEvent = ChangeEvent<HTMLTextAreaElement>;
interface SnapshotLoadError {
  readonly message: string;
  readonly routeKey: string;
}

interface FileSourceFeedback {
  readonly kind: 'error' | 'pending';
  readonly message: string;
}

interface CoursitionBrowserRuntimeCache {
  channel: BroadcastChannel | null;
  clientId: string;
  sessionUser: SessionUser | null;
  snapshot: WorkflowSnapshot | null;
  transientDrafts: Map<string, TransientDraftState>;
}

interface CoursitionCacheWindow extends Window {
  __coursitionRuntimeCache?: CoursitionBrowserRuntimeCache;
}

const browserRuntimeCacheFor = (): CoursitionBrowserRuntimeCache | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  const cacheWindow = window as CoursitionCacheWindow;
  cacheWindow.__coursitionRuntimeCache ??= {
    channel:
      typeof globalThis.BroadcastChannel === 'function'
        ? new globalThis.BroadcastChannel('coursition-workflow-v1')
        : null,
    clientId: browserOperationId(),
    sessionUser: null,
    snapshot: null,
    transientDrafts: new Map(),
  };
  return cacheWindow.__coursitionRuntimeCache;
};

const cachedSessionUserFor = () => browserRuntimeCacheFor()?.sessionUser ?? null;

const cachedSnapshotFor = (
  sessionUser: SessionUser | null,
  routeKey: string | null,
): WorkflowSnapshot | null => {
  const runtimeCache = browserRuntimeCacheFor();
  if (
    sessionUser === null ||
    routeKey === null ||
    runtimeCache?.sessionUser?.id !== sessionUser.id ||
    runtimeCache.snapshot === null
  ) {
    return null;
  }
  if (routeKey === 'dashboard') {
    return { ...runtimeCache.snapshot, draft: null };
  }
  const cachedDraft = runtimeCache.snapshot.draft;
  return cachedDraft !== null && routeKey.startsWith(`${cachedDraft.id}:`)
    ? runtimeCache.snapshot
    : null;
};

const cacheSnapshot = (sessionUser: SessionUser | null, snapshot: WorkflowSnapshot) => {
  const runtimeCache = browserRuntimeCacheFor();
  if (sessionUser === null || runtimeCache === null) {
    return;
  }
  runtimeCache.sessionUser = sessionUser;
  runtimeCache.snapshot = snapshot;
};

const cachedTransientDraftFor = (
  sessionUser: SessionUser | null,
  draft: CourseDraft | null,
): TransientDraftState | null => {
  const runtimeCache = browserRuntimeCacheFor();
  if (sessionUser === null || draft === null || runtimeCache === null) {
    return null;
  }
  return runtimeCache.transientDrafts.get(transientDraftCacheKey(sessionUser.id, draft.id)) ?? null;
};

const cacheTransientDraft = (
  sessionUser: SessionUser | null,
  draft: CourseDraft | null,
  state: TransientDraftState,
) => {
  const runtimeCache = browserRuntimeCacheFor();
  if (sessionUser === null || draft === null || runtimeCache === null) {
    return;
  }
  runtimeCache.transientDrafts.set(
    transientDraftCacheKey(sessionUser.id, draft.id),
    restorableTransientDraftState(state),
  );
};

class CoursitionUiEffectError extends Data.TaggedError('CoursitionUiEffectError')<{
  readonly cause: unknown;
  readonly message: string;
}> {}

const ClientToaster = () => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return mounted ? <Toaster /> : null;
};

interface NavigationStepVisualState {
  isComplete: boolean;
  isCurrent: boolean;
  isReady: boolean;
  isStale: boolean;
}

const workflowApiPath = '/api/coursition/workflow';
const activityEvaluationApiPath = '/api/coursition/activity-evaluation';
const workflowActionJsonSchema = Schema.fromJsonString(workflowActionSchema);
const activityEvaluationRequestJsonSchema = Schema.fromJsonString(activityEvaluationRequestSchema);
const workflowSnapshotFromUnknown = Schema.decodeUnknownEffect(workflowSnapshotSchema);
const activityEvaluationResponseFromUnknown = Schema.decodeUnknownEffect(
  activityEvaluationResponseSchema,
);
const sessionPayloadFromUnknown = Schema.decodeUnknownEffect(sessionPayloadSchema);
const workflowErrorBodyJsonSchema = Schema.fromJsonString(
  Schema.Struct({ message: Schema.optional(Schema.String) }),
);
const workflowConflictBodyJsonSchema = Schema.fromJsonString(CoursitionWorkflowConflict);
const coursePreparationKeyJsonSchema = Schema.fromJsonString(coursePreparationSchema);
const objectiveEditKeyJsonSchema = Schema.fromJsonString(
  Schema.Struct({
    capability: Schema.String,
    title: Schema.String,
  }),
);
const activityBriefEditKeyJsonSchema = Schema.fromJsonString(
  Schema.Struct({
    feedbackGuidance: Schema.String,
    instructions: Schema.String,
    learnerAction: Schema.String,
    successCriteria: Schema.String,
    title: Schema.String,
    type: Schema.String,
  }),
);
const sourceTypes = ['notes', 'url', 'file'] as const satisfies readonly SourceType[];
const navigationSteps = [...workflowSteps, 'preview'] as const satisfies readonly DraftStep[];
type AutosaveFeedback = 'dirty' | 'error' | 'idle' | 'saved';
const languagePreferences = [
  'source',
  'en',
  'cs',
] as const satisfies readonly CourseLanguagePreference[];
const sourceDataUrlPattern = /^data:[^,]+;base64,/u;

const labelClass = 'text-sm font-semibold text-fg-primary';
const mutedTextClass = 'text-sm text-fg-secondary';
const tinyMetaClass = 'text-sm font-medium tracking-normal text-fg-secondary';
const errorTextClass = 'text-base font-semibold text-danger sm:text-sm';
const studioHeaderClass =
  'grid min-w-0 gap-4 border-b border-border-primary bg-base py-4 lg:sticky lg:top-14 lg:z-20';
const workspaceSectionClass = 'grid min-w-0 gap-6 py-4 sm:py-6';
const insetSurfaceClass = 'rounded-lg bg-fill-base p-4 sm:p-5';
const editorialListClass = 'divide-y divide-border-primary border-y border-border-primary';
const readingColumnClass = 'w-full max-w-4xl';
const SnapshotErrorView = ({
  message,
  onRetry,
  t,
}: {
  message: string;
  onRetry: () => void;
  t: Translate;
}) => (
  <section
    className={`${workspaceSectionClass} min-h-80 content-center border-y border-border-primary`}
    role="alert"
  >
    <div className="grid gap-2">
      <h1 className="text-balance text-xl font-semibold text-fg-primary">
        {t('coursition.app.loading.failedTitle')}
      </h1>
      <p className="text-pretty text-base text-fg-secondary sm:text-sm">{message}</p>
    </div>
    <div>
      <Button onClick={onRetry} type="button" variant="primary">
        {t('coursition.app.loading.retry')}
      </Button>
    </div>
  </section>
);

const normalizedGeneratedText = (value: string) => value.replaceAll(/\\+r\\+n|\\+[nr]/gu, '\n');

const activeSources = (draft: CourseDraft | null) =>
  draft?.sources.filter((source) => source.status !== 'deleted') ?? [];

const coursePreparationKey = Schema.encodeSync(coursePreparationKeyJsonSchema);

const objectiveEditKey = (title: string, capability: string) =>
  Schema.encodeSync(objectiveEditKeyJsonSchema)({ capability, title });

const activityBriefEditKey = (brief: {
  feedbackGuidance: string;
  instructions: string;
  learnerAction: string;
  successCriteria: string;
  title: string;
  type: string;
}) => Schema.encodeSync(activityBriefEditKeyJsonSchema)(brief);

const hasAnyCourseContent = (draft: CourseDraft | null) =>
  draft?.courseContent.sections.some((section) => section.blocks.length > 0) ?? false;

const hasActivityPlan = (draft: CourseDraft | null) =>
  (draft?.learningBlueprint.activityBriefs.length ?? 0) > 0;

const hasObjectives = (draft: CourseDraft | null) =>
  (draft?.learningBlueprint.objectives.length ?? 0) > 0;

const failedAiRunNotice = (run: AiRun, fallback: string) => {
  const failureReason = run.failureReason?.trim() ?? '';
  return failureReason.length > 0 ? failureReason : fallback;
};

const generationRunTypeFor = (action: WorkflowAction['action']) => {
  if (action === 'generateCourse') {
    return 'course_generation' as const;
  }
  if (action === 'goToStep') {
    return 'course_preparation_generation' as const;
  }
  if (action === 'generateLearningBlueprint') {
    return 'learning_blueprint_generation' as const;
  }
  if (action === 'generateActivities') {
    return 'activity_generation' as const;
  }
  if (action === 'generateCourseContent') {
    return 'course_content_generation' as const;
  }
  return null;
};

const failedGenerationRunFor = (
  previousDraft: CourseDraft | null,
  nextDraft: CourseDraft | null,
  action: WorkflowAction['action'],
) => {
  const previousRunIds =
    previousDraft === null ? new Set<string>() : new Set(previousDraft.aiRuns.map((run) => run.id));
  if (action === 'advanceDraft') {
    return (
      nextDraft?.aiRuns
        .toReversed()
        .find((run) => run.status === 'failed' && !previousRunIds.has(run.id)) ?? null
    );
  }
  const runType = generationRunTypeFor(action);
  if (nextDraft === null || runType === null) {
    return null;
  }
  return (
    nextDraft.aiRuns
      .toReversed()
      .find(
        (run) => run.type === runType && run.status === 'failed' && !previousRunIds.has(run.id),
      ) ?? null
  );
};

const shouldShowSourcePreview = (content: string) =>
  content.trim().length !== 0 && !sourceDataUrlPattern.test(content);

const canPreviewSource = (source: SourceAsset) =>
  (source.status === 'processed' || source.status === 'partially_processed') &&
  shouldShowSourcePreview(source.content);

const sourceStatusBadgeVariant = (status: SourceAsset['status']) => {
  switch (status) {
    case 'processed': {
      return 'success';
    }
    case 'partially_processed':
    case 'queued':
    case 'processing':
    case 'uploaded': {
      return 'warning';
    }
    case 'failed':
    case 'unsupported': {
      return 'danger';
    }
    case 'deleted': {
      return 'secondary';
    }
    default: {
      return 'info';
    }
  }
};

const isAiMode = (value: string): value is AiMode => value === 'generate' || value === 'assist';

const isLanguagePreference = (value: string): value is CourseLanguagePreference =>
  languagePreferences.some((preference) => preference === value);

const contentBlockBody = (
  block: CourseDraft['courseContent']['sections'][number]['blocks'][number],
) => (block.body.trim().length > 0 ? block.body : block.title);

const isNavigationStepComplete = (draft: CourseDraft, step: DraftStep) => {
  switch (step) {
    case 'mode': {
      return true;
    }
    case 'sources': {
      return hasUsableSourceMaterial(draft);
    }
    case 'preparation': {
      return draftHasCoursePreparation(draft);
    }
    case 'objectives': {
      return draftHasObjectiveMap(draft);
    }
    case 'activityPlan': {
      return draftHasPlayableGeneratedActivityCoverage(draft);
    }
    case 'courseContent': {
      return draftHasCourseContent(draft);
    }
    case 'preview': {
      return draftHasGeneratedCourse(draft);
    }
    default: {
      const unsupportedStep: never = step;
      return unsupportedStep;
    }
  }
};

const hasStaleObjectives = (draft: CourseDraft) =>
  draft.learningBlueprint.objectives.some((objective) => objective.status === 'stale');

const hasStaleActivities = (draft: CourseDraft) =>
  [...draft.learningBlueprint.activityBriefs, ...draft.learningBlueprint.generatedActivities].some(
    (item) => item.status === 'stale',
  );

const hasStaleCourseContent = (draft: CourseDraft) =>
  draft.courseContent.status === 'stale' ||
  draft.courseContent.sections.some(
    (section) =>
      section.status === 'stale' || section.blocks.some((block) => block.status === 'stale'),
  );

const isNavigationStepStale = (draft: CourseDraft, step: DraftStep) => {
  switch (step) {
    case 'mode':
    case 'sources':
    case 'preparation': {
      return false;
    }
    case 'objectives': {
      return hasStaleObjectives(draft);
    }
    case 'activityPlan': {
      return hasStaleActivities(draft);
    }
    case 'courseContent': {
      return hasStaleCourseContent(draft);
    }
    case 'preview': {
      return hasStaleObjectives(draft) || hasStaleActivities(draft) || hasStaleCourseContent(draft);
    }
    default: {
      const unsupportedStep: never = step;
      return unsupportedStep;
    }
  }
};

const navigationGateFor = (draft: CourseDraft, step: DraftStep) =>
  step === 'preview' ? getWorkflowPreviewGate(draft) : getWorkflowStepGate(draft, step);

const navigationTriggerClass =
  'min-w-0 shrink rounded-md px-1 py-1 enabled:hover:bg-fill-hover data-[current-step=true]:cursor-default disabled:pointer-events-none disabled:bg-transparent sm:px-1.5';

const navigationIndicatorClass = ({
  isComplete,
  isCurrent,
  isReady,
  isStale,
}: NavigationStepVisualState) => {
  const classes = ['border-border-primary bg-fill-base text-fg-primary group-hover:bg-fill-hover'];
  if (isStale) {
    classes.push(
      'border-badge-border-warning bg-badge-bg-warning text-badge-fg-warning group-hover:bg-badge-bg-warning',
    );
  } else if (isReady) {
    classes.push('border-border-primary bg-fill-base text-fg-primary group-hover:bg-fill-hover');
  } else if (isComplete) {
    classes.push(
      'border-steps-indicator-border-complete bg-steps-indicator-bg-complete text-steps-indicator-fg-complete',
    );
  }
  if (isCurrent && !isComplete && !isReady && !isStale) {
    classes.push(
      'border-steps-indicator-border-current bg-steps-indicator-bg-current text-steps-indicator-fg-current',
    );
  }
  return classes.join(' ');
};

const navigationTitleClass = ({
  isComplete,
  isCurrent,
  isReady,
  isStale,
}: NavigationStepVisualState) => {
  const classes = ['overflow-visible text-clip whitespace-nowrap text-fg-primary'];
  if (isComplete && !isReady && !isStale) {
    classes.push('text-steps-title-fg-complete');
  }
  if (isStale) {
    classes.push('font-semibold text-fg-primary');
  }
  if (isReady) {
    classes.push('font-semibold text-fg-primary');
  } else if (isCurrent) {
    classes.push('font-semibold text-steps-title-fg-current');
  }
  return classes.join(' ');
};

const navigationSeparatorClass = 'flex w-3 shrink-0 items-center text-fg-secondary/40 sm:w-8';

const errorMessageFrom = (error: unknown, fallback: string) => {
  if (error instanceof CoursitionUiEffectError && error.message.trim().length > 0) {
    return error.message;
  }
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  if (typeof error === 'string' && error.trim().length > 0) {
    return error;
  }
  return fallback;
};

const workflowErrorMessageFromBody = (body: string, fallback: string) => {
  if (body.trim().length === 0) {
    return fallback;
  }
  const payload = Schema.decodeUnknownOption(workflowErrorBodyJsonSchema)(body);
  if (Option.isSome(payload) && typeof payload.value.message === 'string') {
    return payload.value.message;
  }
  return body;
};

const workflowRequestEffect = (action: WorkflowAction, fallback: string, signal?: AbortSignal) =>
  Effect.gen(function* workflowRequestProgram() {
    const requestBody = yield* Schema.encodeEffect(workflowActionJsonSchema)(action);
    const response = yield* Effect.tryPromise({
      catch: (cause) =>
        new CoursitionUiEffectError({
          cause,
          message: errorMessageFrom(cause, fallback),
        }),
      try: () =>
        globalThis['fetch'](workflowApiPath, {
          body: requestBody,
          credentials: 'same-origin',
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
          },
          method: 'POST',
          ...(signal === undefined ? {} : { signal }),
        }),
    });
    if (!response.ok) {
      const body = yield* Effect.tryPromise({
        catch: (cause) =>
          new CoursitionUiEffectError({
            cause,
            message: errorMessageFrom(cause, fallback),
          }),
        try: () => response.text(),
      });
      const conflict =
        response.status === 409
          ? Schema.decodeUnknownOption(workflowConflictBodyJsonSchema)(body)
          : Option.none<WorkflowConflictPayload>();
      return yield* new WorkflowTransportError({
        conflict: Option.isSome(conflict) ? conflict.value : null,
        message: workflowErrorMessageFromBody(body, fallback),
        status: response.status,
      });
    }
    const body = yield* Effect.tryPromise({
      catch: (cause) =>
        new CoursitionUiEffectError({
          cause,
          message: errorMessageFrom(cause, fallback),
        }),
      try: () => response.json(),
    });
    return yield* workflowSnapshotFromUnknown(body).pipe(
      Effect.mapError(
        (cause) =>
          new CoursitionUiEffectError({
            cause,
            message: errorMessageFrom(cause, fallback),
          }),
      ),
    );
  });

const activityEvaluationRequestEffect = (
  payload: {
    activityId: string;
    answer: string;
    checkedCriteria: readonly string[];
    draftId: string;
  },
  fallback: string,
) =>
  Effect.gen(function* activityEvaluationRequestProgram() {
    const requestBody = yield* Schema.encodeEffect(activityEvaluationRequestJsonSchema)({
      ...payload,
      checkedCriteria: [...payload.checkedCriteria],
    });
    const response = yield* Effect.tryPromise({
      catch: (cause) =>
        new CoursitionUiEffectError({
          cause,
          message: errorMessageFrom(cause, fallback),
        }),
      try: () =>
        globalThis['fetch'](activityEvaluationApiPath, {
          body: requestBody,
          credentials: 'same-origin',
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
          },
          method: 'POST',
        }),
    });
    if (!response.ok) {
      const body = yield* Effect.tryPromise({
        catch: (cause) =>
          new CoursitionUiEffectError({
            cause,
            message: errorMessageFrom(cause, fallback),
          }),
        try: () => response.text(),
      });
      return yield* new CoursitionUiEffectError({
        cause: response.status,
        message: workflowErrorMessageFromBody(body, fallback),
      });
    }
    const body = yield* Effect.tryPromise({
      catch: (cause) =>
        new CoursitionUiEffectError({
          cause,
          message: errorMessageFrom(cause, fallback),
        }),
      try: () => response.json(),
    });
    return yield* activityEvaluationResponseFromUnknown(body).pipe(
      Effect.mapError(
        (cause) =>
          new CoursitionUiEffectError({
            cause,
            message: errorMessageFrom(cause, fallback),
          }),
      ),
    );
  });

const fileReadFailureMessage = 'Unable to read selected file.';

const bytesToBase64 = (bytes: Uint8Array) => {
  const chunkSize = 32_768;
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCodePoint(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
};

const readFileAsDataUrlEffect = (file: File) =>
  Effect.tryPromise({
    catch: (cause) =>
      new CoursitionUiEffectError({
        cause,
        message: errorMessageFrom(cause, fileReadFailureMessage),
      }),
    try: () => file.arrayBuffer(),
  }).pipe(
    Effect.map((buffer) => {
      const mimeType = file.type.length > 0 ? file.type : 'application/octet-stream';
      return `data:${mimeType};base64,${bytesToBase64(new Uint8Array(buffer))}`;
    }),
  );

const filePayloadFromEffect = readFileAsDataUrlEffect;

const sessionRequestEffect = (fallbackMessage: string) =>
  Effect.tryPromise({
    catch: (cause) =>
      new CoursitionUiEffectError({
        cause,
        message: errorMessageFrom(cause, fallbackMessage),
      }),
    try: () => Promise.resolve(effectBff.client.auth.session({})),
  }).pipe(
    Effect.flatMap((payload) =>
      sessionPayloadFromUnknown(payload).pipe(
        Effect.mapError(
          (cause) =>
            new CoursitionUiEffectError({
              cause,
              message: errorMessageFrom(cause, fallbackMessage),
            }),
        ),
      ),
    ),
  );

const TextInputField = ({
  disabled = false,
  id,
  label,
  name,
  onChange,
  placeholder,
  required = false,
  type = 'text',
  value,
}: {
  disabled?: boolean;
  id?: string;
  label: string;
  name: string;
  onChange: (event: InputChangeEvent) => void;
  placeholder?: string;
  required?: boolean;
  type?: 'email' | 'password' | 'text' | 'url';
  value: string;
}) => (
  <FormInput
    disabled={disabled}
    id={id ?? name}
    label={label}
    name={name}
    onChange={onChange}
    placeholder={placeholder}
    required={required}
    type={type}
    value={value}
  />
);

const TextareaField = ({
  id,
  label,
  name,
  onChange,
  placeholder,
  required = false,
  rows = 4,
  value,
}: {
  id?: string;
  label: string;
  name: string;
  onChange: (event: TextareaChangeEvent) => void;
  placeholder?: string;
  required?: boolean;
  rows?: number;
  value: string;
}) => (
  <FormTextarea
    id={id ?? name}
    label={label}
    name={name}
    onChange={onChange}
    placeholder={placeholder}
    required={required}
    rows={rows}
    value={normalizedGeneratedText(value)}
  />
);

const MarkdownEditorClient = lazy(() => import('./markdown-editor-client'));

const SourceTextPreview = ({ value }: { value: string }) => (
  <div className="max-h-72 overflow-auto rounded-md bg-base p-3">
    <pre className="whitespace-pre-wrap break-words text-sm leading-6 text-fg-primary">
      {normalizedGeneratedText(value)}
    </pre>
  </div>
);

const MarkdownText = ({ className = '', value }: { className?: string; value: string }) => {
  const normalizedValue = normalizedGeneratedText(value);
  return (
    <div className={`coursition-markdown-text text-sm leading-6 text-fg-primary ${className}`}>
      <Suspense fallback={<p className="whitespace-pre-wrap">{normalizedValue}</p>}>
        <MarkdownEditorClient readOnly value={normalizedValue} />
      </Suspense>
    </div>
  );
};

const NavigationStepIndicatorContent = ({
  index,
  isComplete,
  isReady,
  isStale,
  readyLabel,
  staleLabel,
}: {
  index: number;
  isComplete: boolean;
  isReady: boolean;
  isStale: boolean;
  readyLabel: string;
  staleLabel: string;
}) => {
  if (isStale) {
    return (
      <>
        <Icon className="text-base" icon="token-icon-redo" />
        <span className="sr-only">{staleLabel}</span>
      </>
    );
  }

  if (isComplete) {
    return <Icon className="text-sm" icon="token-icon-steps-check" />;
  }

  return (
    <>
      <span className="text-sm font-semibold leading-none">{index + 1}</span>
      {isReady ? <span className="sr-only">{readyLabel}</span> : null}
    </>
  );
};

type RetrievalCheckActivity = Extract<GeneratedActivity, { type: 'retrieval_check' }>;
type PracticeTaskActivity = Extract<GeneratedActivity, { type: 'practice_task' }>;
type ScenarioDecisionActivity = Extract<GeneratedActivity, { type: 'scenario_decision' }>;
type OrderingMatchingActivity = Extract<GeneratedActivity, { type: 'ordering_matching' }>;
type RubricAnswerActivity = Extract<GeneratedActivity, { type: 'rubric_answer' }>;

interface ActivityEngineProps<Activity> {
  activity: Activity;
  draftId?: string;
  showPrompt?: boolean;
  t: Translate;
}

interface OpenEndedActivityEngineProps<Activity> extends ActivityEngineProps<Activity> {
  draftId: string;
}

const FeedbackPanel = ({
  body,
  title,
  tone,
}: {
  body: string;
  title: string;
  tone: 'success' | 'warning';
}) => (
  <output
    className={`coursition-feedback-panel border-s-2 py-2 pe-3 ps-4 text-sm leading-6 ${
      tone === 'success'
        ? 'coursition-feedback-panel--success'
        : 'coursition-feedback-panel--warning'
    }`}
  >
    <p className="font-semibold">{title}</p>
    <MarkdownText value={body} />
  </output>
);

type IncompleteActivityReason =
  | 'choices'
  | 'criteria'
  | 'items'
  | 'labels'
  | 'notPlayable'
  | 'prompt';

const hasText = (value: string) => value.trim().length > 0;

const evaluationFeedbackBody = (evaluation: ActivityEvaluationResponse, t: Translate) => {
  const criteriaFeedback = evaluation.criteria.map(
    (criterion) =>
      `- [${criterion.met ? 'x' : ' '}] **${criterion.criterion}**: ${criterion.feedback}`,
  );
  return [
    evaluation.feedbackMarkdown,
    criteriaFeedback.length > 0 ? criteriaFeedback.join('\n') : '',
    `${t('coursition.app.preview.nextStep')}: ${evaluation.nextStep}`,
  ]
    .filter(hasText)
    .join('\n\n');
};

const evaluationFeedbackTone = (evaluation: ActivityEvaluationResponse): 'success' | 'warning' =>
  evaluation.score >= 0.7 ? 'success' : 'warning';

const EvaluationFeedbackPanel = ({
  evaluation,
  t,
}: {
  evaluation: ActivityEvaluationResponse | null;
  t: Translate;
}) => {
  if (evaluation === null) {
    return null;
  }
  return (
    <FeedbackPanel
      body={evaluationFeedbackBody(evaluation, t)}
      title={t('coursition.app.preview.aiFeedback')}
      tone={evaluationFeedbackTone(evaluation)}
    />
  );
};

const useActivityEvaluation = ({
  activityId,
  draftId,
  t,
}: {
  activityId: string;
  draftId: string;
  t: Translate;
}) => {
  const [evaluation, setEvaluation] = useState<ActivityEvaluationResponse | null>(null);
  const [evaluationError, setEvaluationError] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);

  const resetEvaluation = useCallback(() => {
    setEvaluation(null);
    setEvaluationError('');
  }, []);

  const evaluateAnswer = (answer: string, checkedCriteria: readonly string[] = []) => {
    Effect.runFork(
      Effect.gen(function* evaluateActivityProgram() {
        yield* Effect.sync(() => {
          setIsEvaluating(true);
          setEvaluationError('');
        });
        const resultExit = yield* Effect.exit(
          activityEvaluationRequestEffect(
            {
              activityId,
              answer,
              checkedCriteria,
              draftId,
            },
            t('coursition.app.preview.evaluationFailed'),
          ),
        );
        yield* Effect.sync(() => {
          if (Exit.isFailure(resultExit)) {
            setEvaluation(null);
            setEvaluationError(
              errorMessageFrom(
                resultExit.cause.pipe(Cause.squash),
                t('coursition.app.preview.evaluationFailed'),
              ),
            );
            return;
          }
          setEvaluation(resultExit.value);
        });
      }).pipe(Effect.ensuring(Effect.sync(() => setIsEvaluating(false)))),
    );
  };

  return {
    evaluateAnswer,
    evaluation,
    evaluationError,
    isEvaluating,
    resetEvaluation,
  };
};

const hasValidOrderingPositions = (
  items: OrderingMatchingActivity['interaction']['items'],
): boolean => {
  const positions = items.flatMap((item) =>
    typeof item.correctPosition === 'number' && Number.isFinite(item.correctPosition)
      ? [item.correctPosition]
      : [],
  );
  if (positions.length !== items.length || positions.length <= 1) {
    return false;
  }
  return positions
    .toSorted((left, right) => left - right)
    .every((position, index) => position === index + 1);
};

const matchLabelsFrom = (items: OrderingMatchingActivity['interaction']['items']) => [
  ...new Set(items.map((item) => item.matchLabel ?? '').filter(hasText)),
];

const hasPlayableRetrievalChoices = (interaction: RetrievalCheckActivity['interaction']) =>
  interaction.choices.length >= 2 &&
  interaction.choices.every((choice) => hasText(choice.text)) &&
  interaction.choices.some((choice) => choice.isCorrect);

const hasPlayableScenarioChoices = (interaction: ScenarioDecisionActivity['interaction']) =>
  interaction.choices.length >= 2 &&
  interaction.choices.every((choice) => hasText(choice.text)) &&
  interaction.choices.some((choice) => choice.isPreferred);

const incompleteOrderingMatchingReasonFor = (
  interaction: OrderingMatchingActivity['interaction'],
): IncompleteActivityReason | null => {
  if (!hasText(interaction.prompt)) {
    return 'prompt';
  }
  const hasPlayableItems =
    interaction.items.length >= 2 && interaction.items.every((item) => hasText(item.text));
  if (!hasPlayableItems) {
    return 'items';
  }
  if (interaction.mode === 'matching') {
    return matchLabelsFrom(interaction.items).length >= 2 ? null : 'labels';
  }
  return hasValidOrderingPositions(interaction.items) ? null : 'items';
};

const incompleteActivityReasonFor = (
  activity: GeneratedActivity,
): IncompleteActivityReason | null => {
  switch (activity.type) {
    case 'retrieval_check': {
      if (!hasText(activity.interaction.question)) {
        return 'prompt';
      }
      return hasPlayableRetrievalChoices(activity.interaction) ? null : 'choices';
    }
    case 'practice_task': {
      if (!hasText(activity.interaction.prompt)) {
        return 'prompt';
      }
      return activity.interaction.checklist.some(hasText) ? null : 'criteria';
    }
    case 'scenario_decision': {
      if (!hasText(activity.interaction.scenario)) {
        return 'prompt';
      }
      return hasPlayableScenarioChoices(activity.interaction) ? null : 'choices';
    }
    case 'ordering_matching': {
      return incompleteOrderingMatchingReasonFor(activity.interaction);
    }
    case 'rubric_answer': {
      if (!hasText(activity.interaction.prompt)) {
        return 'prompt';
      }
      return activity.interaction.criteria.some(hasText) ? null : 'criteria';
    }
    case 'not_playable': {
      return 'notPlayable';
    }
    default: {
      const unsupportedActivity: never = activity;
      return unsupportedActivity;
    }
  }
};

const IncompleteActivityPanel = ({
  reason,
  t,
}: {
  reason: IncompleteActivityReason;
  t: Translate;
}) => (
  <div className="grid gap-1 border-s-2 border-badge-border-warning bg-badge-bg-warning py-3 pe-4 ps-4 text-sm leading-6 text-badge-fg-warning">
    <p className="font-semibold">{t('coursition.app.preview.incompleteActivity')}</p>
    <p>{t(`coursition.app.preview.incompleteActivityReasons.${reason}`)}</p>
  </div>
);

const RetrievalCheckEngine = ({
  activity,
  showPrompt = true,
  t,
}: ActivityEngineProps<RetrievalCheckActivity>) => {
  const { interaction } = activity;
  const [selectedChoiceId, setSelectedChoiceId] = useState('');
  const [explanation, setExplanation] = useState('');
  const [hasChecked, setHasChecked] = useState(false);
  const selectedChoice = interaction.choices.find((choice) => choice.id === selectedChoiceId);
  const isCorrect = selectedChoice?.isCorrect === true;

  return (
    <div className="grid gap-3">
      {showPrompt ? (
        <MarkdownText className="text-sm leading-6 text-fg-primary" value={interaction.question} />
      ) : null}
      <RadioCard
        className="grid gap-2"
        itemOrientation="horizontal"
        onValueChange={(value) => {
          setSelectedChoiceId(value ?? '');
          setHasChecked(false);
        }}
        orientation="vertical"
        value={selectedChoiceId}
        variant="subtle"
      >
        <RadioCard.Label>{t('coursition.app.preview.chooseAnswer')}</RadioCard.Label>
        {interaction.choices.map((choice) => (
          <RadioCard.Item key={choice.id} value={choice.id}>
            <RadioCard.ItemHiddenInput />
            <RadioCard.ItemControl>
              <RadioCard.ItemContent>
                <RadioCard.ItemText>{choice.text}</RadioCard.ItemText>
              </RadioCard.ItemContent>
              <RadioCard.ItemIndicator />
            </RadioCard.ItemControl>
          </RadioCard.Item>
        ))}
      </RadioCard>
      <FormTextarea
        id={`${activity.id}-explanation`}
        label={interaction.explanationPrompt}
        onChange={(event) => setExplanation(event.currentTarget.value)}
        rows={3}
        value={explanation}
      />
      <div>
        <Button
          disabled={selectedChoice === undefined || explanation.trim().length === 0}
          onClick={() => setHasChecked(true)}
          type="button"
          variant="primary"
        >
          {t('coursition.app.preview.checkAnswer')}
        </Button>
      </div>
      {hasChecked && selectedChoice !== undefined ? (
        <FeedbackPanel
          body={isCorrect ? interaction.feedback : selectedChoice.feedback}
          title={t(
            isCorrect ? 'coursition.app.preview.correct' : 'coursition.app.preview.keepWorking',
          )}
          tone={isCorrect ? 'success' : 'warning'}
        />
      ) : null}
    </div>
  );
};

const PracticeTaskEngine = ({
  activity,
  draftId,
  showPrompt = true,
  t,
}: OpenEndedActivityEngineProps<PracticeTaskActivity>) => {
  const { interaction } = activity;
  const [answer, setAnswer] = useState('');
  const { evaluateAnswer, evaluation, evaluationError, isEvaluating, resetEvaluation } =
    useActivityEvaluation({
      activityId: activity.id,
      draftId,
      t,
    });
  const submitEvaluation = () => {
    evaluateAnswer(answer.trim());
  };

  return (
    <div className="grid gap-3">
      {showPrompt ? (
        <MarkdownText className="text-sm leading-6 text-fg-primary" value={interaction.prompt} />
      ) : null}
      <FormTextarea
        id={`${activity.id}-practice-answer`}
        label={interaction.submissionLabel}
        onChange={(event) => {
          setAnswer(event.currentTarget.value);
          resetEvaluation();
        }}
        rows={6}
        value={answer}
      />
      <div className="grid gap-2 border-s-2 border-border-primary py-2 ps-4">
        <p className={labelClass}>{t('coursition.app.preview.criteria')}</p>
        <ul className="grid gap-1">
          {interaction.checklist.map((item) => (
            <li className={mutedTextClass} key={item}>
              {item}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <Button
          disabled={answer.trim().length === 0 || isEvaluating}
          onClick={submitEvaluation}
          type="button"
          variant="primary"
        >
          {isEvaluating
            ? t('coursition.app.preview.evaluating')
            : t('coursition.app.preview.evaluateWithAi')}
        </Button>
      </div>
      <EvaluationFeedbackPanel evaluation={evaluation} t={t} />
      {evaluationError.length > 0 ? (
        <FeedbackPanel
          body={evaluationError}
          title={t('coursition.app.preview.keepWorking')}
          tone="warning"
        />
      ) : null}
    </div>
  );
};

const ScenarioDecisionEngine = ({
  activity,
  showPrompt = true,
  t,
}: ActivityEngineProps<ScenarioDecisionActivity>) => {
  const { interaction } = activity;
  const [selectedChoiceId, setSelectedChoiceId] = useState('');
  const [justification, setJustification] = useState('');
  const [hasCommitted, setHasCommitted] = useState(false);
  const selectedChoice = interaction.choices.find((choice) => choice.id === selectedChoiceId);
  const isPreferred = selectedChoice?.isPreferred === true;

  return (
    <div className="grid gap-3">
      {showPrompt ? (
        <MarkdownText className="text-sm leading-6 text-fg-primary" value={interaction.scenario} />
      ) : null}
      <RadioCard
        className="grid gap-2"
        itemOrientation="horizontal"
        onValueChange={(value) => {
          setSelectedChoiceId(value ?? '');
          setHasCommitted(false);
        }}
        orientation="vertical"
        value={selectedChoiceId}
        variant="solid"
      >
        <RadioCard.Label>{t('coursition.app.preview.chooseDecision')}</RadioCard.Label>
        {interaction.choices.map((choice) => (
          <RadioCard.Item key={choice.id} value={choice.id}>
            <RadioCard.ItemHiddenInput />
            <RadioCard.ItemControl>
              <RadioCard.ItemContent>
                <RadioCard.ItemText>{choice.text}</RadioCard.ItemText>
              </RadioCard.ItemContent>
              <RadioCard.ItemIndicator />
            </RadioCard.ItemControl>
          </RadioCard.Item>
        ))}
      </RadioCard>
      <FormTextarea
        id={`${activity.id}-justification`}
        label={interaction.justificationPrompt}
        onChange={(event) => {
          setJustification(event.currentTarget.value);
          setHasCommitted(false);
        }}
        rows={3}
        value={justification}
      />
      <div>
        <Button
          disabled={selectedChoice === undefined || justification.trim().length === 0}
          onClick={() => setHasCommitted(true)}
          type="button"
          variant="primary"
        >
          {t('coursition.app.preview.commitDecision')}
        </Button>
      </div>
      {hasCommitted && selectedChoice !== undefined ? (
        <FeedbackPanel
          body={`${selectedChoice.consequence}\n\n${isPreferred ? interaction.feedback : selectedChoice.feedback}`}
          title={t(
            isPreferred
              ? 'coursition.app.preview.strongDecision'
              : 'coursition.app.preview.reviewDecision',
          )}
          tone={isPreferred ? 'success' : 'warning'}
        />
      ) : null}
    </div>
  );
};

const moveOrderItem = (
  orderedIds: readonly string[],
  itemId: string,
  direction: -1 | 1,
): string[] => {
  const currentIndex = orderedIds.indexOf(itemId);
  const nextIndex = currentIndex + direction;
  if (currentIndex === -1 || nextIndex < 0 || nextIndex >= orderedIds.length) {
    return [...orderedIds];
  }
  const nextIds = [...orderedIds];
  const currentItem = nextIds[currentIndex];
  const nextItem = nextIds[nextIndex];
  if (currentItem === undefined || nextItem === undefined) {
    return nextIds;
  }
  nextIds[currentIndex] = nextItem;
  nextIds[nextIndex] = currentItem;
  return nextIds;
};

const stableActivityHash = (value: string) => {
  let hash = 0;
  for (const character of value) {
    hash = (hash * 31 + (character.codePointAt(0) ?? 0)) % 1_000_003;
  }
  return hash;
};

const initialOrderedIdsFrom = (items: OrderingMatchingActivity['interaction']['items']) => {
  const correctIds = items
    .toSorted((left, right) => (left.correctPosition ?? 0) - (right.correctPosition ?? 0))
    .map((item) => item.id);
  const shuffledIds = correctIds.toSorted((left, right) => {
    const leftItem = items.find((item) => item.id === left);
    const rightItem = items.find((item) => item.id === right);
    return (
      stableActivityHash(`${right}:${rightItem?.text ?? ''}`) -
      stableActivityHash(`${left}:${leftItem?.text ?? ''}`)
    );
  });
  if (
    shuffledIds.length > 1 &&
    shuffledIds.every((itemId, index) => itemId === correctIds[index])
  ) {
    const [firstId, ...remainingIds] = shuffledIds;
    return firstId === undefined ? shuffledIds : [...remainingIds, firstId];
  }
  return shuffledIds;
};

const OrderingMatchingEngine = ({
  activity,
  showPrompt = true,
  t,
}: ActivityEngineProps<OrderingMatchingActivity>) => {
  const { interaction } = activity;
  const [orderedIds, setOrderedIds] = useState(() => initialOrderedIdsFrom(interaction.items));
  const [matches, setMatches] = useState<Record<string, string>>({});
  const [hasChecked, setHasChecked] = useState(false);
  const itemsById = useMemo(
    () => new Map(interaction.items.map((item) => [item.id, item])),
    [interaction.items],
  );

  if (interaction.mode === 'matching') {
    const matchLabels = matchLabelsFrom(interaction.items);
    const allMatched = interaction.items.every((item) => (matches[item.id] ?? '') !== '');
    const correctMatchCount = interaction.items.filter(
      (item) => matches[item.id] === item.matchLabel,
    ).length;

    return (
      <div className="grid gap-3">
        {showPrompt ? (
          <MarkdownText className="text-sm leading-6 text-fg-primary" value={interaction.prompt} />
        ) : null}
        <p className={mutedTextClass}>
          {t('coursition.app.preview.matchingInstruction', {
            total: interaction.items.length,
          })}
        </p>
        <div className={editorialListClass}>
          {interaction.items.map((item, index) => {
            const selectedMatch = matches[item.id] ?? '';
            const isCorrect = selectedMatch === item.matchLabel;
            return (
              <div className="grid gap-3 py-5 first:pt-0 last:pb-0" key={item.id}>
                <div className="grid gap-1">
                  <p className={tinyMetaClass}>
                    {t('coursition.app.preview.matchCard', {
                      number: index + 1,
                      total: interaction.items.length,
                    })}
                  </p>
                  <p className="text-base font-semibold text-fg-primary">{item.text}</p>
                </div>
                <RadioCard
                  className="grid gap-2"
                  itemOrientation="horizontal"
                  onValueChange={(value) => {
                    setMatches((current) => ({ ...current, [item.id]: value ?? '' }));
                    setHasChecked(false);
                  }}
                  orientation="vertical"
                  value={selectedMatch}
                  variant="subtle"
                >
                  <RadioCard.Label>{t('coursition.app.preview.chooseMatch')}</RadioCard.Label>
                  {matchLabels.map((label) => (
                    <RadioCard.Item key={`${item.id}-${label}`} value={label}>
                      <RadioCard.ItemHiddenInput />
                      <RadioCard.ItemControl>
                        <RadioCard.ItemContent>
                          <RadioCard.ItemText>{label}</RadioCard.ItemText>
                        </RadioCard.ItemContent>
                        <RadioCard.ItemIndicator />
                      </RadioCard.ItemControl>
                    </RadioCard.Item>
                  ))}
                </RadioCard>
                {hasChecked ? (
                  <FeedbackPanel
                    body={t(
                      isCorrect
                        ? 'coursition.app.preview.matchCorrect'
                        : 'coursition.app.preview.matchReview',
                      { item: item.text },
                    )}
                    title={t(
                      isCorrect
                        ? 'coursition.app.preview.correct'
                        : 'coursition.app.preview.keepWorking',
                    )}
                    tone={isCorrect ? 'success' : 'warning'}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
        <div>
          <Button
            disabled={!allMatched}
            onClick={() => setHasChecked(true)}
            type="button"
            variant="primary"
          >
            {t('coursition.app.preview.checkMatches')}
          </Button>
        </div>
        {hasChecked ? (
          <FeedbackPanel
            body={t('coursition.app.preview.matchSummary', {
              correct: correctMatchCount,
              total: interaction.items.length,
            })}
            title={t(
              correctMatchCount === interaction.items.length
                ? 'coursition.app.preview.correct'
                : 'coursition.app.preview.keepWorking',
            )}
            tone={correctMatchCount === interaction.items.length ? 'success' : 'warning'}
          />
        ) : null}
      </div>
    );
  }

  const orderedItems = orderedIds.flatMap((itemId) => {
    const item = itemsById.get(itemId);
    return item === undefined ? [] : [item];
  });
  const correctOrderCount = orderedItems.filter(
    (item, index) => item.correctPosition === index + 1,
  ).length;

  return (
    <div className="grid gap-3">
      {showPrompt ? (
        <MarkdownText className="text-sm leading-6 text-fg-primary" value={interaction.prompt} />
      ) : null}
      <p className={mutedTextClass}>
        {t('coursition.app.preview.orderingInstruction', {
          total: orderedItems.length,
        })}
      </p>
      <ol className={editorialListClass}>
        {orderedItems.map((item, index) => {
          const isCorrect = item.correctPosition === index + 1;
          return (
            <li className="grid gap-3 py-4 first:pt-0 last:pb-0" key={item.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className={tinyMetaClass}>
                    {t('coursition.app.preview.orderPosition', { number: index + 1 })}
                  </p>
                  <p className="text-sm font-semibold text-fg-primary">{item.text}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    disabled={index === 0}
                    icon="token-icon-chevron-up"
                    onClick={() => {
                      setOrderedIds((current) => moveOrderItem(current, item.id, -1));
                      setHasChecked(false);
                    }}
                    theme="light"
                    type="button"
                    variant="primary"
                  >
                    {t('coursition.app.preview.moveUp')}
                  </Button>
                  <Button
                    disabled={index === orderedItems.length - 1}
                    icon="token-icon-chevron-down"
                    onClick={() => {
                      setOrderedIds((current) => moveOrderItem(current, item.id, 1));
                      setHasChecked(false);
                    }}
                    theme="light"
                    type="button"
                    variant="primary"
                  >
                    {t('coursition.app.preview.moveDown')}
                  </Button>
                </div>
              </div>
              {hasChecked ? (
                <FeedbackPanel
                  body={t(
                    isCorrect
                      ? 'coursition.app.preview.orderCorrect'
                      : 'coursition.app.preview.orderReview',
                    { item: item.text },
                  )}
                  title={t(
                    isCorrect
                      ? 'coursition.app.preview.correct'
                      : 'coursition.app.preview.keepWorking',
                  )}
                  tone={isCorrect ? 'success' : 'warning'}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
      <div>
        <Button onClick={() => setHasChecked(true)} type="button" variant="primary">
          {t('coursition.app.preview.checkOrder')}
        </Button>
      </div>
      {hasChecked ? (
        <FeedbackPanel
          body={t('coursition.app.preview.orderSummary', {
            correct: correctOrderCount,
            total: orderedItems.length,
          })}
          title={t(
            correctOrderCount === orderedItems.length
              ? 'coursition.app.preview.correct'
              : 'coursition.app.preview.keepWorking',
          )}
          tone={correctOrderCount === orderedItems.length ? 'success' : 'warning'}
        />
      ) : null}
    </div>
  );
};

const RubricAnswerEngine = ({
  activity,
  draftId,
  showPrompt = true,
  t,
}: OpenEndedActivityEngineProps<RubricAnswerActivity>) => {
  const { interaction } = activity;
  const [answer, setAnswer] = useState('');
  const [checkedCriteria, setCheckedCriteria] = useState<readonly string[]>([]);
  const { evaluateAnswer, evaluation, evaluationError, isEvaluating, resetEvaluation } =
    useActivityEvaluation({
      activityId: activity.id,
      draftId,
      t,
    });
  const checkedCount = checkedCriteria.length;
  const runEvaluation = () => {
    evaluateAnswer(answer.trim(), checkedCriteria);
  };

  return (
    <div className="grid gap-3">
      {showPrompt ? (
        <MarkdownText className="text-sm leading-6 text-fg-primary" value={interaction.prompt} />
      ) : null}
      <FormTextarea
        id={`${activity.id}-rubric-answer`}
        label={t('coursition.app.preview.answer')}
        onChange={(event) => {
          setAnswer(event.currentTarget.value);
          resetEvaluation();
        }}
        rows={5}
        value={answer}
      />
      <div className="grid gap-2 border-s-2 border-border-primary py-2 ps-4">
        <p className={labelClass}>{t('coursition.app.preview.selfCheck')}</p>
        {interaction.criteria.map((criterion) => (
          <FormCheckbox
            checked={checkedCriteria.includes(criterion)}
            id={`${activity.id}-${criterion}`}
            key={criterion}
            label={criterion}
            onCheckedChange={(isChecked) => {
              setCheckedCriteria((current) =>
                isChecked ? [...current, criterion] : current.filter((item) => item !== criterion),
              );
              resetEvaluation();
            }}
          />
        ))}
        <p className={mutedTextClass}>
          {t('coursition.app.preview.criteriaChecked', {
            checked: checkedCount,
            total: interaction.criteria.length,
          })}
        </p>
      </div>
      <div>
        <Button
          disabled={answer.trim().length === 0 || isEvaluating}
          onClick={runEvaluation}
          type="button"
          variant="primary"
        >
          {isEvaluating
            ? t('coursition.app.preview.evaluating')
            : t('coursition.app.preview.evaluateWithAi')}
        </Button>
      </div>
      <EvaluationFeedbackPanel evaluation={evaluation} t={t} />
      {evaluationError.length > 0 ? (
        <FeedbackPanel
          body={evaluationError}
          title={t('coursition.app.preview.keepWorking')}
          tone="warning"
        />
      ) : null}
    </div>
  );
};

const activityPromptFor = (activity: GeneratedActivity): string => {
  switch (activity.type) {
    case 'retrieval_check': {
      return activity.interaction.question;
    }
    case 'practice_task': {
      return activity.interaction.prompt;
    }
    case 'scenario_decision': {
      return activity.interaction.scenario;
    }
    case 'ordering_matching': {
      return activity.interaction.prompt;
    }
    case 'rubric_answer': {
      return activity.interaction.prompt;
    }
    case 'not_playable': {
      return [
        activity.interaction.prompt,
        activity.interaction.reason,
        activity.interaction.feedback,
      ]
        .filter(hasText)
        .join('\n\n');
    }
    default: {
      const unsupportedActivity: never = activity;
      return unsupportedActivity;
    }
  }
};

const ActivityPreviewCard = ({
  activity,
  draftId,
  index,
  t,
}: {
  activity: GeneratedActivity;
  draftId: string;
  index: number;
  t: Translate;
}) => {
  const renderEngine = () => {
    switch (activity.type) {
      case 'retrieval_check': {
        return <RetrievalCheckEngine activity={activity} showPrompt={false} t={t} />;
      }
      case 'practice_task': {
        return (
          <PracticeTaskEngine activity={activity} draftId={draftId} showPrompt={false} t={t} />
        );
      }
      case 'scenario_decision': {
        return <ScenarioDecisionEngine activity={activity} showPrompt={false} t={t} />;
      }
      case 'ordering_matching': {
        return <OrderingMatchingEngine activity={activity} showPrompt={false} t={t} />;
      }
      case 'rubric_answer': {
        return (
          <RubricAnswerEngine activity={activity} draftId={draftId} showPrompt={false} t={t} />
        );
      }
      case 'not_playable': {
        return null;
      }
      default: {
        const unsupportedActivity: never = activity;
        return unsupportedActivity;
      }
    }
  };

  const typeLabel = t(`coursition.app.activityPlan.types.${activity.type}`);
  const prompt = activityPromptFor(activity).trim();
  const incompleteReason = incompleteActivityReasonFor(activity);
  const heading = hasText(prompt)
    ? typeLabel
    : t('coursition.app.preview.incompleteActivityHeading');

  return (
    <article
      className="grid gap-5 border-t border-border-primary py-6 first:border-t-0 first:pt-0 last:pb-0"
      key={activity.id}
    >
      <header className="grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className={tinyMetaClass}>
            {t('coursition.app.preview.activityNumber', { number: index + 1 })}
          </p>
        </div>
        <h4 className="text-base font-semibold leading-6 text-fg-primary">{heading}</h4>
        {hasText(prompt) ? (
          <MarkdownText className="text-sm leading-6 text-fg-primary" value={prompt} />
        ) : null}
      </header>
      {incompleteReason === null ? (
        renderEngine()
      ) : (
        <IncompleteActivityPanel reason={incompleteReason} t={t} />
      )}
    </article>
  );
};

const linkedActivityIdsFor = (draft: CourseDraft) =>
  new Set(
    draft.courseContent.sections.flatMap((section) =>
      section.blocks.flatMap((block) =>
        block.type === 'interactive_activity' && block.activityId !== undefined
          ? [block.activityId]
          : [],
      ),
    ),
  );

const unlinkedGeneratedActivitiesFor = (draft: CourseDraft) => {
  const linkedActivityIds = linkedActivityIdsFor(draft);
  return draft.learningBlueprint.generatedActivities.filter(
    (activity) => !linkedActivityIds.has(activity.id),
  );
};

const normalizedPreviewText = (value: string) =>
  normalizedGeneratedText(value).replaceAll(/\s+/gu, ' ').trim();

const CourseContentView = ({ draft, t }: { draft: CourseDraft; t: Translate }) => {
  const { sections } = draft.courseContent;
  const [selectedSectionId, setSelectedSectionId] = useState(sections[0]?.id ?? '');
  const sectionTabRefs = useRef(new Map<string, HTMLButtonElement>());
  const activeSectionId = sections.some((section) => section.id === selectedSectionId)
    ? selectedSectionId
    : (sections[0]?.id ?? '');
  const activeSectionIndex = sections.findIndex((section) => section.id === activeSectionId);
  const selectAdjacentSection = (offset: -1 | 1) => {
    const section = sections[activeSectionIndex + offset];
    if (section === undefined) {
      return;
    }
    setSelectedSectionId(section.id);
    globalThis.requestAnimationFrame(() => sectionTabRefs.current.get(section.id)?.focus());
  };
  const generatedActivitiesById = new Map(
    draft.learningBlueprint.generatedActivities.map((activity) => [activity.id, activity]),
  );
  const activityIndexById = new Map(
    draft.learningBlueprint.generatedActivities.map((activity, index) => [activity.id, index]),
  );

  return (
    <Tabs
      className="min-w-0"
      onValueChange={setSelectedSectionId}
      size="sm"
      value={activeSectionId}
      variant="line"
    >
      <div className="coursition-section-tabs">
        <Button
          aria-label={t('coursition.app.courseContent.previousSection')}
          className="coursition-tab-scroll-button"
          disabled={activeSectionIndex <= 0}
          icon="token-icon-chevron-left"
          onClick={() => selectAdjacentSection(-1)}
          size="sm"
          theme="light"
          type="button"
          variant="primary"
        />
        <Tabs.List className="coursition-section-tab-list">
          {sections.map((section, sectionIndex) => (
            <Tabs.Trigger
              className="coursition-section-tab-trigger"
              key={section.id}
              onFocus={(event) =>
                event.currentTarget.scrollIntoView({ block: 'nearest', inline: 'center' })
              }
              ref={(node) => {
                if (node === null) {
                  sectionTabRefs.current.delete(section.id);
                  return;
                }
                sectionTabRefs.current.set(section.id, node);
              }}
              value={section.id}
            >
              {sectionIndex + 1}. {section.title}
            </Tabs.Trigger>
          ))}
          <Tabs.Indicator />
        </Tabs.List>
        <Button
          aria-label={t('coursition.app.courseContent.nextSection')}
          className="coursition-tab-scroll-button"
          disabled={activeSectionIndex >= sections.length - 1}
          icon="token-icon-chevron-right"
          onClick={() => selectAdjacentSection(1)}
          size="sm"
          theme="light"
          type="button"
          variant="primary"
        />
      </div>
      {sections.map((section, sectionIndex) => (
        <Tabs.Content className="pt-8" key={section.id} value={section.id}>
          <section className={`${readingColumnClass} grid gap-7`}>
            <header className="grid gap-3 border-b border-border-primary pb-6">
              <p className={tinyMetaClass}>
                {t('coursition.app.courseContent.section')} {sectionIndex + 1}
              </p>
              <h3 className="text-balance text-xl font-semibold tracking-tight text-fg-primary">
                {section.title}
              </h3>
              <MarkdownText
                className="text-base leading-7 text-fg-secondary sm:text-sm sm:leading-6"
                value={section.summary}
              />
            </header>
            <div className="grid gap-7">
              {section.blocks.map((block) => {
                const activity =
                  block.type === 'interactive_activity' && block.activityId !== undefined
                    ? generatedActivitiesById.get(block.activityId)
                    : undefined;
                if (activity !== undefined) {
                  return (
                    <ActivityPreviewCard
                      activity={activity}
                      draftId={draft.id}
                      index={activityIndexById.get(activity.id) ?? 0}
                      key={block.id}
                      t={t}
                    />
                  );
                }

                const body = contentBlockBody(block);
                if (
                  normalizedPreviewText(body) === normalizedPreviewText(section.summary) &&
                  section.blocks.findIndex((candidate) => candidate.id === block.id) === 0
                ) {
                  return null;
                }
                return (
                  <article className="grid gap-2" key={block.id}>
                    <h4 className="text-base font-semibold text-fg-primary">
                      {t(`coursition.app.blockTypes.${block.type}`)}
                    </h4>
                    <MarkdownText
                      className="text-base leading-7 text-fg-primary sm:text-sm sm:leading-6"
                      value={body}
                    />
                  </article>
                );
              })}
            </div>
          </section>
        </Tabs.Content>
      ))}
    </Tabs>
  );
};

const UnlinkedGeneratedActivitiesView = ({ draft, t }: { draft: CourseDraft; t: Translate }) => {
  const unlinkedActivities = unlinkedGeneratedActivitiesFor(draft);
  if (unlinkedActivities.length > 0) {
    return (
      <section className={`${readingColumnClass} grid gap-4 border-t border-border-primary pt-8`}>
        <h3 className="text-lg font-semibold text-fg-primary">
          {t('coursition.app.preview.activities')}
        </h3>
        <div>
          {unlinkedActivities.map((activity, index) => (
            <ActivityPreviewCard
              activity={activity}
              draftId={draft.id}
              index={index}
              key={activity.id}
              t={t}
            />
          ))}
        </div>
      </section>
    );
  }

  if (draft.learningBlueprint.generatedActivities.length === 0) {
    return (
      <section className={`${readingColumnClass} grid gap-3 border-t border-border-primary pt-8`}>
        <h3 className="text-lg font-semibold text-fg-primary">
          {t('coursition.app.preview.activities')}
        </h3>
        <p className={mutedTextClass}>{t('coursition.app.preview.noActivities')}</p>
      </section>
    );
  }

  return null;
};

const ReviewView = ({
  draft,
  runWorkflow,
  t,
}: {
  draft: CourseDraft;
  runWorkflow: WorkflowRunner;
  t: Translate;
}) => (
  <section className={`${readingColumnClass} grid gap-4 border-t border-border-primary pt-8`}>
    <h3 className="text-xl font-semibold text-fg-primary">{t('coursition.app.review.title')}</h3>
    {draft.findings.length === 0 ? (
      <p className={mutedTextClass}>{t('coursition.app.review.empty')}</p>
    ) : (
      <div className={editorialListClass}>
        {draft.findings.map((finding) => (
          <article className="grid gap-2 py-5 first:pt-0 last:pb-0" key={finding.id}>
            <p className={tinyMetaClass}>
              {t(`coursition.app.review.severity.${finding.severity}`)}
            </p>
            <h4 className="text-base font-semibold text-fg-primary">{finding.title}</h4>
            <p className={mutedTextClass}>{finding.detail}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() =>
                  void runWorkflow({
                    action: 'setFindingStatus',
                    draftId: draft.id,
                    findingId: finding.id,
                    status: 'resolved',
                  })
                }
                type="button"
                variant="primary"
              >
                {t('coursition.app.review.resolve')}
              </Button>
              <Button
                onClick={() =>
                  void runWorkflow({
                    action: 'setFindingStatus',
                    draftId: draft.id,
                    findingId: finding.id,
                    status: 'dismissed',
                  })
                }
                type="button"
                variant="primary"
                theme="light"
              >
                {t('coursition.app.review.dismiss')}
              </Button>
            </div>
          </article>
        ))}
      </div>
    )}
  </section>
);

// eslint-disable-next-line complexity -- The active course-studio orchestrator still owns routing, forms, and generation state until the next component split.
export const CoursitionWorkflowApp = ({
  authMode = null,
  initialRoute = null,
  initialSessionUser,
  initialSnapshot = null,
  language,
  onSessionUserChange,
  routeKind,
  t,
}: CoursitionWorkflowAppProps) => {
  const navigate = useNavigate();
  const toast = useToast();
  const requestedSnapshotRouteKey = snapshotRouteKeyFor(routeKind, initialRoute);
  const isInitialSessionExplicit = initialSessionUser !== undefined;
  const initialSessionState = initialSessionStateFor({
    cachedSessionUser: cachedSessionUserFor(),
    initialSessionUser,
    sessionProvided: isInitialSessionExplicit,
  });
  const initialRuntimeSessionUser = initialSessionState.user;
  const cachedRuntimeSnapshot = cachedSnapshotFor(
    initialRuntimeSessionUser,
    requestedSnapshotRouteKey,
  );
  const initialRuntimeSnapshot = cachedRuntimeSnapshot ?? initialSnapshot;
  const initialRuntimeDraft = initialRuntimeSnapshot?.draft ?? null;
  const initialTransientDraft =
    cachedTransientDraftFor(initialRuntimeSessionUser, initialRuntimeDraft) ??
    (initialRuntimeDraft === null
      ? null
      : transientDraftStateFor(initialRuntimeDraft, normalizedGeneratedText));
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(initialRuntimeSessionUser);
  const [isSessionResolved, setIsSessionResolved] = useState(initialSessionState.isResolved);
  const [snapshot, setSnapshot] = useState<WorkflowSnapshot | null>(initialRuntimeSnapshot);
  const [loadedSnapshotRouteKey, setLoadedSnapshotRouteKey] = useState<string | null>(
    initialRuntimeSnapshot === null ? null : requestedSnapshotRouteKey,
  );
  const [optimisticStep, setOptimisticStep] = useState<DraftStep | null>(null);
  const [snapshotLoadError, setSnapshotLoadError] = useState<SnapshotLoadError | null>(null);
  const [sessionBootstrapError, setSessionBootstrapError] = useState<string | null>(null);
  const [sessionBootstrapAttempt, setSessionBootstrapAttempt] = useState(0);
  const [authEmail, setAuthEmail] = useState('');
  const [authName, setAuthName] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [busyActions, setBusyActions] = useState<readonly BusyAction[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [autosaveFeedback, setAutosaveFeedback] = useState<AutosaveFeedback>('idle');
  const [courseTitleBuffer, setCourseTitleBuffer] = useState<EditBuffer<string>>(
    initialTransientDraft?.courseTitle ?? editBuffer('', 0),
  );
  const [draftTitle, setDraftTitle] = useState('');
  const [sourceType, setSourceType] = useState<SourceType>('notes');
  const [sourceFormDrafts, setSourceFormDrafts] = useState<SourceFormDrafts>(
    initialTransientDraft?.sources ?? emptySourceFormDrafts,
  );
  const sourceFormDraftsRef = useRef(sourceFormDrafts);
  const [fileInputResetKey, setFileInputResetKey] = useState(0);
  const [fileSourceFeedback, setFileSourceFeedback] = useState<FileSourceFeedback | null>(null);
  const [expandedSourcePreviewIds, setExpandedSourcePreviewIds] = useState<readonly string[]>([]);
  const [preparationBuffer, setPreparationBuffer] = useState<EditBuffer<CoursePreparation>>(
    initialTransientDraft?.preparation ?? editBuffer(emptyCoursePreparation(language), 0),
  );
  const [objectiveEditBuffers, setObjectiveEditBuffers] = useState<
    Readonly<Record<string, EditBuffer<ObjectiveEditValue>>>
  >(initialTransientDraft?.objectives ?? {});
  const [activityBriefEditBuffers, setActivityBriefEditBuffers] = useState<
    Readonly<Record<string, EditBuffer<ActivityBriefEditValue>>>
  >(initialTransientDraft?.activityBriefs ?? {});
  const [transientStateKey, setTransientStateKey] = useState<string | null>(
    initialRuntimeSessionUser === null || initialRuntimeDraft === null
      ? null
      : transientDraftCacheKey(initialRuntimeSessionUser.id, initialRuntimeDraft.id),
  );

  const draft = snapshot?.draft ?? null;
  const courseTitle = courseTitleBuffer.value;
  const preparation = preparationBuffer.value;
  const visibleSources = useMemo(() => activeSources(draft), [draft]);
  const expandedSourcePreviewIdSet = useMemo(() => {
    const visibleSourceIds = new Set(visibleSources.map((source) => source.id));
    return new Set(expandedSourcePreviewIds.filter((sourceId) => visibleSourceIds.has(sourceId)));
  }, [expandedSourcePreviewIds, visibleSources]);
  const routeStep =
    initialRoute !== null && (draft === null || initialRoute.draftId === draft.id)
      ? initialRoute.step
      : (draft?.step ?? 'mode');
  const activeStep = optimisticStep ?? routeStep;
  const navigationDraft = draft === null ? null : { ...draft, step: activeStep };

  useEffect(() => {
    if (optimisticStep !== routeStep) {
      return;
    }
    let cancelled = false;
    globalThis.queueMicrotask(() => {
      if (!cancelled) {
        setOptimisticStep((currentStep) => (currentStep === routeStep ? null : currentStep));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [optimisticStep, routeStep]);

  useLayoutEffect(() => {
    sourceFormDraftsRef.current = sourceFormDrafts;
  }, [sourceFormDrafts]);
  const currentWorkflowStepIndex = Math.max(0, workflowStepIndex(activeStep));
  const courseNavigationRef = useRef<HTMLElement>(null);
  const lastSubmittedCourseTitleRef = useRef<string | null>(null);
  const lastSubmittedObjectiveKeyRef = useRef(new Map<string, string>());
  const lastSubmittedActivityBriefKeyRef = useRef(new Map<string, string>());
  const lastSubmittedPreparationKeyRef = useRef<string | null>(null);
  const workflowActionGateRef = useRef(new ExclusiveActionGate());
  const sessionBootstrapStartedRef = useRef(false);
  const sessionRedirectStartedRef = useRef(false);
  const sessionUserIdRef = useRef<string | null>(initialRuntimeSessionUser?.id ?? null);
  const coordinator = workflowRequestCoordinatorForBrowser({
    initialRouteKey: requestedSnapshotRouteKey,
    initialSessionId: initialRuntimeSessionUser?.id ?? null,
    initialSnapshot: initialRuntimeSnapshot,
    onMutationCommitted: ({ draftId, revision }) => {
      const runtimeCache = browserRuntimeCacheFor();
      const ownerId = sessionUserIdRef.current;
      if (ownerId === null || runtimeCache?.channel === null || runtimeCache === null) {
        return;
      }
      runtimeCache.channel.postMessage({
        clientId: runtimeCache.clientId,
        draftId,
        kind: 'mutation-committed',
        ownerId,
        revision,
      });
    },
    transport: {
      request: (action, options) =>
        Effect.runPromise(
          workflowRequestEffect(action, t('coursition.app.errors.generic'), options.signal),
        ),
    },
  });
  const busyAction = busyActions.at(-1) ?? null;
  const isBusyAction = (...actions: readonly BusyAction[]) =>
    actions.some((action) => busyActions.includes(action));
  const beginBusyAction = (action: BusyAction) => {
    setBusyActions((currentActions) => [...currentActions, action]);
    setNotice(null);
  };
  const endBusyAction = (action: BusyAction) => {
    setBusyActions((currentActions) => {
      const actionIndex = currentActions.lastIndexOf(action);
      if (actionIndex === -1) {
        return currentActions;
      }
      return [...currentActions.slice(0, actionIndex), ...currentActions.slice(actionIndex + 1)];
    });
  };
  const isAuthBusy = isBusyAction('auth');
  const isAdvanceDraftBusy = isBusyAction('advanceDraft');
  const isAutosaveBusy = isBusyAction(
    'updateActivityBrief',
    'updateCoursePreparation',
    'updateDraftTitle',
    'updateLearningObjective',
  );
  const isCreateDraftBusy = isBusyAction('createDraft');
  const isDraftListBusy = isBusyAction('selectDraft', 'deleteDraft');
  const isRouteActionBusy = isBusyAction(
    'advanceDraft',
    'deleteDraft',
    'generateCourse',
    'generateActivities',
    'generateCourseContent',
    'selectDraft',
    'setMode',
  );
  const isModeBusy = isBusyAction('setMode');
  const isSourceAddBusy = isBusyAction('addSource', 'file');
  const isSourceDeleteBusy = isBusyAction('deleteSource');
  const isSourceRetryBusy = isBusyAction('retrySource');
  const isObjectiveGenerationBusy = isBusyAction('generateLearningBlueprint');
  const isActivityGenerationBusy = isBusyAction('generateActivities');
  const isCourseContentGenerationBusy = isBusyAction('generateCourseContent');
  const activeAuthMode = authMode ?? 'signIn';
  const sessionRedirectPath = sessionRedirectPathFor({
    isSessionResolved,
    language,
    routeKind,
    sessionUser,
  });

  useEffect(() => {
    if (notice === null) {
      return;
    }
    let cancelled = false;
    globalThis.queueMicrotask(() => {
      if (cancelled) {
        return;
      }
      toast.create({
        closable: true,
        title: notice,
        type: 'error',
      });
      setNotice(null);
    });
    return () => {
      cancelled = true;
    };
  }, [notice, toast]);

  useLayoutEffect(() => {
    const syncSnapshot = () => {
      const nextSnapshot = coordinator.snapshot;
      setSnapshot(nextSnapshot);
      if (nextSnapshot !== null) {
        cacheSnapshot(sessionUser, nextSnapshot);
      }
    };
    syncSnapshot();
    return coordinator.subscribe(syncSnapshot);
  }, [coordinator, sessionUser]);

  /* eslint-disable react-compiler/react-compiler -- Server snapshots and per-route transient drafts intentionally reconcile into controlled form state. */
  useEffect(() => {
    if (sessionUser === null || draft === null) {
      setTransientStateKey(null);
      return;
    }
    const nextStateKey = transientDraftCacheKey(sessionUser.id, draft.id);
    if (nextStateKey !== transientStateKey) {
      const nextState =
        cachedTransientDraftFor(sessionUser, draft) ??
        transientDraftStateFor(draft, normalizedGeneratedText);
      setCourseTitleBuffer(nextState.courseTitle);
      setPreparationBuffer(nextState.preparation);
      setSourceFormDrafts(nextState.sources);
      setObjectiveEditBuffers(nextState.objectives);
      setActivityBriefEditBuffers(nextState.activityBriefs);
      setTransientStateKey(nextStateKey);
      return;
    }
    setCourseTitleBuffer((current) => reconcileEditBuffer(current, draft.title, draft.revision));
    setPreparationBuffer((current) =>
      reconcileEditBuffer(
        current,
        draft.learningBlueprint.coursePreparation,
        draft.revision,
        (left, right) => coursePreparationKey(left) === coursePreparationKey(right),
      ),
    );
    setObjectiveEditBuffers((current) =>
      Object.fromEntries(
        draft.learningBlueprint.objectives.map((objective) => {
          const serverValue = {
            capability: normalizedGeneratedText(objective.capability),
            title: objective.title,
          };
          const existing = current[objective.id] ?? editBuffer(serverValue, draft.revision);
          return [
            objective.id,
            reconcileEditBuffer(
              existing,
              serverValue,
              draft.revision,
              (left, right) =>
                objectiveEditKey(left.title, left.capability) ===
                objectiveEditKey(right.title, right.capability),
            ),
          ];
        }),
      ),
    );
    setActivityBriefEditBuffers((current) =>
      Object.fromEntries(
        draft.learningBlueprint.activityBriefs.map((brief) => {
          const serverValue: ActivityBriefEditValue = {
            feedbackGuidance: normalizedGeneratedText(brief.feedbackGuidance),
            instructions: normalizedGeneratedText(brief.instructions),
            learnerAction: normalizedGeneratedText(brief.learnerAction),
            successCriteria: normalizedGeneratedText(brief.successCriteria),
            title: brief.title,
            type: brief.type,
          };
          const existing = current[brief.id] ?? editBuffer(serverValue, draft.revision);
          return [
            brief.id,
            reconcileEditBuffer(
              existing,
              serverValue,
              draft.revision,
              (left, right) => activityBriefEditKey(left) === activityBriefEditKey(right),
            ),
          ];
        }),
      ),
    );
  }, [draft, sessionUser, transientStateKey]);
  /* eslint-enable react-compiler/react-compiler */

  useEffect(() => {
    if (
      sessionUser === null ||
      draft === null ||
      transientStateKey !== transientDraftCacheKey(sessionUser.id, draft.id)
    ) {
      return;
    }
    cacheTransientDraft(sessionUser, draft, {
      activityBriefs: activityBriefEditBuffers,
      courseTitle: courseTitleBuffer,
      objectives: objectiveEditBuffers,
      preparation: preparationBuffer,
      sources: sourceFormDrafts,
    });
  }, [
    activityBriefEditBuffers,
    courseTitleBuffer,
    draft,
    objectiveEditBuffers,
    preparationBuffer,
    sessionUser,
    sourceFormDrafts,
    transientStateKey,
  ]);

  useEffect(() => {
    const runtimeCache = browserRuntimeCacheFor();
    if (runtimeCache !== null) {
      if (runtimeCache.sessionUser?.id !== sessionUser?.id) {
        runtimeCache.snapshot = null;
      }
      runtimeCache.sessionUser = sessionUser;
    }
    sessionUserIdRef.current = sessionUser?.id ?? null;
    coordinator.setSession(sessionUser?.id ?? null);
    onSessionUserChange?.(sessionUser);
  }, [coordinator, onSessionUserChange, sessionUser]);

  useLayoutEffect(() => {
    if (cachedRuntimeSnapshot === null && initialSnapshot !== null) {
      cacheSnapshot(initialRuntimeSessionUser, initialSnapshot);
      coordinator.setSession(initialRuntimeSessionUser?.id ?? null, initialSnapshot);
    }
  }, [cachedRuntimeSnapshot, coordinator, initialRuntimeSessionUser, initialSnapshot]);

  useEffect(() => {
    if (sessionRedirectPath === null || sessionRedirectStartedRef.current) {
      return;
    }
    sessionRedirectStartedRef.current = true;
    globalThis.location.replace(sessionRedirectPath);
  }, [sessionRedirectPath]);

  useEffect(() => {
    courseNavigationRef.current?.querySelector('[aria-current="step"]')?.scrollIntoView({
      behavior: 'auto',
      block: 'nearest',
      inline: 'center',
    });
  }, [currentWorkflowStepIndex, draft?.id]);

  const toggleSourcePreview = (sourceId: string) => {
    setExpandedSourcePreviewIds((currentIds) =>
      currentIds.includes(sourceId)
        ? currentIds.filter((currentId) => currentId !== sourceId)
        : [...currentIds, sourceId],
    );
  };

  const navigateTo = useCallback(
    (nextDraft: CourseDraft, step: DraftStep = nextDraft.step) => {
      void navigate({
        params: {
          courseId: nextDraft.id,
          lang: language,
          step: courseRouteStepSlug(language, step),
        },
        to: courseRoutePattern(language),
      });
    },
    [language, navigate],
  );

  const applySnapshot = useCallback(
    (
      nextSnapshot: WorkflowSnapshot,
      shouldNavigate = true,
      shouldSyncPreparation = true,
      shouldSyncCourseTitle = true,
    ) => {
      if (nextSnapshot.draft !== null) {
        if (shouldSyncCourseTitle) {
          setCourseTitleBuffer((current) =>
            reconcileEditBuffer(
              current,
              nextSnapshot.draft?.title ?? '',
              nextSnapshot.draft?.revision ?? 0,
            ),
          );
        }
        if (shouldSyncPreparation) {
          setPreparationBuffer((current) =>
            reconcileEditBuffer(
              current,
              nextSnapshot.draft?.learningBlueprint.coursePreparation ??
                emptyCoursePreparation(language),
              nextSnapshot.draft?.revision ?? 0,
              (left, right) => coursePreparationKey(left) === coursePreparationKey(right),
            ),
          );
        }
        if (shouldNavigate) {
          setOptimisticStep(nextSnapshot.draft.step);
          setLoadedSnapshotRouteKey(`${nextSnapshot.draft.id}:${nextSnapshot.draft.step}`);
          navigateTo(nextSnapshot.draft);
        }
      }
    },
    [language, navigateTo],
  );

  const requestIntent = (action: WorkflowActionIntent) => {
    if (
      action.action === 'getState' ||
      action.action === 'getRouteState' ||
      action.action === 'selectDraft'
    ) {
      const routeKey = requestedSnapshotRouteKey ?? coordinator.routeKey ?? 'dashboard';
      return coordinator.read(action, routeKey);
    }
    return coordinator.mutate(action);
  };

  const handleUnauthorized = useCallback(() => {
    const runtimeCache = browserRuntimeCacheFor();
    if (runtimeCache !== null) {
      const ownerId = sessionUser?.id ?? null;
      if (ownerId !== null) {
        runtimeCache.channel?.postMessage({
          clientId: runtimeCache.clientId,
          kind: 'session-invalidated',
          ownerId,
        });
      }
      runtimeCache.sessionUser = null;
      runtimeCache.snapshot = null;
    }
    setSessionUser(null);
    setIsSessionResolved(true);
    globalThis.location.replace(authRoutePath(language, 'signIn'));
  }, [language, sessionUser]);

  const runWorkflowEffect = (action: WorkflowActionIntent, shouldNavigate = true) => {
    let ownsActionLock = false;
    return Effect.gen(function* runWorkflowProgram() {
      const canRun = yield* Effect.sync(() => {
        ownsActionLock = workflowActionGateRef.current.acquire(action.action);
        return ownsActionLock;
      });
      if (!canRun) {
        return null;
      }
      yield* Effect.sync(() => {
        beginBusyAction(action.action);
      });
      const pendingSavesSucceeded = yield* Effect.promise(() =>
        coursitionPendingDraftSaves.flushAll(),
      );
      if (!pendingSavesSucceeded) {
        return null;
      }
      const previousDraft = snapshot?.draft ?? null;
      const resultExit = yield* Effect.exit(
        Effect.tryPromise({
          catch: (cause) =>
            new CoursitionUiEffectError({
              cause,
              message: errorMessageFrom(cause, t('coursition.app.errors.generic')),
            }),
          try: () => requestIntent(action),
        }),
      );
      if (Exit.isFailure(resultExit)) {
        yield* Effect.sync(() => {
          setNotice(
            errorMessageFrom(
              resultExit.cause.pipe(Cause.squash),
              t('coursition.app.errors.generic'),
            ),
          );
        });
        return null;
      }
      const outcome = resultExit.value;
      if (outcome.kind === 'unauthorized') {
        yield* Effect.sync(handleUnauthorized);
        return null;
      }
      if (outcome.kind === 'conflict') {
        yield* Effect.sync(() => {
          applySnapshot(outcome.snapshot, false);
          setNotice(outcome.conflict.message);
        });
        return null;
      }
      if (outcome.kind === 'ignored') {
        return null;
      }
      const result = outcome.snapshot;
      yield* Effect.sync(() => applySnapshot(result, shouldNavigate && outcome.canNavigate));
      const failedRun = failedGenerationRunFor(previousDraft, result.draft, action.action);
      if (failedRun !== null) {
        yield* Effect.sync(() => {
          setNotice(failedAiRunNotice(failedRun, t('coursition.app.errors.aiRunFailed')));
        });
      }
      return result;
    }).pipe(
      Effect.ensuring(
        Effect.sync(() => {
          if (!ownsActionLock) {
            return;
          }
          workflowActionGateRef.current.release(action.action);
          endBusyAction(action.action);
        }),
      ),
    );
  };

  const runWorkflow = (action: WorkflowActionIntent, shouldNavigate = true) => {
    Effect.runFork(runWorkflowEffect(action, shouldNavigate));
  };

  const commitAutosave = (
    action: Extract<
      WorkflowActionIntent,
      {
        action:
          | 'updateActivityBrief'
          | 'updateCoursePreparation'
          | 'updateDraftTitle'
          | 'updateLearningObjective';
      }
    >,
  ): Promise<WorkflowSnapshot | null> =>
    Effect.runPromise(
      Effect.gen(function* commitAutosaveProgram() {
        yield* Effect.sync(() => beginBusyAction(action.action));
        const resultExit = yield* Effect.exit(
          Effect.tryPromise({
            catch: (cause) =>
              new CoursitionUiEffectError({
                cause,
                message: errorMessageFrom(cause, t('coursition.app.errors.generic')),
              }),
            try: () => coordinator.mutate(action),
          }),
        );
        if (Exit.isFailure(resultExit)) {
          yield* Effect.sync(() => {
            setAutosaveFeedback('error');
            setNotice(
              errorMessageFrom(
                resultExit.cause.pipe(Cause.squash),
                t('coursition.app.errors.generic'),
              ),
            );
          });
          return null;
        }
        const outcome = resultExit.value;
        if (outcome.kind === 'unauthorized') {
          yield* Effect.sync(handleUnauthorized);
          return null;
        }
        if (outcome.kind === 'conflict') {
          yield* Effect.sync(() => {
            setAutosaveFeedback('error');
            applySnapshot(outcome.snapshot, false);
            setNotice(outcome.conflict.message);
          });
          return null;
        }
        if (outcome.kind !== 'applied') {
          yield* Effect.sync(() => setAutosaveFeedback('error'));
          return null;
        }
        yield* Effect.sync(() => {
          applySnapshot(outcome.snapshot, false);
          setAutosaveFeedback('saved');
        });
        return outcome.snapshot;
      }).pipe(Effect.ensuring(Effect.sync(() => endBusyAction(action.action)))),
    );

  const scheduleCourseTitleAutosave = (draftId: string, buffer: EditBuffer<string>) => {
    const title = buffer.value.trim();
    coursitionPendingDraftSaves.schedule(
      `${draftId}:title`,
      () => {
        lastSubmittedCourseTitleRef.current = title;
        return commitAutosave({ action: 'updateDraftTitle', draftId, title }).then((result) => {
          if (result?.draft === null || result?.draft === undefined) {
            lastSubmittedCourseTitleRef.current = null;
            return false;
          }
          setCourseTitleBuffer((current) =>
            commitEditBuffer(
              current,
              buffer.version,
              result.draft?.title ?? title,
              result.revision,
            ),
          );
          return true;
        });
      },
      450,
    );
  };

  const updateCourseTitle = (value: string) => {
    if (draft === null) {
      return;
    }
    const nextBuffer = updateEditBuffer(courseTitleBuffer, value);
    setCourseTitleBuffer(nextBuffer);
    setAutosaveFeedback('dirty');
    if (value.trim().length > 0) {
      scheduleCourseTitleAutosave(draft.id, nextBuffer);
    }
  };

  const saveCourseTitleOnBlur = () => {
    if (draft === null) {
      return;
    }
    const nextTitle = courseTitle.trim();
    if (nextTitle.length === 0) {
      setCourseTitleBuffer(editBuffer(draft.title, draft.revision));
      setNotice(t('coursition.app.draft.titlePlaceholder'));
      return;
    }
    const nextBuffer =
      nextTitle === courseTitle
        ? courseTitleBuffer
        : updateEditBuffer(courseTitleBuffer, nextTitle);
    setCourseTitleBuffer(nextBuffer);
    if (nextBuffer.dirty) {
      scheduleCourseTitleAutosave(draft.id, nextBuffer);
      void coursitionPendingDraftSaves.flush(`${draft.id}:title`);
    }
  };

  const schedulePreparationAutosave = (draftId: string, buffer: EditBuffer<CoursePreparation>) => {
    const submittedPreparationKey = coursePreparationKey(buffer.value);
    if (lastSubmittedPreparationKeyRef.current === submittedPreparationKey) {
      return;
    }
    coursitionPendingDraftSaves.schedule(
      `${draftId}:preparation`,
      () => {
        lastSubmittedPreparationKeyRef.current = submittedPreparationKey;
        return commitAutosave({
          action: 'updateCoursePreparation',
          draftId,
          preparation: buffer.value,
        }).then((result) => {
          if (result?.draft === null || result?.draft === undefined) {
            lastSubmittedPreparationKeyRef.current = null;
            return false;
          }
          const committedPreparation =
            result.draft?.learningBlueprint.coursePreparation ?? buffer.value;
          setPreparationBuffer((current) =>
            coursePreparationKey(current.value) === submittedPreparationKey
              ? editBuffer(committedPreparation, result.revision)
              : commitEditBuffer(current, buffer.version, committedPreparation, result.revision),
          );
          return true;
        });
      },
      650,
    );
  };

  const savePreparationOnPanelLeave = (event: FocusEvent<HTMLDivElement>) => {
    if (!focusLeftContainer(event.currentTarget, event.relatedTarget)) {
      return;
    }
    if (draft !== null && preparationBuffer.dirty) {
      schedulePreparationAutosave(draft.id, preparationBuffer);
      void coursitionPendingDraftSaves.flush(`${draft.id}:preparation`);
    }
  };

  const refreshSnapshot = useCallback(() => {
    Effect.runFork(
      Effect.gen(function* refreshSnapshotProgram() {
        yield* Effect.sync(() => {
          beginBusyAction('getState');
          setSnapshotLoadError(null);
        });
        const pendingSavesSucceeded = yield* Effect.promise(() =>
          coursitionPendingDraftSaves.flushAll(),
        );
        if (!pendingSavesSucceeded) {
          return;
        }
        const routeStateAction: Extract<
          WorkflowActionIntent,
          { action: 'getRouteState' | 'getState' }
        > =
          initialRoute === null
            ? { action: 'getState' }
            : {
                action: 'getRouteState',
                draftId: initialRoute.draftId,
                step: initialRoute.step,
              };
        const resultExit = yield* Effect.exit(
          Effect.tryPromise({
            catch: (cause) =>
              new CoursitionUiEffectError({
                cause,
                message: errorMessageFrom(cause, t('coursition.app.errors.generic')),
              }),
            try: () =>
              coordinator.read(
                routeStateAction,
                requestedSnapshotRouteKey ?? coordinator.routeKey ?? 'dashboard',
              ),
          }),
        );
        if (Exit.isFailure(resultExit)) {
          yield* Effect.sync(() => {
            const message = errorMessageFrom(
              resultExit.cause.pipe(Cause.squash),
              t('coursition.app.errors.generic'),
            );
            setNotice(message);
            if (requestedSnapshotRouteKey !== null) {
              setSnapshotLoadError({ message, routeKey: requestedSnapshotRouteKey });
            }
          });
          return;
        }
        const outcome = resultExit.value;
        if (outcome.kind === 'unauthorized') {
          yield* Effect.sync(handleUnauthorized);
          return;
        }
        if (outcome.kind === 'ignored') {
          return;
        }
        if (outcome.kind === 'conflict') {
          yield* Effect.sync(() => setNotice(outcome.conflict.message));
          return;
        }
        const nextSnapshot = outcome.snapshot;
        if (
          initialRoute !== null &&
          nextSnapshot.draft !== null &&
          nextSnapshot.draft.step !== initialRoute.step
        ) {
          const canonicalDraft = nextSnapshot.draft;
          yield* Effect.sync(() => {
            applySnapshot(nextSnapshot, false);
            setLoadedSnapshotRouteKey(`${canonicalDraft.id}:${canonicalDraft.step}`);
            setSnapshotLoadError(null);
            void navigate({
              params: {
                courseId: canonicalDraft.id,
                lang: language,
                step: courseRouteStepSlug(language, canonicalDraft.step),
              },
              replace: true,
              to: courseRoutePattern(language),
            });
          });
          return;
        }
        yield* Effect.sync(() => {
          applySnapshot(nextSnapshot, false);
          setLoadedSnapshotRouteKey(requestedSnapshotRouteKey);
          setSnapshotLoadError(null);
        });
        // eslint-disable-next-line react-compiler/react-compiler -- The guarded bootstrap owns this Effect callback's lifecycle.
      }).pipe(Effect.ensuring(Effect.sync(() => endBusyAction('getState')))),
    );
    // The refs and Effect callbacks intentionally capture the current route and translator.
    // eslint-disable-next-line react-compiler/react-compiler -- The route bootstrap must remain stable until its guarded effect runs.
  }, [
    applySnapshot,
    coordinator,
    handleUnauthorized,
    initialRoute,
    language,
    navigate,
    requestedSnapshotRouteKey,
    t,
  ]);

  useEffect(() => {
    const runtimeCache = browserRuntimeCacheFor();
    const routeKey = requestedSnapshotRouteKey;
    if (runtimeCache === null || sessionUser === null || routeKey === null) {
      return;
    }
    const revalidate = () => {
      if (
        shouldRevalidateWorkflow({
          isReading: coordinator.isReadingRoute(routeKey),
          isVisible: document.visibilityState === 'visible',
          routeKey,
          sessionId: sessionUser.id,
        })
      ) {
        refreshSnapshot();
      }
    };
    const onFocus = () => revalidate();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        revalidate();
      }
    };
    const onChannelMessage = (event: MessageEvent<unknown>) => {
      const invalidationKind = workflowInvalidationKindForSession(event.data, {
        clientId: runtimeCache.clientId,
        ownerId: sessionUser.id,
      });
      if (invalidationKind === 'session-invalidated') {
        coordinator.invalidateSession();
        runtimeCache.sessionUser = null;
        runtimeCache.snapshot = null;
        setSessionUser(null);
        setIsSessionResolved(true);
        globalThis.location.replace(authRoutePath(language, 'signIn'));
        return;
      }
      if (invalidationKind !== 'mutation-committed') {
        return;
      }
      revalidate();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);
    runtimeCache.channel?.addEventListener('message', onChannelMessage);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      runtimeCache.channel?.removeEventListener('message', onChannelMessage);
    };
  }, [coordinator, language, refreshSnapshot, requestedSnapshotRouteKey, sessionUser]);

  const showEffectError = (error: unknown) =>
    Effect.sync(() => {
      setNotice(errorMessageFrom(error, t('coursition.app.errors.generic')));
    });

  const authRequestEffect = () =>
    Effect.tryPromise({
      catch: (cause) =>
        new CoursitionUiEffectError({
          cause,
          message: errorMessageFrom(
            cause,
            t(
              activeAuthMode === 'signUp'
                ? 'coursition.app.auth.signUpFailed'
                : 'coursition.app.auth.signInFailed',
            ),
          ),
        }),
      try: () =>
        activeAuthMode === 'signUp'
          ? effectBff.client.auth.signUp({
              payload: { email: authEmail, name: authName, password: authPassword },
            })
          : effectBff.client.auth.signIn({
              payload: { email: authEmail, password: authPassword },
            }),
    }).pipe(Effect.asVoid);

  const authEffect = () =>
    Effect.gen(function* authProgram() {
      yield* Effect.sync(() => {
        beginBusyAction('auth');
      });
      const authExit = yield* Effect.exit(authRequestEffect());
      if (Exit.isFailure(authExit)) {
        yield* showEffectError(authExit.cause.pipe(Cause.squash));
        return;
      }
      const payloadExit = yield* Effect.exit(
        sessionRequestEffect(t('coursition.app.errors.generic')),
      );
      if (Exit.isFailure(payloadExit)) {
        yield* showEffectError(payloadExit.cause.pipe(Cause.squash));
        return;
      }
      const user = payloadExit.value.session?.user ?? null;
      yield* Effect.sync(() => {
        setSessionUser(user);
        setIsSessionResolved(true);
      });
    }).pipe(Effect.ensuring(Effect.sync(() => endBusyAction('auth'))));

  useEffect(() => {
    if (initialRuntimeSessionUser !== null || sessionBootstrapStartedRef.current) {
      return;
    }
    sessionBootstrapStartedRef.current = true;
    const fallbackMessage = t('coursition.app.errors.generic');
    Effect.runFork(
      sessionRequestEffect(fallbackMessage).pipe(
        Effect.matchEffect({
          onFailure: (error) =>
            Effect.sync(() => {
              setSessionBootstrapError(errorMessageFrom(error, fallbackMessage));
              setIsSessionResolved(false);
            }),
          onSuccess: (payload) =>
            Effect.sync(() => {
              setSessionBootstrapError(null);
              setSessionUser(payload.session?.user ?? null);
              setIsSessionResolved(true);
            }),
        }),
      ),
    );
  }, [initialRuntimeSessionUser, sessionBootstrapAttempt, t]);

  useLayoutEffect(() => {
    coordinator.setRoute(requestedSnapshotRouteKey);
    if (
      sessionUser === null ||
      requestedSnapshotRouteKey === null ||
      loadedSnapshotRouteKey === requestedSnapshotRouteKey
    ) {
      return;
    }
    const cachedRouteSnapshot = cachedSnapshotFor(sessionUser, requestedSnapshotRouteKey);
    if (cachedRouteSnapshot === null) {
      return;
    }
    // eslint-disable-next-line react-compiler/react-compiler -- Cached route state must be applied before paint to prevent a stale-screen flash.
    applySnapshot(cachedRouteSnapshot, false);
    setLoadedSnapshotRouteKey(requestedSnapshotRouteKey);
    setSnapshotLoadError(null);
  }, [applySnapshot, coordinator, loadedSnapshotRouteKey, requestedSnapshotRouteKey, sessionUser]);

  useEffect(() => {
    if (sessionUser === null) {
      return;
    }
    if (
      requestedSnapshotRouteKey === null ||
      loadedSnapshotRouteKey === requestedSnapshotRouteKey ||
      snapshotLoadError?.routeKey === requestedSnapshotRouteKey ||
      coordinator.isReadingRoute(requestedSnapshotRouteKey)
    ) {
      return;
    }
    refreshSnapshot();
  }, [
    coordinator,
    loadedSnapshotRouteKey,
    refreshSnapshot,
    requestedSnapshotRouteKey,
    sessionUser,
    snapshotLoadError?.routeKey,
  ]);

  const handleAuth = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    Effect.runFork(authEffect());
  };

  const createDraft = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = draftTitle.trim();
    if (title.length === 0) {
      setNotice(t('coursition.app.draft.titlePlaceholder'));
      return;
    }
    Effect.runFork(
      runWorkflowEffect({ action: 'createDraft', language, title }).pipe(
        Effect.flatMap((result) =>
          Effect.sync(() => {
            if (result?.draft !== undefined && result.draft !== null) {
              setDraftTitle('');
            }
          }),
        ),
      ),
    );
  };

  const selectDraft = (draftId: string) => {
    void runWorkflow({ action: 'selectDraft', draftId });
  };

  const deleteDraft = (draftId: string) => {
    void runWorkflow({ action: 'deleteDraft', confirm: true, draftId }, false);
  };

  const setMode = (mode: AiMode) => {
    if (draft === null) {
      return;
    }
    updateModeWithoutNavigation(runWorkflow, draft.id, mode);
  };

  const addSource = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (draft === null) {
      return;
    }
    const sourceFormDraft = sourceFormDrafts[sourceType];
    const submittedSourceType = sourceType;
    const submittedSourceVersion = sourceFormDraft.version;
    const previousSourceIds = new Set(draft.sources.map((source) => source.id));
    const name = sourceFormDraft.name.trim() || (sourceFormDraft.file?.name ?? '');
    if (name.length === 0) {
      if (submittedSourceType === 'file') {
        setFileSourceFeedback({
          kind: 'error',
          message: t('coursition.app.sources.sourceNameRequired'),
        });
      }
      setNotice(t('coursition.app.sources.sourceNameRequired'));
      return;
    }
    const submitSource = (content: string, localExtraction: AnydocExtraction | null = null) => {
      if (submittedSourceType !== 'file' && content.trim().length === 0) {
        return Effect.sync(() => setNotice(t('coursition.app.errors.generic')));
      }
      return runWorkflowEffect({
        action: 'addSource',
        draftId: draft.id,
        source:
          submittedSourceType === 'file' && localExtraction !== null
            ? { content, localExtraction, name, type: 'file' }
            : {
                content,
                name,
                type: submittedSourceType,
              },
      }).pipe(
        Effect.flatMap((result) =>
          Effect.sync(() => {
            if (result === null) {
              if (submittedSourceType === 'file') {
                setFileSourceFeedback({
                  kind: 'error',
                  message: t('coursition.app.sources.fileAddFailed'),
                });
              }
              return;
            }
            const addedSource = addedSourceAfterSubmission(
              previousSourceIds,
              result.draft?.sources ?? [],
              submittedSourceType,
              name,
            );
            if (addedSource === null) {
              if (submittedSourceType === 'file') {
                setFileSourceFeedback({
                  kind: 'error',
                  message: t('coursition.app.sources.fileAddFailed'),
                });
              }
              return;
            }
            setSourceFormDrafts((current) =>
              resetSubmittedSourceDraft(current, submittedSourceType, submittedSourceVersion),
            );
            if (submittedSourceType === 'file') {
              if (sourceFormDraftsRef.current.file.version === submittedSourceVersion) {
                setFileInputResetKey((current) => current + 1);
              }
              const failureReason = addedSource.failureReason?.trim() ?? '';
              if (
                failureReason.length > 0 ||
                addedSource.status === 'failed' ||
                addedSource.status === 'partially_processed' ||
                addedSource.status === 'unsupported'
              ) {
                setFileSourceFeedback({
                  kind: 'error',
                  message:
                    failureReason.length > 0
                      ? failureReason
                      : t('coursition.app.sources.fileAddFailed'),
                });
              } else if (
                addedSource.status === 'processing' ||
                addedSource.status === 'queued' ||
                addedSource.status === 'uploaded'
              ) {
                setFileSourceFeedback({
                  kind: 'pending',
                  message: t('coursition.app.sources.fileProcessing'),
                });
              } else {
                setFileSourceFeedback(null);
              }
            }
          }),
        ),
      );
    };
    if (sourceType === 'file') {
      const sourceFile = sourceFormDraft.file;
      if (sourceFile === null) {
        setFileSourceFeedback({
          kind: 'error',
          message: t('coursition.app.sources.fileRequired'),
        });
        setNotice(t('coursition.app.errors.generic'));
        return;
      }
      if (sourceFile.size > MAX_SOURCE_FILE_BYTES) {
        setFileSourceFeedback({
          kind: 'error',
          message: t('coursition.app.sources.fileTooLarge'),
        });
        setNotice(t('coursition.app.sources.fileTooLarge'));
        return;
      }
      setFileSourceFeedback({
        kind: 'pending',
        message: t('coursition.app.sources.fileProcessing'),
      });
      Effect.runFork(
        Effect.gen(function* addFileSourceProgram() {
          yield* Effect.sync(() => beginBusyAction('file'));
          const payloadExit = yield* Effect.exit(filePayloadFromEffect(sourceFile));
          if (Exit.isFailure(payloadExit)) {
            const error = payloadExit.cause.pipe(Cause.squash);
            const message = errorMessageFrom(error, t('coursition.app.sources.fileReadFailed'));
            yield* Effect.sync(() => {
              setFileSourceFeedback({ kind: 'error', message });
              setNotice(message);
            });
            return;
          }
          /* Opportunistic: a failed or unsupported local conversion resolves to
           * null and the upload takes the unchanged cloud path. */
          const localExtraction = yield* extractAnydocFromFile(sourceFile);
          yield* submitSource(payloadExit.value, localExtraction);
        }).pipe(Effect.ensuring(Effect.sync(() => endBusyAction('file')))),
      );
      return;
    }
    Effect.runFork(submitSource(sourceFormDraft.content));
  };

  const selectSourceType = (type: SourceType) => {
    if (type === sourceType) {
      return;
    }
    setSourceType(type);
  };

  const updateSourceFormDraft = (type: SourceType, changes: Partial<SourceFormDraft>) => {
    setSourceFormDrafts((current) => updateVersionedSourceFormDraft(current, type, changes));
  };

  const updatePreparationField = <Field extends keyof CoursePreparation>(
    field: Field,
    value: CoursePreparation[Field],
  ) => {
    if (draft === null) {
      return;
    }
    const nextPreparation = {
      ...preparation,
      [field]: value,
    };
    const nextBuffer = updateEditBuffer(preparationBuffer, nextPreparation);
    setPreparationBuffer(nextBuffer);
    setAutosaveFeedback('dirty');
    schedulePreparationAutosave(draft.id, nextBuffer);
  };

  const scheduleObjectiveAutosave = (
    draftId: string,
    objectiveId: string,
    buffer: EditBuffer<ObjectiveEditValue>,
  ) => {
    const submittedKey = objectiveEditKey(buffer.value.title, buffer.value.capability);
    coursitionPendingDraftSaves.schedule(
      `${draftId}:objective:${objectiveId}`,
      () => {
        lastSubmittedObjectiveKeyRef.current.set(objectiveId, submittedKey);
        return commitAutosave({
          action: 'updateLearningObjective',
          capability: buffer.value.capability,
          draftId,
          objectiveId,
          title: buffer.value.title,
        }).then((result) => {
          const committedObjective = result?.draft?.learningBlueprint.objectives.find(
            (objective) => objective.id === objectiveId,
          );
          if (
            result?.draft === null ||
            result?.draft === undefined ||
            committedObjective === undefined
          ) {
            lastSubmittedObjectiveKeyRef.current.delete(objectiveId);
            return false;
          }
          setObjectiveEditBuffers((current) => ({
            ...current,
            [objectiveId]: commitEditBuffer(
              current[objectiveId] ?? buffer,
              buffer.version,
              {
                capability: normalizedGeneratedText(committedObjective.capability),
                title: committedObjective.title,
              },
              result.draft?.revision ?? result.revision,
            ),
          }));
          return true;
        });
      },
      600,
    );
  };

  const updateObjectiveBuffer = (objectiveId: string, changes: Partial<ObjectiveEditValue>) => {
    if (draft === null) {
      return;
    }
    const current = objectiveEditBuffers[objectiveId];
    if (current === undefined) {
      return;
    }
    const next = updateEditBuffer(current, { ...current.value, ...changes });
    setObjectiveEditBuffers((buffers) => ({ ...buffers, [objectiveId]: next }));
    setAutosaveFeedback('dirty');
    scheduleObjectiveAutosave(draft.id, objectiveId, next);
  };

  const saveObjectiveOnBlur = (event: FocusEvent<HTMLFormElement>, objectiveId: string) => {
    if (!focusLeftContainer(event.currentTarget, event.relatedTarget)) {
      return;
    }
    const buffer = objectiveEditBuffers[objectiveId];
    if (draft !== null && buffer?.dirty === true) {
      scheduleObjectiveAutosave(draft.id, objectiveId, buffer);
      void coursitionPendingDraftSaves.flush(`${draft.id}:objective:${objectiveId}`);
    }
  };

  const saveObjectiveOnSubmit = (event: FormEvent<HTMLFormElement>, objectiveId: string) => {
    event.preventDefault();
    const buffer = objectiveEditBuffers[objectiveId];
    if (draft !== null && buffer?.dirty === true) {
      scheduleObjectiveAutosave(draft.id, objectiveId, buffer);
      void coursitionPendingDraftSaves.flush(`${draft.id}:objective:${objectiveId}`);
    }
  };

  const scheduleActivityBriefAutosave = (
    draftId: string,
    briefId: string,
    buffer: EditBuffer<ActivityBriefEditValue>,
  ) => {
    const submittedKey = activityBriefEditKey(buffer.value);
    coursitionPendingDraftSaves.schedule(
      `${draftId}:activity:${briefId}`,
      () => {
        lastSubmittedActivityBriefKeyRef.current.set(briefId, submittedKey);
        return commitAutosave({
          action: 'updateActivityBrief',
          briefId,
          draftId,
          ...buffer.value,
        }).then((result) => {
          const committedBrief = result?.draft?.learningBlueprint.activityBriefs.find(
            (brief) => brief.id === briefId,
          );
          if (
            result?.draft === null ||
            result?.draft === undefined ||
            committedBrief === undefined
          ) {
            lastSubmittedActivityBriefKeyRef.current.delete(briefId);
            return false;
          }
          setActivityBriefEditBuffers((current) => ({
            ...current,
            [briefId]: commitEditBuffer(
              current[briefId] ?? buffer,
              buffer.version,
              {
                feedbackGuidance: normalizedGeneratedText(committedBrief.feedbackGuidance),
                instructions: normalizedGeneratedText(committedBrief.instructions),
                learnerAction: normalizedGeneratedText(committedBrief.learnerAction),
                successCriteria: normalizedGeneratedText(committedBrief.successCriteria),
                title: committedBrief.title,
                type: committedBrief.type,
              },
              result.draft?.revision ?? result.revision,
            ),
          }));
          return true;
        });
      },
      600,
    );
  };

  const updateActivityBriefBuffer = (briefId: string, changes: Partial<ActivityBriefEditValue>) => {
    if (draft === null) {
      return;
    }
    const current = activityBriefEditBuffers[briefId];
    if (current === undefined) {
      return;
    }
    const next = updateEditBuffer(current, { ...current.value, ...changes });
    setActivityBriefEditBuffers((buffers) => ({ ...buffers, [briefId]: next }));
    setAutosaveFeedback('dirty');
    scheduleActivityBriefAutosave(draft.id, briefId, next);
  };

  const saveActivityBriefOnBlur = (event: FocusEvent<HTMLFormElement>, briefId: string) => {
    if (!focusLeftContainer(event.currentTarget, event.relatedTarget)) {
      return;
    }
    const buffer = activityBriefEditBuffers[briefId];
    if (draft !== null && buffer?.dirty === true) {
      scheduleActivityBriefAutosave(draft.id, briefId, buffer);
      void coursitionPendingDraftSaves.flush(`${draft.id}:activity:${briefId}`);
    }
  };

  const saveActivityBriefOnSubmit = (event: FormEvent<HTMLFormElement>, briefId: string) => {
    event.preventDefault();
    const buffer = activityBriefEditBuffers[briefId];
    if (draft !== null && buffer?.dirty === true) {
      scheduleActivityBriefAutosave(draft.id, briefId, buffer);
      void coursitionPendingDraftSaves.flush(`${draft.id}:activity:${briefId}`);
    }
  };

  const goToStep = (step: DraftStep) => {
    if (draft === null || step === activeStep) {
      return;
    }
    const gate = navigationGateFor(navigationDraft ?? draft, step);
    if (!gate.allowed) {
      return;
    }
    const routeKey = `${draft.id}:${step}`;
    setOptimisticStep(step);
    coordinator.setRoute(routeKey);
    setLoadedSnapshotRouteKey(routeKey);
    setSnapshotLoadError(null);
    navigateTo(draft, step);
  };

  const nextStep = () => {
    if (draft === null) {
      return;
    }
    if (activeStep === 'mode') {
      goToStep('sources');
      return;
    }
    if (
      draft.mode === 'generate' &&
      isNavigationStepComplete(draft, 'preview') &&
      !isNavigationStepStale(draft, 'preview')
    ) {
      goToStep('preview');
      return;
    }
    const next = navigationSteps[workflowStepIndex(activeStep) + 1];
    if (
      next !== undefined &&
      isNavigationStepComplete(draft, next) &&
      !isNavigationStepStale(draft, next)
    ) {
      goToStep(next);
      return;
    }
    runWorkflow({ action: 'advanceDraft', draftId: draft.id, step: activeStep });
  };

  const previousStep = () => {
    if (draft === null) {
      return;
    }
    if (activeStep === 'preview') {
      goToStep('courseContent');
      return;
    }
    const currentIndex = workflowStepIndex(activeStep);
    const previous = workflowSteps[currentIndex - 1];
    if (previous !== undefined) {
      goToStep(previous);
    }
  };

  const advanceStatus =
    draft?.mode === 'generate' && activeStep !== 'mode'
      ? t('coursition.app.navigation.advancingByStep.generateCourse')
      : t(`coursition.app.navigation.advancingByStep.${activeStep}`);
  const autosaveStatus = isAutosaveBusy ? 'saving' : autosaveFeedback;

  if (sessionBootstrapError !== null) {
    return (
      <div className="mx-auto grid w-full max-w-[80rem] gap-4">
        <ClientToaster />
        <SnapshotErrorView
          message={sessionBootstrapError}
          onRetry={() => {
            sessionBootstrapStartedRef.current = false;
            setSessionBootstrapError(null);
            setSessionBootstrapAttempt((attempt) => attempt + 1);
          }}
          t={t}
        />
      </div>
    );
  }

  if (!isSessionResolved || sessionRedirectPath !== null) {
    return (
      <div className="mx-auto grid min-h-[calc(100dvh-3.5rem)] w-full max-w-[80rem] gap-4">
        <ClientToaster />
        <CoursitionLoadingView routeKind={routeKind} t={t} />
      </div>
    );
  }

  if (sessionUser === null && authMode !== null) {
    return (
      <div className="mx-auto grid min-h-[calc(100dvh-3.5rem)] w-full max-w-lg place-items-center px-4 py-8">
        <ClientToaster />
        <div className="grid w-full gap-8">
          <div className="grid gap-2 text-center">
            <h1 className="text-3xl font-semibold tracking-tight text-fg-primary">
              {t('coursition.common.productName')}
            </h1>
            <p className="text-sm text-fg-secondary">{t('coursition.app.eyebrow')}</p>
          </div>
          <section className="w-full rounded-xl bg-surface p-6 shadow-lg dark:shadow-none sm:p-9">
            <form className="grid gap-6" onSubmit={handleAuth}>
              <Tabs
                fitted
                onValueChange={(value) =>
                  globalThis.location.assign(
                    authRoutePath(language, value === 'signUp' ? 'signUp' : 'signIn'),
                  )
                }
                value={activeAuthMode}
                variant="solid"
              >
                <Tabs.List className="gap-1 rounded-lg bg-fill-base p-1">
                  <Tabs.Trigger className="min-h-11" value="signIn">
                    {t('coursition.app.auth.signIn')}
                  </Tabs.Trigger>
                  <Tabs.Trigger className="min-h-11" value="signUp">
                    {t('coursition.app.auth.signUp')}
                  </Tabs.Trigger>
                </Tabs.List>
              </Tabs>
              <TextInputField
                label={t('coursition.app.auth.email')}
                name="email"
                onChange={(event) => setAuthEmail(event.currentTarget.value)}
                placeholder={t('coursition.app.auth.emailPlaceholder')}
                required
                type="email"
                value={authEmail}
              />
              {activeAuthMode === 'signUp' ? (
                <TextInputField
                  label={t('coursition.app.auth.name')}
                  name="name"
                  onChange={(event) => setAuthName(event.currentTarget.value)}
                  placeholder={t('coursition.app.auth.namePlaceholder')}
                  required
                  value={authName}
                />
              ) : null}
              <TextInputField
                label={t('coursition.app.auth.password')}
                name="password"
                onChange={(event) => setAuthPassword(event.currentTarget.value)}
                placeholder={t('coursition.app.auth.passwordPlaceholder')}
                required
                type="password"
                value={authPassword}
              />
              <Button disabled={isAuthBusy} type="submit" variant="primary">
                {busyAction === 'auth'
                  ? t(
                      activeAuthMode === 'signUp'
                        ? 'coursition.app.auth.creatingAccount'
                        : 'coursition.app.auth.signingIn',
                    )
                  : t(
                      activeAuthMode === 'signUp'
                        ? 'coursition.app.auth.createAccount'
                        : 'coursition.app.auth.signIn',
                    )}
              </Button>
            </form>
          </section>
        </div>
      </div>
    );
  }

  const currentSnapshotLoadError =
    snapshotLoadError?.routeKey === requestedSnapshotRouteKey ? snapshotLoadError : null;
  const snapshotLoadStatus = snapshotLoadStatusFor({
    errorRouteKey: snapshotLoadError?.routeKey ?? null,
    loadedRouteKey: loadedSnapshotRouteKey,
    requestedRouteKey: requestedSnapshotRouteKey,
  });
  if (snapshotLoadStatus !== 'ready') {
    if (snapshotLoadStatus === 'error' && currentSnapshotLoadError !== null) {
      return (
        <div className="mx-auto grid w-full max-w-[80rem] gap-4">
          <ClientToaster />
          <SnapshotErrorView
            message={currentSnapshotLoadError.message}
            onRetry={refreshSnapshot}
            t={t}
          />
        </div>
      );
    }
    return (
      <div className="mx-auto grid w-full max-w-[80rem] gap-4">
        <ClientToaster />
        <CoursitionLoadingView routeKind={routeKind} t={t} />
      </div>
    );
  }

  const draftSummaries = snapshot?.drafts ?? [];

  return (
    <div className="mx-auto grid w-full max-w-[80rem] gap-5">
      <ClientToaster />

      {draft === null ? (
        <section className="grid gap-8">
          <header className="grid max-w-3xl gap-1">
            <h1 className="text-3xl font-semibold tracking-tight text-fg-primary sm:text-4xl">
              {t('coursition.app.dashboard.title')}
            </h1>
            <p className={mutedTextClass}>{t('coursition.app.dashboard.summary')}</p>
          </header>
          <form
            className={`${insetSurfaceClass} grid w-full max-w-4xl gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end`}
            onSubmit={createDraft}
          >
            <TextInputField
              label={t('coursition.app.draft.title')}
              name="title"
              onChange={(event) => setDraftTitle(event.currentTarget.value)}
              required
              value={draftTitle}
            />
            <Button
              className="min-h-12 px-6 text-base"
              disabled={isCreateDraftBusy}
              type="submit"
              variant="primary"
            >
              {t('coursition.app.draft.create')}
            </Button>
          </form>

          {draftSummaries.length === 0 ? (
            <p className={mutedTextClass}>{t('coursition.app.dashboard.empty')}</p>
          ) : (
            <section className="grid gap-5">
              <ul className="grid gap-3">
                {draftSummaries.map((summary) => (
                  <li
                    className={`${insetSurfaceClass} grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center`}
                    key={summary.id}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          className="text-lg font-semibold text-fg-primary no-underline"
                          params={{
                            courseId: summary.id,
                            lang: language,
                            step: courseRouteStepSlug(language, summary.step),
                          }}
                          to={courseRoutePattern(language)}
                        >
                          {summary.title}
                        </Link>
                        {summary.id.includes('_seed_') ? (
                          <Badge size="sm" variant="outline">
                            {t('coursition.app.dashboard.demoBadge')}
                          </Badge>
                        ) : null}
                      </div>
                      <p className={mutedTextClass}>
                        {t('coursition.app.dashboard.courseMeta', {
                          activities: t('coursition.app.dashboard.counts.activities.other', {
                            count: summary.activityCount,
                          }),
                          content: t('coursition.app.dashboard.counts.content.other', {
                            count: summary.sectionCount,
                          }),
                          mode: t(`coursition.app.modes.${summary.mode}.label`),
                          sources: t('coursition.app.dashboard.counts.sources.other', {
                            count: summary.sourceCount,
                          }),
                          step: t(`coursition.app.steps.${summary.step}`),
                        })}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 md:justify-end">
                      <Button
                        disabled={isDraftListBusy}
                        onClick={() => selectDraft(summary.id)}
                        type="button"
                        variant="primary"
                      >
                        {t('coursition.app.draft.resume')}
                      </Button>
                      <ConfirmDeleteButton
                        cancelLabel={t('coursition.app.dashboard.cancel')}
                        confirmLabel={t('coursition.app.dashboard.delete')}
                        description={t('coursition.app.dashboard.confirmDeleteMessage')}
                        disabled={isDraftListBusy}
                        label={t('coursition.app.dashboard.delete')}
                        onConfirm={() => deleteDraft(summary.id)}
                        title={t('coursition.app.dashboard.confirmDelete')}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </section>
      ) : (
        <section className="grid min-w-0 gap-2">
          <section className={studioHeaderClass}>
            <div className="grid gap-3 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
              <div className="grid min-w-0 gap-1 sm:flex-1">
                <h1 className="min-w-0">
                  <Input
                    aria-label={t('coursition.app.draft.title')}
                    className="coursition-title-input"
                    onBlur={saveCourseTitleOnBlur}
                    onChange={(event) => updateCourseTitle(event.currentTarget.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        event.currentTarget.blur();
                      }
                    }}
                    placeholder={t('coursition.app.draft.titlePlaceholder')}
                    value={courseTitle}
                  />
                </h1>
                <p className="text-sm font-medium text-fg-secondary">
                  {t(`coursition.app.steps.${activeStep}`)}
                </p>
                {autosaveStatus === 'idle' ? null : (
                  <output
                    aria-atomic="true"
                    aria-live="polite"
                    className={
                      autosaveStatus === 'error' ? `${mutedTextClass} text-danger` : mutedTextClass
                    }
                  >
                    {t(`coursition.app.autosave.${autosaveStatus}`)}
                  </output>
                )}
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                {activeStep === 'mode' ? null : (
                  <Button
                    disabled={isRouteActionBusy}
                    onClick={previousStep}
                    type="button"
                    variant="primary"
                    theme="light"
                  >
                    {t('coursition.app.navigation.back')}
                  </Button>
                )}
                {activeStep === 'preview' ? null : (
                  <Button
                    aria-busy={isAdvanceDraftBusy}
                    disabled={isRouteActionBusy}
                    onClick={nextStep}
                    type="button"
                    variant="primary"
                  >
                    {isAdvanceDraftBusy ? advanceStatus : t('coursition.app.navigation.next')}
                  </Button>
                )}
              </div>
            </div>
            {isAdvanceDraftBusy ? (
              <output aria-live="polite" className={mutedTextClass}>
                {advanceStatus}
              </output>
            ) : null}
            <nav
              aria-label={t('coursition.app.navigation.label')}
              className="coursition-workflow-navigation min-w-0"
              ref={courseNavigationRef}
            >
              <Steps
                className="max-w-full min-w-0 pb-1"
                count={navigationSteps.length}
                linear={false}
                size="sm"
                step={currentWorkflowStepIndex}
                variant="subtle"
              >
                <Steps.List className="coursition-workflow-step-list w-full !justify-start">
                  {navigationSteps.map((step, index) => {
                    const gate = navigationGateFor(navigationDraft ?? draft, step);
                    const isCurrentStep = step === activeStep;
                    const isStepComplete = isNavigationStepComplete(draft, step);
                    const isStepStale = isNavigationStepStale(draft, step);
                    const isStepReady =
                      step === 'preview' && getWorkflowPreviewGate(draft).allowed && !isStepStale;
                    const isStepVisuallyComplete = isStepComplete && !isCurrentStep;
                    const visualState = {
                      isComplete: isStepVisuallyComplete,
                      isCurrent: isCurrentStep,
                      isReady: isStepReady,
                      isStale: isStepStale,
                    };
                    const isStepDisabled = isRouteActionBusy || !gate.allowed;
                    const canNavigateToStep = step !== activeStep && !isStepDisabled;
                    return (
                      <Steps.Item className="min-w-max flex-1" index={index} key={step}>
                        <Steps.Trigger
                          aria-current={isCurrentStep ? 'step' : undefined}
                          className={navigationTriggerClass}
                          data-current-step={isCurrentStep ? true : undefined}
                          disabled={isStepDisabled}
                          onClick={(event) => {
                            event.preventDefault();
                            if (!canNavigateToStep) {
                              return;
                            }
                            goToStep(step);
                          }}
                        >
                          <Steps.Indicator
                            className={navigationIndicatorClass(visualState)}
                            data-complete={isStepVisuallyComplete ? true : undefined}
                            data-ready={isStepReady ? true : undefined}
                          >
                            <NavigationStepIndicatorContent
                              index={index}
                              isComplete={isStepVisuallyComplete}
                              isReady={isStepReady}
                              isStale={isStepStale}
                              readyLabel={t('coursition.app.navigation.ready')}
                              staleLabel={t('coursition.app.navigation.stale')}
                            />
                          </Steps.Indicator>
                          <Steps.ItemText className="min-w-max">
                            <Steps.Title
                              className={navigationTitleClass(visualState)}
                              data-complete={isStepVisuallyComplete ? true : undefined}
                              data-ready={isStepReady ? true : undefined}
                            >
                              {t(`coursition.app.steps.${step}`)}
                            </Steps.Title>
                          </Steps.ItemText>
                        </Steps.Trigger>
                        {index < navigationSteps.length - 1 ? (
                          <span aria-hidden="true" className={navigationSeparatorClass}>
                            <span className="h-px w-full rounded-full bg-gradient-to-r from-transparent via-current to-transparent" />
                          </span>
                        ) : null}
                      </Steps.Item>
                    );
                  })}
                </Steps.List>
              </Steps>
            </nav>
          </section>

          {activeStep === 'mode' ? (
            <section className={workspaceSectionClass}>
              <div>
                <h2 className="text-xl font-semibold text-fg-primary">
                  {t('coursition.app.steps.mode')}
                </h2>
                <p className={mutedTextClass}>{t('coursition.app.modes.help')}</p>
              </div>
              <RadioCard
                className="grid gap-3 md:grid-cols-2"
                disabled={isModeBusy}
                itemOrientation="horizontal"
                onValueChange={(value) => {
                  if (value !== null && isAiMode(value)) {
                    setMode(value);
                  }
                }}
                orientation="horizontal"
                value={draft.mode}
                variant="subtle"
              >
                <RadioCard.Label className="sr-only">
                  {t('coursition.app.steps.mode')}
                </RadioCard.Label>
                {(['generate', 'assist'] as const).map((mode) => (
                  <RadioCard.Item key={mode} value={mode}>
                    <RadioCard.ItemHiddenInput />
                    <RadioCard.ItemControl>
                      <RadioCard.ItemContent className="gap-2">
                        <RadioCard.ItemText>
                          {t(`coursition.app.modes.${mode}.label`)}
                        </RadioCard.ItemText>
                        <RadioCard.ItemDescription>
                          {t(`coursition.app.modes.${mode}.body`)}
                        </RadioCard.ItemDescription>
                        <RadioCard.ItemDescription className={tinyMetaClass}>
                          {t(`coursition.app.modes.${mode}.impact`)}
                        </RadioCard.ItemDescription>
                      </RadioCard.ItemContent>
                      <RadioCard.ItemIndicator />
                    </RadioCard.ItemControl>
                  </RadioCard.Item>
                ))}
              </RadioCard>
            </section>
          ) : null}

          {activeStep === 'sources' ? (
            <section className={workspaceSectionClass}>
              <div>
                <h2 className="text-xl font-semibold text-fg-primary">
                  {t('coursition.app.sources.title')}
                </h2>
              </div>
              <form className={`${insetSurfaceClass} grid max-w-4xl gap-4`} onSubmit={addSource}>
                <Tabs
                  className="grid gap-4"
                  onValueChange={(value) => {
                    if (value === 'notes' || value === 'url' || value === 'file') {
                      selectSourceType(value);
                    }
                  }}
                  size="md"
                  value={sourceType}
                  variant="line"
                >
                  <Tabs.List>
                    {sourceTypes.map((type) => (
                      <Tabs.Trigger key={type} value={type}>
                        {t(`coursition.app.sourceTypes.${type}`)}
                      </Tabs.Trigger>
                    ))}
                    <Tabs.Indicator />
                  </Tabs.List>
                  <Tabs.Content className="grid gap-4" value="notes">
                    <TextInputField
                      disabled={sourceType !== 'notes'}
                      id="notesSourceName"
                      label={t('coursition.app.sources.sourceName')}
                      name="sourceName"
                      onChange={(event) =>
                        updateSourceFormDraft('notes', { name: event.currentTarget.value })
                      }
                      placeholder={t('coursition.app.sources.notesNamePlaceholder')}
                      required
                      value={sourceFormDrafts.notes.name}
                    />
                    <FormTextarea
                      disabled={sourceType !== 'notes'}
                      id="notesSourceContent"
                      label={t('coursition.app.sources.notesContent')}
                      name="sourceContent"
                      onChange={(event) =>
                        updateSourceFormDraft('notes', { content: event.currentTarget.value })
                      }
                      placeholder={t('coursition.app.sources.notesPlaceholder')}
                      required
                      rows={8}
                      value={sourceFormDrafts.notes.content}
                    />
                    <Button
                      className="justify-self-start"
                      disabled={isSourceAddBusy}
                      type="submit"
                      variant="primary"
                    >
                      {busyAction === 'addSource' || busyAction === 'file'
                        ? t('coursition.app.sources.adding')
                        : t('coursition.app.sources.add')}
                    </Button>
                  </Tabs.Content>
                  <Tabs.Content className="grid gap-4" value="url">
                    <TextInputField
                      disabled={sourceType !== 'url'}
                      id="urlSourceName"
                      label={t('coursition.app.sources.sourceName')}
                      name="sourceName"
                      onChange={(event) =>
                        updateSourceFormDraft('url', { name: event.currentTarget.value })
                      }
                      placeholder={t('coursition.app.sources.urlNamePlaceholder')}
                      required
                      value={sourceFormDrafts.url.name}
                    />
                    <TextInputField
                      disabled={sourceType !== 'url'}
                      id="urlSourceContent"
                      label={t('coursition.app.sources.urlContent')}
                      name="sourceContent"
                      onChange={(event) =>
                        updateSourceFormDraft('url', { content: event.currentTarget.value })
                      }
                      placeholder={t('coursition.app.sources.urlPlaceholder')}
                      required
                      type="url"
                      value={sourceFormDrafts.url.content}
                    />
                    <Button
                      className="justify-self-start"
                      disabled={isSourceAddBusy}
                      type="submit"
                      variant="primary"
                    >
                      {busyAction === 'addSource' || busyAction === 'file'
                        ? t('coursition.app.sources.adding')
                        : t('coursition.app.sources.add')}
                    </Button>
                  </Tabs.Content>
                  <Tabs.Content className="grid gap-4" value="file">
                    <TextInputField
                      disabled={sourceType !== 'file'}
                      id="fileSourceName"
                      label={t('coursition.app.sources.sourceName')}
                      name="sourceName"
                      onChange={(event) => {
                        const { value } = event.currentTarget;
                        setSourceFormDrafts((current) => updateSourceName(current, 'file', value));
                      }}
                      placeholder={t('coursition.app.sources.fileNamePlaceholder')}
                      required
                      value={sourceFormDrafts.file.name}
                    />
                    <FormInput
                      disabled={sourceType !== 'file'}
                      id="sourceFile"
                      key={`source-file-${fileInputResetKey}`}
                      label={t('coursition.app.sources.chooseFile')}
                      onChange={(event) => {
                        const file = event.currentTarget.files?.[0] ?? null;
                        setSourceFormDrafts((current) => selectSourceFile(current, file));
                        setFileSourceFeedback(null);
                      }}
                      type="file"
                    />
                    <Button
                      className="justify-self-start"
                      disabled={isSourceAddBusy}
                      type="submit"
                      variant="primary"
                    >
                      {busyAction === 'addSource' || busyAction === 'file'
                        ? t('coursition.app.sources.adding')
                        : t('coursition.app.sources.add')}
                    </Button>
                    {fileSourceFeedback === null ? null : (
                      <p
                        className={
                          fileSourceFeedback.kind === 'error' ? errorTextClass : mutedTextClass
                        }
                        role={fileSourceFeedback.kind === 'error' ? 'alert' : 'status'}
                      >
                        {fileSourceFeedback.message}
                      </p>
                    )}
                  </Tabs.Content>
                </Tabs>
              </form>
              {visibleSources.length === 0 ? (
                <p className={mutedTextClass}>
                  {draft.mode === 'generate'
                    ? t('coursition.app.sources.generateEmptyCopy')
                    : t('coursition.app.sources.emptyCopy')}
                </p>
              ) : (
                <ul className="grid gap-3">
                  {visibleSources.map((source) => {
                    const canPreview = canPreviewSource(source);
                    const isPreviewExpanded = expandedSourcePreviewIdSet.has(source.id);
                    const previewId = `source-preview-${source.id}`;
                    return (
                      <li className={`${insetSurfaceClass} grid gap-3`} key={source.id}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="grid gap-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-base font-semibold text-fg-primary">
                                {source.name}
                              </h3>
                              <Badge size="sm" variant={sourceStatusBadgeVariant(source.status)}>
                                {t(`coursition.app.sources.statuses.${source.status}`)}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {canPreview ? (
                              <Button
                                aria-controls={previewId}
                                aria-expanded={isPreviewExpanded}
                                onClick={() => toggleSourcePreview(source.id)}
                                theme="light"
                                type="button"
                                variant="primary"
                              >
                                {t(
                                  isPreviewExpanded
                                    ? 'coursition.app.sources.hidePreview'
                                    : 'coursition.app.sources.showPreview',
                                )}
                                <span className="sr-only"> {source.name}</span>
                              </Button>
                            ) : null}
                            {source.status === 'failed' || source.status === 'unsupported' ? (
                              <Button
                                disabled={isSourceRetryBusy}
                                onClick={() =>
                                  void runWorkflow({
                                    action: 'retrySource',
                                    draftId: draft.id,
                                    sourceId: source.id,
                                  })
                                }
                                theme="light"
                                type="button"
                                variant="primary"
                              >
                                {t('coursition.app.sources.retry')}
                              </Button>
                            ) : null}
                            <ConfirmDeleteButton
                              cancelLabel={t('coursition.app.dashboard.cancel')}
                              confirmLabel={t('coursition.app.sources.delete')}
                              description={t('coursition.app.dashboard.confirmDeleteMessage')}
                              disabled={isSourceDeleteBusy}
                              label={t('coursition.app.sources.delete')}
                              onConfirm={() =>
                                void runWorkflow({
                                  action: 'deleteSource',
                                  draftId: draft.id,
                                  sourceId: source.id,
                                })
                              }
                              title={t('coursition.app.sources.delete')}
                            />
                          </div>
                        </div>
                        {source.failureReason === undefined ? null : (
                          <p className="rounded-md bg-badge-bg-danger p-2 text-sm font-semibold text-badge-fg-danger">
                            {source.failureReason}
                          </p>
                        )}
                        {canPreview && isPreviewExpanded ? (
                          <div id={previewId}>
                            <SourceTextPreview value={source.content} />
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          ) : null}

          {activeStep === 'preparation' ? (
            <section className={`${workspaceSectionClass} ${readingColumnClass}`}>
              <h2 className="text-xl font-semibold text-fg-primary">
                {t('coursition.app.preparation.title')}
              </h2>
              <div className="grid gap-3" onBlur={savePreparationOnPanelLeave}>
                <RadioCard
                  className="grid gap-2 sm:grid-cols-3"
                  itemOrientation="horizontal"
                  onValueChange={(value) => {
                    if (value !== null && isLanguagePreference(value)) {
                      updatePreparationField('languagePreference', value);
                    }
                  }}
                  orientation="horizontal"
                  value={preparation.languagePreference}
                  variant="subtle"
                >
                  <RadioCard.Label className="sm:col-span-3">
                    {t('coursition.app.preparation.outputLanguage')}
                  </RadioCard.Label>
                  {languagePreferences.map((preference) => (
                    <RadioCard.Item key={preference} value={preference}>
                      <RadioCard.ItemHiddenInput />
                      <RadioCard.ItemControl>
                        <RadioCard.ItemContent>
                          <RadioCard.ItemText>
                            {t(`coursition.app.preparation.outputLanguageOptions.${preference}`)}
                          </RadioCard.ItemText>
                        </RadioCard.ItemContent>
                        <RadioCard.ItemIndicator />
                      </RadioCard.ItemControl>
                    </RadioCard.Item>
                  ))}
                </RadioCard>
                <TextareaField
                  label={t('coursition.app.preparation.outcome')}
                  name="desiredOutcome"
                  onChange={(event) =>
                    updatePreparationField('desiredOutcome', event.currentTarget.value)
                  }
                  placeholder={t('coursition.app.preparation.outcomePlaceholder')}
                  required
                  value={preparation.desiredOutcome}
                />
                <TextareaField
                  label={t('coursition.app.preparation.audience')}
                  name="audience"
                  onChange={(event) =>
                    updatePreparationField('audience', event.currentTarget.value)
                  }
                  placeholder={t('coursition.app.preparation.audiencePlaceholder')}
                  required
                  value={preparation.audience}
                />
                <TextareaField
                  label={t('coursition.app.preparation.practice')}
                  name="activityMixPreference"
                  onChange={(event) =>
                    updatePreparationField('activityMixPreference', event.currentTarget.value)
                  }
                  placeholder={t('coursition.app.preparation.practicePlaceholder')}
                  required
                  value={preparation.activityMixPreference}
                />
                <Accordion
                  className="border-t border-border-primary pt-2"
                  collapsible
                  defaultValue={[]}
                  multiple={false}
                  size="sm"
                  variant="borderless"
                >
                  <Accordion.Item value="advanced-preparation">
                    <Accordion.Header>
                      <Accordion.Title>{t('coursition.app.preparation.advanced')}</Accordion.Title>
                      <Accordion.Indicator />
                    </Accordion.Header>
                    <Accordion.Content>
                      <div className="grid gap-3">
                        <TextareaField
                          label={t('coursition.app.preparation.prior')}
                          name="priorKnowledge"
                          onChange={(event) =>
                            updatePreparationField('priorKnowledge', event.currentTarget.value)
                          }
                          placeholder={t('coursition.app.preparation.priorPlaceholder')}
                          value={preparation.priorKnowledge}
                        />
                        <TextareaField
                          label={t('coursition.app.preparation.depth')}
                          name="depth"
                          onChange={(event) =>
                            updatePreparationField('depth', event.currentTarget.value)
                          }
                          placeholder={t('coursition.app.preparation.depthPlaceholder')}
                          value={preparation.depth}
                        />
                        <TextareaField
                          label={t('coursition.app.preparation.avoid')}
                          name="constraints"
                          onChange={(event) =>
                            updatePreparationField('constraints', event.currentTarget.value)
                          }
                          placeholder={t('coursition.app.preparation.avoidPlaceholder')}
                          value={preparation.constraints}
                        />
                        <FormCheckbox
                          checked={preparation.sourceStrictness === 'strict'}
                          id="sourceStrictness"
                          label={t('coursition.app.preparation.strict')}
                          onCheckedChange={(checked) =>
                            updatePreparationField(
                              'sourceStrictness',
                              checked ? 'strict' : 'standard',
                            )
                          }
                        />
                      </div>
                    </Accordion.Content>
                  </Accordion.Item>
                </Accordion>
              </div>
            </section>
          ) : null}

          {activeStep === 'objectives' ? (
            <section className={`${workspaceSectionClass} ${readingColumnClass}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="grid gap-1">
                  <h2 className="text-xl font-semibold text-fg-primary">
                    {t('coursition.app.objectives.title')}
                  </h2>
                  <p className={mutedTextClass}>{t('coursition.app.objectives.purpose')}</p>
                </div>
                <Button
                  disabled={isObjectiveGenerationBusy}
                  onClick={() =>
                    void runWorkflow({ action: 'generateLearningBlueprint', draftId: draft.id })
                  }
                  theme="light"
                  type="button"
                  variant="primary"
                >
                  {busyAction === 'generateLearningBlueprint'
                    ? t('coursition.app.objectives.generating')
                    : t(
                        hasObjectives(draft)
                          ? 'coursition.app.objectives.regenerate'
                          : 'coursition.app.objectives.generate',
                      )}
                </Button>
              </div>
              {draft.learningBlueprint.assumptions.length > 0 ? (
                <ul className="grid gap-1 rounded-md bg-fill-base p-3">
                  {draft.learningBlueprint.assumptions.map((assumption) => (
                    <li className={mutedTextClass} key={assumption}>
                      {normalizedGeneratedText(assumption)}
                    </li>
                  ))}
                </ul>
              ) : null}
              {draft.learningBlueprint.objectives.length === 0 ? (
                <p className={mutedTextClass}>{t('coursition.app.objectives.emptyObjectives')}</p>
              ) : (
                <Accordion
                  className={editorialListClass}
                  collapsible={false}
                  defaultValue={[draft.learningBlueprint.objectives[0]?.id ?? '']}
                  multiple={false}
                  size="md"
                  variant="borderless"
                >
                  {draft.learningBlueprint.objectives.map((objective, index) => (
                    <Accordion.Item key={objective.id} value={objective.id}>
                      <Accordion.Header>
                        <Accordion.Title>
                          {index + 1}. {objective.title}
                        </Accordion.Title>
                        <Accordion.Subtitle>
                          {t(`coursition.app.objectives.sourceSupport.${objective.sourceSupport}`)}
                        </Accordion.Subtitle>
                        <Accordion.Indicator />
                      </Accordion.Header>
                      <Accordion.Content>
                        <form
                          className="grid gap-3"
                          onBlur={(event) => saveObjectiveOnBlur(event, objective.id)}
                          onSubmit={(event) => saveObjectiveOnSubmit(event, objective.id)}
                        >
                          <FormInput
                            id={`${objective.id}-title`}
                            label={t('coursition.app.objectives.objectiveTitle')}
                            name="title"
                            onChange={(event) =>
                              updateObjectiveBuffer(objective.id, {
                                title: event.currentTarget.value,
                              })
                            }
                            placeholder={t('coursition.app.objectives.objectiveTitlePlaceholder')}
                            value={
                              objectiveEditBuffers[objective.id]?.value.title ?? objective.title
                            }
                          />
                          <FormTextarea
                            id={`${objective.id}-capability`}
                            label={t('coursition.app.objectives.capability')}
                            name="capability"
                            onChange={(event) =>
                              updateObjectiveBuffer(objective.id, {
                                capability: event.currentTarget.value,
                              })
                            }
                            placeholder={t('coursition.app.objectives.capabilityPlaceholder')}
                            rows={4}
                            value={
                              objectiveEditBuffers[objective.id]?.value.capability ??
                              normalizedGeneratedText(objective.capability)
                            }
                          />
                        </form>
                      </Accordion.Content>
                    </Accordion.Item>
                  ))}
                </Accordion>
              )}
            </section>
          ) : null}

          {activeStep === 'activityPlan' ? (
            <section className={`${workspaceSectionClass} ${readingColumnClass}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-fg-primary">
                  {t('coursition.app.activityPlan.title')}
                </h2>
                <Button
                  disabled={isActivityGenerationBusy}
                  onClick={() =>
                    void runWorkflow({ action: 'generateActivities', draftId: draft.id })
                  }
                  theme="light"
                  type="button"
                  variant="primary"
                >
                  {busyAction === 'generateActivities'
                    ? t('coursition.app.activityPlan.generating')
                    : t(
                        hasActivityPlan(draft)
                          ? 'coursition.app.activityPlan.regenerate'
                          : 'coursition.app.activityPlan.generate',
                      )}
                </Button>
              </div>
              {draft.learningBlueprint.activityBriefs.length === 0 ? (
                <p className={mutedTextClass}>{t('coursition.app.activityPlan.empty')}</p>
              ) : (
                <Accordion
                  className={editorialListClass}
                  collapsible={false}
                  defaultValue={[draft.learningBlueprint.activityBriefs[0]?.id ?? '']}
                  multiple={false}
                  size="md"
                  variant="borderless"
                >
                  {draft.learningBlueprint.activityBriefs.map((brief, index) => (
                    <Accordion.Item key={brief.id} value={brief.id}>
                      <Accordion.Header>
                        <Accordion.Title>
                          {index + 1}. {brief.title}
                        </Accordion.Title>
                        <Accordion.Subtitle>
                          {t(`coursition.app.activityPlan.types.${brief.type}`)}
                        </Accordion.Subtitle>
                        <Accordion.Indicator />
                      </Accordion.Header>
                      <Accordion.Content>
                        <form
                          className="grid gap-3"
                          onBlur={(event) => saveActivityBriefOnBlur(event, brief.id)}
                          onSubmit={(event) => saveActivityBriefOnSubmit(event, brief.id)}
                        >
                          <FormInput
                            id={`${brief.id}-title`}
                            label={t('coursition.app.activityPlan.activityTitle')}
                            name="title"
                            onChange={(event) =>
                              updateActivityBriefBuffer(brief.id, {
                                title: event.currentTarget.value,
                              })
                            }
                            placeholder={t('coursition.app.activityPlan.activityTitlePlaceholder')}
                            value={activityBriefEditBuffers[brief.id]?.value.title ?? brief.title}
                          />
                          <SelectTemplate
                            id={`${brief.id}-type`}
                            items={activityTypes.map((type) => ({
                              displayValue: t(`coursition.app.activityPlan.types.${type}`),
                              label: t(`coursition.app.activityPlan.types.${type}`),
                              value: type,
                            }))}
                            label={t('coursition.app.activityPlan.type')}
                            name="type"
                            onValueChange={(details) => {
                              const type = activityTypes.find((candidate) =>
                                details.value.includes(candidate),
                              );
                              if (type !== undefined) {
                                updateActivityBriefBuffer(brief.id, { type });
                              }
                            }}
                            placeholder={t('coursition.app.activityPlan.type')}
                            value={[activityBriefEditBuffers[brief.id]?.value.type ?? brief.type]}
                          />
                          <FormTextarea
                            id={`${brief.id}-instructions`}
                            label={t('coursition.app.activityPlan.instructions')}
                            name="instructions"
                            onChange={(event) =>
                              updateActivityBriefBuffer(brief.id, {
                                instructions: event.currentTarget.value,
                              })
                            }
                            placeholder={t('coursition.app.activityPlan.instructionsPlaceholder')}
                            rows={4}
                            value={
                              activityBriefEditBuffers[brief.id]?.value.instructions ??
                              normalizedGeneratedText(brief.instructions)
                            }
                          />
                          <FormTextarea
                            id={`${brief.id}-learnerAction`}
                            label={t('coursition.app.activityPlan.learnerAction')}
                            name="learnerAction"
                            onChange={(event) =>
                              updateActivityBriefBuffer(brief.id, {
                                learnerAction: event.currentTarget.value,
                              })
                            }
                            placeholder={t('coursition.app.activityPlan.learnerActionPlaceholder')}
                            rows={4}
                            value={
                              activityBriefEditBuffers[brief.id]?.value.learnerAction ??
                              normalizedGeneratedText(brief.learnerAction)
                            }
                          />
                          <FormTextarea
                            id={`${brief.id}-successCriteria`}
                            label={t('coursition.app.activityPlan.successCriteria')}
                            name="successCriteria"
                            onChange={(event) =>
                              updateActivityBriefBuffer(brief.id, {
                                successCriteria: event.currentTarget.value,
                              })
                            }
                            placeholder={t(
                              'coursition.app.activityPlan.successCriteriaPlaceholder',
                            )}
                            rows={4}
                            value={
                              activityBriefEditBuffers[brief.id]?.value.successCriteria ??
                              normalizedGeneratedText(brief.successCriteria)
                            }
                          />
                          <FormTextarea
                            id={`${brief.id}-feedbackGuidance`}
                            label={t('coursition.app.activityPlan.feedbackGuidance')}
                            name="feedbackGuidance"
                            onChange={(event) =>
                              updateActivityBriefBuffer(brief.id, {
                                feedbackGuidance: event.currentTarget.value,
                              })
                            }
                            placeholder={t(
                              'coursition.app.activityPlan.feedbackGuidancePlaceholder',
                            )}
                            rows={4}
                            value={
                              activityBriefEditBuffers[brief.id]?.value.feedbackGuidance ??
                              normalizedGeneratedText(brief.feedbackGuidance)
                            }
                          />
                        </form>
                      </Accordion.Content>
                    </Accordion.Item>
                  ))}
                </Accordion>
              )}
            </section>
          ) : null}

          {activeStep === 'courseContent' ? (
            <section className={workspaceSectionClass}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-fg-primary">
                  {t('coursition.app.courseContent.title')}
                </h2>
                <Button
                  disabled={isCourseContentGenerationBusy}
                  onClick={() =>
                    void runWorkflow({ action: 'generateCourseContent', draftId: draft.id })
                  }
                  theme="light"
                  type="button"
                  variant="primary"
                >
                  {busyAction === 'generateCourseContent'
                    ? t('coursition.app.courseContent.generating')
                    : t(
                        hasAnyCourseContent(draft)
                          ? 'coursition.app.courseContent.regenerate'
                          : 'coursition.app.courseContent.generate',
                      )}
                </Button>
              </div>
              {draft.courseContent.sections.length === 0 ? (
                <p className={mutedTextClass}>{t('coursition.app.courseContent.empty')}</p>
              ) : (
                <CourseContentView draft={draft} t={t} />
              )}
            </section>
          ) : null}

          {activeStep === 'preview' ? (
            <section className={workspaceSectionClass}>
              <h2 className="text-xl font-semibold text-fg-primary">
                {t('coursition.app.preview.title')}
              </h2>
              <CourseContentView draft={draft} t={t} />
              <UnlinkedGeneratedActivitiesView draft={draft} t={t} />
              <ReviewView draft={draft} runWorkflow={runWorkflow} t={t} />
            </section>
          ) : null}
        </section>
      )}
    </div>
  );
};

export default CoursitionWorkflowApp;
