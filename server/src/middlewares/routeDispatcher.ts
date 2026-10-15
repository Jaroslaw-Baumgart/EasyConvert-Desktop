import { Request, Response } from "express";
import { sendErrorResponse } from "../utils/response";
import { conversionDefinitions } from "../config/conversions";
import path from "path";
import { safeUnlink, cleanupConversionOutputs } from "../utils/file";

export async function routeDispatcher(req: Request, res: Response) {
  if (!req.file) {
    return sendErrorResponse(res, 400, "No file uploaded.");
  }

  const file = req.file;
  let succeeded = false;
  const abortController = new AbortController();
  const abortOnDisconnect = () => {
    if (!res.writableEnded) {
      abortController.abort();
    }
  };

  req.once("aborted", abortOnDisconnect);
  res.once("close", abortOnDisconnect);
  res.locals.conversionAbortSignal = abortController.signal;

  try {
    const rawConversionType: unknown = req.body?.conversionType;
    if (rawConversionType !== undefined && typeof rawConversionType !== "string") {
      return sendErrorResponse(res, 400, "Invalid conversion type.");
    }
    const conversionType = (rawConversionType ?? "").trim().toLowerCase();

    if (!conversionType) {
      return sendErrorResponse(res, 400, "Please specify conversionType.");
    }

    const definition = conversionDefinitions.find(
      (candidate) => candidate.conversionType === conversionType,
    );

    if (!definition) {
      return sendErrorResponse(res, 400, "Unsupported conversion type.");
    }

    const fileExtension = path
      .extname(file.originalname)
      .substring(1)
      .toLowerCase();

    if (definition.sourceExtension !== fileExtension) {
      return sendErrorResponse(
        res,
        400,
        "File type does not match conversion type.",
      );
    }

    const result = await definition.handler(req, res);
    succeeded = res.statusCode < 400;
    return result;
  } finally {
    req.removeListener("aborted", abortOnDisconnect);
    res.removeListener("close", abortOnDisconnect);
    await safeUnlink(file.path);
    if (!succeeded) {
      await cleanupConversionOutputs(file.filename);
    }
    res.locals.releaseConversionSlot?.();
  }
}
