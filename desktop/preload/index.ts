import { contextBridge, ipcRenderer, webUtils } from "electron";
import type { IpcRendererEvent } from "electron";
import type {
  ConversionJobState,
  EasyConvertApi,
} from "../../shared/desktopContract";

const api: EasyConvertApi = {
  platform: "desktop",
  resetSource: () => ipcRenderer.invoke("easyconvert:reset-source"),
  saveResult: (resultId) =>
    ipcRenderer.invoke("easyconvert:save-result", resultId),
  selectSource: () => ipcRenderer.invoke("easyconvert:select-source"),
  startConversion: (request) =>
    ipcRenderer.invoke("easyconvert:start-conversion", request),
  getJobState: () => ipcRenderer.invoke("easyconvert:get-job-state"),

  onJobStateChanged: (listener) => {
    const handler = (
      _event: IpcRendererEvent,
      state: ConversionJobState,
    ): void => {
      listener(state);
    };
    ipcRenderer.on("easyconvert:job-state-changed", handler);

    return () => {
      ipcRenderer.removeListener("easyconvert:job-state-changed", handler);
    };
  },

  selectDroppedSource: async (file) => {
    const sourcePath = webUtils.getPathForFile(file);

    if (!sourcePath) {
      throw new Error("Dropped file has no filesystem path.");
    }

    return ipcRenderer.invoke("easyconvert:select-dropped-source", sourcePath);
  },
};

contextBridge.exposeInMainWorld("easyConvert", api);
