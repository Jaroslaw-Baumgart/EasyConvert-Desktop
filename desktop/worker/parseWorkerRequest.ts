import type { WorkerConversionRequest } from "../../shared/workerContract";
import { parsePngToJpgOptions } from "../../conversion-core/image/parsePngToJpgOptions";
import { parsePdfPageOptions } from "../../conversion-core/pdf/parsePdfPageOptions";
import { parseXlsxToPdfOptions } from "../../conversion-core/office/parseXlsxToPdfOptions";

export function parseWorkerRequest(value: unknown): WorkerConversionRequest {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Expected a worker request object.");
  }

  if (
    !("inputPath" in value) ||
    typeof value.inputPath !== "string" ||
    !("outputPath" in value) ||
    typeof value.outputPath !== "string" ||
    !("conversion" in value) ||
    typeof value.conversion !== "string" ||
    value.inputPath.length === 0 ||
    value.outputPath.length === 0
  ) {
    throw new Error("Invalid worker request object.");
  }

  if (value.outputPath === value.inputPath) {
    throw new Error("Input and output paths cannot be the same.");
  }

  const paths = {
    inputPath: value.inputPath,
    outputPath: value.outputPath,
  };

  switch (value.conversion) {
    case "jpg-to-png":
      return { ...paths, conversion: "jpg-to-png" };
    case "png-to-jpg":
      if (!("options" in value)) {
        throw new Error("Missing conversion options.");
      }
      return {
        ...paths,
        conversion: "png-to-jpg",
        options: parsePngToJpgOptions(value.options),
      };
    case "jpg-to-pdf":
      if (!("options" in value)) {
        throw new Error("Missing conversion options.");
      }

      return {
        ...paths,
        conversion: "jpg-to-pdf",
        options: parsePdfPageOptions(value.options),
      };
    case "pdf-to-jpg":
    case "pdf-to-txt":
      if (
        !("binDirectory" in value) ||
        typeof value.binDirectory !== "string"
      ) {
        throw new Error("Missing Poppler binary directory.");
      }
      if (value.binDirectory.length === 0) {
        throw new Error("Invalid Poppler binary directory.");
      }
      return {
        ...paths,
        conversion: value.conversion,
        binDirectory: value.binDirectory,
      };
    case "docx-to-pdf":
    case "pptx-to-pdf":
      if (
        !("executablePath" in value) ||
        typeof value.executablePath !== "string"
      ) {
        throw new Error("Missing LibreOffice executable path.");
      }
      if (value.executablePath.length === 0) {
        throw new Error("Invalid LibreOffice executable path.");
      }
      return {
        ...paths,
        conversion: value.conversion,
        executablePath: value.executablePath,
      };
    case "txt-to-pdf":
      if (!("options" in value)) {
        throw new Error("Missing conversion options.");
      }
      if (!("fontPath" in value) || typeof value.fontPath !== "string") {
        throw new Error("Missing font path.");
      }
      if (value.fontPath.length === 0) {
        throw new Error("Invalid font path.");
      }

      return {
        ...paths,
        conversion: "txt-to-pdf",
        options: parsePdfPageOptions(value.options),
        fontPath: value.fontPath,
      };
    case "csv-to-pdf":
      if (!("options" in value)) {
        throw new Error("Missing conversion options.");
      }
      if (
        !("regularFontPath" in value) ||
        typeof value.regularFontPath !== "string"
      ) {
        throw new Error("Missing regular font path.");
      }
      if (value.regularFontPath.length === 0) {
        throw new Error("Invalid regular font path.");
      }
      if (
        !("boldFontPath" in value) ||
        typeof value.boldFontPath !== "string"
      ) {
        throw new Error("Missing bold font path.");
      }
      if (value.boldFontPath.length === 0) {
        throw new Error("Invalid bold font path.");
      }
      return {
        ...paths,
        conversion: "csv-to-pdf",
        options: parsePdfPageOptions(value.options),
        regularFontPath: value.regularFontPath,
        boldFontPath: value.boldFontPath,
      };
    case "xlsx-to-pdf":
      if (!("options" in value)) {
        throw new Error("Missing conversion options.");
      }
      if (
        !("executablePath" in value) ||
        typeof value.executablePath !== "string"
      ) {
        throw new Error("Missing LibreOffice executable path.");
      }
      if (value.executablePath.length === 0) {
        throw new Error("Invalid LibreOffice executable path.");
      }

      return {
        ...paths,
        conversion: "xlsx-to-pdf",
        options: parseXlsxToPdfOptions(value.options),
        executablePath: value.executablePath,
      };

    default:
      throw new Error("Unsupported worker conversion.");
  }
}
