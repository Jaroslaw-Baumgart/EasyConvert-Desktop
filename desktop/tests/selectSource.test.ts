import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BrowserWindow } from "electron";

const mocks = vi.hoisted(() => ({
  showOpenDialog: vi.fn(),
}));

vi.mock("electron", () => ({
  dialog: {
    showOpenDialog: mocks.showOpenDialog,
  },
}));

import { selectSourcePath } from "../main/selectSource";

// Atrapa właściciela dialogu — nie tworzymy prawdziwego okna.
const owner = {} as BrowserWindow;

beforeEach(() => {
  mocks.showOpenDialog.mockReset();
});

describe("selectSourcePath", () => {
  it("returns null when the user cancels", async () => {
    mocks.showOpenDialog.mockResolvedValue({
      canceled: true,
      filePaths: [],
    });

    await expect(selectSourcePath(owner)).resolves.toBeNull();
  });

  it("returns the selected path", async () => {
    mocks.showOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ["C:/fixtures/photo.jpg"],
    });

    await expect(selectSourcePath(owner))
      .resolves.toBe("C:/fixtures/photo.jpg");
  });

  it.each([
    { paths: [] },
    { paths: ["C:/fixtures/one.jpg", "C:/fixtures/two.jpg"] },
  ])("rejects an invalid number of paths: $paths", async ({ paths }) => {
    mocks.showOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: paths,
    });

    await expect(selectSourcePath(owner))
      .rejects.toThrow("Expected exactly one selected file.");
  });

  it("propagates a dialog failure", async () => {
    const error = new Error("Dialog unavailable");
    mocks.showOpenDialog.mockRejectedValue(error);

    await expect(selectSourcePath(owner)).rejects.toBe(error);
  });
});