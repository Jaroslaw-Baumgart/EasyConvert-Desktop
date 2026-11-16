import { utilityProcess } from "electron";
import path from "node:path";
import type { StartConversionRequest } from "../../shared/desktopContract";
import { createWorkerRequest } from "./createWorkerRequest";

export function runConversionWorker(
  inputPath: string,
  outputPath: string,
  request: StartConversionRequest,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    signal?.throwIfAborted();
    const workerRequest = createWorkerRequest(inputPath, outputPath, request);
    const args = [JSON.stringify(workerRequest)];
    const worker = utilityProcess.fork(
      path.join(__dirname, "../worker/index.js"),
      args,
      { stdio: "inherit", serviceName: "EasyConvert conversion" },
    );

    const onAbort = () => {
      worker.kill();
    };

    signal?.addEventListener("abort", onAbort, { once: true });

    worker.once("exit", (code) => {
      signal?.removeEventListener("abort", onAbort);

      if (signal?.aborted) {
        reject(signal.reason);
      } else if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Worker exited with code ${code}`));
      }
    });
  });
}
