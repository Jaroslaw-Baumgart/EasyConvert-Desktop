import type { NextFunction, Request, Response } from "express";
import { OUTPUT_DIR } from "../utils/constants";
import { cleanupExpiredOutputs } from "../utils/file";

export async function outputRetention(
  _req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    await cleanupExpiredOutputs(OUTPUT_DIR);
    next();
  } catch (error) {
    next(error);
  }
}
