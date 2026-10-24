import type { StartConversionResponse } from "../../shared/desktopContract";
import { parseStartConversionRequest } from "./parseStartConversionRequest";
import { getSourcePath } from "./sourceRegistry";
import { startJob } from "./jobRegistry";
import { clearResult } from "./resultRegistry";
import { runConversionJob } from "./runConversionJob";

export function startConversion(
  value: unknown,
  onStateChanged: () => void,
): StartConversionResponse {
  const request = parseStartConversionRequest(value);
  const sourcePath = getSourcePath(request.sourceId);
  const jobId = startJob();
  clearResult();
  onStateChanged();
  void runConversionJob(jobId, sourcePath, onStateChanged);
  return { jobId };
}
