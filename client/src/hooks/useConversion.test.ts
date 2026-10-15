import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useConversion } from "./useConversion";
import { convertFile } from "../api/conversionClient";
import { createZipFile } from "../utils/createZipFile";
import { downloadFile } from "../utils/downloadFile";

vi.mock("../api/conversionClient", () => ({ convertFile: vi.fn() }));
vi.mock("../utils/createZipFile", () => ({ createZipFile: vi.fn() }));
vi.mock("../utils/downloadFile", () => ({ downloadFile: vi.fn() }));

const conversionOption = {
  conversionType: "jpg-to-png",
  sourceFormat: "jpg",
  targetFormat: "png",
  disabled: false,
} as const;

afterEach(() => {
  vi.clearAllMocks();
});

describe("conversion cancellation", () => {
  it.each(["remove", "replace", "unmount"] as const)("aborts the browser request on %s", async (action) => {
    let signal: AbortSignal | undefined;
    vi.mocked(convertFile).mockImplementationOnce((_data, requestSignal) => {
      signal = requestSignal;
      return new Promise((_resolve, reject) => requestSignal?.addEventListener("abort", () =>
        reject(new DOMException("Aborted", "AbortError")), { once: true }));
    });
    const { result, unmount } = renderHook(() => useConversion());
    act(() => result.current.selectFile(new File(["image"], "photo.jpg")));
    let conversion!: Promise<void>;
    act(() => {
      conversion = result.current.convert(conversionOption);
    });
    expect(signal?.aborted).toBe(false);
    await act(async () => {
      if (action === "remove") result.current.removeFile();
      else if (action === "replace") result.current.selectFile(new File(["next"], "next.jpg"));
      else unmount();
      await conversion;
    });
    expect(signal?.aborted).toBe(true);
    expect(result.current.conversionError).toBeNull();
  });

  it("cancels an outdated ZIP download when another file is selected", async () => {
    let resolveArchive!: (file: File) => void;
    vi.mocked(convertFile).mockResolvedValueOnce([
      {
        url: "http://localhost:5000/output/photo.png",
        file: new File(["converted"], "photo.png", { type: "image/png" }),
      },
    ]);
    vi.mocked(createZipFile).mockImplementationOnce(
      () => new Promise<File>((resolve) => {
        resolveArchive = resolve;
      }),
    );

    const { result } = renderHook(() => useConversion());

    act(() => {
      result.current.selectFile(new File(["image"], "photo.jpg"));
    });
    await act(async () => {
      await result.current.convert(conversionOption);
    });

    act(() => {
      void result.current.downloadAllConvertedFiles();
    });
    expect(result.current.isPreparingArchive).toBe(true);

    act(() => {
      result.current.selectFile(new File(["next"], "next.jpg"));
    });
    expect(result.current.isPreparingArchive).toBe(false);

    await act(async () => {
      resolveArchive(new File(["archive"], "conversion-results.zip"));
    });

    expect(downloadFile).not.toHaveBeenCalled();
  });

  it("keeps a new conversion independent from an earlier ZIP operation", async () => {
    let resolveArchive!: (file: File) => void;
    vi.mocked(convertFile)
      .mockResolvedValueOnce([
        {
          url: "http://localhost:5000/output/first.png",
          file: new File(["first"], "first.png", { type: "image/png" }),
        },
      ])
      .mockResolvedValueOnce([
        {
          url: "http://localhost:5000/output/second.png",
          file: new File(["second"], "second.png", { type: "image/png" }),
        },
      ]);
    vi.mocked(createZipFile).mockImplementationOnce(
      () => new Promise<File>((resolve) => {
        resolveArchive = resolve;
      }),
    );

    const { result } = renderHook(() => useConversion());

    act(() => {
      result.current.selectFile(new File(["first"], "first.jpg"));
    });
    await act(async () => {
      await result.current.convert(conversionOption);
    });
    act(() => {
      void result.current.downloadAllConvertedFiles();
      result.current.selectFile(new File(["second"], "second.jpg"));
    });
    await act(async () => {
      await result.current.convert(conversionOption);
      resolveArchive(new File(["archive"], "conversion-results.zip"));
    });

    expect(convertFile).toHaveBeenCalledTimes(2);
    expect(result.current.file?.name).toBe("second.jpg");
    expect(result.current.isPreparingArchive).toBe(false);
    expect(downloadFile).not.toHaveBeenCalled();
  });

  it("does not start a ZIP download after the hook unmounts", async () => {
    let resolveArchive!: (file: File) => void;
    vi.mocked(convertFile).mockResolvedValueOnce([
      {
        url: "http://localhost:5000/output/photo.png",
        file: new File(["converted"], "photo.png", { type: "image/png" }),
      },
    ]);
    vi.mocked(createZipFile).mockImplementationOnce(
      () => new Promise<File>((resolve) => {
        resolveArchive = resolve;
      }),
    );

    const { result, unmount } = renderHook(() => useConversion());

    act(() => {
      result.current.selectFile(new File(["image"], "photo.jpg"));
    });
    await act(async () => {
      await result.current.convert(conversionOption);
    });

    act(() => {
      void result.current.downloadAllConvertedFiles();
      unmount();
    });
    await act(async () => {
      resolveArchive(new File(["archive"], "conversion-results.zip"));
    });

    expect(downloadFile).not.toHaveBeenCalled();
  });
});
