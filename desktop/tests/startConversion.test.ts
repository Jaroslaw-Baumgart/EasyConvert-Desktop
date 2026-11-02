import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StartConversionRequest } from "../../shared/desktopContract";

const mocks = vi.hoisted(() => ({
  runConversionJob: vi.fn(),
}));

vi.mock("../main/runConversionJob", () => ({
  runConversionJob: mocks.runConversionJob,
}));

async function loadModules() {
  const sources = await import("../main/sourceRegistry");
  const jobs = await import("../main/jobRegistry");
  const results = await import("../main/resultRegistry");
  const { startConversion } = await import("../main/startConversion");

  return { sources, jobs, results, startConversion };
}

beforeEach(() => {
  vi.resetModules();
  mocks.runConversionJob.mockReset();
  mocks.runConversionJob.mockResolvedValue(undefined);
});

describe("startConversion", () => {
  it.each(["jpg-to-png", "png-to-jpg"] as const)(
    "publishes running and forwards the validated %s request",
    async (conversion) => {
      const { sources, jobs, results, startConversion } = await loadModules();

      const inputPath = conversion === "jpg-to-png" ? "photo.jpg" : "photo.png";
      const sourceId = sources.registerSource(inputPath);
      const previousResultId = results.registerResult("previous.png");

      const request: StartConversionRequest =
        conversion === "jpg-to-png"
          ? { sourceId, conversion }
          : {
              sourceId,
              conversion,
              options: {
                quality: 72,
                backgroundColor: "#123456",
              },
            };

      const onStateChanged = vi.fn(() => {
        expect(jobs.getJobState().status).toBe("running");
        expect(() => results.getResultPath(previousResultId)).toThrow();
        expect(mocks.runConversionJob).not.toHaveBeenCalled();
      });

      const response = startConversion(request, onStateChanged);

      expect(response).not.toBeInstanceOf(Promise);
      expect(jobs.getJobState()).toEqual({
        status: "running",
        jobId: response.jobId,
      });
      expect(onStateChanged).toHaveBeenCalledTimes(1);
      expect(mocks.runConversionJob).toHaveBeenCalledExactlyOnceWith(
        response.jobId,
        inputPath,
        onStateChanged,
        request,
      );
    },
  );

  it("returns without waiting for conversion", async () => {
    const { sources, jobs, startConversion } = await loadModules();
    const sourceId = sources.registerSource("photo.jpg");
    const onStateChanged = vi.fn();

    mocks.runConversionJob.mockReturnValue(new Promise<void>(() => {}));

    const response = startConversion(
      { sourceId, conversion: "jpg-to-png" },
      onStateChanged,
    );

    expect(response).not.toBeInstanceOf(Promise);
    expect(jobs.getJobState()).toEqual({
      status: "running",
      jobId: response.jobId,
    });
    expect(onStateChanged).toHaveBeenCalledTimes(1);
  });

  it.each([
    "invalid data",
    "invalid PNG options",
    "unknown source",
    "second start",
  ] as const)(
    "rejects %s without publishing or changing state",
    async (scenario) => {
      const { sources, jobs, results, startConversion } = await loadModules();

      const sourceId = sources.registerSource("photo.jpg");
      const resultId = results.registerResult("previous.png");
      const onStateChanged = vi.fn();

      if (scenario === "second start") {
        jobs.startJob();
      }

      const previousState = jobs.getJobState();

      const request =
        scenario === "invalid PNG options"
          ? {
              sourceId,
              conversion: "png-to-jpg",
              options: {
                quality: 0,
                backgroundColor: "#ffffff",
              },
            }
          : {
              sourceId: scenario === "unknown source" ? "unknown" : sourceId,
              conversion:
                scenario === "invalid data" ? "unsupported" : "jpg-to-png",
            };

      expect(() => startConversion(request, onStateChanged)).toThrow();

      expect(jobs.getJobState()).toEqual(previousState);
      expect(results.getResultPath(resultId)).toBe("previous.png");
      expect(onStateChanged).not.toHaveBeenCalled();
      expect(mocks.runConversionJob).not.toHaveBeenCalled();
    },
  );
});
