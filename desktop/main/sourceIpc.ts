import { ipcMain, type BrowserWindow } from "electron";
import { selectSource } from "./selectSource";
import { assertTrustedSender } from "./assertTrustedSender";
import { isAbsolute } from "node:path";
import { prepareSource } from "./prepareSource";

export function registerSourceIpc(
  owner: BrowserWindow,
  rendererUrl: string,
): void {
  ipcMain.handle(
    "easyconvert:select-source",
    async (event, ...args: unknown[]) => {
      assertTrustedSender(event, owner, rendererUrl);

      if (args.length > 0) {
        throw new Error("Unexpected arguments.");
      }

      return selectSource(owner);
    },
  );

  ipcMain.handle(
    "easyconvert:select-dropped-source",
    (event, ...args: unknown[]) => {
      assertTrustedSender(event, owner, rendererUrl);

      if (args.length !== 1) {
        throw new Error("Expected exactly one argument.");
      }

      if (typeof args[0] !== "string" || args[0].length === 0) {
        throw new Error("Expected a file path.");
      }

      if (!isAbsolute(args[0])) {
        throw new Error("Expected an absolute file path.");
      }

      return prepareSource(args[0]);
    },
  );
}
