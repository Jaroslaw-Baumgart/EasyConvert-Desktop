import { dialog, ipcMain, shell, type BrowserWindow } from "electron";
import { stat } from "node:fs/promises";
import path from "node:path";
import { assertTrustedSender } from "./assertTrustedSender";
import { clearSource, getCurrentSourcePath } from "./sourceRegistry";
import { clearResult, getResultPath } from "./resultRegistry";
import { getJobState, resetJob } from "./jobRegistry";
import { getDefaultOutputDirectory, saveResultFile } from "./saveResultFile";
import { saveArchive, saveArchiveAs } from "./saveArchive";
import { replaceResultFile } from "./replaceResultFile";
import type { SaveErrorCode } from "../../shared/desktopContract";

async function assertExportDestination(
  destinationPath: string,
  protectedPaths: readonly string[],
): Promise<void> {
  const normalize = (value: string): string =>
    process.platform === "win32"
      ? path.resolve(value).toLowerCase()
      : path.resolve(value);

  let destination: Awaited<ReturnType<typeof stat>> | undefined;
  try {
    destination = await stat(destinationPath);
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

  for (const protectedPath of protectedPaths) {
    const info = await stat(protectedPath);
    if (
      normalize(protectedPath) === normalize(destinationPath) ||
      (destination &&
        info.dev === destination.dev &&
        info.ino === destination.ino)
    ) {
      throw new Error("Cannot overwrite the source or temporary result.");
    }
  }
}

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

function parseResultIdentifier(args: unknown[]): string {
  if (
    args.length !== 1 ||
    typeof args[0] !== "string" ||
    args[0].length === 0 ||
    args[0].length > 128
  ) {
    throw new Error("Expected a result identifier.");
  }

  return args[0];
}

function resolveResult(resultId: string): {
  resultId: string;
  resultPath: string;
  fileName: string;
} {
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

function resolveArchiveEntries(): {
  resultPath: string;
  fileName: string;
}[] {
  const job = getJobState();

  if (job.status !== "succeeded") {
    throw new Error("No results available.");
  }

  return job.resultIds.map((resultId) => {
    const { resultPath, fileName } = resolveResult(resultId);
    return {
      resultPath,
      fileName,
    };
  });
}

function getSaveErrorCode(error: unknown): SaveErrorCode {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return "save-failed";
  }

  if (error.code === "ENOSPC") {
    return "disk-full";
  }

  if (error.code === "EACCES" || error.code === "EPERM") {
    return "permission-denied";
  }

  return "save-failed";
}

let lastSavedPath: string | null = null;

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

      const { resultPath, fileName } = resolveResult(
        parseResultIdentifier(args),
      );

      const outputDirectory = getDefaultOutputDirectory();

      try {
        const savedPath = await saveResultFile(
          resultPath,
          outputDirectory,
          fileName,
        );

        lastSavedPath = savedPath;

        return {
          status: "saved",
          fileName: path.basename(savedPath),
        };
      } catch (error: unknown) {
        return {
          status: "failed",
          code: getSaveErrorCode(error),
        };
      }
    },
  );

  ipcMain.handle(
    "easyconvert:save-archive",
    async (event, ...args: unknown[]) => {
      assertTrustedSender(event, owner, rendererUrl);

      if (
        (args.length !== 1 && args.length !== 2) ||
        !Array.isArray(args[0]) ||
        (args.length === 2 && typeof args[1] !== "boolean")
      ) {
        throw new Error("Expected conversion result identifiers.");
      }

      const requestedIds = args[0];
      const job = getJobState();

      if (job.status !== "succeeded") {
        throw new Error("Unknown conversion results.");
      }

      const { resultIds } = job;

      if (
        requestedIds.length !== resultIds.length ||
        !resultIds.every((id, index) => id === requestedIds[index])
      ) {
        throw new Error("Unknown conversion results.");
      }

      const entries = resolveArchiveEntries();
      const outputDirectory = getDefaultOutputDirectory();
      const sourcePath = getCurrentSourcePath();

      if (!sourcePath) {
        throw new Error("Unknown source.");
      }

      const fileName = `${path.parse(sourcePath).name}.zip`;
      let savedPath: string;

      try {
        if (args[1] === true) {
          const selection = await dialog.showSaveDialog(owner, {
            defaultPath: fileName,
            filters: [{ name: "ZIP archive", extensions: ["zip"] }],
            properties: ["showOverwriteConfirmation"],
          });
          if (selection.canceled || !selection.filePath) {
            return { status: "cancelled" };
          }

          const assertCurrentResults = (): void => {
            assertTrustedSender(event, owner, rendererUrl);
            const current = getJobState();
            if (
              current.status !== "succeeded" ||
              current.jobId !== job.jobId ||
              current.resultIds.length !== resultIds.length ||
              !resultIds.every(
                (id, index) =>
                  id === current.resultIds[index] &&
                  getResultPath(id) === entries[index]!.resultPath,
              ) ||
              getCurrentSourcePath() !== sourcePath
            ) {
              throw new Error("Conversion results have expired.");
            }
          };

          const destinationPath = selection.filePath;
          const protectedPaths = [
            sourcePath,
            ...entries.map((entry) => entry.resultPath),
          ];
          assertCurrentResults();
          await assertExportDestination(destinationPath, protectedPaths);
          savedPath = await saveArchiveAs(
            entries,
            destinationPath,
            async () => {
              assertCurrentResults();
              await assertExportDestination(destinationPath, protectedPaths);
              assertCurrentResults();
            },
          );
        } else {
          savedPath = await saveArchive(entries, outputDirectory, fileName);
        }

        lastSavedPath = savedPath;

        return {
          status: "saved",
          fileName: path.basename(savedPath),
        };
      } catch (error: unknown) {
        return {
          status: "failed",
          code: getSaveErrorCode(error),
        };
      }
    },
  );

  ipcMain.handle(
    "easyconvert:save-result-as",
    async (event, ...args: unknown[]) => {
      assertTrustedSender(event, owner, rendererUrl);

      const { resultId, resultPath, fileName } = resolveResult(
        parseResultIdentifier(args),
      );
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

      const sourcePath = getCurrentSourcePath();
      await assertExportDestination(
        selection.filePath,
        sourcePath ? [resultPath, sourcePath] : [resultPath],
      );

      if (getResultPath(resultId) !== resultPath) {
        throw new Error("Result has expired.");
      }

      try {
        await replaceResultFile(resultPath, selection.filePath);

        lastSavedPath = selection.filePath;

        return {
          status: "saved",
          fileName: path.basename(selection.filePath),
        };
      } catch (error: unknown) {
        return {
          status: "failed",
          code: getSaveErrorCode(error),
        };
      }
    },
  );

  ipcMain.handle(
    "easyconvert:show-last-saved-file",
    async (event, ...args: unknown[]) => {
      assertTrustedSender(event, owner, rendererUrl);

      if (args.length > 0) {
        throw new Error("Unexpected arguments.");
      }

      const savedPath = lastSavedPath;

      if (!savedPath) {
        throw new Error("No saved file available.");
      }

      const metadata = await stat(savedPath);

      if (!metadata.isFile()) {
        throw new Error("Saved file is no longer available.");
      }

      shell.showItemInFolder(savedPath);
    },
  );
}
