import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MAX_SOURCE_BYTES } from "../../shared/conversionLimits";

const mocks = vi.hoisted(() => ({ getPath: vi.fn(), runConversionJob: vi.fn() }));
vi.mock("electron", () => ({ app: { getPath: mocks.getPath } }));
vi.mock("../main/runConversionJob", () => ({ runConversionJob: mocks.runConversionJob }));
import { copySourceFile } from "../main/copySourceFile";
import { prepareSource } from "../main/prepareSource";
import { clearSource, getCurrentSourceDirectory, getOriginalSourcePath, getSourcePath } from "../main/sourceRegistry";
import { failJob, getJobState, resetJob } from "../main/jobRegistry";
import { previewResponse } from "../main/previewResponse";
import { startConversion } from "../main/startConversion";

let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "easyconvert-copy-test-"));
  mocks.getPath.mockReturnValue(directory);
  mocks.runConversionJob.mockReset().mockResolvedValue(undefined);
  resetJob();
});

afterEach(async () => {
  const job = getJobState();
  if (job.status === "running") failJob(job.jobId, "test cleanup");
  resetJob();
  clearSource();
  await expect.poll(async () => (await readdir(directory)).some((name) => name.startsWith("easyconvert-source-")))
    .toBe(false);
  await rm(directory, { recursive: true, force: true });
});

it.each([1, MAX_SOURCE_BYTES])("copies exactly %i bytes into a separate owned directory", async (size) => {
  const original = path.join(directory, "Raport Łódź.txt");
  const bytes = Buffer.alloc(size, 65);
  await writeFile(original, bytes);
  const copy = await copySourceFile(original);

  expect(copy.path).not.toBe(original);
  expect(path.dirname(copy.directory)).toBe(directory);
  expect(path.basename(copy.path)).toBe(path.basename(original));
  expect(copy.sizeBytes).toBe(size);
  expect((await readFile(copy.path)).equals(bytes)).toBe(true);
  expect((await readFile(original)).equals(bytes)).toBe(true);
  await rm(copy.directory, { recursive: true, force: true });
});

it.each([0, MAX_SOURCE_BYTES + 1])("rejects %i bytes and removes the rejected copy", async (size) => {
  const original = path.join(directory, "invalid.txt");
  await writeFile(original, Buffer.alloc(size));
  await expect(copySourceFile(original)).rejects.toThrow(/empty|too large/);
  expect(await readdir(directory)).toEqual(["invalid.txt"]);
  expect((await stat(original)).size).toBe(size);
});

it("removes the allocated directory when the original cannot be read", async () => {
  await expect(copySourceFile(path.join(directory, "missing.txt"))).rejects.toMatchObject({ code: "ENOENT" });
  expect(await readdir(directory)).toEqual([]);
});

it.each(["changed", "deleted"])("previews and starts conversion from the copy after the original is %s", async (change) => {
  const original = path.join(directory, "report.txt");
  await writeFile(original, "selected contents");
  const source = await prepareSource(original);
  const copiedPath = getSourcePath(source.sourceId);
  const ownedDirectory = getCurrentSourceDirectory()!;

  if (change === "changed") await writeFile(original, "new contents");
  else await rm(original);

  expect(getOriginalSourcePath()).toBe(original);
  expect(await readFile(copiedPath, "utf8")).toBe("selected contents");
  const preview = await previewResponse(new Request(`app://easyconvert/preview/source/${source.sourceId}`));
  expect(await preview.text()).toBe("selected contents");
  const request = {
    sourceId: source.sourceId, conversion: "txt-to-pdf",
    options: { pageSize: "A4", pageOrientation: "portrait" },
  } as const;
  const onStateChanged = vi.fn();
  const { jobId } = startConversion(request, onStateChanged);
  expect(mocks.runConversionJob).toHaveBeenCalledExactlyOnceWith(jobId, copiedPath, onStateChanged, request);

  failJob(jobId, "test finished");
  clearSource();
  expect(() => getSourcePath(source.sourceId)).toThrow("Unknown source.");
  await expect.poll(async () => (await readdir(directory)).includes(path.basename(ownedDirectory))).toBe(false);
  if (change === "changed") expect(await readFile(original, "utf8")).toBe("new contents");
});

it("cleans the old copy when a new source replaces it and leaves both originals intact", async () => {
  const firstPath = path.join(directory, "first.txt");
  const secondPath = path.join(directory, "second.txt");
  await writeFile(firstPath, "first");
  await writeFile(secondPath, "second");
  const first = await prepareSource(firstPath);
  const previousDirectory = getCurrentSourceDirectory()!;
  const second = await prepareSource(secondPath);

  expect(() => getSourcePath(first.sourceId)).toThrow("Unknown source.");
  await expect.poll(async () => (await readdir(directory)).includes(path.basename(previousDirectory))).toBe(false);
  expect(await readFile(firstPath, "utf8")).toBe("first");
  expect(await readFile(secondPath, "utf8")).toBe("second");
  expect(await readFile(getSourcePath(second.sourceId), "utf8")).toBe("second");
});
