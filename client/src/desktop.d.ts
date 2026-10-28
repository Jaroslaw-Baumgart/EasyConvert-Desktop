import type { EasyConvertApi } from "../../shared/desktopContract";

declare global {
  interface Window {
    easyConvert: EasyConvertApi;
  }
}
