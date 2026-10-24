import { ipcMain, type BrowserWindow } from "electron";
import { assertTrustedSender } from "./assertTrustedSender";
import { startConversion } from "./startConversion";
import { getJobState } from "./jobRegistry";

export function registerConversionIpc(
  owner: BrowserWindow,
  rendererUrl: string,
): void {
  function publishJobState(): void {
    if (owner.isDestroyed() || owner.webContents.isDestroyed()) {
      return;
    }

    const currentUrl = owner.webContents.getURL();

    if (currentUrl.length === 0) {
      return;
    }

    const senderUrl = new URL(currentUrl);
    senderUrl.hash = "";

    if (senderUrl.href !== rendererUrl) {
      return;
    }

    owner.webContents.send("easyconvert:job-state-changed", getJobState());
  }

  ipcMain.handle(
    "easyconvert:start-conversion",
    (event, ...args: unknown[]) => {
      assertTrustedSender(event, owner, rendererUrl);

      if (args.length !== 1) {
        throw new Error("Expected exactly one argument.");
      }

      return startConversion(args[0], publishJobState);
    },
  );

  ipcMain.handle("easyconvert:get-job-state", (event, ...args: unknown[]) => {
    assertTrustedSender(event, owner, rendererUrl);
    if (args.length !== 0) {
      throw new Error("Unexpected arguments.");
    }

    return getJobState();
  });
}
