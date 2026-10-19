import sharp from "sharp";

export const MAX_IMAGE_PIXELS = 40_000_000;

export class ImagePixelLimitError extends Error {}

export async function validateImagePixels(inputPath: string): Promise<void> {
  const { width, height } = await sharp(inputPath, {
    limitInputPixels: false,
  }).metadata();

  if (!width || !height || width * height > MAX_IMAGE_PIXELS) {
    throw new ImagePixelLimitError(
      `Image exceeds the ${MAX_IMAGE_PIXELS}-pixel processing limit.`,
    );
  }
}
