import { execFile } from "child_process";
import fs from "node:fs/promises";
import path from "path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { LIBRE_OFFICE_PATH, LIBRE_OFFICE_TIMEOUT_MS } from "./constants";

export class LibreOfficeTimeoutError extends Error {
  constructor() {
    super("The conversion took too long. Please try again.");
    this.name = "LibreOfficeTimeoutError";
  }
}

let queue: Promise<void> = Promise.resolve();
let pending = 0;

export async function convertLibreOfficeToPdf(
  inputPath: string,
  outputPath: string,
  signal?: AbortSignal,
): Promise<void> {
  if (pending >= 4) throw new Error("The conversion queue is full. Please try again.");
  pending += 1;
  const previous = queue;
  let release!: () => void;
  queue = new Promise<void>((resolve) => { release = resolve; });
  let profile: string | undefined;
  try {
    await previous;
    if (signal?.aborted) {
      throw new Error("Conversion was cancelled.");
    }
    profile = await fs.mkdtemp(path.join(tmpdir(), "converter-libreoffice-"));
    const profileUrl = pathToFileURL(profile).href;
    await new Promise<void>((resolve, reject) => {
      execFile(LIBRE_OFFICE_PATH,
        [`-env:UserInstallation=${profileUrl}`, "--headless", "--convert-to", "pdf", "--outdir", path.dirname(outputPath), inputPath],
        { timeout: LIBRE_OFFICE_TIMEOUT_MS, killSignal: "SIGKILL", windowsHide: true, signal },
        (error) => {
          if (error && "killed" in error && error.killed) reject(new LibreOfficeTimeoutError());
          else if (error) reject(error);
          else resolve();
        });
    });
    const handle = await fs.open(outputPath, "r").catch((error: unknown) => {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
        throw new Error("LibreOffice did not produce a PDF.");
      }
      throw error;
    });
    try {
      const header = Buffer.alloc(5);
      const { bytesRead } = await handle.read(header, 0, 5, 0);
      const metadata = await handle.stat();
      if (bytesRead !== 5 || header.toString("ascii") !== "%PDF-" || metadata.size <= 5) {
        throw new Error("LibreOffice produced an invalid PDF.");
      }
    } finally { await handle.close(); }
  } finally {
    try { if (profile) await fs.rm(profile, { recursive: true, force: true }); }
    finally { pending -= 1; release(); }
  }
}
