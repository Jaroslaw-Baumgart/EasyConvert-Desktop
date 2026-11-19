import { mkdtemp, stat, rm } from "node:fs/promises";
import path from "node:path";
import type { StartConversionRequest } from "../../shared/desktopContract";
import { getPdfPagePaths } from "../../conversion-core/pdf/convertPdfToJpg";
import { failJob, getJobState, succeedJob, cancelJob } from "./jobRegistry";
import { registerResults } from "./resultRegistry";
import { runConversionWorker } from "./runConversionWorker";
import { getConversionDefinition } from "../../shared/conversions";
import { MAX_RESULT_BYTES } from "../../shared/conversionLimits";
import { getTemporaryDirectory } from "./temporaryDirectory";

export async function runConversionJob(
  jobId: string,
  inputPath: string,
  onStateChanged: () => void,
  request: StartConversionRequest,
  signal?: AbortSignal,
): Promise<void> {
  let directory: string | undefined;
  let keepResults = false;

  try {
    signal?.throwIfAborted();
    directory = await mkdtemp(
      path.join(getTemporaryDirectory(), "easyconvert-job-"),
    );

    let outputPaths: string[];

    if (request.conversion === "pdf-to-jpg") {
      await runConversionWorker(inputPath, directory, request, signal);
      outputPaths = await getPdfPagePaths(directory);
    } else {
      const { targetFormat } = getConversionDefinition(request.conversion);
      const outputPath = path.join(directory, `result.${targetFormat}`);

      await runConversionWorker(inputPath, outputPath, request, signal);
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

    signal?.throwIfAborted();

    const resultIds = registerResults(outputPaths, directory);

    if (succeedJob(jobId, resultIds)) {
      keepResults = true;
      onStateChanged();
    }
  } catch (error) {
    let changed: boolean;

    if (signal?.aborted && error === signal.reason) {
      changed = cancelJob(jobId);
    } else {
      changed = failJob(
        jobId,
        error instanceof Error ? error.message : "Conversion failed.",
      );
    }
    if (changed) {
      onStateChanged();
    }
  } finally {
    if (directory && !keepResults) {
      try {
        await rm(directory, { recursive: true, force: true });
      } catch (error) {
        console.error("Could not remove the job directory.", error);
      }
    }
  }
}
