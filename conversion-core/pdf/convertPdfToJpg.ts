import { readdir } from "node:fs/promises";
import path from "node:path";
import { pdfToImages, type PopplerOptions } from "./poppler";

export async function convertPdfToJpg(
  inputPath: string,
  outputDirectory: string,
  options: PopplerOptions,
  signal?: AbortSignal,
): Promise<string[]> {
  await pdfToImages(inputPath, outputDirectory, options, signal);
  return getPdfPagePaths(outputDirectory);
}

export async function getPdfPagePaths(
  outputDirectory: string,
): Promise<string[]> {
  const jpgFiles = (await readdir(outputDirectory))
    .filter((name) => /^page-\d+\.jpg$/.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  if (jpgFiles.length === 0) {
    throw new Error("PDF conversion produced no JPG files.");
  }

  return jpgFiles.map((name) => path.join(outputDirectory, name));
}
