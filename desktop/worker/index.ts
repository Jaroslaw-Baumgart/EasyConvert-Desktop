import { convertJpgToPng } from "../../conversion-core/image/convertJpgToPng";

async function run(): Promise<void> {
  const [inputPath, outputPath] = process.argv.slice(2);

  if (!inputPath || !outputPath) {
    throw new Error("Expected input and output file paths.");
  }

  await convertJpgToPng(inputPath, outputPath);

  console.log("JPG → PNG completed.");
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
