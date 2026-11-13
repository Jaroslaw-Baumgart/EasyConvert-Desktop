import { copySourceFile } from "./copySourceFile";
import { rm, stat } from "node:fs/promises";
import { basename, extname } from "node:path";
import { isSupportedSourceFormat } from "../../shared/conversions";
import { MAX_SOURCE_BYTES } from "../../shared/conversionLimits";
import type { SelectedSource } from "../../shared/desktopContract";
import { registerSource } from "./sourceRegistry";
import { getJobState, resetJob } from "./jobRegistry";
import { clearResult } from "./resultRegistry";

export async function prepareSource(
  sourcePath: string,
): Promise<SelectedSource> {
  if (getJobState().status === "running")
    throw new Error("A job is already running.");

  const extension = extname(sourcePath).slice(1).toLowerCase();
  const sourceFormat = extension === "jpeg" ? "jpg" : extension;

  if (!isSupportedSourceFormat(sourceFormat)) {
    throw new Error(`Unsupported file format: ${extension}`);
  }

  const metadata = await stat(sourcePath);

  if (!metadata.isFile()) {
    throw new Error("Selected path is not a file.");
  }
  if (metadata.size === 0) {
    throw new Error("Selected file is empty.");
  }
  if (metadata.size > MAX_SOURCE_BYTES) {
    throw new Error("Selected file is too large (max 10 MB).");
  }

  const copiedSource = await copySourceFile(sourcePath);

  try {
    if (getJobState().status === "running") {
      throw new Error("A job is already running.");
    }

    resetJob();
    clearResult();

    const sourceId = registerSource(
      copiedSource.path,
      sourcePath,
      copiedSource.directory,
    );

    return {
      sourceId,
      name: basename(sourcePath),
      sizeBytes: copiedSource.sizeBytes,
    };
  } catch (error) {
    await rm(copiedSource.directory, { recursive: true, force: true });
    throw error;
  }
}
