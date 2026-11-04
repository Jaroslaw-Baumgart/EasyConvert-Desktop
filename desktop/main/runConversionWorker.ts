import { app, utilityProcess } from "electron";
import path from "node:path";
import type { StartConversionRequest } from "../../shared/desktopContract";

export function runConversionWorker(
  inputPath: string,
  outputPath: string,
  request: StartConversionRequest,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [request.conversion, inputPath, outputPath];

    if (
      request.conversion === "png-to-jpg" ||
      request.conversion === "jpg-to-pdf" ||
      request.conversion === "txt-to-pdf" ||
      request.conversion === "csv-to-pdf"
    ) {
      args.push(JSON.stringify(request.options));
    }

    if (
      request.conversion === "txt-to-pdf" ||
      request.conversion === "csv-to-pdf"
    ) {
      const fontsDirectory = app.isPackaged
        ? path.join(process.resourcesPath, "fonts")
        : path.resolve(__dirname, "../../../assets/fonts");

      args.push(path.join(fontsDirectory, "NotoSans-Regular.ttf"));

      if (request.conversion === "csv-to-pdf") {
        args.push(path.join(fontsDirectory, "NotoSans-Bold.ttf"));
      }
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
