import { dialog, type BrowserWindow } from "electron";
import type { SourceSelection } from "../../shared/desktopContract";
import { getJobState } from "./jobRegistry";
import { prepareSource } from "./prepareSource";

export async function selectSourcePath(
  owner: BrowserWindow,
): Promise<string | null> {
  const result = await dialog.showOpenDialog(owner, {
    properties: ["openFile"],
    filters: [
      {
        name: "Supported files",
        extensions: [
          "jpg",
          "jpeg",
          "png",
          "pdf",
          "txt",
          "csv",
          "docx",
          "xlsx",
          "pptx",
        ],
      },
    ],
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
  if (getJobState().status === "running") {
    throw new Error("A job is already running.");
  }

  const sourcePath = await selectSourcePath(owner);

  if (sourcePath === null) {
    return { status: "cancelled" };
  }

  const source = await prepareSource(sourcePath);
  return { status: "selected", source };
}
