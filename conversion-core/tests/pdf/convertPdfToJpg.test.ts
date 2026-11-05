import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  readdir: vi.fn(),
  pdfToImages: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  readdir: mocks.readdir,
}));

vi.mock("../../pdf/poppler", () => ({
  pdfToImages: mocks.pdfToImages,
}));

import { convertPdfToJpg } from "../../pdf/convertPdfToJpg";

const options = {
  binDirectory: "tools/poppler/bin",
  timeoutMs: 120_000,
  maxPages: 100,
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.pdfToImages.mockResolvedValue(undefined);
  mocks.readdir.mockResolvedValue(["page-1.jpg"]);
});

describe("convertPdfToJpg", () => {
  it("passes paths, configuration and cancellation signal to Poppler", async () => {
    const controller = new AbortController();

    await convertPdfToJpg("input.pdf", "output", options, controller.signal);

    expect(mocks.pdfToImages).toHaveBeenCalledExactlyOnceWith(
      "input.pdf",
      "output",
      options,
      controller.signal,
    );
    expect(mocks.readdir).toHaveBeenCalledExactlyOnceWith("output");
  });

  it("returns full paths in numeric page order", async () => {
    mocks.readdir.mockResolvedValue([
      "page-10.jpg",
      "page-2.jpg",
      "page-1.jpg",
    ]);

    await expect(
      convertPdfToJpg("input.pdf", "output", options),
    ).resolves.toEqual([
      path.join("output", "page-1.jpg"),
      path.join("output", "page-2.jpg"),
      path.join("output", "page-10.jpg"),
    ]);
  });

  it("ignores files that do not match generated page names", async () => {
    mocks.readdir.mockResolvedValue([
      "notes.txt",
      "other.jpg",
      "page-one.jpg",
      "page-1.png",
      "page-1.jpg.backup",
      "page-1.jpg",
    ]);

    await expect(
      convertPdfToJpg("input.pdf", "output", options),
    ).resolves.toEqual([path.join("output", "page-1.jpg")]);
  });

  it.each([
    { label: "empty directory", names: [] },
    {
      label: "unrelated files",
      names: ["notes.txt", "other.jpg"],
    },
  ])("rejects a directory without page images: $label", async ({ names }) => {
    mocks.readdir.mockResolvedValue(names);

    await expect(
      convertPdfToJpg("input.pdf", "output", options),
    ).rejects.toThrow("PDF conversion produced no JPG files.");
  });

  it("does not read the directory when Poppler fails", async () => {
    const error = new Error("Poppler failed.");
    mocks.pdfToImages.mockRejectedValue(error);

    await expect(convertPdfToJpg("input.pdf", "output", options)).rejects.toBe(
      error,
    );

    expect(mocks.readdir).not.toHaveBeenCalled();
  });

  it("propagates a directory read failure", async () => {
    const error = new Error("Could not read output directory.");
    mocks.readdir.mockRejectedValue(error);

    await expect(convertPdfToJpg("input.pdf", "output", options)).rejects.toBe(
      error,
    );
  });
});
