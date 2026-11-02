import { app } from "electron";
import { mkdtemp, stat } from "node:fs/promises";
import path from "node:path";
import { failJob, getJobState, succeedJob } from "./jobRegistry";
import { registerResult } from "./resultRegistry";
import { runImageWorker } from "./runImageWorker";
import type { StartConversionRequest } from "../../shared/desktopContract";

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

    const outputName =
      request.conversion === "jpg-to-png" ? "result.png" : "result.jpg";
    const outputPath = path.join(directory, outputName);

    await runImageWorker(inputPath, outputPath, request);

    const metadata = await stat(outputPath);

    if (!metadata.isFile() || metadata.size === 0) {
      throw new Error("Output file is empty or not a file.");
    }

    const resultState = getJobState();
    if (resultState.status !== "running" || resultState.jobId !== jobId) {
      return;
    }

    const resultId = registerResult(outputPath);

    if (succeedJob(jobId, resultId)) {
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
