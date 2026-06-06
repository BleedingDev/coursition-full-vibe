import { Link, useNavigate } from '@modern-js/plugin-tanstack/runtime';
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
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, ComponentType, FormEvent } from 'react';
import type { MDXEditorMethods } from '@mdxeditor/editor';
import effectBff from '@api/effect/index';
import type {
  ActivityType,
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
  hasActivityPlan as draftHasActivityPlan,
  hasCourseContent as draftHasCourseContent,
  hasCoursePreparation as draftHasCoursePreparation,
  hasGeneratedCourse as draftHasGeneratedCourse,
  hasObjectiveMap as draftHasObjectiveMap,
  hasUsableSourceMaterial,
  workflowStepIndex,
  workflowSteps,
} from '@shared/coursition/workflow';
import type {
  CoursePreparation,
  SessionPayload,
  SessionUser,
  WorkflowAction,
  WorkflowSnapshot,
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
type GeneratedActivity = CourseDraft['learningBlueprint']['generatedActivities'][number];
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

interface NavigationStepVisualState {
  isComplete: boolean;
  isCurrent: boolean;
  isReady: boolean;
  isStale: boolean;
}

const workflowApiPath = '/api/coursition/workflow';
const sourceTypes = ['notes', 'url', 'file'] as const satisfies readonly SourceType[];
const navigationSteps = [...workflowSteps, 'preview'] as const satisfies readonly DraftStep[];
const languagePreferences = [
  'source',
  'en',
  'cs',
] as const satisfies readonly CourseLanguagePreference[];
const sourceDataUrlPattern = /^data:[^,]+;base64,/u;
const readableFileExtensions = new Set([
  'csv',
  'json',
  'md',
  'mdx',
  'rtf',
  'text',
  'tsv',
  'txt',
  'xml',
  'yaml',
  'yml',
]);

const labelClass = 'text-sm font-semibold text-fg-primary';
const mutedTextClass = 'text-sm text-fg-secondary';
const tinyMetaClass = 'text-xs font-medium tracking-normal text-fg-secondary';
const errorTextClass = 'text-sm font-semibold text-button-bg-danger-active';
const cardClass = 'rounded-md bg-base p-3';
const panelClass = 'grid gap-3';

const fileExtension = (name: string) => {
  const extension = name.split('.').pop();
  return typeof extension === 'string' ? extension.toLowerCase() : '';
};

const formString = (formData: FormData, field: string) => {
  const value = formData.get(field);
  return typeof value === 'string' ? value.trim() : '';
};

const activeSources = (draft: CourseDraft | null) =>
  draft?.sources.filter((source) => source.status !== 'deleted') ?? [];

const coursePreparationKey = (preparation: CoursePreparation) => JSON.stringify(preparation);

const hasAnyCourseContent = (draft: CourseDraft | null) =>
  draft?.courseContent.sections.some((section) => section.blocks.length > 0) ?? false;

const hasActivityPlan = (draft: CourseDraft | null) =>
  (draft?.learningBlueprint.activityBriefs.length ?? 0) > 0;

const hasObjectives = (draft: CourseDraft | null) =>
  (draft?.learningBlueprint.objectives.length ?? 0) > 0;

const shouldShowSourcePreview = (content: string) =>
  content.trim().length !== 0 && !sourceDataUrlPattern.test(content);

const canPreviewSource = (source: SourceAsset) =>
  (source.status === 'processed' || source.status === 'partially_processed') &&
  shouldShowSourcePreview(source.content);

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
      return draftHasActivityPlan(draft);
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

const foreignPromise = <Value,>(
  evaluate: () => PromiseLike<Value>,
  fallback = 'Operation failed.',
) =>
  Effect.tryPromise({
    catch: (cause) =>
      new CoursitionUiEffectError({
        cause,
        message: errorMessageFrom(cause, fallback),
      }),
    try: evaluate,
  });

const workflowErrorMessageFromBody = (body: string, fallback: string) => {
  if (body.trim().length === 0) {
    return fallback;
  }
  let message = body;
  try {
    const { message: payloadMessage } = JSON.parse(body) as { message?: unknown };
    if (typeof payloadMessage === 'string') {
      message = payloadMessage;
    }
  } catch {
    message = body;
  }
  return message;
};

const workflowRequestEffect = (
  action: WorkflowAction,
  fallback: string,
): Effect.Effect<WorkflowSnapshot, CoursitionUiEffectError> =>
  Effect.gen(function* workflowRequestProgram() {
    const response = yield* foreignPromise(() =>
      globalThis['fetch'](workflowApiPath, {
        body: JSON.stringify(action),
        credentials: 'same-origin',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        method: 'POST',
      }),
    );
    if (!response.ok) {
      const body = yield* foreignPromise(() => response.text());
      return yield* new CoursitionUiEffectError({
        cause: response.status,
        message: workflowErrorMessageFromBody(body, fallback),
      });
    }
    return yield* foreignPromise(() => response.json() as Promise<WorkflowSnapshot>);
  });

const base64FromArrayBuffer = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 32_768;
  let binary = '';
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCodePoint(...chunk);
  }
  return globalThis.btoa(binary);
};

const readFileAsDataUrlEffect = (file: File) =>
  Effect.gen(function* readFileAsDataUrlProgram() {
    const buffer = yield* foreignPromise(() => file.arrayBuffer());
    const mimeType = file.type.length > 0 ? file.type : 'application/octet-stream';
    return `data:${mimeType};base64,${base64FromArrayBuffer(buffer)}`;
  });

const filePayloadFromEffect = (file: File) => {
  const extension = fileExtension(file.name);
  if (readableFileExtensions.has(extension)) {
    return foreignPromise(() => file.text()).pipe(
      Effect.map((content) => ({
        content,
        sizeLabel: `${content.length} chars`,
      })),
    );
  }
  return readFileAsDataUrlEffect(file).pipe(
    Effect.map((content) => ({
      content,
      sizeLabel: `${file.size} bytes`,
    })),
  );
};

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
                      toolbarContents: () => (
                        <>
                          <UndoRedo />
                          <Separator />
                          <BlockTypeSelect />
                          <BoldItalicUnderlineToggles />
                          <ListsToggle />
                          <CreateLink />
                          <InsertThematicBreak />
                        </>
                      ),
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

const SourceMarkdownPreview = ({
  loadingLabel,
  value,
}: {
  loadingLabel: string;
  value: string;
}) => (
  <div className="max-h-72 overflow-auto rounded-md bg-base p-3">
    <Suspense
      fallback={
        <div className="grid min-h-24 place-items-center text-sm font-medium text-fg-secondary">
          {loadingLabel}
        </div>
      }
    >
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

const CourseContentView = ({ draft, t }: { draft: CourseDraft; t: Translate }) => (
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
          <p className="text-sm leading-6 text-fg-primary">{section.summary}</p>
        </header>
        <div className="grid gap-4">
          {section.blocks.map((block) => {
            const body = contentBlockBody(block);
            return (
              <article className="grid gap-2" key={block.id}>
                <h4 className="text-base font-bold text-fg-primary">
                  {t(`coursition.app.blockTypes.${block.type}`)}
                </h4>
                <p className="whitespace-pre-wrap text-sm leading-6 text-fg-primary">{body}</p>
              </article>
            );
          })}
        </div>
      </section>
    ))}
  </div>
);

type RetrievalCheckActivity = Extract<GeneratedActivity, { type: 'retrieval_check' }>;
type PracticeTaskActivity = Extract<GeneratedActivity, { type: 'practice_task' }>;
type ScenarioDecisionActivity = Extract<GeneratedActivity, { type: 'scenario_decision' }>;
type OrderingMatchingActivity = Extract<GeneratedActivity, { type: 'ordering_matching' }>;
type RubricAnswerActivity = Extract<GeneratedActivity, { type: 'rubric_answer' }>;
type NotPlayableActivity = Extract<GeneratedActivity, { type: 'not_playable' }>;
type NotPlayableActivity = Extract<GeneratedActivity, { type: 'not_playable' }>;

// i18n-ignore -- The simple JSX text scanner can mistake this generic interface for rendered text.
interface ActivityEngineProps<Activity> {
  activity: Activity;
  showPrompt?: boolean;
  t: Translate;
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
    className={`rounded-md p-3 text-sm leading-6 ${
      tone === 'success'
        ? 'bg-button-bg-primary-light text-button-fg-primary-light'
        : 'bg-button-bg-warning-light text-button-fg-warning-light'
    }`}
  >
    <p className="font-semibold">{title}</p>
    <p className="whitespace-pre-wrap">{body}</p>
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

const hasValidOrderingPositions = (
  items: OrderingMatchingActivity['interaction']['items'],
): boolean => {
  const positions = items.flatMap(function itemCorrectPosition(item) {
    return typeof item.correctPosition === 'number' && Number.isFinite(item.correctPosition)
      ? [item.correctPosition]
      : [];
  });
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
      return null;
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
        <p className="whitespace-pre-wrap text-sm leading-6 text-fg-primary">
          {interaction.question}
        </p>
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
  showPrompt = true,
  t,
}: ActivityEngineProps<PracticeTaskActivity>) => {
  const { interaction } = activity;
  const [answer, setAnswer] = useState('');
  const [hasCompared, setHasCompared] = useState(false);

  return (
    <div className="grid gap-3">
      {showPrompt ? (
        <p className="whitespace-pre-wrap text-sm leading-6 text-fg-primary">
          {interaction.prompt}
        </p>
      ) : null}
      <FormTextarea
        id={`${activity.id}-practice-answer`}
        label={interaction.submissionLabel}
        onChange={(event) => {
          setAnswer(event.currentTarget.value);
          setHasCompared(false);
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
          disabled={answer.trim().length === 0}
          onClick={() => setHasCompared(true)}
          type="button"
          variant="primary"
        >
          {t('coursition.app.preview.compareWithCriteria')}
        </Button>
      </div>
      {hasCompared ? (
        <FeedbackPanel
          body={interaction.feedback}
          title={t('coursition.app.preview.revise')}
          tone="success"
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
        <p className="whitespace-pre-wrap text-sm leading-6 text-fg-primary">
          {interaction.scenario}
        </p>
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
    const allMatched = interaction.items.every(function itemHasSelectedMatch(item) {
      return (matches[item.id] ?? '') !== '';
    });
    const correctMatchCount = interaction.items.filter(function itemHasCorrectMatch(item) {
      return matches[item.id] === item.matchLabel;
    }).length;

    return (
      <div className="grid gap-3">
        {showPrompt ? (
          <p className="whitespace-pre-wrap text-sm leading-6 text-fg-primary">
            {interaction.prompt}
          </p>
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
  const correctOrderCount = orderedItems.filter(function itemHasCorrectPosition(item, index) {
    return item.correctPosition === index + 1;
  }).length;

  return (
    <div className="grid gap-3">
      {showPrompt ? (
        <p className="whitespace-pre-wrap text-sm leading-6 text-fg-primary">
          {interaction.prompt}
        </p>
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
  showPrompt = true,
  t,
}: ActivityEngineProps<RubricAnswerActivity>) => {
  const { interaction } = activity;
  const [answer, setAnswer] = useState('');
  const [checkedCriteria, setCheckedCriteria] = useState<readonly string[]>([]);
  const [hasCompared, setHasCompared] = useState(false);
  const checkedCount = checkedCriteria.length;

  return (
    <div className="grid gap-3">
      {showPrompt ? (
        <p className="whitespace-pre-wrap text-sm leading-6 text-fg-primary">
          {interaction.prompt}
        </p>
      ) : null}
      <FormTextarea
        id={`${activity.id}-rubric-answer`}
        label={t('coursition.app.preview.answer')}
        onChange={(event) => {
          setAnswer(event.currentTarget.value);
          setHasCompared(false);
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
              setHasCompared(false);
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
          disabled={answer.trim().length === 0 || checkedCount === 0}
          onClick={() => setHasCompared(true)}
          type="button"
          variant="primary"
        >
          {t('coursition.app.preview.compareWithRubric')}
        </Button>
      </div>
      {hasCompared ? (
        <FeedbackPanel
          body={interaction.feedback}
          title={t('coursition.app.preview.revise')}
          tone={checkedCount === interaction.criteria.length ? 'success' : 'warning'}
        />
      ) : null}
    </div>
  );
};

const NotPlayableEngine = ({ activity, t }: ActivityEngineProps<NotPlayableActivity>) => (
  <div className="grid gap-3">
    <FeedbackPanel
      body={`${activity.interaction.reason}\n\n${activity.interaction.feedback}`}
      title={t('coursition.app.preview.incompleteActivity')}
      tone="warning"
    />
  </div>
);

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
      return activity.interaction.prompt;
    }
    default: {
      const unsupportedActivity: never = activity;
      return unsupportedActivity;
    }
  }
};

const activityPromptPartsFor = (activity: GeneratedActivity) => {
  const [lead = '', ...details] = activityPromptFor(activity).split(/\n\n/u);
  return {
    details: details.join('\n\n'),
    lead,
  };
};

const ActivityPreviewCard = ({
  activity,
  index,
  t,
}: {
  activity: GeneratedActivity;
  index: number;
  t: Translate;
}) => {
  const renderEngine = () => {
    switch (activity.type) {
      case 'retrieval_check': {
        return <RetrievalCheckEngine activity={activity} showPrompt={false} t={t} />;
      }
      case 'practice_task': {
        return <PracticeTaskEngine activity={activity} showPrompt={false} t={t} />;
      }
      case 'scenario_decision': {
        return <ScenarioDecisionEngine activity={activity} showPrompt={false} t={t} />;
      }
      case 'ordering_matching': {
        return <OrderingMatchingEngine activity={activity} showPrompt={false} t={t} />;
      }
      case 'rubric_answer': {
        return <RubricAnswerEngine activity={activity} showPrompt={false} t={t} />;
      }
      case 'not_playable': {
        return <NotPlayableEngine activity={activity} showPrompt={false} t={t} />;
      }
      default: {
        const unsupportedActivity: never = activity;
        return unsupportedActivity;
      }
    }
  };

  const typeLabel = t(`coursition.app.activityPlan.types.${activity.type}`);
  const promptParts = activityPromptPartsFor(activity);
  const incompleteReason = incompleteActivityReasonFor(activity);
  const promptLead = promptParts.lead.trim();
  const heading = hasText(promptLead)
    ? promptLead
    : t('coursition.app.preview.incompleteActivityHeading');

  return (
    <article className="grid gap-3 rounded-md bg-fill-base p-3" key={activity.id}>
      <header className="grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className={tinyMetaClass}>
            {t('coursition.app.preview.activityNumber', { number: index + 1 })}
          </p>
          <p className="rounded-md bg-base px-2 py-1 text-xs font-semibold text-fg-secondary">
            {typeLabel}
          </p>
        </div>
        <h4 className="whitespace-pre-wrap text-base font-bold leading-6 text-fg-primary">
          {heading}
        </h4>
        {promptParts.details.length > 0 ? (
          <p className="whitespace-pre-wrap text-sm leading-6 text-fg-primary">
            {promptParts.details}
          </p>
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
  const isObjectiveSaveBusy = isBusyAction('updateLearningObjective');
  const isActivityBriefSaveBusy = isBusyAction('updateActivityBrief');
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

  const runWorkflowEffect = (
    action: WorkflowAction,
    shouldNavigate = true,
  ): Effect.Effect<WorkflowSnapshot | null, never> =>
    Effect.gen(function* runWorkflowProgram() {
      yield* Effect.sync(() => {
        beginBusyAction(action.action);
      });
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

  const sessionRequestEffect = (): Effect.Effect<SessionPayload, CoursitionUiEffectError> =>
    foreignPromise(() => effectBff.client.auth.session({}) as PromiseLike<SessionPayload>);

  const authRequestEffect = (): Effect.Effect<void, CoursitionUiEffectError> =>
    foreignPromise(
      () =>
        authMode === 'signUp'
          ? effectBff.client.auth.signUp({
              payload: { email: authEmail, name: authName, password: authPassword },
            })
          : effectBff.client.auth.signIn({
              payload: { email: authEmail, password: authPassword },
            }),
      t(
        authMode === 'signUp'
          ? 'coursition.app.auth.signUpFailed'
          : 'coursition.app.auth.signInFailed',
      ),
    ).pipe(Effect.asVoid);

  const authEffect = (): Effect.Effect<void, never> =>
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
    const name = sourceName.trim() || (sourceFile?.name ?? '');
    if (name.length === 0) {
      setNotice(t('coursition.app.sources.sourceNameRequired'));
      return;
    }
    const submitSource = (content: string, sizeLabel?: string): Effect.Effect<void, never> => {
      if (sourceType !== 'file' && content.trim().length === 0) {
        return Effect.sync(() => setNotice(t('coursition.app.errors.generic')));
      }
      return runWorkflowEffect({
        action: 'addSource',
        draftId: draft.id,
        source: {
          content,
          name,
          ...(sizeLabel === undefined ? {} : { sizeLabel }),
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
          yield* submitSource(payloadExit.value.content, payloadExit.value.sizeLabel);
        }).pipe(Effect.ensuring(Effect.sync(() => endBusyAction('file')))),
      );
      return;
    }
    Effect.runFork(submitSource(sourceContent));
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

  const updateObjective = (event: FormEvent<HTMLFormElement>, objectiveId: string) => {
    event.preventDefault();
    if (draft === null) {
      return;
    }
    const formData = new FormData(event.currentTarget);
    void runWorkflow({
      action: 'updateLearningObjective',
      capability: formString(formData, 'capability'),
      draftId: draft.id,
      objectiveId,
      title: formString(formData, 'title'),
    });
  };

  const updateActivityBrief = (event: FormEvent<HTMLFormElement>, briefId: string) => {
    event.preventDefault();
    if (draft === null) {
      return;
    }
    const formData = new FormData(event.currentTarget);
    const type = formString(formData, 'type') as ActivityType;
    void runWorkflow({
      action: 'updateActivityBrief',
      briefId,
      draftId: draft.id,
      feedbackGuidance: formString(formData, 'feedbackGuidance'),
      instructions: formString(formData, 'instructions'),
      learnerAction: formString(formData, 'learnerAction'),
      successCriteria: formString(formData, 'successCriteria'),
      title: formString(formData, 'title'),
      type: activityTypes.includes(type) ? type : 'practice_task',
    });
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
                          <h3 className="text-base font-bold text-fg-primary">{source.name}</h3>
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
                        {canPreview && isPreviewExpanded ? (
                          <div id={previewId}>
                            <SourceMarkdownPreview
                              loadingLabel={t('coursition.app.sources.editorLoading')}
                              value={source.content}
                            />
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
                <h2 className="text-xl font-bold text-fg-primary">
                  {t('coursition.app.objectives.title')}
                </h2>
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
                      onSubmit={(event) => updateObjective(event, objective.id)}
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
                      <Button disabled={isObjectiveSaveBusy} type="submit" variant="secondary">
                        {t('coursition.app.objectives.saveObjective')}
                      </Button>
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
                  disabled={isObjectiveGenerationBusy}
                  onClick={() =>
                    void runWorkflow({ action: 'generateLearningBlueprint', draftId: draft.id })
                  }
                  type="button"
                  variant="primary"
                >
                  {busyAction === 'generateLearningBlueprint'
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
                      onSubmit={(event) => updateActivityBrief(event, brief.id)}
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
                      <Button disabled={isActivityBriefSaveBusy} type="submit" variant="secondary">
                        {t('coursition.app.activityPlan.save')}
                      </Button>
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
              <section className="grid gap-3">
                <h3 className="text-lg font-bold text-fg-primary">
                  {t('coursition.app.preview.activities')}
                </h3>
                {draft.learningBlueprint.generatedActivities.length === 0 ? (
                  <p className={mutedTextClass}>{t('coursition.app.preview.noActivities')}</p>
                ) : (
                  <div className="grid gap-3">
                    {draft.learningBlueprint.generatedActivities.map((activity, index) => (
                      <ActivityPreviewCard
                        activity={activity}
                        index={index}
                        key={activity.id}
                        t={t}
                      />
                    ))}
                  </div>
                )}
              </section>
              <ReviewView draft={draft} runWorkflow={runWorkflow} t={t} />
            </section>
          ) : null}
        </section>
      )}
    </main>
  );
};
