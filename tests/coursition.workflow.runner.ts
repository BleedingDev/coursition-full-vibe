/* eslint-disable promise/avoid-new, promise/no-multiple-resolved, promise/param-names, promise/prefer-await-to-callbacks, sort-keys */
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import effectBff from '../api/effect/index.ts';
import * as workflowStore from '../server/coursition/store.ts';

const root = process.cwd();

const providerEnvKeys = [
  'DEEPGRAM_API_KEY',
  'DEEPGRAM_BASE_URL',
  'EXA_API_KEY',
  'EXA_BASE_URL',
  'FIRECRAWL_API_KEY',
  'FIRECRAWL_BASE_URL',
  'LLAMA_CLOUD_API_KEY',
  'LLAMA_CLOUD_BASE_URL',
  'LLAMA_PARSE_TIER',
  'LLAMA_PARSE_VERSION',
  'TAVILY_API_KEY',
  'TAVILY_BASE_URL',
];

const requiredDraft = (draft) => {
  if (!draft) {
    throw new Error('Expected workflow action to return a draft.');
  }
  return draft;
};

const createHarness = async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'coursition-workflow-'));
  process.chdir(tempRoot);

  const coursitionEffectHandler = effectBff.createHandler();

  const cleanup = async () => {
    await coursitionEffectHandler.dispose();
    process.chdir(root);
    await fs.rm(tempRoot, { force: true, recursive: true });
  };

  return { cleanup, store: workflowStore };
};

const withEnv = async (env, run) => {
  const previous = new Map(providerEnvKeys.map((key) => [key, process.env[key]]));
  for (const key of providerEnvKeys) {
    Reflect.deleteProperty(process.env, key);
  }
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) {
      Reflect.deleteProperty(process.env, key);
    } else {
      process.env[key] = value;
    }
  }
  try {
    return await run();
  } finally {
    for (const key of providerEnvKeys) {
      const value = previous.get(key);
      if (value === undefined) {
        Reflect.deleteProperty(process.env, key);
      } else {
        process.env[key] = value;
      }
    }
  }
};

const workflow = async (store, ownerId, action) => {
  const snapshot = await store.applyWorkflowAction(ownerId, action);
  return requiredDraft(snapshot.draft);
};

const createDraft = (store, ownerId, title, language = 'en') =>
  workflow(store, ownerId, {
    action: 'createDraft',
    language,
    title,
  });

const addNotesSource = (store, ownerId, draftId, content, name = 'Source notes') =>
  workflow(store, ownerId, {
    action: 'addSource',
    draftId,
    source: {
      content,
      name,
      type: 'notes',
    },
  });

const sourceFirstPreparation = (overrides = {}) => ({
  activityMixPreference: 'retrieval checks, scenario decisions, and applied practice',
  audience: 'incident coordinators learning from source material',
  constraints: 'Short sessions with explicit source grounding',
  depth: 'practical',
  desiredOutcome: 'Learners can apply the provided source material in a realistic workflow.',
  language: 'en',
  languagePreference: 'source',
  priorKnowledge: 'They understand the work context but need a teachable path through the source.',
  sourceStrictness: 'standard',
  tone: 'clear, concrete, and active',
  ...overrides,
});

const sourceMaterial = [
  'Zephyr response handbook for incident coordinators.',
  'The source defines intake triage, severity selection, evidence capture, ownership handoff, escalation timing, and after-action review.',
  'Learners must practice choosing a severity, collecting source evidence, writing a handoff note, and explaining why an escalation is justified.',
  'The training should include retrieval checks, scenario decisions, short feedback, and one realistic practice task.',
].join('\n\n');

const czechSourceMaterial = [
  'Bezpečnostní školení pro nové koordinátory směn.',
  'Materiál vysvětluje identifikaci rizik, hlášení incidentů, používání ochranných pomůcek a kontrolu pracovního místa.',
  'Účastníci mají procvičit rozhodnutí v modelové situaci, vybavení bezpečnostních pravidel a krátkou zpětnou vazbu.',
].join('\n\n');

const blueprintFor = (draft) => {
  if (!draft.learningBlueprint) {
    throw new Error('Expected draft.learningBlueprint to be present.');
  }
  return draft.learningBlueprint;
};

const openBlockingFindingCount = (draft) =>
  draft.findings.filter((finding) => finding.severity === 'blocking' && finding.status === 'open')
    .length;

const openWarningCount = (draft) =>
  draft.findings.filter((finding) => finding.severity === 'warning' && finding.status === 'open')
    .length;

const preparationHasContent = (draft) => {
  const preparation = blueprintFor(draft).coursePreparation;
  return (
    preparation.audience.trim().length > 0 &&
    preparation.desiredOutcome.trim().length > 0 &&
    preparation.depth.trim().length > 0
  );
};

const nonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

const retrievalCheckRenderable = (interaction) =>
  nonEmptyString(interaction.question) &&
  nonEmptyString(interaction.explanationPrompt) &&
  Array.isArray(interaction.choices) &&
  interaction.choices.some((choice) => choice.isCorrect === true && nonEmptyString(choice.text));

const practiceTaskRenderable = (interaction) =>
  nonEmptyString(interaction.prompt) &&
  nonEmptyString(interaction.submissionLabel) &&
  Array.isArray(interaction.checklist) &&
  interaction.checklist.some(nonEmptyString);

const scenarioDecisionRenderable = (interaction) =>
  nonEmptyString(interaction.scenario) &&
  nonEmptyString(interaction.justificationPrompt) &&
  Array.isArray(interaction.choices) &&
  interaction.choices.some(
    (choice) =>
      choice.isPreferred === true &&
      nonEmptyString(choice.text) &&
      nonEmptyString(choice.consequence),
  );

const orderingMatchingRenderable = (interaction) =>
  nonEmptyString(interaction.prompt) &&
  Array.isArray(interaction.items) &&
  interaction.items.length >= 2 &&
  interaction.items.every((item) => nonEmptyString(item.text));

const rubricAnswerRenderable = (interaction) =>
  nonEmptyString(interaction.prompt) &&
  Array.isArray(interaction.criteria) &&
  interaction.criteria.some(nonEmptyString);

const activityInteractionRenderers = {
  ordering_matching: orderingMatchingRenderable,
  practice_task: practiceTaskRenderable,
  retrieval_check: retrievalCheckRenderable,
  rubric_answer: rubricAnswerRenderable,
  scenario_decision: scenarioDecisionRenderable,
};

const activityRenderable = (activity) => {
  const interaction = activity?.interaction;
  if (!interaction || interaction.kind !== activity.type || !nonEmptyString(interaction.feedback)) {
    return false;
  }
  const renderable = activityInteractionRenderers[interaction.kind];
  return renderable?.(interaction) === true;
};

const courseContentRenderable = (draft) => {
  const content = draft.courseContent;
  const sectionBlocks = Array.isArray(content?.sections)
    ? content.sections.flatMap((section) => section.blocks ?? [])
    : [];
  const topLevelBlocks = Array.isArray(content?.blocks) ? content.blocks : [];
  const hasContentBlock = [...sectionBlocks, ...topLevelBlocks].some(
    (block) =>
      typeof block?.body === 'string' &&
      block.body.trim().length > 0 &&
      typeof block?.title === 'string' &&
      block.title.trim().length > 0,
  );
  return hasContentBlock || blueprintFor(draft).generatedActivities.some(activityRenderable);
};

const sourceGrounded = (draft) => {
  const blueprint = blueprintFor(draft);
  const hasProcessedSource = draft.sources.some((source) => source.status === 'processed');
  const groundedObjectives = blueprint.objectives.every(
    (objective) =>
      objective.sourceConfidence !== 'none' ||
      (Array.isArray(objective.sourceReferences) && objective.sourceReferences.length > 0),
  );
  const groundedBriefs = blueprint.activityBriefs.every(
    (brief) =>
      brief.sourceConfidence !== 'none' ||
      (Array.isArray(brief.sourceReferences) && brief.sourceReferences.length > 0),
  );
  const groundedActivities = blueprint.generatedActivities.every(
    (activity) =>
      activity.sourceConfidence !== 'none' ||
      (Array.isArray(activity.sourceReferences) && activity.sourceReferences.length > 0),
  );
  return (
    hasProcessedSource &&
    blueprint.sourceCoverage !== 'manual' &&
    groundedObjectives &&
    groundedBriefs &&
    groundedActivities
  );
};

const generateLearningBlueprint = (store, ownerId, draftId) =>
  workflow(store, ownerId, {
    action: 'generateLearningBlueprint',
    draftId,
  });

const generateCourseContent = (store, ownerId, draftId) =>
  workflow(store, ownerId, {
    action: 'generateCourseContent',
    draftId,
  });

const goToStep = (store, ownerId, draftId, step) =>
  workflow(store, ownerId, {
    action: 'goToStep',
    draftId,
    step,
  });

const updatePreparation = (store, ownerId, draftId, preparation) =>
  workflow(store, ownerId, {
    action: 'updateCoursePreparation',
    draftId,
    preparation,
  });

const createWebExtractionServer = () =>
  new Promise((resolve, reject) => {
    const requests = {
      exa: [],
      firecrawl: [],
      tavily: [],
    };
    const server = http.createServer((request, response) => {
      if (request.method === 'POST' && request.url === '/v1/scrape') {
        let body = '';
        request.on('data', (chunk) => {
          body += chunk;
        });
        request.on('end', () => {
          requests.firecrawl.push(JSON.parse(body));
          response.writeHead(502, { 'content-type': 'application/json' });
          response.end(JSON.stringify({ error: 'firecrawl unavailable in deterministic test' }));
        });
        return;
      }
      if (request.method === 'POST' && request.url === '/extract') {
        let body = '';
        request.on('data', (chunk) => {
          body += chunk;
        });
        request.on('end', () => {
          requests.tavily.push(JSON.parse(body));
          response.writeHead(200, { 'content-type': 'application/json' });
          response.end(
            JSON.stringify({
              results: [
                {
                  raw_content:
                    '# Source lifecycle material\n\n- provider extracted material\n- source-first practice content',
                  url: 'https://example.com/source-lifecycle',
                },
              ],
            }),
          );
        });
        return;
      }
      if (request.method === 'POST' && request.url === '/contents') {
        let body = '';
        request.on('data', (chunk) => {
          body += chunk;
        });
        request.on('end', () => {
          requests.exa.push(JSON.parse(body));
          response.writeHead(200, { 'content-type': 'application/json' });
          response.end(
            JSON.stringify({
              results: [
                {
                  text: '# Exa fallback should not run after Tavily succeeds',
                  url: 'https://example.com/source-lifecycle',
                },
              ],
            }),
          );
        });
        return;
      }
      response.writeHead(404, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'not found' }));
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Expected local web extraction server port.'));
        return;
      }
      resolve({
        close: () =>
          new Promise((closeResolve, closeReject) => {
            server.close((error) => (error ? closeReject(error) : closeResolve()));
          }),
        requests,
        url: `http://127.0.0.1:${address.port}`,
      });
    });
  });

const createLlamaParseServer = () =>
  new Promise((resolve, reject) => {
    const requests = {
      jobs: [],
      polls: [],
      uploads: [],
    };
    const server = http.createServer((request, response) => {
      if (request.method === 'POST' && request.url === '/api/v1/beta/files') {
        const chunks = [];
        request.on('data', (chunk) => {
          chunks.push(chunk);
        });
        request.on('end', () => {
          const uploadIndex = requests.uploads.length + 1;
          requests.uploads.push({
            authorization: request.headers.authorization,
            bodyLength: Buffer.concat(chunks).length,
          });
          response.writeHead(200, { 'content-type': 'application/json' });
          response.end(JSON.stringify({ id: `file-${uploadIndex}` }));
        });
        return;
      }
      if (request.method === 'POST' && request.url === '/api/v2/parse') {
        let body = '';
        request.on('data', (chunk) => {
          body += chunk;
        });
        request.on('end', () => {
          const jobIndex = requests.jobs.length + 1;
          requests.jobs.push(JSON.parse(body));
          response.writeHead(200, { 'content-type': 'application/json' });
          response.end(JSON.stringify({ id: `job-${jobIndex}` }));
        });
        return;
      }
      if (request.method === 'GET' && request.url?.startsWith('/api/v2/parse/job-')) {
        const url = new URL(request.url, 'http://127.0.0.1');
        const jobId = url.pathname.split('/').at(-1);
        requests.polls.push({
          expand: url.searchParams.get('expand'),
          jobId,
        });
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(
          JSON.stringify({
            job: {
              id: jobId,
              status: 'COMPLETED',
            },
            markdown: {
              pages: [
                {
                  markdown: `# Parsed PDF ${jobId}\n\nProvider markdown for ${jobId}.`,
                  page_number: 1,
                  success: true,
                },
              ],
            },
          }),
        );
        return;
      }
      response.writeHead(404, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'not found' }));
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Expected local LlamaParse server port.'));
        return;
      }
      resolve({
        close: () =>
          new Promise((closeResolve, closeReject) => {
            server.close((error) => (error ? closeReject(error) : closeResolve()));
          }),
        requests,
        url: `http://127.0.0.1:${address.port}`,
      });
    });
  });

const buildAssistBlueprint = async (store, ownerId, title = 'Assist source-first course') => {
  const draft = await createDraft(store, ownerId, title);
  const sourcedDraft = await addNotesSource(store, ownerId, draft.id, sourceMaterial);
  await updatePreparation(
    store,
    ownerId,
    sourcedDraft.id,
    sourceFirstPreparation({
      audience: 'incident coordinators validating generated course preparation',
    }),
  );
  return generateLearningBlueprint(store, ownerId, sourcedDraft.id);
};

const scenarios = {
  async sourceFirstGenerate() {
    const { cleanup, store } = await createHarness();
    try {
      const draft = await createDraft(
        store,
        'owner-source-first-generate',
        'Generated from source',
      );
      await workflow(store, 'owner-source-first-generate', {
        action: 'setMode',
        draftId: draft.id,
        mode: 'generate',
      });
      await addNotesSource(store, 'owner-source-first-generate', draft.id, sourceMaterial);
      const generatedDraft = await workflow(store, 'owner-source-first-generate', {
        action: 'generateCourse',
        draftId: draft.id,
      });
      const blueprint = blueprintFor(generatedDraft);
      return {
        activityBriefCount: blueprint.activityBriefs.length,
        blockingFindingCount: openBlockingFindingCount(generatedDraft),
        courseContentRenderable: courseContentRenderable(generatedDraft),
        generatedActivityCount: blueprint.generatedActivities.length,
        hasCoursePreparation: preparationHasContent(generatedDraft),
        objectiveCount: blueprint.objectives.length,
        preparationLanguage: blueprint.coursePreparation.language,
        sourceCoverage: blueprint.sourceCoverage,
        sourceGrounded: sourceGrounded(generatedDraft),
        sourceStatuses: generatedDraft.sources.map((source) => source.status),
        step: generatedDraft.step,
      };
    } finally {
      await cleanup();
    }
  },

  async assistModeGates() {
    const { cleanup, store } = await createHarness();
    try {
      const ownerId = 'owner-assist-gates';
      const draft = await createDraft(store, ownerId, 'Assist source-first gates');
      await addNotesSource(store, ownerId, draft.id, sourceMaterial);
      const sourcesDraft = await goToStep(store, ownerId, draft.id, 'sources');
      const preparedDraft = await updatePreparation(
        store,
        ownerId,
        draft.id,
        sourceFirstPreparation({
          audience: 'incident coordinators who need realistic practice',
          desiredOutcome: 'They can triage and hand off incidents using the source material.',
        }),
      );
      const preparationDraft = await goToStep(store, ownerId, draft.id, 'preparation');
      const blueprintDraft = await generateLearningBlueprint(store, ownerId, draft.id);
      const [firstObjective] = blueprintFor(blueprintDraft).objectives;
      if (!firstObjective) {
        throw new Error('Expected generated learning objective.');
      }
      await workflow(store, ownerId, {
        action: 'updateLearningObjective',
        capability: `${firstObjective.capability} with source evidence`,
        draftId: draft.id,
        objectiveId: firstObjective.id,
        title: firstObjective.title,
      });
      const objectivesDraft = await goToStep(store, ownerId, draft.id, 'objectives');
      const [firstBrief] = blueprintFor(objectivesDraft).activityBriefs;
      if (!firstBrief) {
        throw new Error('Expected generated activity brief.');
      }
      await workflow(store, ownerId, {
        action: 'updateActivityBrief',
        briefId: firstBrief.id,
        draftId: draft.id,
        feedbackGuidance: `${firstBrief.feedbackGuidance} Name the source cue in the feedback.`,
        instructions: firstBrief.instructions,
        learnerAction: firstBrief.learnerAction,
        successCriteria: firstBrief.successCriteria,
        title: firstBrief.title,
        type: firstBrief.type,
      });
      const activityPlanDraft = await goToStep(store, ownerId, draft.id, 'activityPlan');
      await generateCourseContent(store, ownerId, draft.id);
      const courseContentDraft = await goToStep(store, ownerId, draft.id, 'courseContent');
      const previewDraft = await workflow(store, ownerId, {
        action: 'openPreview',
        draftId: draft.id,
      });
      const blueprint = blueprintFor(previewDraft);
      return {
        activityBriefCount: blueprint.activityBriefs.length,
        courseContentRenderable: courseContentRenderable(previewDraft),
        generatedActivityCount: blueprint.generatedActivities.length,
        objectiveCount: blueprint.objectives.length,
        preparationAudience: preparedDraft.learningBlueprint.coursePreparation.audience,
        stepAfterActivityPlan: activityPlanDraft.step,
        stepAfterCourseContent: courseContentDraft.step,
        stepAfterObjectives: objectivesDraft.step,
        stepAfterPreparation: preparationDraft.step,
        stepAfterPreview: previewDraft.step,
        stepAfterSources: sourcesDraft.step,
      };
    } finally {
      await cleanup();
    }
  },

  async sourceLifecycle() {
    const server = await createWebExtractionServer();
    return withEnv(
      {
        DEEPGRAM_API_KEY: undefined,
        EXA_API_KEY: 'test-exa-key',
        EXA_BASE_URL: server.url,
        FIRECRAWL_API_KEY: 'test-firecrawl-key',
        FIRECRAWL_BASE_URL: server.url,
        LLAMA_CLOUD_API_KEY: undefined,
        TAVILY_API_KEY: 'test-tavily-key',
        TAVILY_BASE_URL: server.url,
      },
      async () => {
        const { cleanup, store } = await createHarness();
        try {
          const ownerId = 'owner-source-lifecycle';
          const draft = await createDraft(store, ownerId, 'Source lifecycle contract');
          const notesDraft = await addNotesSource(
            store,
            ownerId,
            draft.id,
            'source lifecycle notes for repeatable practice and provider classification',
            'Lifecycle notes',
          );
          const urlDraft = await workflow(store, ownerId, {
            action: 'addSource',
            draftId: draft.id,
            source: {
              content: 'https://example.com/source-lifecycle',
              name: 'Lifecycle URL',
              type: 'url',
            },
          });
          await workflow(store, ownerId, {
            action: 'addSource',
            draftId: draft.id,
            source: {
              content: 'delete this source from active source list',
              name: 'Deleted notes',
              type: 'notes',
            },
          });
          const sourceSnapshot = await store.snapshotFor(ownerId);
          const deletedSource = requiredDraft(sourceSnapshot.draft).sources.find(
            (source) => source.name === 'Deleted notes',
          );
          if (!deletedSource) {
            throw new Error('Expected source to delete.');
          }
          await workflow(store, ownerId, {
            action: 'deleteSource',
            draftId: draft.id,
            sourceId: deletedSource.id,
          });
          const retrySetupDraft = await workflow(store, ownerId, {
            action: 'addSource',
            draftId: draft.id,
            source: {
              content: 'retryable local file source content',
              name: 'Retryable source.txt',
              type: 'file',
            },
          });
          const retrySource = retrySetupDraft.sources.find(
            (source) => source.name === 'Retryable source.txt',
          );
          if (!retrySource) {
            throw new Error('Expected retryable source.');
          }
          const retriedDraft = await workflow(store, ownerId, {
            action: 'retrySource',
            draftId: draft.id,
            sourceId: retrySource.id,
          });
          const pdfDraft = await workflow(store, ownerId, {
            action: 'addSource',
            draftId: draft.id,
            source: {
              content: `data:application/pdf;base64,${Buffer.from(
                '%PDF-1.4 source fixture',
              ).toString('base64')}`,
              name: 'Provider document.pdf',
              sizeLabel: '1 KB',
              type: 'file',
            },
          });
          const audioDraft = await workflow(store, ownerId, {
            action: 'addSource',
            draftId: draft.id,
            source: {
              content: `data:audio/mpeg;base64,${Buffer.from('audio fixture').toString('base64')}`,
              name: 'Provider narration.mp3',
              sizeLabel: '1 KB',
              type: 'file',
            },
          });
          const finalSourceDraft = await workflow(store, ownerId, {
            action: 'addSource',
            draftId: draft.id,
            source: {
              content: `data:application/octet-stream;base64,${Buffer.from('unknown').toString(
                'base64',
              )}`,
              name: 'Unknown binary.bin',
              sizeLabel: '1 KB',
              type: 'file',
            },
          });
          const finalStepDraft = await goToStep(store, ownerId, draft.id, 'sources');
          const activeSources = finalSourceDraft.sources.filter(
            (source) => source.status !== 'deleted',
          );
          return {
            deletedSourceStatus: finalSourceDraft.sources.find(
              (source) => source.name === 'Deleted notes',
            )?.status,
            fileProcessors: [
              pdfDraft.sources.find((source) => source.name === 'Provider document.pdf')?.processor,
              audioDraft.sources.find((source) => source.name === 'Provider narration.mp3')
                ?.processor,
              finalSourceDraft.sources.find((source) => source.name === 'Unknown binary.bin')
                ?.processor,
            ],
            finalStep: finalStepDraft.step,
            noteStatus: notesDraft.sources.find((source) => source.name === 'Lifecycle notes')
              ?.status,
            retriedSourceStatus: retriedDraft.sources.find(
              (source) => source.name === 'Retryable source.txt',
            )?.status,
            sourceNames: activeSources.map((source) => source.name),
            sourceTypes: activeSources.map((source) => source.type),
            urlProcessor: urlDraft.sources.find((source) => source.name === 'Lifecycle URL')
              ?.processor,
            urlStatus: urlDraft.sources.find((source) => source.name === 'Lifecycle URL')?.status,
          };
        } finally {
          await cleanup();
          await server.close();
        }
      },
    );
  },

  async llamaParsePdfLifecycle() {
    const server = await createLlamaParseServer();
    return withEnv(
      {
        DEEPGRAM_API_KEY: undefined,
        EXA_API_KEY: undefined,
        FIRECRAWL_API_KEY: undefined,
        LLAMA_CLOUD_API_KEY: 'test-llama-key',
        LLAMA_CLOUD_BASE_URL: server.url,
        LLAMA_PARSE_TIER: 'cost_effective',
        LLAMA_PARSE_VERSION: 'latest',
        TAVILY_API_KEY: undefined,
      },
      async () => {
        const { cleanup, store } = await createHarness();
        try {
          const ownerId = 'owner-llamaparse-pdf';
          const draft = await createDraft(store, ownerId, 'PDF parse lifecycle');
          const pdfContent = `data:application/pdf;base64,${Buffer.from(
            '%PDF-1.4 parse and retry fixture',
          ).toString('base64')}`;
          const parsedDraft = await workflow(store, ownerId, {
            action: 'addSource',
            draftId: draft.id,
            source: {
              content: pdfContent,
              name: 'Provider document.pdf',
              sizeLabel: '1 KB',
              type: 'file',
            },
          });
          const parsedSource = parsedDraft.sources.find(
            (source) => source.name === 'Provider document.pdf',
          );
          if (!parsedSource) {
            throw new Error('Expected parsed PDF source.');
          }
          const retriedDraft = await workflow(store, ownerId, {
            action: 'retrySource',
            draftId: draft.id,
            sourceId: parsedSource.id,
          });
          const retriedSource = retriedDraft.sources.find(
            (source) => source.id === parsedSource.id,
          );
          if (!retriedSource) {
            throw new Error('Expected retried PDF source.');
          }
          return {
            jobBodies: server.requests.jobs,
            parsedContent: parsedSource.content,
            parsedProcessor: parsedSource.processor,
            parsedProviderJobId: parsedSource.providerJobId,
            parsedStatus: parsedSource.status,
            pollCount: server.requests.polls.length,
            pollExpands: server.requests.polls.map((poll) => poll.expand),
            retriedContent: retriedSource.content,
            retriedOriginalInputPreserved: retriedSource.originalInput === pdfContent,
            retriedProviderJobId: retriedSource.providerJobId,
            retriedStatus: retriedSource.status,
            sameSourceId: retriedSource.id === parsedSource.id,
            uploadCount: server.requests.uploads.length,
          };
        } finally {
          await cleanup();
          await server.close();
        }
      },
    );
  },

  async ownerIsolationAndResume() {
    const { cleanup, store } = await createHarness();
    try {
      const aliceDraft = await createDraft(store, 'alice', 'Alice source-first draft');
      const bobDraft = await createDraft(store, 'bob', 'Bob source-first draft');
      const aliceSnapshot = await store.snapshotFor('alice');
      const bobSnapshot = await store.snapshotFor('bob');
      let crossOwnerError = '';
      try {
        await store.applyWorkflowAction('bob', {
          action: 'selectDraft',
          draftId: aliceDraft.id,
        });
      } catch (error) {
        crossOwnerError = error instanceof Error ? error.message : String(error);
      }

      const firstDraft = await createDraft(store, 'owner-resume', 'First source draft');
      await addNotesSource(store, 'owner-resume', firstDraft.id, sourceMaterial, 'Resume source');
      await new Promise((resolve) => {
        setTimeout(resolve, 5);
      });
      const secondDraft = await createDraft(store, 'owner-resume', 'Second source draft');
      const listSnapshot = await store.snapshotFor('owner-resume');
      const selectedSnapshot = await store.applyWorkflowAction('owner-resume', {
        action: 'selectDraft',
        draftId: firstDraft.id,
      });
      return {
        aliceDraftId: aliceDraft.id,
        aliceSnapshotDraftId: requiredDraft(aliceSnapshot.draft).id,
        aliceSnapshotTitle: requiredDraft(aliceSnapshot.draft).title,
        bobDraftId: bobDraft.id,
        bobSnapshotDraftId: requiredDraft(bobSnapshot.draft).id,
        bobSnapshotTitle: requiredDraft(bobSnapshot.draft).title,
        crossOwnerError,
        latestDraftId: listSnapshot.drafts[0]?.id,
        selectedDraftId: requiredDraft(selectedSnapshot.draft).id,
        selectedStep: requiredDraft(selectedSnapshot.draft).step,
        summaryCount: listSnapshot.drafts.length,
        summaryTitles: listSnapshot.drafts.map((draft) => draft.title),
        secondDraftId: secondDraft.id,
      };
    } finally {
      await cleanup();
    }
  },

  async courseOutputLanguage() {
    const { cleanup, store } = await createHarness();
    try {
      const ownerId = 'owner-course-output-language';
      const draft = await createDraft(store, ownerId, 'Kurz ze zdroje', 'en');
      await addNotesSource(store, ownerId, draft.id, czechSourceMaterial, 'Český zdroj');
      const sourcePreferenceDraft = await updatePreparation(
        store,
        ownerId,
        draft.id,
        sourceFirstPreparation({
          audience: 'koordinátoři směn',
          desiredOutcome: 'Umí použít bezpečnostní pravidla v modelové situaci.',
          language: 'cs',
          languagePreference: 'source',
          priorKnowledge: 'Znají pracoviště, ale potřebují strukturovaný nácvik.',
          tone: 'praktický a jasný',
        }),
      );
      const sourceBlueprintDraft = await generateLearningBlueprint(store, ownerId, draft.id);
      const csPreferenceDraft = await updatePreparation(store, ownerId, draft.id, {
        ...sourceBlueprintDraft.learningBlueprint.coursePreparation,
        language: 'cs',
        languagePreference: 'cs',
      });
      const csBlueprintDraft = await generateLearningBlueprint(store, ownerId, draft.id);
      const enPreferenceDraft = await updatePreparation(store, ownerId, draft.id, {
        ...csBlueprintDraft.learningBlueprint.coursePreparation,
        language: 'en',
        languagePreference: 'en',
      });
      const enBlueprintDraft = await generateLearningBlueprint(store, ownerId, draft.id);
      return {
        blueprintLanguageAfterCs: csBlueprintDraft.learningBlueprint.coursePreparation.language,
        blueprintLanguageAfterEn: enBlueprintDraft.learningBlueprint.coursePreparation.language,
        blueprintLanguageAfterSource:
          sourceBlueprintDraft.learningBlueprint.coursePreparation.language,
        preferenceAfterCs: csPreferenceDraft.learningBlueprint.coursePreparation.languagePreference,
        preferenceAfterEn: enPreferenceDraft.learningBlueprint.coursePreparation.languagePreference,
        preferenceAfterSource:
          sourcePreferenceDraft.learningBlueprint.coursePreparation.languagePreference,
        sourceDetectedLanguage: sourcePreferenceDraft.learningBlueprint.coursePreparation.language,
      };
    } finally {
      await cleanup();
    }
  },

  async staleWarningNavigation() {
    const { cleanup, store } = await createHarness();
    try {
      const ownerId = 'owner-stale-warning-navigation';
      const draft = await buildAssistBlueprint(store, ownerId);
      const editedPreparationDraft = await updatePreparation(store, ownerId, draft.id, {
        ...draft.learningBlueprint.coursePreparation,
        audience: 'incident coordinators with a changed validation cohort',
      });
      const objectivesDraft = await goToStep(store, ownerId, draft.id, 'objectives');
      await addNotesSource(
        store,
        ownerId,
        draft.id,
        'additional source material changes coverage and should only stale existing generated artifacts',
        'Additional source',
      );
      const activityPlanDraft = await goToStep(store, ownerId, draft.id, 'activityPlan');
      const blueprint = blueprintFor(activityPlanDraft);
      return {
        blockingFindingCount: openBlockingFindingCount(activityPlanDraft),
        openWarningCount: openWarningCount(activityPlanDraft),
        staleActivityBriefCount: blueprint.activityBriefs.filter(
          (brief) => brief.status === 'stale',
        ).length,
        staleObjectiveCount: blueprint.objectives.filter(
          (objective) => objective.status === 'stale',
        ).length,
        stepAfterPreparationEdit: objectivesDraft.step,
        stepAfterSourceEdit: activityPlanDraft.step,
        updatedAudience: editedPreparationDraft.learningBlueprint.coursePreparation.audience,
      };
    } finally {
      await cleanup();
    }
  },
};

const scenarioName = process.argv.at(2);

if (!scenarioName || !Object.hasOwn(scenarios, scenarioName)) {
  throw new Error(`Unknown workflow scenario: ${scenarioName ?? '<missing>'}`);
}

const main = async () => {
  try {
    const result = await scenarios[scenarioName]();
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  }
};

void main();
