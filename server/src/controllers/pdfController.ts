import { Request, Response } from "express";
import fsSync from "fs";
import PDFDocument from "pdfkit";
import fs from "fs/promises";
import path from "path";
import { pdfToImages, runPoppler, validatePdfPageCount } from "../utils/poppler";
import { OUTPUT_DIR } from "../utils/constants";
import {
  createOutputFileItem,
  sendErrorResponse,
  sendSuccessResponse,
} from "../utils/response";
import { pdfPageSettingsSchema } from "../schemas/conversionSettings";
import { limitPdfPages } from "../utils/pdfLimits";

const getBaseFileName = (file: Express.Multer.File) => {
  return path.parse(file.filename).name;
};

// PDF --> JPG
export const pdfToJpg = async (req: Request, res: Response) => {
  if (!req.file) {
    return sendErrorResponse(res, 400, "No PDF file uploaded.");
  }

  const file = req.file;
  const baseName = getBaseFileName(file);
  const pdfPath = file.path;
  const outputSubdir = path.join(OUTPUT_DIR, baseName);
  const signal = res.locals?.conversionAbortSignal as AbortSignal | undefined;

  try {
    await fs.mkdir(outputSubdir, { recursive: true });

    if (signal) {
      await pdfToImages(pdfPath, outputSubdir, signal);
    } else {
      await pdfToImages(pdfPath, outputSubdir);
    }

    const jpgFiles = (await fs.readdir(outputSubdir)).filter((f) =>
      f.endsWith(".jpg"),
    ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    const files = jpgFiles.map((name) => ({
      url: `/output/${baseName}/${name}`,
      name,
    }));

    const [firstFile, ...remainingFiles] = files;

    if (!firstFile) {
      return sendErrorResponse(
        res,
        500,
        "PDF conversion produced no JPG files.",
      );
    }

    return sendSuccessResponse(res, [firstFile, ...remainingFiles]);
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : "Failed to convert PDF to JPG.";

    sendErrorResponse(res, 500, errorMessage);
  }
};

// PDF --> TXT
export const pdfToTxt = async (req: Request, res: Response) => {
  if (!req.file) {
    return sendErrorResponse(res, 400, "No PDF file uploaded.");
  }

  const file = req.file;
  const outputName = `${getBaseFileName(file)}.txt`;
  const outputPath = path.join(OUTPUT_DIR, outputName);
  const signal = res.locals?.conversionAbortSignal as AbortSignal | undefined;

  try {
    if (signal) {
      await validatePdfPageCount(file.path, signal);
      await runPoppler("pdftotext", [file.path, outputPath], signal);
    } else {
      await validatePdfPageCount(file.path);
      await runPoppler("pdftotext", [file.path, outputPath]);
    }

    return sendSuccessResponse(res, [createOutputFileItem(outputName)]);
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : "Failed to convert PDF to TXT.";

    sendErrorResponse(res, 500, errorMessage);
  }
};

// TXT --> PDF
export const txtToPdf = async (req: Request, res: Response) => {
  if (
    !req.file ||
    path.extname(req.file.originalname).toLowerCase() !== ".txt"
  ) {
    return sendErrorResponse(res, 400, "No TXT file uploaded.");
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

    const text = await fs.readFile(file.path, "utf8");

    const doc = new PDFDocument({
      size: settings.pageSize,
      layout: settings.pageOrientation,
    });
    limitPdfPages(doc);
    doc.font(path.join(__dirname, "../assets/fonts/NotoSans-Regular.ttf"));
    doc.fontSize(12).text(text, { align: "left" });
    await new Promise<void>((resolve, reject) => {
      const stream = doc.pipe(fsSync.createWriteStream(outputPath));
      stream.on("finish", resolve);
      stream.on("error", reject);
      doc.end();
    });

    return sendSuccessResponse(res, [createOutputFileItem(outputName)]);
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : "Failed to convert TXT to PDF.";

    sendErrorResponse(res, 500, errorMessage);
  }
};
