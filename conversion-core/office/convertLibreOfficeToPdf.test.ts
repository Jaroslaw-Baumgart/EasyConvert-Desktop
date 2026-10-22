import { expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  execFile: vi.fn(),
}));

vi.mock("child_process", () => ({
  execFile: mocks.execFile,
}));

import { convertLibreOfficeToPdf } from "./convertLibreOfficeToPdf";

it("uses the supplied LibreOffice executable and timeout", async () => {
  const processError = new Error("Probe stopped intentionally");

  mocks.execFile.mockImplementation(
    (
      _file: string,
      _args: string[],
      _options: object,
      callback: (error: Error | null) => void,
    ) => callback(processError),
  );

  await expect(
    convertLibreOfficeToPdf("input/document.docx", "output/document.pdf", {
      executablePath: "bundled/libreoffice/program/soffice.com",
      timeoutMs: 1234,
    }),
  ).rejects.toBe(processError);

  expect(mocks.execFile).toHaveBeenCalledWith(
    "bundled/libreoffice/program/soffice.com",
    [
      expect.stringMatching(/^-env:UserInstallation=file:/),
      "--headless",
      "--convert-to",
      "pdf",
      "--outdir",
      "output",
      "input/document.docx",
    ],
    expect.objectContaining({
      timeout: 1234,
      windowsHide: true,
    }),
    expect.any(Function),
  );
});
