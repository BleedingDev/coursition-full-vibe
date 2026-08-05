/* Isolated so the worker URL — and with it the emitted worker chunk and its
 * WASM asset — is only reached through the lazy dynamic import in
 * `anydoc-extraction.ts`. */
import type { AnydocWorkerHandle } from './anydoc-extraction';

export const createAnydocWorker = (): AnydocWorkerHandle =>
  new Worker(new URL('anydoc-extraction.worker.ts', import.meta.url), {
    name: 'coursition-anydoc',
    type: 'module',
  });
