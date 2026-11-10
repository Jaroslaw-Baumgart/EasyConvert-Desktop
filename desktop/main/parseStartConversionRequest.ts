import type { StartConversionRequest } from "../../shared/desktopContract";
import { parsePngToJpgOptions } from "../../conversion-core/image/parsePngToJpgOptions";
import { parsePdfPageOptions } from "../../conversion-core/pdf/parsePdfPageOptions";
import { parseXlsxToPdfOptions } from "../../conversion-core/office/parseXlsxToPdfOptions";

export function parseStartConversionRequest(
  value: unknown,
): StartConversionRequest {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Expected a conversion request object.");
  }

  if (!("sourceId" in value)) {
    throw new Error("Missing sourceId.");
  }

  if (typeof value.sourceId !== "string") {
    throw new Error("sourceId must be a string.");
  }

  if (value.sourceId.length === 0 || value.sourceId.length > 128) {
    throw new Error(
      "sourceId must be a non-empty string with a maximum length of 128 characters.",
    );
  }

  if (!("conversion" in value)) {
    throw new Error("Missing conversion.");
  }

  if (
    value.conversion === "jpg-to-png" ||
    value.conversion === "pdf-to-jpg" ||
    value.conversion === "pdf-to-txt" ||
    value.conversion === "docx-to-pdf" ||
    value.conversion === "pptx-to-pdf"
  ) {
    return {
      sourceId: value.sourceId,
      conversion: value.conversion,
    };
  }

  if (value.conversion === "png-to-jpg") {
    if (!("options" in value)) {
      throw new Error("Missing options for PNG to JPG conversion.");
    }

    return {
      sourceId: value.sourceId,
      conversion: value.conversion,
      options: parsePngToJpgOptions(value.options),
    };
  }

  if (
    value.conversion === "jpg-to-pdf" ||
    value.conversion === "txt-to-pdf" ||
    value.conversion === "csv-to-pdf"
  ) {
    if (!("options" in value)) {
      const conversionNames = {
        "jpg-to-pdf": "JPG to PDF",
        "txt-to-pdf": "TXT to PDF",
        "csv-to-pdf": "CSV to PDF",
      };

      throw new Error(
        `Missing options for ${conversionNames[value.conversion]} conversion.`,
      );
    }

    return {
      sourceId: value.sourceId,
      conversion: value.conversion,
      options: parsePdfPageOptions(value.options),
    };
  }

  if (value.conversion === "xlsx-to-pdf") {
    if (!("options" in value)) {
      throw new Error("Missing options for XLSX to PDF conversion.");
    }

    return {
      sourceId: value.sourceId,
      conversion: value.conversion,
      options: parseXlsxToPdfOptions(value.options),
    };
  }
  throw new Error("Unsupported conversion.");
}
