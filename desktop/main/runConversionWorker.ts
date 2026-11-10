import { utilityProcess } from "electron";
import path from "node:path";
import type { StartConversionRequest } from "../../shared/desktopContract";
import { createWorkerRequest } from "./createWorkerRequest";

export function runConversionWorker(
  inputPath: string,
  outputPath: string,
  request: StartConversionRequest,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const workerRequest = createWorkerRequest(inputPath, outputPath, request);
    const args = [JSON.stringify(workerRequest)];
    const worker = utilityProcess.fork(
      path.join(__dirname, "../worker/index.js"),
      args,
      { stdio: "inherit", serviceName: "EasyConvert conversion" },
    );

    worker.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Worker exited with code ${code}`));
    });
  });
}
