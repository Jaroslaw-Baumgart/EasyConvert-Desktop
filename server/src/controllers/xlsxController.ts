import { Request, Response } from "express";
import path from "path";
import fs from "fs/promises";
import { OUTPUT_DIR } from "../utils/constants";
import { safeUnlink } from "../utils/file";
import {
  createOutputFileItem,
  sendErrorResponse,
  sendSuccessResponse,
} from "../utils/response";
import { getConversionFailureCode } from "../utils/conversionError";
import { xlsxPdfSettingsSchema } from "../schemas/conversionSettings";
import { convertLibreOfficeToPdf } from "../utils/libreOffice";
import { applyXlsxPageSetup } from "../utils/xlsxPageSetup";

const getBaseFileName = (file: Express.Multer.File) => {
  return path.parse(file.filename).name;
};

export const xlsxToPdf = async (req: Request, res: Response) => {
  if (
    !req.file ||
    path.extname(req.file.originalname).toLowerCase() !== ".xlsx"
  ) {
    return sendErrorResponse(res, 400, "No XLSX file uploaded.");
  }

  const file = req.file;
  const baseName = getBaseFileName(file);
  const outputName = `${baseName}.pdf`;
  const outputPath = path.join(OUTPUT_DIR, outputName);
  const preparedPath = path.join(OUTPUT_DIR, `${baseName}.xlsx`);

  try {
    const settingsResult = xlsxPdfSettingsSchema.safeParse(req.body);

    if (!settingsResult.success) {
      return sendErrorResponse(res, 400, "Invalid conversion settings.");
    }

    const { sheetName, ...pageSettings } = settingsResult.data;

    await fs.mkdir(OUTPUT_DIR, { recursive: true });

    const inputBytes = await fs.readFile(file.path);

    const preparedBytes = await applyXlsxPageSetup(
      inputBytes,
      sheetName,
      pageSettings,
    );

    await fs.writeFile(preparedPath, preparedBytes);

    const signal = res.locals?.conversionAbortSignal as AbortSignal | undefined;
    if (signal) {
      await convertLibreOfficeToPdf(preparedPath, outputPath, signal);
    } else {
      await convertLibreOfficeToPdf(preparedPath, outputPath);
    }

    return sendSuccessResponse(res, [createOutputFileItem(outputName)]);
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : "Failed to convert XLSX to PDF.";

    const errorCode = getConversionFailureCode(err);

    await safeUnlink(outputPath);

    return sendErrorResponse(res, 500, errorMessage, errorCode);
  } finally {
    await safeUnlink(preparedPath);
  }
};
