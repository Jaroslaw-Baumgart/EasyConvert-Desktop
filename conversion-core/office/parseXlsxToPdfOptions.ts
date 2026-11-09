import type { XlsxToPdfOptions } from "../../shared/conversionOptions";
import { parsePdfPageOptions } from "../image/parsePdfPageOptions";

export function parseXlsxToPdfOptions(value: unknown): XlsxToPdfOptions {
  const pageOptions = parsePdfPageOptions(value);

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Invalid XLSX options.");
  }

  if (!("sheetName" in value) || value.sheetName === undefined) {
    return pageOptions;
  }

  if (typeof value.sheetName !== "string" || value.sheetName.length === 0) {
    throw new Error("Invalid XLSX sheet name.");
  }

  return {
    ...pageOptions,
    sheetName: value.sheetName,
  };
}
