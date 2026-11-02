import type { PdfPageOptions } from "../../shared/conversionOptions";

export function parsePdfPageOptions(value: unknown): PdfPageOptions {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Invalid PDF page options.");
  }

  if (
    !("pageSize" in value) ||
    (value.pageSize !== "A4" && value.pageSize !== "A3")
  ) {
    throw new Error("Invalid PDF page options.");
  }

  if (
    !("pageOrientation" in value) ||
    (value.pageOrientation !== "portrait" &&
      value.pageOrientation !== "landscape")
  ) {
    throw new Error("Invalid PDF page options.");
  }

  return {
    pageSize: value.pageSize,
    pageOrientation: value.pageOrientation,
  };
}
