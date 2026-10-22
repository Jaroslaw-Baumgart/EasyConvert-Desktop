import { convertJpgToPng } from "../../conversion-core/image/convertJpgToPng";
import { convertLibreOfficeToPdf } from "../../conversion-core/office/convertLibreOfficeToPdf";

async function run(): Promise<void> {
  const [conversion, inputPath, outputPath, executablePath] =
    process.argv.slice(2);

  if (!inputPath || !outputPath) {
    throw new Error("Expected input and output file paths.");
  }

  if (conversion === "jpg-to-png") {
    await convertJpgToPng(inputPath, outputPath);
  } else if (conversion === "office-to-pdf") {
    if (!executablePath) {
      throw new Error("Expected a LibreOffice executable path.");
    }

    await convertLibreOfficeToPdf(inputPath, outputPath, {
      executablePath,
      timeoutMs: 120_000,
    });
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
