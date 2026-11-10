import path from "node:path";
import type { StartConversionRequest } from "../../shared/desktopContract";
import type { WorkerConversionRequest } from "../../shared/workerContract";
import { getResourcePaths } from "./resourcePaths";

export function createWorkerRequest(
  inputPath: string,
  outputPath: string,
  request: StartConversionRequest,
): WorkerConversionRequest {
  const paths = { inputPath, outputPath };
  const { executablePath, binDirectory, fontsDirectory } = getResourcePaths();

  switch (request.conversion) {
    case "jpg-to-png":
      return { ...paths, conversion: "jpg-to-png" };
    case "png-to-jpg":
      return {
        ...paths,
        conversion: "png-to-jpg",
        options: request.options,
      };
    case "jpg-to-pdf":
      return {
        ...paths,
        conversion: "jpg-to-pdf",
        options: request.options,
      };
    case "pdf-to-jpg":
    case "pdf-to-txt":
      return {
        ...paths,
        conversion: request.conversion,
        binDirectory,
      };
    case "docx-to-pdf":
    case "pptx-to-pdf":
      return {
        ...paths,
        conversion: request.conversion,
        executablePath,
      };
    case "txt-to-pdf":
      return {
        ...paths,
        conversion: "txt-to-pdf",
        options: request.options,
        fontPath: path.join(fontsDirectory, "NotoSans-Regular.ttf"),
      };
    case "csv-to-pdf":
      return {
        ...paths,
        conversion: "csv-to-pdf",
        options: request.options,
        regularFontPath: path.join(fontsDirectory, "NotoSans-Regular.ttf"),
        boldFontPath: path.join(fontsDirectory, "NotoSans-Bold.ttf"),
      };
    case "xlsx-to-pdf":
      return {
        ...paths,
        conversion: "xlsx-to-pdf",
        options: request.options,
        executablePath,
      };
  }
}
