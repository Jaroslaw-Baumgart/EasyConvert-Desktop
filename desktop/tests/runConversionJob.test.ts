import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StartConversionRequest } from "../../shared/desktopContract";

const mocks = vi.hoisted(() => ({
  getPath: vi.fn(),
  mkdtemp: vi.fn(),
  stat: vi.fn(),
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
}));

vi.mock("../main/runConversionWorker", () => ({
  runConversionWorker: mocks.runWorker,
}));

vi.mock("../../conversion-core/pdf/convertPdfToJpg", () => ({
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
      conversion: "jpg-to-pdf",
      options: {
        pageSize: "A3",
        pageOrientation: "landscape",
      },
    },
    inputPath: "C:/input/photo.jpg",
    outputName: "result.pdf",
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
  {
    request: {
      sourceId: "source-csv",
      conversion: "csv-to-pdf",
      options: {
        pageSize: "A3",
        pageOrientation: "landscape",
      },
    },
    inputPath: "C:/input/table.csv",
    outputName: "result.pdf",
  },
];

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
  it.each(successCases)(
    "registers $outputName and publishes success for $request.conversion",
    async ({ request, inputPath, outputName }) => {
      const { jobs, results, runConversionJob } = await loadModules();
      const jobId = jobs.startJob();
      const outputPath = path.join("C:/temp/easyconvert-job-test", outputName);

      mocks.onStateChanged.mockImplementation(() => {
        expect(jobs.getJobState().status).toBe("succeeded");
      });

      await runConversionJob(jobId, inputPath, mocks.onStateChanged, request);

      expect(mocks.getPath).toHaveBeenCalledWith("temp");
      expect(mocks.mkdtemp).toHaveBeenCalledWith(
        path.join("C:/temp", "easyconvert-job-"),
      );
      expect(mocks.runWorker).toHaveBeenCalledExactlyOnceWith(
        inputPath,
        outputPath,
        request,
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

  it("does not register a partial result when a later page is empty", async () => {
    const { jobs, results, runConversionJob, jobId, publish } = await setupPdfJob();
    const previousId = results.registerResult("previous.png");

    mocks.stat
      .mockResolvedValueOnce({ isFile: () => true, size: 123 })
      .mockResolvedValueOnce({ isFile: () => true, size: 0 });

    await runConversionJob(jobId, "input.pdf", publish, pdfRequest);

    expect(jobs.getJobState()).toEqual({
      status: "failed",
      jobId,
      message: "Output file is empty or not a file.",
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
    const previousId = results.registerResult("previous.png");
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
