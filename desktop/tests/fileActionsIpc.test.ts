import { mkdtemp, writeFile, readFile, readdir, rm } from "node:fs/promises";
import { unzipSync } from "fflate";
import os from "node:os";
import path from "node:path";
import type { BrowserWindow, IpcMainInvokeEvent } from "electron";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ handle: vi.fn(), showSaveDialog: vi.fn(), trusted: vi.fn(), getPath: vi.fn(), showItemInFolder: vi.fn() }));
vi.mock("electron", () => ({ shell: { showItemInFolder: mocks.showItemInFolder }, app: { getPath: mocks.getPath }, ipcMain: { handle: mocks.handle }, dialog: { showSaveDialog: mocks.showSaveDialog } }));
vi.mock("../main/assertTrustedSender", () => ({ assertTrustedSender: mocks.trusted }));
import { registerFileActionsIpc } from "../main/fileActionsIpc";
import * as resultFiles from "../main/saveResultFile";
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
  vi.restoreAllMocks();
  const job = getJobState(); if (job.status === "running") failJob(job.jobId, "test cleanup");
  resetJob(); clearSource(); clearResult();
  await rm(directory, { recursive: true, force: true });
});
describe("native file actions", () => {
  it.each([
    ["ENOSPC", "disk-full"],
    ["EACCES", "permission-denied"],
    ["EPERM", "permission-denied"],
    ["EIO", "save-failed"],
  ])("reports %s and permits a successful retry", async (systemCode, code) => {
    const save = handler("easyconvert:save-result");
    vi.spyOn(resultFiles, "saveResultFile").mockRejectedValueOnce(
      Object.assign(new Error("Simulated write failure"), { code: systemCode }),
    );

    await expect(save(event, resultId)).resolves.toEqual({ status: "failed", code });
    expect(getResultPath(resultId)).toBe(resultPath);
    expect(await readFile(resultPath, "utf8")).toBe("PNG result");
    await expect(save(event, resultId)).resolves.toEqual({ status: "saved", fileName: "source.png" });
    expect(await readFile(path.join(directory, "EasyConvert Output", "source.png"), "utf8"))
      .toBe("PNG result");
  });

  it("saves an archive to the dialog-approved destination and allows confirmed overwrite", async () => {
    const destination = path.join(directory, "chosen.zip");
    await writeFile(destination, "previous archive");
    mocks.showSaveDialog.mockResolvedValue({ canceled: false, filePath: destination });

    await expect(handler("easyconvert:save-archive")(event, [resultId], true))
      .resolves.toEqual({ status: "saved", fileName: path.basename(destination) });

    expect(mocks.showSaveDialog).toHaveBeenCalledWith(expect.anything(), {
      defaultPath: "source.zip",
      filters: [{ name: "ZIP archive", extensions: ["zip"] }],
      properties: ["showOverwriteConfirmation"],
    });
    const files = unzipSync(await readFile(destination));
    expect(Object.keys(files)).toEqual(["source.png"]);
    expect(Buffer.from(files["source.png"]!).toString()).toBe("PNG result");
    expect((await readdir(directory)).filter((name) => name.startsWith("easyconvert-archive-"))).toEqual([]);
    expect(getResultPath(resultId)).toBe(resultPath);
  });

  it("does not create an archive when its save dialog is cancelled", async () => {
    mocks.showSaveDialog.mockResolvedValue({ canceled: true });
    await expect(handler("easyconvert:save-archive")(event, [resultId], true))
      .resolves.toEqual({ status: "cancelled" });
    expect((await readdir(directory)).filter((name) => name.endsWith(".zip") || name.startsWith("easyconvert-archive-")))
      .toEqual([]);
    expect(getResultPath(resultId)).toBe(resultPath);
  });

  it.each(["source", "result"])("protects the %s when choosing an archive destination", async (kind) => {
    mocks.showSaveDialog.mockResolvedValue({ canceled: false, filePath: kind === "source" ? sourcePath : resultPath });
    await expect(handler("easyconvert:save-archive")(event, [resultId], true))
      .resolves.toEqual({ status: "failed", code: "save-failed" });
    expect(await readFile(sourcePath, "utf8")).toBe("source bytes");
    expect(await readFile(resultPath, "utf8")).toBe("PNG result");
  });

  it("preserves the destination when results expire while the archive dialog is open", async () => {
    const destination = path.join(directory, "existing.zip");
    await writeFile(destination, "previous bytes");
    mocks.showSaveDialog.mockImplementation(async () => {
      resetJob();
      return { canceled: false, filePath: destination };
    });
    await expect(handler("easyconvert:save-archive")(event, [resultId], true))
      .resolves.toEqual({ status: "failed", code: "save-failed" });
    expect(await readFile(destination, "utf8")).toBe("previous bytes");
  });

  it("saves an archive with ordered page names, handles a collision and cleans temporary files", async () => {
    sourcePath = path.join(directory, "Raport Łódź.pdf");
    await writeFile(sourcePath, "source PDF");
    registerSource(sourcePath);
    const pages = [path.join(directory, "page-09.jpg"), path.join(directory, "page-01.jpg")];
    await writeFile(pages[0]!, "first page");
    await writeFile(pages[1]!, "second page");
    const ids = registerResults(pages);
    succeedJob(startJob(), ids);

    for (const name of ["Raport Łódź.zip", "Raport Łódź (1).zip"]) {
      await expect(handler("easyconvert:save-archive")(event, ids)).resolves.toEqual({ status: "saved", fileName: name });
      const files = unzipSync(await readFile(path.join(directory, "EasyConvert Output", name)));
      expect(Object.keys(files)).toEqual(["Raport Łódź-page-1.jpg", "Raport Łódź-page-2.jpg"]);
      expect(Buffer.from(files["Raport Łódź-page-1.jpg"]!).toString()).toBe("first page");
      expect(Buffer.from(files["Raport Łódź-page-2.jpg"]!).toString()).toBe("second page");
    }
    expect((await readdir(directory)).filter((name) => name.startsWith("easyconvert-archive-"))).toEqual([]);
    expect(mocks.showSaveDialog).not.toHaveBeenCalled();
    expect(ids.map(getResultPath)).toEqual(pages);
  });

  it.each(["missing", "not an array", "foreign", "partial", "reversed", "sparse", "running", "invalid mode"])(
    "rejects an archive request with %s results before file operations", async (scenario) => {
      const ids = registerResults([resultPath, path.join(directory, "another.jpg")]);
      succeedJob(startJob(), ids);
      if (scenario === "running") startJob();
      const args = scenario === "invalid mode" ? [ids, "yes"] : scenario === "missing" ? [] : [
        scenario === "not an array" ? "wrong" :
        scenario === "foreign" ? ["foreign", ids[1]] :
        scenario === "partial" ? [ids[0]] :
        scenario === "reversed" ? [...ids].reverse() :
        scenario === "sparse" ? new Array(2) : ids,
      ];

      await expect(handler("easyconvert:save-archive")(event, ...args)).rejects.toThrow();
      expect(mocks.getPath).not.toHaveBeenCalled();
      expect(mocks.showSaveDialog).not.toHaveBeenCalled();
    },
  );

  it("saves without a dialog and chooses a free name on the next save", async () => {
    const save = handler("easyconvert:save-result");
    await expect(save(event, resultId)).resolves.toEqual({ status: "saved", fileName: "source.png" });
    await expect(save(event, resultId)).resolves.toEqual({ status: "saved", fileName: "source (1).png" });
    await handler("easyconvert:show-last-saved-file")(event);
    expect(mocks.showItemInFolder).toHaveBeenCalledExactlyOnceWith(
      path.join(directory, "EasyConvert Output", "source (1).png"),
    );
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

      await expect(handler("easyconvert:save-result-as")(event, id)).resolves.toEqual({ status: "saved", fileName: path.basename(destination) });
      expect(mocks.showSaveDialog).toHaveBeenLastCalledWith(expect.anything(), {
        defaultPath: fileName,
        filters: [{ name: "JPG file", extensions: ["jpg"] }],
        properties: ["showOverwriteConfirmation"],
      });
      expect(await readFile(destination, "utf8")).toBe(`page ${index + 1}`);

      await expect(handler("easyconvert:save-result")(event, id)).resolves.toEqual({ status: "saved", fileName });
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
    await expect(handler("easyconvert:save-result-as")(event, resultId)).resolves.toEqual({ status: "saved", fileName: "export.png" });
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
    await expect(handler("easyconvert:save-archive")(event, [resultId])).rejects.toThrow("Unexpected sender");
    expect(mocks.showSaveDialog).not.toHaveBeenCalled();
  });
});
