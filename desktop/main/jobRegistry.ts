import { randomUUID } from "node:crypto";
import type { ConversionJobState } from "../../shared/desktopContract";

let currentJob: ConversionJobState = { status: "idle" };

export function resetJob(): void {
  if (currentJob.status === "running")
    throw new Error("A job is already running.");
  currentJob = { status: "idle" };
}

export function getJobState(): ConversionJobState {
  if (currentJob.status === "succeeded") {
    return {
      ...currentJob,
      resultIds: [...currentJob.resultIds],
    };
  }

  return { ...currentJob };
}

export function startJob(): string {
  if (currentJob.status === "running") {
    throw new Error("A job is already running.");
  }
  const jobId = randomUUID();
  currentJob = { status: "running", jobId };
  return jobId;
}

export function succeedJob(
  jobId: string,
  resultIds: readonly string[],
): boolean {
  if (currentJob.status !== "running" || currentJob.jobId !== jobId) {
    return false;
  } else {
    currentJob = { status: "succeeded", jobId, resultIds: [...resultIds] };
    return true;
  }
}

export function failJob(jobId: string, message: string): boolean {
  if (currentJob.status !== "running" || currentJob.jobId !== jobId) {
    return false;
  } else {
    currentJob = { status: "failed", jobId, message };
    return true;
  }
}
