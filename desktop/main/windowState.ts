import { app, screen, type Rectangle } from "electron";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

type WindowState = { bounds: Rectangle; maximized: boolean };

function getStatePath(): string {
  return path.join(app.getPath("userData"), "window-state.json");
}

function parseState(value: unknown): WindowState | null {
  if (typeof value !== "object" || value === null || Array.isArray(value) ||
      !("version" in value) || value.version !== 1 ||
      !("maximized" in value) || typeof value.maximized !== "boolean" ||
      !("bounds" in value) || typeof value.bounds !== "object" ||
      value.bounds === null || Array.isArray(value.bounds)) return null;

  const bounds = value.bounds;
  if (!("x" in bounds) || typeof bounds.x !== "number" || !Number.isSafeInteger(bounds.x) ||
      !("y" in bounds) || typeof bounds.y !== "number" || !Number.isSafeInteger(bounds.y) ||
      !("width" in bounds) || typeof bounds.width !== "number" || !Number.isSafeInteger(bounds.width) || bounds.width <= 0 ||
      !("height" in bounds) || typeof bounds.height !== "number" || !Number.isSafeInteger(bounds.height) || bounds.height <= 0) return null;

  return {
    bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
    maximized: value.maximized,
  };
}

export async function loadWindowState(): Promise<WindowState> {
  let saved: WindowState | null = null;
  try {
    const value: unknown = JSON.parse(await readFile(getStatePath(), "utf8"));
    saved = parseState(value);
  } catch {
    // First launch or an unreadable state file uses the default window.
  }

  const primary = screen.getPrimaryDisplay().workArea;
  const defaultWidth = Math.min(1200, primary.width);
  const defaultHeight = Math.min(800, primary.height);
  const requested = saved?.bounds ?? {
    x: primary.x + Math.floor((primary.width - defaultWidth) / 2),
    y: primary.y + Math.floor((primary.height - defaultHeight) / 2),
    width: defaultWidth,
    height: defaultHeight,
  };
  const area = screen.getDisplayMatching(requested).workArea;
  const width = Math.min(area.width, Math.max(900, requested.width));
  const height = Math.min(area.height, Math.max(600, requested.height));

  return {
    bounds: {
      x: Math.max(area.x, Math.min(requested.x, area.x + area.width - width)),
      y: Math.max(area.y, Math.min(requested.y, area.y + area.height - height)),
      width,
      height,
    },
    maximized: saved?.maximized ?? false,
  };
}

export async function saveWindowState(bounds: Rectangle, maximized: boolean): Promise<void> {
  const statePath = getStatePath();
  const temporaryPath = `${statePath}.${randomUUID()}.tmp`;
  await mkdir(path.dirname(statePath), { recursive: true });
  try {
    await writeFile(temporaryPath, JSON.stringify({ version: 1, bounds, maximized }), "utf8");
    await rename(temporaryPath, statePath);
  } finally {
    await rm(temporaryPath, { force: true });
  }
}
