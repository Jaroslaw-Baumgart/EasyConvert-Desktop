import { ipcMain, type BrowserWindow } from "electron";
import { selectSource } from "./selectSource";

export function registerSourceIpc(
  owner: BrowserWindow,
  rendererUrl: string,
): void {
  ipcMain.handle(
    "easyconvert:select-source",
    async (event, ...args: unknown[]) => {
      if (owner.isDestroyed()) {
        throw new Error("Owner window is destroyed.");
      }
      if (args.length > 0) {
        throw new Error("Unexpected arguments.");
      }
      if (event.sender !== owner.webContents) {
        throw new Error("Unexpected sender.");
      }

      const frame = event.senderFrame;

      if (!frame || frame !== owner.webContents.mainFrame) {
        throw new Error("Unexpected sender frame URL.");
      }

      const senderUrl = new URL(frame.url);
      senderUrl.hash = "";

      if (senderUrl.href !== rendererUrl) {
        throw new Error("Unexpected sender frame URL.");
      }

      return selectSource(owner);
    },
  );
}
