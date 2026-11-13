import type { SaveResponse } from "../../../shared/desktopContract";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useConversion } from "./useConversion";
import { convertDesktopFile } from "../api/desktopConversionClient";
import { createDesktopApi, convertedResult } from "../test/desktopApi";

vi.mock("../api/desktopConversionClient", () => ({ convertDesktopFile: vi.fn() }));

const conversionOption = {
  conversionType: "jpg-to-png",
  sourceFormat: "jpg",
  targetFormat: "png",
  disabled: false,
} as const;

beforeEach(() => vi.stubGlobal("easyConvert", createDesktopApi()));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

async function setupArchive() {
  const output = convertedResult();
  vi.mocked(convertDesktopFile).mockResolvedValueOnce(output);
  const fixture = renderHook(() => useConversion());
  const file = new File(["source"], "photo.jpg");
  act(() => fixture.result.current.selectFile(file, "source-1"));
  await act(async () => { await fixture.result.current.convert(conversionOption); });
  return { ...fixture, file, output, api: window.easyConvert };
}

describe("native archive saving", () => {
  describe.each(["quick", "saveAs", "archive", "archiveAs"] as const)("%s export", (mode) => {
    it.each(["disk-full", "permission-denied", "save-failed"] as const)(
      "preserves previews after %s and replaces the notification on retry", async (code) => {
        const { api, result, file, output } = await setupArchive();
        const archive = mode === "archive" || mode === "archiveAs";
        const saveAs = mode === "saveAs" || mode === "archiveAs";
        const method = archive ? api.saveArchive : saveAs ? api.saveResultAs : api.saveResult;
        vi.mocked(method).mockResolvedValueOnce({ status: "failed", code });
        const save = () => archive
          ? result.current.downloadAllConvertedFiles(saveAs)
          : result.current.downloadConvertedFile(output[0], saveAs);

        await act(async () => { await save(); });
        expect(result.current.saveNotification).toEqual({ status: "failed", code });
        expect(result.current.file).toBe(file);
        expect(result.current.convertedResults).toBe(output);
        expect(result.current.isSaving).toBe(false);
        expect(result.current.isPreparingArchive).toBe(false);
        expect(result.current.conversionError).toBeNull();

        await act(async () => { await save(); });
        expect(result.current.saveNotification).toEqual({
          status: "saved", fileName: archive ? "converted.zip" : "converted.png",
        });
        expect(result.current.convertedResults).toBe(output);
      },
    );
  });

  it("forwards Save as selection to the archive IPC method", async () => {
    const { api, result, output } = await setupArchive();
    await act(async () => { await result.current.downloadAllConvertedFiles(true); });
    expect(api.saveArchive).toHaveBeenCalledExactlyOnceWith([output[0].resultId], true);
    expect(result.current.isSaving).toBe(false);
    expect(result.current.isPreparingArchive).toBe(false);
  });

  it("passes identifiers and blocks other file actions until the archive is saved", async () => {
    const { api, result, output, file } = await setupArchive();
    let finish!: (value: SaveResponse) => void;
    vi.mocked(api.saveArchive).mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    vi.mocked(convertDesktopFile).mockClear();
    let saving!: Promise<void>;
    act(() => { saving = result.current.downloadAllConvertedFiles(); });
    expect(result.current.isSaving).toBe(true);
    expect(result.current.isPreparingArchive).toBe(true);

    await act(async () => {
      await result.current.downloadAllConvertedFiles();
      await result.current.downloadConvertedFile(output[0]);
      await result.current.removeFile();
      result.current.selectFile(new File(["other"], "other.jpg"), "other-source");
      await result.current.convert(conversionOption);
    });

    expect(api.saveArchive).toHaveBeenCalledExactlyOnceWith([output[0].resultId]);
    expect(api.saveResult).not.toHaveBeenCalled();
    expect(api.resetSource).not.toHaveBeenCalled();
    expect(convertDesktopFile).not.toHaveBeenCalled();
    expect(result.current.file).toBe(file);
    expect(result.current.convertedResults).toBe(output);

    await act(async () => { finish({ status: "saved", fileName: "converted.png" }); await saving; });
    expect(result.current.isSaving).toBe(false);
    expect(result.current.isPreparingArchive).toBe(false);
    expect(result.current.conversionError).toBeNull();
  });

  it.each(["failed", "cancelled"] as const)("releases the archive lock after %s and allows retry", async (outcome) => {
    const { api, result, output } = await setupArchive();
    vi.spyOn(console, "error").mockImplementation(() => {});
    if (outcome === "failed") {
      vi.mocked(api.saveArchive).mockRejectedValueOnce(new Error("Disk full"));
    } else {
      vi.mocked(api.saveArchive).mockResolvedValueOnce({ status: "cancelled" });
    }
    await act(async () => { await result.current.downloadAllConvertedFiles(); });
    expect(result.current.isSaving).toBe(false);
    expect(result.current.isPreparingArchive).toBe(false);
    expect(result.current.convertedResults).toBe(output);
    expect(result.current.conversionError).toBeNull();
    expect(result.current.saveNotification).toEqual(
      outcome === "failed" ? { status: "failed", code: "save-failed" } : null,
    );

    await act(async () => { await result.current.downloadAllConvertedFiles(); });
    expect(api.saveArchive).toHaveBeenCalledTimes(2);
    expect(result.current.conversionError).toBeNull();
  });

  it("ignores an archive failure after unmount", async () => {
    const { api, result, unmount } = await setupArchive();
    let fail!: (error: Error) => void;
    vi.mocked(api.saveArchive).mockReturnValueOnce(new Promise((_resolve, reject) => { fail = reject; }));
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    let saving!: Promise<void>;
    act(() => { saving = result.current.downloadAllConvertedFiles(); });
    unmount();
    fail(new Error("Late archive failure"));
    await expect(saving).resolves.toBeUndefined();
    expect(errorLog).not.toHaveBeenCalled();
  });
});

describe("conversion cancellation", () => {
  it.each(["replace", "unmount"] as const)("aborts waiting for the desktop result on %s", async (action) => {
    let signal: AbortSignal | undefined;
    vi.mocked(convertDesktopFile).mockImplementationOnce((_api, _request, _name, requestSignal) => {
      signal = requestSignal;
      return new Promise((_resolve, reject) => requestSignal?.addEventListener("abort", () =>
        reject(new DOMException("Aborted", "AbortError")), { once: true }));
    });
    const { result, unmount } = renderHook(() => useConversion());
    act(() => result.current.selectFile(new File(["image"], "photo.jpg"), "source-1"));
    let conversion!: Promise<void>;
    act(() => {
      conversion = result.current.convert(conversionOption);
    });
    expect(signal?.aborted).toBe(false);
    await act(async () => {
      if (action === "replace") result.current.selectFile(new File(["next"], "next.jpg"), "source-1");
      else unmount();
      await conversion;
    });
    expect(signal?.aborted).toBe(true);
    expect(result.current.conversionError).toBeNull();
  });

});
