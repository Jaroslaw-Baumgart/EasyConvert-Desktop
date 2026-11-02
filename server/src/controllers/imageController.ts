import { Request, Response } from "express";
import path from "path";
import { OUTPUT_DIR } from "../utils/constants";
import {
  createOutputFileItem,
  sendErrorResponse,
  sendSuccessResponse,
} from "../utils/response";
import {
  pngToJpgSettingsSchema,
  pdfPageSettingsSchema,
} from "../schemas/conversionSettings";
import { convertJpgToPng } from "../../../conversion-core/image/convertJpgToPng";
import { convertPngToJpg } from "../../../conversion-core/image/convertPngToJpg";
import { ImagePixelLimitError } from "../../../conversion-core/image/imageLimits";
import { convertJpgToPdf } from "../../../conversion-core/image/convertJpgToPdf";

const getBaseFileName = (file: Express.Multer.File) => {
  return path.parse(file.filename).name;
};

// JPG --> PNG
export const jpgToPng = async (req: Request, res: Response) => {
  if (!req.file) {
    return sendErrorResponse(res, 400, "No JPG file uploaded.");
  }

  const outputName = `${getBaseFileName(req.file)}.png`;
  const outputPath = path.join(OUTPUT_DIR, outputName);

  try {
    await convertJpgToPng(req.file.path, outputPath);

    sendSuccessResponse(res, [createOutputFileItem(outputName)]);
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : "Failed to convert JPG to PNG.";

    sendErrorResponse(
      res,
      err instanceof ImagePixelLimitError ? 400 : 500,
      errorMessage,
    );
  }
};

// PNG --> JPG
export const pngToJpg = async (req: Request, res: Response) => {
  if (!req.file) {
    return sendErrorResponse(res, 400, "No PNG file uploaded.");
  }

  const outputName = `${getBaseFileName(req.file)}.jpg`;
  const outputPath = path.join(OUTPUT_DIR, outputName);

  try {
    const settingsResult = pngToJpgSettingsSchema.safeParse(req.body);

    if (!settingsResult.success) {
      return sendErrorResponse(res, 400, "Invalid conversion settings.");
    }
    const settings = settingsResult.data;

    await convertPngToJpg(req.file.path, outputPath, settings);

    sendSuccessResponse(res, [createOutputFileItem(outputName)]);
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : "Failed to convert PNG to JPG.";

    sendErrorResponse(
      res,
      err instanceof ImagePixelLimitError ? 400 : 500,
      errorMessage,
    );
  }
};

// JPG --> PDF
export const jpgToPdf = async (req: Request, res: Response) => {
  if (!req.file) {
    return sendErrorResponse(res, 400, "No JPG file uploaded.");
  }

  const outputName = `${getBaseFileName(req.file)}.pdf`;
  const outputPath = path.join(OUTPUT_DIR, outputName);

  try {
    const settingsResult = pdfPageSettingsSchema.safeParse(req.body);

    if (!settingsResult.success) {
      return sendErrorResponse(res, 400, "Invalid conversion settings.");
    }
    const settings = settingsResult.data;

    await convertJpgToPdf(req.file.path, outputPath, settings);

    sendSuccessResponse(res, [createOutputFileItem(outputName)]);
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : "Failed to convert JPG to PDF.";

    sendErrorResponse(
      res,
      err instanceof ImagePixelLimitError ? 400 : 500,
      errorMessage,
    );
  }
};
