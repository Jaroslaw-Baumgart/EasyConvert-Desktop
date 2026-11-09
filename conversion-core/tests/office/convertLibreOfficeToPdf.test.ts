import { afterEach, expect, it, vi } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";

afterEach(() => vi.resetAllMocks());

const mocks = vi.hoisted(() => ({
  execFile: vi.fn(),
}));

vi.mock("child_process", () => ({
  execFile: mocks.execFile,
}));

import { convertLibreOfficeToPdf } from "../../office/convertLibreOfficeToPdf";

it.each(["document.pdf", "result.pdf"])(
  "validates the generated PDF at the requested name %s",
  async (outputName) => {
    const directory = await fs.mkdtemp(path.join(tmpdir(), "easyconvert-office-test-"));
    const generatedPath = path.join(directory, "document.pdf");
    const outputPath = path.join(directory, outputName);
    const content = "%PDF-1.7\nTest output";
    mocks.execFile.mockImplementation((_file, _args, _options, callback) => {
      void fs.writeFile(generatedPath, content).then(
        () => callback(null),
        (error) => callback(error),
      );
    });

    try {
      await convertLibreOfficeToPdf("input/document.docx", outputPath, {
        executablePath: "soffice.com",
        timeoutMs: 1234,
      });
      expect(await fs.readFile(outputPath, "utf8")).toBe(content);
      if (outputName !== "document.pdf") {
        await expect(fs.stat(generatedPath)).rejects.toMatchObject({ code: "ENOENT" });
      }
    } finally {
      await fs.rm(directory, { recursive: true, force: true });
    }
  },
);

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
