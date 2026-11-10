import { app } from "electron";
import { mkdtemp, stat } from "node:fs/promises";
import path from "node:path";
import type { StartConversionRequest } from "../../shared/desktopContract";
import { getPdfPagePaths } from "../../conversion-core/pdf/convertPdfToJpg";
import { failJob, getJobState, succeedJob } from "./jobRegistry";
import { registerResults } from "./resultRegistry";
import { runConversionWorker } from "./runConversionWorker";
import { getConversionDefinition } from "../../shared/conversions";
import { MAX_RESULT_BYTES } from "../../shared/conversionLimits";

export async function runConversionJob(
  jobId: string,
  inputPath: string,
  onStateChanged: () => void,
  request: StartConversionRequest,
): Promise<void> {
  try {
    const directory = await mkdtemp(
      path.join(app.getPath("temp"), "easyconvert-job-"),
    );

    let outputPaths: string[];

    if (request.conversion === "pdf-to-jpg") {
      await runConversionWorker(inputPath, directory, request);
      outputPaths = await getPdfPagePaths(directory);
    } else {
      const { targetFormat } = getConversionDefinition(request.conversion);
      const outputPath = path.join(directory, `result.${targetFormat}`);

      await runConversionWorker(inputPath, outputPath, request);
      outputPaths = [outputPath];
    }

    for (const outputPath of outputPaths) {
      const metadata = await stat(outputPath);

      if (!metadata.isFile() || metadata.size === 0) {
        throw new Error("Output file is empty or not a file.");
      }
      if (metadata.size > MAX_RESULT_BYTES) {
        throw new Error("Output file exceeds the size limit.");
      }
    }

    const currentJob = getJobState();

    if (currentJob.status !== "running" || currentJob.jobId !== jobId) {
      return;
    }

    const resultIds = registerResults(outputPaths);

    if (succeedJob(jobId, resultIds)) {
      onStateChanged();
    }
  } catch (error) {
    const changed = failJob(
      jobId,
      error instanceof Error ? error.message : "Conversion failed.",
    );

    if (changed) {
      onStateChanged();
    }
  }
}
