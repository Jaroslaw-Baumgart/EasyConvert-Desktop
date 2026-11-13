import { app } from "electron";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, rm, stat } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { MAX_SOURCE_BYTES } from "../../shared/conversionLimits";

export async function copySourceFile(
  sourcePath: string,
): Promise<{ path: string; directory: string; sizeBytes: number }> {
  const directory = await mkdtemp(
    path.join(app.getPath("temp"), "easyconvert-source-"),
  );
  const copiedPath = path.join(directory, path.basename(sourcePath));

  try {
    await pipeline(
      createReadStream(sourcePath, { end: MAX_SOURCE_BYTES }),
      createWriteStream(copiedPath, { flags: "wx" }),
    );

    const metadata = await stat(copiedPath);

    if (metadata.size === 0) {
      throw new Error("Selected file is empty.");
    }

    if (metadata.size > MAX_SOURCE_BYTES) {
      throw new Error("Selected file is too large (max 10 MB).");
    }

    return {
      path: copiedPath,
      directory,
      sizeBytes: metadata.size,
    };
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}
