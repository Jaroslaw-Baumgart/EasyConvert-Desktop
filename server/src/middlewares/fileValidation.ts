import { Request, Response, NextFunction } from "express";
import { validateFileSecure } from "../utils/sourceValidation";
import { sendErrorResponse } from "../utils/response";
import { allowedExtensions, allowedMimeTypes } from "../config/conversions";
import { safeUnlink } from "../utils/file";

export async function fileValidation(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!req.file) {
    return sendErrorResponse(res, 400, "No file uploaded.");
  }

  const file = req.file;

  try {
    await validateFileSecure(
      file.path,
      file.originalname,
      allowedExtensions,
      allowedMimeTypes,
      10,
    );
    next();
  } catch (err: unknown) {
    await safeUnlink(file.path);

    const errorMessage =
      err instanceof Error ? err.message : "File validation failed.";

    return sendErrorResponse(res, 400, errorMessage);
  }
}
