import path from "node:path";
import {
  runPoppler as runCorePoppler,
  validatePdfPageCount as validateCorePdfPageCount,
  pdfToImages as convertPdfToImages,
  type PopplerOptions,
} from "../../../conversion-core/pdf/poppler";
import { LIBRE_OFFICE_TIMEOUT_MS, MAX_PDF_PAGES } from "./constants";

function options(): PopplerOptions {
  const binDirectory =
    process.env.POPPLER_BIN_DIR ??
    (process.platform === "win32"
      ? path.join(
          path.dirname(require.resolve("pdf-poppler/package.json")),
          "lib/win/poppler-0.51/bin",
        )
      : "");

  return {
    binDirectory,
    timeoutMs: LIBRE_OFFICE_TIMEOUT_MS,
    maxPages: MAX_PDF_PAGES,
  };
}

export function runPoppler(
  name: string,
  args: string[],
  signal?: AbortSignal,
): Promise<string> {
  return runCorePoppler(name, args, options(), signal);
}

export function validatePdfPageCount(
  input: string,
  signal?: AbortSignal,
): Promise<number> {
  return validateCorePdfPageCount(input, options(), signal);
}

export function pdfToImages(
  input: string,
  outputDirectory: string,
  signal?: AbortSignal,
): Promise<void> {
  return convertPdfToImages(input, outputDirectory, options(), signal);
}
