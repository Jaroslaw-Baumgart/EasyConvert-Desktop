import { dialog, type BrowserWindow } from "electron";
import { stat } from "node:fs/promises";
import { basename } from "node:path";
import type { SourceSelection } from "../../shared/desktopContract";
import { registerSource } from "./sourceRegistry";
import { getJobState, resetJob } from "./jobRegistry";
import { clearResult } from "./resultRegistry";

export async function selectSourcePath(
  owner: BrowserWindow,
): Promise<string | null> {
  const result = await dialog.showOpenDialog(owner, {
    properties: ["openFile"],
    filters: [{ name: "Supported files", extensions: ["jpg", "jpeg", "png", "pdf", "txt", "csv", "docx", "xlsx", "pptx"] }],
  });

  if (result.canceled) return null;
  if (result.filePaths.length !== 1) {
    throw new Error("Expected exactly one selected file.");
  }
  return result.filePaths[0];
}

export async function selectSource(
  owner: BrowserWindow,
): Promise<SourceSelection> {
  if (getJobState().status === "running") throw new Error("A job is already running.");
  const sourcePath = await selectSourcePath(owner);
  if (sourcePath === null) {
    return { status: "cancelled" };
  }
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
    status: "selected",
    source: {
      sourceId,
      name: fileName,
      sizeBytes: fileSize,
    },
  };
}
