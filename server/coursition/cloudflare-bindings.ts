import { importAtRuntime } from './runtime-import.ts';

export interface CoursitionCloudflareAi {
  toMarkdown: (
    document: { blob: Blob; name: string },
    options: {
      conversionOptions: {
        output: { format: 'text' };
        pdf: { metadata: false };
      };
    },
  ) => Promise<
    | {
        data?: string;
        error?: string;
        format: 'error' | 'markdown' | 'text';
        id: string;
        mimeType?: string;
        mimetype?: string;
        name: string;
        tokens?: number;
      }
    | {
        data?: string;
        error?: string;
        format: 'error' | 'markdown' | 'text';
        id: string;
        mimeType?: string;
        mimetype?: string;
        name: string;
        tokens?: number;
      }[]
  >;
}

export interface CoursitionCloudflareBindings {
  AI?: CoursitionCloudflareAi;
  COURSITION_DB: D1Database;
  COURSITION_SOURCE_BUCKET: R2Bucket;
}

const isCoursitionCloudflareBindings = (
  value: Partial<CoursitionCloudflareBindings>,
): value is CoursitionCloudflareBindings =>
  value.COURSITION_DB !== undefined && value.COURSITION_SOURCE_BUCKET !== undefined;

/** Resolve bindings through Cloudflare's native module-runtime environment. */
export const coursitionCloudflareBindings = () =>
  importAtRuntime<{ env: unknown }>('cloudflare:workers').then(({ env }) => {
    const bindings = env as Partial<CoursitionCloudflareBindings>;
    if (!isCoursitionCloudflareBindings(bindings)) {
      throw new Error('Coursition Cloudflare D1 and R2 bindings are unavailable.');
    }
    return bindings;
  });

/** Resolve Workers AI separately so D1/R2 consumers remain usable without an AI binding. */
export const coursitionCloudflareAi = () =>
  coursitionCloudflareBindings().then((bindings) => {
    if (bindings.AI === undefined) {
      throw new Error('Coursition Cloudflare Workers AI binding is unavailable.');
    }
    return bindings.AI;
  });
