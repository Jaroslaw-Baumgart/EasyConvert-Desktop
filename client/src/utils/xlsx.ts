import type { XlsxSheet } from "./xlsxParser";

export type { XlsxSheet } from "./xlsxParser";

type WorkerMessage =
  | { type: "success"; sheets: XlsxSheet[] }
  | { type: "error"; message: string };

function createAbortError() {
  return new DOMException("XLSX preview was cancelled.", "AbortError");
}

function readFileAsArrayBuffer(
  file: File,
  signal?: AbortSignal,
): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const abort = () => {
      reader.abort();
      reject(createAbortError());
    };
    const finish = () => {
      signal?.removeEventListener("abort", abort);
    };

    if (signal?.aborted) {
      reject(createAbortError());
      return;
    }

    signal?.addEventListener("abort", abort, { once: true });

    reader.onerror = () => {
      finish();
      reject(reader.error ?? new Error("Failed to read XLSX file."));
    };

    reader.onload = () => {
      finish();
      if (!(reader.result instanceof ArrayBuffer)) {
        reject(new Error("Failed to read XLSX file."));
        return;
      }

      resolve(reader.result);
    };

    reader.readAsArrayBuffer(file);
  });
}

function parseInWorker(
  buffer: ArrayBuffer,
  signal?: AbortSignal,
): Promise<XlsxSheet[]> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL("./xlsx.worker.ts", import.meta.url),
      { type: "module" },
    );

    const finish = () => {
      worker.terminate();
      signal?.removeEventListener("abort", abort);
    };
    const abort = () => {
      finish();
      reject(createAbortError());
    };

    if (signal?.aborted) {
      abort();
      return;
    }

    signal?.addEventListener("abort", abort, { once: true });
    worker.onmessage = ({ data }: MessageEvent<WorkerMessage>) => {
      finish();

      if (data.type === "success") {
        resolve(data.sheets);
        return;
      }

      reject(new Error(data.message));
    };
    worker.onerror = () => {
      finish();
      reject(new Error("Failed to parse XLSX file."));
    };
    worker.postMessage(buffer, [buffer]);
  });
}

export async function parseXlsxFile(
  file: File,
  signal?: AbortSignal,
): Promise<XlsxSheet[]> {
  const buffer = await readFileAsArrayBuffer(file, signal);

  if (typeof Worker === "undefined") {
    if (signal?.aborted) {
      throw createAbortError();
    }
    const { parseXlsxBuffer } = await import("./xlsxParser");
    return parseXlsxBuffer(buffer);
  }

  return parseInWorker(buffer, signal);
}
