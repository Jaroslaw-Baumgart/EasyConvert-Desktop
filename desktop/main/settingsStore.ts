import { app } from "electron";
import path from "node:path";
import type { AppSettings } from "../../shared/desktopContract";
import { getDefaultOutputDirectory } from "./saveResultFile";
import { parseSettings } from "./parseSettings";
import { readFile, mkdir, writeFile, rename, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";

export function getDefaultSettings(): AppSettings {
  return {
    language: "en",
    theme: "light",
    outputDirectory: getDefaultOutputDirectory(),
    accentColor: "white",
  };
}

function getSettingsPath(): string {
  return path.join(app.getPath("userData"), "settings.json");
}

export async function loadSettings(): Promise<AppSettings> {
  try {
    const data = await readFile(getSettingsPath(), "utf-8");
    const value: unknown = JSON.parse(data);

    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("Invalid settings");
    }

    if (!("version" in value) || value.version !== 1) {
      throw new Error("Invalid version");
    }

    if (!("settings" in value)) {
      throw new Error("Missing settings");
    }

    return parseSettings(value.settings);
  } catch {
    return getDefaultSettings();
  }
}

export async function saveSettings(value: unknown): Promise<void> {
  const settings = parseSettings(value);
  const settingsPath = getSettingsPath();
  const temporaryPath = `${settingsPath}.${randomUUID()}.tmp`;

  await mkdir(path.dirname(settingsPath), { recursive: true });
  try {
    await writeFile(temporaryPath, JSON.stringify({ version: 1, settings }));
    await rename(temporaryPath, settingsPath);
  } finally {
    await rm(temporaryPath, { force: true });
  }
}
