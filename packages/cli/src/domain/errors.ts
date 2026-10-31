import { Data, Predicate } from "effect";

export class CreateProjectError extends Data.TaggedError("CreateProjectError")<{
  readonly cause?: unknown;
  readonly message: string;
  readonly hint?: string;
}> {}

export class TemplateDownloadError extends Data.TaggedError(
  "TemplateDownloadError",
)<{
  readonly cause?: unknown;
  readonly message: string;
  readonly hint?: string;
}> {}

export class TemplateValidationError extends Data.TaggedError(
  "TemplateValidationError",
)<{
  readonly cause?: unknown;
  readonly message: string;
  readonly hint?: string;
}> {}

export class PackageManagerError extends Data.TaggedError(
  "PackageManagerError",
)<{
  readonly cause?: unknown;
  readonly message: string;
  readonly hint?: string;
}> {}

export class InitializeGitRepositoryError extends Data.TaggedError(
  "InitializeGitRepositoryError",
)<{
  readonly cause?: unknown;
  readonly message: string;
  readonly hint?: string;
}> {}

/** The project folder was created, but a requested setup step failed. */
export class ProjectSetupIncompleteError extends Data.TaggedError(
  "ProjectSetupIncompleteError",
)<{
  readonly message: string;
  readonly hint: string;
}> {}

/** Every failure create-tui reports to the user itself. */
export type CreateTuiError =
  | CreateProjectError
  | TemplateDownloadError
  | TemplateValidationError
  | PackageManagerError
  | InitializeGitRepositoryError
  | ProjectSetupIncompleteError;

// A record (not a list) so adding a member to CreateTuiError without listing
// its tag here is a type error.
const createTuiErrorTags: Record<CreateTuiError["_tag"], true> = {
  CreateProjectError: true,
  TemplateDownloadError: true,
  TemplateValidationError: true,
  PackageManagerError: true,
  InitializeGitRepositoryError: true,
  ProjectSetupIncompleteError: true,
};

export const isCreateTuiError = (error: unknown): error is CreateTuiError =>
  Predicate.hasProperty(error, "_tag") &&
  Predicate.isString(error._tag) &&
  Object.hasOwn(createTuiErrorTags, error._tag);
