/* Browser-side AnyDoc extraction. Converting an uploaded document to Markdown
 * in the visitor's own tab keeps ordinary files away from the cloud converter,
 * so the upload stays local until the server re-verifies the result. The whole
 * path is opportunistic: every failure, unsupported format, or slow conversion
 * resolves to null and the unchanged server pipeline takes over. */
import * as Data from 'effect/Data';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';

import type { AnydocExtraction, AnydocFormat } from '@shared/api';
import { ANYDOC_WASM_VERSION, MAX_ANYDOC_MARKDOWN_CHARS } from '@shared/api';

/* A dedicated worker cannot be interrupted from the outside, so the deadline is
 * enforced by terminating it. */
export const ANYDOC_EXTRACTION_TIMEOUT_MS = 15_000;

export interface AnydocWorkerRequest {
  readonly buffer: ArrayBuffer;
  readonly format: AnydocFormat;
}

export type AnydocWorkerResponse =
  | { readonly contentMarkdown: string; readonly ok: true }
  | { readonly ok: false };

export interface AnydocWorkerHandle {
  readonly addEventListener: (
    type: string,
    listener: (event: MessageEvent<AnydocWorkerResponse>) => void,
    options?: { once?: boolean },
  ) => void;
  readonly postMessage: (message: AnydocWorkerRequest, transfer: Transferable[]) => void;
  readonly terminate: () => void;
}

export interface AnydocExtractionOptions {
  readonly createWorker?: () => AnydocWorkerHandle;
}

class AnydocExtractionError extends Data.TaggedError('AnydocExtractionError')<{
  readonly cause: unknown;
}> {}

/* Only the extensions that name a format exactly. Container variants such as
 * `.docm` share a parser but carry a different media type, which the server's
 * format/media-type cross-check would reject. */
const anydocFormatByExtension: Readonly<Record<string, AnydocFormat>> = {
  csv: 'csv',
  doc: 'doc',
  docx: 'docx',
  epub: 'epub',
  odp: 'odp',
  ods: 'ods',
  odt: 'odt',
  pdf: 'pdf',
  ppt: 'ppt',
  pptx: 'pptx',
  rtf: 'rtf',
  xlsx: 'xlsx',
};

const anydocSha256Pattern = /^[0-9a-f]{64}$/u;

export const anydocFormatFromFileName = (name: string): AnydocFormat | null => {
  const separatorIndex = name.lastIndexOf('.');
  if (separatorIndex <= 0 || separatorIndex === name.length - 1) {
    return null;
  }
  return anydocFormatByExtension[name.slice(separatorIndex + 1).toLowerCase()] ?? null;
};

export const markdownFromAnydocWorkerResponse = (
  response: AnydocWorkerResponse | undefined,
): string | null => (response !== undefined && response.ok ? response.contentMarkdown : null);

export const anydocExtractionPayload = (input: {
  readonly contentMarkdown: string;
  readonly format: AnydocFormat;
  readonly sourceSha256: string;
}): AnydocExtraction | null => {
  if (
    input.contentMarkdown.trim().length === 0 ||
    input.contentMarkdown.length > MAX_ANYDOC_MARKDOWN_CHARS ||
    !anydocSha256Pattern.test(input.sourceSha256)
  ) {
    return null;
  }
  return {
    contentMarkdown: input.contentMarkdown,
    format: input.format,
    processor: 'anydoc_wasm',
    sourceSha256: input.sourceSha256,
    version: ANYDOC_WASM_VERSION,
  };
};

export const anydocExtractionSupported = () =>
  typeof globalThis.Worker === 'function' &&
  globalThis.window !== undefined &&
  typeof globalThis.crypto?.subtle?.digest === 'function';

const sha256Hex = (buffer: ArrayBuffer) =>
  Effect.tryPromise({
    catch: (cause) => new AnydocExtractionError({ cause }),
    try: () => globalThis.crypto.subtle.digest('SHA-256', buffer),
  }).pipe(
    Effect.map((digest) =>
      [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join(''),
    ),
  );

/* The WASM module and the worker glue only load once a supported file is
 * actually converted, so neither reaches the initial bundle. */
const loadWorkerFactory = Effect.tryPromise({
  catch: (cause) => new AnydocExtractionError({ cause }),
  try: () => import('./anydoc-extraction-worker-host'),
}).pipe(Effect.map((module) => module.createAnydocWorker));

const runExtractionWorker = (
  createWorker: () => AnydocWorkerHandle,
  buffer: ArrayBuffer,
  format: AnydocFormat,
) =>
  Effect.acquireUseRelease(
    Effect.try({ catch: (cause) => new AnydocExtractionError({ cause }), try: createWorker }),
    (worker) =>
      Effect.callback<string | null, AnydocExtractionError>((resume) => {
        worker.addEventListener(
          'message',
          (event) => {
            resume(Effect.succeed(markdownFromAnydocWorkerResponse(event.data)));
          },
          { once: true },
        );
        worker.addEventListener(
          'error',
          () => {
            resume(Effect.succeed(null));
          },
          { once: true },
        );
        worker.addEventListener(
          'messageerror',
          () => {
            resume(Effect.succeed(null));
          },
          { once: true },
        );
        try {
          worker.postMessage({ buffer, format }, [buffer]);
        } catch (error) {
          resume(Effect.fail(new AnydocExtractionError({ cause: error })));
        }
      }),
    (worker) =>
      Effect.sync(() => {
        worker.terminate();
      }),
  ).pipe(
    Effect.timeoutOption(Duration.millis(ANYDOC_EXTRACTION_TIMEOUT_MS)),
    Effect.map(Option.getOrElse(() => null)),
  );

export const extractAnydocFromFile = (
  file: File,
  options: AnydocExtractionOptions = {},
): Effect.Effect<AnydocExtraction | null> =>
  Effect.gen(function* anydocExtractionProgram() {
    const format = anydocFormatFromFileName(file.name);
    if (format === null) {
      return null;
    }
    if (options.createWorker === undefined && !anydocExtractionSupported()) {
      return null;
    }
    const createWorker = options.createWorker ?? (yield* loadWorkerFactory);
    const buffer = yield* Effect.tryPromise({
      catch: (cause) => new AnydocExtractionError({ cause }),
      try: () => file.arrayBuffer(),
    });
    /* The digest is taken before the buffer is transferred to the worker, which
     * detaches it on this side. */
    const sourceSha256 = yield* sha256Hex(buffer);
    const contentMarkdown = yield* runExtractionWorker(createWorker, buffer, format);
    return contentMarkdown === null
      ? null
      : anydocExtractionPayload({ contentMarkdown, format, sourceSha256 });
  }).pipe(Effect.orElseSucceed(() => null));
