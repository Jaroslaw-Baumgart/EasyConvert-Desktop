import { ipcMain, type BrowserWindow } from "electron";
import { assertTrustedSender } from "../security/assertTrustedSender";

export function registerWindowIpc(
  owner: BrowserWindow,
  rendererUrl: string,
  respondToCloseRequest: (confirmed: boolean) => Promise<void>,
): void {
  ipcMain.handle("easyconvert:respond-to-close-request", async (event, ...args: unknown[]) => {
    assertTrustedSender(event, owner, rendererUrl);
    if (args.length !== 1 || typeof args[0] !== "boolean") {
      throw new Error("Expected a close confirmation.");
    }
    await respondToCloseRequest(args[0]);
  });
  ipcMain.handle("easyconvert:minimize-window", (event, ...args: unknown[]) => {
    assertTrustedSender(event, owner, rendererUrl);
    if (args.length !== 0) {
      throw new Error("Unexpected arguments.");
    }

    owner.minimize();
  });

  ipcMain.handle(
    "easyconvert:toggle-maximize-window",
    (event, ...args: unknown[]) => {
      assertTrustedSender(event, owner, rendererUrl);
      if (args.length !== 0) {
        throw new Error("Unexpected arguments.");
      }

      if (owner.isMaximized()) {
        owner.unmaximize();
      } else {
        owner.maximize();
      }
    },
  );

  ipcMain.handle("easyconvert:close-window", (event, ...args: unknown[]) => {
    assertTrustedSender(event, owner, rendererUrl);
    if (args.length !== 0) {
      throw new Error("Unexpected arguments.");
    }

    owner.close();
  });
}
