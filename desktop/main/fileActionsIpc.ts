import { dialog, ipcMain, type BrowserWindow } from "electron";
import { copyFile, stat } from "node:fs/promises";
import path from "node:path";
import { assertTrustedSender } from "./assertTrustedSender";
import { clearSource, getCurrentSourcePath } from "./sourceRegistry";
import { clearResult, getResultPath } from "./resultRegistry";
import { getJobState, resetJob } from "./jobRegistry";

export function registerFileActionsIpc(owner: BrowserWindow, rendererUrl: string): void {
  ipcMain.handle("easyconvert:reset-source", (event, ...args: unknown[]) => {
    assertTrustedSender(event, owner, rendererUrl);
    if (args.length) throw new Error("Unexpected arguments.");
    resetJob();
    clearSource();
    clearResult();
  });

  ipcMain.handle("easyconvert:save-result", async (event, ...args: unknown[]) => {
    assertTrustedSender(event, owner, rendererUrl);
    if (args.length !== 1 || typeof args[0] !== "string" || !args[0] || args[0].length > 128) {
      throw new Error("Expected a result identifier.");
    }
    const resultId = args[0];
    const job = getJobState();
    if (job.status !== "succeeded" || job.resultId !== resultId) throw new Error("Unknown result.");
    const resultPath = getResultPath(resultId);
    const selection = await dialog.showSaveDialog(owner, {
      defaultPath: "result.png", filters: [{ name: "PNG image", extensions: ["png"] }],
      properties: ["showOverwriteConfirmation"],
    });
    if (selection.canceled || !selection.filePath) return { status: "cancelled" };
    assertTrustedSender(event, owner, rendererUrl);
    if (getResultPath(resultId) !== resultPath) throw new Error("Result has expired.");
    const normalize = (value: string) => process.platform === "win32"
      ? path.resolve(value).toLowerCase() : path.resolve(value);
    let destination;
    try { destination = await stat(selection.filePath); } catch (error) {
      if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) throw error;
    }
    for (const protectedPath of [resultPath, getCurrentSourcePath()]) {
      if (!protectedPath) continue;
      const info = await stat(protectedPath);
      if (normalize(protectedPath) === normalize(selection.filePath) ||
        (destination && info.dev === destination.dev && info.ino === destination.ino)) {
        throw new Error("Cannot overwrite the source or temporary result.");
      }
    }
    if (getResultPath(resultId) !== resultPath) throw new Error("Result has expired.");
    await copyFile(resultPath, selection.filePath);
    return { status: "saved" };
  });
}
