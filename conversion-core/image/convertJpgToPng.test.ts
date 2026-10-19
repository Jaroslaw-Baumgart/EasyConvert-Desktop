import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { convertJpgToPng } from "./convertJpgToPng";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.map((directory) =>
      fs.rm(directory, { recursive: true, force: true }),
    ),
  );

  temporaryDirectories.length = 0;
});

describe("convertJpgToPng", () => {
  it("creates a PNG with the dimensions of the source JPEG", async () => {
    const directory = await fs.mkdtemp(
      path.join(os.tmpdir(), "easyconvert-jpg-to-png-"),
    );
    temporaryDirectories.push(directory);

    const inputPath = path.join(directory, "source.jpg");
    const outputPath = path.join(directory, "result.png");

    await sharp({
      create: {
        width: 32,
        height: 24,
        channels: 3,
        background: "red",
      },
    })
      .jpeg()
      .toFile(inputPath);

    await convertJpgToPng(inputPath, outputPath);

    expect(await sharp(outputPath).metadata()).toMatchObject({
      format: "png",
      width: 32,
      height: 24,
    });
  });
});
