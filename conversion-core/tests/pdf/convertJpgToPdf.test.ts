import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  validateImagePixels: vi.fn(),
  createWriteStream: vi.fn(),
  PDFDocument: vi.fn(),
}));

vi.mock("../../image/imageLimits", () => ({
  validateImagePixels: mocks.validateImagePixels,
}));

vi.mock("node:fs", () => ({
  createWriteStream: mocks.createWriteStream,
}));

vi.mock("pdfkit", () => ({
  default: mocks.PDFDocument,
}));

import { convertJpgToPdf } from "../../image/convertJpgToPdf";

function setupDocument() {
  const stream = new EventEmitter();
  const destination = {};
  const doc = {
    page: { width: 1190.55, height: 841.89 },
    addPage: vi.fn(),
    image: vi.fn(),
    pipe: vi.fn().mockReturnValue(stream),
    end: vi.fn(() => {
      stream.emit("finish");
    }),
  };

  mocks.createWriteStream.mockReturnValue(destination);
  mocks.PDFDocument.mockImplementation(function () {
    return doc;
  });

  return { doc, stream, destination };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.validateImagePixels.mockResolvedValue(undefined);
});

describe("convertJpgToPdf", () => {
  it.each([
    { pageSize: "A4", pageOrientation: "portrait" },
    { pageSize: "A4", pageOrientation: "landscape" },
    { pageSize: "A3", pageOrientation: "portrait" },
    { pageSize: "A3", pageOrientation: "landscape" },
  ] as const)("uses $pageSize and $pageOrientation", async (options) => {
    const { doc, destination } = setupDocument();

    await convertJpgToPdf("input.jpg", "output.pdf", options);

    expect(mocks.validateImagePixels).toHaveBeenCalledExactlyOnceWith(
      "input.jpg",
    );
    expect(mocks.PDFDocument).toHaveBeenCalledExactlyOnceWith({
      autoFirstPage: false,
    });
    expect(doc.addPage).toHaveBeenCalledExactlyOnceWith({
      size: options.pageSize,
      layout: options.pageOrientation,
    });
    expect(mocks.createWriteStream).toHaveBeenCalledExactlyOnceWith(
      "output.pdf",
    );
    expect(doc.pipe).toHaveBeenCalledExactlyOnceWith(destination);
    expect(doc.end).toHaveBeenCalledTimes(1);
  });

  it("fits and centers the image within 36-point page margins", async () => {
    const { doc } = setupDocument();

    await convertJpgToPdf("input.jpg", "output.pdf", {
      pageSize: "A3",
      pageOrientation: "landscape",
    });

    expect(doc.image).toHaveBeenCalledExactlyOnceWith("input.jpg", 36, 36, {
      fit: [1118.55, 769.89],
      align: "center",
      valign: "center",
    });
  });

  it("does not create a PDF when image validation fails", async () => {
    setupDocument();
    const error = new Error("Image pixel limit exceeded.");
    mocks.validateImagePixels.mockRejectedValue(error);

    await expect(
      convertJpgToPdf("input.jpg", "output.pdf", {
        pageSize: "A4",
        pageOrientation: "portrait",
      }),
    ).rejects.toBe(error);

    expect(mocks.PDFDocument).not.toHaveBeenCalled();
    expect(mocks.createWriteStream).not.toHaveBeenCalled();
  });

  it("waits until the output stream finishes", async () => {
    const { doc, stream } = setupDocument();
    doc.end.mockImplementation(() => {});
    const completed = vi.fn();

    const conversion = convertJpgToPdf("input.jpg", "output.pdf", {
      pageSize: "A4",
      pageOrientation: "portrait",
    }).then(completed);

    await Promise.resolve();

    expect(doc.end).toHaveBeenCalledTimes(1);
    expect(completed).not.toHaveBeenCalled();

    stream.emit("finish");
    await conversion;

    expect(completed).toHaveBeenCalledTimes(1);
  });

  it("rejects when the output stream reports an error", async () => {
    const { doc, stream } = setupDocument();
    const error = new Error("Disk full.");

    doc.end.mockImplementation(() => {
      stream.emit("error", error);
    });

    await expect(
      convertJpgToPdf("input.jpg", "output.pdf", {
        pageSize: "A4",
        pageOrientation: "portrait",
      }),
    ).rejects.toBe(error);
  });
});
