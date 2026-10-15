import { afterEach, describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";
import { parseXlsxFile } from "./xlsx";
import {
  parseXlsxBuffer,
  validateXlsxArchive,
  XLSX_PREVIEW_ARCHIVE_ENTRY_LIMIT,
} from "./xlsxParser";
import { strToU8, zipSync } from "fflate";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseXlsxFile", () => {
  it("rejects an invalid XLSX archive before parsing it", () => {
    expect(() => parseXlsxBuffer(new ArrayBuffer(0))).toThrow(
      "Invalid XLSX archive.",
    );
  });

  it("rejects an archive with too many entries before parsing it", () => {
    const files = Object.fromEntries(
      Array.from({ length: XLSX_PREVIEW_ARCHIVE_ENTRY_LIMIT + 1 }, (_, index) => [
        `entry-${index}.xml`,
        new Uint8Array(),
      ]),
    );

    expect(() => validateXlsxArchive(zipSync(files).buffer)).toThrow(
      "XLSX archive has too many files to preview.",
    );
  });

  it("limits actual extracted XLSX data even if ZIP metadata is smaller", () => {
    const archive = zipSync({ "xl/workbook.xml": strToU8("12345678") });
    const bytes = archive.slice();
    const view = new DataView(bytes.buffer);
    const centralDirectoryEntry = 0x0201_4b50;
    let offset = 0;

    while (view.getUint32(offset, true) !== centralDirectoryEntry) {
      offset += 1;
    }
    view.setUint32(offset + 24, 0, true);

    expect(() => validateXlsxArchive(bytes.buffer, 7)).toThrow(
      "XLSX file is too large to preview.",
    );
  });

  it("rejects workbooks with too many sheets", () => {
    const workbook = XLSX.utils.book_new();
    for (let index = 0; index < 21; index += 1) {
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.aoa_to_sheet([[index]]),
        `Sheet ${index}`,
      );
    }

    expect(() =>
      parseXlsxBuffer(XLSX.write(workbook, { type: "array", bookType: "xlsx" })),
    ).toThrow("XLSX file has too many sheets to preview.");
  });

  it("rejects sheets with too many columns", () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([Array.from({ length: 51 }, (_, index) => index)]),
      "Data",
    );

    expect(() =>
      parseXlsxBuffer(XLSX.write(workbook, { type: "array", bookType: "xlsx" })),
    ).toThrow("XLSX sheet has too many columns to preview.");
  });

  it("reads sheets in order and preserves cell positions", async () => {
    const workbook = XLSX.utils.book_new();

    const sales = XLSX.utils.aoa_to_sheet([
      ["Produkt", "Uwagi", "Ilość"],
      ["Żółta herbata", null, 2],
    ]);

    const summary = XLSX.utils.aoa_to_sheet([["Status"], ["Gotowe"]]);

    XLSX.utils.book_append_sheet(workbook, sales, "Sprzedaż");
    XLSX.utils.book_append_sheet(workbook, summary, "Podsumowanie");

    const bytes = XLSX.write(workbook, {
      type: "array",
      bookType: "xlsx",
    });

    const file = new File([bytes], "report.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    await expect(parseXlsxFile(file)).resolves.toEqual([
      {
        name: "Sprzedaż",
        rows: [
          ["Produkt", "Uwagi", "Ilość"],
          ["Żółta herbata", "", "2"],
        ],
        totalRows: 2,
      },
      {
        name: "Podsumowanie",
        rows: [["Status"], ["Gotowe"]],
        totalRows: 2,
      },
    ]);
  });

  it("extracts only the rows needed for the preview", async () => {
    const workbook = XLSX.utils.book_new();
    const rows = Array.from({ length: 101 }, (_, index) => [`Row ${index}`]);

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet(rows),
      "Data",
    );

    const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
    const file = new File([bytes], "large.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    await expect(parseXlsxFile(file)).resolves.toEqual([
      {
        name: "Data",
        rows: rows.slice(0, 100),
        totalRows: 101,
      },
    ]);
  });

  it("terminates the worker when preview parsing is cancelled", async () => {
    const workers: MockWorker[] = [];

    class MockWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      terminate = vi.fn();

      constructor() {
        workers.push(this);
      }

      postMessage() {}
    }

    vi.stubGlobal("Worker", MockWorker);
    const controller = new AbortController();
    const file = new File(["xlsx"], "report.xlsx");
    const parsing = parseXlsxFile(file, controller.signal);

    await vi.waitFor(() => {
      expect(workers).toHaveLength(1);
    });
    controller.abort();

    await expect(parsing).rejects.toMatchObject({ name: "AbortError" });
    expect(workers[0].terminate).toHaveBeenCalledOnce();
  });
});
