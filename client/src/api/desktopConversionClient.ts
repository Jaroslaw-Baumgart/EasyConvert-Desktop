import type {
  EasyConvertApi,
  StartConversionRequest,
} from "../../../shared/desktopContract";
import type { ConvertedResults } from "../types/conversionResult";
import { waitForDesktopJob } from "./waitForDesktopJob";

export async function convertDesktopFile(
  api: EasyConvertApi,
  request: StartConversionRequest,
  inputName: string,
  signal?: AbortSignal,
): Promise<ConvertedResults> {
  signal?.throwIfAborted();

  const { jobId } = await api.startConversion(request);
  const resultId = await waitForDesktopJob(api, jobId, signal);

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

  const extension = request.conversion === "jpg-to-png" ? ".png" : ".jpg";
  const outputName = inputName.replace(/\.[^.]+$/, "") + extension;

  const file = new File([blob], outputName, {
    type: blob.type,
  });

  return [{ url, file }];
}
