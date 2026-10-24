import { utilityProcess } from "electron";
import path from "node:path";

export function runJpgToPngWorker(
  inputPath: string,
  outputPath: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const worker = utilityProcess.fork(
      path.join(__dirname, "../worker/index.js"),
      ["jpg-to-png", inputPath, outputPath],
      { stdio: "inherit", serviceName: "EasyConvert image conversion" },
    );

    worker.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Worker exited with code ${code}`));
    });
  });
}
