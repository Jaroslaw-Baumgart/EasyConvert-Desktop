import { convertLibreOfficeToPdf as convertWithLibreOffice } from "../../../conversion-core/office/convertLibreOfficeToPdf";
import { LIBRE_OFFICE_PATH, LIBRE_OFFICE_TIMEOUT_MS } from "./constants";

export { LibreOfficeTimeoutError } from "../../../conversion-core/office/convertLibreOfficeToPdf";

export function convertLibreOfficeToPdf(
  inputPath: string,
  outputPath: string,
  signal?: AbortSignal,
): Promise<void> {
  return convertWithLibreOffice(
    inputPath,
    outputPath,
    {
      executablePath: LIBRE_OFFICE_PATH,
      timeoutMs: LIBRE_OFFICE_TIMEOUT_MS,
    },
    signal,
  );
}
