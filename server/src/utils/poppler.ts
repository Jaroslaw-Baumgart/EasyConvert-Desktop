import { execFile } from "node:child_process";
import path from "node:path";
import { LIBRE_OFFICE_TIMEOUT_MS, MAX_PDF_PAGES } from "./constants";

function binary(name: string) {
  if (process.env.POPPLER_BIN_DIR) return path.join(process.env.POPPLER_BIN_DIR, name);
  if (process.platform === "win32") {
    return path.join(path.dirname(require.resolve("pdf-poppler/package.json")),
      "lib/win/poppler-0.51/bin", `${name}.exe`);
  }
  return name;
}

export function runPoppler(
  name: string,
  args: string[],
  signal?: AbortSignal,
): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(binary(name), args, {
      timeout: LIBRE_OFFICE_TIMEOUT_MS, killSignal: "SIGKILL",
      windowsHide: true, maxBuffer: 1024 * 1024, encoding: "utf8", signal,
    }, (error, stdout) => error ? reject(error) : resolve(stdout));
  });
}

export async function validatePdfPageCount(input: string, signal?: AbortSignal) {
  const info = await runPoppler("pdfinfo", [input], signal);
  const pages = Number(info.match(/^Pages:\s+(\d+)/m)?.[1]);
  if (!Number.isInteger(pages) || pages < 1 || pages > MAX_PDF_PAGES) {
    throw new Error(`PDF must contain between 1 and ${MAX_PDF_PAGES} pages.`);
  }
  return pages;
}

export async function pdfToImages(
  input: string,
  outputDirectory: string,
  signal?: AbortSignal,
) {
  await validatePdfPageCount(input, signal);
  await runPoppler(
    "pdftocairo",
    ["-jpeg", "-scale-to", "1024", input, path.join(outputDirectory, "page")],
    signal,
  );
}
