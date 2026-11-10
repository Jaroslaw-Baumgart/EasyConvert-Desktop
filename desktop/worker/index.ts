import { convertJpgToPng } from "../../conversion-core/image/convertJpgToPng";
import { convertLibreOfficeToPdf } from "../../conversion-core/office/convertLibreOfficeToPdf";
import { convertPngToJpg } from "../../conversion-core/image/convertPngToJpg";
import { convertJpgToPdf } from "../../conversion-core/image/convertJpgToPdf";
import { convertTxtToPdf } from "../../conversion-core/pdf/convertTxtToPdf";
import { convertCsvToPdf } from "../../conversion-core/pdf/convertCsvToPdf";
import { convertPdfToJpg } from "../../conversion-core/pdf/convertPdfToJpg";
import { convertPdfToTxt } from "../../conversion-core/pdf/convertPdfToTxt";
import { convertXlsxToPdf } from "../../conversion-core/office/convertXlsxToPdf";
import { parseWorkerRequest } from "./parseWorkerRequest";
import { readFile } from "node:fs/promises";
import { unzipOfficeArchive } from "../../conversion-core/office/officeArchive";

async function run(): Promise<void> {
  const [argument] = process.argv.slice(2);

  if (!argument) {
    throw new Error("Expected a worker request.");
  }

  const value: unknown = JSON.parse(argument);
  const request = parseWorkerRequest(value);

  switch (request.conversion) {
    case "jpg-to-png":
      await convertJpgToPng(request.inputPath, request.outputPath);
      break;

    case "png-to-jpg":
      await convertPngToJpg(
        request.inputPath,
        request.outputPath,
        request.options,
      );
      break;

    case "jpg-to-pdf":
      await convertJpgToPdf(
        request.inputPath,
        request.outputPath,
        request.options,
      );
      break;

    case "txt-to-pdf":
      await convertTxtToPdf(
        request.inputPath,
        request.outputPath,
        request.options,
        request.fontPath,
      );
      break;

    case "csv-to-pdf":
      await convertCsvToPdf(
        request.inputPath,
        request.outputPath,
        request.options,
        request.regularFontPath,
        request.boldFontPath,
      );
      break;

    case "pdf-to-txt":
      await convertPdfToTxt(request.inputPath, request.outputPath, {
        binDirectory: request.binDirectory,
        timeoutMs: 120_000,
        maxPages: 100,
      });
      break;

    case "pdf-to-jpg":
      await convertPdfToJpg(request.inputPath, request.outputPath, {
        binDirectory: request.binDirectory,
        timeoutMs: 120_000,
        maxPages: 100,
      });
      break;

    case "docx-to-pdf":
    case "pptx-to-pdf":
      const archiveBytes = await readFile(request.inputPath);
      await unzipOfficeArchive(archiveBytes);

      await convertLibreOfficeToPdf(request.inputPath, request.outputPath, {
        executablePath: request.executablePath,
        timeoutMs: 120_000,
      });
      break;

    case "xlsx-to-pdf":
      await convertXlsxToPdf(
        request.inputPath,
        request.outputPath,
        request.options,
        { executablePath: request.executablePath, timeoutMs: 120_000 },
      );
      break;
  }
}

run().then(
  () => {
    process.exit(0);
  },
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  },
);
