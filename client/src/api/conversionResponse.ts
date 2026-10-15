import {
  isBackendConversionErrorCode,
  type ConversionResponse,
  type FileItem,
} from "../../../shared/conversionContract";

export type {
  BackendConversionErrorCode,
  ConversionErrorResponse,
  ConversionResponse,
  ConversionSuccessResponse,
  FileItem,
} from "../../../shared/conversionContract";

function isFileItem(value: unknown): value is FileItem {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    typeof value.name === "string" &&
    "url" in value &&
    typeof value.url === "string"
  );
}

export function parseConversionResponse(
  data: unknown,
): ConversionResponse | null {
  if (typeof data !== "object" || data === null) {
    return null;
  }

  if (!("success" in data) || typeof data.success !== "boolean") {
    return null;
  }

  if (data.success === false) {
    if (
      !("error" in data) ||
      typeof data.error !== "string" ||
      !("code" in data) ||
      !isBackendConversionErrorCode(data.code)
    ) {
      return null;
    }
    return {
      success: false,
      error: data.error,
      code: data.code,
    };
  }

  if (
    !("files" in data) ||
    !Array.isArray(data.files) ||
    data.files.length === 0
  ) {
    return null;
  }

  const files = data.files;
  const hasValidFiles = files.every(isFileItem);

  if (!hasValidFiles) {
    return null;
  }

  return {
    success: true,
    files: [files[0], ...files.slice(1)],
  };
}
