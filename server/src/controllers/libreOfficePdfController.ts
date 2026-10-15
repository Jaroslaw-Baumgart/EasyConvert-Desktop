import { Request, Response } from "express";
import path from "path";
import { OUTPUT_DIR } from "../utils/constants";
import {
  createOutputFileItem,
  sendErrorResponse,
  sendSuccessResponse,
} from "../utils/response";
import { getConversionFailureCode } from "../utils/conversionError";
import { convertLibreOfficeToPdf } from "../utils/libreOffice";
import { safeUnlink } from "../utils/file";

const getBaseFileName = (file: Express.Multer.File) => {
  return path.parse(file.filename).name;
};

export function createLibreOfficePdfController(
  sourceExtension: string,
  formatName: string,
) {
  return async (req: Request, res: Response) => {
    if (
      !req.file ||
      path.extname(req.file.originalname).toLowerCase() !==
        `.${sourceExtension}`
    ) {
      return sendErrorResponse(res, 400, `No ${formatName} file uploaded.`);
    }

    const file = req.file;
    const outputName = `${getBaseFileName(file)}.pdf`;
    const outputPath = path.join(OUTPUT_DIR, outputName);

    try {
      const signal = res.locals?.conversionAbortSignal as AbortSignal | undefined;
      if (signal) {
        await convertLibreOfficeToPdf(file.path, outputPath, signal);
      } else {
        await convertLibreOfficeToPdf(file.path, outputPath);
      }

      return sendSuccessResponse(res, [createOutputFileItem(outputName)]);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : `Failed to convert ${formatName} to PDF.`;

      const errorCode = getConversionFailureCode(err);

      await safeUnlink(outputPath);

      return sendErrorResponse(res, 500, errorMessage, errorCode);
    }
  };
}
