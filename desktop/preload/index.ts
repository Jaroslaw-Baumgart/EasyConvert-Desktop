import { contextBridge, ipcRenderer, webUtils } from "electron";
import type { IpcRendererEvent } from "electron";
import type {
  ConversionJobState,
  EasyConvertApi,
  SelectedSource,
  SourceSelection,
  StartConversionResponse,
} from "../../shared/desktopContract";

function parseIdentifier(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 128) {
    throw new Error("Invalid conversion job identifier.");
  }

  return value;
}

function parseSourceSelection(value: unknown): SourceSelection {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Invalid source selection.");
  }

  if (!("status" in value)) {
    throw new Error("Invalid source selection.");
  }

  if (value.status === "cancelled") {
    return { status: "cancelled" };
  }

  if (value.status === "selected") {
    if (!("source" in value)) {
      throw new Error("Invalid source selection.");
    }

    return {
      status: "selected",
      source: parseSelectedSource(value.source),
    };
  }

  throw new Error("Invalid source selection.");
}

function parseSelectedSource(value: unknown): SelectedSource {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Invalid selected source.");
  }

  if (!("sourceId" in value)) {
    throw new Error("Invalid selected source.");
  }

  const sourceId = parseIdentifier(value.sourceId);

  if (
    !("name" in value) ||
    typeof value.name !== "string" ||
    value.name.length === 0
  ) {
    throw new Error("Invalid selected source.");
  }

  if (
    !("sizeBytes" in value) ||
    typeof value.sizeBytes !== "number" ||
    !Number.isSafeInteger(value.sizeBytes) ||
    value.sizeBytes <= 0 ||
    value.sizeBytes > 10_000_000
  ) {
    throw new Error("Invalid selected source.");
  }

  return {
    sourceId,
    name: value.name,
    sizeBytes: value.sizeBytes,
  };
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
    if (!("resultIds" in value)) {
      throw new Error("Invalid conversion job state.");
    }

    if (
      !Array.isArray(value.resultIds) ||
      value.resultIds.length === 0 ||
      value.resultIds.length > 100
    ) {
      throw new Error("Invalid conversion job state.");
    }

    const resultIds = value.resultIds.map(parseIdentifier);

    return {
      status: "succeeded",
      jobId,
      resultIds,
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

function parseStartConversionResponse(value: unknown): StartConversionResponse {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    !("jobId" in value)
  ) {
    throw new Error("Invalid conversion start response.");
  }

  return {
    jobId: parseIdentifier(value.jobId),
  };
}

function parseSaveResponse(value: unknown): { status: "saved" | "cancelled" } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Invalid save response.");
  }

  if (!("status" in value)) {
    throw new Error("Invalid save response.");
  }

  if (value.status !== "saved" && value.status !== "cancelled") {
    throw new Error("Invalid save response.");
  }

  return { status: value.status };
}

async function invokeSave(
  channel: "easyconvert:save-result" | "easyconvert:save-result-as",
  resultId: string,
): Promise<{ status: "saved" | "cancelled" }> {
  const identifier = parseIdentifier(resultId);
  const value: unknown = await ipcRenderer.invoke(channel, identifier);

  return parseSaveResponse(value);
}

const api: EasyConvertApi = {
  platform: "desktop",

  selectSource: async () => {
    const value: unknown = await ipcRenderer.invoke(
      "easyconvert:select-source",
    );

    return parseSourceSelection(value);
  },

  selectDroppedSource: async (file) => {
    const sourcePath = webUtils.getPathForFile(file);

    if (!sourcePath) {
      throw new Error("Dropped file has no filesystem path.");
    }

    const value: unknown = await ipcRenderer.invoke(
      "easyconvert:select-dropped-source",
      sourcePath,
    );

    return parseSelectedSource(value);
  },

  resetSource: () => ipcRenderer.invoke("easyconvert:reset-source"),

  startConversion: async (request) => {
    const value: unknown = await ipcRenderer.invoke(
      "easyconvert:start-conversion",
      request,
    );

    return parseStartConversionResponse(value);
  },

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

  saveResult: (resultId) => invokeSave("easyconvert:save-result", resultId),

  saveResultAs: (resultId) =>
    invokeSave("easyconvert:save-result-as", resultId),
};

contextBridge.exposeInMainWorld("easyConvert", api);
