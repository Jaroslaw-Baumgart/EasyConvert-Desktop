import { Request, Response } from "express";
import fs from "fs/promises";
import path from "path";
import { OUTPUT_DIR } from "../utils/constants";
import {
  createOutputFileItem,
  sendErrorResponse,
  sendSuccessResponse,
} from "../utils/response";
import { pdfPageSettingsSchema } from "../schemas/conversionSettings";
import {
  convertCsvToPdf,
  CsvInputError,
} from "../../../conversion-core/pdf/convertCsvToPdf";
import { CsvPdfTableError } from "../utils/csvPdfTable";

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

  try {
    const settingsResult = pdfPageSettingsSchema.safeParse(req.body);

    if (!settingsResult.success) {
      return sendErrorResponse(res, 400, "Invalid conversion settings.");
    }
    const settings = settingsResult.data;

    await fs.mkdir(OUTPUT_DIR, { recursive: true });

    await convertCsvToPdf(
      file.path,
      outputPath,
      settings,
      path.join(__dirname, "../../../assets/fonts/NotoSans-Regular.ttf"),
      path.join(__dirname, "../../../assets/fonts/NotoSans-Bold.ttf"),
    );

    return sendSuccessResponse(res, [createOutputFileItem(outputName)]);
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : "Failed to convert CSV to PDF.";

    return sendErrorResponse(
      res,
      err instanceof CsvInputError || err instanceof CsvPdfTableError
        ? 400
        : 500,
      errorMessage,
      err instanceof CsvPdfTableError
        ? "invalid-settings"
        : "conversion-failed",
    );
  }
};
