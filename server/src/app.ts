import express from "express";
import cors from "cors";
import path from "path";
import { createUpload } from "./middlewares/upload";
import { fileValidation } from "./middlewares/fileValidation";
import { routeDispatcher } from "./middlewares/routeDispatcher";
import { outputRetention } from "./middlewares/outputRetention";
import multer from "multer";
import { safeUnlink } from "./utils/file";
import { sendErrorResponse } from "./utils/response";

export function createApp(uploadDirectory = "uploads/") {
  const upload = createUpload(uploadDirectory);
  const app = express();
  let activeConversions = 0;

  const reserveConversionSlot: express.RequestHandler = (_req, res, next) => {
    if (activeConversions >= 2) {
      sendErrorResponse(
        res,
        429,
        "The conversion service is busy. Please try again.",
        "service-busy",
      );
      return;
    }

    activeConversions += 1;
    let released = false;
    const release = () => {
      if (released) {
        return;
      }
      released = true;
      activeConversions -= 1;
    };

    res.locals.conversionStarted = false;
    res.locals.releaseConversionSlot = release;
    res.once("finish", release);
    res.once("close", () => {
      if (!res.locals.conversionStarted) {
        release();
      }
    });
    next();
  };

  const allowedOrigins = new Set([
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    ...(process.env.CLIENT_ORIGIN ? [process.env.CLIENT_ORIGIN] : []),
  ]);
  app.use((req, res, next) => {
    if (req.headers.origin && !allowedOrigins.has(req.headers.origin)) {
      sendErrorResponse(res, 403, "Origin is not allowed.");
      return;
    }
    next();
  });
  app.use(cors({ origin: [...allowedOrigins], methods: ["GET", "POST"] }));
  app.use(express.json());
  app.use("/output", express.static(path.join(__dirname, "../output")));

  app.post(
    "/convert",
    reserveConversionSlot,
    outputRetention,
    upload.single("file"),
    fileValidation,
    (req, res, next) => {
      res.locals.conversionStarted = true;
      void routeDispatcher(req, res)
        .catch(next)
        .finally(() => res.locals.releaseConversionSlot?.());
    },
  );

  const errorHandler: express.ErrorRequestHandler = (
    error: unknown,
    req,
    res,
    next,
  ) => {
    void (async () => {
      if (req.file) {
        await safeUnlink(req.file.path);
      }

      if (res.headersSent) {
        next(error);
        return;
      }

      if (error instanceof multer.MulterError) {
        const message =
          error.code === "LIMIT_FILE_SIZE"
            ? "File is too large. Max size: 10 MB"
            : "Invalid upload form.";

        sendErrorResponse(res, 400, message);
        return;
      }
      console.error("Request failed", error);
      sendErrorResponse(res, 500, "The file could not be converted.");
    })().catch(next);
  };
  app.use(errorHandler);

  return app;
}

const app = createApp();

export default app;
