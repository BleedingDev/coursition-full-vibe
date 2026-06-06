/* eslint-disable node/global-require, sort-keys */
const fs = require('node:fs/promises');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

const requiredDraft = (draft) => {
  if (!draft) {
    throw new Error('Expected workflow action to return a draft.');
  }
  return draft;
};

const questions = (overrides = {}) => ({
  audience: 'Operators maintaining finchless release notebooks',
  avoid: 'Avoid generic demo fixture language',
  depth: 'operational',
  outcome: 'build a zephyrwoven incident curriculum from field evidence',
  practice: 'write a varintseeding runbook review using the supplied incident notes',
  priorKnowledge: 'They understand deployments and need evidence-led teaching structure',
  strictSourceOnly: true,
  ...overrides,
});

const targetLearner = (overrides = {}) => ({
  constraints: 'Short sessions with source-backed decisions',
  currentKnowledge: 'They can read incidents but need a teachable sequence',
  desiredOutcome: 'They can apply zephyrwoven response patterns from the notes',
  motivation: 'They need repeatable training from internal evidence',
  pain: 'The source material is scattered across incident notes',
  practiceStyle: 'runbook review',
  profile: 'Incident leads responsible for varintseeding recovery drills',
  ...overrides,
});

const createHarness = async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'coursition-workflow-'));
  process.chdir(tempRoot);

  const store = require(path.join(root, 'server/coursition/store.ts'));
  const effectBff = require(path.join(root, 'api/effect/index.ts')).default;
  const coursitionEffectHandler = effectBff.createHandler();

  const cleanup = async () => {
    await coursitionEffectHandler.dispose();
    process.chdir(root);
    await fs.rm(tempRoot, { force: true, recursive: true });
  };

  return { cleanup, coursitionEffectHandler, store };
};

const createDraft = async (store, ownerId, title) => {
  const snapshot = await store.applyWorkflowAction(ownerId, {
    action: 'createDraft',
    language: 'en',
    title,
  });
  return requiredDraft(snapshot.draft);
};

const addNotesSource = async (store, ownerId, draftId, name, content) => {
  const snapshot = await store.applyWorkflowAction(ownerId, {
    action: 'addSource',
    draftId,
    source: {
      content,
      name,
      type: 'notes',
    },
  });
  return requiredDraft(snapshot.draft);
};

const addProviderClassificationSources = async (store, draftId) => {
  const documentSnapshot = await store.applyWorkflowAction('owner-source-lifecycle', {
    action: 'addSource',
    draftId,
    source: {
      content: `data:application/pdf;base64,${Buffer.from('%PDF-1.4 source fixture').toString(
        'base64',
      )}`,
      name: 'Provider document.pdf',
      sizeLabel: '1 KB',
      type: 'file',
    },
  });
  const documentDraft = requiredDraft(documentSnapshot.draft);
  const providerDocument = documentDraft.sources.find(
    (source) => source.name === 'Provider document.pdf',
  );

  const audioSnapshot = await store.applyWorkflowAction('owner-source-lifecycle', {
    action: 'addSource',
    draftId,
    source: {
      content: `data:audio/mpeg;base64,${Buffer.from('audio fixture').toString('base64')}`,
      name: 'Provider narration.mp3',
      sizeLabel: '1 KB',
      type: 'file',
    },
  });
  const audioDraft = requiredDraft(audioSnapshot.draft);
  const providerAudio = audioDraft.sources.find(
    (source) => source.name === 'Provider narration.mp3',
  );

  const unknownSnapshot = await store.applyWorkflowAction('owner-source-lifecycle', {
    action: 'addSource',
    draftId,
    source: {
      content: `data:application/octet-stream;base64,${Buffer.from('unknown').toString('base64')}`,
      name: 'Unknown binary.bin',
      sizeLabel: '1 KB',
      type: 'file',
    },
  });
  const unknownDraft = requiredDraft(unknownSnapshot.draft);

  return {
    providerAudio,
    providerDocument,
    unknownFile: unknownDraft.sources.find((source) => source.name === 'Unknown binary.bin'),
  };
};

const addBaseLifecycleSources = async (store, draftId, sourceUrl) => {
  const urlSnapshot = await store.applyWorkflowAction('owner-source-lifecycle', {
    action: 'addSource',
    draftId,
    source: {
      content: sourceUrl,
      name: 'Source page',
      type: 'url',
    },
  });
  const urlDraft = requiredDraft(urlSnapshot.draft);
  const urlSource = urlDraft.sources.find((source) => source.name === 'Source page');

  await store.applyWorkflowAction('owner-source-lifecycle', {
    action: 'addSource',
    draftId,
    source: {
      content: 'phantompacket phantompacket phantompacket should disappear after delete',
      name: 'Deleted notes',
      type: 'notes',
    },
  });
  const unsupportedSnapshot = await store.applyWorkflowAction('owner-source-lifecycle', {
    action: 'addSource',
    draftId,
    source: {
      content: '',
      name: 'Narration audio.mp3',
      sizeLabel: '8 KB',
      type: 'file',
    },
  });
  const unsupportedDraft = requiredDraft(unsupportedSnapshot.draft);
  const unsupportedSource = unsupportedDraft.sources.find(
    (source) => source.name === 'Narration audio.mp3',
  );
  const deletedSource = unsupportedDraft.sources.find((source) => source.name === 'Deleted notes');

  if (!unsupportedSource || !deletedSource) {
    throw new Error('Expected source lifecycle setup sources.');
  }

  const retrySnapshot = await store.applyWorkflowAction('owner-source-lifecycle', {
    action: 'retrySource',
    draftId,
    sourceId: unsupportedSource.id,
  });
  const retryDraft = requiredDraft(retrySnapshot.draft);

  return {
    deletedSource,
    retrySource: retryDraft.sources.find((source) => source.id === unsupportedSource.id),
    unsupportedSource,
    urlSource,
  };
};

/* eslint-disable promise/avoid-new, promise/no-multiple-resolved, promise/param-names, promise/prefer-await-to-callbacks */
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
          response.end(JSON.stringify({ error: 'firecrawl unavailable in fallback fixture' }));
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
                    '# Meaningful quasarwoven material\n\n- evidenceflow source lifecycle teaching material\n- structured Markdown from Tavily',
                  url: 'https://example.com/noisy-source-page',
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
                  text: '# Exa should not run after Tavily succeeds',
                  url: 'https://example.com/noisy-source-page',
                },
              ],
            }),
          );
        });
        return;
      }
      if (request.method === 'GET' && request.url === '/requests') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify(requests));
        return;
      }
      response.writeHead(404, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'not found' }));
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Expected local web extraction mock server port.'));
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
/* eslint-enable promise/avoid-new, promise/no-multiple-resolved, promise/param-names, promise/prefer-await-to-callbacks */

const buildWorkflowDraft = async (store, ownerId) => {
  const draft = await createDraft(store, ownerId, 'Zephyrwoven source curriculum');

  await store.applyWorkflowAction(ownerId, {
    action: 'addSource',
    draftId: draft.id,
    source: {
      content:
        'varintseeding varintseeding varintseeding zephyrwoven zephyrwoven lodestarframes evidence mapping for incident drills',
      name: 'Incident field notes',
      type: 'notes',
    },
  });
  await store.applyWorkflowAction(ownerId, {
    action: 'saveQuestions',
    draftId: draft.id,
    questions: questions(),
  });
  const topicSnapshot = await store.applyWorkflowAction(ownerId, {
    action: 'generateTopics',
    draftId: draft.id,
  });
  const topicDraft = requiredDraft(topicSnapshot.draft);
  const sourceTopic =
    topicDraft.topics.find((topic) => topic.name.toLowerCase().includes('varintseeding')) ??
    topicDraft.topics.find((topic) => topic.sourceSupport === 'source_backed') ??
    topicDraft.topics[0];

  if (!sourceTopic) {
    throw new Error('Expected source-derived AI topic.');
  }

  await store.applyWorkflowAction(ownerId, {
    action: 'confirmTarget',
    draftId: draft.id,
    targetLearner: targetLearner(),
  });
  await store.applyWorkflowAction(ownerId, {
    action: 'generateChapters',
    draftId: draft.id,
  });
  await store.applyWorkflowAction(ownerId, {
    action: 'confirmChapters',
    draftId: draft.id,
  });

  const lessonSnapshot = await store.applyWorkflowAction(ownerId, {
    action: 'generateLessons',
    draftId: draft.id,
  });
  return requiredDraft(lessonSnapshot.draft);
};

const markSourceAsProcessing = async (draftId, sourceId) => {
  const storePath = path.join(process.cwd(), '.coursition-data/workflow.json');
  const storeFile = JSON.parse(await fs.readFile(storePath, 'utf-8'));
  storeFile.drafts = storeFile.drafts.map((draft) =>
    draft.id === draftId
      ? {
          ...draft,
          derivedSourceDocuments: draft.derivedSourceDocuments.filter(
            (document) => document.sourceAssetId !== sourceId,
          ),
          knowledgeChunks: draft.knowledgeChunks.filter(
            (chunk) => chunk.sourceAssetId !== sourceId,
          ),
          sourceProcessingIncomplete: true,
          sources: draft.sources.map((source) =>
            source.id === sourceId
              ? {
                  ...source,
                  content: '',
                  processor: 'llamaparse_document',
                  status: 'processing',
                }
              : source,
          ),
        }
      : draft,
  );
  await fs.writeFile(storePath, JSON.stringify(storeFile, null, 2));
};

const updateDraftInStore = async (draftId, updateDraft) => {
  const storePath = path.join(process.cwd(), '.coursition-data/workflow.json');
  const storeFile = JSON.parse(await fs.readFile(storePath, 'utf-8'));
  storeFile.drafts = storeFile.drafts.map((draft) =>
    draft.id === draftId ? updateDraft(draft) : draft,
  );
  await fs.writeFile(storePath, JSON.stringify(storeFile, null, 2));
};

const scenarios = {
  async derived() {
    const { cleanup, store } = await createHarness();
    try {
      const draft = await buildWorkflowDraft(store, 'owner-derived-output');
      const explanationBlock = draft.chapters[0]?.lessons[0]?.blocks.find(
        (block) => block.type === 'explanation',
      );
      const practiceBlock = draft.chapters[0]?.lessons[0]?.blocks.find(
        (block) => block.type === 'exercise',
      );

      return {
        courseTopicName: draft.topics[0]?.name,
        courseTopicSupport: draft.topics[0]?.sourceSupport,
        chapterTitles: draft.chapters.map((chapter) => chapter.title),
        explanationBody: explanationBlock?.body,
        explanationProvenance: explanationBlock?.provenance,
        explanationReferenceCount: explanationBlock?.sourceReferences?.length ?? 0,
        explanationReferenceSourceId: explanationBlock?.sourceReferences?.[0]?.sourceAssetId,
        firstKnowledgeChunkSourceId: draft.knowledgeChunks[0]?.sourceAssetId,
        lessonGenerationRunStatus: draft.aiRuns.find((run) => run.type === 'lesson_generation')
          ?.status,
        practiceBody: practiceBlock?.body,
        topicGenerationRunStatus: draft.aiRuns.find((run) => run.type === 'topic_generation')
          ?.status,
        topicNames: draft.topics.map((topic) => topic.name),
      };
    } finally {
      await cleanup();
    }
  },

  async strictSourceOnlyGap() {
    const { cleanup, store } = await createHarness();
    try {
      const draft = await createDraft(
        store,
        'owner-strict-source-only-gap',
        'Strict source gap course',
      );
      await store.applyWorkflowAction('owner-strict-source-only-gap', {
        action: 'saveQuestions',
        draftId: draft.id,
        questions: questions({
          outcome: 'teach source-only evidence review',
          practice: 'write a source evidence checklist',
          strictSourceOnly: true,
        }),
      });
      const topicSnapshot = await store.applyWorkflowAction('owner-strict-source-only-gap', {
        action: 'generateTopics',
        draftId: draft.id,
      });
      const topicDraft = requiredDraft(topicSnapshot.draft);
      const [topic] = topicDraft.topics;
      if (!topic) {
        throw new Error('Expected topic for strict source-only gap.');
      }
      await store.applyWorkflowAction('owner-strict-source-only-gap', {
        action: 'confirmTarget',
        draftId: draft.id,
        targetLearner: targetLearner(),
      });
      await store.applyWorkflowAction('owner-strict-source-only-gap', {
        action: 'generateChapters',
        draftId: draft.id,
      });
      let blockedConfirmError = '';
      try {
        await store.applyWorkflowAction('owner-strict-source-only-gap', {
          action: 'confirmChapters',
          draftId: draft.id,
        });
      } catch (error) {
        blockedConfirmError = error instanceof Error ? error.message : String(error);
      }
      const blockedSnapshot = await store.snapshotFor('owner-strict-source-only-gap');
      const blockedDraft = requiredDraft(blockedSnapshot.draft);

      return {
        blockedConfirmError,
        lessonGenerationRunCount: blockedDraft.aiRuns.filter(
          (run) => run.type === 'lesson_generation',
        ).length,
        sourceFindingSeverity: blockedDraft.findings.find(
          (finding) => finding.targetType === 'course' && finding.step === 'knowledge',
        )?.severity,
        step: blockedDraft.step,
        unsupportedClaimFindingCount: blockedDraft.findings.filter((finding) =>
          finding.id.endsWith('_unsupported_claim'),
        ).length,
      };
    } finally {
      await cleanup();
    }
  },

  async continueWithProcessingSourceWarning() {
    const { cleanup, store } = await createHarness();
    try {
      const draft = await createDraft(
        store,
        'owner-continue-processing-source',
        'Processing source warning course',
      );
      const sourceSnapshot = await store.applyWorkflowAction('owner-continue-processing-source', {
        action: 'addSource',
        draftId: draft.id,
        source: {
          content:
            'processing pending evidence source for async document extraction and course planning',
          name: 'Queued document.pdf',
          type: 'notes',
        },
      });
      const sourceDraft = requiredDraft(sourceSnapshot.draft);
      const source = sourceDraft.sources.find(
        (candidate) => candidate.name === 'Queued document.pdf',
      );
      if (!source) {
        throw new Error('Expected source to mark as processing.');
      }
      await markSourceAsProcessing(draft.id, source.id);
      await store.applyWorkflowAction('owner-continue-processing-source', {
        action: 'saveQuestions',
        draftId: draft.id,
        questions: questions({
          outcome: 'create a course while source extraction is still running',
          practice: 'write the incomplete-source review note before publishing',
          strictSourceOnly: false,
        }),
      });
      const topicSnapshot = await store.applyWorkflowAction('owner-continue-processing-source', {
        action: 'generateTopics',
        draftId: draft.id,
      });
      const topicDraft = requiredDraft(topicSnapshot.draft);
      const [topic] = topicDraft.topics;
      if (!topic) {
        throw new Error('Expected topic for processing-source warning.');
      }
      await store.applyWorkflowAction('owner-continue-processing-source', {
        action: 'confirmTarget',
        draftId: draft.id,
        targetLearner: targetLearner({
          desiredOutcome: 'They can continue planning while extraction finishes',
          profile: 'Course creators handling long document parsing jobs',
        }),
      });
      await store.applyWorkflowAction('owner-continue-processing-source', {
        action: 'generateChapters',
        draftId: draft.id,
      });
      let blockedConfirmError = '';
      try {
        await store.applyWorkflowAction('owner-continue-processing-source', {
          action: 'confirmChapters',
          draftId: draft.id,
        });
      } catch (error) {
        blockedConfirmError = error instanceof Error ? error.message : String(error);
      }
      const blockedSnapshot = await store.snapshotFor('owner-continue-processing-source');
      const blockedDraft = requiredDraft(blockedSnapshot.draft);
      const processingSource = blockedDraft.sources.find((candidate) => candidate.id === source.id);
      const sourceFinding = blockedDraft.findings.find(
        (finding) => finding.id === `finding_${draft.id}_sources`,
      );

      return {
        blockedConfirmError,
        derivedDocumentCount: blockedDraft.derivedSourceDocuments.length,
        knowledgeChunkCount: blockedDraft.knowledgeChunks.length,
        lessonGenerationRunCount: blockedDraft.aiRuns.filter(
          (run) => run.type === 'lesson_generation',
        ).length,
        sourceFindingDetail: sourceFinding?.detail,
        sourceFindingSeverity: sourceFinding?.severity,
        sourceFindingStatus: sourceFinding?.status,
        sourceFindingStep: sourceFinding?.step,
        sourceFindingTitle: sourceFinding?.title,
        sourceProcessingIncomplete: blockedDraft.sourceProcessingIncomplete,
        sourceStatus: processingSource?.status,
        step: blockedDraft.step,
      };
    } finally {
      await cleanup();
    }
  },

  async unsupportedClaimFinding() {
    const { cleanup, store } = await createHarness();
    try {
      const draft = await createDraft(
        store,
        'owner-unsupported-claim-finding',
        'Unsupported claim review course',
      );
      await addNotesSource(
        store,
        'owner-unsupported-claim-finding',
        draft.id,
        'Unsupported claim evidence',
        'unsupported claim review evidence for course planning and source validation',
      );
      await store.applyWorkflowAction('owner-unsupported-claim-finding', {
        action: 'saveQuestions',
        draftId: draft.id,
        questions: questions({
          outcome: 'teach unsupported claim review',
          practice: 'write a source evidence correction',
          strictSourceOnly: false,
        }),
      });
      await store.applyWorkflowAction('owner-unsupported-claim-finding', {
        action: 'confirmTarget',
        draftId: draft.id,
        targetLearner: targetLearner({
          desiredOutcome: 'They can identify and correct unsupported AI claims',
          profile: 'Course creators reviewing generated lessons for source support',
        }),
      });
      await store.applyWorkflowAction('owner-unsupported-claim-finding', {
        action: 'addChapter',
        description: 'Review a generated claim without source backing.',
        draftId: draft.id,
        outcome: 'Learners can spot unsupported generated claims.',
        title: 'Unsupported claim review',
      });
      await store.applyWorkflowAction('owner-unsupported-claim-finding', {
        action: 'confirmChapters',
        draftId: draft.id,
      });
      const lessonSnapshot = await store.applyWorkflowAction('owner-unsupported-claim-finding', {
        action: 'generateLessons',
        draftId: draft.id,
      });
      const lessonDraft = requiredDraft(lessonSnapshot.draft);
      const lesson = lessonDraft.chapters[0]?.lessons[0];
      const explanationBlock = lesson?.blocks.find((block) => block.type === 'explanation');
      if (!lesson || !explanationBlock) {
        throw new Error('Expected generated lesson explanation block.');
      }
      await updateDraftInStore(draft.id, (storedDraft) => ({
        ...storedDraft,
        chapters: storedDraft.chapters.map((chapter) => ({
          ...chapter,
          lessons: chapter.lessons.map((candidateLesson) => ({
            ...candidateLesson,
            blocks: candidateLesson.blocks.map((block) =>
              block.id === explanationBlock.id
                ? {
                    ...block,
                    provenance: 'AI-inferred',
                    sourceReferences: [],
                  }
                : block,
            ),
          })),
        })),
      }));
      const previewSnapshot = await store.applyWorkflowAction('owner-unsupported-claim-finding', {
        action: 'openPreview',
        draftId: draft.id,
      });
      const previewDraft = requiredDraft(previewSnapshot.draft);
      const previewLesson = previewDraft.chapters[0]?.lessons[0];
      const previewExplanationBlock = previewLesson?.blocks.find(
        (block) => block.id === explanationBlock.id,
      );
      const unsupportedFinding =
        lessonDraft.findings.find(
          (finding) => finding.id === `finding_${explanationBlock.id}_unsupported_claim`,
        ) ??
        previewDraft.findings.find(
          (finding) => finding.id === `finding_${explanationBlock.id}_unsupported_claim`,
        );
      if (!unsupportedFinding || !previewExplanationBlock) {
        throw new Error('Expected unsupported claim finding.');
      }

      await store.applyWorkflowAction('owner-unsupported-claim-finding', {
        action: 'updateBlock',
        blockId: explanationBlock.id,
        body: 'Manual source gap note: add verified evidence before publishing this explanation.',
        draftId: draft.id,
        title: 'Manual source gap',
      });
      const resolvedSnapshot = await store.applyWorkflowAction('owner-unsupported-claim-finding', {
        action: 'openPreview',
        draftId: draft.id,
      });
      const resolvedDraft = requiredDraft(resolvedSnapshot.draft);

      return {
        detail: unsupportedFinding.detail,
        explanationProvenance: previewExplanationBlock.provenance,
        explanationReferenceCount: previewExplanationBlock.sourceReferences?.length ?? 0,
        resolvedUnsupportedFindingCount: resolvedDraft.findings.filter(
          (finding) => finding.id === unsupportedFinding.id,
        ).length,
        severity: unsupportedFinding.severity,
        step: unsupportedFinding.step,
        targetId: unsupportedFinding.targetId,
        targetType: unsupportedFinding.targetType,
        title: unsupportedFinding.title,
      };
    } finally {
      await cleanup();
    }
  },

  async topicReviewGate() {
    const { cleanup, store } = await createHarness();
    try {
      const draft = await createDraft(store, 'owner-topic-review-gate', 'Topic review gate');
      await store.applyWorkflowAction('owner-topic-review-gate', {
        action: 'addSource',
        draftId: draft.id,
        source: {
          content: 'latticecheck latticecheck latticecheck reviewable topic source material',
          name: 'Review notes',
          type: 'notes',
        },
      });
      await store.applyWorkflowAction('owner-topic-review-gate', {
        action: 'saveQuestions',
        draftId: draft.id,
        questions: questions({
          outcome: 'teach reviewable topic application',
        }),
      });
      const generatedSnapshot = await store.applyWorkflowAction('owner-topic-review-gate', {
        action: 'generateTopics',
        draftId: draft.id,
      });
      const generatedDraft = requiredDraft(generatedSnapshot.draft);
      const [topic] = generatedDraft.topics;
      if (!topic) {
        throw new Error('Expected generated review topic.');
      }
      return {
        generatedStatus: generatedDraft.aiRuns.find((run) => run.type === 'topic_generation')
          ?.status,
        topicCount: generatedDraft.topics.length,
      };
    } finally {
      await cleanup();
    }
  },

  async preserveManualTopicEdits() {
    const { cleanup, store } = await createHarness();
    try {
      const draft = await createDraft(
        store,
        'owner-preserve-manual-topic-edits',
        'Preserve topic edits course',
      );
      await store.applyWorkflowAction('owner-preserve-manual-topic-edits', {
        action: 'addSource',
        draftId: draft.id,
        source: {
          content:
            'topic preservation source evidence topic preservation source evidence planning stable manual intent',
          name: 'Topic preservation evidence',
          type: 'notes',
        },
      });
      await store.applyWorkflowAction('owner-preserve-manual-topic-edits', {
        action: 'saveQuestions',
        draftId: draft.id,
        questions: questions({
          outcome: 'teach topic edit preservation',
          practice: 'review a regenerated topic map',
        }),
      });
      const generatedSnapshot = await store.applyWorkflowAction(
        'owner-preserve-manual-topic-edits',
        {
          action: 'generateTopics',
          draftId: draft.id,
        },
      );
      const [generatedTopic] = requiredDraft(generatedSnapshot.draft).topics;
      if (!generatedTopic) {
        throw new Error('Expected generated topic for topic preservation.');
      }
      await store.applyWorkflowAction('owner-preserve-manual-topic-edits', {
        action: 'updateTopic',
        description: 'Manual edited topic description must survive AI regeneration.',
        draftId: draft.id,
        name: 'Manual edited topic',
        topicId: generatedTopic.id,
      });
      const manualTopicSnapshot = await store.applyWorkflowAction(
        'owner-preserve-manual-topic-edits',
        {
          action: 'addTopic',
          description: 'A manually inserted topic must stay in the topic map.',
          draftId: draft.id,
          name: 'Manual inserted topic',
        },
      );
      const manualTopic = requiredDraft(manualTopicSnapshot.draft).topics.find((topic) =>
        topic.name.includes('Manual inserted topic'),
      );
      if (!manualTopic) {
        throw new Error('Expected manual topic before regeneration.');
      }

      const regeneratedSnapshot = await store.applyWorkflowAction(
        'owner-preserve-manual-topic-edits',
        {
          action: 'generateTopics',
          draftId: draft.id,
        },
      );
      const regeneratedDraft = requiredDraft(regeneratedSnapshot.draft);
      const preservedGeneratedTopic = regeneratedDraft.topics.find(
        (topic) => topic.id === generatedTopic.id,
      );
      const preservedManualTopic = regeneratedDraft.topics.find(
        (topic) => topic.id === manualTopic.id,
      );
      const topicRuns = regeneratedDraft.aiRuns.filter((run) => run.type === 'topic_generation');

      return {
        generatedTopicId: generatedTopic.id,
        manualTopicId: manualTopic.id,
        preservedGeneratedDescription: preservedGeneratedTopic?.description,
        preservedGeneratedName: preservedGeneratedTopic?.name,
        preservedManualName: preservedManualTopic?.name,
        regeneratedRunStatus: topicRuns.at(-1)?.status,
        step: regeneratedDraft.step,
        topicCount: regeneratedDraft.topics.length,
      };
    } finally {
      await cleanup();
    }
  },

  async manualProvenance() {
    const { cleanup, store } = await createHarness();
    try {
      const draft = await buildWorkflowDraft(store, 'owner-manual-provenance');
      const block =
        draft.chapters[0]?.lessons[0]?.blocks.find((candidate) => candidate.type === 'summary') ??
        draft.chapters[0]?.lessons[0]?.blocks[0];

      if (!block) {
        throw new Error('Expected generated lesson block.');
      }

      const updatedSnapshot = await store.applyWorkflowAction('owner-manual-provenance', {
        action: 'updateBlock',
        blockId: block.id,
        body: 'Manual instructor note for the varintseeding handoff.',
        draftId: draft.id,
        title: 'Instructor handoff',
      });
      const updatedDraft = requiredDraft(updatedSnapshot.draft);
      const previewSnapshot = await store.applyWorkflowAction('owner-manual-provenance', {
        action: 'openPreview',
        draftId: draft.id,
      });
      const previewDraft = requiredDraft(previewSnapshot.draft);
      const updatedBlock = previewDraft.chapters[0]?.lessons[0]?.blocks.find(
        (candidate) => candidate.id === block.id,
      );

      return {
        body: updatedBlock?.body,
        provenance: updatedBlock?.provenance,
        sourceReferenceCount: updatedBlock?.sourceReferences?.length ?? 0,
        saveStep: updatedDraft.step,
        step: previewDraft.step,
        title: updatedBlock?.title,
      };
    } finally {
      await cleanup();
    }
  },

  // eslint-disable-next-line complexity
  async builderControls() {
    const { cleanup, store } = await createHarness();
    try {
      const draft = await createDraft(store, 'owner-builder-controls', 'Creator-built course');
      await store.applyWorkflowAction('owner-builder-controls', {
        action: 'saveQuestions',
        draftId: draft.id,
        questions: questions({
          outcome: 'teach manual course builders to preserve edited content',
          practice: 'edit topics, chapters, lessons, and blocks before preview',
        }),
      });
      const topicSnapshot = await store.applyWorkflowAction('owner-builder-controls', {
        action: 'addTopic',
        description: 'Teach source-backed handoff review.',
        draftId: draft.id,
        name: 'Handoff review',
      });
      const topicDraft = requiredDraft(topicSnapshot.draft);
      const [topic] = topicDraft.topics;

      if (!topic) {
        throw new Error('Expected manual topic.');
      }

      await store.applyWorkflowAction('owner-builder-controls', {
        action: 'updateTopic',
        description: 'Teach durable handoff review.',
        draftId: draft.id,
        name: 'Durable handoff review',
        topicId: topic.id,
      });
      await store.applyWorkflowAction('owner-builder-controls', {
        action: 'confirmTarget',
        draftId: draft.id,
        targetLearner: targetLearner({
          desiredOutcome: 'They can complete manual builder edits before preview.',
          profile: 'Course creators building a course manually',
        }),
      });
      const firstChapterSnapshot = await store.applyWorkflowAction('owner-builder-controls', {
        action: 'addChapter',
        description: 'Start with review context.',
        draftId: draft.id,
        outcome: 'Learners can inspect a handoff.',
        title: 'Review context',
      });
      const firstChapterDraft = requiredDraft(firstChapterSnapshot.draft);
      const [firstChapter] = firstChapterDraft.chapters;

      const secondChapterSnapshot = await store.applyWorkflowAction('owner-builder-controls', {
        action: 'addChapter',
        description: 'Apply the review.',
        draftId: draft.id,
        outcome: 'Learners can complete a handoff review.',
        title: 'Review practice',
      });
      const secondChapterDraft = requiredDraft(secondChapterSnapshot.draft);
      const secondChapter = secondChapterDraft.chapters.find((chapter) =>
        chapter.title.includes('Review practice'),
      );

      if (!firstChapter || !secondChapter) {
        throw new Error('Expected manual chapters.');
      }

      const movedSnapshot = await store.applyWorkflowAction('owner-builder-controls', {
        action: 'moveChapter',
        chapterId: secondChapter.id,
        direction: 'up',
        draftId: draft.id,
      });
      const movedDraft = requiredDraft(movedSnapshot.draft);
      const [activeChapter] = movedDraft.chapters;

      if (!activeChapter) {
        throw new Error('Expected reordered chapter.');
      }

      const lessonSnapshot = await store.applyWorkflowAction('owner-builder-controls', {
        action: 'addLesson',
        chapterId: activeChapter.id,
        draftId: draft.id,
        title: 'Manual review lesson',
      });
      const lessonDraft = requiredDraft(lessonSnapshot.draft);
      const firstLesson = lessonDraft.chapters[0]?.lessons[0];

      if (!firstLesson) {
        throw new Error('Expected manual lesson.');
      }

      const secondLessonSnapshot = await store.applyWorkflowAction('owner-builder-controls', {
        action: 'addLesson',
        chapterId: activeChapter.id,
        draftId: draft.id,
        title: 'Second review lesson',
      });
      const secondLessonDraft = requiredDraft(secondLessonSnapshot.draft);
      const secondLesson = secondLessonDraft.chapters[0]?.lessons.find((candidate) =>
        candidate.title.includes('Second review lesson'),
      );

      if (!secondLesson) {
        throw new Error('Expected second manual lesson.');
      }

      await store.applyWorkflowAction('owner-builder-controls', {
        action: 'moveLesson',
        direction: 'up',
        draftId: draft.id,
        lessonId: secondLesson.id,
      });
      const editedLessonSnapshot = await store.applyWorkflowAction('owner-builder-controls', {
        action: 'updateLesson',
        draftId: draft.id,
        durationMinutes: 17,
        lessonId: secondLesson.id,
        title: 'Edited review lesson',
      });
      const editedLessonDraft = requiredDraft(editedLessonSnapshot.draft);
      const activeLesson = editedLessonDraft.chapters[0]?.lessons[0];

      if (!activeLesson) {
        throw new Error('Expected reordered edited lesson.');
      }

      const blockSnapshot = await store.applyWorkflowAction('owner-builder-controls', {
        action: 'addBlock',
        blockType: 'summary',
        body: 'Manual summary survives preview.',
        draftId: draft.id,
        lessonId: activeLesson.id,
        title: 'Manual summary',
      });
      const blockDraft = requiredDraft(blockSnapshot.draft);
      const block = blockDraft.chapters[0]?.lessons[0]?.blocks[0];

      if (!block) {
        throw new Error('Expected manual block.');
      }

      const exerciseSnapshot = await store.applyWorkflowAction('owner-builder-controls', {
        action: 'addBlock',
        blockType: 'exercise',
        body: 'Draft exercise before editing.',
        draftId: draft.id,
        lessonId: activeLesson.id,
        title: 'Draft exercise',
      });
      const exerciseDraft = requiredDraft(exerciseSnapshot.draft);
      const exerciseBlock = exerciseDraft.chapters[0]?.lessons[0]?.blocks.find(
        (candidate) => candidate.type === 'exercise',
      );

      if (!exerciseBlock) {
        throw new Error('Expected exercise block.');
      }

      await store.applyWorkflowAction('owner-builder-controls', {
        action: 'moveBlock',
        blockId: exerciseBlock.id,
        direction: 'up',
        draftId: draft.id,
      });
      await store.applyWorkflowAction('owner-builder-controls', {
        action: 'updateBlock',
        blockId: exerciseBlock.id,
        body: 'Edited practical exercise survives preview.',
        draftId: draft.id,
        title: 'Edited exercise',
      });
      await store.applyWorkflowAction('owner-builder-controls', {
        action: 'deleteBlock',
        blockId: block.id,
        draftId: draft.id,
      });
      const previewSnapshot = await store.applyWorkflowAction('owner-builder-controls', {
        action: 'openPreview',
        draftId: draft.id,
      });
      const previewDraft = requiredDraft(previewSnapshot.draft);
      const previewLesson = previewDraft.chapters[0]?.lessons[0];
      const previewBlock = previewLesson?.blocks[0];

      return {
        courseTopicName: previewDraft.topics[0]?.name,
        blockBody: previewBlock?.body,
        blockCount: previewLesson?.blocks.length,
        blockProvenance: previewBlock?.provenance,
        blockTitle: previewBlock?.title,
        blockType: previewBlock?.type,
        firstChapterTitle: previewDraft.chapters[0]?.title,
        initialMode: draft.mode,
        initialStep: draft.step,
        lessonDuration: previewLesson?.durationMinutes,
        lessonTitle: previewLesson?.title,
        previewStep: previewDraft.step,
      };
    } finally {
      await cleanup();
    }
  },

  async reviewFindings() {
    const { cleanup, store } = await createHarness();
    try {
      const draft = await createDraft(store, 'owner-review-findings', 'Review findings course');
      await store.applyWorkflowAction('owner-review-findings', {
        action: 'saveQuestions',
        draftId: draft.id,
        questions: questions({
          outcome: 'teach review finding preservation',
          practice: 'edit an incomplete lesson and keep review status meaningful',
        }),
      });
      await store.applyWorkflowAction('owner-review-findings', {
        action: 'confirmTarget',
        draftId: draft.id,
        targetLearner: targetLearner({
          desiredOutcome: 'They can resolve lesson review findings.',
          profile: 'Course creators reviewing lesson quality',
        }),
      });
      const chapterSnapshot = await store.applyWorkflowAction('owner-review-findings', {
        action: 'addChapter',
        description: 'A chapter with incomplete lesson content.',
        draftId: draft.id,
        outcome: 'Learners can inspect review findings.',
        title: 'Finding review',
      });
      const [chapter] = requiredDraft(chapterSnapshot.draft).chapters;

      if (!chapter) {
        throw new Error('Expected review finding chapter.');
      }

      const lessonSnapshot = await store.applyWorkflowAction('owner-review-findings', {
        action: 'addLesson',
        chapterId: chapter.id,
        draftId: draft.id,
        title: 'Incomplete lesson',
      });
      const lesson = requiredDraft(lessonSnapshot.draft).chapters[0]?.lessons[0];

      if (!lesson) {
        throw new Error('Expected incomplete lesson.');
      }

      const previewSnapshot = await store.applyWorkflowAction('owner-review-findings', {
        action: 'openPreview',
        draftId: draft.id,
      });
      const previewDraft = requiredDraft(previewSnapshot.draft);
      const qualityFinding = previewDraft.findings.find(
        (finding) => finding.targetType === 'lesson',
      );

      if (!qualityFinding) {
        throw new Error('Expected lesson quality finding.');
      }

      const resolvedSnapshot = await store.applyWorkflowAction('owner-review-findings', {
        action: 'setFindingStatus',
        draftId: draft.id,
        findingId: qualityFinding.id,
        status: 'resolved',
      });
      const resolvedFinding = requiredDraft(resolvedSnapshot.draft).findings.find(
        (finding) => finding.id === qualityFinding.id,
      );
      const repeatedSnapshot = await store.applyWorkflowAction('owner-review-findings', {
        action: 'openPreview',
        draftId: draft.id,
      });
      const repeatedFinding = requiredDraft(repeatedSnapshot.draft).findings.find(
        (finding) => finding.id === qualityFinding.id,
      );

      await store.applyWorkflowAction('owner-review-findings', {
        action: 'updateLesson',
        draftId: draft.id,
        durationMinutes: 10,
        lessonId: lesson.id,
        title: 'Changed incomplete lesson',
      });
      const changedSnapshot = await store.applyWorkflowAction('owner-review-findings', {
        action: 'openPreview',
        draftId: draft.id,
      });
      const changedFinding = requiredDraft(changedSnapshot.draft).findings.find(
        (finding) => finding.id === qualityFinding.id,
      );

      return {
        changedFingerprint: changedFinding?.fingerprint,
        changedStatus: changedFinding?.status,
        initialFingerprint: qualityFinding.fingerprint,
        initialStatus: qualityFinding.status,
        repeatedFingerprint: repeatedFinding?.fingerprint,
        repeatedStatus: repeatedFinding?.status,
        resolvedStatus: resolvedFinding?.status,
        targetStep: qualityFinding.step,
        targetType: qualityFinding.targetType,
      };
    } finally {
      await cleanup();
    }
  },

  async duplicateTopicFindings() {
    const { cleanup, store } = await createHarness();
    try {
      const draft = await createDraft(
        store,
        'owner-duplicate-topic-findings',
        'Duplicate topic review course',
      );
      await store.applyWorkflowAction('owner-duplicate-topic-findings', {
        action: 'addSource',
        draftId: draft.id,
        source: {
          content: 'duplicate topic review source coverage evidence for focused course planning',
          name: 'Topic evidence',
          type: 'notes',
        },
      });
      const firstTopicSnapshot = await store.applyWorkflowAction('owner-duplicate-topic-findings', {
        action: 'addTopic',
        description: 'First coverage of a repeated planning topic.',
        draftId: draft.id,
        name: 'Source coverage',
      });
      const secondTopicSnapshot = await store.applyWorkflowAction(
        'owner-duplicate-topic-findings',
        {
          action: 'addTopic',
          description: 'Second coverage of the same planning topic.',
          draftId: draft.id,
          name: 'source coverage',
        },
      );
      const duplicateDraft = requiredDraft(secondTopicSnapshot.draft);
      const duplicateTopic = duplicateDraft.topics.find(
        (topic) => topic.name === 'source coverage',
      );
      if (!duplicateTopic) {
        throw new Error('Expected duplicate topic.');
      }

      const previewSnapshot = await store.applyWorkflowAction('owner-duplicate-topic-findings', {
        action: 'openPreview',
        draftId: draft.id,
      });
      const previewDraft = requiredDraft(previewSnapshot.draft);
      const topicFinding = previewDraft.findings.find((finding) => finding.targetType === 'topic');
      if (!topicFinding) {
        throw new Error('Expected duplicate topic finding.');
      }

      const dismissedSnapshot = await store.applyWorkflowAction('owner-duplicate-topic-findings', {
        action: 'setFindingStatus',
        draftId: draft.id,
        findingId: topicFinding.id,
        status: 'dismissed',
      });
      const dismissedFinding = requiredDraft(dismissedSnapshot.draft).findings.find(
        (finding) => finding.id === topicFinding.id,
      );
      const repeatedSnapshot = await store.applyWorkflowAction('owner-duplicate-topic-findings', {
        action: 'openPreview',
        draftId: draft.id,
      });
      const repeatedFinding = requiredDraft(repeatedSnapshot.draft).findings.find(
        (finding) => finding.id === topicFinding.id,
      );

      await store.applyWorkflowAction('owner-duplicate-topic-findings', {
        action: 'deleteTopic',
        draftId: draft.id,
        topicId: duplicateTopic.id,
      });
      const resolvedSnapshot = await store.applyWorkflowAction('owner-duplicate-topic-findings', {
        action: 'openPreview',
        draftId: draft.id,
      });
      const resolvedDraft = requiredDraft(resolvedSnapshot.draft);

      return {
        detail: topicFinding.detail,
        dismissedStatus: dismissedFinding?.status,
        firstTopicId: requiredDraft(firstTopicSnapshot.draft).topics[0]?.id,
        repeatedStatus: repeatedFinding?.status,
        resolvedTopicFindingCount: resolvedDraft.findings.filter(
          (finding) => finding.targetType === 'topic',
        ).length,
        severity: topicFinding.severity,
        step: topicFinding.step,
        targetId: topicFinding.targetId,
        targetType: topicFinding.targetType,
        title: topicFinding.title,
      };
    } finally {
      await cleanup();
    }
  },

  async unsupportedTopicSourceFinding() {
    const { cleanup, store } = await createHarness();
    try {
      const draft = await createDraft(
        store,
        'owner-unsupported-topic-source-finding',
        'Unsupported topic review course',
      );
      await store.applyWorkflowAction('owner-unsupported-topic-source-finding', {
        action: 'addSource',
        draftId: draft.id,
        source: {
          content: 'react rendering memoization profiling source evidence for course planning',
          name: 'Rendering evidence',
          type: 'notes',
        },
      });
      const topicSnapshot = await store.applyWorkflowAction(
        'owner-unsupported-topic-source-finding',
        {
          action: 'addTopic',
          description: 'Teach payment compliance decisions.',
          draftId: draft.id,
          name: 'Payment compliance',
        },
      );
      const topic = requiredDraft(topicSnapshot.draft).topics.find(
        (candidate) => candidate.name === 'Payment compliance',
      );
      if (!topic) {
        throw new Error('Expected unsupported manual topic.');
      }

      const previewSnapshot = await store.applyWorkflowAction(
        'owner-unsupported-topic-source-finding',
        {
          action: 'openPreview',
          draftId: draft.id,
        },
      );
      const previewDraft = requiredDraft(previewSnapshot.draft);
      const sourceFinding = previewDraft.findings.find(
        (finding) => finding.id === `finding_${topic.id}_source_support`,
      );
      if (!sourceFinding) {
        throw new Error('Expected unsupported topic source finding.');
      }
      const sourceFindingResolvedSnapshot = await store.applyWorkflowAction(
        'owner-unsupported-topic-source-finding',
        {
          action: 'setFindingStatus',
          draftId: draft.id,
          findingId: sourceFinding.id,
          status: 'resolved',
        },
      );
      const sourceFindingResolvedDraft = requiredDraft(sourceFindingResolvedSnapshot.draft);
      const resolvedBeforeEvidence = sourceFindingResolvedDraft.findings.find(
        (finding) => finding.id === sourceFinding.id,
      );

      await store.applyWorkflowAction('owner-unsupported-topic-source-finding', {
        action: 'addSource',
        draftId: draft.id,
        source: {
          content: 'payment compliance controls and audit trail evidence for course planning',
          name: 'Compliance evidence',
          type: 'notes',
        },
      });
      const resolvedSnapshot = await store.applyWorkflowAction(
        'owner-unsupported-topic-source-finding',
        {
          action: 'openPreview',
          draftId: draft.id,
        },
      );
      const resolvedDraft = requiredDraft(resolvedSnapshot.draft);

      return {
        detail: sourceFinding.detail,
        resolvedSourceFindingCount: resolvedDraft.findings.filter(
          (finding) => finding.id === sourceFinding.id,
        ).length,
        resolvedStatusBeforeEvidence: resolvedBeforeEvidence?.status,
        severity: sourceFinding.severity,
        step: sourceFinding.step,
        targetGateAllowed: require(
          path.join(root, 'shared/coursition/workflow.ts'),
        ).getWorkflowStepGate(previewDraft, 'target').allowed,
        targetId: sourceFinding.targetId,
        targetType: sourceFinding.targetType,
        title: sourceFinding.title,
        topicId: topic.id,
      };
    } finally {
      await cleanup();
    }
  },

  async chapterTopicCoverageFinding() {
    const { cleanup, store } = await createHarness();
    try {
      const draft = await createDraft(
        store,
        'owner-chapter-topic-coverage-finding',
        'Chapter topic coverage course',
      );
      await store.applyWorkflowAction('owner-chapter-topic-coverage-finding', {
        action: 'addSource',
        draftId: draft.id,
        source: {
          content:
            'rendering performance profiling memoization source evidence for chapter coverage planning',
          name: 'Performance evidence',
          type: 'notes',
        },
      });
      await store.applyWorkflowAction('owner-chapter-topic-coverage-finding', {
        action: 'saveQuestions',
        draftId: draft.id,
        questions: questions({
          outcome: 'teach rendering performance profiling',
          practice: 'write a performance review checklist',
        }),
      });
      await store.applyWorkflowAction('owner-chapter-topic-coverage-finding', {
        action: 'confirmTarget',
        draftId: draft.id,
        targetLearner: targetLearner({
          desiredOutcome: 'They can identify and improve rendering performance issues',
          profile: 'Frontend engineers learning performance review',
        }),
      });
      const topicSnapshot = await store.applyWorkflowAction(
        'owner-chapter-topic-coverage-finding',
        {
          action: 'addTopic',
          description:
            'Rendering performance profiling must appear in at least one chapter before preview.',
          draftId: draft.id,
          name: 'Rendering performance profiling',
        },
      );
      const topic = requiredDraft(topicSnapshot.draft).topics.find(
        (candidate) => candidate.name === 'Rendering performance profiling',
      );
      if (!topic) {
        throw new Error('Expected rendering topic.');
      }
      await store.applyWorkflowAction('owner-chapter-topic-coverage-finding', {
        action: 'addChapter',
        description: 'A chapter that does not cover the topic.',
        draftId: draft.id,
        outcome: 'Learners can prepare a generic checklist.',
        title: 'Generic checklist',
      });
      let blockedConfirmError = '';
      try {
        await store.applyWorkflowAction('owner-chapter-topic-coverage-finding', {
          action: 'confirmChapters',
          draftId: draft.id,
        });
      } catch (error) {
        blockedConfirmError = error instanceof Error ? error.message : String(error);
      }

      const previewSnapshot = await store.applyWorkflowAction(
        'owner-chapter-topic-coverage-finding',
        {
          action: 'openPreview',
          draftId: draft.id,
        },
      );
      const previewDraft = requiredDraft(previewSnapshot.draft);
      const coverageFinding = previewDraft.findings.find(
        (finding) => finding.id === `finding_${topic.id}_chapter_coverage`,
      );
      if (!coverageFinding) {
        throw new Error('Expected topic chapter coverage finding.');
      }

      const generatedSnapshot = await store.applyWorkflowAction(
        'owner-chapter-topic-coverage-finding',
        {
          action: 'generateChapters',
          draftId: draft.id,
        },
      );
      const generatedDraft = requiredDraft(generatedSnapshot.draft);
      const resolvedSnapshot = await store.applyWorkflowAction(
        'owner-chapter-topic-coverage-finding',
        {
          action: 'openPreview',
          draftId: draft.id,
        },
      );
      const resolvedDraft = requiredDraft(resolvedSnapshot.draft);

      return {
        blockedConfirmError,
        coveredTopicIds: generatedDraft.chapters.flatMap((chapter) => chapter.coveredTopicIds),
        detail: coverageFinding.detail,
        generatedChapterRunStatus: generatedDraft.aiRuns.find(
          (run) => run.type === 'chapter_generation',
        )?.status,
        resolvedCoverageFindingCount: resolvedDraft.findings.filter(
          (finding) => finding.id === coverageFinding.id,
        ).length,
        severity: coverageFinding.severity,
        step: coverageFinding.step,
        targetId: coverageFinding.targetId,
        targetType: coverageFinding.targetType,
        title: coverageFinding.title,
        topicId: topic.id,
        topicName: topic.name,
      };
    } finally {
      await cleanup();
    }
  },

  async chapterGenerationRequiresSelectedTopic() {
    const { cleanup, store } = await createHarness();
    try {
      const draft = await createDraft(
        store,
        'owner-chapter-generation-topic-required',
        'Chapter topic gate course',
      );
      await store.applyWorkflowAction('owner-chapter-generation-topic-required', {
        action: 'addSource',
        draftId: draft.id,
        source: {
          content: 'sourcebacked planning review sourcebacked planning review chapter topic gate',
          name: 'Topic gate notes',
          type: 'notes',
        },
      });
      await store.applyWorkflowAction('owner-chapter-generation-topic-required', {
        action: 'saveQuestions',
        draftId: draft.id,
        questions: questions({
          outcome: 'teach sourcebacked planning',
          practice: 'create a chapter plan',
        }),
      });
      await store.applyWorkflowAction('owner-chapter-generation-topic-required', {
        action: 'confirmTarget',
        draftId: draft.id,
        targetLearner: targetLearner({
          desiredOutcome: 'They can create a reviewed chapter plan',
          profile: 'Course creators reviewing generated topics',
        }),
      });
      const topicSnapshot = await store.applyWorkflowAction(
        'owner-chapter-generation-topic-required',
        {
          action: 'generateTopics',
          draftId: draft.id,
        },
      );
      for (const topic of requiredDraft(topicSnapshot.draft).topics) {
        await store.applyWorkflowAction('owner-chapter-generation-topic-required', {
          action: 'deleteTopic',
          draftId: draft.id,
          topicId: topic.id,
        });
      }

      let blockedError = '';
      try {
        await store.applyWorkflowAction('owner-chapter-generation-topic-required', {
          action: 'generateChapters',
          draftId: draft.id,
        });
      } catch (error) {
        blockedError = error instanceof Error ? error.message : String(error);
      }
      const blockedSnapshot = await store.snapshotFor('owner-chapter-generation-topic-required');
      const blockedDraft = requiredDraft(blockedSnapshot.draft);

      const retryTopicSnapshot = await store.applyWorkflowAction(
        'owner-chapter-generation-topic-required',
        {
          action: 'generateTopics',
          draftId: draft.id,
        },
      );
      const [retryTopic] = requiredDraft(retryTopicSnapshot.draft).topics;
      if (!retryTopic) {
        throw new Error('Expected topic for chapter gate retry.');
      }
      const retrySnapshot = await store.applyWorkflowAction(
        'owner-chapter-generation-topic-required',
        {
          action: 'generateChapters',
          draftId: draft.id,
        },
      );
      const retryDraft = requiredDraft(retrySnapshot.draft);
      const latestChapterRun = retryDraft.aiRuns
        .toReversed()
        .find((run) => run.type === 'chapter_generation');

      return {
        blockedChapterCount: blockedDraft.chapters.length,
        blockedError,
        blockedRunCount: blockedDraft.aiRuns.filter((run) => run.type === 'chapter_generation')
          .length,
        topicId: retryTopic.id,
        retriedCoveredTopicIds: retryDraft.chapters.flatMap((chapter) => chapter.coveredTopicIds),
        retriedRunStatus: latestChapterRun?.status,
        retriedStep: retryDraft.step,
      };
    } finally {
      await cleanup();
    }
  },

  async generateTargetLearnerReviewable() {
    const { cleanup, store } = await createHarness();
    try {
      const draft = await createDraft(
        store,
        'owner-generate-target-learner',
        'Generated target learner course',
      );
      await store.applyWorkflowAction('owner-generate-target-learner', {
        action: 'addSource',
        draftId: draft.id,
        source: {
          content:
            'incident leads need source-backed release response drills with measurable evidence review outcomes',
          name: 'Target learner source',
          type: 'notes',
        },
      });
      await store.applyWorkflowAction('owner-generate-target-learner', {
        action: 'saveQuestions',
        draftId: draft.id,
        questions: questions({
          audience: 'Incident leads',
          outcome: 'create source-backed release response drills',
          practice: 'review evidence and write a response drill',
        }),
      });
      const generatedSnapshot = await store.applyWorkflowAction('owner-generate-target-learner', {
        action: 'generateTargetLearner',
        draftId: draft.id,
      });
      const generatedDraft = requiredDraft(generatedSnapshot.draft);
      const targetRun = generatedDraft.aiRuns.find(
        (run) => run.type === 'target_learner_generation',
      );
      const confirmedSnapshot = await store.applyWorkflowAction('owner-generate-target-learner', {
        action: 'confirmTarget',
        draftId: draft.id,
        targetLearner: generatedDraft.targetLearner,
      });
      const confirmedDraft = requiredDraft(confirmedSnapshot.draft);
      const confirmedRun = confirmedDraft.aiRuns.find(
        (run) => run.type === 'target_learner_generation',
      );

      return {
        confirmedRunStatus: confirmedRun?.status,
        confirmedStep: confirmedDraft.step,
        generatedChapterGateAllowed: require(
          path.join(root, 'shared/coursition/workflow.ts'),
        ).getWorkflowStepGate(generatedDraft, 'chapters').allowed,
        generatedOutcome: generatedDraft.targetLearner.desiredOutcome,
        generatedTargetFindingCount: generatedDraft.findings.filter((finding) =>
          finding.id.startsWith(`finding_${draft.id}_target_`),
        ).length,
        generatedProfile: generatedDraft.targetLearner.profile,
        generatedRunStatus: targetRun?.status,
        generatedStep: generatedDraft.step,
      };
    } finally {
      await cleanup();
    }
  },

  async targetLearnerAutosave() {
    const { cleanup, store } = await createHarness();
    try {
      const draft = await createDraft(
        store,
        'owner-target-learner-autosave',
        'Target autosave course',
      );
      const autosavedTarget = targetLearner({
        desiredOutcome: 'They can triage a release incident using observable evidence.',
        profile: 'Release incident leads in platform operations',
      });
      const autosavedSnapshot = await store.applyWorkflowAction('owner-target-learner-autosave', {
        action: 'updateTargetLearner',
        draftId: draft.id,
        targetLearner: autosavedTarget,
      });
      const autosavedDraft = requiredDraft(autosavedSnapshot.draft);

      return {
        aiRunCount: autosavedDraft.aiRuns.length,
        desiredOutcome: autosavedDraft.targetLearner.desiredOutcome,
        profile: autosavedDraft.targetLearner.profile,
        step: autosavedDraft.step,
      };
    } finally {
      await cleanup();
    }
  },

  async targetLearnerFindings() {
    const { cleanup, store } = await createHarness();
    try {
      const draft = await createDraft(
        store,
        'owner-target-learner-findings',
        'Target learner review course',
      );
      await store.applyWorkflowAction('owner-target-learner-findings', {
        action: 'addSource',
        draftId: draft.id,
        source: {
          content: 'specific learner target review source material for course design',
          name: 'Target evidence',
          type: 'notes',
        },
      });
      const weakSnapshot = await store.applyWorkflowAction('owner-target-learner-findings', {
        action: 'confirmTarget',
        draftId: draft.id,
        targetLearner: targetLearner({
          currentKnowledge: 'none',
          desiredOutcome: 'Learn things',
          profile: 'Everyone',
        }),
      });
      const weakDraft = requiredDraft(weakSnapshot.draft);
      const targetFindings = weakDraft.findings.filter((finding) =>
        finding.id.startsWith(`finding_${draft.id}_target_`),
      );

      const specificSnapshot = await store.applyWorkflowAction('owner-target-learner-findings', {
        action: 'confirmTarget',
        draftId: draft.id,
        targetLearner: targetLearner({
          currentKnowledge: 'They can create lesson outlines and need source-backed sequencing',
          desiredOutcome: 'They can apply source evidence to design a focused course sequence',
          profile: 'Course designers creating internal compliance training',
        }),
      });
      const specificDraft = requiredDraft(specificSnapshot.draft);

      return {
        resolvedTargetFindingCount: specificDraft.findings.filter((finding) =>
          finding.id.startsWith(`finding_${draft.id}_target_`),
        ).length,
        step: weakDraft.step,
        targetFindingDetails: targetFindings.map((finding) => finding.detail),
        targetFindingSeverities: targetFindings.map((finding) => finding.severity).toSorted(),
        targetFindingSteps: targetFindings.map((finding) => finding.step).toSorted(),
        targetFindingTargetTypes: targetFindings.map((finding) => finding.targetType).toSorted(),
        targetFindingTitles: targetFindings.map((finding) => finding.title).toSorted(),
      };
    } finally {
      await cleanup();
    }
  },

  async chapterDifficultyMismatchFinding() {
    const { cleanup, store } = await createHarness();
    try {
      const draft = await createDraft(
        store,
        'owner-chapter-difficulty-mismatch',
        'Chapter difficulty review course',
      );
      await store.applyWorkflowAction('owner-chapter-difficulty-mismatch', {
        action: 'confirmTarget',
        draftId: draft.id,
        targetLearner: targetLearner({
          currentKnowledge: 'beginner incident response basics',
          desiredOutcome: 'They can apply incident response decisions in guided drills',
          profile: 'Junior operations analysts starting incident drills',
        }),
      });
      const chapterInputs = [
        'Incident context',
        'Response checklist',
        'Escalation practice',
        'Advanced observability triage',
      ];
      let chapterDraft = draft;
      for (const title of chapterInputs) {
        const chapterSnapshot = await store.applyWorkflowAction(
          'owner-chapter-difficulty-mismatch',
          {
            action: 'addChapter',
            description: `${title} sequence.`,
            draftId: draft.id,
            outcome: `Learners can apply ${title.toLowerCase()}.`,
            title,
          },
        );
        chapterDraft = requiredDraft(chapterSnapshot.draft);
      }
      const advancedChapter = chapterDraft.chapters.find(
        (chapter) => chapter.difficulty === 'advanced',
      );
      if (!advancedChapter) {
        throw new Error('Expected an advanced chapter for difficulty review.');
      }

      const previewSnapshot = await store.applyWorkflowAction('owner-chapter-difficulty-mismatch', {
        action: 'openPreview',
        draftId: draft.id,
      });
      const previewDraft = requiredDraft(previewSnapshot.draft);
      const difficultyFinding = previewDraft.findings.find(
        (finding) => finding.id === `finding_${advancedChapter.id}_difficulty`,
      );
      if (!difficultyFinding) {
        throw new Error('Expected advanced chapter difficulty finding.');
      }

      const expertTargetSnapshot = await store.applyWorkflowAction(
        'owner-chapter-difficulty-mismatch',
        {
          action: 'confirmTarget',
          draftId: draft.id,
          targetLearner: targetLearner({
            currentKnowledge:
              'They can triage production incidents and use advanced observability tools',
            desiredOutcome: 'They can evaluate incident response decisions under pressure',
            profile: 'Senior operations analysts leading incident drills',
          }),
        },
      );
      const expertTargetDraft = requiredDraft(expertTargetSnapshot.draft);

      return {
        advancedChapterDifficulty: advancedChapter.difficulty,
        advancedChapterTitle: advancedChapter.title,
        detail: difficultyFinding.detail,
        resolvedDifficultyFindingCount: expertTargetDraft.findings.filter(
          (finding) => finding.id === difficultyFinding.id,
        ).length,
        severity: difficultyFinding.severity,
        step: difficultyFinding.step,
        targetId: difficultyFinding.targetId,
        targetType: difficultyFinding.targetType,
        title: difficultyFinding.title,
      };
    } finally {
      await cleanup();
    }
  },

  async preserveManualChapterEdits() {
    const { cleanup, store } = await createHarness();
    try {
      const draft = await createDraft(
        store,
        'owner-preserve-manual-chapter-edits',
        'Preserve chapter edits course',
      );
      await store.applyWorkflowAction('owner-preserve-manual-chapter-edits', {
        action: 'addSource',
        draftId: draft.id,
        source: {
          content:
            'chapter preservation source evidence chapter preservation source evidence course outline planning',
          name: 'Chapter preservation evidence',
          type: 'notes',
        },
      });
      await store.applyWorkflowAction('owner-preserve-manual-chapter-edits', {
        action: 'saveQuestions',
        draftId: draft.id,
        questions: questions({
          outcome: 'teach chapter edit preservation',
          practice: 'review a regenerated chapter outline',
        }),
      });
      const topicSnapshot = await store.applyWorkflowAction('owner-preserve-manual-chapter-edits', {
        action: 'generateTopics',
        draftId: draft.id,
      });
      const [topic] = requiredDraft(topicSnapshot.draft).topics;
      if (!topic) {
        throw new Error('Expected generated topic for chapter preservation.');
      }
      await store.applyWorkflowAction('owner-preserve-manual-chapter-edits', {
        action: 'confirmTarget',
        draftId: draft.id,
        targetLearner: targetLearner({
          desiredOutcome: 'They can preserve edited chapter structures across AI analysis',
          profile: 'Course creators refining generated outlines',
        }),
      });
      const generatedSnapshot = await store.applyWorkflowAction(
        'owner-preserve-manual-chapter-edits',
        {
          action: 'generateChapters',
          draftId: draft.id,
        },
      );
      const generatedDraft = requiredDraft(generatedSnapshot.draft);
      const [generatedChapter] = generatedDraft.chapters;
      if (!generatedChapter) {
        throw new Error('Expected generated chapter to edit.');
      }

      await store.applyWorkflowAction('owner-preserve-manual-chapter-edits', {
        action: 'updateChapter',
        chapterId: generatedChapter.id,
        description: 'Manual edited description must survive AI regeneration.',
        draftId: draft.id,
        outcome: 'Learners can verify chapter edits survive regeneration.',
        title: 'Manual edited chapter',
      });
      const manualChapterSnapshot = await store.applyWorkflowAction(
        'owner-preserve-manual-chapter-edits',
        {
          action: 'addChapter',
          description: 'A manually inserted chapter must stay in the outline.',
          draftId: draft.id,
          outcome: 'Learners can keep a custom chapter.',
          title: 'Manual inserted chapter',
        },
      );
      const manualChapter = requiredDraft(manualChapterSnapshot.draft).chapters.find((chapter) =>
        chapter.title.includes('Manual inserted chapter'),
      );
      if (!manualChapter) {
        throw new Error('Expected manual chapter before regeneration.');
      }

      const regeneratedSnapshot = await store.applyWorkflowAction(
        'owner-preserve-manual-chapter-edits',
        {
          action: 'generateChapters',
          draftId: draft.id,
        },
      );
      const regeneratedDraft = requiredDraft(regeneratedSnapshot.draft);
      const preservedGeneratedChapter = regeneratedDraft.chapters.find(
        (chapter) => chapter.id === generatedChapter.id,
      );
      const preservedManualChapter = regeneratedDraft.chapters.find(
        (chapter) => chapter.id === manualChapter.id,
      );
      const chapterRuns = regeneratedDraft.aiRuns.filter(
        (run) => run.type === 'chapter_generation',
      );

      return {
        chapterCount: regeneratedDraft.chapters.length,
        generatedChapterId: generatedChapter.id,
        manualChapterId: manualChapter.id,
        preservedGeneratedDescription: preservedGeneratedChapter?.description,
        preservedGeneratedTitle: preservedGeneratedChapter?.title,
        preservedManualDescription: preservedManualChapter?.description,
        preservedManualTitle: preservedManualChapter?.title,
        regeneratedRunStatus: chapterRuns.at(-1)?.status,
        step: regeneratedDraft.step,
      };
    } finally {
      await cleanup();
    }
  },

  async regeneratedChaptersRefreshValidationMetadata() {
    const { cleanup, store } = await createHarness();
    try {
      const ownerId = 'owner-refresh-generated-chapter-metadata';
      const draft = await createDraft(store, ownerId, 'Refresh generated chapter metadata course');
      await store.applyWorkflowAction(ownerId, {
        action: 'saveQuestions',
        draftId: draft.id,
        questions: questions({
          outcome: 'teach beginner operators to plan safe course modules',
          practice: 'sequence a beginner-friendly module outline',
          priorKnowledge: 'They are beginners with unclear prerequisites',
        }),
      });

      for (const name of [
        'Course framing',
        'Evidence review',
        'Practice planning',
        'Validation checks',
      ]) {
        await store.applyWorkflowAction(ownerId, {
          action: 'addTopic',
          description: `${name} topic.`,
          draftId: draft.id,
          name,
        });
      }

      await store.applyWorkflowAction(ownerId, {
        action: 'confirmTarget',
        draftId: draft.id,
        targetLearner: targetLearner({
          currentKnowledge: 'beginner course creators with unclear prerequisites',
          desiredOutcome: 'They can build a beginner-friendly course outline',
          profile: 'Beginner course creators planning their first structured curriculum',
        }),
      });
      const generatedSnapshot = await store.applyWorkflowAction(ownerId, {
        action: 'generateChapters',
        draftId: draft.id,
      });
      const generatedDraft = requiredDraft(generatedSnapshot.draft);
      const [, generatedChapter] = generatedDraft.chapters;
      if (!generatedChapter) {
        throw new Error('Expected a second generated chapter for metadata refresh.');
      }

      await store.applyWorkflowAction(ownerId, {
        action: 'updateChapter',
        chapterId: generatedChapter.id,
        description: 'Creator wording must remain after metadata refresh.',
        draftId: draft.id,
        outcome: 'Learners can verify regenerated metadata without losing wording.',
        title: 'Edited generated chapter',
      });
      await updateDraftInStore(draft.id, (storedDraft) => ({
        ...storedDraft,
        chapters: [
          ...storedDraft.chapters.map((chapter) =>
            chapter.id === generatedChapter.id ? { ...chapter, difficulty: 'advanced' } : chapter,
          ),
          {
            coveredTopicIds: [],
            description: 'Stale generated chapter should be removed on regeneration.',
            difficulty: 'advanced',
            id: `chapter_${draft.id}_99`,
            lessons: [],
            outcome: 'Learners can identify stale generated chapters.',
            plannedLessonCount: 1,
            sourceSupport: 'source_backed',
            status: 'draft',
            title: '99. Stale generated chapter',
          },
        ],
      }));
      const staleSnapshot = await store.snapshotFor(ownerId);
      const staleDraft = requiredDraft(staleSnapshot.draft);
      const staleChapter = staleDraft.chapters.find(
        (chapter) => chapter.id === generatedChapter.id,
      );

      const regeneratedSnapshot = await store.applyWorkflowAction(ownerId, {
        action: 'generateChapters',
        draftId: draft.id,
      });
      const regeneratedDraft = requiredDraft(regeneratedSnapshot.draft);
      const repairedChapter = regeneratedDraft.chapters.find(
        (chapter) => chapter.id === generatedChapter.id,
      );

      return {
        repairedDescription: repairedChapter?.description,
        repairedDifficulty: repairedChapter?.difficulty,
        repairedTitle: repairedChapter?.title,
        staleDifficulty: staleChapter?.difficulty,
        staleExtraPresent: regeneratedDraft.chapters.some(
          (chapter) => chapter.id === `chapter_${draft.id}_99`,
        ),
      };
    } finally {
      await cleanup();
    }
  },

  async chapterLessonGeneration() {
    const { cleanup, store } = await createHarness();
    try {
      const draft = await createDraft(
        store,
        'owner-chapter-lesson-generation',
        'Scoped lesson generation course',
      );
      await addNotesSource(
        store,
        'owner-chapter-lesson-generation',
        draft.id,
        'Scoped checklist evidence',
        'scoped browser quality checks review boundary scoped checklist source evidence',
      );
      await store.applyWorkflowAction('owner-chapter-lesson-generation', {
        action: 'saveQuestions',
        draftId: draft.id,
        questions: questions({
          outcome: 'teach scoped browser quality checks',
          practice: 'write a focused QA checklist',
        }),
      });
      await store.applyWorkflowAction('owner-chapter-lesson-generation', {
        action: 'confirmTarget',
        draftId: draft.id,
        targetLearner: targetLearner({
          desiredOutcome: 'They can review scoped QA work without regenerating a whole course',
          profile: 'Course creators reviewing one chapter at a time',
        }),
      });
      const firstChapterSnapshot = await store.applyWorkflowAction(
        'owner-chapter-lesson-generation',
        {
          action: 'addChapter',
          description: 'Context before generation.',
          draftId: draft.id,
          outcome: 'Learners can identify the review boundary.',
          title: 'Review boundary',
        },
      );
      const firstChapterDraft = requiredDraft(firstChapterSnapshot.draft);
      const secondChapterSnapshot = await store.applyWorkflowAction(
        'owner-chapter-lesson-generation',
        {
          action: 'addChapter',
          description: 'Generate only this chapter.',
          draftId: draft.id,
          outcome: 'Learners can create a scoped checklist.',
          title: 'Scoped checklist',
        },
      );
      const secondChapterDraft = requiredDraft(secondChapterSnapshot.draft);
      const [firstChapter] = firstChapterDraft.chapters;
      const secondChapter = secondChapterDraft.chapters.find((chapter) =>
        chapter.title.includes('Scoped checklist'),
      );

      if (!firstChapter || !secondChapter) {
        throw new Error('Expected two chapters for scoped lesson generation.');
      }

      await store.applyWorkflowAction('owner-chapter-lesson-generation', {
        action: 'confirmChapters',
        draftId: draft.id,
      });
      const generatedSnapshot = await store.applyWorkflowAction('owner-chapter-lesson-generation', {
        action: 'generateChapterLessons',
        chapterId: secondChapter.id,
        draftId: draft.id,
      });
      const generatedDraft = requiredDraft(generatedSnapshot.draft);
      const untouchedChapter = generatedDraft.chapters.find(
        (chapter) => chapter.id === firstChapter.id,
      );
      const generatedChapter = generatedDraft.chapters.find(
        (chapter) => chapter.id === secondChapter.id,
      );

      return {
        firstChapterLessonCount: untouchedChapter?.lessons.length,
        generatedBlockTypes: generatedChapter?.lessons[0]?.blocks.map((block) => block.type),
        generatedChapterLessonCount: generatedChapter?.lessons.length,
        generatedLessonTitle: generatedChapter?.lessons[0]?.title,
        lessonRunStatus: generatedDraft.aiRuns.find((run) => run.type === 'lesson_generation')
          ?.status,
        step: generatedDraft.step,
      };
    } finally {
      await cleanup();
    }
  },

  // eslint-disable-next-line complexity
  async lessonRegeneration() {
    const { cleanup, store } = await createHarness();
    try {
      const draft = await buildWorkflowDraft(store, 'owner-lesson-regeneration');
      const lesson = draft.chapters[0]?.lessons[0];
      if (!lesson) {
        throw new Error('Expected a generated lesson to regenerate.');
      }
      const originalExplanation = lesson.blocks.find((block) => block.type === 'explanation');
      const regeneratedSnapshot = await store.applyWorkflowAction('owner-lesson-regeneration', {
        action: 'regenerateLesson',
        draftId: draft.id,
        lessonId: lesson.id,
      });
      const regeneratedDraft = requiredDraft(regeneratedSnapshot.draft);
      const regeneratedLesson = regeneratedDraft.chapters[0]?.lessons.find(
        (candidate) => candidate.id === lesson.id,
      );
      const regeneratedExplanation = regeneratedLesson?.blocks.find(
        (block) => block.type === 'explanation',
      );
      const summaryBlock = regeneratedLesson?.blocks.find((block) => block.type === 'summary');
      if (!regeneratedLesson || !summaryBlock) {
        throw new Error('Expected regenerated lesson and summary block.');
      }

      const manualSnapshot = await store.applyWorkflowAction('owner-lesson-regeneration', {
        action: 'updateBlock',
        blockId: summaryBlock.id,
        body: 'Manual regenerated summary must not be overwritten.',
        draftId: draft.id,
        title: 'Manual regenerated summary',
      });
      const manualDraft = requiredDraft(manualSnapshot.draft);
      const manualLesson = manualDraft.chapters[0]?.lessons.find(
        (candidate) => candidate.id === lesson.id,
      );
      const cancelledSnapshot = await store.applyWorkflowAction('owner-lesson-regeneration', {
        action: 'regenerateLesson',
        draftId: draft.id,
        lessonId: lesson.id,
      });
      const cancelledDraft = requiredDraft(cancelledSnapshot.draft);
      const preservedSummary = cancelledDraft.chapters[0]?.lessons[0]?.blocks.find(
        (block) => block.title === 'Manual regenerated summary',
      );
      const lessonRuns = cancelledDraft.aiRuns.filter((run) => run.type === 'lesson_generation');

      return {
        cancelledRunFailureReason: lessonRuns.at(-1)?.failureReason,
        cancelledRunStatus: lessonRuns.at(-1)?.status,
        originalReferenceCount: originalExplanation?.sourceReferences?.length ?? 0,
        preservedSummaryBody: preservedSummary?.body,
        preservedSummaryProvenance: preservedSummary?.provenance,
        regeneratedBlockTypes: regeneratedLesson.blocks.map((block) => block.type),
        regeneratedLessonId: regeneratedLesson.id,
        regeneratedReferenceCount: regeneratedExplanation?.sourceReferences?.length ?? 0,
        regeneratedRunStatus: regeneratedDraft.aiRuns.at(-1)?.status,
        selectedLessonId: lesson.id,
        step: regeneratedDraft.step,
        untouchedManualBlockCount:
          manualLesson?.blocks.filter((block) => block.provenance === 'manual').length ?? 0,
      };
    } finally {
      await cleanup();
    }
  },

  async retryFailedAiRun() {
    const { cleanup, store } = await createHarness();
    try {
      const draft = await createDraft(store, 'owner-retry-failed-ai-run', 'Retry failed AI run');
      const blockedSnapshot = await store.applyWorkflowAction('owner-retry-failed-ai-run', {
        action: 'generateLessons',
        draftId: draft.id,
      });
      const blockedDraft = requiredDraft(blockedSnapshot.draft);
      const blockedLessonRuns = blockedDraft.aiRuns.filter(
        (run) => run.type === 'lesson_generation',
      );
      const blockedRun = blockedLessonRuns.at(-1);

      await addNotesSource(
        store,
        'owner-retry-failed-ai-run',
        draft.id,
        'Retry workflow evidence',
        'retry workflow recovery source evidence for failed generation and course planning',
      );
      await store.applyWorkflowAction('owner-retry-failed-ai-run', {
        action: 'saveQuestions',
        draftId: draft.id,
        questions: questions({
          outcome: 'teach course creators to recover failed AI workflow runs',
          practice: 'review failed generation prerequisites and retry the run',
        }),
      });
      await store.applyWorkflowAction('owner-retry-failed-ai-run', {
        action: 'confirmTarget',
        draftId: draft.id,
        targetLearner: targetLearner({
          desiredOutcome: 'They can apply recovery steps for failed AI workflow runs.',
          profile: 'Course creators recovering a generation failure',
        }),
      });
      const chapterSnapshot = await store.applyWorkflowAction('owner-retry-failed-ai-run', {
        action: 'addChapter',
        description: 'Recover a failed generation after fixing prerequisites.',
        draftId: draft.id,
        outcome: 'Learners can retry a failed AI run after adding required structure.',
        title: 'Retry workflow',
      });
      await store.applyWorkflowAction('owner-retry-failed-ai-run', {
        action: 'confirmChapters',
        draftId: draft.id,
      });
      const lessonSnapshot = await store.applyWorkflowAction('owner-retry-failed-ai-run', {
        action: 'generateLessons',
        draftId: draft.id,
      });
      const lessonDraft = requiredDraft(lessonSnapshot.draft);
      const lessonRuns = lessonDraft.aiRuns.filter((run) => run.type === 'lesson_generation');
      const generatedRun = lessonRuns.at(-1);

      return {
        blockedGenerationError: blockedRun?.failureReason,
        blockedRunCount: blockedLessonRuns.length,
        blockedRunStatus: blockedRun?.status,
        chapterCountBeforeRetry: requiredDraft(chapterSnapshot.draft).chapters.length,
        generatedRunStatus: generatedRun?.status,
        lessonBlockTypes: lessonDraft.chapters[0]?.lessons[0]?.blocks.map((block) => block.type),
        lessonCount: lessonDraft.chapters[0]?.lessons.length,
        runCount: lessonRuns.length,
        step: lessonDraft.step,
      };
    } finally {
      await cleanup();
    }
  },

  async targetRequiredForLessonGeneration() {
    const { cleanup, store } = await createHarness();
    try {
      const draft = await createDraft(
        store,
        'owner-target-required-lessons',
        'Target required for lessons',
      );
      await addNotesSource(
        store,
        'owner-target-required-lessons',
        draft.id,
        'Targeted lesson evidence',
        'targeted lessons source evidence for coherent lesson generation',
      );
      await store.applyWorkflowAction('owner-target-required-lessons', {
        action: 'saveQuestions',
        draftId: draft.id,
        questions: questions({
          outcome: 'teach coherent lesson generation prerequisites',
          practice: 'confirm target and chapter structure before drafting lessons',
        }),
      });
      const chapterSnapshot = await store.applyWorkflowAction('owner-target-required-lessons', {
        action: 'addChapter',
        description: 'A chapter that should not generate lessons until target is confirmed.',
        draftId: draft.id,
        outcome: 'Learners can connect lesson generation to a target learner.',
        title: 'Targeted lessons',
      });
      const chapterDraft = requiredDraft(chapterSnapshot.draft);
      const [chapter] = chapterDraft.chapters;
      if (!chapter) {
        throw new Error('Expected lesson prerequisite chapter.');
      }

      let blockedConfirmError = '';
      try {
        await store.applyWorkflowAction('owner-target-required-lessons', {
          action: 'confirmChapters',
          draftId: draft.id,
        });
      } catch (error) {
        blockedConfirmError = error instanceof Error ? error.message : String(error);
      }
      const blockedSnapshot = await store.snapshotFor('owner-target-required-lessons');
      const blockedDraft = requiredDraft(blockedSnapshot.draft);

      await store.applyWorkflowAction('owner-target-required-lessons', {
        action: 'confirmTarget',
        draftId: draft.id,
        targetLearner: targetLearner({
          desiredOutcome: 'They can create lesson drafts from confirmed learner context.',
          profile: 'Course creators who need coherent lesson generation',
        }),
      });
      await store.applyWorkflowAction('owner-target-required-lessons', {
        action: 'confirmChapters',
        draftId: draft.id,
      });
      const lessonSnapshot = await store.applyWorkflowAction('owner-target-required-lessons', {
        action: 'generateLessons',
        draftId: draft.id,
      });
      const lessonDraft = requiredDraft(lessonSnapshot.draft);
      const lessonRun = lessonDraft.aiRuns.findLast((run) => run.type === 'lesson_generation');

      return {
        blockedConfirmError,
        blockedRunCount: blockedDraft.aiRuns.length,
        generatedRunStatus: lessonRun?.status,
        lessonBlockTypes: lessonDraft.chapters[0]?.lessons[0]?.blocks.map((block) => block.type),
        lessonCount: lessonDraft.chapters[0]?.lessons.length,
        step: lessonDraft.step,
      };
    } finally {
      await cleanup();
    }
  },

  async chapterConfirmationRequiredForLessonGeneration() {
    const { cleanup, store } = await createHarness();
    try {
      const draft = await createDraft(
        store,
        'owner-chapter-confirmation-required-lessons',
        'Chapter confirmation required for lessons',
      );
      await addNotesSource(
        store,
        'owner-chapter-confirmation-required-lessons',
        draft.id,
        'Outline approval evidence',
        'confirmed outline approval lesson generation source evidence for course creators',
      );
      await store.applyWorkflowAction('owner-chapter-confirmation-required-lessons', {
        action: 'saveQuestions',
        draftId: draft.id,
        questions: questions({
          outcome: 'teach confirmed outline lesson generation',
          practice: 'review a confirmed chapter plan before drafting',
        }),
      });
      await store.applyWorkflowAction('owner-chapter-confirmation-required-lessons', {
        action: 'confirmTarget',
        draftId: draft.id,
        targetLearner: targetLearner({
          desiredOutcome: 'They can create lessons only from confirmed outlines.',
          profile: 'Course creators approving outlines before lesson drafting',
        }),
      });
      const chapterSnapshot = await store.applyWorkflowAction(
        'owner-chapter-confirmation-required-lessons',
        {
          action: 'addChapter',
          description: 'A chapter that must be confirmed before AI drafts lessons.',
          draftId: draft.id,
          outcome: 'Learners can respect the outline approval step.',
          title: 'Outline approval',
        },
      );
      const [chapter] = requiredDraft(chapterSnapshot.draft).chapters;
      if (!chapter) {
        throw new Error('Expected chapter for confirmation prerequisite.');
      }

      const blockedAllSnapshot = await store.applyWorkflowAction(
        'owner-chapter-confirmation-required-lessons',
        {
          action: 'generateLessons',
          draftId: draft.id,
        },
      );
      const blockedAllDraft = requiredDraft(blockedAllSnapshot.draft);
      const blockedAllRun = blockedAllDraft.aiRuns.findLast(
        (run) => run.type === 'lesson_generation',
      );

      const blockedChapterSnapshot = await store.applyWorkflowAction(
        'owner-chapter-confirmation-required-lessons',
        {
          action: 'generateChapterLessons',
          chapterId: chapter.id,
          draftId: draft.id,
        },
      );
      const blockedDraft = requiredDraft(blockedChapterSnapshot.draft);
      const blockedLessonRuns = blockedDraft.aiRuns.filter(
        (run) => run.type === 'lesson_generation',
      );
      const blockedChapterRun = blockedLessonRuns.at(-1);

      const confirmedSnapshot = await store.applyWorkflowAction(
        'owner-chapter-confirmation-required-lessons',
        {
          action: 'confirmChapters',
          draftId: draft.id,
        },
      );
      const lessonSnapshot = await store.applyWorkflowAction(
        'owner-chapter-confirmation-required-lessons',
        {
          action: 'generateLessons',
          draftId: draft.id,
        },
      );
      const lessonDraft = requiredDraft(lessonSnapshot.draft);
      const lessonRuns = lessonDraft.aiRuns.filter((run) => run.type === 'lesson_generation');
      const generatedRun = lessonRuns.at(-1);

      return {
        blockedAllError: blockedAllRun?.failureReason,
        blockedChapterError: blockedChapterRun?.failureReason,
        blockedRunCount: blockedLessonRuns.length,
        chapterStatusAfterConfirm: requiredDraft(confirmedSnapshot.draft).chapters[0]?.status,
        generatedRunStatus: generatedRun?.status,
        lessonBlockTypes: lessonDraft.chapters[0]?.lessons[0]?.blocks.map((block) => block.type),
        lessonCount: lessonDraft.chapters[0]?.lessons.length,
        runCount: lessonRuns.length,
        step: lessonDraft.step,
      };
    } finally {
      await cleanup();
    }
  },

  async ownerIsolation() {
    const { cleanup, store } = await createHarness();
    try {
      const aliceDraft = await createDraft(store, 'owner-alice', 'Alice only draft');
      const bobDraft = await createDraft(store, 'owner-bob', 'Bob only draft');
      const aliceSnapshot = await store.snapshotFor('owner-alice');
      const bobSnapshot = await store.snapshotFor('owner-bob');
      let crossOwnerError = '';

      try {
        await store.applyWorkflowAction('owner-bob', {
          action: 'setMode',
          draftId: aliceDraft.id,
          mode: 'generate',
        });
      } catch (error) {
        crossOwnerError = error instanceof Error ? error.message : String(error);
      }

      return {
        aliceDraftId: aliceDraft.id,
        aliceSnapshotDraftId: aliceSnapshot.draft?.id,
        aliceSnapshotTitle: aliceSnapshot.draft?.title,
        bobDraftId: bobDraft.id,
        bobSnapshotDraftId: bobSnapshot.draft?.id,
        bobSnapshotTitle: bobSnapshot.draft?.title,
        crossOwnerError,
      };
    } finally {
      await cleanup();
    }
  },

  async draftResumeList() {
    const { cleanup, store } = await createHarness();
    try {
      const firstDraft = await createDraft(store, 'owner-draft-list', 'First unfinished draft');
      await store.applyWorkflowAction('owner-draft-list', {
        action: 'setMode',
        draftId: firstDraft.id,
        mode: 'generate',
      });
      await store.applyWorkflowAction('owner-draft-list', {
        action: 'addSource',
        draftId: firstDraft.id,
        source: {
          content: 'first source note for resume testing',
          name: 'First source',
          type: 'notes',
        },
      });

      const secondDraft = await createDraft(store, 'owner-draft-list', 'Second latest draft');
      await store.applyWorkflowAction('owner-draft-list', {
        action: 'setMode',
        draftId: secondDraft.id,
        mode: 'assist',
      });
      const otherOwnerDraft = await createDraft(
        store,
        'owner-other-draft-list',
        'Other owner draft',
      );

      const snapshot = await store.snapshotFor('owner-draft-list');
      const selectedSnapshot = await store.applyWorkflowAction('owner-draft-list', {
        action: 'selectDraft',
        draftId: firstDraft.id,
      });
      let crossOwnerError = '';

      try {
        await store.applyWorkflowAction('owner-draft-list', {
          action: 'selectDraft',
          draftId: otherOwnerDraft.id,
        });
      } catch (error) {
        crossOwnerError = error instanceof Error ? error.message : String(error);
      }
      await store.applyWorkflowAction('owner-draft-list', {
        action: 'deleteDraft',
        confirm: true,
        draftId: secondDraft.id,
      });
      const snapshotAfterDelete = await store.snapshotFor('owner-draft-list');

      return {
        crossOwnerError,
        latestDraftId: snapshot.draft?.id,
        selectedDraftId: selectedSnapshot.draft?.id,
        selectedStep: selectedSnapshot.draft?.step,
        summaryCount: snapshot.drafts.length,
        summaryCountAfterDelete: snapshotAfterDelete.drafts.length,
        summaryIds: snapshot.drafts.map((draft) => draft.id),
        summaryIdsAfterDelete: snapshotAfterDelete.drafts.map((draft) => draft.id),
        summaryLessons: snapshot.drafts.map((draft) => draft.lessonCount),
        summarySources: snapshot.drafts.map((draft) => draft.sourceCount),
        summaryTitles: snapshot.drafts.map((draft) => draft.title),
      };
    } finally {
      await cleanup();
    }
  },

  // eslint-disable-next-line complexity
  async sourceLifecycle() {
    const webExtractionServer = await createWebExtractionServer();
    const previousLlamaKey = process.env.LLAMA_CLOUD_API_KEY;
    const previousDeepgramKey = process.env.DEEPGRAM_API_KEY;
    const previousFirecrawlKey = process.env.FIRECRAWL_API_KEY;
    const previousFirecrawlBaseUrl = process.env.FIRECRAWL_BASE_URL;
    const previousTavilyKey = process.env.TAVILY_API_KEY;
    const previousTavilyBaseUrl = process.env.TAVILY_BASE_URL;
    const previousExaKey = process.env.EXA_API_KEY;
    const previousExaBaseUrl = process.env.EXA_BASE_URL;
    delete process.env.LLAMA_CLOUD_API_KEY;
    delete process.env.DEEPGRAM_API_KEY;
    delete process.env.FIRECRAWL_API_KEY;
    delete process.env.EXA_API_KEY;
    process.env.TAVILY_API_KEY = 'test-tavily-key';
    process.env.TAVILY_BASE_URL = webExtractionServer.url;
    const { cleanup, store } = await createHarness();
    try {
      const draft = await createDraft(store, 'owner-source-lifecycle', 'URL lifecycle course');
      const { deletedSource, retrySource, unsupportedSource, urlSource } =
        await addBaseLifecycleSources(store, draft.id, 'https://example.com/source-lifecycle');

      const { providerAudio, providerDocument, unknownFile } =
        await addProviderClassificationSources(store, draft.id);

      const deleteSnapshot = await store.applyWorkflowAction('owner-source-lifecycle', {
        action: 'deleteSource',
        draftId: draft.id,
        sourceId: deletedSource.id,
      });
      const deleteDraft = requiredDraft(deleteSnapshot.draft);
      const deletedAfterAction = deleteDraft.sources.find(
        (source) => source.id === deletedSource.id,
      );

      const topicSnapshot = await store.applyWorkflowAction('owner-source-lifecycle', {
        action: 'generateTopics',
        draftId: draft.id,
      });
      const topicDraft = requiredDraft(topicSnapshot.draft);
      const urlDerivedDocuments = topicDraft.derivedSourceDocuments.filter(
        (document) => document.sourceAssetId === urlSource?.id,
      );
      const urlChunks = topicDraft.knowledgeChunks.filter(
        (chunk) => chunk.sourceAssetId === urlSource?.id,
      );
      const deletedChunks = topicDraft.knowledgeChunks.filter(
        (chunk) => chunk.sourceAssetId === deletedSource.id,
      );

      return {
        deletedChunkCount: deletedChunks.length,
        deletedStatus: deletedAfterAction?.status,
        derivedDocumentContent: urlDerivedDocuments[0]?.content,
        derivedDocumentProcessor: urlDerivedDocuments[0]?.processor,
        derivedDocumentCount: urlDerivedDocuments.length,
        sourceProcessingIncomplete: topicDraft.sourceProcessingIncomplete,
        firstChunkContent: urlChunks[0]?.content,
        firstChunkPosition: urlChunks[0]?.reference.position,
        knowledgeChunkCount: urlChunks.length,
        providerAudioFailureReason: providerAudio?.failureReason,
        providerAudioProcessor: providerAudio?.processor,
        providerAudioStatus: providerAudio?.status,
        providerDocumentFailureReason: providerDocument?.failureReason,
        providerDocumentProcessor: providerDocument?.processor,
        providerDocumentStatus: providerDocument?.status,
        topicNames: topicDraft.topics.map((topic) => topic.name),
        unknownFileProcessor: unknownFile?.processor,
        unknownFileStatus: unknownFile?.status,
        unsupportedRetryStatus: retrySource?.status,
        unsupportedStatus: unsupportedSource.status,
        urlContent: urlSource?.content,
        urlProcessor: urlSource?.processor,
        urlStatus: urlSource?.status,
      };
    } finally {
      if (previousLlamaKey) {
        process.env.LLAMA_CLOUD_API_KEY = previousLlamaKey;
      } else {
        delete process.env.LLAMA_CLOUD_API_KEY;
      }
      if (previousDeepgramKey) {
        process.env.DEEPGRAM_API_KEY = previousDeepgramKey;
      } else {
        delete process.env.DEEPGRAM_API_KEY;
      }
      if (previousFirecrawlKey) {
        process.env.FIRECRAWL_API_KEY = previousFirecrawlKey;
      } else {
        delete process.env.FIRECRAWL_API_KEY;
      }
      if (previousFirecrawlBaseUrl) {
        process.env.FIRECRAWL_BASE_URL = previousFirecrawlBaseUrl;
      } else {
        delete process.env.FIRECRAWL_BASE_URL;
      }
      if (previousTavilyKey) {
        process.env.TAVILY_API_KEY = previousTavilyKey;
      } else {
        delete process.env.TAVILY_API_KEY;
      }
      if (previousTavilyBaseUrl) {
        process.env.TAVILY_BASE_URL = previousTavilyBaseUrl;
      } else {
        delete process.env.TAVILY_BASE_URL;
      }
      if (previousExaKey) {
        process.env.EXA_API_KEY = previousExaKey;
      } else {
        delete process.env.EXA_API_KEY;
      }
      if (previousExaBaseUrl) {
        process.env.EXA_BASE_URL = previousExaBaseUrl;
      } else {
        delete process.env.EXA_BASE_URL;
      }
      await webExtractionServer.close();
      await cleanup();
    }
  },

  async webExtractorUrlFallback() {
    const webExtractionServer = await createWebExtractionServer();
    const previousFirecrawlKey = process.env.FIRECRAWL_API_KEY;
    const previousFirecrawlBaseUrl = process.env.FIRECRAWL_BASE_URL;
    const previousTavilyKey = process.env.TAVILY_API_KEY;
    const previousTavilyBaseUrl = process.env.TAVILY_BASE_URL;
    const previousExaKey = process.env.EXA_API_KEY;
    const previousExaBaseUrl = process.env.EXA_BASE_URL;
    process.env.FIRECRAWL_API_KEY = 'test-firecrawl-key';
    process.env.FIRECRAWL_BASE_URL = webExtractionServer.url;
    process.env.TAVILY_API_KEY = 'test-tavily-key';
    process.env.TAVILY_BASE_URL = webExtractionServer.url;
    process.env.EXA_API_KEY = 'test-exa-key';
    process.env.EXA_BASE_URL = webExtractionServer.url;
    const { cleanup, store } = await createHarness();
    try {
      const draft = await createDraft(
        store,
        'owner-web-extractor-url-source',
        'Web extractor URL source course',
      );
      const sourceSnapshot = await store.applyWorkflowAction('owner-web-extractor-url-source', {
        action: 'addSource',
        draftId: draft.id,
        source: {
          content: 'https://example.com/noisy-source-page',
          name: 'Parsed source page',
          type: 'url',
        },
      });
      const sourceDraft = requiredDraft(sourceSnapshot.draft);
      const source = sourceDraft.sources.find(
        (candidate) => candidate.name === 'Parsed source page',
      );
      const derivedDocument = sourceDraft.derivedSourceDocuments.find(
        (document) => document.sourceAssetId === source?.id,
      );
      const [firecrawlRequest] = webExtractionServer.requests.firecrawl;
      const [tavilyRequest] = webExtractionServer.requests.tavily;

      return {
        content: source?.content,
        derivedDocumentContent: derivedDocument?.content,
        derivedDocumentProcessor: derivedDocument?.processor,
        exaRequestCount: webExtractionServer.requests.exa.length,
        firecrawlRequestCount: webExtractionServer.requests.firecrawl.length,
        firecrawlRequestFormats: firecrawlRequest?.formats,
        firecrawlRequestUrl: firecrawlRequest?.url,
        processor: source?.processor,
        status: source?.status,
        storageReference: source?.storageReference,
        tavilyRequestCount: webExtractionServer.requests.tavily.length,
        tavilyRequestFormat: tavilyRequest?.format,
        tavilyRequestUrls: tavilyRequest?.urls,
      };
    } finally {
      if (previousFirecrawlKey) {
        process.env.FIRECRAWL_API_KEY = previousFirecrawlKey;
      } else {
        delete process.env.FIRECRAWL_API_KEY;
      }
      if (previousFirecrawlBaseUrl) {
        process.env.FIRECRAWL_BASE_URL = previousFirecrawlBaseUrl;
      } else {
        delete process.env.FIRECRAWL_BASE_URL;
      }
      if (previousTavilyKey) {
        process.env.TAVILY_API_KEY = previousTavilyKey;
      } else {
        delete process.env.TAVILY_API_KEY;
      }
      if (previousTavilyBaseUrl) {
        process.env.TAVILY_BASE_URL = previousTavilyBaseUrl;
      } else {
        delete process.env.TAVILY_BASE_URL;
      }
      if (previousExaKey) {
        process.env.EXA_API_KEY = previousExaKey;
      } else {
        delete process.env.EXA_API_KEY;
      }
      if (previousExaBaseUrl) {
        process.env.EXA_BASE_URL = previousExaBaseUrl;
      } else {
        delete process.env.EXA_BASE_URL;
      }
      await webExtractionServer.close();
      await cleanup();
    }
  },

  async preserveManualEdits() {
    const { cleanup, store } = await createHarness();
    try {
      const draft = await buildWorkflowDraft(store, 'owner-preserve-manual-edits');
      const block = draft.chapters[0]?.lessons[0]?.blocks.find(
        (candidate) => candidate.type === 'summary',
      );

      if (!block) {
        throw new Error('Expected generated summary block.');
      }

      const manualSnapshot = await store.applyWorkflowAction('owner-preserve-manual-edits', {
        action: 'updateBlock',
        blockId: block.id,
        body: 'Manual summary must survive regeneration.',
        draftId: draft.id,
        title: 'Manual preserved summary',
      });
      const regeneratedSnapshot = await store.applyWorkflowAction('owner-preserve-manual-edits', {
        action: 'generateLessons',
        draftId: draft.id,
      });
      const regeneratedDraft = requiredDraft(regeneratedSnapshot.draft);
      const preservedBlock = regeneratedDraft.chapters[0]?.lessons[0]?.blocks.find(
        (candidate) => candidate.id === block.id,
      );

      return {
        manualStep: requiredDraft(manualSnapshot.draft).step,
        preservedBody: preservedBlock?.body,
        preservedProvenance: preservedBlock?.provenance,
        lessonRunCount: regeneratedDraft.aiRuns.filter((run) => run.type === 'lesson_generation')
          .length,
      };
    } finally {
      await cleanup();
    }
  },

  async modeChangesAfterLessonGeneration() {
    const { cleanup, store } = await createHarness();
    const ownerId = 'owner-mode-changes-after-lessons';
    try {
      const draft = await buildWorkflowDraft(store, ownerId);
      const generateModeSnapshot = await store.applyWorkflowAction(ownerId, {
        action: 'setMode',
        draftId: draft.id,
        mode: 'generate',
      });
      const generateModeDraft = requiredDraft(generateModeSnapshot.draft);
      const modeStepSnapshot = await store.applyWorkflowAction(ownerId, {
        action: 'goToStep',
        draftId: draft.id,
        step: 'mode',
      });
      const modeStepDraft = requiredDraft(modeStepSnapshot.draft);
      const assistFromModeSnapshot = await store.applyWorkflowAction(ownerId, {
        action: 'setMode',
        draftId: draft.id,
        mode: 'assist',
      });
      const assistFromModeDraft = requiredDraft(assistFromModeSnapshot.draft);
      const assistFromModeBuilderSnapshot = await store.snapshotForRoute(
        ownerId,
        draft.id,
        'builder',
      );
      const assistFromModeBuilderDraft = requiredDraft(assistFromModeBuilderSnapshot.draft);
      const generateFromModeSnapshot = await store.applyWorkflowAction(ownerId, {
        action: 'setMode',
        draftId: draft.id,
        mode: 'generate',
      });
      const generateFromModeDraft = requiredDraft(generateFromModeSnapshot.draft);
      const generateFromModeBuilderSnapshot = await store.snapshotForRoute(
        ownerId,
        draft.id,
        'builder',
      );
      const generateFromModeBuilderDraft = requiredDraft(generateFromModeBuilderSnapshot.draft);

      return {
        assistFromMode: assistFromModeDraft.mode,
        assistFromModeBuilderStep: assistFromModeBuilderDraft.step,
        assistFromModeStep: assistFromModeDraft.step,
        generateFromMode: generateFromModeDraft.mode,
        generateFromModeBuilderStep: generateFromModeBuilderDraft.step,
        generateFromModeStep: generateFromModeDraft.step,
        generateMode: generateModeDraft.mode,
        generateModeStep: generateModeDraft.step,
        initialMode: draft.mode,
        initialStep: draft.step,
        lessonRunFailureReason: draft.aiRuns.find((run) => run.type === 'lesson_generation')
          ?.failureReason,
        lessonRunStatus: draft.aiRuns.find((run) => run.type === 'lesson_generation')?.status,
        modeStep: modeStepDraft.step,
      };
    } finally {
      await cleanup();
    }
  },

  async modeLockedAfterLessonGeneration() {
    const { cleanup, store } = await createHarness();
    try {
      const draft = await buildWorkflowDraft(store, 'owner-mode-locked-after-lessons');
      const sameModeSnapshot = await store.applyWorkflowAction('owner-mode-locked-after-lessons', {
        action: 'setMode',
        draftId: draft.id,
        mode: draft.mode,
      });
      const sameModeDraft = requiredDraft(sameModeSnapshot.draft);

      return {
        changedModeError: '',
        lessonRunFailureReason: draft.aiRuns.find((run) => run.type === 'lesson_generation')
          ?.failureReason,
        initialMode: draft.mode,
        initialStep: draft.step,
        lessonRunStatus: draft.aiRuns.find((run) => run.type === 'lesson_generation')?.status,
        sameMode: sameModeDraft.mode,
        sameModeStep: sameModeDraft.step,
      };
    } finally {
      await cleanup();
    }
  },

  async wizardNavigation() {
    const { cleanup, store } = await createHarness();
    try {
      const draft = await createDraft(store, 'owner-wizard-navigation', 'Wizard navigation course');
      const generateModeSnapshot = await store.applyWorkflowAction('owner-wizard-navigation', {
        action: 'setMode',
        draftId: draft.id,
        mode: 'generate',
      });
      const sourceSnapshot = await store.applyWorkflowAction('owner-wizard-navigation', {
        action: 'addSource',
        draftId: draft.id,
        source: {
          content: 'Wizard navigation source evidence for generated questions',
          name: 'Wizard navigation source',
          type: 'notes',
        },
      });
      let blockedFutureStepError = '';
      try {
        await store.applyWorkflowAction('owner-wizard-navigation', {
          action: 'goToStep',
          draftId: draft.id,
          step: 'target',
        });
      } catch (error) {
        blockedFutureStepError = error instanceof Error ? error.message : String(error);
      }
      let blockedQuestionsStepError = '';
      try {
        await store.applyWorkflowAction('owner-wizard-navigation', {
          action: 'goToStep',
          draftId: draft.id,
          step: 'questions',
        });
      } catch (error) {
        blockedQuestionsStepError = error instanceof Error ? error.message : String(error);
      }
      const backToKnowledgeSnapshot = await store.applyWorkflowAction('owner-wizard-navigation', {
        action: 'goToStep',
        draftId: draft.id,
        step: 'knowledge',
      });
      const assistModeSnapshot = await store.applyWorkflowAction('owner-wizard-navigation', {
        action: 'setMode',
        draftId: draft.id,
        mode: 'assist',
      });
      const resumedSnapshot = await store.snapshotFor('owner-wizard-navigation');

      return {
        backStep: requiredDraft(backToKnowledgeSnapshot.draft).step,
        blockedFutureStepError,
        blockedQuestionsStepError,
        generatedModeStep: requiredDraft(generateModeSnapshot.draft).step,
        assistMode: requiredDraft(assistModeSnapshot.draft).mode,
        assistStep: requiredDraft(assistModeSnapshot.draft).step,
        questionAudienceBeforeBuild: requiredDraft(sourceSnapshot.draft).questions.audience,
        questionOutcomeBeforeBuild: requiredDraft(sourceSnapshot.draft).questions.outcome,
        questionPracticeBeforeBuild: requiredDraft(sourceSnapshot.draft).questions.practice,
        resumedStep: requiredDraft(resumedSnapshot.draft).step,
      };
    } finally {
      await cleanup();
    }
  },

  async modeRequiredQuestions() {
    const { cleanup, store } = await createHarness();
    try {
      const generateDraft = await createDraft(
        store,
        'owner-mode-required-questions',
        'Mode required question course',
      );
      await store.applyWorkflowAction('owner-mode-required-questions', {
        action: 'setMode',
        draftId: generateDraft.id,
        mode: 'generate',
      });
      await store.applyWorkflowAction('owner-mode-required-questions', {
        action: 'addSource',
        draftId: generateDraft.id,
        source: {
          content: 'Question mode source evidence',
          name: 'Question mode source',
          type: 'notes',
        },
      });
      const blockedSnapshot = await store.applyWorkflowAction('owner-mode-required-questions', {
        action: 'saveQuestions',
        draftId: generateDraft.id,
        questions: questions({
          audience: '',
          outcome: '',
          practice: '',
        }),
      });
      const blockedDraft = requiredDraft(blockedSnapshot.draft);
      const requiredFinding = blockedDraft.findings.find(
        (finding) => finding.id === `finding_${generateDraft.id}_required_questions`,
      );
      const completedSnapshot = await store.applyWorkflowAction('owner-mode-required-questions', {
        action: 'saveQuestions',
        draftId: generateDraft.id,
        questions: questions({
          audience: 'Course creators who want AI to build the first draft',
          outcome: 'Create a complete course from source material',
          practice: 'Build one source-backed lesson plan',
        }),
      });
      const completedDraft = requiredDraft(completedSnapshot.draft);

      const assistDraft = await createDraft(
        store,
        'owner-mode-required-questions',
        'Assist partial question course',
      );
      await store.applyWorkflowAction('owner-mode-required-questions', {
        action: 'setMode',
        draftId: assistDraft.id,
        mode: 'assist',
      });
      const assistSnapshot = await store.applyWorkflowAction('owner-mode-required-questions', {
        action: 'saveQuestions',
        draftId: assistDraft.id,
        questions: questions({
          audience: '',
          outcome: '',
          practice: '',
        }),
      });
      const assistSavedDraft = requiredDraft(assistSnapshot.draft);

      return {
        assistRequiredFindingCount: assistSavedDraft.findings.filter(
          (finding) => finding.id === `finding_${assistDraft.id}_required_questions`,
        ).length,
        assistStep: assistSavedDraft.step,
        completedRequiredFindingCount: completedDraft.findings.filter(
          (finding) => finding.id === `finding_${generateDraft.id}_required_questions`,
        ).length,
        completedStep: completedDraft.step,
        requiredFindingDetail: requiredFinding?.detail,
        requiredFindingSeverity: requiredFinding?.severity,
        requiredFindingStatus: requiredFinding?.status,
        requiredFindingStep: requiredFinding?.step,
        requiredFindingTargetType: requiredFinding?.targetType,
        requiredFindingTitle: requiredFinding?.title,
        blockedStep: blockedDraft.step,
      };
    } finally {
      await cleanup();
    }
  },

  async generateModeTopicsRequireQuestions() {
    const { cleanup, store } = await createHarness();
    try {
      const draft = await createDraft(
        store,
        'owner-generate-mode-topics-require-questions',
        'Required question topic course',
      );
      await store.applyWorkflowAction('owner-generate-mode-topics-require-questions', {
        action: 'setMode',
        draftId: draft.id,
        mode: 'generate',
      });
      const sourceSnapshot = await store.applyWorkflowAction(
        'owner-generate-mode-topics-require-questions',
        {
          action: 'addSource',
          draftId: draft.id,
          source: {
            content: 'Required question topic source evidence',
            name: 'Required question source',
            type: 'notes',
          },
        },
      );
      let missingQuestionsError = '';
      try {
        await store.applyWorkflowAction('owner-generate-mode-topics-require-questions', {
          action: 'generateTopics',
          draftId: draft.id,
        });
      } catch (error) {
        missingQuestionsError = error instanceof Error ? error.message : String(error);
      }
      await store.applyWorkflowAction('owner-generate-mode-topics-require-questions', {
        action: 'saveQuestions',
        draftId: draft.id,
        questions: questions({
          audience: 'Creators turning source notes into focused practice',
          outcome: 'Plan a source-backed lesson sequence',
          practice: 'Draft a source-backed practice activity',
        }),
      });
      const generatedSnapshot = await store.applyWorkflowAction(
        'owner-generate-mode-topics-require-questions',
        {
          action: 'generateTopics',
          draftId: draft.id,
        },
      );
      const generatedDraft = requiredDraft(generatedSnapshot.draft);
      const [generatedTopic] = generatedDraft.topics;
      if (!generatedTopic) {
        throw new Error('Expected generated source-backed topic.');
      }
      const requiredFindingCount = generatedDraft.findings.filter(
        (finding) => finding.id === `finding_${draft.id}_required_questions`,
      ).length;

      return {
        missingQuestionsError,
        questionAudienceBeforeTopics: requiredDraft(sourceSnapshot.draft).questions.audience,
        requiredFindingCount,
        sourceFindingCount: generatedDraft.findings.filter(
          (finding) => finding.id === `finding_${generatedTopic.id}_source_support`,
        ).length,
        step: generatedDraft.step,
        topicCount: generatedDraft.topics.length,
        topicRunStatus: generatedDraft.aiRuns.find((run) => run.type === 'topic_generation')
          ?.status,
      };
    } finally {
      await cleanup();
    }
  },

  async fullAiBuildCourse() {
    const { cleanup, store } = await createHarness();
    try {
      const draft = await createDraft(store, 'owner-full-ai-build', 'Full AI source course');
      await store.applyWorkflowAction('owner-full-ai-build', {
        action: 'setMode',
        draftId: draft.id,
        mode: 'generate',
      });
      await store.applyWorkflowAction('owner-full-ai-build', {
        action: 'addSource',
        draftId: draft.id,
        source: {
          content:
            'fullbuild fullbuild fullbuild evidence syllabus lesson outline source-backed practice',
          name: 'Full build notes',
          type: 'notes',
        },
      });
      const builtSnapshot = await store.applyWorkflowAction('owner-full-ai-build', {
        action: 'buildFullCourse',
        draftId: draft.id,
      });
      const builtDraft = requiredDraft(builtSnapshot.draft);
      const routeSteps = {};
      for (const step of ['questions', 'topics', 'target', 'chapters', 'lessons']) {
        const routeSnapshot = await store.snapshotForRoute('owner-full-ai-build', draft.id, step);
        routeSteps[step] = requiredDraft(routeSnapshot.draft).step;
      }

      return {
        topicCount: builtDraft.topics.length,
        appliedRunTypes: builtDraft.aiRuns
          .filter((run) => run.status === 'applied')
          .map((run) => run.type)
          .toSorted(),
        chapterCount: builtDraft.chapters.length,
        confirmedChapterCount: builtDraft.chapters.filter(
          (chapter) => chapter.status === 'confirmed',
        ).length,
        lessonCount: builtDraft.chapters.flatMap((chapter) => chapter.lessons).length,
        questionOutcome: builtDraft.questions.outcome,
        routeSteps,
        step: builtDraft.step,
        targetProfile: builtDraft.targetLearner.profile,
      };
    } finally {
      await cleanup();
    }
  },

  async chapterReviewGate() {
    const { cleanup, store } = await createHarness();
    try {
      const draft = await createDraft(store, 'owner-chapter-review-gate', 'Review gated course');
      await addNotesSource(
        store,
        'owner-chapter-review-gate',
        draft.id,
        'Chapter review evidence',
        'chapter review gates source evidence before generating lessons',
      );
      await store.applyWorkflowAction('owner-chapter-review-gate', {
        action: 'saveQuestions',
        draftId: draft.id,
        questions: questions({
          outcome: 'teach review gates before lesson generation',
          practice: 'confirm generated chapters before drafting lessons',
        }),
      });
      await store.applyWorkflowAction('owner-chapter-review-gate', {
        action: 'addTopic',
        description: 'Use review gates before generating lessons.',
        draftId: draft.id,
        name: 'Chapter review',
      });
      const topicSnapshot = await store.snapshotFor('owner-chapter-review-gate');
      const topicDraft = requiredDraft(topicSnapshot.draft);
      const [topic] = topicDraft.topics;
      if (!topic) {
        throw new Error('Expected manual topic for chapter review gate.');
      }
      await store.applyWorkflowAction('owner-chapter-review-gate', {
        action: 'confirmTarget',
        draftId: draft.id,
        targetLearner: targetLearner(),
      });
      const generatedSnapshot = await store.applyWorkflowAction('owner-chapter-review-gate', {
        action: 'generateChapters',
        draftId: draft.id,
      });
      const confirmedSnapshot = await store.applyWorkflowAction('owner-chapter-review-gate', {
        action: 'confirmChapters',
        draftId: draft.id,
      });

      return {
        confirmedChapterRunStatus: requiredDraft(confirmedSnapshot.draft).aiRuns.find(
          (run) => run.type === 'chapter_generation',
        )?.status,
        confirmedStep: requiredDraft(confirmedSnapshot.draft).step,
        generatedChapterCount: requiredDraft(generatedSnapshot.draft).chapters.length,
        generatedChapterRunStatus: requiredDraft(generatedSnapshot.draft).aiRuns.find(
          (run) => run.type === 'chapter_generation',
        )?.status,
        generatedStep: requiredDraft(generatedSnapshot.draft).step,
      };
    } finally {
      await cleanup();
    }
  },

  async unauthenticatedApi() {
    const { cleanup, coursitionEffectHandler } = await createHarness();
    try {
      const response = await coursitionEffectHandler.handler(
        new Request('http://localhost/coursition/workflow', {
          body: JSON.stringify({ action: 'getState' }),
          headers: {
            'content-type': 'application/json',
          },
          method: 'POST',
        }),
      );
      return {
        body: await response.json(),
        isResponse: response instanceof Response,
        status: response.status,
      };
    } finally {
      await cleanup();
    }
  },
};

const main = async () => {
  const scenarioName = process.argv.at(2);
  const scenario = scenarios[scenarioName];

  if (!scenario) {
    throw new Error(`Unknown workflow test scenario: ${scenarioName ?? '<missing>'}`);
  }

  const result = await scenario();
  process.stdout.write(JSON.stringify(result));
};

void (async () => {
  try {
    await main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  }
})();
