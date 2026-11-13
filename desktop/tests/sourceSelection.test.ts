import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BrowserWindow } from "electron";
import path from "node:path";

const mocks = vi.hoisted(() => ({
  showOpenDialog: vi.fn(),
  stat: vi.fn(),
  rm: vi.fn(),
  copySourceFile: vi.fn(),
}));

vi.mock("electron", () => ({
  dialog: { showOpenDialog: mocks.showOpenDialog },
}));

vi.mock("node:fs/promises", () => ({
  stat: mocks.stat,
  rm: mocks.rm,
}));

vi.mock("../main/copySourceFile", () => ({ copySourceFile: mocks.copySourceFile }));

import { selectSource } from "../main/selectSource";
import { failJob, getJobState, resetJob, startJob, succeedJob } from "../main/jobRegistry";
import { clearResult, getResultPath, registerResult } from "../main/resultRegistry";
import {
  clearSource,
  getSourcePath,
  registerSource,
} from "../main/sourceRegistry";

const owner = {} as BrowserWindow;
const previousPath = "C:/fixtures/previous.jpg";
const workingDirectory = "C:/working";
const copiedSource = {
  path: path.join(workingDirectory, "photo.jpg"),
  directory: workingDirectory,
  sizeBytes: 2048,
};
let previousId: string;

beforeEach(() => {
  vi.resetAllMocks();
  mocks.rm.mockResolvedValue(undefined);
  resetJob();
  clearResult();
  clearSource();
  previousId = registerSource(previousPath, previousPath, "previous-copy");
  mocks.copySourceFile.mockImplementation(async (sourcePath: string) => ({
    ...copiedSource,
    path: path.join(workingDirectory, path.basename(sourcePath)),
  }));

  mocks.showOpenDialog.mockResolvedValue({
    canceled: false,
    filePaths: ["C:/fixtures/photo.jpg"],
  });

  mocks.stat.mockResolvedValue({
    isFile: () => true,
    size: 2048,
  });
});

afterEach(() => {
  const job = getJobState();
  if (job.status === "running") failJob(job.jobId, "test cleanup");
  resetJob();
  clearSource();
});

describe("selectSource", () => {
  it("preserves the previous registration and results when making the copy fails", async () => {
    const resultId = registerResult("previous.png");
    const jobId = startJob();
    succeedJob(jobId, [resultId]);
    const state = getJobState();
    const error = new Error("Cannot copy source");
    mocks.copySourceFile.mockRejectedValueOnce(error);

    await expect(selectSource(owner)).rejects.toBe(error);
    expect(getSourcePath(previousId)).toBe(previousPath);
    expect(getResultPath(resultId)).toBe("previous.png");
    expect(getJobState()).toEqual(state);
  });

  it("rejects and removes the new copy if a conversion starts while copying", async () => {
    mocks.copySourceFile.mockImplementationOnce(async () => {
      startJob();
      return copiedSource;
    });

    await expect(selectSource(owner)).rejects.toThrow("A job is already running.");
    expect(getSourcePath(previousId)).toBe(previousPath);
    expect(getJobState().status).toBe("running");
    expect(mocks.rm).toHaveBeenCalledWith(workingDirectory, { recursive: true, force: true });
  });

  it.each(["photo.JPG", "photo.jpeg", "photo.JPEG"])(
    "accepts the supported source %s",
    async (name) => {
      const sourcePath = `C:/fixtures/${name}`;
      mocks.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [sourcePath] });

      const result = await selectSource(owner);

      expect(result).toMatchObject({ status: "selected", source: { name } });
      if (result.status !== "selected") throw new Error("Expected a selected source.");
      expect(getSourcePath(result.source.sourceId)).toBe(path.join(workingDirectory, name));
    },
  );

  it.each(["program.exe", "photo.jpg.exe", "document"])(
    "rejects %s before reading metadata and preserves the previous result",
    async (name) => {
      const resultId = registerResult("previous.png");
      const jobId = startJob();
      succeedJob(jobId, [resultId]);
      const previousState = getJobState();
      mocks.showOpenDialog.mockResolvedValue({
        canceled: false,
        filePaths: [`C:/fixtures/${name}`],
      });

      await expect(selectSource(owner)).rejects.toThrow("Unsupported file format:");

      expect(mocks.stat).not.toHaveBeenCalled();
      expect(getSourcePath(previousId)).toBe(previousPath);
      expect(getResultPath(resultId)).toBe("previous.png");
      expect(getJobState()).toEqual(previousState);
    },
  );

  it("returns metadata without exposing the path", async () => {
    const result = await selectSource(owner);

    expect(result).toEqual({
      status: "selected",
      source: {
        sourceId: expect.any(String),
        name: "photo.jpg",
        sizeBytes: 2048,
      },
    });

    expect(() => getSourcePath(previousId)).toThrow("Unknown source.");
  });

  it("preserves the previous source when cancelled", async () => {
    mocks.showOpenDialog.mockResolvedValue({
      canceled: true,
      filePaths: [],
    });

    await expect(selectSource(owner)).resolves.toEqual({ status: "cancelled" });

    expect(mocks.stat).not.toHaveBeenCalled();
    expect(getSourcePath(previousId)).toBe(previousPath);
  });

  it.each([
    {
      label: "directory",
      isFile: false,
      size: 2048,
      error: "Selected path is not a file.",
    },
    {
      label: "empty file",
      isFile: true,
      size: 0,
      error: "Selected file is empty.",
    },
    {
      label: "oversized file",
      isFile: true,
      size: 10_000_001,
      error: "Selected file is too large (max 10 MB).",
    },
  ])("rejects a $label without replacing the source", async (sample) => {
    mocks.stat.mockResolvedValue({
      isFile: () => sample.isFile,
      size: sample.size,
    });

    await expect(selectSource(owner)).rejects.toThrow(sample.error);
    expect(getSourcePath(previousId)).toBe(previousPath);
  });

  it("accepts a file exactly at the 10 MB limit", async () => {
    mocks.copySourceFile.mockResolvedValueOnce({ ...copiedSource, sizeBytes: 10_000_000 });
    mocks.stat.mockResolvedValue({
      isFile: () => true,
      size: 10_000_000,
    });

    await expect(selectSource(owner)).resolves.toMatchObject({
      status: "selected",
      source: { sizeBytes: 10_000_000 },
    });
  });

  it("preserves the previous source when reading metadata fails", async () => {
    const error = new Error("Cannot read file metadata");
    mocks.stat.mockRejectedValue(error);

    await expect(selectSource(owner)).rejects.toBe(error);
    expect(getSourcePath(previousId)).toBe(previousPath);
  });
});
