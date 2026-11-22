import path from "node:path";
import { beforeEach, expect, it, vi } from "vitest";
import { loadWindowState, saveWindowState } from "../../main/window/windowState";

const mocks = vi.hoisted(() => ({
  read: vi.fn(), mkdir: vi.fn(), write: vi.fn(), rename: vi.fn(), rm: vi.fn(),
  primary: vi.fn(), matching: vi.fn(),
}));
vi.mock("electron", () => ({
  app: { getPath: () => "C:/test-user-data" },
  screen: { getPrimaryDisplay: mocks.primary, getDisplayMatching: mocks.matching },
}));
vi.mock("node:fs/promises", () => ({
  readFile: mocks.read, mkdir: mocks.mkdir, writeFile: mocks.write, rename: mocks.rename, rm: mocks.rm,
}));

const area = { x: 0, y: 0, width: 1920, height: 1040 };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.read.mockRejectedValue(new Error("Missing file"));
  mocks.primary.mockReturnValue({ workArea: area });
  mocks.matching.mockReturnValue({ workArea: area });
  for (const operation of [mocks.mkdir, mocks.write, mocks.rename, mocks.rm]) operation.mockResolvedValue(undefined);
});

it("centers a default window when the state file is missing", async () => {
  expect(await loadWindowState()).toEqual({
    bounds: { x: 360, y: 120, width: 1200, height: 800 }, maximized: false,
  });
});

it("falls back safely for a damaged state file", async () => {
  mocks.read.mockResolvedValue(JSON.stringify({ version: 1, bounds: { x: "bad" }, maximized: true }));
  expect((await loadWindowState()).maximized).toBe(false);
  expect((await loadWindowState()).bounds.width).toBe(1200);
});

it("preserves normal bounds and maximization on a monitor with negative coordinates", async () => {
  const bounds = { x: -1600, y: 100, width: 1100, height: 750 };
  mocks.read.mockResolvedValue(JSON.stringify({ version: 1, bounds, maximized: true }));
  mocks.matching.mockReturnValue({ workArea: { x: -1920, y: 0, width: 1920, height: 1080 } });
  expect(await loadWindowState()).toEqual({ bounds, maximized: true });
});

it("fits an oversized offscreen window into a remaining monitor", async () => {
  mocks.read.mockResolvedValue(JSON.stringify({
    version: 1, bounds: { x: 5000, y: -900, width: 4000, height: 2000 }, maximized: false,
  }));
  expect((await loadWindowState()).bounds).toEqual(area);
});

it("fits the default window even when the work area is smaller than the usual minimum", async () => {
  const small = { x: 0, y: 0, width: 800, height: 500 };
  mocks.primary.mockReturnValue({ workArea: small });
  mocks.matching.mockReturnValue({ workArea: small });
  expect((await loadWindowState()).bounds).toEqual(small);
});

it("writes a versioned snapshot through a temporary file before replacement", async () => {
  const bounds = { x: 40, y: 50, width: 1100, height: 750 };
  await saveWindowState(bounds, true);
  const statePath = path.join("C:/test-user-data", "window-state.json");
  const temporaryPath = mocks.write.mock.calls[0]![0];
  expect(temporaryPath).toMatch(/window-state\.json\..+\.tmp$/);
  expect(JSON.parse(mocks.write.mock.calls[0]![1])).toEqual({ version: 1, bounds, maximized: true });
  expect(mocks.rename).toHaveBeenCalledExactlyOnceWith(temporaryPath, statePath);
  expect(mocks.write.mock.invocationCallOrder[0]).toBeLessThan(mocks.rename.mock.invocationCallOrder[0]!);
  expect(mocks.rm).toHaveBeenCalledExactlyOnceWith(temporaryPath, { force: true });
});

it("keeps the previous snapshot when writing fails and removes the temporary file", async () => {
  mocks.write.mockRejectedValueOnce(new Error("Disk full"));
  await expect(saveWindowState(area, false)).rejects.toThrow("Disk full");
  expect(mocks.rename).not.toHaveBeenCalled();
  expect(mocks.rm).toHaveBeenCalledExactlyOnceWith(mocks.write.mock.calls[0]![0], { force: true });
});
