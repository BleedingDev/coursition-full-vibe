import { Link, useNavigate } from '@modern-js/plugin-tanstack/runtime';
import { Badge } from '@techsio/ui-kit/atoms/badge';
import { Button } from '@techsio/ui-kit/atoms/button';
import { Icon } from '@techsio/ui-kit/atoms/icon';
import { Input } from '@techsio/ui-kit/atoms/input';
import { FormCheckbox } from '@techsio/ui-kit/molecules/form-checkbox';
import { FormInput } from '@techsio/ui-kit/molecules/form-input';
import { FormTextarea } from '@techsio/ui-kit/molecules/form-textarea';
import { RadioCard } from '@techsio/ui-kit/molecules/radio-card';
import { Steps } from '@techsio/ui-kit/molecules/steps';
import { Toaster, useToast } from '@techsio/ui-kit/molecules/toast';
import { SelectTemplate } from '@techsio/ui-kit/templates/select';
import * as Cause from 'effect/Cause';
import * as Data from 'effect/Data';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Option from 'effect/Option';
import * as Schema from 'effect/Schema';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, ComponentType, FocusEvent, FormEvent } from 'react';
import type { MDXEditorMethods } from '@mdxeditor/editor';
import effectBff from '@api/effect/index';
import type {
  ActivityEvaluationResponse,
  AiMode,
  CourseLanguagePreference,
  DraftStep,
  SourceAsset,
  SourceType,
  WorkflowGate,
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
  CoursePreparation,
  SessionUser,
  WorkflowAction,
  WorkflowSnapshot,
} from '@shared/coursition/effect-api';
import {
  activityEvaluationRequestSchema,
  activityEvaluationResponseSchema,
  coursePreparationSchema,
  sessionPayloadSchema,
  workflowActionSchema,
  workflowSnapshotSchema,
} from '@shared/coursition/effect-api';
import type { CourseRouteLanguage, CourseRouteMatch } from '@shared/coursition/routes';
import { courseRoutePattern, courseRouteStepSlug } from '@shared/coursition/routes';
import type { Translate } from './translation';

interface CoursitionWorkflowAppProps {
  initialRoute?: CourseRouteMatch | null;
  initialSessionUser?: SessionUser | null;
  initialSnapshot?: WorkflowSnapshot | null;
  language: CourseRouteLanguage;
  t: Translate;
}

type AuthMode = 'signIn' | 'signUp';
type BusyAction = WorkflowAction['action'] | 'auth' | 'file';
type CourseDraft = NonNullable<WorkflowSnapshot['draft']>;
type AiRun = CourseDraft['aiRuns'][number];
type GeneratedActivity = CourseDraft['learningBlueprint']['generatedActivities'][number];
type PlayableGeneratedActivityType = Exclude<GeneratedActivity['type'], 'not_playable'>;
type WorkflowRunner = (action: WorkflowAction, shouldNavigate?: boolean) => void;
type InputChangeEvent = ChangeEvent<HTMLInputElement>;
type TextareaChangeEvent = ChangeEvent<HTMLTextAreaElement>;
interface MarkdownEditorModule {
  default: ComponentType<MarkdownEditorClientProps>;
}

class CoursitionUiEffectError extends Data.TaggedError('CoursitionUiEffectError')<{
  readonly cause: unknown;
  readonly message: string;
}> {}

interface MarkdownEditorClientProps {
  onChange?: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  value: string;
}

interface SourceMarkdownToolbarComponents {
  BlockTypeSelect: ComponentType;
  BoldItalicUnderlineToggles: ComponentType;
  CreateLink: ComponentType;
  InsertThematicBreak: ComponentType;
  ListsToggle: ComponentType;
  Separator: ComponentType;
  UndoRedo: ComponentType;
}

const SourceMarkdownToolbarContents = ({
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  CreateLink,
  InsertThematicBreak,
  ListsToggle,
  Separator,
  UndoRedo,
}: SourceMarkdownToolbarComponents) => (
  <>
    <UndoRedo />
    <Separator />
    <BlockTypeSelect />
    <BoldItalicUnderlineToggles />
    <ListsToggle />
    <CreateLink />
    <InsertThematicBreak />
  </>
);

const createSourceMarkdownToolbarContents = (components: SourceMarkdownToolbarComponents) =>
  SourceMarkdownToolbarContents.bind(null, components);

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
const languagePreferences = [
  'source',
  'en',
  'cs',
] as const satisfies readonly CourseLanguagePreference[];
const sourceDataUrlPattern = /^data:[^,]+;base64,/u;

const labelClass = 'text-sm font-semibold text-fg-primary';
const mutedTextClass = 'text-sm text-fg-secondary';
const tinyMetaClass = 'text-xs font-medium tracking-normal text-fg-secondary';
const errorTextClass = 'text-sm font-semibold text-button-bg-danger-active';
const cardClass = 'rounded-md bg-base p-3';
const panelClass = 'grid gap-3';

const formString = (formData: FormData, field: string) => {
  const value = formData.get(field);
  return typeof value === 'string' ? value.trim() : '';
};

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
  const runType = generationRunTypeFor(action);
  if (nextDraft === null || runType === null) {
    return null;
  }
  const previousRunIds =
    previousDraft === null ? new Set<string>() : new Set(previousDraft.aiRuns.map((run) => run.id));
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

const gateText = (gate: WorkflowGate, t: Translate) => {
  if (gate.reason === 'blockingFinding' && gate.finding !== undefined) {
    return t('coursition.app.navigation.blockedReasons.blockingFinding', {
      title: gate.finding.title,
    });
  }
  if (gate.reason !== undefined) {
    return t(`coursition.app.navigation.blockedReasons.${gate.reason}`);
  }
  return t('coursition.app.errors.generic');
};

const nextGateFor = (draft: CourseDraft | null, activeStep: DraftStep): WorkflowGate => {
  if (draft === null) {
    return { allowed: false };
  }
  if (activeStep === 'courseContent') {
    return getWorkflowPreviewGate(draft);
  }
  if (activeStep === 'sources' && draft.mode === 'generate') {
    return hasUsableSourceMaterial(draft)
      ? { allowed: true }
      : { allowed: false, blockedStep: 'sources', reason: 'sourceRequired' };
  }
  return getWorkflowStepGate(draft, workflowSteps[workflowStepIndex(activeStep) + 1] ?? activeStep);
};

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
  'shrink-0 rounded-md px-1.5 py-1 transition enabled:hover:bg-fill-hover data-[current-step=true]:cursor-default disabled:pointer-events-none disabled:bg-transparent disabled:opacity-45';

const navigationIndicatorClass = ({
  isComplete,
  isCurrent,
  isReady,
  isStale,
}: NavigationStepVisualState) => {
  const classes = ['border-border-primary bg-fill-base text-fg-primary group-hover:bg-fill-hover'];
  if (isStale) {
    classes.push('!border-warning !bg-warning !text-black group-hover:!bg-warning');
  } else if (isReady) {
    classes.push(
      '!border-border-primary !bg-fill-base !text-fg-primary group-hover:!bg-fill-hover',
    );
  } else if (isComplete) {
    classes.push('!border-success !bg-success !text-fg-reverse');
  }
  if (isCurrent && !isComplete && !isReady && !isStale) {
    classes.push('border-primary bg-primary text-fg-reverse');
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
    classes.push('text-success');
  }
  if (isStale) {
    classes.push('font-semibold !text-fg-primary');
  }
  if (isReady) {
    classes.push('font-bold !text-fg-primary');
  } else if (isCurrent) {
    classes.push('font-bold !text-primary');
  }
  return classes.join(' ');
};

const navigationSeparatorClass = 'flex w-8 shrink-0 items-center text-fg-secondary/40';

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

const workflowRequestEffect = (action: WorkflowAction, fallback: string) =>
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

const TextInputField = ({
  id,
  label,
  name,
  onChange,
  placeholder,
  required = false,
  type = 'text',
  value,
}: {
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
    value={value}
  />
);

const MarkdownEditorClient = lazy(() =>
  Effect.runPromise(
    Effect.promise(() => import('@mdxeditor/editor')).pipe(
      Effect.map(
        ({
          BlockTypeSelect,
          BoldItalicUnderlineToggles,
          CreateLink,
          InsertThematicBreak,
          ListsToggle,
          MDXEditor,
          Separator,
          UndoRedo,
          codeBlockPlugin,
          headingsPlugin,
          imagePlugin,
          linkDialogPlugin,
          linkPlugin,
          listsPlugin,
          markdownShortcutPlugin,
          quotePlugin,
          tablePlugin,
          thematicBreakPlugin,
          toolbarPlugin,
        }): MarkdownEditorModule => {
          const sourceMarkdownToolbarContents = createSourceMarkdownToolbarContents({
            BlockTypeSelect,
            BoldItalicUnderlineToggles,
            CreateLink,
            InsertThematicBreak,
            ListsToggle,
            Separator,
            UndoRedo,
          });

          const SourceMarkdownEditor = ({
            onChange,
            placeholder,
            readOnly = false,
            value,
          }: MarkdownEditorClientProps) => {
            const editorRef = useRef<MDXEditorMethods>(null);
            useEffect(() => {
              const editor = editorRef.current;
              if (editor !== null && editor.getMarkdown() !== value) {
                editor.setMarkdown(value);
              }
            }, [value]);

            const plugins = [
              headingsPlugin(),
              listsPlugin(),
              quotePlugin(),
              linkPlugin(),
              linkDialogPlugin(),
              codeBlockPlugin(),
              imagePlugin({
                disableImageResize: true,
                disableImageSettingsButton: true,
              }),
              tablePlugin(),
              thematicBreakPlugin(),
              markdownShortcutPlugin(),
              ...(readOnly
                ? []
                : [
                    toolbarPlugin({
                      toolbarContents: sourceMarkdownToolbarContents,
                    }),
                  ]),
            ];

            return (
              <MDXEditor
                ref={editorRef}
                className={`coursition-mdx-editor ${
                  readOnly ? 'coursition-mdx-editor--readonly' : ''
                }`}
                contentEditableClassName={`coursition-mdx-editor-content ${
                  readOnly ? 'coursition-mdx-editor-content--readonly' : ''
                }`}
                markdown={value}
                onChange={(markdown) => {
                  if (!readOnly) {
                    onChange?.(markdown);
                  }
                }}
                placeholder={placeholder}
                plugins={plugins}
                readOnly={readOnly}
                spellCheck
                trim={false}
              />
            );
          };

          return { default: SourceMarkdownEditor };
        },
      ),
    ),
  ),
);

const SourceTextPreview = ({ value }: { value: string }) => (
  <div className="max-h-72 overflow-auto rounded-md bg-base p-3">
    <pre className="whitespace-pre-wrap break-words text-sm leading-6 text-fg-primary">{value}</pre>
  </div>
);

const MarkdownText = ({ className = '', value }: { className?: string; value: string }) => (
  <div className={`coursition-markdown-text text-sm leading-6 text-fg-primary ${className}`}>
    <Suspense fallback={<p className="whitespace-pre-wrap">{value}</p>}>
      <MarkdownEditorClient readOnly value={value} />
    </Suspense>
  </div>
);

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
    className={`coursition-feedback-panel rounded-md p-3 text-sm leading-6 ${
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

  const evaluateAnswer = useCallback(
    (answer: string, checkedCriteria: readonly string[] = []) => {
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
    },
    [activityId, draftId, t],
  );

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
  <div className="grid gap-1 rounded-md bg-button-bg-warning-light p-3 text-sm leading-6 text-button-fg-warning-light">
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
      <div className="grid gap-2 rounded-md bg-base p-3">
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
        <div className="grid gap-3">
          {interaction.items.map((item, index) => {
            const selectedMatch = matches[item.id] ?? '';
            const isCorrect = selectedMatch === item.matchLabel;
            return (
              <div className="grid gap-2 rounded-md bg-base p-3" key={item.id}>
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
      <ol className="grid gap-2">
        {orderedItems.map((item, index) => {
          const isCorrect = item.correctPosition === index + 1;
          return (
            <li className="grid gap-2 rounded-md bg-base p-3" key={item.id}>
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
                    theme="outlined"
                    type="button"
                    variant="secondary"
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
                    theme="outlined"
                    type="button"
                    variant="secondary"
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
      <div className="grid gap-2 rounded-md bg-base p-3">
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

const activitySkinTypeFor = (activity: GeneratedActivity): PlayableGeneratedActivityType | null => {
  switch (activity.type) {
    case 'retrieval_check':
    case 'practice_task':
    case 'scenario_decision':
    case 'ordering_matching':
    case 'rubric_answer': {
      return activity.type;
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
  const activitySkinType = activitySkinTypeFor(activity);
  const heading = hasText(prompt)
    ? typeLabel
    : t('coursition.app.preview.incompleteActivityHeading');

  return (
    <article className="grid gap-3 rounded-md bg-fill-base p-3" key={activity.id}>
      <header className="grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className={tinyMetaClass}>
            {t('coursition.app.preview.activityNumber', { number: index + 1 })}
          </p>
        </div>
        <h4 className="text-base font-bold leading-6 text-fg-primary">{heading}</h4>
        {hasText(prompt) ? (
          <MarkdownText className="text-sm leading-6 text-fg-primary" value={prompt} />
        ) : null}
        {activitySkinType === null ? null : (
          <div className="grid gap-1 rounded-md bg-base p-2">
            <p className="text-sm font-semibold text-fg-primary">
              {t(`coursition.app.preview.skins.${activitySkinType}.label`)}
            </p>
            <p className={mutedTextClass}>
              {t(`coursition.app.preview.skins.${activitySkinType}.what`)}
            </p>
            <p className={tinyMetaClass}>
              {t(`coursition.app.preview.skins.${activitySkinType}.why`)}
            </p>
          </div>
        )}
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

const normalizedPreviewText = (value: string) => value.replaceAll(/\s+/gu, ' ').trim();

const CourseContentView = ({ draft, t }: { draft: CourseDraft; t: Translate }) => {
  const generatedActivitiesById = new Map(
    draft.learningBlueprint.generatedActivities.map((activity) => [activity.id, activity]),
  );
  const activityIndexById = new Map(
    draft.learningBlueprint.generatedActivities.map((activity, index) => [activity.id, index]),
  );

  return (
    <div className="grid gap-6">
      {draft.courseContent.sections.map((section, sectionIndex) => (
        <section
          className="grid gap-4 border-t border-border-primary pt-4 first:border-t-0 first:pt-0"
          key={section.id}
        >
          <header className="grid gap-2">
            <p className={tinyMetaClass}>
              {t('coursition.app.courseContent.section')} {sectionIndex + 1}
            </p>
            <h3 className="text-lg font-bold text-fg-primary">{section.title}</h3>
            <MarkdownText className="text-sm leading-6 text-fg-primary" value={section.summary} />
          </header>
          <div className="grid gap-4">
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
                  <h4 className="text-base font-bold text-fg-primary">
                    {t(`coursition.app.blockTypes.${block.type}`)}
                  </h4>
                  <MarkdownText className="text-sm leading-6 text-fg-primary" value={body} />
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
};

const UnlinkedGeneratedActivitiesView = ({ draft, t }: { draft: CourseDraft; t: Translate }) => {
  const unlinkedActivities = unlinkedGeneratedActivitiesFor(draft);
  if (unlinkedActivities.length > 0) {
    return (
      <section className="grid gap-3">
        <h3 className="text-lg font-bold text-fg-primary">
          {t('coursition.app.preview.activities')}
        </h3>
        <div className="grid gap-3">
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
      <section className="grid gap-3">
        <h3 className="text-lg font-bold text-fg-primary">
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
  <section className="grid gap-3">
    <h3 className="text-xl font-bold text-fg-primary">{t('coursition.app.review.title')}</h3>
    {draft.findings.length === 0 ? (
      <p className={mutedTextClass}>{t('coursition.app.review.empty')}</p>
    ) : (
      <div className="grid gap-2">
        {draft.findings.map((finding) => (
          <article className="grid gap-2 rounded-md bg-fill-base p-3" key={finding.id}>
            <p className={tinyMetaClass}>
              {t(`coursition.app.review.severity.${finding.severity}`)}
            </p>
            <h4 className="text-base font-bold text-fg-primary">{finding.title}</h4>
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
                variant="secondary"
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
                variant="secondary"
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
  initialRoute = null,
  initialSessionUser = null,
  initialSnapshot = null,
  language,
  t,
}: CoursitionWorkflowAppProps) => {
  const navigate = useNavigate();
  const toast = useToast();
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(initialSessionUser);
  const [snapshot, setSnapshot] = useState<WorkflowSnapshot | null>(initialSnapshot);
  const [authMode, setAuthMode] = useState<AuthMode>('signIn');
  const [authEmail, setAuthEmail] = useState('');
  const [authName, setAuthName] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [busyActions, setBusyActions] = useState<readonly BusyAction[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [courseTitle, setCourseTitle] = useState(initialSnapshot?.draft?.title ?? '');
  const [draftTitle, setDraftTitle] = useState('');
  const [sourceType, setSourceType] = useState<SourceType>('notes');
  const [sourceName, setSourceName] = useState('');
  const [sourceContent, setSourceContent] = useState('');
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [expandedSourcePreviewIds, setExpandedSourcePreviewIds] = useState<readonly string[]>([]);
  const [preparation, setPreparation] = useState<CoursePreparation>(
    initialSnapshot?.draft?.learningBlueprint.coursePreparation ?? emptyCoursePreparation(language),
  );

  const draft = snapshot?.draft ?? null;
  const visibleSources = useMemo(() => activeSources(draft), [draft]);
  const expandedSourcePreviewIdSet = useMemo(
    () => new Set(expandedSourcePreviewIds),
    [expandedSourcePreviewIds],
  );
  const activeStep = draft?.step ?? initialRoute?.step ?? 'mode';
  const currentNavigationIndex = Math.max(0, navigationSteps.indexOf(activeStep));
  const activeNavigationStepRef = useRef<HTMLDivElement>(null);
  const courseTitleAutosaveSequenceRef = useRef(0);
  const lastSubmittedCourseTitleRef = useRef<string | null>(null);
  const objectiveAutosaveSequenceRef = useRef(new Map<string, number>());
  const lastSubmittedObjectiveKeyRef = useRef(new Map<string, string>());
  const lastSubmittedActivityBriefKeyRef = useRef(new Map<string, string>());
  const preparationAutosaveSequenceRef = useRef(0);
  const lastSubmittedPreparationKeyRef = useRef<string | null>(null);
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
  const isCreateDraftBusy = isBusyAction('createDraft');
  const isDraftListBusy = isBusyAction('selectDraft', 'deleteDraft');
  const isRouteActionBusy = isBusyAction(
    'deleteDraft',
    'generateCourse',
    'generateActivities',
    'generateCourseContent',
    'goToStep',
    'openPreview',
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

  useEffect(() => {
    setSessionUser(initialSessionUser);
  }, [initialSessionUser]);

  useEffect(() => {
    setSnapshot(initialSnapshot);
    if (initialSnapshot?.draft !== undefined && initialSnapshot.draft !== null) {
      setCourseTitle(initialSnapshot.draft.title);
      setPreparation(initialSnapshot.draft.learningBlueprint.coursePreparation);
    }
  }, [initialSnapshot]);

  useEffect(() => {
    const visibleSourceIds = new Set(visibleSources.map((source) => source.id));
    setExpandedSourcePreviewIds((currentIds) =>
      currentIds.filter((sourceId) => visibleSourceIds.has(sourceId)),
    );
  }, [visibleSources]);

  useEffect(() => {
    activeNavigationStepRef.current?.scrollIntoView({
      behavior: 'auto',
      block: 'nearest',
      inline: 'center',
    });
  }, [currentNavigationIndex]);

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
      setSnapshot(nextSnapshot);
      if (nextSnapshot.draft !== null) {
        if (shouldSyncCourseTitle) {
          setCourseTitle(nextSnapshot.draft.title);
        }
        if (shouldSyncPreparation) {
          setPreparation(nextSnapshot.draft.learningBlueprint.coursePreparation);
        }
        if (shouldNavigate) {
          navigateTo(nextSnapshot.draft);
        }
      }
    },
    [navigateTo],
  );

  const runWorkflowEffect = (action: WorkflowAction, shouldNavigate = true) =>
    Effect.gen(function* runWorkflowProgram() {
      yield* Effect.sync(() => {
        beginBusyAction(action.action);
      });
      const previousDraft = snapshot?.draft ?? null;
      const resultExit = yield* Effect.exit(
        workflowRequestEffect(action, t('coursition.app.errors.generic')),
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
      const result = resultExit.value;
      yield* Effect.sync(() => applySnapshot(result, shouldNavigate));
      const failedRun = failedGenerationRunFor(previousDraft, result.draft, action.action);
      if (failedRun !== null) {
        yield* Effect.sync(() => {
          setNotice(failedAiRunNotice(failedRun, t('coursition.app.errors.aiRunFailed')));
        });
      }
      return result;
    }).pipe(Effect.ensuring(Effect.sync(() => endBusyAction(action.action))));

  const runWorkflow = (action: WorkflowAction, shouldNavigate = true) => {
    Effect.runFork(runWorkflowEffect(action, shouldNavigate));
  };

  const runCourseTitleAutosave = useCallback(
    (draftId: string, nextTitle: string) => {
      const autosaveSequence = courseTitleAutosaveSequenceRef.current + 1;
      courseTitleAutosaveSequenceRef.current = autosaveSequence;
      Effect.runFork(
        Effect.gen(function* courseTitleAutosaveProgram() {
          const resultExit = yield* Effect.exit(
            workflowRequestEffect(
              {
                action: 'updateDraftTitle',
                draftId,
                title: nextTitle,
              },
              t('coursition.app.errors.generic'),
            ),
          );
          if (autosaveSequence !== courseTitleAutosaveSequenceRef.current) {
            return;
          }
          if (Exit.isFailure(resultExit)) {
            yield* Effect.sync(() => {
              if (lastSubmittedCourseTitleRef.current === nextTitle) {
                lastSubmittedCourseTitleRef.current = null;
              }
              setNotice(
                errorMessageFrom(
                  resultExit.cause.pipe(Cause.squash),
                  t('coursition.app.errors.generic'),
                ),
              );
            });
            return;
          }
          yield* Effect.sync(() => applySnapshot(resultExit.value, false, true, false));
        }),
      );
    },
    [applySnapshot, t],
  );

  const saveCourseTitleOnBlur = () => {
    if (draft === null) {
      return;
    }
    const nextTitle = courseTitle.trim();
    if (nextTitle.length === 0) {
      setCourseTitle(draft.title);
      setNotice(t('coursition.app.draft.titlePlaceholder'));
      return;
    }
    if (nextTitle === draft.title) {
      lastSubmittedCourseTitleRef.current = nextTitle;
      setCourseTitle(nextTitle);
      return;
    }
    if (nextTitle === lastSubmittedCourseTitleRef.current) {
      setCourseTitle(nextTitle);
      return;
    }
    lastSubmittedCourseTitleRef.current = nextTitle;
    setCourseTitle(nextTitle);
    runCourseTitleAutosave(draft.id, nextTitle);
  };

  const runPreparationAutosave = useCallback(
    (draftId: string, nextPreparation: CoursePreparation, submittedPreparationKey: string) => {
      const autosaveSequence = preparationAutosaveSequenceRef.current + 1;
      preparationAutosaveSequenceRef.current = autosaveSequence;
      Effect.runFork(
        Effect.gen(function* preparationAutosaveProgram() {
          const resultExit = yield* Effect.exit(
            workflowRequestEffect(
              {
                action: 'updateCoursePreparation',
                draftId,
                preparation: nextPreparation,
              },
              t('coursition.app.errors.generic'),
            ),
          );
          if (autosaveSequence !== preparationAutosaveSequenceRef.current) {
            return;
          }
          if (Exit.isFailure(resultExit)) {
            yield* Effect.sync(() => {
              if (lastSubmittedPreparationKeyRef.current === submittedPreparationKey) {
                lastSubmittedPreparationKeyRef.current = null;
              }
              setNotice(
                errorMessageFrom(
                  resultExit.cause.pipe(Cause.squash),
                  t('coursition.app.errors.generic'),
                ),
              );
            });
            return;
          }
          yield* Effect.sync(() => applySnapshot(resultExit.value, false, false));
        }),
      );
    },
    [applySnapshot, t],
  );

  const savePreparationOnBlur = () => {
    if (draft === null || activeStep !== 'preparation') {
      return;
    }
    const savedPreparationKey = coursePreparationKey(draft.learningBlueprint.coursePreparation);
    const localPreparationKey = coursePreparationKey(preparation);
    if (localPreparationKey === savedPreparationKey) {
      lastSubmittedPreparationKeyRef.current = localPreparationKey;
      return;
    }
    if (localPreparationKey === lastSubmittedPreparationKeyRef.current) {
      return;
    }
    lastSubmittedPreparationKeyRef.current = localPreparationKey;
    runPreparationAutosave(draft.id, preparation, localPreparationKey);
  };

  const runObjectiveAutosave = useCallback(
    (
      draftId: string,
      objectiveId: string,
      title: string,
      capability: string,
      submittedObjectiveKey: string,
    ) => {
      const autosaveSequence = (objectiveAutosaveSequenceRef.current.get(objectiveId) ?? 0) + 1;
      objectiveAutosaveSequenceRef.current.set(objectiveId, autosaveSequence);
      Effect.runFork(
        Effect.gen(function* objectiveAutosaveProgram() {
          const resultExit = yield* Effect.exit(
            workflowRequestEffect(
              {
                action: 'updateLearningObjective',
                capability,
                draftId,
                objectiveId,
                title,
              },
              t('coursition.app.errors.generic'),
            ),
          );
          if (objectiveAutosaveSequenceRef.current.get(objectiveId) !== autosaveSequence) {
            return;
          }
          if (Exit.isFailure(resultExit)) {
            yield* Effect.sync(() => {
              if (lastSubmittedObjectiveKeyRef.current.get(objectiveId) === submittedObjectiveKey) {
                lastSubmittedObjectiveKeyRef.current.delete(objectiveId);
              }
              setNotice(
                errorMessageFrom(
                  resultExit.cause.pipe(Cause.squash),
                  t('coursition.app.errors.generic'),
                ),
              );
            });
            return;
          }
          yield* Effect.sync(() => applySnapshot(resultExit.value, false));
        }),
      );
    },
    [applySnapshot, t],
  );

  const refreshSnapshot = useCallback(() => {
    Effect.runFork(
      Effect.gen(function* refreshSnapshotProgram() {
        yield* Effect.sync(() => {
          beginBusyAction('getState');
        });
        const resultExit = yield* Effect.exit(
          workflowRequestEffect({ action: 'getState' }, t('coursition.app.errors.generic')),
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
          return;
        }
        yield* Effect.sync(() => applySnapshot(resultExit.value, false));
      }).pipe(Effect.ensuring(Effect.sync(() => endBusyAction('getState')))),
    );
  }, [applySnapshot, t]);

  const showEffectError = (error: unknown) =>
    Effect.sync(() => {
      setNotice(errorMessageFrom(error, t('coursition.app.errors.generic')));
    });

  const sessionRequestEffect = () =>
    Effect.tryPromise({
      catch: (cause) =>
        new CoursitionUiEffectError({
          cause,
          message: errorMessageFrom(cause, t('coursition.app.errors.generic')),
        }),
      try: () => Promise.resolve(effectBff.client.auth.session({})),
    }).pipe(
      Effect.flatMap((payload) =>
        sessionPayloadFromUnknown(payload).pipe(
          Effect.mapError(
            (cause) =>
              new CoursitionUiEffectError({
                cause,
                message: errorMessageFrom(cause, t('coursition.app.errors.generic')),
              }),
          ),
        ),
      ),
    );

  const authRequestEffect = () =>
    Effect.tryPromise({
      catch: (cause) =>
        new CoursitionUiEffectError({
          cause,
          message: errorMessageFrom(
            cause,
            t(
              authMode === 'signUp'
                ? 'coursition.app.auth.signUpFailed'
                : 'coursition.app.auth.signInFailed',
            ),
          ),
        }),
      try: () =>
        authMode === 'signUp'
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
      const payloadExit = yield* Effect.exit(sessionRequestEffect());
      if (Exit.isFailure(payloadExit)) {
        yield* showEffectError(payloadExit.cause.pipe(Cause.squash));
        return;
      }
      const user = payloadExit.value.session?.user ?? null;
      yield* Effect.sync(() => setSessionUser(user));
      if (user !== null) {
        const resultExit = yield* Effect.exit(
          workflowRequestEffect({ action: 'getState' }, t('coursition.app.errors.generic')),
        );
        if (Exit.isFailure(resultExit)) {
          yield* showEffectError(resultExit.cause.pipe(Cause.squash));
          return;
        }
        yield* Effect.sync(() => applySnapshot(resultExit.value, false));
      }
    }).pipe(Effect.ensuring(Effect.sync(() => endBusyAction('auth'))));

  useEffect(() => {
    if (sessionUser !== null && snapshot === null) {
      void refreshSnapshot();
    }
  }, [refreshSnapshot, sessionUser, snapshot]);

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

  const setModeAndContinue = (mode: AiMode) => {
    if (draft === null) {
      return;
    }
    Effect.runFork(
      runWorkflowEffect({ action: 'setMode', draftId: draft.id, mode }, false).pipe(
        Effect.flatMap((result) => {
          if (result?.draft !== undefined && result.draft !== null) {
            return runWorkflowEffect({
              action: 'goToStep',
              draftId: result.draft.id,
              step: 'sources',
            });
          }
          return Effect.void;
        }),
      ),
    );
  };

  const addSource = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (draft === null) {
      return;
    }
    const formData = new FormData(event.currentTarget);
    const submittedName = formString(formData, 'sourceName');
    const submittedContent = formString(formData, 'sourceContent');
    const name = submittedName || sourceName.trim() || (sourceFile?.name ?? '');
    if (name.length === 0) {
      setNotice(t('coursition.app.sources.sourceNameRequired'));
      return;
    }
    const submitSource = (content: string) => {
      if (sourceType !== 'file' && content.trim().length === 0) {
        return Effect.sync(() => setNotice(t('coursition.app.errors.generic')));
      }
      return runWorkflowEffect({
        action: 'addSource',
        draftId: draft.id,
        source: {
          content,
          name,
          type: sourceType,
        },
      }).pipe(
        Effect.flatMap((result) =>
          Effect.sync(() => {
            if (result !== null) {
              setSourceContent('');
              setSourceFile(null);
              setSourceName('');
            }
          }),
        ),
      );
    };
    if (sourceType === 'file') {
      if (sourceFile === null) {
        setNotice(t('coursition.app.errors.generic'));
        return;
      }
      Effect.runFork(
        Effect.gen(function* addFileSourceProgram() {
          yield* Effect.sync(() => beginBusyAction('file'));
          const payloadExit = yield* Effect.exit(filePayloadFromEffect(sourceFile));
          if (Exit.isFailure(payloadExit)) {
            yield* showEffectError(payloadExit.cause.pipe(Cause.squash));
            return;
          }
          yield* submitSource(payloadExit.value);
        }).pipe(Effect.ensuring(Effect.sync(() => endBusyAction('file')))),
      );
      return;
    }
    Effect.runFork(submitSource(submittedContent || sourceContent));
  };

  const updatePreparationField = <Field extends keyof CoursePreparation>(
    field: Field,
    value: CoursePreparation[Field],
  ) => {
    setPreparation((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const saveObjectiveForm = (form: HTMLFormElement, objectiveId: string) => {
    if (draft === null) {
      return;
    }
    const objective = draft.learningBlueprint.objectives.find(
      (candidate) => candidate.id === objectiveId,
    );
    if (objective === undefined) {
      return;
    }
    const formData = new FormData(form);
    const capability = formString(formData, 'capability');
    const title = formString(formData, 'title');
    const savedObjectiveKey = objectiveEditKey(objective.title, objective.capability);
    const localObjectiveKey = objectiveEditKey(title, capability);
    if (localObjectiveKey === savedObjectiveKey) {
      lastSubmittedObjectiveKeyRef.current.set(objectiveId, localObjectiveKey);
      return;
    }
    if (localObjectiveKey === lastSubmittedObjectiveKeyRef.current.get(objectiveId)) {
      return;
    }
    lastSubmittedObjectiveKeyRef.current.set(objectiveId, localObjectiveKey);
    runObjectiveAutosave(draft.id, objectiveId, title, capability, localObjectiveKey);
  };

  const saveObjectiveOnBlur = (event: FocusEvent<HTMLFormElement>, objectiveId: string) => {
    const nextFocusedElement = event.relatedTarget;
    if (nextFocusedElement instanceof Node && event.currentTarget.contains(nextFocusedElement)) {
      return;
    }
    saveObjectiveForm(event.currentTarget, objectiveId);
  };

  const saveObjectiveOnSubmit = (event: FormEvent<HTMLFormElement>, objectiveId: string) => {
    event.preventDefault();
    saveObjectiveForm(event.currentTarget, objectiveId);
  };

  const saveActivityBriefForm = (form: HTMLFormElement, briefId: string) => {
    if (draft === null) {
      return;
    }
    const brief = draft.learningBlueprint.activityBriefs.find(
      (candidate) => candidate.id === briefId,
    );
    if (brief === undefined) {
      return;
    }
    const formData = new FormData(form);
    const submittedType = formString(formData, 'type');
    const type =
      activityTypes.find((activityType) => activityType === submittedType) ?? activityTypes[1];
    const submittedBrief = {
      feedbackGuidance: formString(formData, 'feedbackGuidance'),
      instructions: formString(formData, 'instructions'),
      learnerAction: formString(formData, 'learnerAction'),
      successCriteria: formString(formData, 'successCriteria'),
      title: formString(formData, 'title'),
      type,
    };
    const savedActivityBriefKey = activityBriefEditKey({
      feedbackGuidance: brief.feedbackGuidance,
      instructions: brief.instructions,
      learnerAction: brief.learnerAction,
      successCriteria: brief.successCriteria,
      title: brief.title,
      type: brief.type,
    });
    const submittedActivityBriefKey = activityBriefEditKey(submittedBrief);
    if (submittedActivityBriefKey === savedActivityBriefKey) {
      lastSubmittedActivityBriefKeyRef.current.set(briefId, submittedActivityBriefKey);
      return;
    }
    if (submittedActivityBriefKey === lastSubmittedActivityBriefKeyRef.current.get(briefId)) {
      return;
    }
    lastSubmittedActivityBriefKeyRef.current.set(briefId, submittedActivityBriefKey);
    runWorkflow({
      action: 'updateActivityBrief',
      briefId,
      draftId: draft.id,
      ...submittedBrief,
    });
  };

  const saveActivityBriefOnBlur = (event: FocusEvent<HTMLFormElement>, briefId: string) => {
    const nextFocusedElement = event.relatedTarget;
    if (nextFocusedElement instanceof Node && event.currentTarget.contains(nextFocusedElement)) {
      return;
    }
    saveActivityBriefForm(event.currentTarget, briefId);
  };

  const saveActivityBriefOnSubmit = (event: FormEvent<HTMLFormElement>, briefId: string) => {
    event.preventDefault();
    saveActivityBriefForm(event.currentTarget, briefId);
  };

  const goToStep = (step: DraftStep) => {
    if (draft === null || step === activeStep) {
      return;
    }
    void runWorkflow({ action: 'goToStep', draftId: draft.id, step });
  };

  const openPreview = () => {
    if (draft === null || activeStep === 'preview') {
      return;
    }
    void runWorkflow({ action: 'openPreview', draftId: draft.id });
  };

  const goToNavigationStep = (step: DraftStep) => {
    if (step === 'preview') {
      openPreview();
      return;
    }
    goToStep(step);
  };

  const nextStep = () => {
    if (draft === null) {
      return;
    }
    if (activeStep === 'sources' && draft.mode === 'generate') {
      void runWorkflow({ action: 'generateCourse', draftId: draft.id });
      return;
    }
    if (activeStep === 'courseContent') {
      openPreview();
      return;
    }
    const currentIndex = workflowStepIndex(activeStep);
    const next = workflowSteps[currentIndex + 1];
    if (next !== undefined) {
      goToStep(next);
    }
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

  const currentGate =
    draft === null || activeStep === 'preview'
      ? { allowed: true }
      : getWorkflowStepGate(draft, activeStep);
  const nextGate = nextGateFor(draft, activeStep);

  if (sessionUser === null) {
    return (
      <main className="mx-auto grid min-h-[calc(100dvh-3.5rem)] max-w-xl place-items-center px-4 py-8">
        <Toaster />
        <section className={`${cardClass} w-full`} id="course-studio">
          <form className={panelClass} onSubmit={handleAuth}>
            <fieldset className="grid gap-3">
              <legend className="text-2xl font-bold text-fg-primary">
                {t('coursition.app.auth.modeLabel')}
              </legend>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => setAuthMode('signIn')}
                  type="button"
                  variant={authMode === 'signIn' ? 'primary' : 'secondary'}
                >
                  {t('coursition.app.auth.signIn')}
                </Button>
                <Button
                  onClick={() => setAuthMode('signUp')}
                  type="button"
                  variant={authMode === 'signUp' ? 'primary' : 'secondary'}
                >
                  {t('coursition.app.auth.signUp')}
                </Button>
              </div>
            </fieldset>
            <TextInputField
              label={t('coursition.app.auth.email')}
              name="email"
              onChange={(event) => setAuthEmail(event.currentTarget.value)}
              placeholder={t('coursition.app.auth.emailPlaceholder')}
              required
              type="email"
              value={authEmail}
            />
            {authMode === 'signUp' ? (
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
                    authMode === 'signUp'
                      ? 'coursition.app.auth.creatingAccount'
                      : 'coursition.app.auth.signingIn',
                  )
                : t(
                    authMode === 'signUp'
                      ? 'coursition.app.auth.createAccount'
                      : 'coursition.app.auth.signIn',
                  )}
            </Button>
          </form>
        </section>
      </main>
    );
  }

  const draftSummaries = snapshot?.drafts ?? [];

  return (
    <main className="mx-auto grid w-full max-w-7xl gap-3" id="course-studio">
      <Toaster />

      {draft === null ? (
        <section
          className={
            draftSummaries.length === 0
              ? 'grid min-h-[20rem] place-items-start sm:place-items-center'
              : 'grid gap-3'
          }
        >
          <form
            className={
              draftSummaries.length === 0
                ? 'grid w-full max-w-2xl gap-3 rounded-md bg-base p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end'
                : 'grid gap-3 rounded-md bg-base p-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end'
            }
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

          {draftSummaries.length === 0 ? null : (
            <section className="grid gap-3 rounded-md bg-base p-3">
              <h1 className="text-xl font-bold text-fg-primary">
                {t('coursition.app.dashboard.title')}
              </h1>
              <ul className="grid gap-2">
                {draftSummaries.map((summary) => (
                  <li
                    className="grid gap-3 rounded-md bg-fill-base p-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                    key={summary.id}
                  >
                    <div className="min-w-0">
                      <Link
                        className="text-lg font-bold text-fg-primary no-underline"
                        params={{
                          courseId: summary.id,
                          lang: language,
                          step: courseRouteStepSlug(language, summary.step),
                        }}
                        to={courseRoutePattern(language)}
                      >
                        {summary.title}
                      </Link>
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
                        variant="secondary"
                      >
                        {t('coursition.app.draft.resume')}
                      </Button>
                      <Button
                        disabled={isDraftListBusy}
                        onClick={() => deleteDraft(summary.id)}
                        type="button"
                        variant="danger"
                      >
                        {t('coursition.app.dashboard.delete')}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </section>
      ) : (
        <section className="grid min-w-0 gap-3">
          <section className={`${cardClass} grid min-w-0 gap-3`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="min-w-0 flex-1">
                <Input
                  aria-label={t('coursition.app.draft.title')}
                  className="w-full min-w-0 rounded-md border border-transparent bg-transparent px-1 py-1 text-xl font-bold text-fg-primary outline-none transition placeholder:text-fg-secondary/60 hover:bg-fill-hover focus:border-border-primary focus:bg-fill-base focus:ring-2 focus:ring-ring sm:text-2xl"
                  onBlur={saveCourseTitleOnBlur}
                  onChange={(event) => setCourseTitle(event.currentTarget.value)}
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
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={isRouteActionBusy || workflowStepIndex(activeStep) <= 0}
                  onClick={previousStep}
                  type="button"
                  variant="secondary"
                >
                  {t('coursition.app.navigation.back')}
                </Button>
                <Button
                  disabled={isRouteActionBusy || !nextGate.allowed}
                  onClick={nextStep}
                  type="button"
                  variant="primary"
                >
                  {t(
                    activeStep === 'sources' && draft.mode === 'generate'
                      ? 'coursition.app.modes.generate.action'
                      : 'coursition.app.navigation.next',
                  )}
                </Button>
              </div>
            </div>
            {currentGate.allowed ? null : (
              <p className={errorTextClass}>{gateText(currentGate, t)}</p>
            )}
            {nextGate.allowed || activeStep === 'sources' ? null : (
              <p className={mutedTextClass}>{gateText(nextGate, t)}</p>
            )}
            <nav aria-label={t('coursition.app.navigation.label')} className="min-w-0">
              <Steps
                className="max-w-full min-w-0 overflow-x-auto overscroll-x-contain pb-1"
                count={navigationSteps.length}
                linear={false}
                size="sm"
                step={currentNavigationIndex}
                variant="subtle"
              >
                <Steps.List className="w-max min-w-full">
                  {navigationSteps.map((step, index) => {
                    const gate = navigationGateFor(draft, step);
                    const isCurrentStep = index === currentNavigationIndex;
                    const isStepComplete = isNavigationStepComplete(draft, step);
                    const isStepStale = isNavigationStepStale(draft, step);
                    const isStepReady = step === 'preview' && gate.allowed && !isStepStale;
                    const isStepVisuallyComplete = isStepComplete && !isStepReady;
                    const visualState = {
                      isComplete: isStepVisuallyComplete,
                      isCurrent: isCurrentStep,
                      isReady: isStepReady,
                      isStale: isStepStale,
                    };
                    const isStepDisabled = isRouteActionBusy || !gate.allowed;
                    const canNavigateToStep = !isCurrentStep && !isStepDisabled;
                    return (
                      <Steps.Item
                        className="data-[orientation=horizontal]:flex-none"
                        index={index}
                        key={step}
                        {...(index === currentNavigationIndex
                          ? { ref: activeNavigationStepRef }
                          : {})}
                      >
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
                            goToNavigationStep(step);
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
                            <span className="h-px flex-1 bg-current" />
                            <span className="h-1.5 w-1.5 rotate-45 border-r border-t border-current" />
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
            <section className={`${cardClass} ${panelClass}`}>
              <div>
                <h2 className="text-xl font-bold text-fg-primary">
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
                    setModeAndContinue(value);
                  }
                }}
                orientation="horizontal"
                value={draft.mode}
                variant="solid"
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
            <section className={`${cardClass} ${panelClass}`}>
              <div>
                <h2 className="text-xl font-bold text-fg-primary">
                  {t('coursition.app.sources.title')}
                </h2>
              </div>
              <form className="grid gap-3" onSubmit={addSource}>
                <fieldset className="flex flex-wrap gap-2">
                  <legend className="sr-only">{t('coursition.app.sources.title')}</legend>
                  {sourceTypes.map((type) => (
                    <Button
                      key={type}
                      onClick={() => setSourceType(type)}
                      type="button"
                      variant={sourceType === type ? 'primary' : 'secondary'}
                    >
                      {t(`coursition.app.sourceTypes.${type}`)}
                    </Button>
                  ))}
                </fieldset>
                {sourceType === 'file' ? (
                  <FormInput
                    id="sourceFile"
                    label={t('coursition.app.sources.chooseFile')}
                    onChange={(event) => {
                      const file = event.currentTarget.files?.[0] ?? null;
                      setSourceFile(file);
                      setSourceName(file?.name ?? '');
                    }}
                    type="file"
                  />
                ) : null}
                <TextInputField
                  label={t('coursition.app.sources.sourceName')}
                  name="sourceName"
                  onChange={(event) => setSourceName(event.currentTarget.value)}
                  placeholder={t(
                    sourceType === 'url'
                      ? 'coursition.app.sources.urlNamePlaceholder'
                      : 'coursition.app.sources.notesNamePlaceholder',
                  )}
                  required
                  value={sourceName}
                />
                {sourceType === 'url' ? (
                  <TextInputField
                    label={t('coursition.app.sources.urlContent')}
                    name="sourceContent"
                    onChange={(event) => setSourceContent(event.currentTarget.value)}
                    placeholder={t('coursition.app.sources.urlPlaceholder')}
                    required
                    type="url"
                    value={sourceContent}
                  />
                ) : null}
                {sourceType === 'notes' ? (
                  <FormTextarea
                    id="sourceContent"
                    label={t('coursition.app.sources.notesContent')}
                    name="sourceContent"
                    onChange={(event) => setSourceContent(event.currentTarget.value)}
                    placeholder={t('coursition.app.sources.notesPlaceholder')}
                    required
                    rows={8}
                    value={sourceContent}
                  />
                ) : null}
                <Button disabled={isSourceAddBusy} type="submit" variant="primary">
                  {busyAction === 'addSource' || busyAction === 'file'
                    ? t('coursition.app.sources.adding')
                    : t('coursition.app.sources.add')}
                </Button>
              </form>
              {visibleSources.length === 0 ? (
                <p className={mutedTextClass}>
                  {draft.mode === 'generate'
                    ? t('coursition.app.sources.generateEmptyCopy')
                    : t('coursition.app.sources.emptyCopy')}
                </p>
              ) : (
                <ul className="grid gap-2">
                  {visibleSources.map((source) => {
                    const canPreview = canPreviewSource(source);
                    const isPreviewExpanded = expandedSourcePreviewIdSet.has(source.id);
                    const previewId = `source-preview-${source.id}`;
                    return (
                      <li className="grid gap-2 rounded-md bg-fill-base p-3" key={source.id}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="grid gap-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-base font-bold text-fg-primary">{source.name}</h3>
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
                                type="button"
                                variant="secondary"
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
                                type="button"
                                variant="secondary"
                              >
                                {t('coursition.app.sources.retry')}
                              </Button>
                            ) : null}
                            <Button
                              disabled={isSourceDeleteBusy}
                              onClick={() =>
                                void runWorkflow({
                                  action: 'deleteSource',
                                  draftId: draft.id,
                                  sourceId: source.id,
                                })
                              }
                              type="button"
                              variant="danger"
                            >
                              {t('coursition.app.sources.delete')}
                            </Button>
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
            <section className={`${cardClass} ${panelClass}`}>
              <h2 className="text-xl font-bold text-fg-primary">
                {t('coursition.app.preparation.title')}
              </h2>
              <div className="grid gap-3" onBlur={savePreparationOnBlur}>
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
                  onChange={(event) => updatePreparationField('depth', event.currentTarget.value)}
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
                <FormCheckbox
                  checked={preparation.sourceStrictness === 'strict'}
                  id="sourceStrictness"
                  label={t('coursition.app.preparation.strict')}
                  onCheckedChange={(checked) =>
                    updatePreparationField('sourceStrictness', checked ? 'strict' : 'standard')
                  }
                />
              </div>
            </section>
          ) : null}

          {activeStep === 'objectives' ? (
            <section className={`${cardClass} ${panelClass}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="grid gap-1">
                  <h2 className="text-xl font-bold text-fg-primary">
                    {t('coursition.app.objectives.title')}
                  </h2>
                  <p className={mutedTextClass}>{t('coursition.app.objectives.purpose')}</p>
                </div>
                <Button
                  disabled={isObjectiveGenerationBusy}
                  onClick={() =>
                    void runWorkflow({ action: 'generateLearningBlueprint', draftId: draft.id })
                  }
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
                      {assumption}
                    </li>
                  ))}
                </ul>
              ) : null}
              {draft.learningBlueprint.objectives.length === 0 ? (
                <p className={mutedTextClass}>{t('coursition.app.objectives.emptyObjectives')}</p>
              ) : (
                <div className="grid gap-3">
                  {draft.learningBlueprint.objectives.map((objective, index) => (
                    <form
                      className="grid gap-2 rounded-md bg-fill-base p-3"
                      key={objective.id}
                      onBlur={(event) => saveObjectiveOnBlur(event, objective.id)}
                      onSubmit={(event) => saveObjectiveOnSubmit(event, objective.id)}
                    >
                      <p className={tinyMetaClass}>
                        {t('coursition.app.objectives.objectiveNumber', { number: index + 1 })}
                      </p>
                      <FormInput
                        defaultValue={objective.title}
                        id={`${objective.id}-title`}
                        label={t('coursition.app.objectives.objectiveTitle')}
                        name="title"
                        placeholder={t('coursition.app.objectives.objectiveTitlePlaceholder')}
                      />
                      <FormTextarea
                        defaultValue={objective.capability}
                        id={`${objective.id}-capability`}
                        label={t('coursition.app.objectives.capability')}
                        name="capability"
                        placeholder={t('coursition.app.objectives.capabilityPlaceholder')}
                        rows={4}
                      />
                      <p className={mutedTextClass}>
                        {t(`coursition.app.objectives.sourceSupport.${objective.sourceSupport}`)}
                      </p>
                    </form>
                  ))}
                </div>
              )}
            </section>
          ) : null}

          {activeStep === 'activityPlan' ? (
            <section className={`${cardClass} ${panelClass}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-bold text-fg-primary">
                  {t('coursition.app.activityPlan.title')}
                </h2>
                <Button
                  disabled={isActivityGenerationBusy}
                  onClick={() =>
                    void runWorkflow({ action: 'generateActivities', draftId: draft.id })
                  }
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
                <div className="grid gap-3">
                  {draft.learningBlueprint.activityBriefs.map((brief, index) => (
                    <form
                      className="grid gap-2 rounded-md bg-fill-base p-3"
                      key={brief.id}
                      onBlur={(event) => saveActivityBriefOnBlur(event, brief.id)}
                      onSubmit={(event) => saveActivityBriefOnSubmit(event, brief.id)}
                    >
                      <p className={tinyMetaClass}>
                        {t('coursition.app.activityPlan.activityNumber', { number: index + 1 })}
                      </p>
                      <FormInput
                        defaultValue={brief.title}
                        id={`${brief.id}-title`}
                        label={t('coursition.app.activityPlan.activityTitle')}
                        name="title"
                        placeholder={t('coursition.app.activityPlan.activityTitlePlaceholder')}
                      />
                      <SelectTemplate
                        defaultValue={[brief.type]}
                        id={`${brief.id}-type`}
                        items={activityTypes.map((type) => ({
                          displayValue: t(`coursition.app.activityPlan.types.${type}`),
                          label: t(`coursition.app.activityPlan.types.${type}`),
                          value: type,
                        }))}
                        label={t('coursition.app.activityPlan.type')}
                        name="type"
                        placeholder={t('coursition.app.activityPlan.type')}
                      />
                      <FormTextarea
                        defaultValue={brief.instructions}
                        id={`${brief.id}-instructions`}
                        label={t('coursition.app.activityPlan.instructions')}
                        name="instructions"
                        placeholder={t('coursition.app.activityPlan.instructionsPlaceholder')}
                        rows={4}
                      />
                      <FormTextarea
                        defaultValue={brief.learnerAction}
                        id={`${brief.id}-learnerAction`}
                        label={t('coursition.app.activityPlan.learnerAction')}
                        name="learnerAction"
                        placeholder={t('coursition.app.activityPlan.learnerActionPlaceholder')}
                        rows={4}
                      />
                      <FormTextarea
                        defaultValue={brief.successCriteria}
                        id={`${brief.id}-successCriteria`}
                        label={t('coursition.app.activityPlan.successCriteria')}
                        name="successCriteria"
                        placeholder={t('coursition.app.activityPlan.successCriteriaPlaceholder')}
                        rows={4}
                      />
                      <FormTextarea
                        defaultValue={brief.feedbackGuidance}
                        id={`${brief.id}-feedbackGuidance`}
                        label={t('coursition.app.activityPlan.feedbackGuidance')}
                        name="feedbackGuidance"
                        placeholder={t('coursition.app.activityPlan.feedbackGuidancePlaceholder')}
                        rows={4}
                      />
                    </form>
                  ))}
                </div>
              )}
            </section>
          ) : null}

          {activeStep === 'courseContent' ? (
            <section className={`${cardClass} ${panelClass}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-bold text-fg-primary">
                  {t('coursition.app.courseContent.title')}
                </h2>
                <Button
                  disabled={isCourseContentGenerationBusy}
                  onClick={() =>
                    void runWorkflow({ action: 'generateCourseContent', draftId: draft.id })
                  }
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
            <section className={`${cardClass} ${panelClass}`}>
              <h2 className="text-xl font-bold text-fg-primary">
                {t('coursition.app.preview.title')}
              </h2>
              <CourseContentView draft={draft} t={t} />
              <UnlinkedGeneratedActivitiesView draft={draft} t={t} />
              <ReviewView draft={draft} runWorkflow={runWorkflow} t={t} />
            </section>
          ) : null}
        </section>
      )}
    </main>
  );
};
