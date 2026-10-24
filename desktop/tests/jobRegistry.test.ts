import { beforeEach, describe, expect, it, vi } from "vitest";

async function loadRegistry() {
  return import("../main/jobRegistry");
}

beforeEach(() => {
  vi.resetModules();
});

describe("jobRegistry", () => {
  it("starts idle", async () => {
    const { getJobState } = await loadRegistry();

    expect(getJobState()).toEqual({ status: "idle" });
  });

  it("registers a running job and returns its identifier", async () => {
    const { getJobState, startJob } = await loadRegistry();

    const jobId = startJob();

    expect(jobId).toEqual(expect.any(String));
    expect(jobId.length).toBeGreaterThan(0);
    expect(getJobState()).toEqual({ status: "running", jobId });
  });

  it("rejects another start without replacing the active job", async () => {
    const { getJobState, startJob } = await loadRegistry();
    const jobId = startJob();

    expect(() => startJob()).toThrow("A job is already running.");
    expect(getJobState()).toEqual({ status: "running", jobId });
  });

  it("returns a copy that cannot change the stored state", async () => {
    const { getJobState, startJob } = await loadRegistry();
    const jobId = startJob();
    const snapshot = getJobState();

    if (snapshot.status !== "running") {
      throw new Error("Expected a running job.");
    }

    snapshot.jobId = "changed-outside-registry";

    expect(getJobState()).toEqual({ status: "running", jobId });
    expect(getJobState()).not.toBe(snapshot);
  });

  it.each(["success", "failure"] as const)(
    "finishes the matching job with %s",
    async (outcome) => {
      const registry = await loadRegistry();
      const jobId = registry.startJob();

      const accepted =
        outcome === "success"
          ? registry.succeedJob(jobId, "result-123")
          : registry.failJob(jobId, "Conversion failed.");

      expect(accepted).toBe(true);
      expect(registry.getJobState()).toEqual(
        outcome === "success"
          ? { status: "succeeded", jobId, resultId: "result-123" }
          : { status: "failed", jobId, message: "Conversion failed." },
      );

      // Zakończonego zadania nie można zakończyć ponownie.
      const finishedState = registry.getJobState();
      expect(registry.succeedJob(jobId, "another-result")).toBe(false);
      expect(registry.failJob(jobId, "Late error")).toBe(false);
      expect(registry.getJobState()).toEqual(finishedState);
    },
  );

  it("ignores completion when no job is running", async () => {
    const registry = await loadRegistry();

    expect(registry.succeedJob("unknown", "result-123")).toBe(false);
    expect(registry.failJob("unknown", "Error")).toBe(false);
    expect(registry.getJobState()).toEqual({ status: "idle" });
  });

  it("ignores a foreign identifier while a job is running", async () => {
    const registry = await loadRegistry();
    const jobId = registry.startJob();

    expect(registry.succeedJob("foreign", "result-123")).toBe(false);
    expect(registry.failJob("foreign", "Error")).toBe(false);
    expect(registry.getJobState()).toEqual({ status: "running", jobId });
  });

  it("ignores an old completion after another job starts", async () => {
    const registry = await loadRegistry();
    const oldJobId = registry.startJob();
    registry.succeedJob(oldJobId, "old-result");

    const newJobId = registry.startJob();
    expect(newJobId).not.toBe(oldJobId);
    expect(registry.succeedJob(oldJobId, "late-result")).toBe(false);
    expect(registry.failJob(oldJobId, "Late error")).toBe(false);
    expect(registry.getJobState()).toEqual({
      status: "running",
      jobId: newJobId,
    });
  });
});
