import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StartConversionRequest } from "../../../shared/contracts/desktopContract";

const mocks = vi.hoisted(() => ({
  getPath: vi.fn(),
  mkdtemp: vi.fn(),
  stat: vi.fn(),
  rm: vi.fn(),
  runWorker: vi.fn(),
  getPdfPagePaths: vi.fn(),
  onStateChanged: vi.fn(),
}));

vi.mock("electron", () => ({
  app: { getPath: mocks.getPath },
}));

vi.mock("node:fs/promises", () => ({
  mkdtemp: mocks.mkdtemp,
  stat: mocks.stat,
  rm: mocks.rm,
}));

vi.mock("../../main/conversions/runConversionWorker", () => ({
  runConversionWorker: mocks.runWorker,
}));

vi.mock("../../../conversion-core/pdf/convertPdfToJpg", () => ({
  getPdfPagePaths: mocks.getPdfPagePaths,
}));

const jpgRequest: StartConversionRequest = {
  sourceId: "source-123",
  conversion: "jpg-to-png",
};

const successCases: {
  request: StartConversionRequest;
  inputPath: string;
  outputName: string;
}[] = [
  {
    request: { sourceId: "source-pdf", conversion: "pdf-to-txt" },
    inputPath: "C:/input/document.pdf",
    outputName: "result.txt",
  },
  {
    request: jpgRequest,
    inputPath: "C:/input/photo.jpg",
    outputName: "result.png",
  },
  {
    request: {
      sourceId: "source-123",
      conversion: "png-to-jpg",
      options: {
        quality: 72,
        backgroundColor: "#123456",
      },
    },
    inputPath: "C:/input/photo.png",
    outputName: "result.jpg",
  },
  {
    request: {
      sourceId: "source-123",
      conversion: "txt-to-pdf",
      options: {
        pageSize: "A3",
        pageOrientation: "landscape",
      },
    },
    inputPath: "C:/input/document.txt",
    outputName: "result.pdf",
  },
];

async function loadModules() {
  const jobs = await import("../../main/conversions/jobRegistry");
  const results = await import("../../main/results/resultRegistry");
  const { runConversionJob } = await import("../../main/conversions/runConversionJob");

  return { jobs, results, runConversionJob };
}

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();

  mocks.getPath.mockReturnValue("C:/temp");
  mocks.mkdtemp.mockResolvedValue("C:/temp/EasyConvert/easyconvert-job-test");
  mocks.runWorker.mockResolvedValue(undefined);
  mocks.rm.mockResolvedValue(undefined);
  mocks.stat.mockResolvedValue({
    isFile: () => true,
    size: 123,
  });
});

describe("runConversionJob", () => {
  it.each([104_857_600, 104_857_601])(
    "checks the output size boundary at %i bytes",
    async (size) => {
      const { jobs, results, runConversionJob } = await loadModules();
      const previousId = results.registerResult("previous.png", "previous-job");
      const jobId = jobs.startJob();
      mocks.stat.mockResolvedValue({ isFile: () => true, size });

      await runConversionJob(jobId, "input.jpg", mocks.onStateChanged, jpgRequest);

      const state = jobs.getJobState();
      if (size === 104_857_600) {
        expect(state.status).toBe("succeeded");
        if (state.status !== "succeeded") throw new Error("Expected success.");
        expect(results.getResultPath(state.resultIds[0]!)).toBe(
          path.join("C:/temp/EasyConvert/easyconvert-job-test", "result.png"),
        );
      } else {
        expect(state).toEqual({
          status: "failed", jobId, message: "Output file exceeds the size limit.",
        });
        expect(results.getResultPath(previousId)).toBe("previous.png");
      }
      expect(mocks.onStateChanged).toHaveBeenCalledTimes(1);
    },
  );

  it.each(successCases)(
    "registers $outputName and publishes success for $request.conversion",
    async ({ request, inputPath, outputName }) => {
      const { jobs, results, runConversionJob } = await loadModules();
      const jobId = jobs.startJob();
      const outputPath = path.join("C:/temp/EasyConvert/easyconvert-job-test", outputName);

      mocks.onStateChanged.mockImplementation(() => {
        expect(jobs.getJobState().status).toBe("succeeded");
      });

      await runConversionJob(jobId, inputPath, mocks.onStateChanged, request);

      expect(mocks.getPath).toHaveBeenCalledWith("temp");
      expect(mocks.mkdtemp).toHaveBeenCalledWith(
        path.join("C:/temp", "EasyConvert", "easyconvert-job-"),
      );
      expect(mocks.runWorker).toHaveBeenCalledExactlyOnceWith(
        inputPath,
        outputPath,
        request,
        undefined,
      );
      expect(mocks.stat).toHaveBeenCalledWith(outputPath);

      const state = jobs.getJobState();

      if (state.status !== "succeeded") {
        throw new Error("Expected success.");
      }

      expect(state.jobId).toBe(jobId);
      expect(state.resultIds).toHaveLength(1);
      expect(state.resultIds[0]).not.toBe(outputPath);
      expect(results.getResultPath(state.resultIds[0]!)).toBe(outputPath);
      expect(mocks.onStateChanged).toHaveBeenCalledTimes(1);
      expect(mocks.rm).not.toHaveBeenCalled();
      results.clearResult();
      expect(mocks.rm).toHaveBeenCalledExactlyOnceWith("C:/temp/EasyConvert/easyconvert-job-test", { recursive: true, force: true });
    },
  );

  it.each(["directory", "empty"] as const)(
    "rejects an invalid output and publishes failure: %s",
    async (kind) => {
      const { jobs, runConversionJob } = await loadModules();
      const jobId = jobs.startJob();

      mocks.stat.mockResolvedValue({
        isFile: () => kind !== "directory",
        size: kind === "empty" ? 0 : 123,
      });

      mocks.onStateChanged.mockImplementation(() => {
        expect(jobs.getJobState().status).toBe("failed");
      });

      await runConversionJob(
        jobId,
        "input.jpg",
        mocks.onStateChanged,
        jpgRequest,
      );

      expect(jobs.getJobState()).toEqual({
        status: "failed",
        jobId,
        message: "Output file is empty or not a file.",
      });
      expect(mocks.onStateChanged).toHaveBeenCalledTimes(1);
    },
  );

  it.each(["mkdtemp", "worker", "stat"] as const)(
    "publishes failure after a %s error",
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

      mocks.onStateChanged.mockImplementation(() => {
        expect(jobs.getJobState().status).toBe("failed");
      });

      await runConversionJob(
        jobId,
        "input.jpg",
        mocks.onStateChanged,
        jpgRequest,
      );

      expect(jobs.getJobState()).toEqual({
        status: "failed",
        jobId,
        message: error.message,
      });
      expect(mocks.onStateChanged).toHaveBeenCalledTimes(1);
      if (stage === "mkdtemp") expect(mocks.rm).not.toHaveBeenCalled();
      else expect(mocks.rm).toHaveBeenCalledExactlyOnceWith("C:/temp/EasyConvert/easyconvert-job-test", { recursive: true, force: true });
    },
  );

  it("uses a fallback message for a non-Error rejection", async () => {
    const { jobs, runConversionJob } = await loadModules();
    const jobId = jobs.startJob();

    mocks.runWorker.mockRejectedValue("unexpected rejection");

    await runConversionJob(
      jobId,
      "input.jpg",
      mocks.onStateChanged,
      jpgRequest,
    );

    expect(jobs.getJobState()).toEqual({
      status: "failed",
      jobId,
      message: "Conversion failed.",
    });
    expect(mocks.onStateChanged).toHaveBeenCalledTimes(1);
  });

  it.each(["success", "failure"] as const)(
    "ignores a late worker %s without publishing",
    async (outcome) => {
      const { jobs, results, runConversionJob } = await loadModules();
      const previousResultId = results.registerResult("previous.png", "previous-job");
      const oldJobId = jobs.startJob();
      let newJobId = "";

      mocks.runWorker.mockImplementation(async () => {
        jobs.failJob(oldJobId, "Old job ended.");
        newJobId = jobs.startJob();

        if (outcome === "failure") {
          throw new Error("Late worker error.");
        }
      });

      await runConversionJob(
        oldJobId,
        "input.jpg",
        mocks.onStateChanged,
        jpgRequest,
      );

      expect(jobs.getJobState()).toEqual({
        status: "running",
        jobId: newJobId,
      });
      expect(results.getResultPath(previousResultId)).toBe("previous.png");
      expect(mocks.onStateChanged).not.toHaveBeenCalled();
      expect(mocks.rm).toHaveBeenCalledExactlyOnceWith("C:/temp/EasyConvert/easyconvert-job-test", { recursive: true, force: true });
    },
  );
});

const pdfDirectory = path.resolve("temporary-pdf-job");
const pdfPages = [
  path.join(pdfDirectory, "page-1.jpg"),
  path.join(pdfDirectory, "page-2.jpg"),
];
const pdfRequest = { sourceId: "source-pdf", conversion: "pdf-to-jpg" } as const;

async function setupPdfJob() {
  const modules = await loadModules();
  mocks.mkdtemp.mockResolvedValue(pdfDirectory);
  mocks.getPdfPagePaths.mockResolvedValue(pdfPages);
  return { ...modules, jobId: modules.jobs.startJob(), publish: vi.fn() };
}

describe("PDF conversion job", () => {
  it("registers every page in order and publishes the complete result", async () => {
    const { jobs, results, runConversionJob, jobId, publish } = await setupPdfJob();

    await runConversionJob(jobId, "input.pdf", publish, pdfRequest);

    expect(mocks.runWorker).toHaveBeenCalledExactlyOnceWith(
      "input.pdf",
      pdfDirectory,
      pdfRequest,
      undefined,
    );
    expect(mocks.getPdfPagePaths).toHaveBeenCalledExactlyOnceWith(pdfDirectory);
    expect(mocks.stat).toHaveBeenCalledTimes(2);

    const state = jobs.getJobState();

    if (state.status !== "succeeded") {
      throw new Error("Expected success.");
    }

    expect(state.jobId).toBe(jobId);
    expect(state.resultIds).toHaveLength(2);
    expect(new Set(state.resultIds).size).toBe(2);
    expect(state.resultIds.map(results.getResultPath)).toEqual(pdfPages);
    expect(publish).toHaveBeenCalledTimes(1);
  });

  it.each([
    { size: 0, message: "Output file is empty or not a file." },
    { size: 104_857_601, message: "Output file exceeds the size limit." },
  ])("does not register a partial result when a later page has size $size", async ({ size, message }) => {
    const { jobs, results, runConversionJob, jobId, publish } = await setupPdfJob();
    const previousId = results.registerResult("previous.png", "previous-job");

    mocks.stat
      .mockResolvedValueOnce({ isFile: () => true, size: 123 })
      .mockResolvedValueOnce({ isFile: () => true, size });

    await runConversionJob(jobId, "input.pdf", publish, pdfRequest);

    expect(jobs.getJobState()).toEqual({
      status: "failed",
      jobId,
      message,
    });
    expect(results.getResultPath(previousId)).toBe("previous.png");
    expect(publish).toHaveBeenCalledTimes(1);
  });

  it("marks the job failed when collecting page paths fails", async () => {
    const { jobs, runConversionJob, jobId, publish } = await setupPdfJob();
    mocks.getPdfPagePaths.mockRejectedValue(
      new Error("PDF conversion produced no JPG files."),
    );

    await runConversionJob(jobId, "input.pdf", publish, pdfRequest);

    expect(jobs.getJobState()).toEqual({
      status: "failed",
      jobId,
      message: "PDF conversion produced no JPG files.",
    });
    expect(mocks.stat).not.toHaveBeenCalled();
    expect(publish).toHaveBeenCalledTimes(1);
  });

  it("ignores late pages after another job has started", async () => {
    const { jobs, results, runConversionJob, jobId, publish } = await setupPdfJob();
    const previousId = results.registerResult("previous.png", "previous-job");
    let nextJobId = "";

    mocks.runWorker.mockImplementation(async () => {
      jobs.failJob(jobId, "Previous job ended.");
      nextJobId = jobs.startJob();
    });

    await runConversionJob(jobId, "input.pdf", publish, pdfRequest);

    expect(jobs.getJobState()).toEqual({
      status: "running",
      jobId: nextJobId,
    });
    expect(results.getResultPath(previousId)).toBe("previous.png");
    expect(publish).not.toHaveBeenCalled();
  });
});


it.each(["before start", "worker", "output validation"])("publishes cancelled without registering results: %s", async (stage) => {
  const { jobs, results, runConversionJob } = await loadModules();
  const previousId = results.registerResult("previous.png", "previous-job");
  const jobId = jobs.startJob();
  const controller = new AbortController();
  if (stage === "before start") controller.abort();
  if (stage === "worker") mocks.runWorker.mockImplementation(async () => {
    controller.abort();
    throw controller.signal.reason;
  });
  if (stage === "output validation") mocks.stat.mockImplementation(async () => {
    controller.abort();
    return { isFile: () => true, size: 10 };
  });
  await runConversionJob(jobId, "input.jpg", mocks.onStateChanged, jpgRequest, controller.signal);
  expect(jobs.getJobState()).toEqual({ status: "cancelled", jobId });
  expect(results.getResultPath(previousId)).toBe("previous.png");
  expect(mocks.onStateChanged).toHaveBeenCalledOnce();
  if (stage === "before start") {
    expect(mocks.rm).not.toHaveBeenCalled();
    expect(mocks.mkdtemp).not.toHaveBeenCalled();
    expect(mocks.runWorker).not.toHaveBeenCalled();
  } else {
    expect(mocks.rm).toHaveBeenCalledExactlyOnceWith("C:/temp/EasyConvert/easyconvert-job-test", { recursive: true, force: true });
    expect(mocks.runWorker).toHaveBeenCalledExactlyOnceWith(
      "input.jpg", path.join("C:/temp/EasyConvert/easyconvert-job-test", "result.png"), jpgRequest, controller.signal,
    );
  }
});


it("reports a stopping failure as failed even when cancellation was requested", async () => {
  const { jobs, runConversionJob } = await loadModules();
  const jobId = jobs.startJob();
  const controller = new AbortController();
  mocks.runWorker.mockImplementation(async () => {
    controller.abort();
    throw new Error("Could not stop process tree");
  });
  await runConversionJob(jobId, "input.jpg", mocks.onStateChanged, jpgRequest, controller.signal);
  expect(jobs.getJobState()).toEqual({ status: "failed", jobId, message: "Could not stop process tree" });
  expect(mocks.onStateChanged).toHaveBeenCalledOnce();
});


it("logs cleanup failure without replacing the conversion failure", async () => {
  const { jobs, runConversionJob } = await loadModules();
  const jobId = jobs.startJob();
  const cleanupError = new Error("Directory locked");
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.runWorker.mockRejectedValue(new Error("Worker failed"));
  mocks.rm.mockRejectedValue(cleanupError);
  try {
    await expect(runConversionJob(jobId, "input.jpg", mocks.onStateChanged, jpgRequest)).resolves.toBeUndefined();
    expect(jobs.getJobState()).toEqual({ status: "failed", jobId, message: "Worker failed" });
    expect(log).toHaveBeenCalledExactlyOnceWith("Could not remove the job directory.", cleanupError);
  } finally {
    log.mockRestore();
  }
});
