import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { replaceResultFile } from "../main/replaceResultFile";

let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "easyconvert-replace-test-"));
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

it.each([false, true])("exports complete bytes and cleans temporary files (existing=%s)", async (existing) => {
  const source = path.join(directory, "source.pdf");
  const destination = path.join(directory, "Raport Łódź.pdf");
  const bytes = Buffer.from([0, 255, 1, 128]);
  await writeFile(source, bytes);
  if (existing) await writeFile(destination, "previous PDF");

  await replaceResultFile(source, destination);

  expect(await readFile(destination)).toEqual(bytes);
  expect(await readFile(source)).toEqual(bytes);
  expect((await readdir(directory)).sort()).toEqual(["Raport Łódź.pdf", "source.pdf"]);
});

it("preserves the destination and cleans up when the source cannot be copied", async () => {
  const source = path.join(directory, "missing.pdf");
  const destination = path.join(directory, "report.pdf");
  await writeFile(destination, "previous PDF");

  await expect(replaceResultFile(source, destination)).rejects.toMatchObject({ code: "ENOENT" });

  expect(await readFile(destination, "utf8")).toBe("previous PDF");
  expect(await readdir(directory)).toEqual(["report.pdf"]);
});

it("cleans up after a failed replacement without deleting the occupied directory", async () => {
  const source = path.join(directory, "source.pdf");
  const destination = path.join(directory, "occupied");
  await writeFile(source, "new PDF");
  await mkdir(destination);
  const existingFile = path.join(destination, "keep.txt");
  await writeFile(existingFile, "keep this");

  await expect(replaceResultFile(source, destination)).rejects.toThrow();

  expect(await readFile(existingFile, "utf8")).toBe("keep this");
  expect(await readFile(source, "utf8")).toBe("new PDF");
  expect((await readdir(directory)).sort()).toEqual(["occupied", "source.pdf"]);
});
