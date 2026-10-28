import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { EasyConvertApi } from "../../../shared/desktopContract";
import { useConversion } from "./useConversion";
import { convertDesktopFile } from "../api/desktopConversionClient";
import { convertFile } from "../api/conversionClient";

vi.mock("../api/desktopConversionClient", () => ({ convertDesktopFile: vi.fn() }));
vi.mock("../api/conversionClient", () => ({ convertFile: vi.fn() }));

afterEach(() => { vi.resetAllMocks(); vi.unstubAllGlobals(); });

const option = {
  conversionType: "jpg-to-png", sourceFormat: "jpg", targetFormat: "png", disabled: false,
} as const;

function setup() {
  const api: EasyConvertApi = {
    platform: "desktop", selectSource: vi.fn(), startConversion: vi.fn(),
    getJobState: vi.fn(), onJobStateChanged: vi.fn(), resetSource: vi.fn(), saveResult: vi.fn(),
  };
  vi.stubGlobal("easyConvert", api);
  return { api, ...renderHook(() => useConversion()) };
}

it("passes the native source ID and signal to the desktop adapter and stores its result", async () => {
  const { api, result } = setup();
  const output = [{ url: "app://easyconvert/preview/result/result-1", file: new File(["png"], "photo.png") }] as const;
  vi.mocked(convertDesktopFile).mockResolvedValueOnce(output);
  act(() => result.current.selectFile(new File(["jpg"], "photo.jpg"), "source-1"));
  await act(async () => { await result.current.convert(option); });
  expect(convertDesktopFile).toHaveBeenCalledExactlyOnceWith(api, "source-1", "photo.jpg", expect.any(AbortSignal));
  expect(convertFile).not.toHaveBeenCalled();
  expect(result.current.convertedResults).toBe(output);
  expect(result.current.isConverting).toBe(false);
});

it("does not fall back to HTTP when a desktop file has no registered source ID", async () => {
  const { result } = setup();
  const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    act(() => result.current.selectFile(new File(["jpg"], "photo.jpg")));
    await act(async () => { await result.current.convert(option); });
    expect(convertDesktopFile).not.toHaveBeenCalled();
    expect(convertFile).not.toHaveBeenCalled();
    expect(result.current.conversionError).not.toBeNull();
  } finally { consoleSpy.mockRestore(); }
});
