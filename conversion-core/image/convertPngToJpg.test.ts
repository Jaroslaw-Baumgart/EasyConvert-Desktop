import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convertPngToJpg } from "./convertPngToJpg";
import * as imageLimits from "./imageLimits";

let directory: string | undefined;

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "easyconvert-png-to-jpg-"));
});

afterEach(async () => {
  vi.restoreAllMocks();

  if (directory) {
    await rm(directory, { recursive: true, force: true });
    directory = undefined;
  }
});

function filePath(name: string): string {
  if (!directory) {
    throw new Error("Test directory has not been created.");
  }

  return path.join(directory, name);
}

async function createTransparentPng(): Promise<string> {
  const input = filePath("transparent.png");

  await sharp({
    create: {
      width: 32,
      height: 24,
      channels: 4,
      background: { r: 0, g: 0, b: 255, alpha: 0 },
    },
  })
    .png()
    .toFile(input);

  return input;
}

describe("convertPngToJpg", () => {
  it.each([
    { color: "#ffffff", rgb: [255, 255, 255] },
    { color: "#000000", rgb: [0, 0, 0] },
    { color: "#ff0000", rgb: [255, 0, 0] },
  ])(
    "creates a JPEG with the original dimensions and background $color",
    async ({ color, rgb }) => {
      const input = await createTransparentPng();
      const output = filePath("result.jpg");

      await convertPngToJpg(input, output, {
        quality: 95,
        backgroundColor: color,
      });

      expect(await sharp(output).metadata()).toMatchObject({
        format: "jpeg",
        width: 32,
        height: 24,
        channels: 3,
        hasAlpha: false,
      });

      const pixels = await sharp(output).raw().toBuffer();

      // JPEG jest stratny, dlatego dopuszczamy małą różnicę koloru.
      for (let index = 0; index < pixels.length; index += 1) {
        expect(Math.abs(pixels[index] - rgb[index % 3])).toBeLessThanOrEqual(3);
      }
    },
  );

  it("uses the requested JPEG quality", async () => {
    const width = 128;
    const height = 96;
    const pixels = Buffer.alloc(width * height * 3);

    for (let index = 0; index < pixels.length; index += 1) {
      pixels[index] = (index * 73 + Math.floor(index / 97) * 19) % 256;
    }

    const input = filePath("detailed.png");
    const lowQualityOutput = filePath("quality-20.jpg");
    const highQualityOutput = filePath("quality-95.jpg");

    await sharp(pixels, {
      raw: { width, height, channels: 3 },
    })
      .png()
      .toFile(input);

    await convertPngToJpg(input, lowQualityOutput, {
      quality: 20,
      backgroundColor: "#ffffff",
    });

    await convertPngToJpg(input, highQualityOutput, {
      quality: 95,
      backgroundColor: "#ffffff",
    });

    const lowQuality = await readFile(lowQualityOutput);
    const highQuality = await readFile(highQualityOutput);

    expect(highQuality.length).toBeGreaterThan(lowQuality.length);

    for (const output of [lowQualityOutput, highQualityOutput]) {
      expect(await sharp(output).metadata()).toMatchObject({
        format: "jpeg",
        width,
        height,
      });

      await expect(sharp(output).raw().toBuffer()).resolves.toBeInstanceOf(
        Buffer,
      );
    }
  });

  it("does not create output when the shared pixel validation rejects the input", async () => {
    const input = await createTransparentPng();
    const output = filePath("result.jpg");
    const error = new imageLimits.ImagePixelLimitError("Pixel limit exceeded.");

    vi.spyOn(imageLimits, "validateImagePixels").mockRejectedValueOnce(error);

    await expect(
      convertPngToJpg(input, output, {
        quality: 85,
        backgroundColor: "#ffffff",
      }),
    ).rejects.toBe(error);

    await expect(stat(output)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rejects a missing input without creating output", async () => {
    const output = filePath("result.jpg");

    await expect(
      convertPngToJpg(filePath("missing.png"), output, {
        quality: 85,
        backgroundColor: "#ffffff",
      }),
    ).rejects.toThrow();

    await expect(stat(output)).rejects.toMatchObject({ code: "ENOENT" });
  });
});
