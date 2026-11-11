import { vi } from "vitest";
import type { EasyConvertApi } from "../../../shared/desktopContract";
import type { ConvertedResults } from "../types/conversionResult";

export function createDesktopApi(): EasyConvertApi {
  return {
    platform: "desktop",
    selectSource: vi.fn(),
    selectDroppedSource: vi.fn(),
    startConversion: vi.fn(),
    getJobState: vi.fn(),
    onJobStateChanged: vi.fn(),
    resetSource: vi.fn().mockResolvedValue(undefined),
    saveResult: vi.fn().mockResolvedValue({ status: "saved" }),
    saveResultAs: vi.fn().mockResolvedValue({ status: "saved" }),
    saveArchive: vi.fn().mockResolvedValue({ status: "saved" }),
  };
}

export function convertedResult(name = "converted.png", type = "image/png"): ConvertedResults {
  return [{
    resultId: "result-1",
    url: "app://easyconvert/preview/result/result-1",
    file: new File(["converted content"], name, { type }),
  }];
}
