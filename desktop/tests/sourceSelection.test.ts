import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BrowserWindow } from "electron";

const mocks = vi.hoisted(() => ({
  showOpenDialog: vi.fn(),
  stat: vi.fn(),
}));

vi.mock("electron", () => ({
  dialog: { showOpenDialog: mocks.showOpenDialog },
}));

vi.mock("node:fs/promises", () => ({
  stat: mocks.stat,
}));

import { selectSource } from "../main/selectSource";
import {
  clearSource,
  getSourcePath,
  registerSource,
} from "../main/sourceRegistry";

const owner = {} as BrowserWindow;
const previousPath = "C:/fixtures/previous.jpg";
let previousId: string;

beforeEach(() => {
  clearSource();
  previousId = registerSource(previousPath);

  mocks.showOpenDialog.mockReset();
  mocks.stat.mockReset();

  mocks.showOpenDialog.mockResolvedValue({
    canceled: false,
    filePaths: ["C:/fixtures/photo.jpg"],
  });

  mocks.stat.mockResolvedValue({
    isFile: () => true,
    size: 2048,
  });
});

afterEach(() => {
  clearSource();
});

describe("selectSource", () => {
  it("returns metadata without exposing the path", async () => {
    const result = await selectSource(owner);

    expect(result).toEqual({
      status: "selected",
      source: {
        sourceId: expect.any(String),
        name: "photo.jpg",
        sizeBytes: 2048,
      },
    });

    expect(() => getSourcePath(previousId)).toThrow("Unknown source.");
  });

  it("preserves the previous source when cancelled", async () => {
    mocks.showOpenDialog.mockResolvedValue({
      canceled: true,
      filePaths: [],
    });

    await expect(selectSource(owner)).resolves.toEqual({ status: "cancelled" });

    expect(mocks.stat).not.toHaveBeenCalled();
    expect(getSourcePath(previousId)).toBe(previousPath);
  });

  it.each([
    {
      label: "directory",
      isFile: false,
      size: 2048,
      error: "Selected path is not a file.",
    },
    {
      label: "empty file",
      isFile: true,
      size: 0,
      error: "Selected file is empty.",
    },
    {
      label: "oversized file",
      isFile: true,
      size: 10_000_001,
      error: "Selected file is too large (max 10 MB).",
    },
  ])("rejects a $label without replacing the source", async (sample) => {
    mocks.stat.mockResolvedValue({
      isFile: () => sample.isFile,
      size: sample.size,
    });

    await expect(selectSource(owner)).rejects.toThrow(sample.error);
    expect(getSourcePath(previousId)).toBe(previousPath);
  });

  it("accepts a file exactly at the 10 MB limit", async () => {
    mocks.stat.mockResolvedValue({
      isFile: () => true,
      size: 10_000_000,
    });

    await expect(selectSource(owner)).resolves.toMatchObject({
      status: "selected",
      source: { sizeBytes: 10_000_000 },
    });
  });

  it("preserves the previous source when reading metadata fails", async () => {
    const error = new Error("Cannot read file metadata");
    mocks.stat.mockRejectedValue(error);

    await expect(selectSource(owner)).rejects.toBe(error);
    expect(getSourcePath(previousId)).toBe(previousPath);
  });
});
