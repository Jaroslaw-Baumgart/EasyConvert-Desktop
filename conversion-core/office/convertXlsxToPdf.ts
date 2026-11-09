import fs from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import type { PdfPageOptions } from "../../shared/conversionOptions";
import {
  convertLibreOfficeToPdf,
  type LibreOfficeOptions,
} from "./convertLibreOfficeToPdf";
import { applyXlsxPageSetup } from "./xlsxPageSetup";
import type { XlsxToPdfOptions } from "../../shared/conversionOptions";

export async function convertXlsxToPdf(
  inputPath: string,
  outputPath: string,
  options: XlsxToPdfOptions,
  libreOfficeOptions: LibreOfficeOptions,
  signal?: AbortSignal,
): Promise<void> {
  signal?.throwIfAborted();

  const inputBytes = await fs.readFile(inputPath);
  const preparedBytes = await applyXlsxPageSetup(
    inputBytes,
    options.sheetName,
    {
      pageSize: options.pageSize,
      pageOrientation: options.pageOrientation,
    },
  );

  signal?.throwIfAborted();

  const directory = await fs.mkdtemp(path.join(tmpdir(), "easyconvert-xlsx-"));

  try {
    const preparedPath = path.join(directory, "prepared.xlsx");
    await fs.writeFile(preparedPath, preparedBytes);

    signal?.throwIfAborted();

    await convertLibreOfficeToPdf(
      preparedPath,
      outputPath,
      libreOfficeOptions,
      signal,
    );
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}
