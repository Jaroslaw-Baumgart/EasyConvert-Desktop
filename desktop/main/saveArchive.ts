import { app } from "electron";
import { copyFile, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { writeZip } from "../../conversion-core/archive/writeZip";
import type { ArchiveEntry } from "../../conversion-core/archive/createZipChunks";
import { saveResultFile } from "./saveResultFile";

async function withTemporaryArchive(
  entries: readonly ArchiveEntry[],
  exportFile: (archivePath: string) => Promise<string>,
): Promise<string> {
  const directory = await mkdtemp(
    path.join(app.getPath("temp"), "easyconvert-archive-"),
  );
  const archivePath = path.join(directory, "archive.zip");

  try {
    await writeZip(archivePath, entries);
    return await exportFile(archivePath);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

export function saveArchive(
  entries: readonly ArchiveEntry[],
  outputDirectory: string,
  fileName: string,
): Promise<string> {
  return withTemporaryArchive(entries, (archivePath) =>
    saveResultFile(archivePath, outputDirectory, fileName),
  );
}

export function saveArchiveAs(
  entries: readonly ArchiveEntry[],
  destinationPath: string,
  beforeCopy: () => Promise<void>,
): Promise<string> {
  return withTemporaryArchive(entries, async (archivePath) => {
    await beforeCopy();
    await copyFile(archivePath, destinationPath);
    return destinationPath;
  });
}
