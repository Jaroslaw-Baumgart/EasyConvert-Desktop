import { extname } from "node:path";
import { getConversionDefinition } from "../../shared/conversions";
import type { StartConversionResponse } from "../../shared/desktopContract";
import { parseStartConversionRequest } from "./parseStartConversionRequest";
import { getSourcePath } from "./sourceRegistry";
import { startJob } from "./jobRegistry";
import { clearResult } from "./resultRegistry";
import { runConversionJob } from "./runConversionJob";

let activeConversion: {
  jobId: string;
  controller: AbortController;
} | null = null;

export function startConversion(
  value: unknown,
  onStateChanged: () => void,
): StartConversionResponse {
  const request = parseStartConversionRequest(value);
  const sourcePath = getSourcePath(request.sourceId);
  const extension = extname(sourcePath).slice(1).toLowerCase();
  const sourceFormat = extension === "jpeg" ? "jpg" : extension;
  const conversionDefinition = getConversionDefinition(request.conversion);

  if (conversionDefinition.sourceFormat !== sourceFormat) {
    throw new Error("Source format does not match the conversion.");
  }

  const jobId = startJob();
  clearResult();
  onStateChanged();
  const controller = new AbortController();
  activeConversion = { jobId, controller };
  void runConversionJob(
    jobId,
    sourcePath,
    onStateChanged,
    request,
    controller.signal,
  ).finally(() => {
    if (activeConversion?.jobId === jobId) {
      activeConversion = null;
    }
  });
  return { jobId };
}

export function cancelConversion(jobId: string): void {
  if (activeConversion?.jobId === jobId) {
    activeConversion.controller.abort();
  }
}
