import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  execFile: vi.fn(),
  open: vi.fn(),
}));

vi.mock("node:fs/promises", async (importOriginal) => ({
  default: { ...(await importOriginal<typeof import("node:fs/promises")>()), open: mocks.open },
}));

vi.mock("child_process", () => ({
  execFile: mocks.execFile,
}));

import {
  LIBRE_OFFICE_PATH,
  LIBRE_OFFICE_TIMEOUT_MS,
} from "./constants";
import {
  convertLibreOfficeToPdf,
  LibreOfficeTimeoutError,
} from "./libreOffice";

type ExecFileCallback = (error: Error | null) => void;

const runExecFileCallback = (error: Error | null) => {
  mocks.execFile.mockImplementation(
    (
      _file: string,
      _arguments: string[],
      _options: object,
      callback: ExecFileCallback,
    ) => {
      callback(error);
    },
  );
};

describe("convertLibreOfficeToPdf", () => {
  it("passes cancellation to the process and rejects when it is aborted", async () => {
    mocks.execFile.mockClear();
    const controller = new AbortController();
    const abortError = new DOMException("Cancelled", "AbortError");
    mocks.execFile.mockImplementation((_file: string, _args: string[], options: { signal: AbortSignal }, callback: ExecFileCallback) => {
      expect(options.signal).toBe(controller.signal);
      options.signal.addEventListener("abort", () => callback(abortError), { once: true });
    });
    const conversion = convertLibreOfficeToPdf("uploads/cancel.docx", "output/cancel.pdf", controller.signal);
    const rejected = expect(conversion).rejects.toBe(abortError);
    await vi.waitFor(() => expect(mocks.execFile).toHaveBeenCalledOnce());
    controller.abort();
    await rejected;
  });

  it("rejects a successful process that did not create a PDF", async () => {
    runExecFileCallback(null);
    mocks.open.mockRejectedValueOnce(new Error("Missing output PDF"));
    await expect(convertLibreOfficeToPdf("uploads/missing.docx", "output/missing.pdf"))
      .rejects.toThrow("Missing output PDF");
  });

  it("rejects empty or non-PDF output instead of reporting success", async () => {
    runExecFileCallback(null);
    mocks.open.mockResolvedValueOnce({
      read: vi.fn(async (buffer: Buffer) => { buffer.write("WRONG"); return { bytesRead: 5 }; }),
      stat: vi.fn().mockResolvedValue({ size: 100 }), close: vi.fn(),
    });
    await expect(convertLibreOfficeToPdf("uploads/invalid.docx", "output/invalid.pdf"))
      .rejects.toThrow("invalid PDF");
  });
  it("runs LibreOffice headlessly with an enforced timeout", async () => {
    runExecFileCallback(null);
    mocks.open.mockResolvedValue({
      read: vi.fn(async (buffer: Buffer) => { buffer.write("%PDF-"); return { bytesRead: 5 }; }),
      stat: vi.fn().mockResolvedValue({ size: 100 }),
      close: vi.fn(),
    });

    await expect(
      convertLibreOfficeToPdf("uploads/document.docx", "output/document.pdf"),
    ).resolves.toBeUndefined();

    expect(mocks.execFile).toHaveBeenCalledWith(
      LIBRE_OFFICE_PATH,
      [
        expect.stringMatching(/^-env:UserInstallation=file:/),
        "--headless",
        "--convert-to",
        "pdf",
        "--outdir",
        "output",
        "uploads/document.docx",
      ],
      {
        timeout: LIBRE_OFFICE_TIMEOUT_MS,
        killSignal: "SIGKILL",
        windowsHide: true,
      },
      expect.any(Function),
    );
  });

  it("returns a friendly error when LibreOffice times out", async () => {
    const timeoutError = Object.assign(new Error("Process timed out"), {
      killed: true,
    });
    runExecFileCallback(timeoutError);

    await expect(
      convertLibreOfficeToPdf("uploads/document.docx", "output/document.pdf"),
    ).rejects.toBeInstanceOf(LibreOfficeTimeoutError);
  });
  it("rejects when LibreOffice reports an error", async () => {
    const error = Object.assign(new Error("LibreOffice is unavailable"), {
      code: "ENOENT",
    });
    runExecFileCallback(error);

    await expect(
      convertLibreOfficeToPdf("uploads/document.docx", "output/document.pdf"),
    ).rejects.toBe(error);
  });

  it("runs simultaneous conversions in sequence", async () => {
    const callbacks: ExecFileCallback[] = [];
    mocks.execFile.mockClear();
    mocks.execFile.mockImplementation((_file: string, _args: string[], _options: object, callback: ExecFileCallback) => {
      callbacks.push(callback);
    });
    mocks.open.mockResolvedValue({
      read: vi.fn(async (buffer: Buffer) => { buffer.write("%PDF-"); return { bytesRead: 5 }; }),
      stat: vi.fn().mockResolvedValue({ size: 100 }), close: vi.fn(),
    });
    const first = convertLibreOfficeToPdf("uploads/one.docx", "output/one.pdf");
    const second = convertLibreOfficeToPdf("uploads/two.docx", "output/two.pdf");
    await vi.waitFor(() => expect(callbacks).toHaveLength(1));
    callbacks[0](null);
    await first;
    await vi.waitFor(() => expect(callbacks).toHaveLength(2));
    callbacks[1](null);
    await second;
  });
});
