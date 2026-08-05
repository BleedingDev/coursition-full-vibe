import { Data, Effect, Option, Schema } from 'effect';
import { HttpClient, HttpClientRequest } from 'effect/unstable/http';
import { fileTypeFromBuffer } from 'file-type';
import { lookup as lookupMimeType } from 'mime-types';
import {
  ANYDOC_WASM_VERSION,
  MAX_ANYDOC_MARKDOWN_CHARS,
  MAX_SOURCE_FILE_BYTES,
} from '../../shared/api.ts';
import type { AnydocExtraction, AnydocFormat } from '../../shared/api.ts';
import type { SourceAsset, WorkflowAction } from '../../shared/coursition/workflow.ts';
import { coursitionCloudflareAi } from './cloudflare-bindings.ts';
import { loadCoursitionSourceProviderConfig, providerKeyConfigured } from './config.ts';

/*
 * Source Material processing. Turning a creator's raw input (notes, URLs,
 * uploaded files) into processed SourceAsset content is its own concern with
 * its own external adapters: LlamaParse for documents, Deepgram for audio, and
 * a Firecrawl -> Tavily -> Exa fallback chain for the web. It is written in
 * idiomatic Effect: HTTP goes through HttpClient, failures are a tagged
 * SourceProcessingError, and the only requirement is the HttpClient service.
 * The Course Draft store owns persistence and identifiers, so it passes in
 * writeSourceBlob, now, and newSourceId; this module never reaches into storage
 * or ambient clocks itself.
 */

export class SourceProcessingError extends Data.TaggedError('SourceProcessingError')<{
  readonly message: string;
}> {}

export interface FileSourcePayload {
  bytes: Uint8Array;
  declaredMimeType: string;
}

export interface BinarySourcePayload {
  bytes: Uint8Array;
  mimeType: string;
}

interface DocumentConversionResult {
  content: string;
  mimeType?: string;
  processor?: string;
  providerJobId?: string;
  storageReference?: string;
}

type DocumentConverter = (
  sourceName: string,
  binary: BinarySourcePayload,
) => Effect.Effect<DocumentConversionResult, SourceProcessingError, HttpClient.HttpClient>;

type WorkflowSourceInput = Extract<WorkflowAction, { action: 'addSource' }>['source'];
interface ProcessSourceMetadata {
  filePayload?: FileSourcePayload | null | undefined;
  sourceId?: string | undefined;
  storageReference?: string | undefined;
}

export type ProcessSourceInput =
  | (Extract<WorkflowSourceInput, { type: 'file' }> & ProcessSourceMetadata)
  | (Exclude<WorkflowSourceInput, { type: 'file' }> & ProcessSourceMetadata);

export interface SourceProcessorDeps {
  convertDocument?: DocumentConverter;
  deleteSourceBlob: (reference: string) => Effect.Effect<void, SourceProcessingError>;
  newSourceId: (draftId: string) => string;
  now: () => string;
  writeSourceBlob: (
    draftId: string,
    sourceId: string,
    bytes: Uint8Array,
  ) => Effect.Effect<string, SourceProcessingError>;
}

const llamaParseMarkdownTiers = ['cost_effective', 'agentic', 'agentic_plus'] as const;
type LlamaParseMarkdownTier = (typeof llamaParseMarkdownTiers)[number];

const unknownRecordSchema = Schema.Record(Schema.String, Schema.Unknown);
const recordFromUnknown = Schema.decodeUnknownSync(unknownRecordSchema);
const recordOptionFromUnknown = Schema.decodeUnknownOption(unknownRecordSchema);

const sourceProviderConfig = () => loadCoursitionSourceProviderConfig();

const messageFromError = (cause: unknown): string => {
  if (cause instanceof Error && cause.message.trim().length > 0) {
    return cause.message;
  }
  return typeof cause === 'string' && cause.length > 0 ? cause : 'Source provider request failed.';
};

const toSourceError = (cause: unknown): SourceProcessingError =>
  cause instanceof SourceProcessingError
    ? cause
    : new SourceProcessingError({ message: messageFromError(cause) });

export const convertDocumentWithCloudflare = (
  sourceName: string,
  binary: BinarySourcePayload,
  resolveAi = coursitionCloudflareAi,
) =>
  Effect.gen(function* convertDocumentWithCloudflareProgram() {
    const ai = yield* Effect.tryPromise({ catch: toSourceError, try: resolveAi });
    const conversion = yield* Effect.tryPromise({
      catch: toSourceError,
      try: () =>
        ai.toMarkdown(
          {
            blob: new Blob([new Uint8Array(binary.bytes).buffer], { type: binary.mimeType }),
            name: sourceName,
          },
          {
            conversionOptions: {
              output: { format: 'text' },
              pdf: { metadata: false },
            },
          },
        ),
    });
    const result = Array.isArray(conversion) ? conversion[0] : conversion;
    if (result === undefined) {
      return yield* new SourceProcessingError({
        message: 'Cloudflare document conversion returned no result.',
      });
    }
    if (result.format === 'error') {
      return yield* new SourceProcessingError({
        message: result.error ?? 'Cloudflare document conversion failed.',
      });
    }
    const content = result.data?.trim() ?? '';
    if (content.length === 0) {
      return yield* new SourceProcessingError({
        message: 'Cloudflare document conversion returned no readable text.',
      });
    }
    return {
      content,
      mimeType: result.mimeType ?? result.mimetype ?? binary.mimeType,
      processor: 'cloudflare_markdown',
      providerJobId: result.id,
    };
  });

const localTextMimeTypes = new Set([
  'application/json',
  'application/ld+json',
  'application/rtf',
  'application/xhtml+xml',
  'application/xml',
  'application/yaml',
]);

const llamaParseMimeTypes = new Set([
  'application/msword',
  'application/pdf',
  'application/vnd.ms-powerpoint',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const processorFor = (sourceType: SourceAsset['type']) => {
  if (sourceType === 'url') {
    return 'url_cleaner';
  }
  if (sourceType === 'notes') {
    return 'raw_text';
  }
  return 'local_text';
};

const sourceProcessorForMimeType = (mimeType: string | undefined, allowLocalText: boolean) => {
  if (typeof mimeType !== 'string' || mimeType.length === 0) {
    return 'unsupported_file';
  }
  if (allowLocalText && (mimeType.startsWith('text/') || localTextMimeTypes.has(mimeType))) {
    return 'local_text';
  }
  if (llamaParseMimeTypes.has(mimeType)) {
    return 'llamaparse_document';
  }
  if (mimeType.startsWith('audio/')) {
    return 'deepgram_audio';
  }
  if (mimeType.startsWith('video/')) {
    return 'deepgram_video';
  }
  if (mimeType.startsWith('image/')) {
    return 'image_text_extractor';
  }
  return 'unsupported_file';
};

const mimeTypeFromFileName = (name: string) => {
  const mimeType = lookupMimeType(name);
  return typeof mimeType === 'string' ? mimeType : undefined;
};

const processorForVerifiedBinary = (verifiedMimeType: string | undefined) => {
  const processor = sourceProcessorForMimeType(verifiedMimeType, false);
  return processor === 'local_text' ? 'unsupported_file' : processor;
};

const detectBinaryMimeType = (bytes: Uint8Array) =>
  Effect.tryPromise({ catch: toSourceError, try: () => fileTypeFromBuffer(bytes) }).pipe(
    Effect.map((result) => result?.mime),
  );

const anydocMimeTypesByFormat: Readonly<Record<AnydocFormat, readonly string[]>> = {
  csv: ['text/csv'],
  doc: ['application/msword', 'application/x-cfb'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  epub: ['application/epub+zip'],
  odp: ['application/vnd.oasis.opendocument.presentation'],
  ods: ['application/vnd.oasis.opendocument.spreadsheet'],
  odt: ['application/vnd.oasis.opendocument.text'],
  pdf: ['application/pdf'],
  ppt: ['application/vnd.ms-powerpoint', 'application/x-cfb'],
  pptx: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  rtf: ['application/rtf', 'text/rtf'],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
};

const sha256Hex = (bytes: Uint8Array) =>
  Effect.tryPromise({
    catch: toSourceError,
    try: () => crypto.subtle.digest('SHA-256', new Uint8Array(bytes).buffer),
  }).pipe(
    Effect.map((digest) =>
      [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join(''),
    ),
  );

const verifiedAnydocExtraction = (
  extraction: AnydocExtraction | undefined,
  bytes: Uint8Array,
  detectedMimeType: string | undefined,
) =>
  Effect.gen(function* verifiedAnydocExtractionProgram() {
    if (
      extraction === undefined ||
      extraction.version !== ANYDOC_WASM_VERSION ||
      extraction.processor !== 'anydoc_wasm' ||
      extraction.contentMarkdown.trim().length === 0 ||
      extraction.contentMarkdown.length > MAX_ANYDOC_MARKDOWN_CHARS ||
      detectedMimeType === undefined ||
      !anydocMimeTypesByFormat[extraction.format].includes(detectedMimeType)
    ) {
      return null;
    }
    return (yield* sha256Hex(bytes)) === extraction.sourceSha256 ? extraction : null;
  }).pipe(Effect.orElseSucceed(() => null));

const parseHttpUrl = (value: string) => {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
};

const maxDataUrlHeaderLength = 256;
const maxBase64PayloadLength = Math.ceil(MAX_SOURCE_FILE_BYTES / 3) * 4;

export const decodeFileDataUrl = (value: string): FileSourcePayload | null => {
  if (!value.startsWith('data:')) {
    return null;
  }
  const separatorIndex = value.indexOf(',');
  if (separatorIndex === -1 || separatorIndex > maxDataUrlHeaderLength) {
    return null;
  }
  const metadata = value.slice(5, separatorIndex);
  const metadataParts = metadata.split(';');
  const declaredMimeType = metadataParts[0]?.trim().toLowerCase() ?? '';
  if (declaredMimeType.length === 0 || metadataParts.at(-1)?.trim().toLowerCase() !== 'base64') {
    return null;
  }
  const payload = value.slice(separatorIndex + 1);
  if (payload.length > maxBase64PayloadLength) {
    return null;
  }
  try {
    return {
      bytes: Uint8Array.fromBase64(payload),
      declaredMimeType,
    };
  } catch {
    return null;
  }
};

const textFromUnknownJson = (value: unknown, preferredKeys: string[]): string => {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (value === null || value === undefined || typeof value !== 'object') {
    return '';
  }
  for (const key of preferredKeys) {
    const record = recordOptionFromUnknown(value);
    if (Option.isSome(record)) {
      const direct = textFromUnknownJson(record.value[key], preferredKeys);
      if (direct.length > 0) {
        return direct;
      }
    }
  }
  if (Array.isArray(value)) {
    return value
      .map((entry) => textFromUnknownJson(entry, preferredKeys))
      .filter(Boolean)
      .join('\n\n');
  }
  return '';
};

const requireProviderKey = (value: string | undefined, providerName: string) =>
  providerKeyConfigured(value)
    ? Effect.succeed(value)
    : Effect.fail(
        new SourceProcessingError({ message: `${providerName} API key is not configured.` }),
      );

const isLlamaParseMarkdownTier = (value: string): value is LlamaParseMarkdownTier =>
  llamaParseMarkdownTiers.some((tier) => tier === value);

const llamaParseTierForMarkdown = () => {
  const tier = sourceProviderConfig().llamaParseTier;
  return isLlamaParseMarkdownTier(tier)
    ? Effect.succeed(tier)
    : Effect.fail(
        new SourceProcessingError({
          message: `LLAMA_PARSE_TIER=${tier} cannot produce Markdown. Use cost_effective, agentic, or agentic_plus.`,
        }),
      );
};

const configuredWebExtractionProviderCount = () => {
  const config = sourceProviderConfig();
  return [config.firecrawlApiKey, config.tavilyApiKey, config.exaApiKey].filter(
    providerKeyConfigured,
  ).length;
};

export const isWebExtractionConfigured = () => configuredWebExtractionProviderCount() > 0;

const providerBaseUrl = (value: string) => value.replace(/\/+$/u, '');

const executeJson = (request: HttpClientRequest.HttpClientRequest) =>
  Effect.gen(function* executeJsonProgram() {
    const client = yield* HttpClient.HttpClient;
    const response = yield* client.execute(request).pipe(Effect.mapError(toSourceError));
    if (response.status < 200 || response.status >= 300) {
      const detail = yield* response.text.pipe(Effect.orElseSucceed(() => ''));
      return yield* new SourceProcessingError({
        message: detail || `Provider request failed with ${response.status}.`,
      });
    }
    return (yield* response.json.pipe(Effect.mapError(toSourceError))) as unknown;
  });

const providerContentFromJson = (providerName: string, value: unknown) => {
  const content = textFromUnknownJson(value, [
    'markdown',
    'raw_content',
    'text',
    'content',
    'data',
    'results',
  ]);
  return content.length === 0
    ? Effect.fail(
        new SourceProcessingError({
          message: `${providerName} returned no readable Markdown.`,
        }),
      )
    : Effect.succeed(content);
};

const providerFailureMessage = (providerName: string, error: SourceProcessingError) =>
  `${providerName}: ${error.message.slice(0, 280)}`;

const llamaParseJobRecord = (value: Record<string, unknown>) => {
  const nestedJob = value['job'];
  const nestedRecord = recordOptionFromUnknown(nestedJob);
  if (Option.isSome(nestedRecord)) {
    return nestedRecord.value;
  }
  return value;
};

const llamaParseJobContent = (jobId: string) =>
  Effect.gen(function* llamaParseJobContentProgram() {
    const config = sourceProviderConfig();
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const apiKey = yield* requireProviderKey(config.llamaCloudApiKey, 'LlamaParse');
      const latestJob = recordFromUnknown(
        yield* executeJson(
          HttpClientRequest.get(
            `${config.llamaCloudBaseUrl}/api/v2/parse/${jobId}?expand=markdown`,
          ).pipe(HttpClientRequest.setHeader('Authorization', `Bearer ${apiKey}`)),
        ),
      );
      const job = llamaParseJobRecord(latestJob);
      const status = String(job['status'] ?? '').toUpperCase();
      if (status === 'COMPLETED' || status === 'SUCCESS' || status === 'PARTIAL_SUCCESS') {
        const content = textFromUnknownJson(latestJob, [
          'markdown_full',
          'markdown',
          'markdown_content',
          'content',
          'pages',
        ]);
        if (content.length === 0) {
          return yield* new SourceProcessingError({
            message: 'LlamaParse completed without readable markdown.',
          });
        }
        return content;
      }
      if (status === 'FAILED' || status === 'ERROR' || status === 'CANCELLED') {
        return yield* new SourceProcessingError({
          message: String(job['error_message'] ?? 'LlamaParse processing failed.'),
        });
      }
      yield* Effect.sleep(2000);
    }
    return yield* new SourceProcessingError({
      message: 'LlamaParse processing did not finish before the local timeout.',
    });
  });

const createLlamaParseJob = (body: Record<string, unknown>) =>
  Effect.gen(function* createLlamaParseJobProgram() {
    const config = sourceProviderConfig();
    const apiKey = yield* requireProviderKey(config.llamaCloudApiKey, 'LlamaParse');
    const parseJob = recordFromUnknown(
      yield* executeJson(
        HttpClientRequest.post(`${config.llamaCloudBaseUrl}/api/v2/parse`).pipe(
          HttpClientRequest.setHeader('Authorization', `Bearer ${apiKey}`),
          HttpClientRequest.bodyJsonUnsafe(body),
        ),
      ),
    );
    const jobId = typeof parseJob['id'] === 'string' ? parseJob['id'] : '';
    if (jobId.length === 0) {
      return yield* new SourceProcessingError({
        message: 'LlamaParse did not return a parse job id.',
      });
    }
    return jobId;
  });

const parseLlamaDocument = (sourceName: string, binary: BinarySourcePayload) =>
  Effect.gen(function* parseLlamaDocumentProgram() {
    const config = sourceProviderConfig();
    const apiKey = yield* requireProviderKey(config.llamaCloudApiKey, 'LlamaParse');
    const formData = new FormData();
    formData.append('purpose', 'parse');
    formData.append(
      'file',
      new Blob([new Uint8Array(binary.bytes).buffer], { type: binary.mimeType }),
      sourceName,
    );
    const uploaded = recordFromUnknown(
      yield* executeJson(
        HttpClientRequest.post(`${config.llamaCloudBaseUrl}/api/v1/beta/files`).pipe(
          HttpClientRequest.setHeader('Authorization', `Bearer ${apiKey}`),
          HttpClientRequest.bodyFormData(formData),
        ),
      ),
    );
    const fileId = typeof uploaded['id'] === 'string' ? uploaded['id'] : '';
    if (fileId.length === 0) {
      return yield* new SourceProcessingError({
        message: 'LlamaParse did not return an uploaded file id.',
      });
    }
    const tier = yield* llamaParseTierForMarkdown();
    const jobId = yield* createLlamaParseJob({
      file_id: fileId,
      tier,
      version: config.llamaParseVersion,
    });
    const content = yield* llamaParseJobContent(jobId);
    return {
      content,
      mimeType: binary.mimeType,
      providerJobId: jobId,
      storageReference: `llamacloud:${fileId}:${jobId}`,
    };
  });

const configuredDocumentConverter = (deps: SourceProcessorDeps): DocumentConverter => {
  if (deps.convertDocument !== undefined) {
    return deps.convertDocument;
  }
  return providerKeyConfigured(sourceProviderConfig().llamaCloudApiKey)
    ? parseLlamaDocument
    : convertDocumentWithCloudflare;
};

const extractWithFirecrawl = (url: URL) =>
  Effect.gen(function* extractWithFirecrawlProgram() {
    const config = sourceProviderConfig();
    const providerName = 'Firecrawl';
    const apiKey = yield* requireProviderKey(config.firecrawlApiKey, providerName);
    const response = yield* executeJson(
      HttpClientRequest.post(`${providerBaseUrl(config.firecrawlBaseUrl)}/v1/scrape`).pipe(
        HttpClientRequest.setHeader('Authorization', `Bearer ${apiKey}`),
        HttpClientRequest.bodyJsonUnsafe({
          formats: ['markdown'],
          onlyMainContent: true,
          url: url.toString(),
        }),
      ),
    );
    const content = yield* providerContentFromJson(providerName, response);
    return {
      content,
      processor: 'firecrawl_url',
      providerName,
      storageReference: `firecrawl:${url.toString()}`,
    };
  });

const extractWithTavily = (url: URL) =>
  Effect.gen(function* extractWithTavilyProgram() {
    const config = sourceProviderConfig();
    const providerName = 'Tavily';
    const apiKey = yield* requireProviderKey(config.tavilyApiKey, providerName);
    const response = yield* executeJson(
      HttpClientRequest.post(`${providerBaseUrl(config.tavilyBaseUrl)}/extract`).pipe(
        HttpClientRequest.setHeader('Authorization', `Bearer ${apiKey}`),
        HttpClientRequest.bodyJsonUnsafe({
          extract_depth: 'basic',
          format: 'markdown',
          urls: [url.toString()],
        }),
      ),
    );
    const content = yield* providerContentFromJson(providerName, response);
    return {
      content,
      processor: 'tavily_url',
      providerName,
      storageReference: `tavily:${url.toString()}`,
    };
  });

const extractWithExa = (url: URL) =>
  Effect.gen(function* extractWithExaProgram() {
    const config = sourceProviderConfig();
    const providerName = 'Exa';
    const apiKey = yield* requireProviderKey(config.exaApiKey, providerName);
    const response = yield* executeJson(
      HttpClientRequest.post(`${providerBaseUrl(config.exaBaseUrl)}/contents`).pipe(
        HttpClientRequest.setHeader('x-api-key', apiKey),
        HttpClientRequest.bodyJsonUnsafe({
          text: true,
          urls: [url.toString()],
        }),
      ),
    );
    const content = yield* providerContentFromJson(providerName, response);
    return {
      content,
      processor: 'exa_url',
      providerName,
      storageReference: `exa:${url.toString()}`,
    };
  });

const extractWebUrl = (url: URL) =>
  Effect.gen(function* extractWebUrlProgram() {
    const config = sourceProviderConfig();
    const providers = [
      { apiKey: config.firecrawlApiKey, extract: extractWithFirecrawl, name: 'Firecrawl' },
      { apiKey: config.tavilyApiKey, extract: extractWithTavily, name: 'Tavily' },
      { apiKey: config.exaApiKey, extract: extractWithExa, name: 'Exa' },
    ];
    const failures: string[] = [];
    for (const provider of providers) {
      if (!providerKeyConfigured(provider.apiKey)) {
        continue;
      }
      const outcome = yield* provider.extract(url).pipe(
        Effect.match({
          onFailure: (error) => ({ error, succeeded: false as const }),
          onSuccess: (result) => ({ result, succeeded: true as const }),
        }),
      );
      if (outcome.succeeded) {
        return outcome.result;
      }
      failures.push(providerFailureMessage(provider.name, outcome.error));
    }
    if (failures.length === 0) {
      return yield* new SourceProcessingError({
        message:
          'Web extraction provider is not configured. Set FIRECRAWL_API_KEY, TAVILY_API_KEY, or EXA_API_KEY and restart the dev server.',
      });
    }
    return yield* new SourceProcessingError({
      message: `Web extraction failed. ${failures.join(' | ')}`,
    });
  });

const transcribeWithDeepgram = (sourceName: string, binary: BinarySourcePayload) =>
  Effect.gen(function* transcribeWithDeepgramProgram() {
    const config = sourceProviderConfig();
    const apiKey = yield* requireProviderKey(config.deepgramApiKey, 'Deepgram');
    const model = config.deepgramModel;
    const response = recordFromUnknown(
      yield* executeJson(
        HttpClientRequest.post(
          `${config.deepgramBaseUrl}/v1/listen?model=${encodeURIComponent(model)}&language=${encodeURIComponent(config.deepgramLanguage)}&smart_format=true&paragraphs=true&utterances=true&diarize_model=latest`,
        ).pipe(
          HttpClientRequest.setHeader('Authorization', `Token ${apiKey}`),
          HttpClientRequest.bodyUint8Array(binary.bytes, binary.mimeType),
        ),
      ),
    );
    /* Deepgram nests the text in `results.channels[].alternatives[]`, so the
     * whole path has to be named: the walker only descends through the keys it
     * is given, and asking for `transcript` alone finds nothing at the top
     * level. `paragraphs` comes before `transcript` because the smart-formatted
     * paragraph text reads better as course source material than the flat
     * single-line alternative. */
    const transcript = textFromUnknownJson(response, [
      'results',
      'channels',
      'alternatives',
      'paragraphs',
      'transcript',
    ]);
    if (transcript.length === 0) {
      return yield* new SourceProcessingError({
        message: 'Deepgram completed without a readable transcript.',
      });
    }
    const metadata = recordOptionFromUnknown(response['metadata']).pipe(Option.getOrUndefined);
    const requestId =
      typeof metadata?.['request_id'] === 'string' ? metadata['request_id'] : undefined;
    return {
      content: transcript,
      mimeType: binary.mimeType,
      storageReference: `deepgram:${requestId ?? sourceName}`,
      ...(typeof requestId === 'string' ? { providerJobId: requestId } : {}),
    };
  });

interface SourceAssetCommon {
  createdAt: string;
  sourceId: string;
  sourceName: string;
}

const webExtractionSourceAsset = (
  source: ProcessSourceInput,
  common: SourceAssetCommon,
  url: URL,
) =>
  extractWebUrl(url).pipe(
    Effect.match({
      onFailure: (error): SourceAsset => ({
        content: '',
        createdAt: common.createdAt,
        failureReason: error.message || 'The web extraction providers could not process this URL.',
        id: common.sourceId,
        name: common.sourceName,
        processor: 'web_extraction_url',
        sizeLabel: source.sizeLabel ?? '0 chars',
        status: 'failed',
        type: source.type,
      }),
      onSuccess: (providerResult): SourceAsset => ({
        content: providerResult.content,
        createdAt: common.createdAt,
        id: common.sourceId,
        name: common.sourceName,
        processor: providerResult.processor,
        sizeLabel: source.sizeLabel ?? `${providerResult.content.length} chars`,
        status: 'processed',
        type: source.type,
        ...('providerJobId' in providerResult && typeof providerResult.providerJobId === 'string'
          ? { providerJobId: providerResult.providerJobId }
          : {}),
        ...(typeof providerResult.storageReference === 'string'
          ? { storageReference: providerResult.storageReference }
          : {}),
      }),
    }),
  );

const chooseFileProcessor = (
  filePayload: FileSourcePayload | null,
  detectedMimeType: string | undefined,
  declaredMimeType: string | undefined,
  fileNameMimeType: string | undefined,
): string => {
  if (filePayload === null) {
    return sourceProcessorForMimeType(fileNameMimeType, true);
  }
  const verified = processorForVerifiedBinary(detectedMimeType);
  if (
    verified === 'unsupported_file' &&
    sourceProcessorForMimeType(declaredMimeType, true) === 'local_text'
  ) {
    return 'local_text';
  }
  return verified;
};

const isProviderBackedProcessor = (fileProcessor: string) =>
  fileProcessor !== 'local_text' && fileProcessor !== 'unsupported_file';

const providerBackedFileAsset = (
  deps: SourceProcessorDeps,
  source: ProcessSourceInput,
  common: SourceAssetCommon,
  fileProcessor: string,
  binary: BinarySourcePayload,
  fileStorageReference: string | undefined,
) => {
  const providerEffect: Effect.Effect<
    DocumentConversionResult,
    SourceProcessingError,
    HttpClient.HttpClient
  > = fileProcessor.includes('deepgram')
    ? transcribeWithDeepgram(common.sourceName, binary)
    : configuredDocumentConverter(deps)(common.sourceName, binary);
  return providerEffect.pipe(
    Effect.match({
      onFailure: (error): SourceAsset => ({
        content: '',
        createdAt: common.createdAt,
        failureReason: error.message || 'The source provider could not process this file.',
        id: common.sourceId,
        mimeType: binary.mimeType,
        name: common.sourceName,
        processor: fileProcessor,
        sizeLabel: source.sizeLabel ?? `${binary.bytes.byteLength} bytes`,
        status: 'failed',
        storageReference: fileStorageReference,
        type: source.type,
      }),
      onSuccess: (providerResult): SourceAsset => ({
        content: providerResult.content,
        createdAt: common.createdAt,
        id: common.sourceId,
        name: common.sourceName,
        processor: providerResult.processor ?? fileProcessor,
        sizeLabel: source.sizeLabel ?? `${providerResult.content.length} chars`,
        status: providerResult.content.length > 0 ? 'processed' : 'failed',
        storageReference: fileStorageReference,
        type: source.type,
        ...(typeof providerResult.mimeType === 'string'
          ? { mimeType: providerResult.mimeType }
          : {}),
        ...(typeof providerResult.providerJobId === 'string'
          ? { providerJobId: providerResult.providerJobId }
          : {}),
        ...(providerResult.content.length === 0
          ? { failureReason: 'The provider did not return readable content.' }
          : {}),
      }),
    }),
  );
};

const localTextSourceAsset = (
  source: ProcessSourceInput,
  common: SourceAssetCommon,
  trimmedContent: string,
  filePayload: FileSourcePayload | null,
  fileStorageReference: string | undefined,
  declaredMimeType: string | undefined,
  fileNameMimeType: string | undefined,
): SourceAsset => {
  const textContent =
    filePayload === null ? trimmedContent : new TextDecoder().decode(filePayload.bytes).trim();
  return {
    content: textContent,
    createdAt: common.createdAt,
    id: common.sourceId,
    name: common.sourceName,
    processor: 'local_text',
    sizeLabel: source.sizeLabel ?? `${textContent.length} chars`,
    status: textContent.length > 0 ? 'processed' : 'unsupported',
    storageReference: fileStorageReference,
    type: source.type,
    ...(declaredMimeType === undefined && fileNameMimeType === undefined
      ? {}
      : { mimeType: declaredMimeType ?? fileNameMimeType }),
    ...(textContent.length > 0 ? {} : { failureReason: 'No readable content was supplied.' }),
  };
};

const unsupportedFileSourceAsset = (
  source: ProcessSourceInput,
  common: SourceAssetCommon,
  filePayload: FileSourcePayload,
  detectedMimeType: string | undefined,
  declaredMimeType: string | undefined,
  fileStorageReference: string | undefined,
): SourceAsset => ({
  content: '',
  createdAt: common.createdAt,
  failureReason: 'File type could not be verified from uploaded bytes.',
  id: common.sourceId,
  mimeType: detectedMimeType ?? declaredMimeType,
  name: common.sourceName,
  processor: 'unsupported_file',
  sizeLabel: source.sizeLabel ?? `${filePayload.bytes.byteLength} bytes`,
  status: 'unsupported',
  storageReference: fileStorageReference,
  type: source.type,
});

const plainSourceAsset = (
  source: ProcessSourceInput,
  common: SourceAssetCommon,
  trimmedContent: string,
  fileProcessor: string | null,
  isSupported: boolean,
): SourceAsset => ({
  content: trimmedContent,
  createdAt: common.createdAt,
  id: common.sourceId,
  name: common.sourceName,
  processor: fileProcessor ?? processorFor(source.type),
  sizeLabel: source.sizeLabel ?? `${trimmedContent.length} chars`,
  status: isSupported ? 'processed' : 'unsupported',
  type: source.type,
  ...(isSupported ? {} : { failureReason: 'No readable content was supplied.' }),
});

const fileSourceAsset = (
  deps: SourceProcessorDeps,
  draftId: string,
  source: Extract<ProcessSourceInput, { type: 'file' }>,
  common: SourceAssetCommon,
  content: string,
) =>
  Effect.gen(function* fileSourceAssetProgram() {
    const filePayload = source.filePayload ?? decodeFileDataUrl(content);
    if (filePayload !== null && filePayload.bytes.byteLength > MAX_SOURCE_FILE_BYTES) {
      return yield* new SourceProcessingError({
        message: `Source files are limited to ${MAX_SOURCE_FILE_BYTES} bytes.`,
      });
    }
    const ownsNewBlob = filePayload !== null && source.storageReference === undefined;
    const fileStorageReference =
      filePayload === null
        ? undefined
        : (source.storageReference ??
          (yield* deps.writeSourceBlob(draftId, common.sourceId, filePayload.bytes)));
    return yield* Effect.gen(function* inspectFileSourceProgram() {
      const detectedMimeType =
        filePayload === null ? undefined : yield* detectBinaryMimeType(filePayload.bytes);
      const declaredMimeType = filePayload?.declaredMimeType;
      const fileNameMimeType = mimeTypeFromFileName(common.sourceName);
      const localExtraction =
        filePayload === null
          ? null
          : yield* verifiedAnydocExtraction(
              source.localExtraction,
              filePayload.bytes,
              detectedMimeType,
            );
      if (localExtraction !== null) {
        return {
          content: localExtraction.contentMarkdown,
          createdAt: common.createdAt,
          id: common.sourceId,
          mimeType: detectedMimeType,
          name: common.sourceName,
          processor: 'anydoc_wasm',
          sizeLabel: source.sizeLabel ?? `${localExtraction.contentMarkdown.length} chars`,
          status: 'processed',
          storageReference: fileStorageReference,
          type: source.type,
        } satisfies SourceAsset;
      }
      const fileProcessor = chooseFileProcessor(
        filePayload,
        detectedMimeType,
        declaredMimeType,
        fileNameMimeType,
      );
      const binary =
        filePayload !== null && detectedMimeType !== undefined
          ? { bytes: filePayload.bytes, mimeType: detectedMimeType }
          : null;
      if (isProviderBackedProcessor(fileProcessor) && binary !== null) {
        return yield* providerBackedFileAsset(
          deps,
          source,
          common,
          fileProcessor,
          binary,
          fileStorageReference,
        );
      }
      if (fileProcessor === 'local_text') {
        return localTextSourceAsset(
          source,
          common,
          content,
          filePayload,
          fileStorageReference,
          declaredMimeType,
          fileNameMimeType,
        );
      }
      if (filePayload !== null && fileProcessor === 'unsupported_file') {
        return unsupportedFileSourceAsset(
          source,
          common,
          filePayload,
          detectedMimeType,
          declaredMimeType,
          fileStorageReference,
        );
      }
      return plainSourceAsset(source, common, content, fileProcessor, false);
    }).pipe(
      Effect.tapError(() =>
        ownsNewBlob && fileStorageReference !== undefined
          ? deps.deleteSourceBlob(fileStorageReference)
          : Effect.void,
      ),
    );
  });

export const processSource = (
  deps: SourceProcessorDeps,
  draftId: string,
  source: ProcessSourceInput,
) =>
  Effect.gen(function* processSourceProgram() {
    const trimmedSourceName = source.name.trim();
    const common: SourceAssetCommon = {
      createdAt: deps.now(),
      sourceId: source.sourceId ?? deps.newSourceId(draftId),
      sourceName: trimmedSourceName.length > 0 ? trimmedSourceName : source.type,
    };
    if (source.type === 'file') {
      return yield* fileSourceAsset(deps, draftId, source, common, source.content);
    }
    const trimmedContent = source.content.trim();
    if (source.type === 'url') {
      const url = parseHttpUrl(trimmedContent);
      if (url !== null) {
        return yield* webExtractionSourceAsset(source, common, url);
      }
    }
    return plainSourceAsset(source, common, trimmedContent, null, true);
  });
