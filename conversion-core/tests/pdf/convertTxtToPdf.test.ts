import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  readFile: vi.fn(),
  createWriteStream: vi.fn(),
  PDFDocument: vi.fn(),
  limitPdfPages: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({ readFile: mocks.readFile }));
vi.mock("node:fs", () => ({ createWriteStream: mocks.createWriteStream }));
vi.mock("pdfkit", () => ({ default: mocks.PDFDocument }));
vi.mock("../../pdf/pdfLimits", () => ({ limitPdfPages: mocks.limitPdfPages }));

import { convertTxtToPdf } from "../../pdf/convertTxtToPdf";

function setupDocument() {
  const stream = new EventEmitter();
  const destination = {};
  const doc = {
    font: vi.fn(),
    fontSize: vi.fn(),
    text: vi.fn(),
    pipe: vi.fn().mockReturnValue(stream),
    end: vi.fn(() => { stream.emit("finish"); }),
  };
  doc.fontSize.mockReturnValue(doc);
  mocks.createWriteStream.mockReturnValue(destination);
  mocks.PDFDocument.mockImplementation(function () { return doc; });
  return { doc, stream, destination };
}

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
  ] as const)("uses $pageSize and $pageOrientation with the supplied font", async (options) => {
    const { doc, destination } = setupDocument();
    await convertTxtToPdf("input.txt", "output.pdf", options, "fonts/NotoSans.ttf");
    expect(mocks.readFile).toHaveBeenCalledExactlyOnceWith("input.txt", "utf8");
    expect(mocks.PDFDocument).toHaveBeenCalledExactlyOnceWith({
      size: options.pageSize, layout: options.pageOrientation,
    });
    expect(mocks.limitPdfPages).toHaveBeenCalledExactlyOnceWith(doc);
    expect(doc.font).toHaveBeenCalledExactlyOnceWith("fonts/NotoSans.ttf");
    expect(doc.fontSize).toHaveBeenCalledExactlyOnceWith(12);
    expect(doc.text).toHaveBeenCalledExactlyOnceWith(
      "Zażółć gęślą jaźń.\n\nDrugi akapit.", { align: "left" },
    );
    expect(mocks.createWriteStream).toHaveBeenCalledExactlyOnceWith("output.pdf");
    expect(doc.pipe).toHaveBeenCalledExactlyOnceWith(destination);
    expect(doc.end).toHaveBeenCalledTimes(1);
  });

  it("does not create a document when reading the input fails", async () => {
    setupDocument();
    const error = new Error("Input unavailable.");
    mocks.readFile.mockRejectedValue(error);
    await expect(convertTxtToPdf("input.txt", "output.pdf", {
      pageSize: "A4", pageOrientation: "portrait",
    }, "font.ttf")).rejects.toBe(error);
    expect(mocks.PDFDocument).not.toHaveBeenCalled();
    expect(mocks.createWriteStream).not.toHaveBeenCalled();
  });

  it("waits for the output stream to finish", async () => {
    const { doc, stream } = setupDocument();
    doc.end.mockImplementation(() => {});
    const completed = vi.fn();
    const conversion = convertTxtToPdf("input.txt", "output.pdf", {
      pageSize: "A4", pageOrientation: "portrait",
    }, "font.ttf").then(completed);
    await Promise.resolve();
    expect(doc.end).toHaveBeenCalledTimes(1);
    expect(completed).not.toHaveBeenCalled();
    stream.emit("finish");
    await conversion;
    expect(completed).toHaveBeenCalledTimes(1);
  });

  it("propagates an output stream error", async () => {
    const { doc, stream } = setupDocument();
    const error = new Error("Disk full.");
    doc.end.mockImplementation(() => { stream.emit("error", error); });
    await expect(convertTxtToPdf("input.txt", "output.pdf", {
      pageSize: "A4", pageOrientation: "portrait",
    }, "font.ttf")).rejects.toBe(error);
  });
});
