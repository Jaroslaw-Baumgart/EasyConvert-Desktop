import { randomUUID } from "node:crypto";
import type { ConversionJobState } from "../../shared/desktopContract";

let currentJob: ConversionJobState = { status: "idle" };

export function resetJob(): void {
  if (currentJob.status === "running") throw new Error("A job is already running.");
  currentJob = { status: "idle" };
}

export function getJobState(): ConversionJobState {
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

export function succeedJob(jobId: string, resultId: string): boolean {
  if (currentJob.status !== "running" || currentJob.jobId !== jobId) {
    return false;
  } else {
    currentJob = { status: "succeeded", jobId, resultId };
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
