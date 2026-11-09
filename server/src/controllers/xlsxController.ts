import { Request, Response } from "express";
import path from "path";
import fs from "fs/promises";
import {
  OUTPUT_DIR,
  LIBRE_OFFICE_PATH,
  LIBRE_OFFICE_TIMEOUT_MS,
} from "../utils/constants";
import { safeUnlink } from "../utils/file";
import {
  createOutputFileItem,
  sendErrorResponse,
  sendSuccessResponse,
} from "../utils/response";
import { getConversionFailureCode } from "../utils/conversionError";
import { xlsxPdfSettingsSchema } from "../schemas/conversionSettings";
import { convertXlsxToPdf } from "../../../conversion-core/office/convertXlsxToPdf";

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

  try {
    const settingsResult = xlsxPdfSettingsSchema.safeParse(req.body);

    if (!settingsResult.success) {
      return sendErrorResponse(res, 400, "Invalid conversion settings.");
    }

    await fs.mkdir(OUTPUT_DIR, { recursive: true });

    const signal = res.locals?.conversionAbortSignal as AbortSignal | undefined;

    await convertXlsxToPdf(
      file.path,
      outputPath,
      settingsResult.data,
      {
        executablePath: LIBRE_OFFICE_PATH,
        timeoutMs: LIBRE_OFFICE_TIMEOUT_MS,
      },
      signal,
    );

    return sendSuccessResponse(res, [createOutputFileItem(outputName)]);
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : "Failed to convert XLSX to PDF.";

    const errorCode = getConversionFailureCode(err);

    await safeUnlink(outputPath);

    return sendErrorResponse(res, 500, errorMessage, errorCode);
  }
};
