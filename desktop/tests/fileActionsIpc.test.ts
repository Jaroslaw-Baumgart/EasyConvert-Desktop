import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { BrowserWindow, IpcMainInvokeEvent } from "electron";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ handle: vi.fn(), showSaveDialog: vi.fn(), trusted: vi.fn(), getPath: vi.fn() }));
vi.mock("electron", () => ({ app: { getPath: mocks.getPath }, ipcMain: { handle: mocks.handle }, dialog: { showSaveDialog: mocks.showSaveDialog } }));
vi.mock("../main/assertTrustedSender", () => ({ assertTrustedSender: mocks.trusted }));
import { registerFileActionsIpc } from "../main/fileActionsIpc";
import { registerSource, clearSource, getSourcePath } from "../main/sourceRegistry";
import { registerResult, registerResults, clearResult, getResultPath } from "../main/resultRegistry";
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
  mocks.getPath.mockReturnValue(directory);
  sourcePath = path.join(directory, "source.jpg");
  resultPath = path.join(directory, "result.png");
  await writeFile(sourcePath, "source bytes"); await writeFile(resultPath, "PNG result");
  sourceId = registerSource(sourcePath); resultId = registerResult(resultPath);
  succeedJob(startJob(), [resultId]);
  registerFileActionsIpc({} as BrowserWindow, "app://easyconvert/");
});
afterEach(async () => {
  const job = getJobState(); if (job.status === "running") failJob(job.jobId, "test cleanup");
  resetJob(); clearSource(); clearResult();
  await rm(directory, { recursive: true, force: true });
});
describe("native file actions", () => {
  it("saves without a dialog and chooses a free name on the next save", async () => {
    const save = handler("easyconvert:save-result");
    await expect(save(event, resultId)).resolves.toEqual({ status: "saved" });
    await expect(save(event, resultId)).resolves.toEqual({ status: "saved" });
    const outputDirectory = path.join(directory, "EasyConvert Output");
    expect(await readFile(path.join(outputDirectory, "source.png"), "utf8")).toBe("PNG result");
    expect(await readFile(path.join(outputDirectory, "source (1).png"), "utf8")).toBe("PNG result");
    expect(mocks.getPath).toHaveBeenCalledWith("desktop");
    expect(mocks.showSaveDialog).not.toHaveBeenCalled();
    expect(getResultPath(resultId)).toBe(resultPath);
  });

  it.each([1, 2])("uses the original name for %i PDF page results in both save actions", async (pageCount) => {
    const originalName = "Raport Łódź.v2";
    sourcePath = path.join(directory, `${originalName}.pdf`);
    await writeFile(sourcePath, "original PDF");
    sourceId = registerSource(sourcePath);
    const pages = Array.from({ length: pageCount }, (_, index) =>
      path.join(directory, `page-${index + 10}.jpg`),
    );
    for (const [index, page] of pages.entries()) {
      await writeFile(page, `page ${index + 1}`);
    }
    const resultIds = registerResults(pages);
    succeedJob(startJob(), resultIds);

    for (const [index, id] of resultIds.entries()) {
      const fileName = pageCount === 1
        ? `${originalName}.jpg`
        : `${originalName}-page-${index + 1}.jpg`;
      const destination = path.join(directory, `chosen-${index}.jpg`);
      mocks.showSaveDialog.mockResolvedValue({ canceled: false, filePath: destination });

      await expect(handler("easyconvert:save-result-as")(event, id)).resolves.toEqual({ status: "saved" });
      expect(mocks.showSaveDialog).toHaveBeenLastCalledWith(expect.anything(), {
        defaultPath: fileName,
        filters: [{ name: "JPG file", extensions: ["jpg"] }],
        properties: ["showOverwriteConfirmation"],
      });
      expect(await readFile(destination, "utf8")).toBe(`page ${index + 1}`);

      await expect(handler("easyconvert:save-result")(event, id)).resolves.toEqual({ status: "saved" });
      expect(await readFile(path.join(directory, "EasyConvert Output", fileName), "utf8"))
        .toBe(`page ${index + 1}`);
      expect(getResultPath(id)).toBe(pages[index]);
    }
    expect(await readFile(sourcePath, "utf8")).toBe("original PDF");
  });

  it.each(["easyconvert:save-result", "easyconvert:save-result-as"])(
    "rejects a foreign result on %s", async (channel) => {
      await expect(handler(channel)(event, "foreign")).rejects.toThrow("Unknown result.");
      expect(mocks.getPath).not.toHaveBeenCalled();
      expect(mocks.showSaveDialog).not.toHaveBeenCalled();
    },
  );

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
    await expect(handler("easyconvert:save-result-as")(event, resultId)).resolves.toEqual({ status: "saved" });
    expect(mocks.showSaveDialog).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      defaultPath: "source.png",
      filters: [{ name: "PNG file", extensions: ["png"] }],
    }));
    expect(await readFile(destination, "utf8")).toBe("PNG result");
    expect(await readFile(sourcePath, "utf8")).toBe("source bytes");
  });
  it.each(["source", "result"])("refuses to overwrite the %s", async (kind) => {
    mocks.showSaveDialog.mockResolvedValue({ canceled: false, filePath: kind === "source" ? sourcePath : resultPath });
    await expect(handler("easyconvert:save-result-as")(event, resultId)).rejects.toThrow("Cannot overwrite");
    expect(await readFile(sourcePath, "utf8")).toBe("source bytes");
  });
  it("preserves the preview when saving is cancelled", async () => {
    mocks.showSaveDialog.mockResolvedValue({ canceled: true });
    await expect(handler("easyconvert:save-result-as")(event, resultId)).resolves.toEqual({ status: "cancelled" });
    expect(getResultPath(resultId)).toBe(resultPath);
  });
  it("rejects a result invalidated while the save dialog is open", async () => {
    mocks.showSaveDialog.mockImplementation(async () => {
      clearResult(); return { canceled: false, filePath: path.join(directory, "stale.png") };
    });
    await expect(handler("easyconvert:save-result-as")(event, resultId)).rejects.toThrow();
  });
  it("rejects foreign IDs and arguments before opening a dialog", async () => {
    expect(() => handler("easyconvert:reset-source")(event, "extra")).toThrow();
    await expect(handler("easyconvert:save-result-as")(event, "foreign")).rejects.toThrow();
    await expect(handler("easyconvert:save-result-as")(event, resultId, "extra")).rejects.toThrow();
    expect(mocks.showSaveDialog).not.toHaveBeenCalled();
  });
  it("checks the sender before any file operation", async () => {
    mocks.trusted.mockImplementation(() => { throw new Error("Unexpected sender"); });
    expect(() => handler("easyconvert:reset-source")(event)).toThrow("Unexpected sender");
    await expect(handler("easyconvert:save-result-as")(event, resultId)).rejects.toThrow("Unexpected sender");
    await expect(handler("easyconvert:save-result")(event, resultId)).rejects.toThrow("Unexpected sender");
    expect(mocks.showSaveDialog).not.toHaveBeenCalled();
  });
});
