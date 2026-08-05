/* eslint-disable promise/avoid-new, promise/no-multiple-resolved, promise/param-names, promise/prefer-await-to-callbacks -- Node HTTP server lifecycle is callback-based; explicit promises make the local provider fixture awaitable and ensure cleanup. */
import http from 'node:http';
import { afterEach, describe, expect, test } from '@rstest/core';
import { Effect, Option } from 'effect';
import { FetchHttpClient } from 'effect/unstable/http';
import { ANYDOC_WASM_VERSION, MAX_ANYDOC_MARKDOWN_CHARS } from '../shared/api.ts';
import type { CourseDraft } from '../shared/coursition/workflow.ts';
import { emptyCourseContent, emptyLearningBlueprint } from '../shared/coursition/workflow.ts';
import { inMemoryDraftRepository } from '../server/coursition/local-draft-repository.ts';
import { inMemorySourceBlobStore } from '../server/coursition/source-blob-store.ts';
import { processSource } from '../server/coursition/source-processing.ts';
import {
  applyWorkflowAction,
  resetStorageAdapters,
  setStorageAdapters,
} from '../server/coursition/store.ts';

const pdfBytes = new TextEncoder().encode('%PDF-1.7\nCoursition AnyDoc fixture');

const sha256Hex = async (bytes: Uint8Array) => {
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes).buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

const extractionFor = async (
  bytes: Uint8Array,
  overrides: Partial<{
    contentMarkdown: string;
    format: 'docx' | 'pdf';
    sourceSha256: string;
    version: string;
  }> = {},
) => ({
  contentMarkdown: '# Local document\n\nVerified content.',
  format: 'pdf' as const,
  processor: 'anydoc_wasm' as const,
  sourceSha256: await sha256Hex(bytes),
  version: ANYDOC_WASM_VERSION,
  ...overrides,
});

const processPdf = async (
  localExtraction: Awaited<ReturnType<typeof extractionFor>> | undefined,
  options: { storageReference?: string } = {},
) => {
  let converterCalls = 0;
  let writes = 0;
  const result = await Effect.runPromise(
    processSource(
      {
        convertDocument: (_sourceName, binary) => {
          converterCalls += 1;
          return Effect.succeed({
            content: 'Cloud fallback',
            mimeType: binary.mimeType,
            processor: 'cloud_converter',
          });
        },
        deleteSourceBlob: () => Effect.void,
        newSourceId: () => 'source_anydoc',
        now: () => '2026-08-05T12:00:00.000Z',
        writeSourceBlob: () => {
          writes += 1;
          return Effect.succeed('r2:source-assets/course_anydoc/source_anydoc.bin');
        },
      },
      'course_anydoc',
      {
        content: `data:application/pdf;base64,${pdfBytes.toBase64()}`,
        ...(localExtraction === undefined ? {} : { localExtraction }),
        name: 'guide.pdf',
        type: 'file',
        ...options,
      },
    ),
  );
  return { converterCalls, result, writes };
};

const draft = (): CourseDraft => {
  const timestamp = '2026-08-05T12:00:00.000Z';
  return {
    aiRuns: [],
    courseContent: emptyCourseContent(),
    createdAt: timestamp,
    derivedSourceDocuments: [],
    findings: [],
    id: 'course_anydoc_retry',
    knowledgeChunks: [],
    language: 'en',
    learningBlueprint: emptyLearningBlueprint('en'),
    mode: 'assist',
    ownerId: 'owner_anydoc_retry',
    revision: 0,
    sourceProcessingIncomplete: false,
    sources: [],
    step: 'sources',
    title: 'AnyDoc retry',
    updatedAt: timestamp,
  };
};

const createLlamaParseServer = () =>
  new Promise<{
    close: () => Promise<void>;
    uploadCount: () => number;
    url: string;
  }>((resolve, reject) => {
    let uploads = 0;
    const server = http.createServer((request, response) => {
      response.setHeader('access-control-allow-headers', 'authorization, content-type');
      response.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
      response.setHeader('access-control-allow-origin', '*');
      if (request.method === 'OPTIONS') {
        response.writeHead(204).end();
        return;
      }
      if (request.method === 'POST' && request.url === '/api/v1/beta/files') {
        request.resume();
        request.on('end', () => {
          uploads += 1;
          response.writeHead(200, { 'content-type': 'application/json' });
          response.end(JSON.stringify({ id: `file-${uploads}` }));
        });
        return;
      }
      if (request.method === 'POST' && request.url === '/api/v2/parse') {
        request.resume();
        request.on('end', () => {
          response.writeHead(200, { 'content-type': 'application/json' });
          response.end(JSON.stringify({ id: `job-${uploads}` }));
        });
        return;
      }
      if (request.method === 'GET' && request.url?.startsWith('/api/v2/parse/job-')) {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(
          JSON.stringify({
            job: { id: `job-${uploads}`, status: 'COMPLETED' },
            markdown: {
              pages: [{ markdown: '# Retried cloud document', page_number: 1, success: true }],
            },
          }),
        );
        return;
      }
      response.writeHead(404).end();
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address === null || typeof address === 'string') {
        reject(new Error('Expected local LlamaParse server port.'));
        return;
      }
      resolve({
        close: () =>
          new Promise((closeResolve, closeReject) => {
            server.close((error) => (error ? closeReject(error) : closeResolve()));
          }),
        uploadCount: () => uploads,
        url: `http://127.0.0.1:${address.port}`,
      });
    });
  });

afterEach(() => resetStorageAdapters());

describe('Coursition AnyDoc server trust boundary', () => {
  test('uses a verified local extraction without calling the cloud converter', async () => {
    let converterCalls = 0;
    let writes = 0;
    const sourceSha256 = await sha256Hex(pdfBytes);
    const result = await Effect.runPromise(
      processSource(
        {
          convertDocument: () => {
            converterCalls += 1;
            return Effect.succeed({ content: 'Cloud fallback' });
          },
          deleteSourceBlob: () => Effect.void,
          newSourceId: () => 'source_anydoc_valid',
          now: () => '2026-08-05T12:00:00.000Z',
          writeSourceBlob: (_draftId, _sourceId, bytes) => {
            writes += 1;
            expect(bytes).toEqual(pdfBytes);
            return Effect.succeed('r2:source-assets/course_anydoc/source_anydoc_valid.bin');
          },
        },
        'course_anydoc',
        {
          content: `data:application/pdf;base64,${pdfBytes.toBase64()}`,
          localExtraction: {
            contentMarkdown: '# Local document\n\nVerified content.',
            format: 'pdf',
            processor: 'anydoc_wasm',
            sourceSha256,
            version: ANYDOC_WASM_VERSION,
          },
          name: 'guide.pdf',
          type: 'file',
        },
      ),
    );

    expect(result).toMatchObject({
      content: '# Local document\n\nVerified content.',
      mimeType: 'application/pdf',
      processor: 'anydoc_wasm',
      status: 'processed',
      storageReference: 'r2:source-assets/course_anydoc/source_anydoc_valid.bin',
    });
    expect(result.providerJobId).toBeUndefined();
    expect(converterCalls).toBe(0);
    expect(writes).toBe(1);
  });

  test.each([
    ['hash mismatch', { sourceSha256: '0'.repeat(64) }],
    ['wrong version', { version: '0.1.3' }],
    ['format and MIME mismatch', { format: 'docx' as const }],
    ['empty markdown', { contentMarkdown: '   ' }],
    ['oversized markdown', { contentMarkdown: 'x'.repeat(MAX_ANYDOC_MARKDOWN_CHARS + 1) }],
  ])('ignores %s and falls back to the cloud converter', async (_caseName, overrides) => {
    const { converterCalls, result, writes } = await processPdf(
      await extractionFor(pdfBytes, overrides),
    );

    expect(result).toMatchObject({
      content: 'Cloud fallback',
      mimeType: 'application/pdf',
      processor: 'cloud_converter',
      status: 'processed',
      storageReference: 'r2:source-assets/course_anydoc/source_anydoc.bin',
    });
    expect(converterCalls).toBe(1);
    expect(writes).toBe(1);
  });

  test('preserves an existing R2 reference without rewriting the file', async () => {
    const existingReference = 'r2:source-assets/course_anydoc/existing.bin';
    const { converterCalls, result, writes } = await processPdf(await extractionFor(pdfBytes), {
      storageReference: existingReference,
    });

    expect(result.storageReference).toBe(existingReference);
    expect(result.processor).toBe('anydoc_wasm');
    expect(converterCalls).toBe(0);
    expect(writes).toBe(0);
  });

  test('does not apply local extraction behavior to notes or URL sources', async () => {
    let converterCalls = 0;
    const deps = {
      convertDocument: () => {
        converterCalls += 1;
        return Effect.succeed({ content: 'Unexpected converter result' });
      },
      deleteSourceBlob: () => Effect.void,
      newSourceId: (_draftId: string) => crypto.randomUUID(),
      now: () => '2026-08-05T12:00:00.000Z',
      writeSourceBlob: () => Effect.succeed('unexpected'),
    };
    const notes = await Effect.runPromise(
      processSource(deps, 'course_anydoc', {
        content: '  Creator notes  ',
        name: 'Notes',
        type: 'notes',
      }),
    );
    const invalidUrl = await Effect.runPromise(
      processSource(deps, 'course_anydoc', {
        content: 'not a URL',
        name: 'URL input',
        type: 'url',
      }),
    );

    expect(notes).toMatchObject({ content: 'Creator notes', processor: 'raw_text' });
    expect(invalidUrl).toMatchObject({ content: 'not a URL', processor: 'url_cleaner' });
    expect(converterCalls).toBe(0);
  });

  test('leaves audio files on their existing processor path', async () => {
    const audioBytes = new TextEncoder().encode('RIFF$\0\0\0WAVEfmt ');
    const previousApiKey = process.env['DEEPGRAM_API_KEY'];
    delete process.env['DEEPGRAM_API_KEY'];
    let converterCalls = 0;
    const result = await Effect.runPromise(
      processSource(
        {
          convertDocument: () => {
            converterCalls += 1;
            return Effect.succeed({ content: 'Unexpected document conversion' });
          },
          deleteSourceBlob: () => Effect.void,
          newSourceId: () => 'source_audio',
          now: () => '2026-08-05T12:00:00.000Z',
          writeSourceBlob: () => Effect.succeed('r2:source-assets/course_anydoc/audio.bin'),
        },
        'course_anydoc',
        {
          content: `data:audio/wav;base64,${audioBytes.toBase64()}`,
          name: 'recording.wav',
          type: 'file',
        },
      ).pipe(Effect.provide(FetchHttpClient.layer)),
    );

    expect(result).toMatchObject({ processor: 'deepgram_audio', status: 'failed' });
    expect(converterCalls).toBe(0);
    if (previousApiKey !== undefined) {
      process.env['DEEPGRAM_API_KEY'] = previousApiKey;
    }
  });

  test('retry uses stored bytes and the cloud converter without local extraction', async () => {
    const server = await createLlamaParseServer();
    const previousApiKey = process.env['LLAMA_CLOUD_API_KEY'];
    const previousBaseUrl = process.env['LLAMA_CLOUD_BASE_URL'];
    process.env['LLAMA_CLOUD_API_KEY'] = 'test-key';
    process.env['LLAMA_CLOUD_BASE_URL'] = server.url;
    const repository = inMemoryDraftRepository();
    const blobStore = inMemorySourceBlobStore();
    setStorageAdapters(repository, blobStore);
    const reference = await Effect.runPromise(
      blobStore.write(draft().id, 'source_retry', pdfBytes),
    );
    const created = await Effect.runPromise(
      repository.create({
        ...draft(),
        sources: [
          {
            content: '',
            createdAt: '2026-08-05T12:00:00.000Z',
            failureReason: 'Initial conversion failed.',
            id: 'source_retry',
            mimeType: 'application/pdf',
            name: 'retry.pdf',
            processor: 'llamaparse_document',
            sizeLabel: `${pdfBytes.byteLength} bytes`,
            status: 'failed',
            storageReference: reference,
            type: 'file',
          },
        ],
      }),
    );

    try {
      const retried = await applyWorkflowAction(created.ownerId, {
        action: 'retrySource',
        draftId: created.id,
        expectedRevision: created.revision,
        operationId: 'operation_retry_anydoc',
        sourceId: 'source_retry',
      });
      const source = retried.draft?.sources.find((candidate) => candidate.id === 'source_retry');

      expect(source).toMatchObject({
        content: '# Retried cloud document',
        processor: 'llamaparse_document',
        status: 'processed',
        storageReference: reference,
      });
      expect(server.uploadCount()).toBe(1);
      expect(Option.isSome(await Effect.runPromise(blobStore.read(reference)))).toBe(true);
    } finally {
      if (previousApiKey === undefined) {
        delete process.env['LLAMA_CLOUD_API_KEY'];
      } else {
        process.env['LLAMA_CLOUD_API_KEY'] = previousApiKey;
      }
      if (previousBaseUrl === undefined) {
        delete process.env['LLAMA_CLOUD_BASE_URL'];
      } else {
        process.env['LLAMA_CLOUD_BASE_URL'] = previousBaseUrl;
      }
      await server.close();
    }
  });
});
