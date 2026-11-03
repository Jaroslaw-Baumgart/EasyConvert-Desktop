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
      request.conversion === "txt-to-pdf"
    ) {
      args.push(JSON.stringify(request.options));
    }

    if (request.conversion === "txt-to-pdf") {
      const fontPath = app.isPackaged
        ? path.join(process.resourcesPath, "fonts/NotoSans-Regular.ttf")
        : path.resolve(
            __dirname,
            "../../../assets/fonts/NotoSans-Regular.ttf",
          );

      args.push(fontPath);
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
