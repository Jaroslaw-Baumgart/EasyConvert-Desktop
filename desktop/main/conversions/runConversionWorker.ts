import { utilityProcess } from "electron";
import path from "node:path";
import type { StartConversionRequest } from "../../../shared/contracts/desktopContract";
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
      path.join(__dirname, "../../worker/index.js"),
      args,
      { stdio: "inherit", serviceName: "EasyConvert conversion" },
    );

    let stopping: Promise<void> | undefined;
    let stopError: unknown;
    let timedOut = false;

    const stopWorker = () => {
      if (worker.pid === undefined || stopping) {
        return;
      }
      stopping = killProcessTree(worker.pid).catch((error) => {
        stopError = error;
      });
    };

    const timer = setTimeout(() => {
      timedOut = true;
      stopWorker();
    }, 180_000);

    const onSpawn = () => {
      if (signal?.aborted || timedOut) {
        stopWorker();
      }
    };

    worker.once("spawn", onSpawn);

    signal?.addEventListener("abort", stopWorker, { once: true });

    worker.once("exit", async (code) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", stopWorker);
      worker.removeListener("spawn", onSpawn);
      await stopping;

      if (stopError !== undefined) {
        reject(stopError);
      } else if (timedOut) {
        reject(new Error("The conversion took too long. Please try again."));
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
