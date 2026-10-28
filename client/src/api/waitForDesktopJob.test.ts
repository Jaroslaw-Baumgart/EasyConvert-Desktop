import { describe, expect, it, vi } from "vitest";
import type {
  ConversionJobState,
  EasyConvertApi,
} from "../../../shared/desktopContract";
import { waitForDesktopJob } from "./waitForDesktopJob";

function setup(
  initialState: ConversionJobState = {
    status: "running",
    jobId: "job-1",
  },
) {
  const listeners = new Set<(state: ConversionJobState) => void>();
  const unsubscribe = vi.fn();

  const api: EasyConvertApi = {
    platform: "desktop",
    selectSource: vi.fn(),
    startConversion: vi.fn(),
    resetSource: vi.fn(),
    saveResult: vi.fn(),
    getJobState: vi
      .fn<EasyConvertApi["getJobState"]>()
      .mockResolvedValue(initialState),
    onJobStateChanged: vi.fn<EasyConvertApi["onJobStateChanged"]>(
      (callback) => {
        listeners.add(callback);

        return () => {
          listeners.delete(callback);
          unsubscribe();
        };
      },
    ),
  };

  function emit(state: ConversionJobState) {
    listeners.forEach((listener) => listener(state));
  }

  return { api, emit, unsubscribe, listeners };
}

describe("waitForDesktopJob", () => {
  it("returns the result ID after a success notification", async () => {
    const { api, emit, unsubscribe, listeners } = setup();
    const completion = waitForDesktopJob(api, "job-1");

    emit({
      status: "succeeded",
      jobId: "job-1",
      resultId: "result-1",
    });

    await expect(completion).resolves.toBe("result-1");
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(listeners.size).toBe(0);
  });

  it("reads success that happened before subscription", async () => {
    const { api, unsubscribe } = setup({
      status: "succeeded",
      jobId: "job-1",
      resultId: "result-1",
    });

    await expect(waitForDesktopJob(api, "job-1")).resolves.toBe("result-1");
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("ignores idle and foreign job notifications", async () => {
    const { api, emit, unsubscribe } = setup();
    let settled = false;
    const completion = waitForDesktopJob(api, "job-1");

    void completion.then(() => {
      settled = true;
    });

    emit({ status: "idle" });
    emit({
      status: "succeeded",
      jobId: "foreign",
      resultId: "wrong-result",
    });

    await Promise.resolve();

    expect(settled).toBe(false);
    expect(unsubscribe).not.toHaveBeenCalled();

    emit({
      status: "succeeded",
      jobId: "job-1",
      resultId: "correct-result",
    });

    await expect(completion).resolves.toBe("correct-result");
  });

  it("rejects a failed job and unsubscribes", async () => {
    const { api, emit, unsubscribe } = setup();
    const completion = waitForDesktopJob(api, "job-1");
    const assertion = expect(completion).rejects.toThrow("Conversion failed.");

    emit({
      status: "failed",
      jobId: "job-1",
      message: "Conversion failed.",
    });

    await assertion;
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("rejects a cancelled job and unsubscribes", async () => {
    const { api, unsubscribe } = setup({
      status: "cancelled",
      jobId: "job-1",
    });

    await expect(waitForDesktopJob(api, "job-1")).rejects.toThrow(
      "Conversion cancelled.",
    );
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it.each<ConversionJobState>([
    { status: "idle" },
    { status: "running", jobId: "another-job" },
  ])("rejects an unavailable job: $status", async (state) => {
    const { api, unsubscribe } = setup(state);

    await expect(waitForDesktopJob(api, "job-1")).rejects.toThrow(
      "Job is no longer available.",
    );
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("unsubscribes when reading the current state fails", async () => {
    const { api, unsubscribe } = setup();
    const error = new Error("IPC failed.");

    vi.mocked(api.getJobState).mockRejectedValue(error);

    await expect(waitForDesktopJob(api, "job-1")).rejects.toBe(error);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("rejects an already aborted signal without subscribing", async () => {
    const { api } = setup();
    const controller = new AbortController();
    const reason = new Error("Already cancelled.");

    controller.abort(reason);

    await expect(
      waitForDesktopJob(api, "job-1", controller.signal),
    ).rejects.toBe(reason);

    expect(api.onJobStateChanged).not.toHaveBeenCalled();
    expect(api.getJobState).not.toHaveBeenCalled();
  });

  it("aborts waiting and removes both listeners", async () => {
    const { api, unsubscribe, listeners } = setup();
    const controller = new AbortController();
    const removeListener = vi.spyOn(controller.signal, "removeEventListener");
    const reason = new Error("User cancelled.");

    const completion = waitForDesktopJob(api, "job-1", controller.signal);
    const assertion = expect(completion).rejects.toBe(reason);

    controller.abort(reason);

    await assertion;
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(listeners.size).toBe(0);
    expect(removeListener).toHaveBeenCalledExactlyOnceWith(
      "abort",
      expect.any(Function),
    );
  });

  it("removes the abort listener after success", async () => {
    const { api, emit, unsubscribe } = setup();
    const controller = new AbortController();
    const removeListener = vi.spyOn(controller.signal, "removeEventListener");

    const completion = waitForDesktopJob(api, "job-1", controller.signal);

    emit({
      status: "succeeded",
      jobId: "job-1",
      resultId: "result-1",
    });

    await expect(completion).resolves.toBe("result-1");

    expect(removeListener).toHaveBeenCalledExactlyOnceWith(
      "abort",
      expect.any(Function),
    );

    controller.abort();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
