import type {
  EasyConvertApi,
  StartConversionRequest,
} from "../../../shared/desktopContract";
import type {
  ConvertedResult,
  ConvertedResults,
} from "../types/conversionResult";
import { waitForDesktopJob } from "./waitForDesktopJob";

export async function convertDesktopFile(
  api: EasyConvertApi,
  request: StartConversionRequest,
  inputName: string,
  signal?: AbortSignal,
): Promise<ConvertedResults> {
  signal?.throwIfAborted();

  const { jobId } = await api.startConversion(request);
  const resultIds = await waitForDesktopJob(api, jobId, signal);

  signal?.throwIfAborted();

  if (resultIds.length === 0 || resultIds.length > 100) {
    throw new Error("Invalid number of conversion results.");
  }

  const extensions = {
    "jpg-to-png": ".png",
    "png-to-jpg": ".jpg",
    "jpg-to-pdf": ".pdf",
    "txt-to-pdf": ".pdf",
    "csv-to-pdf": ".pdf",
    "pdf-to-jpg": ".jpg",
  } satisfies Record<StartConversionRequest["conversion"], string>;

  const extension = extensions[request.conversion];
  const baseName = inputName.replace(/\.[^.]+$/, "");
  const results: ConvertedResult[] = [];

  for (const [index, resultId] of resultIds.entries()) {
    signal?.throwIfAborted();

    const url = `app://easyconvert/preview/result/${encodeURIComponent(resultId)}`;
    const response = await fetch(url, { signal });

    signal?.throwIfAborted();

    if (!response.ok) {
      throw new Error("Could not load the converted file.");
    }

    const size = Number(response.headers.get("Content-Length"));

    if (!Number.isSafeInteger(size) || size <= 0 || size > 100 * 1024 * 1024) {
      throw new Error("Invalid result size.");
    }

    const blob = await response.blob();

    signal?.throwIfAborted();

    if (blob.size !== size) {
      throw new Error("File size does not match the response.");
    }

    const outputName =
      resultIds.length === 1
        ? `${baseName}${extension}`
        : `${baseName}-page-${index + 1}${extension}`;

    const file = new File([blob], outputName, {
      type: blob.type,
    });

    results.push({ url, file });
  }

  const [first, ...remaining] = results;

  if (!first) {
    throw new Error("Conversion produced no results.");
  }

  return [first, ...remaining];
}
