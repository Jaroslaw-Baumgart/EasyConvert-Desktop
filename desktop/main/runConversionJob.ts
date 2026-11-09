import { app } from "electron";
import { mkdtemp, stat } from "node:fs/promises";
import path from "node:path";
import type { StartConversionRequest } from "../../shared/desktopContract";
import { getPdfPagePaths } from "../../conversion-core/pdf/convertPdfToJpg";
import { failJob, getJobState, succeedJob } from "./jobRegistry";
import { registerResults } from "./resultRegistry";
import { runConversionWorker } from "./runConversionWorker";

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
      const outputNames = {
        "jpg-to-png": "result.png",
        "png-to-jpg": "result.jpg",
        "jpg-to-pdf": "result.pdf",
        "txt-to-pdf": "result.pdf",
        "csv-to-pdf": "result.pdf",
        "pdf-to-txt": "result.txt",
        "docx-to-pdf": "result.pdf",
        "pptx-to-pdf": "result.pdf",
        "xlsx-to-pdf": "result.pdf",
      } satisfies Record<
        Exclude<StartConversionRequest["conversion"], "pdf-to-jpg">,
        string
      >;

      const outputPath = path.join(directory, outputNames[request.conversion]);

      await runConversionWorker(inputPath, outputPath, request);
      outputPaths = [outputPath];
    }

    for (const outputPath of outputPaths) {
      const metadata = await stat(outputPath);

      if (!metadata.isFile() || metadata.size === 0) {
        throw new Error("Output file is empty or not a file.");
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
