import * as Schema from 'effect/Schema';
import {
  draftStepSchema,
  sessionUserSchema,
  workflowSnapshotSchema,
} from '@shared/coursition/effect-api';

const courseRouteLanguageSchema = Schema.Literals(['en', 'cs']);

const courseRouteMatchSchema = Schema.Struct({
  draftId: Schema.String,
  language: courseRouteLanguageSchema,
  step: draftStepSchema,
});

const coursePageLoaderDataSchema = Schema.Struct({
  language: courseRouteLanguageSchema,
  route: Schema.NullOr(courseRouteMatchSchema),
  sessionUser: Schema.NullOr(sessionUserSchema),
  snapshot: Schema.NullOr(workflowSnapshotSchema),
  theme: Schema.optional(Schema.Literals(['light', 'dark']).pipe(Schema.NullOr)),
});

export const coursePageLoaderDataFromUnknown = Schema.decodeUnknownOption(
  coursePageLoaderDataSchema,
);

export type CoursePageLoaderData = Schema.Schema.Type<typeof coursePageLoaderDataSchema>;
