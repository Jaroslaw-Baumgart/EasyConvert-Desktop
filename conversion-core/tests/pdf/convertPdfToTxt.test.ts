import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  validatePdfPageCount: vi.fn(),
  runPoppler: vi.fn(),
}));

vi.mock("../../pdf/poppler", () => ({
  validatePdfPageCount: mocks.validatePdfPageCount,
  runPoppler: mocks.runPoppler,
}));

import { convertPdfToTxt } from "../../pdf/convertPdfToTxt";

const options = {
  binDirectory: "tools/poppler/bin",
  timeoutMs: 120_000,
  maxPages: 100,
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.validatePdfPageCount.mockResolvedValue(2);
  mocks.runPoppler.mockResolvedValue("");
});

describe("convertPdfToTxt", () => {
  it("validates the page count before extracting text", async () => {
    const controller = new AbortController();

    mocks.runPoppler.mockImplementation(async () => {
      expect(mocks.validatePdfPageCount).toHaveBeenCalledExactlyOnceWith(
        "input.pdf",
        options,
        controller.signal,
      );
      return "";
    });

    await convertPdfToTxt(
      "input.pdf",
      "output.txt",
      options,
      controller.signal,
    );

    expect(mocks.runPoppler).toHaveBeenCalledExactlyOnceWith(
      "pdftotext",
      ["input.pdf", "output.txt"],
      options,
      controller.signal,
    );
  });

  it("does not extract text when page validation fails", async () => {
    const error = new Error("PDF page limit exceeded.");
    mocks.validatePdfPageCount.mockRejectedValue(error);

    await expect(
      convertPdfToTxt("input.pdf", "output.txt", options),
    ).rejects.toBe(error);

    expect(mocks.runPoppler).not.toHaveBeenCalled();
  });

  it("propagates an extraction failure", async () => {
    const error = new Error("Text extraction failed.");
    mocks.runPoppler.mockRejectedValue(error);

    await expect(
      convertPdfToTxt("input.pdf", "output.txt", options),
    ).rejects.toBe(error);
  });
});
