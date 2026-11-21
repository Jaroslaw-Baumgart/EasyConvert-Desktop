import { vi } from "vitest";
import type { EasyConvertApi } from "../../../shared/desktopContract";
import type { ConvertedResults } from "../types/conversionResult";

export function createDesktopApi(): EasyConvertApi {
  return {
    platform: "desktop",
    onCloseRequested: vi.fn().mockReturnValue(() => {}),
    respondToCloseRequest: vi.fn().mockResolvedValue(undefined),
    minimizeWindow: vi.fn().mockResolvedValue(undefined),
    toggleMaximizeWindow: vi.fn().mockResolvedValue(undefined),
    closeWindow: vi.fn().mockResolvedValue(undefined),
    getSettings: vi.fn().mockResolvedValue({
      language: "en",
      theme: "light",
      accentColor: "white",
      outputDirectory: "C:\\EasyConvert Output",
    }),
    saveSettings: vi.fn().mockResolvedValue(undefined),
    getDefaultSettings: vi.fn().mockResolvedValue({
      language: "en",
      theme: "light",
      accentColor: "white",
      outputDirectory: "C:\\EasyConvert Output",
    }),
    selectOutputDirectory: vi.fn().mockResolvedValue(null),
    selectSource: vi.fn(),
    selectDroppedSource: vi.fn(),
    startConversion: vi.fn(),
    cancelConversion: vi.fn().mockResolvedValue(undefined),
    getJobState: vi.fn(),
    onJobStateChanged: vi.fn(),
    resetSource: vi.fn().mockResolvedValue(undefined),
    saveResult: vi.fn().mockResolvedValue({ status: "saved", fileName: "converted.png" }),
    saveResultAs: vi.fn().mockResolvedValue({ status: "saved", fileName: "converted.png" }),
    saveArchive: vi.fn().mockResolvedValue({ status: "saved", fileName: "converted.zip" }),
    showLastSavedFile: vi.fn().mockResolvedValue(undefined),
  };
}

export function convertedResult(name = "converted.png", type = "image/png"): ConvertedResults {
  return [{
    resultId: "result-1",
    url: "app://easyconvert/preview/result/result-1",
    file: new File(["converted content"], name, { type }),
  }];
}
