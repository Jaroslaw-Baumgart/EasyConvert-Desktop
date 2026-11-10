import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { zipSync } from "fflate";
import { MAX_OFFICE_ENTRIES } from "../../conversion-core/office/officeLimits";

const mocks = vi.hoisted(() => ({
  readFile: vi.fn(),
  convertLibreOfficeToPdf: vi.fn(),
}));

vi.mock("node:fs/promises", async (importOriginal) => ({
  ...await importOriginal<typeof import("node:fs/promises")>(),
  readFile: mocks.readFile,
}));

vi.mock("../../conversion-core/office/convertLibreOfficeToPdf", () => ({
  convertLibreOfficeToPdf: mocks.convertLibreOfficeToPdf,
}));

const originalArgv = process.argv;

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  mocks.convertLibreOfficeToPdf.mockResolvedValue(undefined);
});

afterEach(() => {
  process.argv = originalArgv;
  vi.restoreAllMocks();
});

async function runWorker(conversion: "docx-to-pdf" | "pptx-to-pdf") {
  const inputPath = conversion === "docx-to-pdf" ? "document.docx" : "slides.pptx";
  process.argv = ["electron", "worker", JSON.stringify({
    conversion, inputPath, outputPath: "result.pdf", executablePath: "soffice.com",
  })];
  const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
  const exited = new Promise<number | undefined>((resolve) => {
    vi.spyOn(process, "exit").mockImplementation((code) => {
      resolve(typeof code === "number" ? code : undefined);
      return undefined as never;
    });
  });

  await import("../worker/index");
  const exitCode = await exited;
  return { inputPath, exitCode, errorLog };
}

describe.each(["docx-to-pdf", "pptx-to-pdf"] as const)("%s worker archive validation", (conversion) => {
  it("passes the original path to LibreOffice after accepting the archive", async () => {
    mocks.readFile.mockResolvedValue(zipSync({ "[Content_Types].xml": new Uint8Array([1]) }));

    const { inputPath, exitCode, errorLog } = await runWorker(conversion);

    expect(exitCode).toBe(0);
    expect(errorLog).not.toHaveBeenCalled();
    expect(mocks.readFile).toHaveBeenCalledExactlyOnceWith(inputPath);
    expect(mocks.convertLibreOfficeToPdf).toHaveBeenCalledExactlyOnceWith(
      inputPath, "result.pdf", { executablePath: "soffice.com", timeoutMs: 120_000 },
    );
  });

  it("does not launch LibreOffice when the archive exceeds its entry budget", async () => {
    const entries = Object.fromEntries(Array.from(
      { length: MAX_OFFICE_ENTRIES + 1 },
      (_, index) => [`${index}.xml`, new Uint8Array()],
    ));
    mocks.readFile.mockResolvedValue(zipSync(entries));

    const { exitCode, errorLog } = await runWorker(conversion);

    expect(exitCode).toBe(1);
    expect(errorLog).toHaveBeenCalledExactlyOnceWith("Office archive exceeds processing limits.");
    expect(mocks.convertLibreOfficeToPdf).not.toHaveBeenCalled();
  });
});
