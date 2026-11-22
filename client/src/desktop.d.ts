import type { EasyConvertApi } from "../../shared/contracts/desktopContract";

declare global {
  interface Window {
    easyConvert: EasyConvertApi;
  }
}
