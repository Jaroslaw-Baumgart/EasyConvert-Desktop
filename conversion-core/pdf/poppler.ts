import { execFile } from "node:child_process";
import path from "node:path";

export interface PopplerOptions {
  binDirectory: string;
  timeoutMs: number;
  maxPages: number;
}

function binary(name: string, options: PopplerOptions): string {
  const executable = process.platform === "win32" ? `${name}.exe` : name;
  return path.join(options.binDirectory, executable);
}

export function runPoppler(
  name: string,
  args: string[],
  options: PopplerOptions,
  signal?: AbortSignal,
): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      binary(name, options),
      args,
      {
        timeout: options.timeoutMs,
        killSignal: "SIGKILL",
        windowsHide: true,
        maxBuffer: 1024 * 1024,
        encoding: "utf8",
        signal,
      },
      (error, stdout) => (error ? reject(error) : resolve(stdout)),
    );
  });
}

export async function validatePdfPageCount(
  input: string,
  options: PopplerOptions,
  signal?: AbortSignal,
): Promise<number> {
  const info = await runPoppler("pdfinfo", [input], options, signal);
  const pages = Number(info.match(/^Pages:\s+(\d+)/m)?.[1]);
  if (!Number.isInteger(pages) || pages < 1 || pages > options.maxPages) {
    throw new Error(
      `PDF must contain between 1 and ${options.maxPages} pages.`,
    );
  }
  return pages;
}

export async function pdfToImages(
  input: string,
  outputDirectory: string,
  options: PopplerOptions,
  signal?: AbortSignal,
): Promise<void> {
  await validatePdfPageCount(input, options, signal);

  await runPoppler(
    "pdftocairo",
    ["-jpeg", "-scale-to", "1024", input, path.join(outputDirectory, "page")],
    options,
    signal,
  );
}
