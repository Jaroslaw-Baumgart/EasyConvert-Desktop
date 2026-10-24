import { app } from "electron";
import { mkdtemp, stat } from "node:fs/promises";
import path from "node:path";
import { failJob, getJobState, succeedJob } from "./jobRegistry";
import { registerResult } from "./resultRegistry";
import { runJpgToPngWorker } from "./runJpgToPngWorker";

export async function runConversionJob(
  jobId: string,
  inputPath: string,
): Promise<void> {
  try {
    const directory = await mkdtemp(
      path.join(app.getPath("temp"), "easyconvert-job-"),
    );
    const outputPath = path.join(directory, "result.png");

    await runJpgToPngWorker(inputPath, outputPath);

    const metadata = await stat(outputPath);

    if (!metadata.isFile() || metadata.size === 0) {
      throw new Error("Output file is empty or not a file.");
    }

    const resultState = getJobState();
    if (resultState.status !== "running" || resultState.jobId !== jobId) {
      return;
    }

    const resultId = registerResult(outputPath);
    succeedJob(jobId, resultId);
  } catch (error) {
    failJob(
      jobId,
      error instanceof Error ? error.message : "Conversion failed.",
    );
  }
}
