import { utilityProcess } from "electron";
import path from "node:path";
import type { StartConversionRequest } from "../../shared/desktopContract";
import { createWorkerRequest } from "./createWorkerRequest";
import { killProcessTree } from "./killProcessTree";

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

    let stopping: Promise<void> | undefined;
    let stopError: unknown;

    const onAbort = () => {
      if (worker.pid === undefined || stopping) {
        return;
      }
      stopping = killProcessTree(worker.pid).catch((error) => {
        stopError = error;
      });
    };

    const onSpawn = () => {
      if (signal?.aborted) {
        onAbort();
      }
    };

    worker.once("spawn", onSpawn);

    signal?.addEventListener("abort", onAbort, { once: true });

    worker.once("exit", async (code) => {
      signal?.removeEventListener("abort", onAbort);
      worker.removeListener("spawn", onSpawn);
      await stopping;

      if (stopError !== undefined) {
        reject(stopError);
      } else if (signal?.aborted) {
        reject(signal.reason);
      } else if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Worker exited with code ${code}`));
      }
    });
  });
}
