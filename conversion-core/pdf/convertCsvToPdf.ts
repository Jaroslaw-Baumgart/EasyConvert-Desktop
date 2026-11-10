import { readFile } from "node:fs/promises";
import type { PdfPageOptions } from "../../shared/conversionOptions";
import { CsvLimitError, parseCsv, type CsvRow } from "./csv";
import { renderCsvTable } from "./csvPdfTable";
import { limitPdfPages } from "./pdfLimits";
import { writePdf } from "./writePdf";

export class CsvInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CsvInputError";
  }
}

export async function convertCsvToPdf(
  inputPath: string,
  outputPath: string,
  options: PdfPageOptions,
  regularFontPath: string,
  boldFontPath: string,
): Promise<void> {
  const csvText = await readFile(inputPath, "utf-8");
  let rows: CsvRow[];
  try {
    rows = parseCsv(csvText);
  } catch (error) {
    throw new CsvInputError(
      error instanceof CsvLimitError ? error.message : "Invalid CSV data.",
    );
  }

  if (rows.length === 0) {
    throw new CsvInputError("CSV file is empty.");
  }

  const headers = Object.keys(rows[0] ?? {});

  await writePdf(
    outputPath,
    {
      size: options.pageSize,
      layout: options.pageOrientation,
    },
    async (doc) => {
      limitPdfPages(doc);

      await renderCsvTable({
        doc,
        headers,
        rows,
        regularFontPath,
        boldFontPath,
      });
    },
  );
}
