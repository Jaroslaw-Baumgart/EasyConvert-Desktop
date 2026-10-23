import { contextBridge, ipcRenderer } from "electron";
import type { EasyConvertApi } from "../../shared/desktopContract";

const api: EasyConvertApi = {
  platform: "desktop",
  selectSource: () => ipcRenderer.invoke("easyconvert:select-source"),
};

contextBridge.exposeInMainWorld("easyConvert", api);
