import { Request, Response } from "express";
import path from "path";
import sharp from "sharp";
import PDFDocument from "pdfkit";
import { MAX_IMAGE_PIXELS, OUTPUT_DIR } from "../utils/constants";
import fs from "fs";
import {
  createOutputFileItem,
  sendErrorResponse,
  sendSuccessResponse,
} from "../utils/response";
import {
  pngToJpgSettingsSchema,
  pdfPageSettingsSchema,
} from "../schemas/conversionSettings";

const getBaseFileName = (file: Express.Multer.File) => {
  return path.parse(file.filename).name;
};

class ImagePixelLimitError extends Error {}

async function validateImagePixels(inputPath: string) {
  // metadata() reads the header without decoding the pixel buffer.
  const { width, height } = await sharp(inputPath, { limitInputPixels: false }).metadata();
  if (!width || !height || width * height > MAX_IMAGE_PIXELS) {
    throw new ImagePixelLimitError(`Image exceeds the ${MAX_IMAGE_PIXELS}-pixel processing limit.`);
  }
}

// JPG --> PNG
export const jpgToPng = async (req: Request, res: Response) => {
  if (!req.file) {
    return sendErrorResponse(res, 400, "No JPG file uploaded.");
  }

  const outputName = `${getBaseFileName(req.file)}.png`;
  const outputPath = path.join(OUTPUT_DIR, outputName);

  try {
    await validateImagePixels(req.file.path);
    await sharp(req.file.path, { limitInputPixels: MAX_IMAGE_PIXELS }).png().toFile(outputPath);

    sendSuccessResponse(res, [createOutputFileItem(outputName)]);
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : "Failed to convert JPG to PNG.";

    sendErrorResponse(res, err instanceof ImagePixelLimitError ? 400 : 500, errorMessage);
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

    await validateImagePixels(req.file.path);
    await sharp(req.file.path, { limitInputPixels: MAX_IMAGE_PIXELS })
      .flatten({ background: settings.backgroundColor })
      .jpeg({ quality: settings.quality })
      .toFile(outputPath);

    sendSuccessResponse(res, [createOutputFileItem(outputName)]);
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : "Failed to convert PNG to JPG.";

    sendErrorResponse(res, err instanceof ImagePixelLimitError ? 400 : 500, errorMessage);
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

    await validateImagePixels(req.file.path);
    const doc = new PDFDocument({ autoFirstPage: false });
    doc.addPage({ size: settings.pageSize, layout: settings.pageOrientation });
    const pageMargin = 36;
    const imageWidth = doc.page.width - pageMargin * 2;
    const imageHeight = doc.page.height - pageMargin * 2;
    doc.image(req.file.path, {
      fit: [imageWidth, imageHeight],
      align: "center",
      valign: "center",
    });

    await new Promise<void>((resolve, reject) => {
      const stream = doc.pipe(fs.createWriteStream(outputPath));
      stream.on("finish", resolve);
      stream.on("error", reject);
      doc.end();
    });

    sendSuccessResponse(res, [createOutputFileItem(outputName)]);
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : "Failed to convert JPG to PDF.";

    sendErrorResponse(res, err instanceof ImagePixelLimitError ? 400 : 500, errorMessage);
  }
};
