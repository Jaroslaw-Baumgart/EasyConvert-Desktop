import { Request, Response } from "express";
import fsSync from "fs";
import fs from "fs/promises";
import PDFDocument from "pdfkit";
import path from "path";

import { OUTPUT_DIR } from "../utils/constants";
import {
  createOutputFileItem,
  sendErrorResponse,
  sendSuccessResponse,
} from "../utils/response";
import { CsvLimitError, parseCsv, type CsvRow } from "../utils/csv";
import { pdfPageSettingsSchema } from "../schemas/conversionSettings";
import { limitPdfPages } from "../utils/pdfLimits";
import { CsvPdfTableError, renderCsvTable } from "../utils/csvPdfTable";

const getBaseFileName = (file: Express.Multer.File) => {
  return path.parse(file.filename).name;
};

export const csvToPdf = async (req: Request, res: Response) => {
  if (!req.file) {
    return sendErrorResponse(res, 400, "No CSV file uploaded.");
  }

  const file = req.file;
  const baseName = getBaseFileName(file);
  const outputName = `${baseName}.pdf`;
  const outputPath = path.join(OUTPUT_DIR, outputName);
  let outputStream: fsSync.WriteStream | undefined;
  let document: PDFKit.PDFDocument | undefined;
  let documentEnded = false;

  try {
    const settingsResult = pdfPageSettingsSchema.safeParse(req.body);

    if (!settingsResult.success) {
      return sendErrorResponse(res, 400, "Invalid conversion settings.");
    }
    const settings = settingsResult.data;

    await fs.mkdir(OUTPUT_DIR, { recursive: true });

    const csvText = await fs.readFile(file.path, "utf-8");
    let rows: CsvRow[];
    try {
      rows = parseCsv(csvText);
    } catch (error) {
      return sendErrorResponse(
        res,
        400,
        error instanceof CsvLimitError ? error.message : "Invalid CSV data.",
      );
    }

    if (rows.length === 0) {
      return sendErrorResponse(res, 400, "CSV file is empty.");
    }

    const headers = Object.keys(rows[0] ?? {});
    const doc = new PDFDocument({
      size: settings.pageSize,
      layout: settings.pageOrientation,
    });
    document = doc;
    limitPdfPages(doc);

    const stream = doc.pipe(fsSync.createWriteStream(outputPath));
    outputStream = stream;

    const streamFinished = new Promise<void>((resolve, reject) => {
      stream.on("finish", resolve);
      stream.on("error", reject);
    });
    // Keep early write failures handled while the table is being rendered.
    void streamFinished.catch(() => {});

    const regularFontPath = path.join(
      __dirname,
      "../assets/fonts/NotoSans-Regular.ttf",
    );

    const boldFontPath = path.join(
      __dirname,
      "../assets/fonts/NotoSans-Bold.ttf",
    );

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
    return sendSuccessResponse(res, [createOutputFileItem(outputName)]);
  } catch (err: unknown) {
    document?.unpipe?.(outputStream);
    if (!documentEnded) document?.end();
    if (outputStream && !outputStream.closed) {
      const closed = new Promise<void>((resolve) =>
        outputStream!.once("close", resolve),
      );
      outputStream.destroy();
      await closed;
    }
    const errorMessage =
      err instanceof Error ? err.message : "Failed to convert CSV to PDF.";

    return sendErrorResponse(
      res,
      err instanceof CsvPdfTableError ? 400 : 500,
      errorMessage,
      err instanceof CsvPdfTableError ? "invalid-settings" : "conversion-failed",
    );
  }
};
