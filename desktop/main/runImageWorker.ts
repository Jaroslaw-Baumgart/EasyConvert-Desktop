import { utilityProcess } from "electron";
import path from "node:path";
import type { StartConversionRequest } from "../../shared/desktopContract";

export function runImageWorker(
  inputPath: string,
  outputPath: string,
  request: StartConversionRequest,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [request.conversion, inputPath, outputPath];

    if (request.conversion === "png-to-jpg") {
      args.push(JSON.stringify(request.options));
    }
    const worker = utilityProcess.fork(
      path.join(__dirname, "../worker/index.js"),
      args,
      { stdio: "inherit", serviceName: "EasyConvert image conversion" },
    );

    worker.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Worker exited with code ${code}`));
    });
  });
}
