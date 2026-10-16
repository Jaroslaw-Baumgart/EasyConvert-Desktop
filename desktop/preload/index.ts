import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("easyConvert", {
  platform: "desktop",
});