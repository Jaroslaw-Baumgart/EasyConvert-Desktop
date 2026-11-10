import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  readFile: vi.fn(), writePdf: vi.fn(), renderCsvTable: vi.fn(), limitPdfPages: vi.fn(),
}));
vi.mock("node:fs/promises", () => ({ readFile: mocks.readFile }));
vi.mock("../../pdf/writePdf", () => ({ writePdf: mocks.writePdf }));
vi.mock("../../pdf/csvPdfTable", () => ({ renderCsvTable: mocks.renderCsvTable }));
vi.mock("../../pdf/pdfLimits", () => ({ limitPdfPages: mocks.limitPdfPages }));
import { convertCsvToPdf, CsvInputError } from "../../pdf/convertCsvToPdf";

const options = { pageSize: "A3", pageOrientation: "landscape" } as const;
const convert = () => convertCsvToPdf("input.csv", "output.pdf", options, "regular.ttf", "bold.ttf");

beforeEach(() => {
  vi.resetAllMocks();
  mocks.readFile.mockResolvedValue("ID,Name\n1,Łukasz");
  mocks.renderCsvTable.mockResolvedValue(undefined);
});

describe("convertCsvToPdf", () => {
  it("parses rows and configures the renderer with page settings and fonts", async () => {
    const doc = {};
    mocks.writePdf.mockImplementation(async (_path, _options, render) => render(doc));
    await convert();
    expect(mocks.readFile).toHaveBeenCalledExactlyOnceWith("input.csv", "utf-8");
    expect(mocks.writePdf).toHaveBeenCalledExactlyOnceWith(
      "output.pdf", { size: "A3", layout: "landscape" }, expect.any(Function),
    );
    expect(mocks.limitPdfPages).toHaveBeenCalledExactlyOnceWith(doc);
    expect(mocks.renderCsvTable).toHaveBeenCalledExactlyOnceWith({
      doc, headers: ["ID", "Name"], rows: [{ ID: "1", Name: "Łukasz" }],
      regularFontPath: "regular.ttf", boldFontPath: "bold.ttf",
    });
  });

  it.each([
    { text: "", message: "CSV file is empty." },
    { text: "ID,Name\n1", message: "Invalid CSV data." },
    { text: `ID\n${"1\n".repeat(10001)}`, message: "CSV exceeds processing limits" },
    { text: `ID\n${"a".repeat(50001)}`, message: "CSV cell exceeds" },
  ])("rejects invalid input before writing: $message", async ({ text, message }) => {
    mocks.readFile.mockResolvedValue(text);
    const conversion = convert();
    await expect(conversion).rejects.toBeInstanceOf(CsvInputError);
    await expect(conversion).rejects.toThrow(message);
    expect(mocks.writePdf).not.toHaveBeenCalled();
  });

  it("does not start writing when reading the source fails", async () => {
    const error = new Error("Input unavailable.");
    mocks.readFile.mockRejectedValue(error);
    await expect(convert()).rejects.toBe(error);
    expect(mocks.writePdf).not.toHaveBeenCalled();
  });

  it("waits for asynchronous table rendering", async () => {
    let finish!: () => void;
    const rendering = new Promise<void>((resolve) => { finish = resolve; });
    const started = new Promise<void>((resolve) => {
      mocks.renderCsvTable.mockImplementation(() => { resolve(); return rendering; });
    });
    mocks.writePdf.mockImplementation(async (_path, _options, render) => render({}));
    const completed = vi.fn();
    const conversion = convert().then(completed);
    await started;
    expect(completed).not.toHaveBeenCalled();
    finish();
    await conversion;
    expect(completed).toHaveBeenCalledOnce();
  });
});
