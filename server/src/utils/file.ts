import fs from "fs/promises";
import path from "path";
import { OUTPUT_DIR } from "./constants";

export const OUTPUT_RETENTION_MS = 30 * 60 * 1000;

export async function clearFolder(folderPath: string) {
  try {
    await fs.rm(folderPath, { recursive: true, force: true });
    await fs.mkdir(folderPath, { recursive: true });
    console.log(`Cleaned: ${folderPath}`);
  } catch (err) {
    console.error(`Cleaning error ${folderPath}:`, err);
  }
}

export async function clearAllTemp() {
  const uploadsDir = path.join(__dirname, "../../uploads");
  const outputDir = path.join(__dirname, "../../output");
  await Promise.all([clearFolder(uploadsDir), clearFolder(outputDir)]);
}

export const safeUnlink = async (filePath: string) => {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (isMissingFile(error)) return;
    console.error(`Could not remove temporary file ${filePath}:`, error);
  }
};

export async function cleanupConversionOutputs(uploadFilename: string) {
  const base = path.parse(path.basename(uploadFilename)).name;
  if (!base || base === "." || base === "..") {
    return;
  }
  await Promise.all([
    ...["pdf", "png", "jpg", "txt", "xlsx"].map((extension) =>
      safeUnlink(path.join(OUTPUT_DIR, `${base}.${extension}`))),
    fs.rm(path.join(OUTPUT_DIR, base), { recursive: true, force: true }),
  ]);
}

export async function cleanupExpiredOutputs(
  outputDirectory: string,
  now = Date.now(),
) {
  let entries;

  try {
    entries = await fs.readdir(outputDirectory, {
      withFileTypes: true,
    });
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return;
    }

    throw error;
  }

  for (const entry of entries) {
    const entryPath = path.join(outputDirectory, entry.name);
    let metadata;
    try { metadata = await fs.stat(entryPath); }
    catch (error) {
      if (isMissingFile(error)) continue;
      throw error;
    }
    const age = now - metadata.mtimeMs;

    if (age > OUTPUT_RETENTION_MS) {
      await fs.rm(entryPath, {
        recursive: entry.isDirectory(),
        force: true,
      });
    }
  }
}

function isMissingFile(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
