import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { unzipSync } from "fflate";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getPath: vi.fn() }));
vi.mock("electron", () => ({ app: { getPath: mocks.getPath } }));
import { saveArchive, saveArchiveAs } from "../main/saveArchive";

let directory: string;
let inputPath: string;

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "easyconvert-archive-test-"));
  mocks.getPath.mockReturnValue(directory);
  inputPath = path.join(directory, "page.jpg");
  await writeFile(inputPath, "page bytes");
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

async function expectTemporaryArchiveRemoved() {
  expect((await readdir(directory)).filter((name) => name.startsWith("easyconvert-archive-")))
    .toEqual([]);
}

it("checks the export again after building the archive and preserves the destination on rejection", async () => {
  const destination = path.join(directory, "chosen.zip");
  await writeFile(destination, "previous archive");
  const error = new Error("Results expired");
  const beforeCopy = vi.fn().mockRejectedValue(error);

  await expect(saveArchiveAs(
    [{ resultPath: inputPath, fileName: "page.jpg" }], destination, beforeCopy,
  )).rejects.toBe(error);

  expect(beforeCopy).toHaveBeenCalledOnce();
  expect(await readFile(destination, "utf8")).toBe("previous archive");
  await expectTemporaryArchiveRemoved();
});

it("finishes the export before removing its temporary archive", async () => {
  const outputPath = await saveArchive(
    [{ resultPath: inputPath, fileName: "page-1.jpg" }],
    path.join(directory, "output"),
    "report.zip",
  );

  expect(outputPath).toBe(path.join(directory, "output", "report.zip"));
  const files = unzipSync(await readFile(outputPath));
  expect(Buffer.from(files["page-1.jpg"]!).toString()).toBe("page bytes");
  await expectTemporaryArchiveRemoved();
});

it("removes the temporary directory when reading an entry fails", async () => {
  await expect(saveArchive(
    [{ resultPath: path.join(directory, "missing.jpg"), fileName: "page.jpg" }],
    path.join(directory, "output"),
    "report.zip",
  )).rejects.toMatchObject({ code: "ENOENT" });

  await expectTemporaryArchiveRemoved();
});

it("removes the temporary archive when exporting fails", async () => {
  const blockedDirectory = path.join(directory, "blocked");
  await writeFile(blockedDirectory, "existing file");

  await expect(saveArchive(
    [{ resultPath: inputPath, fileName: "page.jpg" }],
    blockedDirectory,
    "report.zip",
  )).rejects.toMatchObject({ code: "EEXIST" });

  expect(await readFile(blockedDirectory, "utf8")).toBe("existing file");
  await expectTemporaryArchiveRemoved();
});
