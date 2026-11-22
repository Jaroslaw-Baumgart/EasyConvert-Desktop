import { extname } from "node:path";
import { getConversionDefinition } from "../../../shared/conversions";
import type { StartConversionResponse } from "../../../shared/contracts/desktopContract";
import { parseStartConversionRequest } from "./parseStartConversionRequest";
import { getSourcePath } from "../sources/sourceRegistry";
import { startJob } from "./jobRegistry";
import { clearResult } from "../results/resultRegistry";
import { runConversionJob } from "./runConversionJob";

let activeConversion: {
  jobId: string;
  controller: AbortController;
  completion: Promise<void>;
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
  const completion = runConversionJob(
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

  activeConversion = { jobId, controller, completion };
  return { jobId };
}

export function cancelConversion(jobId: string): void {
  if (activeConversion?.jobId === jobId) {
    activeConversion.controller.abort();
  }
}

export async function stopActiveConversion(): Promise<void> {
  const conversion = activeConversion;

  if (conversion === null) {
    return;
  }

  conversion.controller.abort();
  await conversion.completion;
}
