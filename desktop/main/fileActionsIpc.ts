import { dialog, ipcMain, type BrowserWindow } from "electron";
import { copyFile, stat } from "node:fs/promises";
import path from "node:path";
import { assertTrustedSender } from "./assertTrustedSender";
import { clearSource, getCurrentSourcePath } from "./sourceRegistry";
import { clearResult, getResultPath } from "./resultRegistry";
import { getJobState, resetJob } from "./jobRegistry";
import { getDefaultOutputDirectory, saveResultFile } from "./saveResultFile";

function getExportFileName(
  sourcePath: string,
  resultPath: string,
  pageNumber?: number,
): string {
  const { name } = path.parse(sourcePath);
  const extension = path.extname(resultPath);

  return pageNumber !== undefined
    ? `${name}-page-${pageNumber}${extension}`
    : `${name}${extension}`;
}

function resolveResult(args: unknown[]): {
  resultId: string;
  resultPath: string;
  fileName: string;
} {
  if (
    args.length !== 1 ||
    typeof args[0] !== "string" ||
    args[0].length === 0 ||
    args[0].length > 128
  ) {
    throw new Error("Expected a result identifier.");
  }

  const resultId = args[0];
  const job = getJobState();

  if (job.status !== "succeeded" || !job.resultIds.includes(resultId)) {
    throw new Error("Unknown result.");
  }

  const resultPath = getResultPath(resultId);
  const sourcePath = getCurrentSourcePath();

  if (!sourcePath) {
    throw new Error("Unknown source.");
  }

  const pageNumber =
    job.resultIds.length > 1 ? job.resultIds.indexOf(resultId) + 1 : undefined;

  return {
    resultId,
    resultPath,
    fileName: getExportFileName(sourcePath, resultPath, pageNumber),
  };
}

export function registerFileActionsIpc(
  owner: BrowserWindow,
  rendererUrl: string,
): void {
  ipcMain.handle("easyconvert:reset-source", (event, ...args: unknown[]) => {
    assertTrustedSender(event, owner, rendererUrl);

    if (args.length > 0) {
      throw new Error("Unexpected arguments.");
    }

    resetJob();
    clearSource();
    clearResult();
  });

  ipcMain.handle(
    "easyconvert:save-result",
    async (event, ...args: unknown[]) => {
      assertTrustedSender(event, owner, rendererUrl);

      const { resultPath, fileName } = resolveResult(args);
      const outputDirectory = getDefaultOutputDirectory();

      await saveResultFile(resultPath, outputDirectory, fileName);

      return { status: "saved" };
    },
  );

  ipcMain.handle(
    "easyconvert:save-result-as",
    async (event, ...args: unknown[]) => {
      assertTrustedSender(event, owner, rendererUrl);

      const { resultId, resultPath, fileName } = resolveResult(args);
      const extension = path.extname(resultPath).slice(1).toLowerCase();

      const selection = await dialog.showSaveDialog(owner, {
        defaultPath: fileName,
        filters: [
          {
            name: `${extension.toUpperCase()} file`,
            extensions: [extension],
          },
        ],
        properties: ["showOverwriteConfirmation"],
      });

      if (selection.canceled || !selection.filePath) {
        return { status: "cancelled" };
      }

      assertTrustedSender(event, owner, rendererUrl);

      if (getResultPath(resultId) !== resultPath) {
        throw new Error("Result has expired.");
      }

      const normalize = (value: string): string =>
        process.platform === "win32"
          ? path.resolve(value).toLowerCase()
          : path.resolve(value);

      let destination: Awaited<ReturnType<typeof stat>> | undefined;

      try {
        destination = await stat(selection.filePath);
      } catch (error: unknown) {
        if (
          typeof error !== "object" ||
          error === null ||
          !("code" in error) ||
          error.code !== "ENOENT"
        ) {
          throw error;
        }
      }

      for (const protectedPath of [resultPath, getCurrentSourcePath()]) {
        if (!protectedPath) {
          continue;
        }

        const info = await stat(protectedPath);

        if (
          normalize(protectedPath) === normalize(selection.filePath) ||
          (destination &&
            info.dev === destination.dev &&
            info.ino === destination.ino)
        ) {
          throw new Error("Cannot overwrite the source or temporary result.");
        }
      }

      if (getResultPath(resultId) !== resultPath) {
        throw new Error("Result has expired.");
      }

      await copyFile(resultPath, selection.filePath);

      return { status: "saved" };
    },
  );
}
