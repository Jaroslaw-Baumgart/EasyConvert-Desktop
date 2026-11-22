import { app } from "electron";
import { constants } from "node:fs";
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";

export function getDefaultOutputDirectory(): string {
  return path.join(app.getPath("desktop"), "EasyConvert Output");
}

export async function saveResultFile(
  resultPath: string,
  directory: string,
  fileName: string,
): Promise<string> {
  await mkdir(directory, { recursive: true });
  const { name, ext } = path.parse(fileName);
  for (let index = 0; ; index += 1) {
    const destination = path.join(
      directory,
      index === 0 ? fileName : `${name} (${index})${ext}`,
    );
    try {
      await copyFile(resultPath, destination, constants.COPYFILE_EXCL);
      return destination;
    } catch (error) {
      if (
        typeof error !== "object" ||
        error === null ||
        !("code" in error) ||
        error.code !== "EEXIST"
      ) {
        throw error;
      }
    }
  }
}
