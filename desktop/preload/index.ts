import { contextBridge, ipcRenderer, webUtils } from "electron";
import type { IpcRendererEvent } from "electron";
import type {
  ConversionJobState,
  EasyConvertApi,
} from "../../shared/desktopContract";

function parseIdentifier(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 128) {
    throw new Error("Invalid conversion job identifier.");
  }

  return value;
}

function parseConversionJobState(value: unknown): ConversionJobState {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Invalid conversion job state.");
  }

  if (!("status" in value)) {
    throw new Error("Invalid conversion job state.");
  }

  if (value.status === "idle") {
    return { status: "idle" };
  }

  if (!("jobId" in value)) {
    throw new Error("Invalid conversion job state.");
  }

  const jobId = parseIdentifier(value.jobId);

  if (value.status === "running" || value.status === "cancelled") {
    return {
      status: value.status,
      jobId,
    };
  }

  if (value.status === "succeeded") {
    if (!("resultId" in value)) {
      throw new Error("Invalid conversion job state.");
    }

    return {
      status: "succeeded",
      jobId,
      resultId: parseIdentifier(value.resultId),
    };
  }

  if (value.status === "failed") {
    if (!("message" in value) || typeof value.message !== "string") {
      throw new Error("Invalid conversion job state.");
    }

    return {
      status: "failed",
      jobId,
      message: value.message,
    };
  }

  throw new Error("Invalid conversion job state.");
}

const api: EasyConvertApi = {
  platform: "desktop",

  selectSource: () => ipcRenderer.invoke("easyconvert:select-source"),

  selectDroppedSource: async (file) => {
    const sourcePath = webUtils.getPathForFile(file);

    if (!sourcePath) {
      throw new Error("Dropped file has no filesystem path.");
    }

    return ipcRenderer.invoke("easyconvert:select-dropped-source", sourcePath);
  },

  resetSource: () => ipcRenderer.invoke("easyconvert:reset-source"),

  startConversion: (request) =>
    ipcRenderer.invoke("easyconvert:start-conversion", request),

  getJobState: async () => {
    const value: unknown = await ipcRenderer.invoke(
      "easyconvert:get-job-state",
    );

    return parseConversionJobState(value);
  },

  onJobStateChanged: (listener) => {
    const handler = (_event: IpcRendererEvent, value: unknown): void => {
      let state: ConversionJobState;

      try {
        state = parseConversionJobState(value);
      } catch {
        console.error("Received an invalid conversion job state.");
        return;
      }

      listener(state);
    };

    ipcRenderer.on("easyconvert:job-state-changed", handler);

    return () => {
      ipcRenderer.removeListener("easyconvert:job-state-changed", handler);
    };
  },

  saveResult: (resultId) =>
    ipcRenderer.invoke("easyconvert:save-result", resultId),
};

contextBridge.exposeInMainWorld("easyConvert", api);
