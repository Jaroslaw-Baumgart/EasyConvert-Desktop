import {
  runPoppler,
  validatePdfPageCount,
  type PopplerOptions,
} from "./poppler";

export async function convertPdfToTxt(
  inputPath: string,
  outputPath: string,
  options: PopplerOptions,
  signal?: AbortSignal,
): Promise<void> {
  await validatePdfPageCount(inputPath, options, signal);
  await runPoppler("pdftotext", [inputPath, outputPath], options, signal);
}
