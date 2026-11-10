import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ readFile: vi.fn(), writePdf: vi.fn(), limitPdfPages: vi.fn() }));
vi.mock("node:fs/promises", () => ({ readFile: mocks.readFile }));
vi.mock("../../pdf/writePdf", () => ({ writePdf: mocks.writePdf }));
vi.mock("../../pdf/pdfLimits", () => ({ limitPdfPages: mocks.limitPdfPages }));
import { convertTxtToPdf } from "../../pdf/convertTxtToPdf";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.readFile.mockResolvedValue("Zażółć gęślą jaźń.\n\nDrugi akapit.");
});

describe("convertTxtToPdf", () => {
  it.each([
    { pageSize: "A4", pageOrientation: "portrait" },
    { pageSize: "A4", pageOrientation: "landscape" },
    { pageSize: "A3", pageOrientation: "portrait" },
    { pageSize: "A3", pageOrientation: "landscape" },
  ] as const)("renders $pageSize $pageOrientation with the supplied font", async (options) => {
    const doc = { font: vi.fn(), fontSize: vi.fn(), text: vi.fn() };
    doc.fontSize.mockReturnValue(doc);
    mocks.writePdf.mockImplementation(async (_path, _options, render) => render(doc));
    await convertTxtToPdf("input.txt", "output.pdf", options, "fonts/NotoSans.ttf");
    expect(mocks.readFile).toHaveBeenCalledExactlyOnceWith("input.txt", "utf8");
    expect(mocks.writePdf).toHaveBeenCalledExactlyOnceWith(
      "output.pdf", { size: options.pageSize, layout: options.pageOrientation }, expect.any(Function),
    );
    expect(mocks.limitPdfPages).toHaveBeenCalledExactlyOnceWith(doc);
    expect(doc.font).toHaveBeenCalledExactlyOnceWith("fonts/NotoSans.ttf");
    expect(doc.fontSize).toHaveBeenCalledExactlyOnceWith(12);
    expect(doc.text).toHaveBeenCalledExactlyOnceWith(
      "Zażółć gęślą jaźń.\n\nDrugi akapit.", { align: "left" },
    );
  });

  it("does not start writing when reading the input fails", async () => {
    const error = new Error("Input unavailable.");
    mocks.readFile.mockRejectedValue(error);
    await expect(convertTxtToPdf("input.txt", "output.pdf", {
      pageSize: "A4", pageOrientation: "portrait",
    }, "font.ttf")).rejects.toBe(error);
    expect(mocks.writePdf).not.toHaveBeenCalled();
  });
});
