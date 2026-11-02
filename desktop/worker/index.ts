import { convertJpgToPng } from "../../conversion-core/image/convertJpgToPng";
import { convertLibreOfficeToPdf } from "../../conversion-core/office/convertLibreOfficeToPdf";
import { pdfToImages } from "../../conversion-core/pdf/poppler";
import { convertPngToJpg } from "../../conversion-core/image/convertPngToJpg";
import { parsePngToJpgOptions } from "../../conversion-core/image/parsePngToJpgOptions";
import { convertJpgToPdf } from "../../conversion-core/image/convertJpgToPdf";
import { parsePdfPageOptions } from "../../conversion-core/image/parsePdfPageOptions";

async function run(): Promise<void> {
  const [conversion, inputPath, outputPath, conversionArgument] =
    process.argv.slice(2);

  if (!inputPath || !outputPath) {
    throw new Error("Expected input and output file paths.");
  }

  if (conversion === "jpg-to-png") {
    await convertJpgToPng(inputPath, outputPath);
  } else if (conversion === "office-to-pdf") {
    if (!conversionArgument) {
      throw new Error("Expected a LibreOffice executable path.");
    }

    await convertLibreOfficeToPdf(inputPath, outputPath, {
      executablePath: conversionArgument,
      timeoutMs: 120_000,
    });
  } else if (conversion === "pdf-to-jpg") {
    if (!conversionArgument) {
      throw new Error("Expected a Poppler binary directory.");
    }

    await pdfToImages(inputPath, outputPath, {
      binDirectory: conversionArgument,
      timeoutMs: 120_000,
      maxPages: 100,
    });
  } else if (conversion === "png-to-jpg") {
    if (!conversionArgument) {
      throw new Error("Expected PNG to JPG options.");
    }

    const value: unknown = JSON.parse(conversionArgument);
    const options = parsePngToJpgOptions(value);

    await convertPngToJpg(inputPath, outputPath, options);
  } else if (conversion === "jpg-to-pdf") {
    if (!conversionArgument) {
      throw new Error("Expected JPG to PDF options.");
    }

    const value: unknown = JSON.parse(conversionArgument);
    const options = parsePdfPageOptions(value);

    await convertJpgToPdf(inputPath, outputPath, options);
  } else {
    throw new Error("Unsupported probe conversion.");
  }

  console.log("Conversion completed.");
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
