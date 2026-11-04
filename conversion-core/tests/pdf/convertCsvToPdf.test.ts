import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  readFile: vi.fn(), createWriteStream: vi.fn(), PDFDocument: vi.fn(),
  renderCsvTable: vi.fn(), limitPdfPages: vi.fn(),
}));
vi.mock("node:fs/promises", () => ({ readFile: mocks.readFile }));
vi.mock("node:fs", () => ({ createWriteStream: mocks.createWriteStream }));
vi.mock("pdfkit", () => ({ default: mocks.PDFDocument }));
vi.mock("../../pdf/csvPdfTable", () => ({ renderCsvTable: mocks.renderCsvTable }));
vi.mock("../../pdf/pdfLimits", () => ({ limitPdfPages: mocks.limitPdfPages }));

import { convertCsvToPdf, CsvInputError } from "../../pdf/convertCsvToPdf";

function setup() {
  const stream = Object.assign(new EventEmitter(), {
    closed: false,
    destroy: vi.fn(),
  });
  stream.destroy.mockImplementation(() => {
    stream.closed = true;
    stream.emit("close");
  });
  const doc = {
    pipe: vi.fn().mockReturnValue(stream), unpipe: vi.fn(),
    end: vi.fn(() => { stream.emit("finish"); }),
  };
  mocks.createWriteStream.mockReturnValue(stream);
  mocks.PDFDocument.mockImplementation(function () { return doc; });
  return { doc, stream };
}

const options = { pageSize: "A3", pageOrientation: "landscape" } as const;
function convert() {
  return convertCsvToPdf("input.csv", "output.pdf", options, "regular.ttf", "bold.ttf");
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.readFile.mockResolvedValue("ID,Name\n1,Łukasz");
  mocks.renderCsvTable.mockResolvedValue(undefined);
});

describe("convertCsvToPdf", () => {
  it("parses the input and passes rows, page settings and fonts to the renderer", async () => {
    const { doc } = setup();
    await convert();
    expect(mocks.readFile).toHaveBeenCalledExactlyOnceWith("input.csv", "utf-8");
    expect(mocks.PDFDocument).toHaveBeenCalledExactlyOnceWith({ size: "A3", layout: "landscape" });
    expect(mocks.limitPdfPages).toHaveBeenCalledExactlyOnceWith(doc);
    expect(mocks.renderCsvTable).toHaveBeenCalledExactlyOnceWith({
      doc, headers: ["ID", "Name"], rows: [{ ID: "1", Name: "Łukasz" }],
      regularFontPath: "regular.ttf", boldFontPath: "bold.ttf",
    });
    expect(mocks.createWriteStream).toHaveBeenCalledExactlyOnceWith("output.pdf");
    expect(doc.end).toHaveBeenCalledTimes(1);
  });

  it.each([
    { text: "", message: "CSV file is empty." },
    { text: "ID,Name\n1", message: "Invalid CSV data." },
    { text: `ID\n${"1\n".repeat(10001)}`, message: "CSV exceeds processing limits" },
    { text: `ID\n${"a".repeat(50001)}`, message: "CSV cell exceeds" },
  ])("rejects invalid input before creating output: $message", async ({ text, message }) => {
    setup();
    mocks.readFile.mockResolvedValue(text);
    const conversion = convert();
    await expect(conversion).rejects.toBeInstanceOf(CsvInputError);
    await expect(conversion).rejects.toThrow(message);
    expect(mocks.PDFDocument).not.toHaveBeenCalled();
    expect(mocks.createWriteStream).not.toHaveBeenCalled();
  });

  it("does not create output when reading the source fails", async () => {
    setup();
    const error = new Error("Input unavailable.");
    mocks.readFile.mockRejectedValue(error);
    await expect(convert()).rejects.toBe(error);
    expect(mocks.PDFDocument).not.toHaveBeenCalled();
  });

  it("waits for output completion", async () => {
    const { doc, stream } = setup();
    doc.end.mockImplementation(() => {});
    const ended = new Promise<void>((resolve) => doc.end.mockImplementation(() => resolve()));
    const completed = vi.fn();
    const conversion = convert().then(completed);
    await ended;
    expect(completed).not.toHaveBeenCalled();
    stream.emit("finish");
    await conversion;
    expect(completed).toHaveBeenCalledTimes(1);
  });

  it("closes the document and stream after a rendering error", async () => {
    const { doc, stream } = setup();
    const error = new Error("Table layout failed.");
    mocks.renderCsvTable.mockRejectedValue(error);
    await expect(convert()).rejects.toBe(error);
    expect(doc.unpipe).toHaveBeenCalledExactlyOnceWith(stream);
    expect(doc.end).toHaveBeenCalledTimes(1);
    expect(stream.destroy).toHaveBeenCalledTimes(1);
    expect(stream.closed).toBe(true);
  });

  it("propagates a write error and closes the stream", async () => {
    const { doc, stream } = setup();
    const error = new Error("Disk full.");
    doc.end.mockImplementation(() => { stream.emit("error", error); });
    await expect(convert()).rejects.toBe(error);
    expect(doc.end).toHaveBeenCalledTimes(1);
    expect(stream.destroy).toHaveBeenCalledTimes(1);
  });
});
