import PDFDocument from "pdfkit";
import { createWriteStream, type WriteStream } from "node:fs";
import { readFile } from "node:fs/promises";
import type { PdfPageOptions } from "../../shared/conversionOptions";
import { CsvLimitError, parseCsv, type CsvRow } from "./csv";
import { renderCsvTable } from "./csvPdfTable";
import { limitPdfPages } from "./pdfLimits";

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

  let outputStream: WriteStream | undefined;
  let document: PDFKit.PDFDocument | undefined;
  let documentEnded = false;

  try {
    const headers = Object.keys(rows[0] ?? {});
    const doc = new PDFDocument({
      size: options.pageSize,
      layout: options.pageOrientation,
    });
    document = doc;
    limitPdfPages(doc);

    const stream = doc.pipe(createWriteStream(outputPath));
    outputStream = stream;

    const streamFinished = new Promise<void>((resolve, reject) => {
      stream.on("finish", resolve);
      stream.on("error", reject);
    });
    void streamFinished.catch(() => {});

    await renderCsvTable({
      doc,
      headers,
      rows,
      regularFontPath,
      boldFontPath,
    });

    doc.end();
    documentEnded = true;
    await streamFinished;
  } catch (error) {
    document?.unpipe?.(outputStream);
    if (!documentEnded) document?.end();
    if (outputStream && !outputStream.closed) {
      const closed = new Promise<void>((resolve) =>
        outputStream!.once("close", resolve),
      );
      outputStream.destroy();
      await closed;
    }

    throw error;
  }
}
