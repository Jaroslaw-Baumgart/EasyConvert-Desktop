import { contextBridge, ipcRenderer } from "electron";
import type { IpcRendererEvent } from "electron";
import type {
  ConversionJobState,
  EasyConvertApi,
} from "../../shared/desktopContract";

const api: EasyConvertApi = {
  platform: "desktop",
  resetSource: () => ipcRenderer.invoke("easyconvert:reset-source"),
  saveResult: (resultId) => ipcRenderer.invoke("easyconvert:save-result", resultId),
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
};

contextBridge.exposeInMainWorld("easyConvert", api);
