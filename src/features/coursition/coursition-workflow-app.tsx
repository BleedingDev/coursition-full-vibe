// @effect-diagnostics globalDate:off asyncFunction:off strictBooleanExpressions:off
import { Button } from '@techsio/ui-kit/atoms/button';
import { FormInput } from '@techsio/ui-kit/molecules/form-input';
import { Link, useNavigate } from '@modern-js/plugin-tanstack/runtime';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent, FormEvent } from 'react';
import type { MDXEditorMethods } from '@mdxeditor/editor';
import effectBff from '@api/effect/index';
import type {
  AiMode,
  DraftStep,
  LessonBlockType,
  SourceType,
  WorkflowGate,
  WorkflowGateReason,
} from '@shared/coursition/workflow';
import type {
  Chapter,
  GuidedQuestions,
  Lesson,
  LessonBlock,
  SessionUser,
  TargetLearner,
  Topic,
  WorkflowAction,
  WorkflowSnapshot,
} from '@shared/coursition/effect-api';
import {
  emptyQuestions,
  emptyTargetLearner,
  getWorkflowPrerequisiteGate,
  getWorkflowPreviewGate,
  getWorkflowStepGate,
  workflowStepIndex,
  workflowSteps,
} from '@shared/coursition/workflow';
import type { CourseRouteLanguage, CourseRouteMatch } from '@shared/coursition/routes';
import {
  courseRoutePattern,
  courseRouteStepSlug,
  dashboardRoutePath,
} from '@shared/coursition/routes';
import type { Translate } from './translation';

interface CoursitionWorkflowAppProps {
  initialRoute?: CourseRouteMatch | null;
  initialSessionUser?: SessionUser | null;
  initialSnapshot?: WorkflowSnapshot | null;
  language: CourseRouteLanguage;
  t: Translate;
}

type AuthMode = 'signIn' | 'signUp';
type AuthField = 'email' | 'name' | 'password';
type AuthFieldErrors = Partial<Record<AuthField, string>>;
type SourceAction = 'deleteSource' | 'retrySource';
type SourceField = 'content' | 'name';
type SourceFieldErrors = Partial<Record<SourceField, string>>;

interface TextareaFieldProps {
  id: string;
  label: string;
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  rows: number;
  value: string;
  ariaLabel?: string;
  name?: string;
  placeholder?: string;
  required?: boolean;
}

interface MarkdownSourceFieldProps {
  id: string;
  label: string;
  loadingLabel: string;
  onChange: (value: string) => void;
  value: string;
  name?: string;
  placeholder?: string;
  required?: boolean;
}

interface MarkdownEditorClientProps {
  onChange?: (value: string) => void;
  value: string;
  placeholder?: string;
  readOnly?: boolean;
}

type EditableTopic = Pick<Topic, 'description' | 'name'>;
type EditableChapter = Pick<Chapter, 'description' | 'outcome' | 'title'>;
type EditableLesson = Pick<Lesson, 'durationMinutes' | 'title'>;
type EditableBlock = Pick<LessonBlock, 'body' | 'title'>;
type WorkflowGateDraft = Parameters<typeof getWorkflowStepGate>[0];
interface StepRouteTarget {
  params: {
    courseId: string;
    lang: CourseRouteLanguage;
    step: string;
  };
  to: ReturnType<typeof courseRoutePattern>;
}

interface ToastState {
  id: number;
  message: string;
}

interface ConfirmedDraftMode {
  draftId: string;
  mode: AiMode;
}

const steps = workflowSteps;
const navigationSteps = steps.filter((step) => step !== 'builder');
const modeOptions = ['generate', 'assist'] as const;
const sourceTypes = ['notes', 'url', 'file'] as const;
const skippedGenerateModeSteps = new Set<DraftStep>([
  'questions',
  'topics',
  'target',
  'chapters',
  'lessons',
]);
const llamaParseFileExtensions = new Set(['doc', 'docx', 'odt', 'pdf', 'ppt', 'pptx']);
const deepgramFileExtensions = new Set(['m4a', 'mov', 'mp3', 'mp4', 'wav', 'webm']);
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
const panelClass = 'grid gap-3';
const actionRowClass = 'flex flex-wrap items-center gap-2';
const cardClass = 'grid gap-2 py-2';
const mutedTextClass = 'text-sm text-slate-500';
const metadataTextClass = 'text-xs font-medium uppercase tracking-normal text-slate-500';
const buttonPrimaryClass =
  'inline-flex min-h-9 items-center justify-center rounded-md bg-[#111827] px-3 py-2 text-sm font-medium text-[#ffffff] transition hover:bg-[#0f172a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#334155] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
const buttonSecondaryClass =
  'inline-flex min-h-9 items-center justify-center rounded-md bg-[#f1f5f9] px-3 py-2 text-sm font-medium text-[#111827] transition hover:bg-[#e2e8f0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#334155] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
const buttonSmallPrimaryClass =
  'inline-flex min-h-8 items-center justify-center rounded-md bg-[#111827] px-2.5 py-1.5 text-xs font-medium text-[#ffffff] transition hover:bg-[#0f172a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#334155] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
const buttonSmallSecondaryClass =
  'inline-flex min-h-8 items-center justify-center rounded-md bg-[#f1f5f9] px-2.5 py-1.5 text-xs font-medium text-[#111827] transition hover:bg-[#e2e8f0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#334155] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
const stepHeaderButtonBaseClass =
  'inline-flex h-9 min-h-0 max-h-9 shrink-0 items-center justify-center self-center whitespace-nowrap rounded-md px-3 py-0 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#334155] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
const stepHeaderPrimaryButtonClass = `${stepHeaderButtonBaseClass} bg-[#111827] text-[#ffffff] hover:bg-[#0f172a]`;
const stepHeaderSecondaryButtonClass = `${stepHeaderButtonBaseClass} bg-[#f1f5f9] text-[#111827] hover:bg-[#e2e8f0]`;
const authModeButtonClass = buttonSecondaryClass;
const authModeButtonSelectedClass = `${buttonSecondaryClass} font-semibold underline decoration-2 underline-offset-4`;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const dashboardPath = dashboardRoutePath;
const titleAutosaveDelayMs = 800;
const inputClass = 'text-slate-950 placeholder:text-transparent';
const textareaClass =
  'min-h-20 w-full resize-y rounded-md border-0 bg-slate-100 px-3 py-2 text-sm font-medium text-slate-950 outline-none transition placeholder:text-transparent focus:bg-white focus:ring-2 focus:ring-slate-400';
const sourceDataUrlPattern = /^data:[^,]+;base64,/u;

const sourceHasReadableContent = (source: { readonly content: string }) =>
  source.content.trim().length > 0;

const linkedImagePattern =
  /\[(!\[[^\]\n]*\]\([^) \n]+(?:\s+"[^"]*")?\))\]\([^) \n]+(?:\s+"[^"]*")?\)/gu;

const markdownForPreview = (value: string) => value.replaceAll(linkedImagePattern, '$1');

const localizedSourceSize = (sizeLabel: string, t: Translate) => {
  const characterCount = sizeLabel.match(/^(\d+) chars$/u);
  if (characterCount) {
    return t('coursition.app.knowledge.characterCount', { count: characterCount[1] });
  }
  return sizeLabel;
};

const authFieldErrorId = (field: AuthField) => `coursition-auth-${field}-error`;

const authFieldErrorDescription = (authErrors: AuthFieldErrors, field: AuthField) =>
  authErrors[field] ? authFieldErrorId(field) : undefined;

const messageFromUnknownError = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const { message } = error as { message?: unknown };
    if (typeof message === 'string' && message.trim().length > 0) {
      return message;
    }
  }
  return fallback;
};

const applyWorkflowActionRequest = <const Action extends WorkflowAction>(action: Action) => {
  const request = { payload: action } as Parameters<typeof effectBff.client.workflow.apply>[0];
  return effectBff.client.workflow.apply(request);
};

const stepStateLabelKey = (
  index: number,
  currentStepIndex: number,
  isAllowed: boolean,
  isSkipped: boolean,
) => {
  if (index === currentStepIndex) {
    return 'coursition.app.navigation.current';
  }
  if (isSkipped) {
    return 'coursition.app.navigation.skipped';
  }
  if (index < currentStepIndex) {
    return 'coursition.app.navigation.completed';
  }
  if (!isAllowed) {
    return 'coursition.app.navigation.locked';
  }
  return 'coursition.app.navigation.upcoming';
};

const fileExtensionFor = (name: string) => name.split('.').pop()?.toLowerCase() ?? '';

const isBinarySourcePayload = (value: string) => sourceDataUrlPattern.test(value.trim());

const visibleSourceContent = (value: string) => (isBinarySourcePayload(value) ? '' : value);

const questionsAreEqual = (first: GuidedQuestions, second: GuidedQuestions) =>
  first.outcome === second.outcome &&
  first.audience === second.audience &&
  first.priorKnowledge === second.priorKnowledge &&
  first.depth === second.depth &&
  first.avoid === second.avoid &&
  first.practice === second.practice &&
  first.strictSourceOnly === second.strictSourceOnly;

const targetLearnersAreEqual = (first: TargetLearner, second: TargetLearner) =>
  first.profile === second.profile &&
  first.currentKnowledge === second.currentKnowledge &&
  first.motivation === second.motivation &&
  first.pain === second.pain &&
  first.desiredOutcome === second.desiredOutcome &&
  first.constraints === second.constraints &&
  first.practiceStyle === second.practiceStyle;

const topicsAreEqual = (first: EditableTopic, second: EditableTopic) =>
  first.name === second.name && first.description === second.description;

const chaptersAreEqual = (first: EditableChapter, second: EditableChapter) =>
  first.title === second.title &&
  first.outcome === second.outcome &&
  first.description === second.description;

const lessonsAreEqual = (first: EditableLesson, second: EditableLesson) =>
  first.title === second.title && first.durationMinutes === second.durationMinutes;

const blocksAreEqual = (first: EditableBlock, second: EditableBlock) =>
  first.title === second.title && first.body === second.body;

const aiRunStep = (
  type: NonNullable<WorkflowSnapshot['draft']>['aiRuns'][number]['type'],
): DraftStep => {
  switch (type) {
    case 'topic_generation': {
      return 'topics';
    }
    case 'target_learner_generation': {
      return 'target';
    }
    case 'chapter_generation': {
      return 'chapters';
    }
    case 'lesson_generation': {
      return 'lessons';
    }
    case 'teaching_quality_review': {
      return 'preview';
    }
    default: {
      return 'preview';
    }
  }
};

const firstVisibleSourceType = (draft: WorkflowSnapshot['draft']) =>
  draft?.sources.find((source) => source.status !== 'deleted')?.type ?? 'notes';

const countCategoryFor = (language: CourseRouteLanguage, count: number) => {
  if (language === 'cs') {
    if (count === 1) {
      return 'one';
    }
    if (count === 2 || count === 3 || count === 4) {
      return 'few';
    }
    return 'other';
  }
  if (count === 1) {
    return 'one';
  }
  return 'other';
};

const gateReasonKey = (reason: WorkflowGateReason) =>
  `coursition.app.navigation.blockedReasons.${reason}` as const;

const workflowDraftForGate = (draft: NonNullable<WorkflowSnapshot['draft']>) =>
  draft as unknown as WorkflowGateDraft;

const TextareaField = ({
  id,
  label,
  name,
  onChange,
  placeholder,
  required,
  rows,
  value,
}: TextareaFieldProps) => {
  const labelId = `${id}-label`;
  return (
    <div className="grid gap-1">
      <label className="text-sm font-medium text-slate-700" htmlFor={id} id={labelId}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      <textarea
        className={textareaClass}
        aria-labelledby={labelId}
        id={id}
        name={name}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        rows={rows}
        value={value}
      />
    </div>
  );
};

const MarkdownEditorClient = lazy(async () => {
  const {
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
  } = await import('@mdxeditor/editor');

  const SourceMarkdownEditor = ({
    onChange,
    placeholder,
    readOnly = false,
    value,
  }: MarkdownEditorClientProps) => {
    const editorRef = useRef<MDXEditorMethods>(null);
    useEffect(() => {
      const editor = editorRef.current;
      if (editor && editor.getMarkdown() !== value) {
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
        className={`coursition-mdx-editor ${readOnly ? 'coursition-mdx-editor--readonly' : ''}`}
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
        translation={(_key, defaultValue) => defaultValue}
        trim={false}
      />
    );
  };

  return { default: SourceMarkdownEditor };
});

const MarkdownSourceField = ({
  id,
  label,
  loadingLabel,
  name,
  onChange,
  placeholder,
  required,
  value,
}: MarkdownSourceFieldProps) => {
  const labelId = `${id}-label`;
  const fallbackId = `${id}-fallback`;
  const [isEditorReady, setIsEditorReady] = useState(false);
  useEffect(() => {
    setIsEditorReady(true);
  }, []);
  return (
    <div className="grid gap-1">
      <label className="text-sm font-medium text-slate-700" id={labelId}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      <textarea aria-labelledby={labelId} hidden id={id} name={name} readOnly value={value} />
      {isEditorReady ? (
        <Suspense
          fallback={
            <div className="grid min-h-44 place-items-center rounded-md bg-slate-100 p-3 text-sm font-medium text-slate-500">
              {loadingLabel}
            </div>
          }
        >
          <MarkdownEditorClient onChange={onChange} placeholder={placeholder ?? ''} value={value} />
        </Suspense>
      ) : (
        <textarea
          aria-labelledby={labelId}
          className={`${textareaClass} min-h-44`}
          id={fallbackId}
          onChange={(event) => onChange(event.currentTarget.value)}
          placeholder={placeholder}
          rows={8}
          value={value}
        />
      )}
    </div>
  );
};

const MarkdownPreview = ({ loadingLabel, value }: { loadingLabel: string; value: string }) => (
  <Suspense
    fallback={
      <div className="grid min-h-24 place-items-center rounded-md bg-slate-100 p-3 text-sm font-medium text-slate-500">
        {loadingLabel}
      </div>
    }
  >
    <MarkdownEditorClient readOnly value={markdownForPreview(value)} />
  </Suspense>
);

const currentStepPreservingActions = new Set<WorkflowAction['action']>([
  'updateDraftTitle',
  'setMode',
  'addSource',
  'deleteSource',
  'retrySource',
  'addTopic',
  'updateTopic',
  'deleteTopic',
  'updateTargetLearner',
  'addChapter',
  'updateChapter',
  'deleteChapter',
  'moveChapter',
  'addLesson',
  'updateLesson',
  'deleteLesson',
  'moveLesson',
  'addBlock',
  'updateBlock',
  'deleteBlock',
  'moveBlock',
  'setFindingStatus',
]);

const navigationStepForAction = (
  action: WorkflowAction,
  resultStep: DraftStep,
  currentStep: DraftStep | undefined,
) => (currentStep && currentStepPreservingActions.has(action.action) ? currentStep : resultStep);

const readableFileContent = async (file: File) => {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  const isReadable = file.type.startsWith('text/') || readableFileExtensions.has(extension);
  if (isReadable) {
    return file.text();
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const encoded = bytes.reduce((value, byte) => value + String.fromCodePoint(byte), '');
  return `data:${file.type || 'application/octet-stream'};base64,${btoa(encoded)}`;
};

// eslint-disable-next-line complexity
export const CoursitionWorkflowApp = ({
  initialRoute = null,
  initialSessionUser = null,
  initialSnapshot = null,
  language,
  t,
}: CoursitionWorkflowAppProps) => {
  const navigate = useNavigate();
  const initialQuestions = initialSnapshot?.draft?.questions ?? emptyQuestions();
  const [authMode, setAuthMode] = useState<AuthMode>('signUp');
  const [authErrors, setAuthErrors] = useState<AuthFieldErrors>({});
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(initialSessionUser);
  const [snapshot, setSnapshot] = useState<WorkflowSnapshot | null>(initialSnapshot);
  const [title, setTitle] = useState('');
  const [sourceType, setSourceType] = useState<SourceType>(() =>
    firstVisibleSourceType(initialSnapshot?.draft ?? null),
  );
  const [sourceContent, setSourceContent] = useState('');
  const [sourceName, setSourceName] = useState('');
  const [sourceErrors, setSourceErrors] = useState<SourceFieldErrors>({});
  const [isSourceFormOpen, setIsSourceFormOpen] = useState(true);
  const [sourceSizeLabel, setSourceSizeLabel] = useState('');
  const [previewSourceId, setPreviewSourceId] = useState('');
  const [confirmDeleteDraftId, setConfirmDeleteDraftId] = useState('');
  const [questions, setQuestions] = useState<GuidedQuestions>(() => initialQuestions);
  const [showQuestionValidation, setShowQuestionValidation] = useState(false);
  const [targetLearner, setTargetLearner] = useState<TargetLearner>(
    () => initialSnapshot?.draft?.targetLearner ?? emptyTargetLearner(),
  );
  const [draftTitle, setDraftTitle] = useState(initialSnapshot?.draft?.title ?? '');
  const [manualTopic, setManualTopic] = useState<EditableTopic>({
    description: '',
    name: '',
  });
  const [editedTopics, setEditedTopics] = useState<Record<string, EditableTopic>>({});
  const [manualChapter, setManualChapter] = useState<EditableChapter>({
    description: '',
    outcome: '',
    title: '',
  });
  const [editedChapters, setEditedChapters] = useState<Record<string, EditableChapter>>({});
  const [selectedChapterId, setSelectedChapterId] = useState(
    initialSnapshot?.draft?.chapters[0]?.id ?? '',
  );
  const [manualLessonTitle, setManualLessonTitle] = useState('');
  const [editedLessons, setEditedLessons] = useState<Record<string, EditableLesson>>({});
  const [selectedLessonId, setSelectedLessonId] = useState(
    initialSnapshot?.draft?.chapters.flatMap((chapter) => chapter.lessons)[0]?.id ?? '',
  );
  const [editedBlocks, setEditedBlocks] = useState<Record<string, EditableBlock>>({});
  const [manualBlock, setManualBlock] = useState<{
    body: string;
    title: string;
    type: LessonBlockType;
  }>({
    body: '',
    title: '',
    type: 'summary',
  });
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isSourceFormPending, setIsSourceFormPending] = useState(false);
  const [isSourceFilePending, setIsSourceFilePending] = useState(false);
  const [pendingSourceActions, setPendingSourceActions] = useState<Record<string, SourceAction>>(
    {},
  );
  const toastSequence = useRef(0);
  const shownFailureToasts = useRef(new Set<string>());
  const sourceFormRef = useRef<HTMLFormElement>(null);
  const activeDraftIdRef = useRef(initialSnapshot?.draft?.id ?? '');
  const confirmedDraftModeRef = useRef<ConfirmedDraftMode | null>(
    initialSnapshot?.draft
      ? { draftId: initialSnapshot.draft.id, mode: initialSnapshot.draft.mode }
      : null,
  );
  const modeSaveChainRef = useRef(Promise.resolve());
  const modeSaveSequenceRef = useRef(0);
  const draftTitleDirtyRef = useRef(false);
  const lastSavedDraftTitle = useRef(initialSnapshot?.draft?.title ?? '');
  const latestDraftTitle = useRef(initialSnapshot?.draft?.title ?? '');
  const questionsDirtyRef = useRef(false);
  const lastSavedQuestions = useRef(initialQuestions);
  const latestQuestions = useRef(initialQuestions);
  const initialTargetLearner = initialSnapshot?.draft?.targetLearner ?? emptyTargetLearner();
  const targetLearnerDirtyRef = useRef(false);
  const lastSavedTargetLearner = useRef(initialTargetLearner);
  const latestTargetLearner = useRef(initialTargetLearner);

  const showToast = (message: string) => {
    const trimmedMessage = message.trim();
    if (trimmedMessage.length === 0) {
      return;
    }
    toastSequence.current += 1;
    setToast({ id: toastSequence.current, message: trimmedMessage });
  };

  const showAiFailureToast = (result: WorkflowSnapshot) => {
    const failedRuns = result.draft?.aiRuns ?? [];
    for (let index = failedRuns.length - 1; index >= 0; index -= 1) {
      const run = failedRuns[index];
      if (!run || run.status !== 'failed' || !run.failureReason) {
        continue;
      }
      const failureKey = `${run.id}:${run.updatedAt}:${run.failureReason}`;
      if (shownFailureToasts.current.has(failureKey)) {
        continue;
      }
      shownFailureToasts.current.add(failureKey);
      showToast(run.failureReason);
      return;
    }
  };

  const rememberConfirmedDraftMode = (result: WorkflowSnapshot) => {
    confirmedDraftModeRef.current = result.draft
      ? { draftId: result.draft.id, mode: result.draft.mode }
      : null;
  };

  const applyLocalDraftMode = (draftId: string, mode: AiMode) => {
    setSnapshot((current) => {
      if (!current || current.draft?.id !== draftId) {
        return current;
      }
      return {
        ...current,
        draft: { ...current.draft, mode },
        drafts: current.drafts.map((draftSummary) =>
          draftSummary.id === draftId ? { ...draftSummary, mode } : draftSummary,
        ),
      };
    });
  };

  const draft = snapshot?.draft ?? null;
  const gateDraft = draft ? workflowDraftForGate(draft) : null;
  const activeStep = draft?.step === 'preview' ? 'builder' : draft?.step;
  const navigationActiveStep = activeStep === 'builder' ? 'lessons' : activeStep;
  const currentStepIndex = Math.max(
    0,
    typeof activeStep === 'string' ? steps.indexOf(activeStep) : -1,
  );
  const navigationStepIndex = Math.max(
    0,
    typeof navigationActiveStep === 'string' ? navigationSteps.indexOf(navigationActiveStep) : -1,
  );
  let previousStep = steps[currentStepIndex - 1];
  if (draft?.step === 'preview') {
    previousStep = 'builder';
  }
  const nextStep = steps[currentStepIndex + 1];
  const drafts = snapshot?.drafts ?? [];
  const routeForStep = (step: DraftStep): StepRouteTarget | undefined =>
    draft
      ? {
          params: {
            courseId: draft.id,
            lang: language,
            step: courseRouteStepSlug(language, step),
          },
          to: courseRoutePattern(language),
        }
      : undefined;
  const routeForDraftSummary = (summary: WorkflowSnapshot['drafts'][number]): StepRouteTarget => ({
    params: {
      courseId: summary.id,
      lang: language,
      step: courseRouteStepSlug(language, summary.step),
    },
    to: courseRoutePattern(language),
  });

  const topicCount = draft?.topics.length ?? 0;
  const visibleSources = useMemo(
    () => draft?.sources.filter((source) => source.status !== 'deleted') ?? [],
    [draft],
  );
  const hasRequiredGenerateQuestions =
    questions.outcome.trim().length > 0 &&
    questions.audience.trim().length > 0 &&
    questions.practice.trim().length > 0;
  const canSubmitAuth =
    emailPattern.test(email.trim()) &&
    password.trim().length > 0 &&
    (authMode === 'signIn' || (name.trim().length > 0 && password.length >= 8));
  const canAddTopic = manualTopic.name.trim().length > 0;
  const canConfirmTarget =
    targetLearner.profile.trim().length > 0 && targetLearner.desiredOutcome.trim().length > 0;
  const targetHasContent = [
    targetLearner.profile,
    targetLearner.currentKnowledge,
    targetLearner.motivation,
    targetLearner.pain,
    targetLearner.desiredOutcome,
    targetLearner.constraints,
    targetLearner.practiceStyle,
  ].some((value) => value.trim().length > 0);
  const canAddLesson = selectedChapterId.length > 0 && manualLessonTitle.trim().length > 0;
  const canAddBlock =
    selectedLessonId.length > 0 &&
    manualBlock.title.trim().length > 0 &&
    manualBlock.body.trim().length > 0;
  const previewSource = useMemo(
    () => visibleSources.find((source) => source.id === previewSourceId) ?? null,
    [previewSourceId, visibleSources],
  );
  const nextStepGate = useMemo(
    () => (gateDraft && nextStep ? getWorkflowStepGate(gateDraft, nextStep) : { allowed: false }),
    [gateDraft, nextStep],
  );
  const fullCourseGenerationGate = useMemo(
    () => (gateDraft ? getWorkflowPrerequisiteGate(gateDraft, 'questions') : { allowed: false }),
    [gateDraft],
  );
  const chapterGenerationGate = useMemo(
    () => (gateDraft ? getWorkflowPrerequisiteGate(gateDraft, 'chapters') : { allowed: false }),
    [gateDraft],
  );
  const chapterConfirmationGate = useMemo(
    () =>
      gateDraft
        ? getWorkflowPrerequisiteGate(gateDraft, 'chapters', {
            blockOpenFindings: true,
            includeTargetFindings: true,
          })
        : { allowed: false },
    [gateDraft],
  );
  const lessonGenerationGate = useMemo(
    () =>
      gateDraft
        ? getWorkflowPrerequisiteGate(gateDraft, 'lessons', { blockOpenFindings: true })
        : { allowed: false },
    [gateDraft],
  );
  const previewGate = useMemo(
    () =>
      gateDraft
        ? getWorkflowPreviewGate(gateDraft, { blockOpenFindings: true })
        : { allowed: false },
    [gateDraft],
  );
  const visibleFindings = useMemo(
    () =>
      draft?.findings.filter((reviewFinding) => {
        const reviewStepPosition = workflowStepIndex(reviewFinding.step);
        return reviewStepPosition < currentStepIndex;
      }) ?? [],
    [currentStepIndex, draft?.findings],
  );
  const visibleAiRuns = useMemo(
    () =>
      draft?.aiRuns.filter((run) => {
        const runStepPosition = workflowStepIndex(aiRunStep(run.type));
        return runStepPosition <= currentStepIndex;
      }) ?? [],
    [currentStepIndex, draft?.aiRuns],
  );
  const actionableAiRuns = useMemo(
    () =>
      visibleAiRuns.filter(
        (run) => run.status === 'failed' || run.status === 'queued' || run.status === 'running',
      ),
    [visibleAiRuns],
  );
  const hasReviewContent = actionableAiRuns.length > 0 || visibleFindings.length > 0;
  const gateReason = (gate: WorkflowGate) => {
    if (gate.allowed || !gate.reason) {
      return '';
    }
    return t(gateReasonKey(gate.reason), {
      step: gate.blockedStep ? t(`coursition.app.steps.${gate.blockedStep}`) : '',
      title: gate.finding?.title ?? '',
    });
  };
  const shouldBuildFullCourseFromKnowledge =
    draft?.mode === 'generate' && activeStep === 'knowledge';
  const shouldOpenPreviewFromLessons =
    draft?.step !== 'preview' && (activeStep === 'lessons' || activeStep === 'builder');
  let nextNavigationGate = nextStepGate;
  if (shouldBuildFullCourseFromKnowledge) {
    nextNavigationGate = fullCourseGenerationGate;
  } else if (shouldOpenPreviewFromLessons) {
    nextNavigationGate = previewGate;
  }
  const nextStepReason = gateReason(nextNavigationGate);
  const chapterGenerationReason = gateReason(chapterGenerationGate);
  const chapterConfirmationReason = gateReason(chapterConfirmationGate);
  const lessonGenerationReason = gateReason(lessonGenerationGate);
  const sourceNameFeedback = sourceErrors.name ?? '';
  const sourceContentFeedback = sourceErrors.content ?? '';
  const currentDraftId = draft?.id ?? '';
  const sourceFileExtension = fileExtensionFor(sourceName);
  const isBinaryFileSource =
    sourceType === 'file' &&
    sourceContent.trim().length > 0 &&
    isBinarySourcePayload(sourceContent);
  const isUrlSourceInput = sourceType === 'url' && sourceContent.trim().length > 0;
  const usesLlamaParse =
    sourceType === 'file' &&
    (llamaParseFileExtensions.has(sourceFileExtension) ||
      (isBinaryFileSource && !deepgramFileExtensions.has(sourceFileExtension)));
  const usesDeepgram = sourceType === 'file' && deepgramFileExtensions.has(sourceFileExtension);
  let sourceProviderName = '';
  let sourceProviderEnvVar = '';
  let isSourceProviderConfigured = true;
  if (usesDeepgram) {
    sourceProviderName = 'Deepgram';
    sourceProviderEnvVar = 'DEEPGRAM_API_KEY';
    isSourceProviderConfigured = snapshot?.config.deepgramConfigured === true;
  } else if (usesLlamaParse) {
    sourceProviderName = 'LlamaParse';
    sourceProviderEnvVar = 'LLAMA_CLOUD_API_KEY';
    isSourceProviderConfigured = snapshot?.config.llamaParseConfigured === true;
  } else if (isUrlSourceInput) {
    sourceProviderName = 'Firecrawl, Tavily, or Exa';
    sourceProviderEnvVar = 'FIRECRAWL_API_KEY, TAVILY_API_KEY, or EXA_API_KEY';
    isSourceProviderConfigured = snapshot?.config.webExtractionConfigured === true;
  }
  const sourceProviderMissingMessage =
    (isBinaryFileSource || isUrlSourceInput) && !isSourceProviderConfigured
      ? t('coursition.app.knowledge.providerMissing', {
          envVar: sourceProviderEnvVar,
          provider: sourceProviderName,
        })
      : '';
  const sourceBinaryReadyMessage =
    isBinaryFileSource && isSourceProviderConfigured
      ? t('coursition.app.knowledge.providerReady', { provider: sourceProviderName })
      : '';
  let sourceSubmitLabelKey = 'coursition.app.knowledge.add';
  if (isSourceFilePending) {
    sourceSubmitLabelKey = 'coursition.app.knowledge.preparing';
  } else if (isSourceFormPending) {
    sourceSubmitLabelKey = 'coursition.app.knowledge.adding';
  }

  const refreshSession = async () => {
    const result = await effectBff.client.auth.session({});
    setSessionUser(result.session?.user ?? null);
    return result.session?.user ?? null;
  };

  const applyWorkflowSnapshot = (
    result: WorkflowSnapshot,
    options: {
      preserveDraftTitleInput?: boolean;
      preserveQuestionsInput?: boolean;
      preserveTargetLearnerInput?: boolean;
    } = {},
  ) => {
    rememberConfirmedDraftMode(result);
    setSnapshot(result);
    showAiFailureToast(result);
    if (!result.draft) {
      const blankQuestions = emptyQuestions();
      activeDraftIdRef.current = '';
      draftTitleDirtyRef.current = false;
      latestDraftTitle.current = '';
      lastSavedDraftTitle.current = '';
      questionsDirtyRef.current = false;
      latestQuestions.current = blankQuestions;
      lastSavedQuestions.current = blankQuestions;
      const blankTargetLearner = emptyTargetLearner();
      targetLearnerDirtyRef.current = false;
      latestTargetLearner.current = blankTargetLearner;
      lastSavedTargetLearner.current = blankTargetLearner;
      setQuestions(blankQuestions);
      setTargetLearner(blankTargetLearner);
      setDraftTitle('');
      return;
    }
    const nextDraftId = result.draft.id;
    const nextDraftTitle = result.draft.title;
    const isSameDraft = activeDraftIdRef.current === nextDraftId;
    const shouldPreserveDraftTitle =
      options.preserveDraftTitleInput === true || (isSameDraft && draftTitleDirtyRef.current);
    const shouldPreserveQuestions =
      options.preserveQuestionsInput === true || (isSameDraft && questionsDirtyRef.current);
    const shouldPreserveTargetLearner =
      options.preserveTargetLearnerInput === true || (isSameDraft && targetLearnerDirtyRef.current);
    activeDraftIdRef.current = nextDraftId;
    lastSavedDraftTitle.current = nextDraftTitle;
    lastSavedQuestions.current = result.draft.questions;
    lastSavedTargetLearner.current = result.draft.targetLearner;
    if (!shouldPreserveQuestions) {
      questionsDirtyRef.current = false;
      latestQuestions.current = result.draft.questions;
      setQuestions(result.draft.questions);
    }
    if (!shouldPreserveTargetLearner) {
      targetLearnerDirtyRef.current = false;
      latestTargetLearner.current = result.draft.targetLearner;
      setTargetLearner(result.draft.targetLearner);
    }
    if (!shouldPreserveDraftTitle) {
      draftTitleDirtyRef.current = false;
      latestDraftTitle.current = nextDraftTitle;
      setDraftTitle(nextDraftTitle);
    }
    setSelectedChapterId((current) =>
      result.draft?.chapters.some((chapter) => chapter.id === current)
        ? current
        : result.draft?.chapters[0]?.id || '',
    );
    setSelectedLessonId((current) =>
      result.draft?.chapters
        .flatMap((chapter: Chapter) => chapter.lessons)
        .some((lesson) => lesson.id === current)
        ? current
        : result.draft?.chapters.flatMap((chapter: Chapter) => chapter.lessons)[0]?.id || '',
    );
  };

  const workflow = async <const Action extends WorkflowAction>(action: Action) => {
    const result = await applyWorkflowActionRequest(action);
    applyWorkflowSnapshot(result);
    if (result.draft && action.action !== 'createDraft' && action.action !== 'getState') {
      const navigationStep = navigationStepForAction(action, result.draft.step, activeStep);
      await navigate({
        params: {
          courseId: result.draft.id,
          lang: language,
          step: courseRouteStepSlug(language, navigationStep),
        },
        to: courseRoutePattern(language),
      });
    }
    return result;
  };

  const saveDraftTitleNow = async () => {
    if (currentDraftId.length === 0) {
      return;
    }
    const latestTitleToSave = latestDraftTitle.current.trim();
    if (latestTitleToSave.length === 0 || latestTitleToSave === lastSavedDraftTitle.current) {
      return;
    }
    const result = await effectBff.client.workflow.apply({
      payload: {
        action: 'updateDraftTitle',
        draftId: currentDraftId,
        title: latestTitleToSave,
      },
    });
    if (activeDraftIdRef.current !== currentDraftId) {
      return;
    }
    const savedTitle = result.draft?.title ?? latestTitleToSave;
    applyWorkflowSnapshot(result, { preserveDraftTitleInput: true });
    draftTitleDirtyRef.current = latestDraftTitle.current.trim() !== savedTitle;
  };

  const saveQuestionsNow = async () => {
    if (currentDraftId.length === 0) {
      return;
    }
    const questionsToSave = latestQuestions.current;
    if (questionsAreEqual(questionsToSave, lastSavedQuestions.current)) {
      return;
    }
    const result = await effectBff.client.workflow.apply({
      payload: {
        action: 'autosaveQuestions',
        draftId: currentDraftId,
        questions: questionsToSave,
      },
    });
    if (activeDraftIdRef.current !== currentDraftId) {
      return;
    }
    const savedQuestions = result.draft?.questions ?? questionsToSave;
    applyWorkflowSnapshot(result, { preserveQuestionsInput: true });
    questionsDirtyRef.current = !questionsAreEqual(latestQuestions.current, savedQuestions);
  };

  const saveTargetLearnerNow = async () => {
    if (currentDraftId.length === 0) {
      return;
    }
    const targetLearnerToSave = latestTargetLearner.current;
    if (targetLearnersAreEqual(targetLearnerToSave, lastSavedTargetLearner.current)) {
      return;
    }
    const result = await effectBff.client.workflow.apply({
      payload: {
        action: 'updateTargetLearner',
        draftId: currentDraftId,
        targetLearner: targetLearnerToSave,
      },
    });
    if (activeDraftIdRef.current !== currentDraftId) {
      return;
    }
    const savedTargetLearner = result.draft?.targetLearner ?? targetLearnerToSave;
    applyWorkflowSnapshot(result, { preserveTargetLearnerInput: true });
    targetLearnerDirtyRef.current = !targetLearnersAreEqual(
      latestTargetLearner.current,
      savedTargetLearner,
    );
  };

  const topicEditsToSave = (topicIds?: readonly string[]) => {
    if (!draft) {
      return [];
    }
    const allowedTopicIds = topicIds ? new Set(topicIds) : null;
    return Object.entries(editedTopics).filter(([topicId, editedTopic]) => {
      if (allowedTopicIds && !allowedTopicIds.has(topicId)) {
        return false;
      }
      const topic = draft.topics.find((candidate) => candidate.id === topicId);
      return (
        topic !== undefined &&
        (topic.name !== editedTopic.name || topic.description !== editedTopic.description)
      );
    });
  };

  const saveEditedTopicsNow = async (topicIds?: readonly string[]) => {
    if (currentDraftId.length === 0) {
      return;
    }
    for (const [topicId, editedTopic] of topicEditsToSave(topicIds)) {
      if (activeDraftIdRef.current !== currentDraftId) {
        return;
      }
      const result = await effectBff.client.workflow.apply({
        payload: {
          action: 'updateTopic',
          description: editedTopic.description,
          draftId: currentDraftId,
          name: editedTopic.name,
          topicId,
        },
      });
      if (activeDraftIdRef.current !== currentDraftId) {
        return;
      }
      applyWorkflowSnapshot(result);
      setEditedTopics((currentTopics) => {
        const currentTopic = currentTopics[topicId];
        if (!currentTopic || !topicsAreEqual(currentTopic, editedTopic)) {
          return currentTopics;
        }
        const { [topicId]: _savedTopic, ...nextTopics } = currentTopics;
        return nextTopics;
      });
    }
  };

  const chapterEditsToSave = (chapterIds?: readonly string[]) => {
    if (!draft) {
      return [];
    }
    const allowedChapterIds = chapterIds ? new Set(chapterIds) : null;
    return Object.entries(editedChapters).filter(([chapterId, editedChapter]) => {
      if (allowedChapterIds && !allowedChapterIds.has(chapterId)) {
        return false;
      }
      const chapter = draft.chapters.find((candidate) => candidate.id === chapterId);
      return chapter !== undefined && !chaptersAreEqual(chapter, editedChapter);
    });
  };

  const saveEditedChaptersNow = async (chapterIds?: readonly string[]) => {
    if (currentDraftId.length === 0) {
      return;
    }
    for (const [chapterId, editedChapter] of chapterEditsToSave(chapterIds)) {
      if (activeDraftIdRef.current !== currentDraftId) {
        return;
      }
      const result = await effectBff.client.workflow.apply({
        payload: {
          action: 'updateChapter',
          chapterId,
          description: editedChapter.description,
          draftId: currentDraftId,
          outcome: editedChapter.outcome,
          title: editedChapter.title,
        },
      });
      if (activeDraftIdRef.current !== currentDraftId) {
        return;
      }
      applyWorkflowSnapshot(result);
      setEditedChapters((currentChapters) => {
        const currentChapter = currentChapters[chapterId];
        if (!currentChapter || !chaptersAreEqual(currentChapter, editedChapter)) {
          return currentChapters;
        }
        const { [chapterId]: _savedChapter, ...nextChapters } = currentChapters;
        return nextChapters;
      });
    }
  };

  const lessonEditsToSave = (lessonIds?: readonly string[]) => {
    if (!draft) {
      return [];
    }
    const allowedLessonIds = lessonIds ? new Set(lessonIds) : null;
    const lessonsById = new Map(
      draft.chapters.flatMap((chapter) =>
        chapter.lessons.map((lesson) => [lesson.id, lesson] as const),
      ),
    );
    return Object.entries(editedLessons).filter(([lessonId, editedLesson]) => {
      if (allowedLessonIds && !allowedLessonIds.has(lessonId)) {
        return false;
      }
      const lesson = lessonsById.get(lessonId);
      return lesson !== undefined && !lessonsAreEqual(lesson, editedLesson);
    });
  };

  const saveEditedLessonsNow = async (lessonIds?: readonly string[]) => {
    if (currentDraftId.length === 0) {
      return;
    }
    for (const [lessonId, editedLesson] of lessonEditsToSave(lessonIds)) {
      if (activeDraftIdRef.current !== currentDraftId) {
        return;
      }
      const result = await effectBff.client.workflow.apply({
        payload: {
          action: 'updateLesson',
          draftId: currentDraftId,
          durationMinutes: editedLesson.durationMinutes,
          lessonId,
          title: editedLesson.title,
        },
      });
      if (activeDraftIdRef.current !== currentDraftId) {
        return;
      }
      applyWorkflowSnapshot(result);
      setEditedLessons((currentLessons) => {
        const currentLesson = currentLessons[lessonId];
        if (!currentLesson || !lessonsAreEqual(currentLesson, editedLesson)) {
          return currentLessons;
        }
        const { [lessonId]: _savedLesson, ...nextLessons } = currentLessons;
        return nextLessons;
      });
    }
  };

  const blockEditsToSave = (blockIds?: readonly string[]) => {
    if (!draft) {
      return [];
    }
    const allowedBlockIds = blockIds ? new Set(blockIds) : null;
    const blocksById = new Map(
      draft.chapters.flatMap((chapter) =>
        chapter.lessons.flatMap((lesson) =>
          lesson.blocks.map((block) => [block.id, block] as const),
        ),
      ),
    );
    return Object.entries(editedBlocks).filter(([blockId, editedBlock]) => {
      if (allowedBlockIds && !allowedBlockIds.has(blockId)) {
        return false;
      }
      const block = blocksById.get(blockId);
      return block !== undefined && !blocksAreEqual(block, editedBlock);
    });
  };

  const saveEditedBlocksNow = async (blockIds?: readonly string[]) => {
    if (currentDraftId.length === 0) {
      return;
    }
    for (const [blockId, editedBlock] of blockEditsToSave(blockIds)) {
      if (activeDraftIdRef.current !== currentDraftId) {
        return;
      }
      const result = await effectBff.client.workflow.apply({
        payload: {
          action: 'updateBlock',
          blockId,
          body: editedBlock.body,
          draftId: currentDraftId,
          title: editedBlock.title,
        },
      });
      if (activeDraftIdRef.current !== currentDraftId) {
        return;
      }
      applyWorkflowSnapshot(result);
      setEditedBlocks((currentBlocks) => {
        const currentBlock = currentBlocks[blockId];
        if (!currentBlock || !blocksAreEqual(currentBlock, editedBlock)) {
          return currentBlocks;
        }
        const { [blockId]: _savedBlock, ...nextBlocks } = currentBlocks;
        return nextBlocks;
      });
    }
  };

  const savePendingAutosaves = async () => {
    await saveDraftTitleNow();
    await saveQuestionsNow();
    await saveTargetLearnerNow();
    await saveEditedTopicsNow();
    await saveEditedChaptersNow();
    await saveEditedLessonsNow();
    await saveEditedBlocksNow();
  };

  useEffect(() => {
    if (isBusy || sessionUser === null || initialRoute === null) {
      return;
    }
    if (draft?.id === initialRoute.draftId && draft.step === initialRoute.step) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        await effectBff.client.workflow.apply({
          payload: { action: 'selectDraft', draftId: initialRoute.draftId },
        });
        const result = await effectBff.client.workflow.apply({
          payload: {
            action: 'goToStep',
            draftId: initialRoute.draftId,
            step: initialRoute.step,
          },
        });
        if (cancelled) {
          return;
        }
        applyWorkflowSnapshot(result);
        if (result.draft && result.draft.step !== initialRoute.step) {
          await navigate({
            params: {
              courseId: result.draft.id,
              lang: language,
              step: courseRouteStepSlug(language, result.draft.step),
            },
            to: courseRoutePattern(language),
          });
        }
      } catch {
        if (!cancelled) {
          showToast(t('coursition.app.errors.generic'));
          await navigate({ to: dashboardPath(language) });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [draft?.id, draft?.step, initialRoute, isBusy, language, navigate, sessionUser, t]);

  useEffect(() => {
    setSessionUser(initialSessionUser);
    setSnapshot(initialSnapshot);
    if (initialSnapshot?.draft) {
      activeDraftIdRef.current = initialSnapshot.draft.id;
      confirmedDraftModeRef.current = {
        draftId: initialSnapshot.draft.id,
        mode: initialSnapshot.draft.mode,
      };
      draftTitleDirtyRef.current = false;
      latestDraftTitle.current = initialSnapshot.draft.title;
      lastSavedDraftTitle.current = initialSnapshot.draft.title;
      questionsDirtyRef.current = false;
      latestQuestions.current = initialSnapshot.draft.questions;
      lastSavedQuestions.current = initialSnapshot.draft.questions;
      targetLearnerDirtyRef.current = false;
      latestTargetLearner.current = initialSnapshot.draft.targetLearner;
      lastSavedTargetLearner.current = initialSnapshot.draft.targetLearner;
      setQuestions(initialSnapshot.draft.questions);
      setTargetLearner(initialSnapshot.draft.targetLearner);
      setDraftTitle(initialSnapshot.draft.title);
      setSourceType(firstVisibleSourceType(initialSnapshot.draft));
      setSelectedChapterId(initialSnapshot.draft.chapters[0]?.id ?? '');
      setSelectedLessonId(
        initialSnapshot.draft.chapters.flatMap((chapter) => chapter.lessons)[0]?.id ?? '',
      );
      return;
    }
    activeDraftIdRef.current = '';
    confirmedDraftModeRef.current = null;
    draftTitleDirtyRef.current = false;
    latestDraftTitle.current = '';
    lastSavedDraftTitle.current = '';
    const blankQuestions = emptyQuestions();
    questionsDirtyRef.current = false;
    latestQuestions.current = blankQuestions;
    lastSavedQuestions.current = blankQuestions;
    const blankTargetLearner = emptyTargetLearner();
    targetLearnerDirtyRef.current = false;
    latestTargetLearner.current = blankTargetLearner;
    lastSavedTargetLearner.current = blankTargetLearner;
    setQuestions(blankQuestions);
    setTargetLearner(blankTargetLearner);
    setDraftTitle('');
  }, [initialSessionUser, initialSnapshot]);

  useEffect(() => {
    if (initialSnapshot) {
      showAiFailureToast(initialSnapshot);
    }
  }, [initialSnapshot]);

  useEffect(() => {
    if (initialSessionUser || initialSnapshot) {
      return;
    }
    void (async () => {
      try {
        const user = await refreshSession();
        if (user !== null) {
          const result = await effectBff.client.workflow.apply({
            payload: { action: 'getState' },
          });
          setSnapshot({ ...result, draft: null });
        }
      } catch {
        setSessionUser(null);
      }
    })();
  }, [initialSessionUser, initialSnapshot]);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setToast((currentToast) => (currentToast?.id === toast.id ? null : currentToast));
    }, 5000);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  useEffect(() => {
    if (hasRequiredGenerateQuestions) {
      setShowQuestionValidation(false);
    }
  }, [hasRequiredGenerateQuestions]);

  useEffect(() => {
    if (currentDraftId.length === 0) {
      return;
    }
    const titleToSave = draftTitle.trim();
    if (titleToSave.length === 0) {
      draftTitleDirtyRef.current = true;
      return;
    }
    if (titleToSave === lastSavedDraftTitle.current) {
      draftTitleDirtyRef.current = false;
      return;
    }
    draftTitleDirtyRef.current = true;
    const timeoutId = window.setTimeout(() => {
      const latestTitleToSave = latestDraftTitle.current.trim();
      if (latestTitleToSave.length === 0 || latestTitleToSave === lastSavedDraftTitle.current) {
        return;
      }
      void (async () => {
        try {
          const result = await effectBff.client.workflow.apply({
            payload: {
              action: 'updateDraftTitle',
              draftId: currentDraftId,
              title: latestTitleToSave,
            },
          });
          if (activeDraftIdRef.current !== currentDraftId) {
            return;
          }
          const savedTitle = result.draft?.title ?? latestTitleToSave;
          applyWorkflowSnapshot(result, { preserveDraftTitleInput: true });
          if (latestDraftTitle.current.trim() === savedTitle) {
            draftTitleDirtyRef.current = false;
            return;
          }
          draftTitleDirtyRef.current = true;
        } catch {
          // Silent autosave keeps the visible workflow clean.
        }
      })();
    }, titleAutosaveDelayMs);
    return () => window.clearTimeout(timeoutId);
  }, [currentDraftId, draftTitle]);

  useEffect(() => {
    if (currentDraftId.length === 0) {
      return;
    }
    if (questionsAreEqual(questions, lastSavedQuestions.current)) {
      questionsDirtyRef.current = false;
      return;
    }
    questionsDirtyRef.current = true;
    const timeoutId = window.setTimeout(() => {
      const questionsToSave = latestQuestions.current;
      if (questionsAreEqual(questionsToSave, lastSavedQuestions.current)) {
        return;
      }
      void (async () => {
        try {
          const result = await effectBff.client.workflow.apply({
            payload: {
              action: 'autosaveQuestions',
              draftId: currentDraftId,
              questions: questionsToSave,
            },
          });
          if (activeDraftIdRef.current !== currentDraftId) {
            return;
          }
          const savedQuestions = result.draft?.questions ?? questionsToSave;
          applyWorkflowSnapshot(result, { preserveQuestionsInput: true });
          questionsDirtyRef.current = !questionsAreEqual(latestQuestions.current, savedQuestions);
        } catch {
          // Silent autosave keeps the visible workflow clean.
        }
      })();
    }, titleAutosaveDelayMs);
    return () => window.clearTimeout(timeoutId);
  }, [currentDraftId, questions]);

  useEffect(() => {
    if (!draft || currentDraftId.length === 0 || Object.keys(editedTopics).length === 0) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          await saveEditedTopicsNow();
        } catch {
          // Silent autosave keeps the visible workflow clean.
        }
      })();
    }, titleAutosaveDelayMs);
    return () => window.clearTimeout(timeoutId);
    // Autosave helpers read refs updated by input handlers; helper identity is not a debounce input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDraftId, draft, editedTopics]);

  useEffect(() => {
    if (currentDraftId.length === 0) {
      return;
    }
    if (targetLearnersAreEqual(targetLearner, lastSavedTargetLearner.current)) {
      targetLearnerDirtyRef.current = false;
      return;
    }
    targetLearnerDirtyRef.current = true;
    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          await saveTargetLearnerNow();
        } catch {
          // Silent autosave keeps the visible workflow clean.
        }
      })();
    }, titleAutosaveDelayMs);
    return () => window.clearTimeout(timeoutId);
    // Autosave helpers read refs updated by input handlers; helper identity is not a debounce input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDraftId, targetLearner]);

  useEffect(() => {
    if (!draft || currentDraftId.length === 0 || Object.keys(editedChapters).length === 0) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          await saveEditedChaptersNow();
        } catch {
          // Silent autosave keeps the visible workflow clean.
        }
      })();
    }, titleAutosaveDelayMs);
    return () => window.clearTimeout(timeoutId);
    // Autosave helpers read refs updated by input handlers; helper identity is not a debounce input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDraftId, draft, editedChapters]);

  useEffect(() => {
    if (!draft || currentDraftId.length === 0 || Object.keys(editedLessons).length === 0) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          await saveEditedLessonsNow();
        } catch {
          // Silent autosave keeps the visible workflow clean.
        }
      })();
    }, titleAutosaveDelayMs);
    return () => window.clearTimeout(timeoutId);
    // Autosave helpers read refs updated by input handlers; helper identity is not a debounce input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDraftId, draft, editedLessons]);

  useEffect(() => {
    if (!draft || currentDraftId.length === 0 || Object.keys(editedBlocks).length === 0) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          await saveEditedBlocksNow();
        } catch {
          // Silent autosave keeps the visible workflow clean.
        }
      })();
    }, titleAutosaveDelayMs);
    return () => window.clearTimeout(timeoutId);
    // Autosave helpers read refs updated by input handlers; helper identity is not a debounce input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDraftId, draft, editedBlocks]);

  // i18n-ignore
  const runBusy = async (operation: () => Promise<unknown>) => {
    setToast(null);
    setIsBusy(true);
    try {
      await operation();
    } catch (error) {
      showToast(messageFromUnknownError(error, t('coursition.app.errors.generic')));
    } finally {
      setIsBusy(false);
    }
  };

  const goToStepAction = (step: DraftStep) => {
    if (!draft) {
      return;
    }
    void runBusy(async () => {
      await savePendingAutosaves();
      await workflow({ action: 'goToStep', draftId: draft.id, step });
    });
  };

  // i18n-ignore
  const runSourceFormAction = async (operation: () => Promise<unknown>) => {
    setToast(null);
    setIsSourceFormPending(true);
    try {
      await operation();
    } catch (error) {
      showToast(messageFromUnknownError(error, t('coursition.app.errors.generic')));
    } finally {
      setIsSourceFormPending(false);
    }
  };

  // i18n-ignore
  const runSourceFileAction = async (operation: () => Promise<unknown>) => {
    setToast(null);
    setIsSourceFilePending(true);
    try {
      await operation();
    } catch (error) {
      showToast(messageFromUnknownError(error, t('coursition.app.errors.generic')));
    } finally {
      setIsSourceFilePending(false);
    }
  };

  // i18n-ignore
  const runSourceRowAction = async (
    sourceId: string,
    action: SourceAction,
    // i18n-ignore
    operation: () => Promise<unknown>,
  ) => {
    setToast(null);
    setPendingSourceActions((currentActions) => ({ ...currentActions, [sourceId]: action }));
    try {
      await operation();
    } catch (error) {
      showToast(messageFromUnknownError(error, t('coursition.app.errors.generic')));
    } finally {
      setPendingSourceActions(({ [sourceId]: _sourceAction, ...currentActions }) => currentActions);
    }
  };

  const validateAuth = () => {
    const nextErrors: AuthFieldErrors = {};
    if (authMode === 'signUp' && name.trim().length === 0) {
      nextErrors.name = t('coursition.app.auth.validation.nameRequired');
    }
    if (email.trim().length === 0) {
      nextErrors.email = t('coursition.app.auth.validation.emailRequired');
    } else if (!emailPattern.test(email.trim())) {
      nextErrors.email = t('coursition.app.auth.validation.emailInvalid');
    }
    if (password.trim().length === 0) {
      nextErrors.password = t('coursition.app.auth.validation.passwordRequired');
    } else if (authMode === 'signUp' && password.length < 8) {
      nextErrors.password = t('coursition.app.auth.validation.passwordLength');
    }
    setAuthErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const submitAuth = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validateAuth()) {
      return;
    }
    void runBusy(async () => {
      await (authMode === 'signUp'
        ? effectBff.client.auth.signUp({ payload: { email, name, password } })
        : effectBff.client.auth.signIn({ payload: { email, password } }));
      const user = await refreshSession();
      if (user) {
        if (initialRoute) {
          await workflow({ action: 'selectDraft', draftId: initialRoute.draftId });
          await workflow({
            action: 'goToStep',
            draftId: initialRoute.draftId,
            step: initialRoute.step,
          });
          return;
        }
        const result = await workflow({ action: 'getState' });
        setSnapshot({ ...result, draft: null });
      }
    });
  };

  const createDraft = (submittedTitle: string) =>
    runBusy(async () => {
      const result = await effectBff.client.workflow.apply({
        payload: { action: 'createDraft', language, title: submittedTitle },
      });
      setTitle('');
      if (result.draft) {
        await navigate({
          params: {
            courseId: result.draft.id,
            lang: language,
            step: courseRouteStepSlug(language, 'mode'),
          },
          to: courseRoutePattern(language),
        });
      }
      applyWorkflowSnapshot(result);
    });

  const deleteDraft = (draftId: string) => {
    void runBusy(async () => {
      await workflow({ action: 'deleteDraft', confirm: true, draftId });
      setConfirmDeleteDraftId('');
    });
  };

  const changeDraftTitle = (event: ChangeEvent<HTMLInputElement>) => {
    const nextTitle = event.currentTarget.value;
    latestDraftTitle.current = nextTitle;
    draftTitleDirtyRef.current = nextTitle.trim() !== lastSavedDraftTitle.current;
    setDraftTitle(nextTitle);
  };

  const changeQuestions = (nextQuestions: GuidedQuestions) => {
    latestQuestions.current = nextQuestions;
    questionsDirtyRef.current = !questionsAreEqual(nextQuestions, lastSavedQuestions.current);
    setQuestions(nextQuestions);
  };

  const changeTargetLearner = (nextTargetLearner: TargetLearner) => {
    latestTargetLearner.current = nextTargetLearner;
    targetLearnerDirtyRef.current = !targetLearnersAreEqual(
      nextTargetLearner,
      lastSavedTargetLearner.current,
    );
    setTargetLearner(nextTargetLearner);
  };

  const changeEditedTopic = (topicId: string, nextTopic: EditableTopic) => {
    setEditedTopics((currentTopics) => ({
      ...currentTopics,
      [topicId]: nextTopic,
    }));
  };

  const changeEditedChapter = (chapter: Chapter, nextChapter: EditableChapter) => {
    setEditedChapters((currentChapters) => ({
      ...currentChapters,
      [chapter.id]: nextChapter,
    }));
  };

  const changeEditedLesson = (lesson: Lesson, nextLesson: EditableLesson) => {
    setEditedLessons((currentLessons) => ({
      ...currentLessons,
      [lesson.id]: nextLesson,
    }));
  };

  const changeEditedBlock = (block: LessonBlock, nextBlock: EditableBlock) => {
    setEditedBlocks((currentBlocks) => ({
      ...currentBlocks,
      [block.id]: nextBlock,
    }));
  };

  const setMode = (mode: AiMode) => {
    if (!draft || draft.mode === mode) {
      return;
    }
    const draftId = draft.id;
    const previousMode = draft.mode;
    modeSaveSequenceRef.current += 1;
    const saveSequence = modeSaveSequenceRef.current;
    setToast(null);
    applyLocalDraftMode(draftId, mode);
    const previousModeSave = modeSaveChainRef.current;
    modeSaveChainRef.current = (async () => {
      await previousModeSave;
      if (saveSequence !== modeSaveSequenceRef.current || activeDraftIdRef.current !== draftId) {
        return;
      }
      try {
        const result = await effectBff.client.workflow.apply({
          payload: { action: 'setMode', draftId, mode },
        });
        if (result.draft) {
          confirmedDraftModeRef.current = {
            draftId: result.draft.id,
            mode: result.draft.mode,
          };
        }
        if (saveSequence !== modeSaveSequenceRef.current || activeDraftIdRef.current !== draftId) {
          return;
        }
        applyWorkflowSnapshot(result);
      } catch (error) {
        if (saveSequence !== modeSaveSequenceRef.current || activeDraftIdRef.current !== draftId) {
          return;
        }
        const confirmedDraftMode = confirmedDraftModeRef.current;
        applyLocalDraftMode(
          draftId,
          confirmedDraftMode?.draftId === draftId ? confirmedDraftMode.mode : previousMode,
        );
        showToast(messageFromUnknownError(error, t('coursition.app.errors.generic')));
      }
    })();
  };

  const selectSourceType = (type: SourceType) => {
    setSourceType(type);
    setSourceErrors({});
  };

  const sourceInputFromForm = (form: HTMLFormElement) => {
    const formContent =
      form.querySelector<HTMLInputElement | HTMLTextAreaElement>('#coursition-source-content')
        ?.value ?? '';
    const formName = form.querySelector<HTMLInputElement>('#coursition-source-name')?.value ?? '';
    return {
      content: formContent.trim().length > 0 ? formContent : sourceContent,
      name: formName.length > 0 ? formName : sourceName,
      type: sourceType,
      ...(sourceSizeLabel.length > 0 ? { sizeLabel: sourceSizeLabel } : {}),
    };
  };

  const submitSourceForm = (form: HTMLFormElement | null) => {
    if (!draft || form === null) {
      return;
    }
    const sourceInput = sourceInputFromForm(form);
    const nextSourceErrors: SourceFieldErrors = {};
    if (sourceInput.name.trim().length === 0) {
      nextSourceErrors.name = t('coursition.app.knowledge.sourceNameRequired');
    }
    if (sourceInput.content.trim().length === 0) {
      nextSourceErrors.content = t('coursition.app.navigation.blockedReasons.sourceRequired');
    }
    if (sourceProviderMissingMessage) {
      nextSourceErrors.content = sourceProviderMissingMessage;
    }
    if (Object.keys(nextSourceErrors).length > 0) {
      setSourceErrors(nextSourceErrors);
      showToast(
        nextSourceErrors.name ??
          nextSourceErrors.content ??
          t('coursition.app.navigation.blockedReasons.sourceRequired'),
      );
      return;
    }
    setSourceErrors({});
    void runSourceFormAction(async () => {
      const result = await workflow({
        action: 'addSource',
        draftId: draft.id,
        source: sourceInput,
      });
      setPreviewSourceId('');
      setSourceContent('');
      setSourceName('');
      setSourceSizeLabel('');
      setIsSourceFormOpen(false);
      return result;
    });
  };

  const addSource = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitSourceForm(event.currentTarget);
  };

  const prepareFileSource = (file: File) => {
    void runSourceFileAction(async () => {
      setSourceType('file');
      setSourceName(file.name);
      setSourceSizeLabel(`${Math.max(1, Math.ceil(file.size / 1024))} KB`);
      setSourceContent(await readableFileContent(file));
    });
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    if (!file) {
      return;
    }
    prepareFileSource(file);
  };

  const handleFileDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const [file] = event.dataTransfer.files;
    if (!file) {
      return;
    }
    prepareFileSource(file);
  };

  const submitSourceAction =
    // i18n-ignore
    (action: SourceAction, sourceId: string) => (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!draft) {
        return;
      }
      void runSourceRowAction(sourceId, action, async () => {
        await workflow({ action, draftId: draft.id, sourceId });
        if (action === 'deleteSource' && previewSourceId === sourceId) {
          setPreviewSourceId('');
        }
      });
    };

  const generateTopicsAction = () => {
    if (!draft) {
      return;
    }
    if (draft.mode === 'generate' && !hasRequiredGenerateQuestions) {
      setShowQuestionValidation(true);
      showToast(t('coursition.app.questions.generateRequired'));
      return;
    }
    setShowQuestionValidation(false);
    void runBusy(async () => {
      await saveDraftTitleNow();
      await saveEditedTopicsNow();
      await workflow({
        action: 'saveQuestions',
        draftId: draft.id,
        questions: latestQuestions.current,
      });
      await workflow({ action: 'generateTopics', draftId: draft.id });
    });
  };

  const buildFullCourseAction = () => {
    if (!draft || draft.mode !== 'generate') {
      return;
    }
    const draftId = draft.id;
    void runBusy(async () => {
      await modeSaveChainRef.current;
      await savePendingAutosaves();
      const confirmedDraftMode = confirmedDraftModeRef.current;
      if (activeDraftIdRef.current !== draftId) {
        return;
      }
      if (confirmedDraftMode?.draftId !== draftId || confirmedDraftMode.mode !== 'generate') {
        showToast(t('coursition.app.errors.modeSaveRequired'));
        return;
      }
      await workflow({ action: 'buildFullCourse', draftId });
    });
  };

  const generateTargetLearnerAction = () => {
    if (!draft) {
      return;
    }
    void runBusy(async () => {
      await savePendingAutosaves();
      await workflow({ action: 'generateTargetLearner', draftId: draft.id });
    });
  };

  const openPreviewAction = () => {
    if (!draft) {
      return;
    }
    void runBusy(async () => {
      await savePendingAutosaves();
      await workflow({ action: 'openPreview', draftId: draft.id });
    });
  };

  const addTopic = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft || !canAddTopic) {
      return;
    }
    void runBusy(async () => {
      await workflow({
        action: 'addTopic',
        description: manualTopic.description,
        draftId: draft.id,
        name: manualTopic.name,
      });
      setManualTopic({ description: '', name: '' });
    });
  };

  const deleteTopicAction = (topicId: string) => {
    if (!draft) {
      return;
    }
    void runBusy(() => workflow({ action: 'deleteTopic', draftId: draft.id, topicId }));
  };

  const confirmTargetAction = () => {
    if (!draft || !canConfirmTarget) {
      return;
    }
    void runBusy(async () => {
      await savePendingAutosaves();
      await workflow({
        action: 'confirmTarget',
        draftId: draft.id,
        targetLearner: latestTargetLearner.current,
      });
    });
  };

  const generateChaptersAction = () => {
    if (!draft) {
      return;
    }
    if (!getWorkflowPrerequisiteGate(workflowDraftForGate(draft), 'chapters').allowed) {
      return;
    }
    void runBusy(async () => {
      await savePendingAutosaves();
      await workflow({ action: 'generateChapters', draftId: draft.id });
    });
  };

  const addChapter = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft) {
      return;
    }
    void runBusy(async () => {
      await workflow({
        action: 'addChapter',
        description: manualChapter.description,
        draftId: draft.id,
        outcome: manualChapter.outcome,
        title: manualChapter.title,
      });
      setManualChapter({ description: '', outcome: '', title: '' });
    });
  };

  const moveChapter =
    (chapterId: string, direction: 'up' | 'down') => (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!draft) {
        return;
      }
      void runBusy(async () => {
        await saveEditedChaptersNow([chapterId]);
        await workflow({ action: 'moveChapter', chapterId, direction, draftId: draft.id });
      });
    };

  const deleteChapter = (chapterId: string) => (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft) {
      return;
    }
    void runBusy(async () => {
      await saveEditedChaptersNow();
      await workflow({ action: 'deleteChapter', chapterId, draftId: draft.id });
    });
  };

  const confirmChaptersAction = () => {
    if (!draft) {
      return;
    }
    if (draft.chapters.length === 0) {
      return;
    }
    if (
      !getWorkflowPrerequisiteGate(workflowDraftForGate(draft), 'chapters', {
        blockOpenFindings: true,
        includeTargetFindings: true,
      }).allowed
    ) {
      return;
    }
    void runBusy(async () => {
      await savePendingAutosaves();
      await workflow({ action: 'confirmChapters', draftId: draft.id });
    });
  };

  const generateLessonsAction = () => {
    if (!draft) {
      return;
    }
    if (!getWorkflowPrerequisiteGate(workflowDraftForGate(draft), 'lessons').allowed) {
      return;
    }
    void runBusy(async () => {
      await savePendingAutosaves();
      await workflow({ action: 'generateLessons', draftId: draft.id });
    });
  };

  const generateLessons = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    generateLessonsAction();
  };

  const generateChapterLessons = (chapterId: string) => {
    if (!draft) {
      return;
    }
    if (!getWorkflowPrerequisiteGate(workflowDraftForGate(draft), 'lessons').allowed) {
      return;
    }
    void runBusy(async () => {
      await savePendingAutosaves();
      await workflow({ action: 'generateChapterLessons', chapterId, draftId: draft.id });
    });
  };

  const regenerateLesson = (lessonId: string) => (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft) {
      return;
    }
    void runBusy(async () => {
      await savePendingAutosaves();
      await workflow({ action: 'regenerateLesson', draftId: draft.id, lessonId });
    });
  };

  const addLesson = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft || !canAddLesson) {
      return;
    }
    void runBusy(async () => {
      await workflow({
        action: 'addLesson',
        chapterId: selectedChapterId,
        draftId: draft.id,
        title: manualLessonTitle,
      });
      setManualLessonTitle('');
    });
  };

  const addBlock = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft || !canAddBlock) {
      return;
    }
    void runBusy(async () => {
      await workflow({
        action: 'addBlock',
        blockType: manualBlock.type,
        body: manualBlock.body,
        draftId: draft.id,
        lessonId: selectedLessonId,
        title: manualBlock.title,
      });
      setManualBlock({ body: '', title: '', type: 'summary' });
    });
  };

  const moveLesson =
    (lessonId: string, direction: 'up' | 'down') => (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!draft) {
        return;
      }
      void runBusy(async () => {
        await saveEditedLessonsNow([lessonId]);
        await workflow({ action: 'moveLesson', direction, draftId: draft.id, lessonId });
      });
    };

  const deleteLesson = (lessonId: string) => (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft) {
      return;
    }
    void runBusy(async () => {
      await saveEditedLessonsNow();
      await workflow({ action: 'deleteLesson', draftId: draft.id, lessonId });
    });
  };

  const moveBlock =
    (blockId: string, direction: 'up' | 'down') => (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!draft) {
        return;
      }
      void runBusy(async () => {
        await saveEditedBlocksNow([blockId]);
        await workflow({ action: 'moveBlock', blockId, direction, draftId: draft.id });
      });
    };

  const deleteBlock = (blockId: string) => (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft) {
      return;
    }
    void runBusy(async () => {
      await saveEditedBlocksNow();
      await workflow({ action: 'deleteBlock', blockId, draftId: draft.id });
    });
  };

  const retryAiRun = (runId: string) => (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft) {
      return;
    }
    void runBusy(() => workflow({ action: 'retryAiRun', draftId: draft.id, runId }));
  };

  // i18n-ignore
  const allLessons = draft?.chapters.flatMap((chapter) => chapter.lessons) ?? [];
  const isSelectedLesson = function isSelectedLesson(lesson: Lesson) {
    return lesson.id === selectedLessonId;
  };
  const selectedLesson = allLessons.find(isSelectedLesson);
  const primaryLesson = selectedLesson ?? allLessons[0];
  const activeStepTitle = draft
    ? t(
        draft.step === 'preview'
          ? 'coursition.app.preview.title'
          : `coursition.app.steps.${navigationActiveStep}`,
      )
    : '';
  const previousStepPath = previousStep ? routeForStep(previousStep) : undefined;
  const topicsGenerationLabelKey =
    draft && draft.topics.length > 0
      ? 'coursition.app.topics.regenerate'
      : 'coursition.app.topics.generate';
  const chaptersGenerationLabelKey =
    draft && draft.chapters.length > 0
      ? 'coursition.app.chapters.regenerate'
      : 'coursition.app.chapters.generate';
  const lessonsGenerationLabelKey =
    allLessons.length > 0 ? 'coursition.app.lessons.regenerate' : 'coursition.app.lessons.generate';
  const targetGenerationLabelKey = targetHasContent
    ? 'coursition.app.target.regenerate'
    : 'coursition.app.target.generate';
  const dashboardCount = (kind: 'sources' | 'chapters' | 'lessons', count: number) =>
    t(`coursition.app.dashboard.counts.${kind}.${countCategoryFor(language, count)}`, { count });
  const updateSourceContent = (value: string) => {
    setSourceErrors(({ content: _content, ...currentErrors }) => currentErrors);
    setSourceContent(value);
  };
  const renderSourceContentField = () => {
    if (isBinaryFileSource) {
      return (
        <div className="grid gap-1">
          <label
            className="text-sm font-medium text-slate-700"
            htmlFor="coursition-source-content"
            id="coursition-source-content-label"
          >
            {t(`coursition.app.knowledge.${sourceType}Content`)}
          </label>
          <textarea
            aria-labelledby="coursition-source-content-label"
            hidden
            id="coursition-source-content"
            name="sourceContent"
            readOnly
            value={sourceContent}
          />
          <div className="grid min-h-20 content-center gap-1 rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700">
            <p className="font-medium text-slate-950">
              {t('coursition.app.knowledge.binaryPayloadHidden')}
            </p>
            <p>
              {sourceProviderMissingMessage ||
                sourceBinaryReadyMessage ||
                t('coursition.app.knowledge.fileReady')}
            </p>
          </div>
        </div>
      );
    }
    if (sourceType === 'url') {
      return (
        <FormInput
          className={inputClass}
          autoComplete="url"
          id="coursition-source-content"
          label={t('coursition.app.knowledge.urlContent')}
          name="sourceContent"
          onChange={(event) => updateSourceContent(event.currentTarget.value)}
          placeholder={t('coursition.app.knowledge.urlPlaceholder')}
          required
          type="url"
          value={sourceContent}
        />
      );
    }
    return (
      <MarkdownSourceField
        id="coursition-source-content"
        label={t(`coursition.app.knowledge.${sourceType}Content`)}
        loadingLabel={t('coursition.app.knowledge.editorLoading')}
        name="sourceContent"
        onChange={updateSourceContent}
        placeholder={t(`coursition.app.knowledge.${sourceType}Placeholder`)}
        value={sourceContent}
      />
    );
  };
  const renderAuthError = (field: AuthField) => {
    const message = authErrors[field];
    if (!message) {
      return null;
    }
    return (
      <p
        className="-mt-2 text-sm font-medium text-slate-950"
        id={authFieldErrorId(field)}
        role="alert"
      >
        <span className="font-semibold">[!]</span>{' '}
        <span className="font-semibold">{t('coursition.app.auth.validation.errorPrefix')}</span>{' '}
        {message}
      </p>
    );
  };
  const renderNextNavigationControl = () => {
    if (shouldBuildFullCourseFromKnowledge) {
      return (
        <Button
          theme="unstyled"
          size="current"
          className={stepHeaderPrimaryButtonClass}
          disabled={isBusy || !fullCourseGenerationGate.allowed}
          type="button"
          onClick={buildFullCourseAction}
        >
          {isBusy
            ? t('coursition.app.modes.generate.building')
            : t('coursition.app.modes.generate.action')}
        </Button>
      );
    }
    if (shouldOpenPreviewFromLessons) {
      return (
        <Button
          theme="unstyled"
          size="current"
          className={stepHeaderPrimaryButtonClass}
          disabled={isBusy || !previewGate.allowed}
          type="button"
          onClick={openPreviewAction}
        >
          {t('coursition.app.navigation.next')}
        </Button>
      );
    }
    if (activeStep === 'target') {
      return (
        <Button
          theme="unstyled"
          size="current"
          className={stepHeaderPrimaryButtonClass}
          disabled={isBusy || !canConfirmTarget}
          type="button"
          onClick={confirmTargetAction}
        >
          {t('coursition.app.navigation.next')}
        </Button>
      );
    }
    if (activeStep === 'chapters') {
      return (
        <Button
          theme="unstyled"
          size="current"
          className={stepHeaderPrimaryButtonClass}
          disabled={
            isBusy || !draft || draft.chapters.length === 0 || !chapterConfirmationGate.allowed
          }
          type="button"
          onClick={confirmChaptersAction}
        >
          {t('coursition.app.navigation.next')}
        </Button>
      );
    }
    if (nextStep !== undefined && nextStepGate.allowed && !isBusy) {
      return (
        <Button
          theme="unstyled"
          size="current"
          className={stepHeaderPrimaryButtonClass}
          type="button"
          onClick={() => goToStepAction(nextStep)}
        >
          {t('coursition.app.navigation.next')}
        </Button>
      );
    }
    return (
      <span
        aria-disabled="true"
        className={`${stepHeaderPrimaryButtonClass} cursor-not-allowed opacity-50`}
      >
        {t('coursition.app.navigation.next')}
      </span>
    );
  };

  return (
    <section
      aria-labelledby="coursition-workflow-title"
      className="grid gap-5"
      data-coursition-workflow
    >
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1
            id="coursition-workflow-title"
            className="text-xl font-semibold tracking-normal text-slate-950"
          >
            {t('coursition.app.title')}
          </h1>
        </div>
      </header>

      {toast ? (
        <div
          className="fixed right-4 bottom-4 z-50 flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-md bg-red-700 px-3 py-2 text-sm font-medium text-white"
          role="alert"
        >
          <span className="min-w-0">{toast.message}</span>
          <Button
            theme="unstyled"
            size="current"
            className="shrink-0 rounded-sm px-2 py-1 text-xs font-semibold text-white underline decoration-1 underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-red-700"
            type="button"
            onClick={() => setToast(null)}
          >
            {t('coursition.app.errors.dismiss')}
          </Button>
        </div>
      ) : null}

      {sessionUser === null ? (
        <form className={`${panelClass} max-w-md`} noValidate onSubmit={submitAuth}>
          <fieldset className={actionRowClass} aria-label={t('coursition.app.auth.modeLabel')}>
            <Button
              theme="unstyled"
              size="current"
              aria-pressed={authMode === 'signUp'}
              className={authMode === 'signUp' ? authModeButtonSelectedClass : authModeButtonClass}
              type="button"
              onClick={() => {
                setAuthErrors({});
                setAuthMode('signUp');
              }}
            >
              {t('coursition.app.auth.signUp')}
            </Button>
            <Button
              theme="unstyled"
              size="current"
              aria-pressed={authMode === 'signIn'}
              className={authMode === 'signIn' ? authModeButtonSelectedClass : authModeButtonClass}
              type="button"
              onClick={() => {
                setAuthErrors({});
                setAuthMode('signIn');
              }}
            >
              {t('coursition.app.auth.signIn')}
            </Button>
          </fieldset>
          {authMode === 'signUp' ? (
            <>
              <FormInput
                className={inputClass}
                autoComplete="name"
                aria-describedby={authFieldErrorDescription(authErrors, 'name')}
                aria-invalid={Boolean(authErrors.name)}
                id="coursition-auth-name"
                label={t('coursition.app.auth.name')}
                name="name"
                onChange={(event) => {
                  setAuthErrors(({ name: _name, ...currentErrors }) => currentErrors);
                  setName(event.currentTarget.value);
                }}
                required
                size="sm"
                value={name}
              />
              {renderAuthError('name')}
            </>
          ) : null}
          <FormInput
            className={inputClass}
            autoComplete="email"
            aria-describedby={authFieldErrorDescription(authErrors, 'email')}
            aria-invalid={Boolean(authErrors.email)}
            id="coursition-auth-email"
            label={t('coursition.app.auth.email')}
            name="email"
            onChange={(event) => {
              setAuthErrors(({ email: _email, ...currentErrors }) => currentErrors);
              setEmail(event.currentTarget.value);
            }}
            required
            size="sm"
            type="email"
            value={email}
          />
          {renderAuthError('email')}
          <FormInput
            className={inputClass}
            autoComplete={authMode === 'signUp' ? 'new-password' : 'current-password'}
            aria-describedby={authFieldErrorDescription(authErrors, 'password')}
            aria-invalid={Boolean(authErrors.password)}
            id="coursition-auth-password"
            label={t('coursition.app.auth.password')}
            name="password"
            onChange={(event) => {
              setAuthErrors(({ password: _password, ...currentErrors }) => currentErrors);
              setPassword(event.currentTarget.value);
            }}
            required
            size="sm"
            type="password"
            value={password}
          />
          {renderAuthError('password')}
          <Button
            theme="unstyled"
            size="current"
            className={buttonPrimaryClass}
            disabled={isBusy || !canSubmitAuth}
            type="submit"
          >
            {isBusy
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
      ) : null}

      {sessionUser !== null && draft === null && initialRoute !== null ? (
        <p className={mutedTextClass}>{t('coursition.app.loadingCourse')}</p>
      ) : null}

      {sessionUser !== null && draft === null && initialRoute === null ? (
        <section className="grid gap-5" aria-labelledby="coursition-dashboard-title">
          <div className="grid gap-1">
            <h3
              className="text-lg font-semibold tracking-normal text-slate-950"
              id="coursition-dashboard-title"
            >
              {t('coursition.app.dashboard.title')}
            </h3>
          </div>
          <form
            className="grid max-w-xl gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              const submittedTitle =
                event.currentTarget.querySelector<HTMLInputElement>('#coursition-draft-title')
                  ?.value ?? title;
              void createDraft(submittedTitle);
            }}
          >
            <FormInput
              className={inputClass}
              id="coursition-draft-title"
              label={t('coursition.app.draft.title')}
              onChange={(event) => setTitle(event.currentTarget.value)}
              required
              value={title}
            />
            <Button
              theme="unstyled"
              size="current"
              className={buttonPrimaryClass}
              disabled={isBusy}
              type="submit"
            >
              {t('coursition.app.draft.create')}
            </Button>
          </form>
          {drafts.length > 0 ? (
            <ol className="grid gap-3">
              {drafts.map((draftSummary) => {
                const draftRoute = routeForDraftSummary(draftSummary);
                const isConfirmingDelete = confirmDeleteDraftId === draftSummary.id;
                return (
                  <li className="grid gap-3 py-3" key={draftSummary.id}>
                    <div className="grid gap-1">
                      <h4 className="text-base font-semibold tracking-normal text-slate-950">
                        {draftSummary.title}
                      </h4>
                      <p className={mutedTextClass}>
                        {t('coursition.app.dashboard.courseMeta', {
                          chapters: dashboardCount('chapters', draftSummary.chapterCount),
                          lessons: dashboardCount('lessons', draftSummary.lessonCount),
                          mode: t(`coursition.app.modes.${draftSummary.mode}.label`),
                          sources: dashboardCount('sources', draftSummary.sourceCount),
                          step: t(`coursition.app.steps.${draftSummary.step}`),
                        })}
                      </p>
                    </div>
                    <div className={actionRowClass}>
                      <Link
                        className={`${buttonSmallPrimaryClass} no-underline`}
                        params={draftRoute.params}
                        to={draftRoute.to}
                      >
                        {t('coursition.app.dashboard.edit')}
                      </Link>
                      <Button
                        theme="unstyled"
                        size="current"
                        className={buttonSmallSecondaryClass}
                        disabled={isBusy}
                        type="button"
                        onClick={() => {
                          if (isConfirmingDelete) {
                            deleteDraft(draftSummary.id);
                            return;
                          }
                          setConfirmDeleteDraftId(draftSummary.id);
                        }}
                      >
                        {t(
                          isConfirmingDelete
                            ? 'coursition.app.dashboard.confirmDelete'
                            : 'coursition.app.dashboard.delete',
                        )}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className={mutedTextClass}>{t('coursition.app.dashboard.empty')}</p>
          )}
        </section>
      ) : null}

      {sessionUser !== null && draft !== null ? (
        <div className="grid gap-5 lg:grid-cols-[14rem_minmax(0,1fr)]">
          <aside
            aria-label={t('coursition.app.navigation.label')}
            className="grid content-start gap-2 lg:sticky lg:top-20"
          >
            <ol className="grid gap-1">
              {navigationSteps.map((step) => {
                const index = navigationSteps.indexOf(step);
                const stepGate = gateDraft
                  ? getWorkflowStepGate(gateDraft, step)
                  : { allowed: false };
                const stepPath = routeForStep(step);
                const stepClassName = `grid h-9 min-h-9 w-full grid-cols-[1.75rem_minmax(0,1fr)] items-center gap-2 overflow-hidden rounded-md px-2 py-1.5 text-left text-sm font-semibold no-underline transition ${
                  index === navigationStepIndex
                    ? 'bg-slate-950 text-[#ffffff] ring-1 ring-slate-950'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-950'
                }`;
                const stepNumber = index + 1;
                const isSkipped =
                  draft.mode === 'generate' &&
                  index < navigationStepIndex &&
                  skippedGenerateModeSteps.has(step);
                const stateLabel = t(
                  stepStateLabelKey(index, navigationStepIndex, stepGate.allowed, isSkipped),
                );
                const markerClassName = `grid size-6 place-items-center text-xs font-semibold ${
                  index === navigationStepIndex
                    ? 'text-white'
                    : 'rounded-full bg-blue-50 text-blue-700'
                }`;
                return (
                  <li key={step}>
                    {stepGate.allowed && stepPath && !isBusy ? (
                      <Button
                        theme="unstyled"
                        size="current"
                        className={stepClassName}
                        type="button"
                        onClick={() => goToStepAction(step)}
                      >
                        <span className={markerClassName}>{stepNumber}</span>
                        <span
                          aria-current={index === navigationStepIndex ? 'step' : undefined}
                          className="flex min-w-0 items-center gap-1"
                        >
                          <span className="min-w-0 truncate lg:whitespace-normal">
                            {t(`coursition.app.steps.${step}`)}
                          </span>
                          <span className="sr-only">{stateLabel}</span>
                        </span>
                      </Button>
                    ) : (
                      <span
                        aria-disabled="true"
                        className={`${stepClassName} cursor-not-allowed opacity-50`}
                      >
                        <span className={markerClassName}>{stepNumber}</span>
                        <span className="flex min-w-0 items-center gap-1">
                          <span className="min-w-0 truncate lg:whitespace-normal">
                            {t(`coursition.app.steps.${step}`)}
                          </span>
                          <span className="sr-only">{stateLabel}</span>
                        </span>
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          </aside>

          <div className="grid min-w-0 gap-4">
            <div
              className={`grid min-w-0 gap-4 ${
                draft.step !== 'preview' && hasReviewContent
                  ? 'xl:grid-cols-[minmax(0,1fr)_18rem]'
                  : ''
              }`}
            >
              <div className="grid min-w-0 content-start gap-4">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 pb-1">
                  <h3 className="min-w-0 truncate text-lg font-semibold tracking-normal text-slate-950">
                    {activeStepTitle}
                  </h3>
                  <nav
                    aria-label={t('coursition.app.navigation.label')}
                    className="flex h-9 shrink-0 items-center justify-end gap-2 self-center"
                  >
                    {previousStepPath !== undefined && !isBusy ? (
                      <Button
                        theme="unstyled"
                        size="current"
                        className={stepHeaderSecondaryButtonClass}
                        type="button"
                        onClick={() => {
                          if (previousStep) {
                            goToStepAction(previousStep);
                          }
                        }}
                      >
                        {t('coursition.app.navigation.back')}
                      </Button>
                    ) : (
                      <span
                        aria-disabled="true"
                        className={`${stepHeaderSecondaryButtonClass} cursor-not-allowed opacity-50`}
                      >
                        {t('coursition.app.navigation.back')}
                      </span>
                    )}
                    {renderNextNavigationControl()}
                  </nav>
                </div>
                {nextStepReason ? <p className="sr-only">{nextStepReason}</p> : null}

                {activeStep === 'mode' ? (
                  <section className={panelClass}>
                    <div className="max-w-xl">
                      <FormInput
                        id="coursition-draft-title-edit"
                        label={t('coursition.app.draft.title')}
                        onChange={changeDraftTitle}
                        value={draftTitle}
                      />
                    </div>
                    <fieldset className="grid gap-2">
                      <legend className="sr-only">{t('coursition.app.modes.legend')}</legend>
                      <p className={mutedTextClass}>{t('coursition.app.modes.help')}</p>
                      <div className="grid gap-2 md:grid-cols-2">
                        {modeOptions.map((mode) => {
                          const modeInputId = `coursition-mode-${mode}`;
                          const modeDescriptionId = `${modeInputId}-description`;
                          const isSelectedMode = draft.mode === mode;
                          return (
                            <label
                              className={`grid min-h-44 cursor-pointer content-start gap-3 rounded-md border p-3 text-left transition ${
                                isSelectedMode
                                  ? 'border-slate-950 bg-slate-950 text-white'
                                  : 'border-slate-200 bg-white text-slate-950 hover:border-slate-400 hover:bg-slate-50'
                              } ${isBusy ? 'cursor-not-allowed opacity-60' : ''}`}
                              htmlFor={modeInputId}
                              key={mode}
                            >
                              <span className="flex items-start gap-2">
                                <input
                                  aria-describedby={modeDescriptionId}
                                  aria-labelledby={`${modeInputId}-label`}
                                  checked={isSelectedMode}
                                  className="mt-1 size-4 shrink-0 accent-slate-950"
                                  disabled={isBusy}
                                  id={modeInputId}
                                  name="coursition-mode"
                                  onChange={() => setMode(mode)}
                                  type="radio"
                                  value={mode}
                                />
                                <span className="grid min-w-0 gap-1">
                                  <span
                                    className="text-sm font-semibold leading-5"
                                    id={`${modeInputId}-label`}
                                  >
                                    {t(`coursition.app.modes.${mode}.label`)}
                                  </span>
                                </span>
                              </span>
                              <span
                                className={`text-sm leading-5 ${
                                  isSelectedMode ? 'text-slate-100' : 'text-slate-600'
                                }`}
                                id={modeDescriptionId}
                              >
                                {t(`coursition.app.modes.${mode}.body`)}
                              </span>
                              <span
                                className={`text-xs leading-5 ${
                                  isSelectedMode ? 'text-slate-200' : 'text-slate-500'
                                }`}
                              >
                                {t(`coursition.app.modes.${mode}.impact`)}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>
                  </section>
                ) : null}

                {activeStep === 'knowledge' ? (
                  <section className={panelClass}>
                    <h3 className="sr-only">{t('coursition.app.knowledge.title')}</h3>
                    {isSourceFormOpen || visibleSources.length === 0 ? (
                      <form
                        aria-label={t('coursition.app.knowledge.title')}
                        className="grid gap-3"
                        noValidate
                        onSubmit={addSource}
                        ref={sourceFormRef}
                      >
                        <fieldset className="inline-flex w-fit rounded-md bg-slate-100 p-0.5">
                          {sourceTypes.map((type) => (
                            <Button
                              theme="unstyled"
                              size="current"
                              aria-pressed={sourceType === type}
                              className={
                                sourceType === type ? buttonPrimaryClass : buttonSecondaryClass
                              }
                              key={type}
                              type="button"
                              onClick={() => selectSourceType(type)}
                              onMouseDown={(event) => {
                                event.preventDefault();
                                selectSourceType(type);
                              }}
                            >
                              {t(`coursition.app.sourceTypes.${type}`)}
                            </Button>
                          ))}
                        </fieldset>
                        {sourceType === 'file' ? (
                          <div
                            className="grid gap-2 bg-slate-100 p-3"
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={handleFileDrop}
                          >
                            <label
                              className="text-sm font-medium text-slate-700"
                              htmlFor="coursition-source-file"
                            >
                              {t('coursition.app.knowledge.chooseFile')}
                            </label>
                            <input
                              aria-label={t('coursition.app.knowledge.chooseFile')}
                              className="block w-full rounded-md border-0 bg-white px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-950 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white focus:ring-2 focus:ring-slate-400"
                              id="coursition-source-file"
                              onChange={handleFileChange}
                              type="file"
                            />
                          </div>
                        ) : null}
                        <div className="grid gap-3">
                          <div className="grid gap-1">
                            <FormInput
                              className={inputClass}
                              id="coursition-source-name"
                              label={t('coursition.app.knowledge.sourceName')}
                              name="sourceName"
                              onChange={(event) => {
                                setSourceErrors(
                                  ({ name: _name, ...currentErrors }) => currentErrors,
                                );
                                setSourceName(event.currentTarget.value);
                              }}
                              required
                              value={sourceName}
                            />
                            {sourceNameFeedback ? (
                              <p className="text-sm font-medium text-red-700" role="alert">
                                {sourceNameFeedback}
                              </p>
                            ) : null}
                          </div>
                          <div className="grid gap-1">
                            {renderSourceContentField()}
                            {sourceContentFeedback ? (
                              <p className="text-sm font-medium text-red-700" role="alert">
                                {sourceContentFeedback}
                              </p>
                            ) : null}
                          </div>
                          <Button
                            theme="unstyled"
                            size="current"
                            disabled={
                              isSourceFormPending ||
                              isSourceFilePending ||
                              Boolean(sourceProviderMissingMessage)
                            }
                            className={`${buttonPrimaryClass} w-fit justify-self-start`}
                            type="submit"
                            onMouseDown={(event) => {
                              event.preventDefault();
                              submitSourceForm(sourceFormRef.current);
                            }}
                          >
                            {t(sourceSubmitLabelKey)}
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <Button
                        theme="unstyled"
                        size="current"
                        className={`${buttonSecondaryClass} w-fit`}
                        type="button"
                        onClick={() => setIsSourceFormOpen(true)}
                      >
                        {t('coursition.app.knowledge.add')}
                      </Button>
                    )}
                    <ul className="grid gap-2">
                      {visibleSources.map((source) => {
                        const sourceStatus =
                          (source.status === 'queued' || source.status === 'processing') &&
                          sourceHasReadableContent(source)
                            ? 'processed'
                            : source.status;
                        const isSourcePreviewOpen = previewSourceId === source.id;
                        const pendingSourceAction = pendingSourceActions[source.id];
                        return (
                          <li className="grid gap-2 py-2" key={source.id}>
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="grid min-w-0 gap-1">
                                <strong className="truncate text-sm font-semibold text-slate-950">
                                  {source.name}
                                </strong>
                                <span className={mutedTextClass}>
                                  {t(`coursition.app.sourceTypes.${source.type}`)} -{' '}
                                  {t(`coursition.app.sourceStatuses.${sourceStatus}`)} -{' '}
                                  {localizedSourceSize(source.sizeLabel, t)}
                                </span>
                              </div>
                              <div className={actionRowClass}>
                                <Button
                                  theme="unstyled"
                                  size="current"
                                  aria-expanded={isSourcePreviewOpen}
                                  aria-controls={
                                    isSourcePreviewOpen
                                      ? `coursition-source-preview-${source.id}`
                                      : undefined
                                  }
                                  className={buttonSmallSecondaryClass}
                                  type="button"
                                  onClick={() =>
                                    setPreviewSourceId(isSourcePreviewOpen ? '' : source.id)
                                  }
                                >
                                  {t(
                                    isSourcePreviewOpen
                                      ? 'coursition.app.knowledge.hidePreview'
                                      : 'coursition.app.knowledge.showPreview',
                                  )}
                                </Button>
                                {source.status === 'failed' || source.status === 'unsupported' ? (
                                  <form
                                    aria-label={`${t('coursition.app.knowledge.retry')} ${
                                      source.name
                                    }`}
                                    onSubmit={submitSourceAction('retrySource', source.id)}
                                  >
                                    <Button
                                      theme="unstyled"
                                      size="current"
                                      className={buttonSmallSecondaryClass}
                                      disabled={pendingSourceAction !== undefined}
                                      type="submit"
                                    >
                                      {t(
                                        pendingSourceAction === 'retrySource'
                                          ? 'coursition.app.knowledge.retrying'
                                          : 'coursition.app.knowledge.retry',
                                      )}
                                    </Button>
                                  </form>
                                ) : null}
                                <form
                                  aria-label={`${t('coursition.app.knowledge.delete')} ${
                                    source.name
                                  }`}
                                  onSubmit={submitSourceAction('deleteSource', source.id)}
                                >
                                  <Button
                                    theme="unstyled"
                                    size="current"
                                    className={buttonSmallSecondaryClass}
                                    disabled={pendingSourceAction !== undefined}
                                    type="submit"
                                  >
                                    {t(
                                      pendingSourceAction === 'deleteSource'
                                        ? 'coursition.app.knowledge.deleting'
                                        : 'coursition.app.knowledge.delete',
                                    )}
                                  </Button>
                                </form>
                              </div>
                            </div>
                            {source.failureReason ? (
                              <p className="text-sm text-red-700">{source.failureReason}</p>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                    {previewSource ? (
                      <section
                        className="grid gap-2 bg-slate-100 p-3"
                        id={`coursition-source-preview-${previewSource.id}`}
                      >
                        <h4 className="text-sm font-semibold text-slate-950">
                          {t('coursition.app.knowledge.previewTitle', {
                            name: previewSource.name,
                          })}
                        </h4>
                        {visibleSourceContent(previewSource.content) ? (
                          <div className="min-w-0">
                            <MarkdownPreview
                              loadingLabel={t('coursition.app.knowledge.editorLoading')}
                              value={visibleSourceContent(previewSource.content)}
                            />
                          </div>
                        ) : (
                          <p className="text-sm text-slate-700">
                            {t('coursition.app.knowledge.previewEmpty')}
                          </p>
                        )}
                      </section>
                    ) : null}
                  </section>
                ) : null}

                {activeStep === 'questions' ? (
                  <section className={panelClass}>
                    <h3 className="sr-only">{t('coursition.app.questions.title')}</h3>
                    <form className="grid gap-3" id="coursition-questions-form" noValidate>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <Button
                          theme="unstyled"
                          size="current"
                          className={buttonPrimaryClass}
                          disabled={isBusy}
                          type="button"
                          onClick={generateTopicsAction}
                        >
                          {isBusy
                            ? t('coursition.app.topics.generating')
                            : t(topicsGenerationLabelKey)}
                        </Button>
                      </div>
                      {showQuestionValidation && !hasRequiredGenerateQuestions ? (
                        <p className="text-sm font-medium text-red-700" role="alert">
                          {t('coursition.app.questions.generateRequired')}
                        </p>
                      ) : null}
                      <div className="grid gap-3 lg:grid-cols-2">
                        <TextareaField
                          ariaLabel={`${t('coursition.app.questions.outcome')}*`}
                          id="coursition-question-outcome"
                          label={t('coursition.app.questions.outcome')}
                          onChange={(event) =>
                            changeQuestions({ ...questions, outcome: event.currentTarget.value })
                          }
                          required
                          rows={2}
                          value={questions.outcome}
                        />
                        <TextareaField
                          ariaLabel={`${t('coursition.app.questions.audience')}*`}
                          id="coursition-question-audience"
                          label={t('coursition.app.questions.audience')}
                          onChange={(event) =>
                            changeQuestions({ ...questions, audience: event.currentTarget.value })
                          }
                          required
                          rows={2}
                          value={questions.audience}
                        />
                        <TextareaField
                          ariaLabel={t('coursition.app.questions.prior')}
                          id="coursition-question-prior"
                          label={t('coursition.app.questions.prior')}
                          onChange={(event) =>
                            changeQuestions({
                              ...questions,
                              priorKnowledge: event.currentTarget.value,
                            })
                          }
                          rows={2}
                          value={questions.priorKnowledge}
                        />
                        <TextareaField
                          ariaLabel={t('coursition.app.questions.depth')}
                          id="coursition-question-depth"
                          label={t('coursition.app.questions.depth')}
                          onChange={(event) =>
                            changeQuestions({ ...questions, depth: event.currentTarget.value })
                          }
                          rows={2}
                          value={questions.depth}
                        />
                        <TextareaField
                          ariaLabel={t('coursition.app.questions.avoid')}
                          id="coursition-question-avoid"
                          label={t('coursition.app.questions.avoid')}
                          onChange={(event) =>
                            changeQuestions({ ...questions, avoid: event.currentTarget.value })
                          }
                          rows={2}
                          value={questions.avoid}
                        />
                        <TextareaField
                          ariaLabel={`${t('coursition.app.questions.practice')}*`}
                          id="coursition-question-practice"
                          label={t('coursition.app.questions.practice')}
                          onChange={(event) =>
                            changeQuestions({ ...questions, practice: event.currentTarget.value })
                          }
                          required
                          rows={2}
                          value={questions.practice}
                        />
                      </div>
                      <label
                        className="flex w-fit items-center gap-2 text-sm font-medium text-slate-950"
                        htmlFor="coursition-question-strict-source-only"
                      >
                        <input
                          aria-labelledby="coursition-question-strict-source-only-label"
                          checked={questions.strictSourceOnly}
                          className="size-4 accent-slate-950"
                          id="coursition-question-strict-source-only"
                          onChange={(event) =>
                            changeQuestions({
                              ...questions,
                              strictSourceOnly: event.currentTarget.checked,
                            })
                          }
                          type="checkbox"
                        />
                        <span id="coursition-question-strict-source-only-label">
                          {t('coursition.app.questions.strict')}
                        </span>
                      </label>
                    </form>
                  </section>
                ) : null}

                {activeStep === 'topics' ? (
                  <section className={panelClass}>
                    <h3 className="sr-only">{t('coursition.app.topics.title')}</h3>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-700">
                        {t('coursition.app.topics.count', { count: topicCount })}
                      </p>
                      <Button
                        theme="unstyled"
                        size="current"
                        className={buttonPrimaryClass}
                        disabled={isBusy}
                        type="button"
                        onClick={generateTopicsAction}
                      >
                        {isBusy
                          ? t('coursition.app.topics.generating')
                          : t(topicsGenerationLabelKey)}
                      </Button>
                    </div>
                    <form
                      aria-label={t('coursition.app.topics.addFormLabel')}
                      className="grid gap-2 md:grid-cols-[minmax(0,0.35fr)_minmax(0,1fr)_auto]"
                      onSubmit={addTopic}
                    >
                      <FormInput
                        className={inputClass}
                        id="coursition-topic-name"
                        label={t('coursition.app.topics.name')}
                        onChange={(event) =>
                          setManualTopic({ ...manualTopic, name: event.currentTarget.value })
                        }
                        value={manualTopic.name}
                      />
                      <FormInput
                        className={inputClass}
                        id="coursition-topic-description"
                        label={t('coursition.app.topics.description')}
                        onChange={(event) =>
                          setManualTopic({
                            ...manualTopic,
                            description: event.currentTarget.value,
                          })
                        }
                        value={manualTopic.description}
                      />
                      <Button
                        className="self-end"
                        disabled={isBusy || !canAddTopic}
                        size="md"
                        type="submit"
                      >
                        {t('coursition.app.topics.add')}
                      </Button>
                    </form>
                    <div className="grid gap-2">
                      {draft.topics.map((topic) => {
                        const editedTopic = editedTopics[topic.id] ?? topic;
                        return (
                          <article className="grid gap-2 py-2" key={topic.id}>
                            <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
                              <div className="grid min-w-0 gap-1">
                                <div className={actionRowClass}>
                                  <label className="sr-only" htmlFor={`topic-name-${topic.id}`}>
                                    {t('coursition.app.topics.name')}
                                  </label>
                                  <input
                                    aria-label={t('coursition.app.topics.name')}
                                    className="min-w-0 flex-1 rounded-md border-0 bg-slate-100 px-3 py-2 text-base font-semibold text-slate-950 outline-none transition focus:bg-white focus:ring-2 focus:ring-slate-400"
                                    id={`topic-name-${topic.id}`}
                                    onChange={(event) =>
                                      changeEditedTopic(topic.id, {
                                        description: editedTopic.description,
                                        name: event.currentTarget.value,
                                      })
                                    }
                                    value={editedTopic.name}
                                  />
                                  <span className={metadataTextClass}>
                                    {t(`coursition.app.topics.importance.${topic.importance}`)}
                                  </span>
                                </div>
                                <label
                                  className="sr-only"
                                  htmlFor={`topic-description-${topic.id}`}
                                >
                                  {t('coursition.app.topics.description')}
                                </label>
                                <textarea
                                  aria-label={t('coursition.app.topics.description')}
                                  className={textareaClass}
                                  id={`topic-description-${topic.id}`}
                                  onChange={(event) =>
                                    changeEditedTopic(topic.id, {
                                      description: event.currentTarget.value,
                                      name: editedTopic.name,
                                    })
                                  }
                                  rows={2}
                                  value={editedTopic.description}
                                />
                              </div>
                              <div className={actionRowClass}>
                                <Button
                                  theme="unstyled"
                                  size="current"
                                  aria-label={t('coursition.app.topics.deleteFormLabel', {
                                    name: topic.name,
                                  })}
                                  className={buttonSmallSecondaryClass}
                                  type="button"
                                  onClick={() => deleteTopicAction(topic.id)}
                                >
                                  {t('coursition.app.topics.delete')}
                                </Button>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                ) : null}

                {activeStep === 'target' ? (
                  <section className={panelClass}>
                    <h3 className="sr-only">{t('coursition.app.target.title')}</h3>
                    <div className={actionRowClass}>
                      <Button
                        theme="unstyled"
                        size="current"
                        className={buttonSecondaryClass}
                        disabled={isBusy}
                        type="button"
                        onClick={generateTargetLearnerAction}
                      >
                        {t(targetGenerationLabelKey)}
                      </Button>
                    </div>
                    <div className="grid gap-3 lg:grid-cols-2">
                      <TextareaField
                        id="coursition-target-profile"
                        label={t('coursition.app.target.profile')}
                        onChange={(event) =>
                          changeTargetLearner({
                            ...targetLearner,
                            profile: event.currentTarget.value,
                          })
                        }
                        rows={2}
                        value={targetLearner.profile}
                      />
                      <TextareaField
                        id="coursition-target-knowledge"
                        label={t('coursition.app.target.currentKnowledge')}
                        onChange={(event) =>
                          changeTargetLearner({
                            ...targetLearner,
                            currentKnowledge: event.currentTarget.value,
                          })
                        }
                        rows={2}
                        value={targetLearner.currentKnowledge}
                      />
                      <TextareaField
                        id="coursition-target-motivation"
                        label={t('coursition.app.target.motivation')}
                        onChange={(event) =>
                          changeTargetLearner({
                            ...targetLearner,
                            motivation: event.currentTarget.value,
                          })
                        }
                        rows={2}
                        value={targetLearner.motivation}
                      />
                      <TextareaField
                        id="coursition-target-pain"
                        label={t('coursition.app.target.pain')}
                        onChange={(event) =>
                          changeTargetLearner({
                            ...targetLearner,
                            pain: event.currentTarget.value,
                          })
                        }
                        rows={2}
                        value={targetLearner.pain}
                      />
                      <TextareaField
                        id="coursition-target-outcome"
                        label={t('coursition.app.target.outcome')}
                        onChange={(event) =>
                          changeTargetLearner({
                            ...targetLearner,
                            desiredOutcome: event.currentTarget.value,
                          })
                        }
                        rows={2}
                        value={targetLearner.desiredOutcome}
                      />
                      <TextareaField
                        id="coursition-target-constraints"
                        label={t('coursition.app.target.constraints')}
                        onChange={(event) =>
                          changeTargetLearner({
                            ...targetLearner,
                            constraints: event.currentTarget.value,
                          })
                        }
                        rows={2}
                        value={targetLearner.constraints}
                      />
                      <TextareaField
                        id="coursition-target-practice"
                        label={t('coursition.app.target.practiceStyle')}
                        onChange={(event) =>
                          changeTargetLearner({
                            ...targetLearner,
                            practiceStyle: event.currentTarget.value,
                          })
                        }
                        rows={2}
                        value={targetLearner.practiceStyle}
                      />
                    </div>
                  </section>
                ) : null}

                {activeStep === 'chapters' ? (
                  <section className={panelClass}>
                    <h3 className="sr-only">{t('coursition.app.chapters.title')}</h3>
                    <>
                      <Button
                        theme="unstyled"
                        size="current"
                        className={buttonSecondaryClass}
                        disabled={isBusy || !chapterGenerationGate.allowed}
                        type="button"
                        onClick={generateChaptersAction}
                      >
                        {t(chaptersGenerationLabelKey)}
                      </Button>
                      {chapterGenerationReason ? (
                        <output className="sr-only">{chapterGenerationReason}</output>
                      ) : null}
                    </>
                    <form className="grid gap-2 md:grid-cols-2" onSubmit={addChapter}>
                      <FormInput
                        className={inputClass}
                        id="coursition-chapter-title"
                        label={t('coursition.app.chapters.name')}
                        onChange={(event) =>
                          setManualChapter({ ...manualChapter, title: event.currentTarget.value })
                        }
                        value={manualChapter.title}
                      />
                      <FormInput
                        className={inputClass}
                        id="coursition-chapter-outcome"
                        label={t('coursition.app.chapters.outcome')}
                        onChange={(event) =>
                          setManualChapter({
                            ...manualChapter,
                            outcome: event.currentTarget.value,
                          })
                        }
                        value={manualChapter.outcome}
                      />
                      <div className="grid gap-2 md:col-span-2">
                        <FormInput
                          className={inputClass}
                          id="coursition-chapter-description"
                          label={t('coursition.app.chapters.description')}
                          onChange={(event) =>
                            setManualChapter({
                              ...manualChapter,
                              description: event.currentTarget.value,
                            })
                          }
                          value={manualChapter.description}
                        />
                        <Button
                          disabled={isBusy || manualChapter.title.trim().length === 0}
                          size="sm"
                          type="submit"
                        >
                          {t('coursition.app.chapters.add')}
                        </Button>
                      </div>
                    </form>
                    <ol className="grid gap-2">
                      {draft.chapters.map((chapter) => (
                        <li className={cardClass} key={chapter.id}>
                          <div className={actionRowClass}>
                            <span className={metadataTextClass}>
                              {t(`coursition.app.chapters.status.${chapter.status}`)}
                            </span>
                            <span className={metadataTextClass}>
                              {t(`coursition.app.chapters.difficulty.${chapter.difficulty}`)}
                            </span>
                          </div>
                          <div className="grid gap-2 md:grid-cols-2">
                            <FormInput
                              className={inputClass}
                              id={`chapter-title-${chapter.id}`}
                              label={t('coursition.app.chapters.name')}
                              onChange={(event) =>
                                changeEditedChapter(chapter, {
                                  description:
                                    editedChapters[chapter.id]?.description ?? chapter.description,
                                  outcome: editedChapters[chapter.id]?.outcome ?? chapter.outcome,
                                  title: event.currentTarget.value,
                                })
                              }
                              value={editedChapters[chapter.id]?.title ?? chapter.title}
                            />
                            <FormInput
                              className={inputClass}
                              id={`chapter-outcome-${chapter.id}`}
                              label={t('coursition.app.chapters.outcome')}
                              onChange={(event) =>
                                changeEditedChapter(chapter, {
                                  description:
                                    editedChapters[chapter.id]?.description ?? chapter.description,
                                  outcome: event.currentTarget.value,
                                  title: editedChapters[chapter.id]?.title ?? chapter.title,
                                })
                              }
                              value={editedChapters[chapter.id]?.outcome ?? chapter.outcome}
                            />
                            <div className="grid gap-2 md:col-span-2">
                              <FormInput
                                className={inputClass}
                                id={`chapter-description-${chapter.id}`}
                                label={t('coursition.app.chapters.description')}
                                onChange={(event) =>
                                  changeEditedChapter(chapter, {
                                    description: event.currentTarget.value,
                                    outcome: editedChapters[chapter.id]?.outcome ?? chapter.outcome,
                                    title: editedChapters[chapter.id]?.title ?? chapter.title,
                                  })
                                }
                                value={
                                  editedChapters[chapter.id]?.description ?? chapter.description
                                }
                              />
                            </div>
                          </div>
                          <div className={actionRowClass}>
                            <form onSubmit={moveChapter(chapter.id, 'up')}>
                              <Button
                                theme="unstyled"
                                size="current"
                                className={buttonSmallSecondaryClass}
                                type="submit"
                              >
                                {t('coursition.app.chapters.moveUp')}
                              </Button>
                            </form>
                            <form onSubmit={moveChapter(chapter.id, 'down')}>
                              <Button
                                theme="unstyled"
                                size="current"
                                className={buttonSmallSecondaryClass}
                                type="submit"
                              >
                                {t('coursition.app.chapters.moveDown')}
                              </Button>
                            </form>
                            <form onSubmit={deleteChapter(chapter.id)}>
                              <Button
                                theme="unstyled"
                                size="current"
                                className={buttonSmallSecondaryClass}
                                type="submit"
                              >
                                {t('coursition.app.chapters.delete')}
                              </Button>
                            </form>
                            <Button
                              theme="unstyled"
                              size="current"
                              className={buttonSmallPrimaryClass}
                              disabled={
                                isBusy ||
                                !lessonGenerationGate.allowed ||
                                chapter.status !== 'confirmed'
                              }
                              onClick={() => generateChapterLessons(chapter.id)}
                              type="button"
                            >
                              {t(
                                chapter.lessons.length > 0
                                  ? 'coursition.app.chapters.regenerateLesson'
                                  : 'coursition.app.chapters.generateLesson',
                              )}
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ol>
                    {chapterConfirmationReason ? (
                      <output className="sr-only">{chapterConfirmationReason}</output>
                    ) : null}
                  </section>
                ) : null}

                {draft.step !== 'preview' &&
                (activeStep === 'lessons' || activeStep === 'builder') ? (
                  <section className={panelClass}>
                    <h3 className="sr-only">{t('coursition.app.lessons.title')}</h3>
                    <div className={actionRowClass}>
                      <form onSubmit={generateLessons}>
                        <Button
                          theme="unstyled"
                          size="current"
                          className={buttonPrimaryClass}
                          disabled={isBusy || !lessonGenerationGate.allowed}
                          type="submit"
                        >
                          {t(lessonsGenerationLabelKey)}
                        </Button>
                      </form>
                    </div>
                    {lessonGenerationReason ? (
                      <output className="sr-only">{lessonGenerationReason}</output>
                    ) : null}
                    <form className="grid gap-2 md:grid-cols-2" onSubmit={addLesson}>
                      <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                        {t('coursition.app.builder.chapter')}
                        <select
                          className="min-h-9 rounded-md border-0 bg-slate-100 px-3 py-2 text-sm text-slate-950 outline-none focus:bg-white focus:ring-2 focus:ring-slate-400"
                          onChange={(event) => setSelectedChapterId(event.currentTarget.value)}
                          value={selectedChapterId}
                        >
                          <option value="">{t('coursition.app.builder.chooseChapter')}</option>
                          {draft.chapters.map((chapter) => (
                            <option key={chapter.id} value={chapter.id}>
                              {chapter.title}
                            </option>
                          ))}
                        </select>
                      </label>
                      <FormInput
                        className={inputClass}
                        id="coursition-manual-lesson-title"
                        label={t('coursition.app.builder.lessonTitle')}
                        onChange={(event) => setManualLessonTitle(event.currentTarget.value)}
                        value={manualLessonTitle}
                      />
                      <Button
                        className="self-end md:col-span-2"
                        disabled={isBusy || !canAddLesson}
                        size="md"
                        type="submit"
                      >
                        {t('coursition.app.builder.addLesson')}
                      </Button>
                    </form>
                    <form className="grid gap-2 md:grid-cols-2" onSubmit={addBlock}>
                      <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                        {t('coursition.app.builder.lesson')}
                        <select
                          className="min-h-9 rounded-md border-0 bg-slate-100 px-3 py-2 text-sm text-slate-950 outline-none focus:bg-white focus:ring-2 focus:ring-slate-400"
                          onChange={(event) => setSelectedLessonId(event.currentTarget.value)}
                          value={selectedLessonId}
                        >
                          <option value="">{t('coursition.app.builder.chooseLesson')}</option>
                          {draft.chapters.flatMap((chapter) =>
                            chapter.lessons.map((lesson) => (
                              <option key={lesson.id} value={lesson.id}>
                                {chapter.title} / {lesson.title}
                              </option>
                            )),
                          )}
                        </select>
                      </label>
                      <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                        {t('coursition.app.builder.blockType')}
                        <select
                          className="min-h-9 rounded-md border-0 bg-slate-100 px-3 py-2 text-sm text-slate-950 outline-none focus:bg-white focus:ring-2 focus:ring-slate-400"
                          onChange={(event) =>
                            setManualBlock({
                              ...manualBlock,
                              type: event.currentTarget.value as LessonBlockType,
                            })
                          }
                          value={manualBlock.type}
                        >
                          {(
                            [
                              'heading',
                              'rich_text',
                              'callout',
                              'image',
                              'media',
                              'file',
                              'quiz',
                              'exercise',
                              'code',
                              'reflection',
                              'summary',
                            ] as const
                          ).map((blockType) => (
                            <option key={blockType} value={blockType}>
                              {t(`coursition.app.blockTypes.${blockType}`)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="md:col-span-2">
                        <FormInput
                          className={inputClass}
                          id="coursition-manual-block-title"
                          label={t('coursition.app.builder.blockTitle')}
                          onChange={(event) =>
                            setManualBlock({ ...manualBlock, title: event.currentTarget.value })
                          }
                          value={manualBlock.title}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <TextareaField
                          id="coursition-manual-block-body"
                          label={t('coursition.app.builder.blockBody')}
                          onChange={(event) =>
                            setManualBlock({ ...manualBlock, body: event.currentTarget.value })
                          }
                          rows={2}
                          value={manualBlock.body}
                        />
                      </div>
                      <Button
                        className="self-end md:col-span-2"
                        disabled={isBusy || !canAddBlock}
                        size="md"
                        type="submit"
                      >
                        {t('coursition.app.builder.addBlock')}
                      </Button>
                    </form>
                    <div className="grid gap-3 lg:grid-cols-[16rem_minmax(0,1fr)]">
                      <ol className="grid content-start gap-2">
                        {draft.chapters.map((chapter) => (
                          <li className={cardClass} key={chapter.id}>
                            <strong className="text-sm font-semibold text-slate-950">
                              {chapter.title}
                            </strong>
                            <p className={mutedTextClass}>{chapter.outcome}</p>
                            {chapter.lessons.length > 0 ? (
                              <ol className="grid gap-2">
                                {chapter.lessons.map((lesson) => (
                                  <li className="grid gap-2 py-2" key={lesson.id}>
                                    <div className="grid gap-2">
                                      <FormInput
                                        className={inputClass}
                                        id={`lesson-title-${lesson.id}`}
                                        label={t('coursition.app.builder.lessonTitle')}
                                        onChange={(event) =>
                                          changeEditedLesson(lesson, {
                                            durationMinutes:
                                              editedLessons[lesson.id]?.durationMinutes ??
                                              lesson.durationMinutes,
                                            title: event.currentTarget.value,
                                          })
                                        }
                                        value={editedLessons[lesson.id]?.title ?? lesson.title}
                                      />
                                      <FormInput
                                        className={inputClass}
                                        id={`lesson-duration-${lesson.id}`}
                                        label={t('coursition.app.builder.lessonDuration')}
                                        onChange={(event) =>
                                          changeEditedLesson(lesson, {
                                            durationMinutes: Number(event.currentTarget.value),
                                            title: editedLessons[lesson.id]?.title ?? lesson.title,
                                          })
                                        }
                                        type="number"
                                        value={String(
                                          editedLessons[lesson.id]?.durationMinutes ??
                                            lesson.durationMinutes,
                                        )}
                                      />
                                    </div>
                                    <div className={actionRowClass}>
                                      <form onSubmit={moveLesson(lesson.id, 'up')}>
                                        <Button
                                          theme="unstyled"
                                          size="current"
                                          className={buttonSmallSecondaryClass}
                                          type="submit"
                                        >
                                          {t('coursition.app.builder.moveUp')}
                                        </Button>
                                      </form>
                                      <form onSubmit={moveLesson(lesson.id, 'down')}>
                                        <Button
                                          theme="unstyled"
                                          size="current"
                                          className={buttonSmallSecondaryClass}
                                          type="submit"
                                        >
                                          {t('coursition.app.builder.moveDown')}
                                        </Button>
                                      </form>
                                      <form onSubmit={deleteLesson(lesson.id)}>
                                        <Button
                                          theme="unstyled"
                                          size="current"
                                          className={buttonSmallSecondaryClass}
                                          type="submit"
                                        >
                                          {t('coursition.app.builder.deleteLesson')}
                                        </Button>
                                      </form>
                                      <form onSubmit={regenerateLesson(lesson.id)}>
                                        <Button
                                          theme="unstyled"
                                          size="current"
                                          className={buttonSmallSecondaryClass}
                                          disabled={isBusy}
                                          type="submit"
                                        >
                                          {t('coursition.app.builder.regenerateLesson')}
                                        </Button>
                                      </form>
                                    </div>
                                  </li>
                                ))}
                              </ol>
                            ) : null}
                          </li>
                        ))}
                      </ol>
                      <div className="grid min-w-0 content-start gap-2">
                        {primaryLesson ? (
                          <>
                            <h4 className="text-base font-semibold text-slate-950">
                              {primaryLesson.title}
                            </h4>
                            {primaryLesson.blocks.map((block) => (
                              <article className={cardClass} key={block.id}>
                                <div className={actionRowClass}>
                                  <span className={metadataTextClass}>
                                    {t(`coursition.app.blockTypes.${block.type}`)}
                                  </span>
                                  <span className={metadataTextClass}>
                                    {t(`coursition.app.builder.provenance.${block.provenance}`)}
                                  </span>
                                </div>
                                <div className="grid gap-2">
                                  <FormInput
                                    className={inputClass}
                                    id={`block-title-${block.id}`}
                                    label={t('coursition.app.builder.blockTitle')}
                                    onChange={(event) =>
                                      changeEditedBlock(block, {
                                        body: editedBlocks[block.id]?.body ?? block.body,
                                        title: event.currentTarget.value,
                                      })
                                    }
                                    value={editedBlocks[block.id]?.title ?? block.title}
                                  />
                                  <TextareaField
                                    id={`block-body-${block.id}`}
                                    label={t('coursition.app.builder.blockBody')}
                                    onChange={(event) =>
                                      changeEditedBlock(block, {
                                        body: event.currentTarget.value,
                                        title: editedBlocks[block.id]?.title ?? block.title,
                                      })
                                    }
                                    rows={3}
                                    value={editedBlocks[block.id]?.body ?? block.body}
                                  />
                                </div>
                                <div className={actionRowClass}>
                                  <form onSubmit={moveBlock(block.id, 'up')}>
                                    <Button
                                      theme="unstyled"
                                      size="current"
                                      className={buttonSmallSecondaryClass}
                                      type="submit"
                                    >
                                      {t('coursition.app.builder.moveUp')}
                                    </Button>
                                  </form>
                                  <form onSubmit={moveBlock(block.id, 'down')}>
                                    <Button
                                      theme="unstyled"
                                      size="current"
                                      className={buttonSmallSecondaryClass}
                                      type="submit"
                                    >
                                      {t('coursition.app.builder.moveDown')}
                                    </Button>
                                  </form>
                                  <form onSubmit={deleteBlock(block.id)}>
                                    <Button
                                      theme="unstyled"
                                      size="current"
                                      className={buttonSmallSecondaryClass}
                                      type="submit"
                                    >
                                      {t('coursition.app.builder.deleteBlock')}
                                    </Button>
                                  </form>
                                </div>
                              </article>
                            ))}
                          </>
                        ) : (
                          <p className={mutedTextClass}>{t('coursition.app.builder.empty')}</p>
                        )}
                      </div>
                    </div>
                  </section>
                ) : null}

                {draft.step === 'preview' && primaryLesson ? (
                  <section className={panelClass}>
                    <h3 className="sr-only">{t('coursition.app.preview.title')}</h3>
                    <div className="grid gap-3 lg:grid-cols-[14rem_minmax(0,1fr)]">
                      <ol className="grid content-start gap-2">
                        {draft.chapters.map((chapter) => (
                          <li className="grid gap-1 text-sm text-slate-700" key={chapter.id}>
                            <strong className="text-sm font-semibold text-slate-950">
                              {chapter.title}
                            </strong>
                            {chapter.lessons.map((lesson) => (
                              <Button
                                theme="unstyled"
                                size="current"
                                className={`rounded px-2 py-1 text-left text-xs transition ${
                                  primaryLesson.id === lesson.id
                                    ? 'bg-slate-950 text-white'
                                    : 'text-slate-600 hover:bg-slate-100'
                                }`}
                                key={lesson.id}
                                type="button"
                                onClick={() => setSelectedLessonId(lesson.id)}
                              >
                                {lesson.title}
                              </Button>
                            ))}
                          </li>
                        ))}
                      </ol>
                      <article className="grid gap-3">
                        <h4 className="text-lg font-semibold text-slate-950">
                          {primaryLesson.title}
                        </h4>
                        {primaryLesson.blocks.map((block) => (
                          <section className="grid gap-1 py-2" key={block.id}>
                            <div className={actionRowClass}>
                              <strong className="text-sm font-semibold text-slate-950">
                                {block.title}
                              </strong>
                              <span className={metadataTextClass}>
                                {t(`coursition.app.builder.provenance.${block.provenance}`)}
                              </span>
                            </div>
                            <MarkdownPreview
                              loadingLabel={t('coursition.app.knowledge.editorLoading')}
                              value={block.body}
                            />
                          </section>
                        ))}
                      </article>
                    </div>
                  </section>
                ) : null}
              </div>

              {draft.step !== 'preview' && hasReviewContent ? (
                <aside
                  className="grid content-start gap-3 xl:sticky xl:top-20 xl:max-h-[calc(100dvh-6rem)] xl:overflow-auto"
                  aria-label={t('coursition.app.review.title')}
                >
                  <section className={panelClass}>
                    <h3 className="text-base font-semibold text-slate-950">
                      {t('coursition.app.review.title')}
                    </h3>
                    {actionableAiRuns.length > 0 ? (
                      <ul className="grid gap-2">
                        {actionableAiRuns.map((run) => (
                          <li className="grid gap-1" key={run.id}>
                            <span className={metadataTextClass}>
                              {`${t(`coursition.app.review.runs.${run.type}`)} - ${t(
                                `coursition.app.review.runStatuses.${run.status}`,
                              )}`}
                            </span>
                            {run.status === 'failed' ? (
                              <form onSubmit={retryAiRun(run.id)}>
                                <Button
                                  theme="unstyled"
                                  size="current"
                                  className={buttonSmallSecondaryClass}
                                  disabled={isBusy}
                                  type="submit"
                                >
                                  {t('coursition.app.review.retryRun')}
                                </Button>
                              </form>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {visibleFindings.length > 0 ? (
                      <ul className="grid gap-2">
                        {visibleFindings.map((finding) => (
                          <li className={cardClass} key={finding.id}>
                            <div className={actionRowClass}>
                              <strong className="text-sm font-semibold text-slate-950">
                                {finding.title}
                              </strong>
                              <span className={metadataTextClass}>
                                {t(`coursition.app.review.severity.${finding.severity}`)}
                              </span>
                              <span className={metadataTextClass}>
                                {t(`coursition.app.review.status.${finding.status}`)}
                              </span>
                            </div>
                            <p className={mutedTextClass}>{finding.detail}</p>
                            <p className={mutedTextClass}>
                              {t('coursition.app.review.target', {
                                step: t(`coursition.app.steps.${finding.step}`),
                                target: t(
                                  `coursition.app.review.targetTypes.${finding.targetType}`,
                                ),
                              })}
                            </p>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </section>
                </aside>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
};

export default CoursitionWorkflowApp;
