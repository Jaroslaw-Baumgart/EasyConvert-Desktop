import path from "path";
import fs from "fs/promises";
import { conversionDefinitions } from "../config/conversions";
import { unzipOfficeArchive } from "./officeArchive";

export async function validateFileSecure(
  filePath: string,
  originalName: string,
  allowedExt: string[],
  allowedMime: string[],
  maxSizeMB: number = 10,
) {
  const stat = await fs.stat(filePath);

  const fileSizeMB = stat.size / (1024 * 1024);
  if (fileSizeMB > maxSizeMB) {
    throw new Error(`File is too large. Max size: ${maxSizeMB} MB`);
  }

  const ext = path.extname(originalName).toLowerCase();
  if (!allowedExt.includes(ext)) {
    throw new Error(
      `Invalid file extension. Allowed: ${allowedExt.join(", ")}`,
    );
  }

  const buffer = await fs.readFile(filePath);
  if ([".docx", ".xlsx", ".pptx"].includes(ext)) await unzipOfficeArchive(buffer);
  const { fileTypeFromBuffer } = await import("file-type");
  const type = await fileTypeFromBuffer(buffer);

  // Special handling for TXT files
  if (ext === ".txt" || ext === ".csv") {
    const mime = type?.mime as string | undefined;
    if (
      !mime ||
      mime === "application/octet-stream" ||
      mime.startsWith("text/")
    ) {
      // Reject binary data even when it has no recognised magic signature.
      new TextDecoder("utf-8", { fatal: true }).decode(buffer);
      if (buffer.includes(0)) throw new Error("Invalid text file content.");
      return;
    }
    throw new Error(`Invalid MIME type for TXT. Detected: ${mime}`);
  }

  // Normal check for other files
  const mime = type?.mime as string | undefined;
  const expectedMime = conversionDefinitions.find(
    (definition) => `.${definition.sourceExtension}` === ext,
  )?.mimeType;
  if (!mime || !allowedMime.includes(mime) || mime !== expectedMime) {
    throw new Error(`Invalid MIME type. Detected: ${mime || "unknown"}`);
  }
}
