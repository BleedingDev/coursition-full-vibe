/* eslint-disable unicorn/require-post-message-target-origin -- A dedicated worker's own postMessage has no target-origin parameter. */
/* Dedicated AnyDoc worker. The WASM converter runs off the main thread so a
 * large document never blocks the upload form, and the host terminates this
 * worker outright when the conversion overruns its deadline. */
import type { AnydocWorkerRequest, AnydocWorkerResponse } from './anydoc-extraction';

interface AnydocWorkerScope {
  readonly addEventListener: (
    type: 'message',
    listener: (event: MessageEvent<AnydocWorkerRequest>) => void,
  ) => void;
  readonly postMessage: (message: AnydocWorkerResponse) => void;
}

const scope = globalThis as unknown as AnydocWorkerScope;

const convert = (request: AnydocWorkerRequest) =>
  import('@firecrawl/anydoc-wasm').then((anydoc) =>
    anydoc
      .default()
      .then(() => anydoc.toMarkdownBytes(new Uint8Array(request.buffer), request.format)),
  );

scope.addEventListener('message', (event) => {
  convert(event.data)
    .then((contentMarkdown) => {
      scope.postMessage({ contentMarkdown, ok: true });
    })
    .catch(() => {
      scope.postMessage({ ok: false });
    });
});
