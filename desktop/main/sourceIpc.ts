import { ipcMain, type BrowserWindow } from "electron";
import { selectSource } from "./selectSource";
import { assertTrustedSender } from "./assertTrustedSender";

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
}
