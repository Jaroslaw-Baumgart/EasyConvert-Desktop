import { app } from "electron";
import path from "node:path";

export function getResourcePaths() {
  const executablePath = app.isPackaged
    ? path.join(process.resourcesPath, "libreoffice/program/soffice.com")
    : path.resolve(__dirname, "../../../tools/libreoffice/program/soffice.com");

  const binDirectory = app.isPackaged
    ? path.join(process.resourcesPath, "poppler/bin")
    : path.resolve(
        __dirname,
        "../../../node_modules/pdf-poppler/lib/win/poppler-0.51/bin",
      );

  const fontsDirectory = app.isPackaged
    ? path.join(process.resourcesPath, "fonts")
    : path.resolve(__dirname, "../../../assets/fonts");

  return {
    executablePath,
    binDirectory,
    fontsDirectory,
  };
}
