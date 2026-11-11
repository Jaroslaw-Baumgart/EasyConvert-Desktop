import { open, unlink } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createZipChunks, type ArchiveEntry } from "./createZipChunks";

export async function writeZip(
  outputPath: string,
  entries: readonly ArchiveEntry[],
): Promise<void> {
  const handle = await open(outputPath, "wx");
  try {
    await pipeline(
      Readable.from(createZipChunks(entries)),
      handle.createWriteStream(),
    );
  } catch (error) {
    await handle.close();

    try {
      await unlink(outputPath);
    } catch (cleanupError: unknown) {
      if (
        typeof cleanupError !== "object" ||
        cleanupError === null ||
        !("code" in cleanupError) ||
        cleanupError.code !== "ENOENT"
      ) {
        throw cleanupError;
      }
    }

    throw error;
  } finally {
    await handle.close();
  }
}
