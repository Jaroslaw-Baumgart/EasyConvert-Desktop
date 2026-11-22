import { app } from "electron";
import path from "node:path";

export function getTemporaryDirectory(): string {
  return path.join(app.getPath("temp"), "EasyConvert");
}