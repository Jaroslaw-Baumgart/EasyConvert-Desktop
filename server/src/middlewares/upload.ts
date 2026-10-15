import multer from "multer";
import path from "path";
import { randomUUID } from "node:crypto";
import { MAX_UPLOAD_BYTES } from "../utils/constants";

export function createUpload(uploadDirectory: string) {
  const storage = multer.diskStorage({
    destination: uploadDirectory,
    filename: (_, file, cb) => {
      cb(null, randomUUID() + path.extname(file.originalname).toLowerCase());
    },
  });

  return multer({ storage, limits: {
    fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 8, parts: 10,
    fieldSize: 4096, fieldNameSize: 100,
  } });
}

export const upload = createUpload("uploads/");
