import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { convertPdfToJpg } from "../../pdf/convertPdfToJpg";

let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "easyconvert-pdf-to-jpg-"));
});

afterEach(async () => {
  const expectedPrefix = path.join(tmpdir(), "easyconvert-pdf-to-jpg-");

  if (!directory || !directory.startsWith(expectedPrefix)) {
    throw new Error("Unexpected test directory.");
  }

  await rm(directory, { recursive: true, force: true });
});

describe("PDF to JPG real conversion", () => {
  it("creates two readable JPEGs in page order", async () => {
    const inputPath = path.resolve(
      __dirname,
      "../../../fixtures/two-pages.pdf",
    );

    const outputs = await convertPdfToJpg(inputPath, directory, {
      binDirectory: process.env.POPPLER_BIN ?? "",
      timeoutMs: 120_000,
      maxPages: 100,
    });

    expect(outputs).toHaveLength(2);

    const pageNumbers = outputs.map((output) =>
      Number(path.basename(output).match(/^page-(\d+)\.jpg$/)?.[1]),
    );

    expect(pageNumbers).toEqual([1, 2]);

    for (const output of outputs) {
      expect(path.dirname(output)).toBe(directory);

      const bytes = await readFile(output);
      const metadata = await sharp(bytes).metadata();

      expect(metadata.format).toBe("jpeg");
      expect(metadata.width).toBeGreaterThan(0);
      expect(metadata.height).toBeGreaterThan(0);
      expect(Math.max(metadata.width!, metadata.height!)).toBe(1024);

      const decoded = await sharp(bytes).raw().toBuffer();
      expect(decoded.length).toBeGreaterThan(0);
    }
  });
});
