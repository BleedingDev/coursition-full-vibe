import * as NodeFileSystem from '@effect/platform-node/NodeFileSystem';
import { Data, Effect, FileSystem, Option } from 'effect';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import { coursitionCloudflareBindings } from './cloudflare-bindings.ts';

export class SourceBlobStoreError extends Data.TaggedError('SourceBlobStoreError')<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

export interface SourceBlobStore {
  readonly delete: (reference: string | undefined) => Effect.Effect<void, SourceBlobStoreError>;
  readonly exists: (reference: string | undefined) => Effect.Effect<boolean, SourceBlobStoreError>;
  readonly read: (
    reference: string | undefined,
  ) => Effect.Effect<Option.Option<Uint8Array>, SourceBlobStoreError>;
  readonly write: (
    draftId: string,
    sourceId: string,
    bytes: Uint8Array,
  ) => Effect.Effect<string, SourceBlobStoreError>;
}

const localReferencePrefix = 'json-file:';
const r2ReferencePrefix = 'r2:source-assets/';
const sourceAssetPathPattern = /^source-assets\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\.bin$/u;
const fileSystemRuntime = ManagedRuntime.make(NodeFileSystem.layer);

type BucketSource = R2Bucket | (() => R2Bucket | Promise<R2Bucket>);

const localReference = (draftId: string, sourceId: string) =>
  `${localReferencePrefix}source-assets/${draftId}/${sourceId}.bin`;

const localRelativePath = (reference: string | undefined) => {
  if (typeof reference !== 'string' || !reference.startsWith(localReferencePrefix)) {
    return null;
  }
  const relativePath = reference.slice(localReferencePrefix.length);
  return sourceAssetPathPattern.test(relativePath) ? relativePath : null;
};

const r2Key = (reference: string | undefined) => {
  if (typeof reference !== 'string' || !reference.startsWith(r2ReferencePrefix)) {
    return null;
  }
  const key = reference.slice('r2:'.length);
  return sourceAssetPathPattern.test(key) ? key : null;
};

export const isSourceBlobReference = (reference: string | undefined) =>
  localRelativePath(reference) !== null || r2Key(reference) !== null;

const blobFailure = (cause: unknown, message: string) =>
  cause instanceof SourceBlobStoreError ? cause : new SourceBlobStoreError({ cause, message });

const bucketEffect = (source: BucketSource) =>
  Effect.tryPromise({
    catch: (cause) => blobFailure(cause, 'Source asset bucket is unavailable.'),
    try: () => (typeof source === 'function' ? Promise.resolve(source()) : Promise.resolve(source)),
  });

export const localSourceBlobStore = (rootDirectory: string): SourceBlobStore => ({
  delete: (reference) => {
    const relativePath = localRelativePath(reference);
    if (relativePath === null) {
      return Effect.void;
    }
    const targetPath = `${rootDirectory}/${relativePath}`;
    return Effect.tryPromise({
      catch: (cause) => blobFailure(cause, 'Failed to delete source asset bytes.'),
      try: () =>
        fileSystemRuntime.runPromise(
          Effect.gen(function* deleteLocalSourceAsset() {
            const fileSystem = yield* FileSystem.FileSystem;
            if (yield* fileSystem.exists(targetPath)) {
              yield* fileSystem.remove(targetPath);
            }
          }),
        ),
    });
  },
  exists: (reference) => {
    const relativePath = localRelativePath(reference);
    if (relativePath === null) {
      return Effect.succeed(false);
    }
    const targetPath = `${rootDirectory}/${relativePath}`;
    return Effect.tryPromise({
      catch: (cause) => blobFailure(cause, 'Failed to inspect source asset bytes.'),
      try: () =>
        fileSystemRuntime.runPromise(
          Effect.gen(function* inspectLocalSourceAsset() {
            const fileSystem = yield* FileSystem.FileSystem;
            return yield* fileSystem.exists(targetPath);
          }),
        ),
    });
  },
  read: (reference) => {
    const relativePath = localRelativePath(reference);
    if (relativePath === null) {
      return Effect.succeed(Option.none());
    }
    const targetPath = `${rootDirectory}/${relativePath}`;
    return Effect.tryPromise({
      catch: (cause) => blobFailure(cause, 'Failed to read source asset bytes.'),
      try: () =>
        fileSystemRuntime.runPromise(
          Effect.gen(function* readLocalSourceAsset() {
            const fileSystem = yield* FileSystem.FileSystem;
            if (!(yield* fileSystem.exists(targetPath))) {
              return Option.none<Uint8Array>();
            }
            return Option.some(yield* fileSystem.readFile(targetPath));
          }),
        ),
    });
  },
  write: (draftId, sourceId, bytes) =>
    Effect.tryPromise({
      catch: (cause) => blobFailure(cause, 'Failed to store source asset bytes.'),
      try: () =>
        fileSystemRuntime.runPromise(
          Effect.gen(function* writeLocalSourceAsset() {
            const fileSystem = yield* FileSystem.FileSystem;
            const reference = localReference(draftId, sourceId);
            const targetDirectory = `${rootDirectory}/source-assets/${draftId}`;
            yield* fileSystem.makeDirectory(targetDirectory, { recursive: true });
            yield* fileSystem.writeFile(`${targetDirectory}/${sourceId}.bin`, bytes);
            return reference;
          }),
        ),
    }),
});

export const inMemorySourceBlobStore = (): SourceBlobStore => {
  const blobs = new Map<string, Uint8Array>();
  return {
    delete: (reference) =>
      Effect.sync(() => {
        if (typeof reference === 'string') {
          blobs.delete(reference);
        }
      }),
    exists: (reference) => Effect.sync(() => typeof reference === 'string' && blobs.has(reference)),
    read: (reference) =>
      Effect.sync(() => {
        if (typeof reference !== 'string') {
          return Option.none<Uint8Array>();
        }
        const stored = blobs.get(reference);
        return stored === undefined
          ? Option.none<Uint8Array>()
          : Option.some(new Uint8Array(stored));
      }),
    write: (draftId, sourceId, bytes) =>
      Effect.sync(() => {
        const reference = localReference(draftId, sourceId);
        blobs.set(reference, new Uint8Array(bytes));
        return reference;
      }),
  };
};

export const cloudflareSourceBlobStore = (
  source: BucketSource = () =>
    coursitionCloudflareBindings().then((bindings) => bindings.COURSITION_SOURCE_BUCKET),
): SourceBlobStore => ({
  delete: (reference) => {
    const key = r2Key(reference);
    if (key === null) {
      return Effect.void;
    }
    return Effect.flatMap(bucketEffect(source), (bucket) =>
      Effect.tryPromise({
        catch: (cause) => blobFailure(cause, 'Failed to delete source asset bytes.'),
        try: () => bucket.delete(key),
      }),
    );
  },
  exists: (reference) => {
    const key = r2Key(reference);
    if (key === null) {
      return Effect.succeed(false);
    }
    return bucketEffect(source).pipe(
      Effect.flatMap((bucket) =>
        Effect.tryPromise({
          catch: (cause) => blobFailure(cause, 'Failed to inspect source asset bytes.'),
          try: () => bucket.head(key),
        }),
      ),
      Effect.map((object) => object !== null),
    );
  },
  read: (reference) => {
    const key = r2Key(reference);
    if (key === null) {
      return Effect.succeed(Option.none());
    }
    return bucketEffect(source).pipe(
      Effect.flatMap((bucket) =>
        Effect.tryPromise({
          catch: (cause) => blobFailure(cause, 'Failed to read source asset bytes.'),
          try: () => bucket.get(key),
        }),
      ),
      Effect.flatMap((object) =>
        object === null
          ? Effect.succeed(Option.none())
          : Effect.tryPromise({
              catch: (cause) => blobFailure(cause, 'Failed to read source asset bytes.'),
              try: () => object.arrayBuffer(),
            }).pipe(Effect.map((bytes) => Option.some(new Uint8Array(bytes)))),
      ),
    );
  },
  write: (draftId, sourceId, bytes) => {
    const key = `source-assets/${draftId}/${sourceId}.bin`;
    return bucketEffect(source).pipe(
      Effect.flatMap((bucket) =>
        Effect.tryPromise({
          catch: (cause) => blobFailure(cause, 'Failed to store source asset bytes.'),
          try: () => bucket.put(key, bytes),
        }),
      ),
      Effect.as(`${r2ReferencePrefix}${draftId}/${sourceId}.bin`),
    );
  },
});
