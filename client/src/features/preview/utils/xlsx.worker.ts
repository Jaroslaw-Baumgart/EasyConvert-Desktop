import { parseXlsxBuffer } from "./xlsxParser";

self.onmessage = ({ data }: MessageEvent<ArrayBuffer>) => {
  try {
    self.postMessage({
      type: "success",
      sheets: parseXlsxBuffer(data),
    });
  } catch (error) {
    self.postMessage({
      type: "error",
      message:
        error instanceof Error ? error.message : "Failed to parse XLSX file.",
    });
  }
};
