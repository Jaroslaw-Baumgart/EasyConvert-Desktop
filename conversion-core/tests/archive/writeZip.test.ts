import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { unzipSync } from "fflate";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { writeZip } from "../../archive/writeZip";

let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "easyconvert-zip-test-"));
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe("writeZip", () => {
  it("preserves file bytes, entry order and Unicode names across multiple read chunks", async () => {
    const firstPath = path.join(directory, "page-01.jpg");
    const secondPath = path.join(directory, "page-02.jpg");
    const firstBytes = Buffer.from(Array.from({ length: 256 * 1024 }, (_, index) => index % 251));
    const secondBytes = Buffer.from([0, 255, 128, 1, 2]);
    await writeFile(firstPath, firstBytes);
    await writeFile(secondPath, secondBytes);
    const outputPath = path.join(directory, "Raport Łódź.zip");

    await writeZip(outputPath, [
      { resultPath: secondPath, fileName: "Raport Łódź-page-1.jpg" },
      { resultPath: firstPath, fileName: "Raport Łódź-page-2.jpg" },
    ]);

    const files = unzipSync(await readFile(outputPath));
    expect(Object.keys(files)).toEqual([
      "Raport Łódź-page-1.jpg",
      "Raport Łódź-page-2.jpg",
    ]);
    expect(Buffer.from(files["Raport Łódź-page-1.jpg"]!)).toEqual(secondBytes);
    expect(Buffer.from(files["Raport Łódź-page-2.jpg"]!)).toEqual(firstBytes);
    expect(await readFile(firstPath)).toEqual(firstBytes);
    expect(await readFile(secondPath)).toEqual(secondBytes);
  });

  it("does not overwrite or delete an existing destination", async () => {
    const outputPath = path.join(directory, "existing.zip");
    const existingBytes = Buffer.from("previous export");
    await writeFile(outputPath, existingBytes);

    await expect(writeZip(outputPath, [
      { resultPath: path.join(directory, "missing.jpg"), fileName: "page.jpg" },
    ])).rejects.toMatchObject({ code: "EEXIST" });

    expect(await readFile(outputPath)).toEqual(existingBytes);
  });

  it("removes the partial archive if a later input cannot be read", async () => {
    const firstPath = path.join(directory, "first.jpg");
    const missingPath = path.join(directory, "missing.jpg");
    const outputPath = path.join(directory, "partial.zip");
    await writeFile(firstPath, "first page");

    await expect(writeZip(outputPath, [
      { resultPath: firstPath, fileName: "page-1.jpg" },
      { resultPath: missingPath, fileName: "page-2.jpg" },
    ])).rejects.toMatchObject({ code: "ENOENT", path: missingPath });

    await expect(stat(outputPath)).rejects.toMatchObject({ code: "ENOENT" });
    expect(await readFile(firstPath, "utf8")).toBe("first page");
  });
});
