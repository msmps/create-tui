import { Data } from "effect";

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
