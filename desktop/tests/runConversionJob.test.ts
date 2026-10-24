import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPath: vi.fn(),
  mkdtemp: vi.fn(),
  stat: vi.fn(),
  runWorker: vi.fn(),
}));

vi.mock("electron", () => ({
  app: { getPath: mocks.getPath },
}));

vi.mock("node:fs/promises", () => ({
  mkdtemp: mocks.mkdtemp,
  stat: mocks.stat,
}));

vi.mock("../main/runJpgToPngWorker", () => ({
  runJpgToPngWorker: mocks.runWorker,
}));

async function loadModules() {
  const jobs = await import("../main/jobRegistry");
  const results = await import("../main/resultRegistry");
  const { runConversionJob } = await import("../main/runConversionJob");

  return { jobs, results, runConversionJob };
}

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();

  mocks.getPath.mockReturnValue("C:/temp");
  mocks.mkdtemp.mockResolvedValue("C:/temp/easyconvert-job-test");
  mocks.runWorker.mockResolvedValue(undefined);
  mocks.stat.mockResolvedValue({
    isFile: () => true,
    size: 123,
  });
});

describe("runConversionJob", () => {
  it("registers the generated file and completes the job", async () => {
    const { jobs, results, runConversionJob } = await loadModules();
    const jobId = jobs.startJob();
    const outputPath = path.join("C:/temp/easyconvert-job-test", "result.png");

    await runConversionJob(jobId, "C:/input/photo.jpg");

    expect(mocks.getPath).toHaveBeenCalledWith("temp");
    expect(mocks.mkdtemp).toHaveBeenCalledWith(
      path.join("C:/temp", "easyconvert-job-"),
    );
    expect(mocks.runWorker).toHaveBeenCalledWith(
      "C:/input/photo.jpg",
      outputPath,
    );
    expect(mocks.stat).toHaveBeenCalledWith(outputPath);

    const state = jobs.getJobState();
    expect(state.status).toBe("succeeded");

    if (state.status !== "succeeded") {
      throw new Error("Expected success.");
    }

    expect(state.jobId).toBe(jobId);
    expect(state.resultId).not.toBe(outputPath);
    expect(results.getResultPath(state.resultId)).toBe(outputPath);
  });

  it.each(["directory", "empty"] as const)(
    "rejects an invalid output: %s",
    async (kind) => {
      const { jobs, runConversionJob } = await loadModules();
      const jobId = jobs.startJob();

      mocks.stat.mockResolvedValue({
        isFile: () => kind !== "directory",
        size: kind === "empty" ? 0 : 123,
      });

      await runConversionJob(jobId, "input.jpg");

      expect(jobs.getJobState()).toEqual({
        status: "failed",
        jobId,
        message: "Output file is empty or not a file.",
      });
    },
  );

  it.each(["mkdtemp", "worker", "stat"] as const)(
    "marks the job failed after a %s error",
    async (stage) => {
      const { jobs, runConversionJob } = await loadModules();
      const jobId = jobs.startJob();
      const error = new Error(`${stage} failed`);

      if (stage === "mkdtemp") {
        mocks.mkdtemp.mockRejectedValue(error);
      } else if (stage === "worker") {
        mocks.runWorker.mockRejectedValue(error);
      } else {
        mocks.stat.mockRejectedValue(error);
      }

      await runConversionJob(jobId, "input.jpg");

      expect(jobs.getJobState()).toEqual({
        status: "failed",
        jobId,
        message: error.message,
      });
    },
  );

  it("uses a fallback message for a non-Error rejection", async () => {
    const { jobs, runConversionJob } = await loadModules();
    const jobId = jobs.startJob();
    mocks.runWorker.mockRejectedValue("unexpected rejection");

    await runConversionJob(jobId, "input.jpg");

    expect(jobs.getJobState()).toEqual({
      status: "failed",
      jobId,
      message: "Conversion failed.",
    });
  });

  it.each(["success", "failure"] as const)(
    "ignores a late worker %s without replacing the current result",
    async (outcome) => {
      const { jobs, results, runConversionJob } = await loadModules();
      const previousResultId = results.registerResult("previous.png");
      const oldJobId = jobs.startJob();
      let newJobId = "";

      mocks.runWorker.mockImplementation(async () => {
        jobs.failJob(oldJobId, "Old job ended.");
        newJobId = jobs.startJob();

        if (outcome === "failure") {
          throw new Error("Late worker error.");
        }
      });

      await runConversionJob(oldJobId, "input.jpg");

      expect(jobs.getJobState()).toEqual({
        status: "running",
        jobId: newJobId,
      });
      expect(results.getResultPath(previousResultId)).toBe("previous.png");
    },
  );
});
