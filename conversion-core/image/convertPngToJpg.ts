import sharp from "sharp";
import { MAX_IMAGE_PIXELS, validateImagePixels } from "./imageLimits";
import type { PngToJpgOptions } from "../../shared/conversionOptions";

export async function convertPngToJpg(
  inputPath: string,
  outputPath: string,
  options: PngToJpgOptions,
): Promise<void> {
  await validateImagePixels(inputPath);

  await sharp(inputPath, {
    limitInputPixels: MAX_IMAGE_PIXELS,
  })
    .flatten({ background: options.backgroundColor })
    .jpeg({ quality: options.quality })
    .toFile(outputPath);
}
