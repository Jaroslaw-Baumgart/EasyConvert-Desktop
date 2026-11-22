import { app, dialog, ipcMain, type BrowserWindow } from "electron";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { assertTrustedSender } from "../security/assertTrustedSender";
import { getDefaultSettings, loadSettings, saveSettings } from "./settingsStore";

export function registerSettingsIpc(
  owner: BrowserWindow,
  rendererUrl: string,
): void {
  ipcMain.handle("easyconvert:get-app-version", async (event, ...args: unknown[]) => {
    assertTrustedSender(event, owner, rendererUrl);
    if (args.length !== 0) throw new Error("Unexpected arguments.");
    if (app.isPackaged) return app.getVersion();
    const metadata: unknown = JSON.parse(
      await readFile(path.resolve(__dirname, "../../../../package.json"), "utf8"),
    );
    if (typeof metadata !== "object" || metadata === null ||
        !("version" in metadata) || typeof metadata.version !== "string" || !metadata.version) {
      throw new Error("Missing application version.");
    }
    return metadata.version;
  });
  ipcMain.handle("easyconvert:get-default-settings", (event, ...args: unknown[]) => {
    assertTrustedSender(event, owner, rendererUrl);
    if (args.length !== 0) {
      throw new Error("Unexpected arguments.");
    }
    return getDefaultSettings();
  });
  ipcMain.handle("easyconvert:get-settings", (event, ...args: unknown[]) => {
    assertTrustedSender(event, owner, rendererUrl);
    if (args.length !== 0) {
      throw new Error("Unexpected arguments.");
    }
    return loadSettings();
  });

  ipcMain.handle("easyconvert:save-settings", (event, ...args: unknown[]) => {
    assertTrustedSender(event, owner, rendererUrl);
    const [value] = args;
    if (args.length !== 1) {
      throw new Error("Expected exactly one argument.");
    }
    return saveSettings(value);
  });

  ipcMain.handle(
    "easyconvert:select-output-directory",
    async (event, ...args: unknown[]) => {
      assertTrustedSender(event, owner, rendererUrl);
      if (args.length !== 0) {
        throw new Error("Unexpected arguments.");
      }
      const result = await dialog.showOpenDialog(owner, {
        properties: ["openDirectory"],
      });

      if (result.canceled) {
        return null;
      }
      return result.filePaths[0] ?? null;
    },
  );
}
