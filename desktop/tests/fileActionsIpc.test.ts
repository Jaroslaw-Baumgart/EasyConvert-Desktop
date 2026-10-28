import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { BrowserWindow, IpcMainInvokeEvent } from "electron";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ handle: vi.fn(), showSaveDialog: vi.fn(), trusted: vi.fn() }));
vi.mock("electron", () => ({ ipcMain: { handle: mocks.handle }, dialog: { showSaveDialog: mocks.showSaveDialog } }));
vi.mock("../main/assertTrustedSender", () => ({ assertTrustedSender: mocks.trusted }));
import { registerFileActionsIpc } from "../main/fileActionsIpc";
import { registerSource, clearSource, getSourcePath } from "../main/sourceRegistry";
import { registerResult, clearResult, getResultPath } from "../main/resultRegistry";
import { startJob, succeedJob, failJob, resetJob, getJobState } from "../main/jobRegistry";
let directory: string;
let sourceId: string;
let resultId: string;
let sourcePath: string;
let resultPath: string;
type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown;
const event = {} as IpcMainInvokeEvent;
function handler(channel: string): Handler {
  return mocks.handle.mock.calls.find(([name]) => name === channel)![1];
}
beforeEach(async () => {
  vi.resetAllMocks();
  resetJob(); clearSource(); clearResult();
  directory = await mkdtemp(path.join(os.tmpdir(), "easyconvert-actions-test-"));
  sourcePath = path.join(directory, "source.jpg");
  resultPath = path.join(directory, "result.png");
  await writeFile(sourcePath, "source bytes"); await writeFile(resultPath, "PNG result");
  sourceId = registerSource(sourcePath); resultId = registerResult(resultPath);
  succeedJob(startJob(), resultId);
  registerFileActionsIpc({} as BrowserWindow, "app://easyconvert/");
});
afterEach(async () => {
  const job = getJobState(); if (job.status === "running") failJob(job.jobId, "test cleanup");
  resetJob(); clearSource(); clearResult();
  await rm(directory, { recursive: true, force: true });
});
describe("native file actions", () => {
  it("resets source/result identifiers without deleting their files", async () => {
    handler("easyconvert:reset-source")(event);
    expect(() => getSourcePath(sourceId)).toThrow(); expect(() => getResultPath(resultId)).toThrow();
    expect(getJobState()).toEqual({ status: "idle" });
    expect(await readFile(sourcePath, "utf8")).toBe("source bytes");
    expect(await readFile(resultPath, "utf8")).toBe("PNG result");
  });
  it("does not reset a running conversion", () => {
    startJob();
    expect(() => handler("easyconvert:reset-source")(event)).toThrow("already running");
    expect(getSourcePath(sourceId)).toBe(sourcePath);
  });
  it("copies the result only to the dialog-approved destination", async () => {
    const destination = path.join(directory, "export.png");
    mocks.showSaveDialog.mockResolvedValue({ canceled: false, filePath: destination });
    await expect(handler("easyconvert:save-result")(event, resultId)).resolves.toEqual({ status: "saved" });
    expect(await readFile(destination, "utf8")).toBe("PNG result");
    expect(await readFile(sourcePath, "utf8")).toBe("source bytes");
  });
  it.each(["source", "result"])("refuses to overwrite the %s", async (kind) => {
    mocks.showSaveDialog.mockResolvedValue({ canceled: false, filePath: kind === "source" ? sourcePath : resultPath });
    await expect(handler("easyconvert:save-result")(event, resultId)).rejects.toThrow("Cannot overwrite");
    expect(await readFile(sourcePath, "utf8")).toBe("source bytes");
  });
  it("preserves the preview when saving is cancelled", async () => {
    mocks.showSaveDialog.mockResolvedValue({ canceled: true });
    await expect(handler("easyconvert:save-result")(event, resultId)).resolves.toEqual({ status: "cancelled" });
    expect(getResultPath(resultId)).toBe(resultPath);
  });
  it("rejects a result invalidated while the save dialog is open", async () => {
    mocks.showSaveDialog.mockImplementation(async () => {
      clearResult(); return { canceled: false, filePath: path.join(directory, "stale.png") };
    });
    await expect(handler("easyconvert:save-result")(event, resultId)).rejects.toThrow();
  });
  it("rejects foreign IDs and arguments before opening a dialog", async () => {
    expect(() => handler("easyconvert:reset-source")(event, "extra")).toThrow();
    await expect(handler("easyconvert:save-result")(event, "foreign")).rejects.toThrow();
    await expect(handler("easyconvert:save-result")(event, resultId, "extra")).rejects.toThrow();
    expect(mocks.showSaveDialog).not.toHaveBeenCalled();
  });
  it("checks the sender before any file operation", async () => {
    mocks.trusted.mockImplementation(() => { throw new Error("Unexpected sender"); });
    expect(() => handler("easyconvert:reset-source")(event)).toThrow("Unexpected sender");
    await expect(handler("easyconvert:save-result")(event, resultId)).rejects.toThrow("Unexpected sender");
    expect(mocks.showSaveDialog).not.toHaveBeenCalled();
  });
});
