import sharp from "sharp";
import { MAX_IMAGE_PIXELS, validateImagePixels } from "./imageLimits";

export async function convertJpgToPng(
  inputPath: string,
  outputPath: string,
): Promise<void> {
  await validateImagePixels(inputPath);

  await sharp(inputPath, {
    limitInputPixels: MAX_IMAGE_PIXELS,
  })
    .png()
    .toFile(outputPath);
}
