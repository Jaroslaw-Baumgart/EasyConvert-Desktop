import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EasyConvertApi } from "../../../shared/desktopContract";
import type { ConvertedResults } from "../types/conversionResult";
import { useConversion } from "./useConversion";
import { convertDesktopFile } from "../api/desktopConversionClient";
import { convertFile } from "../api/conversionClient";

vi.mock("../api/desktopConversionClient", () => ({
  convertDesktopFile: vi.fn(),
}));

vi.mock("../api/conversionClient", () => ({
  convertFile: vi.fn(),
}));

afterEach(() => {
  vi.resetAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const option = {
  conversionType: "jpg-to-png",
  sourceFormat: "jpg",
  targetFormat: "png",
  disabled: false,
} as const;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;

  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

function setup() {
  const api: EasyConvertApi = {
    platform: "desktop",
    selectSource: vi.fn(),
    selectDroppedSource: vi.fn(),
    startConversion: vi.fn(),
    getJobState: vi.fn(),
    onJobStateChanged: vi.fn(),
    resetSource: vi.fn().mockResolvedValue(undefined),
    saveResult: vi.fn(),
  };

  const file = new File(["jpg"], "photo.jpg", {
    type: "image/jpeg",
  });

  const output: ConvertedResults = [
    {
      url: "app://easyconvert/preview/result/result-1",
      file: new File(["png"], "photo.png", {
        type: "image/png",
      }),
    },
  ];

  vi.stubGlobal("easyConvert", api);
  vi.mocked(convertDesktopFile).mockResolvedValue(output);

  return {
    api,
    file,
    output,
    ...renderHook(() => useConversion()),
  };
}

async function setupConvertedFile() {
  const fixture = setup();

  act(() => {
    fixture.result.current.selectFile(fixture.file, "source-1");
  });

  await act(async () => {
    await fixture.result.current.convert(option);
  });

  return fixture;
}

describe("desktop useConversion", () => {
  it("passes the source ID and signal to the desktop adapter and stores its result", async () => {
    const { api, result, output } = await setupConvertedFile();

    expect(convertDesktopFile).toHaveBeenCalledExactlyOnceWith(
      api,
      "source-1",
      "photo.jpg",
      expect.any(AbortSignal),
    );

    expect(convertFile).not.toHaveBeenCalled();
    expect(result.current.convertedResults).toBe(output);
    expect(result.current.isConverting).toBe(false);
  });

  it("does not fall back to HTTP when the file has no source ID", async () => {
    const { result, file } = setup();
    vi.spyOn(console, "error").mockImplementation(() => {});

    act(() => {
      result.current.selectFile(file);
    });

    await act(async () => {
      await result.current.convert(option);
    });

    expect(convertDesktopFile).not.toHaveBeenCalled();
    expect(convertFile).not.toHaveBeenCalled();
    expect(result.current.conversionError).not.toBeNull();
  });

  it("keeps the file and result until reset succeeds, then clears both", async () => {
    const { api, result, file, output } = await setupConvertedFile();
    const reset = deferred<void>();

    vi.mocked(api.resetSource).mockReturnValueOnce(reset.promise);

    let removal!: Promise<void>;

    act(() => {
      removal = result.current.removeFile();
    });

    expect(api.resetSource).toHaveBeenCalledExactlyOnceWith();
    expect(result.current.isRemoving).toBe(true);
    expect(result.current.file).toBe(file);
    expect(result.current.convertedResults).toBe(output);

    await act(async () => {
      reset.resolve(undefined);
      await removal;
    });

    expect(result.current.file).toBeNull();
    expect(result.current.convertedResults).toBeNull();
    expect(result.current.conversionError).toBeNull();
    expect(result.current.isRemoving).toBe(false);
  });

  it("preserves the file and result after a reset failure and allows retry", async () => {
    const { api, result, file, output } = await setupConvertedFile();

    vi.mocked(api.resetSource).mockRejectedValueOnce(
      new Error("Reset failed."),
    );

    await act(async () => {
      await result.current.removeFile();
    });

    expect(result.current.file).toBe(file);
    expect(result.current.convertedResults).toBe(output);
    expect(result.current.conversionError).toBe("Reset failed.");
    expect(result.current.isRemoving).toBe(false);

    await act(async () => {
      await result.current.removeFile();
    });

    expect(api.resetSource).toHaveBeenCalledTimes(2);
    expect(result.current.file).toBeNull();
    expect(result.current.convertedResults).toBeNull();
    expect(result.current.conversionError).toBeNull();
    expect(result.current.isRemoving).toBe(false);
  });

  it("blocks duplicate removal, conversion and replacement while reset is pending", async () => {
    const { api, result, file, output } = await setupConvertedFile();
    const reset = deferred<void>();

    vi.mocked(api.resetSource).mockReturnValueOnce(reset.promise);
    vi.mocked(convertDesktopFile).mockClear();

    // Te same callbacki sprawdzają blokadę również przed kolejnym renderem.
    const actions = result.current;
    let removal!: Promise<void>;

    await act(async () => {
      removal = actions.removeFile();

      await actions.removeFile();
      await actions.convert(option);

      actions.selectFile(
        new File(["replacement"], "replacement.jpg"),
        "source-2",
      );
    });

    expect(api.resetSource).toHaveBeenCalledTimes(1);
    expect(convertDesktopFile).not.toHaveBeenCalled();
    expect(convertFile).not.toHaveBeenCalled();
    expect(result.current.file).toBe(file);
    expect(result.current.convertedResults).toBe(output);
    expect(result.current.isRemoving).toBe(true);

    await act(async () => {
      reset.resolve(undefined);
      await removal;
    });

    expect(result.current.file).toBeNull();
    expect(result.current.isRemoving).toBe(false);
  });

  it("does not reset a source while its conversion is starting or running", async () => {
    const { api, result, file, output } = setup();
    const conversion = deferred<ConvertedResults>();

    vi.mocked(convertDesktopFile).mockReturnValueOnce(conversion.promise);

    act(() => {
      result.current.selectFile(file, "source-1");
    });

    const actions = result.current;
    let running!: Promise<void>;

    await act(async () => {
      running = actions.convert(option);
      await actions.removeFile();
    });

    expect(result.current.isConverting).toBe(true);

    await act(async () => {
      await result.current.removeFile();
    });

    expect(api.resetSource).not.toHaveBeenCalled();
    expect(result.current.file).toBe(file);

    await act(async () => {
      conversion.resolve(output);
      await running;
    });

    expect(result.current.convertedResults).toBe(output);
    expect(result.current.isConverting).toBe(false);
  });

  it("does not call reset when no file is selected", async () => {
    const { api, result } = setup();

    await act(async () => {
      await result.current.removeFile();
    });

    expect(api.resetSource).not.toHaveBeenCalled();
    expect(result.current.file).toBeNull();
    expect(result.current.isRemoving).toBe(false);
  });
});
