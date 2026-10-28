import { stat } from "node:fs/promises";
import { basename } from "node:path";
import type { SelectedSource } from "../../shared/desktopContract";
import { registerSource } from "./sourceRegistry";
import { getJobState, resetJob } from "./jobRegistry";
import { clearResult } from "./resultRegistry";

export async function prepareSource(
  sourcePath: string,
): Promise<SelectedSource> {
  if (getJobState().status === "running")
    throw new Error("A job is already running.");

  const metadata = await stat(sourcePath);

  if (!metadata.isFile()) {
    throw new Error("Selected path is not a file.");
  }
  if (metadata.size === 0) {
    throw new Error("Selected file is empty.");
  }
  if (metadata.size > 10_000_000) {
    throw new Error("Selected file is too large (max 10 MB).");
  }

  const fileSize = metadata.size;
  resetJob();
  clearResult();
  const sourceId = registerSource(sourcePath);
  const fileName = basename(sourcePath);
  return {
    sourceId,
    name: fileName,
    sizeBytes: fileSize,
  };
}
