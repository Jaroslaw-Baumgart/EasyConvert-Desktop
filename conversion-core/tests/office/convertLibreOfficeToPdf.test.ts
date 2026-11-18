import { afterEach, expect, it, vi } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
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
    let profile = "";
    mocks.execFile.mockImplementation((_file, args, _options, callback) => {
      profile = fileURLToPath(args[0].slice("-env:UserInstallation=".length));
      expect(path.dirname(profile)).toBe(directory);
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
      await expect(fs.stat(profile)).rejects.toMatchObject({ code: "ENOENT" });
      if (outputName !== "document.pdf") {
        await expect(fs.stat(generatedPath)).rejects.toMatchObject({ code: "ENOENT" });
      }
    } finally {
      await fs.rm(directory, { recursive: true, force: true });
    }
  },
);

it("uses the supplied LibreOffice executable and timeout", async () => {
  const directory = await fs.mkdtemp(path.join(tmpdir(), "easyconvert-office-test-"));
  const outputPath = path.join(directory, "document.pdf");
  const processError = new Error("Probe stopped intentionally");

  mocks.execFile.mockImplementation(
    (
      _file: string,
      _args: string[],
      _options: object,
      callback: (error: Error | null) => void,
    ) => callback(processError),
  );

  try {
    await expect(
      convertLibreOfficeToPdf("input/document.docx", outputPath, {
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
        directory,
        "input/document.docx",
      ],
      expect.objectContaining({
        timeout: 1234,
        windowsHide: true,
      }),
      expect.any(Function),
    );
    expect(await fs.readdir(directory)).toEqual([]);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
