import fs from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ prepare: vi.fn(), convert: vi.fn() }));
vi.mock("../../office/xlsxPageSetup", () => ({ applyXlsxPageSetup: mocks.prepare }));
vi.mock("../../office/convertLibreOfficeToPdf", () => ({ convertLibreOfficeToPdf: mocks.convert }));
import { convertXlsxToPdf } from "../../office/convertXlsxToPdf";

const page = { pageSize: "A3", pageOrientation: "landscape" } as const;
const tool = { executablePath: "soffice.com", timeoutMs: 1234 };
const original = new Uint8Array([1, 2, 3]);
const prepared = new Uint8Array([4, 5, 6]);

beforeEach(() => {
  vi.resetAllMocks();
  mocks.prepare.mockResolvedValue(prepared);
  mocks.convert.mockResolvedValue(undefined);
});

describe("convertXlsxToPdf", () => {
  it.each([
    { label: "selected sheet", options: { ...page, sheetName: "Koszty" } },
    { label: "all sheets", options: page },
  ])("prepares $label, preserves the source and removes its temporary input", async ({ options }) => {
    const directory = await fs.mkdtemp(path.join(tmpdir(), "easyconvert-xlsx-test-"));
    const input = path.join(directory, "source.xlsx");
    const output = path.join(directory, "result.pdf");
    const signal = new AbortController().signal;
    let temporaryInput = "";
    mocks.convert.mockImplementation(async (preparedPath: string) => {
      temporaryInput = preparedPath;
      expect(await fs.readFile(preparedPath)).toEqual(Buffer.from(prepared));
      expect(preparedPath).not.toBe(input);
    });
    try {
      await fs.writeFile(input, original);
      await convertXlsxToPdf(input, output, options, tool, signal);
      expect(mocks.prepare).toHaveBeenCalledExactlyOnceWith(
        Buffer.from(original), "sheetName" in options ? options.sheetName : undefined, page,
      );
      expect(mocks.convert).toHaveBeenCalledExactlyOnceWith(temporaryInput, output, tool, signal);
      expect(await fs.readFile(input)).toEqual(Buffer.from(original));
      await expect(fs.stat(path.dirname(temporaryInput))).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      await fs.rm(directory, { recursive: true, force: true });
    }
  });

  it("removes its temporary input when LibreOffice fails and preserves the error", async () => {
    const directory = await fs.mkdtemp(path.join(tmpdir(), "easyconvert-xlsx-test-"));
    const input = path.join(directory, "source.xlsx");
    const error = new Error("LibreOffice failed");
    let temporaryInput = "";
    mocks.convert.mockImplementation(async (preparedPath: string) => {
      temporaryInput = preparedPath;
      throw error;
    });
    try {
      await fs.writeFile(input, original);
      await expect(convertXlsxToPdf(input, path.join(directory, "result.pdf"), page, tool)).rejects.toBe(error);
      await expect(fs.stat(path.dirname(temporaryInput))).rejects.toMatchObject({ code: "ENOENT" });
      expect(await fs.readFile(input)).toEqual(Buffer.from(original));
    } finally {
      await fs.rm(directory, { recursive: true, force: true });
    }
  });

  it("does not start preparation or LibreOffice when already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(convertXlsxToPdf("missing.xlsx", "result.pdf", page, tool, controller.signal))
      .rejects.toBe(controller.signal.reason);
    expect(mocks.prepare).not.toHaveBeenCalled();
    expect(mocks.convert).not.toHaveBeenCalled();
  });

  it("does not start LibreOffice when sheet preparation fails", async () => {
    const directory = await fs.mkdtemp(path.join(tmpdir(), "easyconvert-xlsx-test-"));
    const input = path.join(directory, "source.xlsx");
    const error = new Error("Sheet not found: Missing");
    mocks.prepare.mockRejectedValue(error);
    try {
      await fs.writeFile(input, original);
      await expect(convertXlsxToPdf(input, path.join(directory, "result.pdf"), { ...page, sheetName: "Missing" }, tool)).rejects.toBe(error);
      expect(mocks.convert).not.toHaveBeenCalled();
    } finally {
      await fs.rm(directory, { recursive: true, force: true });
    }
  });
});
