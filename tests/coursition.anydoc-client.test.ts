import { describe, expect, test } from '@rstest/core';
import { Effect } from 'effect';

import { ANYDOC_WASM_VERSION, MAX_ANYDOC_MARKDOWN_CHARS } from '../shared/api.ts';
import type {
  AnydocWorkerHandle,
  AnydocWorkerRequest,
  AnydocWorkerResponse,
} from '../src/features/coursition/anydoc-extraction.ts';
import {
  anydocExtractionPayload,
  anydocFormatFromFileName,
  extractAnydocFromFile,
  markdownFromAnydocWorkerResponse,
} from '../src/features/coursition/anydoc-extraction.ts';

const validSha256 = 'a'.repeat(64);
/* The worker is terminated before it answers on the timeout path, which leaves
 * the response undefined. */
const noWorkerResponse = ((): AnydocWorkerResponse | undefined => undefined)();

interface FakeWorker extends AnydocWorkerHandle {
  readonly requests: AnydocWorkerRequest[];
  terminated: number;
}

const fakeWorker = (respond: (request: AnydocWorkerRequest) => AnydocWorkerResponse | null) => {
  const listeners = new Map<string, (event: MessageEvent<AnydocWorkerResponse>) => void>();
  const worker: FakeWorker = {
    addEventListener: (type, listener) => {
      listeners.set(type, listener);
    },
    postMessage: (message) => {
      worker.requests.push(message);
      const response = respond(message);
      if (response !== null) {
        listeners.get('message')?.({ data: response } as MessageEvent<AnydocWorkerResponse>);
      }
    },
    requests: [],
    terminate: () => {
      worker.terminated += 1;
    },
    terminated: 0,
  };
  return worker;
};

const documentFile = (name: string) =>
  new File([new Uint8Array([1, 2, 3, 4])], name, { type: 'application/pdf' });

describe('Coursition AnyDoc browser extraction', () => {
  test('maps only extensions that name an AnyDoc format', () => {
    expect(anydocFormatFromFileName('guide.pdf')).toBe('pdf');
    expect(anydocFormatFromFileName('Report.DOCX')).toBe('docx');
    expect(anydocFormatFromFileName('sheet.xlsx')).toBe('xlsx');
    expect(anydocFormatFromFileName('notes.txt')).toBeNull();
    expect(anydocFormatFromFileName('macro.docm')).toBeNull();
    expect(anydocFormatFromFileName('archive')).toBeNull();
    expect(anydocFormatFromFileName('.pdf')).toBeNull();
    expect(anydocFormatFromFileName('trailing.')).toBeNull();
  });

  test('reads Markdown only from a successful worker response', () => {
    expect(markdownFromAnydocWorkerResponse({ contentMarkdown: '# Guide', ok: true })).toBe(
      '# Guide',
    );
    expect(markdownFromAnydocWorkerResponse({ ok: false })).toBeNull();
    expect(markdownFromAnydocWorkerResponse(noWorkerResponse)).toBeNull();
  });

  test('builds the pinned payload shape for usable Markdown', () => {
    expect(
      anydocExtractionPayload({
        contentMarkdown: '# Guide\n\nBody.',
        format: 'pdf',
        sourceSha256: validSha256,
      }),
    ).toEqual({
      contentMarkdown: '# Guide\n\nBody.',
      format: 'pdf',
      processor: 'anydoc_wasm',
      sourceSha256: validSha256,
      version: ANYDOC_WASM_VERSION,
    });
  });

  test('rejects empty, oversized, and badly digested extractions', () => {
    expect(
      anydocExtractionPayload({
        contentMarkdown: '   \n  ',
        format: 'pdf',
        sourceSha256: validSha256,
      }),
    ).toBeNull();
    expect(
      anydocExtractionPayload({
        contentMarkdown: 'x'.repeat(MAX_ANYDOC_MARKDOWN_CHARS + 1),
        format: 'docx',
        sourceSha256: validSha256,
      }),
    ).toBeNull();
    expect(
      anydocExtractionPayload({
        contentMarkdown: '# Guide',
        format: 'docx',
        sourceSha256: validSha256.toUpperCase(),
      }),
    ).toBeNull();
    expect(
      anydocExtractionPayload({ contentMarkdown: '# Guide', format: 'docx', sourceSha256: 'abc' }),
    ).toBeNull();
  });

  test('extracts through the worker and terminates it', async () => {
    const worker = fakeWorker(() => ({ contentMarkdown: '# Local guide', ok: true }));
    const extraction = await Effect.runPromise(
      extractAnydocFromFile(documentFile('guide.pdf'), { createWorker: () => worker }),
    );

    expect(extraction).toMatchObject({
      contentMarkdown: '# Local guide',
      format: 'pdf',
      processor: 'anydoc_wasm',
      version: ANYDOC_WASM_VERSION,
    });
    expect(extraction?.sourceSha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(worker.requests[0]?.format).toBe('pdf');
    expect(worker.terminated).toBe(1);
  });

  test('returns null for an unsupported extension without starting a worker', async () => {
    let created = 0;
    const extraction = await Effect.runPromise(
      extractAnydocFromFile(documentFile('notes.txt'), {
        createWorker: () => {
          created += 1;
          return fakeWorker(() => ({ ok: false }));
        },
      }),
    );

    expect(extraction).toBeNull();
    expect(created).toBe(0);
  });

  test('returns null when the worker reports a failure', async () => {
    const worker = fakeWorker(() => ({ ok: false }));
    const extraction = await Effect.runPromise(
      extractAnydocFromFile(documentFile('guide.pdf'), { createWorker: () => worker }),
    );

    expect(extraction).toBeNull();
    expect(worker.terminated).toBe(1);
  });

  test('returns null when the worker yields empty Markdown', async () => {
    const worker = fakeWorker(() => ({ contentMarkdown: '  \n ', ok: true }));

    expect(
      await Effect.runPromise(
        extractAnydocFromFile(documentFile('guide.pdf'), { createWorker: () => worker }),
      ),
    ).toBeNull();
  });

  test('returns null when starting the worker throws', async () => {
    const extraction = await Effect.runPromise(
      extractAnydocFromFile(documentFile('guide.pdf'), {
        createWorker: () => {
          throw new Error('Worker unavailable');
        },
      }),
    );

    expect(extraction).toBeNull();
  });

  test('terminates the worker and returns null when the conversion never answers', async () => {
    const worker = fakeWorker(() => null);
    const extraction = await Effect.runPromise(
      extractAnydocFromFile(documentFile('guide.pdf'), { createWorker: () => worker }),
    );

    expect(extraction).toBeNull();
    expect(worker.terminated).toBe(1);
  }, 30_000);
});
