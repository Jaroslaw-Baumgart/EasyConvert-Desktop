import { copyFile, mkdtemp, rename, rm } from "node:fs/promises";
import path from "node:path";

export async function replaceResultFile(
  sourcePath: string,
  destinationPath: string,
): Promise<void> {
  const tempDir = await mkdtemp(
    path.join(path.dirname(destinationPath), ".easyconvert-export-"),
  );
  const tempFile = path.join(tempDir, path.basename(destinationPath));

  try {
    await copyFile(sourcePath, tempFile);
    await rename(tempFile, destinationPath);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
