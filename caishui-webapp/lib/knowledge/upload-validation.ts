export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

const ALLOWED_EXTENSIONS = new Set([".pdf", ".md", ".txt", ".csv", ".xlsx"]);

export type UploadValidationErrorCode =
  | "empty_file"
  | "file_too_large"
  | "invalid_file_name"
  | "unsupported_file_type";

export class UploadValidationError extends Error {
  constructor(public readonly code: UploadValidationErrorCode) {
    super(code);
    this.name = "UploadValidationError";
  }
}

export function validateUploadedFile(file: {
  name: string;
  size: number;
}): void {
  const name = file.name.trim();
  if (
    !name ||
    name.includes("/") ||
    name.includes("\\") ||
    name.includes("..") ||
    /[\u0000-\u001f\u007f]/u.test(name)
  ) {
    throw new UploadValidationError("invalid_file_name");
  }
  if (file.size <= 0) {
    throw new UploadValidationError("empty_file");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new UploadValidationError("file_too_large");
  }
  if (!ALLOWED_EXTENSIONS.has(getExtension(name))) {
    throw new UploadValidationError("unsupported_file_type");
  }
}

export function uploadValidationErrorResponse(error: unknown):
  | { error: UploadValidationErrorCode; status: 400 }
  | null {
  if (error instanceof UploadValidationError) {
    return { error: error.code, status: 400 };
  }
  return null;
}

function getExtension(name: string): string {
  const index = name.lastIndexOf(".");
  return index >= 0 ? name.slice(index).toLowerCase() : "";
}
