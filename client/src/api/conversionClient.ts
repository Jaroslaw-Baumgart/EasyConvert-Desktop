import { buildApiUrl } from "./apiUrl";
import { ConversionError } from "./conversionError";
import { parseConversionResponse } from "./conversionResponse";
import type {
  ConvertedResult,
  ConvertedResults,
} from "../types/conversionResult";

const requestConversion = (
  formData: FormData,
  signal?: AbortSignal,
): Promise<Response> => {
  return fetch(buildApiUrl("/convert"), {
    method: "POST",
    body: formData,
    signal,
  });
};

const fetchConvertedFile = (
  maybeRelativeUrl: string,
  signal?: AbortSignal,
): Promise<Response> => {
  return fetch(buildApiUrl(maybeRelativeUrl), { signal });
};

async function readConvertedBlob(
  response: Response,
  maxBytes: number,
): Promise<Blob> {
  const declaredSize = Number(response.headers.get("Content-Length"));
  if (declaredSize > maxBytes) {
    void response.body?.cancel().catch(() => {});
    throw new Error("Converted results exceed the download limit.");
  }
  const reader = response.body?.getReader();
  if (!reader) {
    return response.blob();
  }
  const chunks: BlobPart[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        void reader.cancel().catch(() => {});
        throw new Error("Converted results exceed the download limit.");
      }
      chunks.push(Uint8Array.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return new Blob(chunks, { type: response.headers.get("Content-Type") ?? "" });
}

export async function convertFile(
  formData: FormData,
  signal?: AbortSignal,
): Promise<ConvertedResults> {
  let res: Response;

  try {
    res = await requestConversion(formData, signal);
  } catch (cause: unknown) {
    throw new ConversionError("network", cause);
  }

  let data: unknown;

  try {
    data = await res.json();
  } catch (cause: unknown) {
    throw new ConversionError("invalid-response", cause);
  }

  const conversionResponse = parseConversionResponse(data);

  if (!conversionResponse) {
    throw new ConversionError("invalid-response", data);
  }

  if (conversionResponse.success === false) {
    throw new ConversionError(
      conversionResponse.code,
      conversionResponse.error,
    );
  }

  if (!res.ok) {
    throw new ConversionError("conversion-failed", {
      status: res.status,
      response: conversionResponse,
    });
  }

  let downloadedResults: ConvertedResult[];

  try {
    downloadedResults = [];
    let totalBytes = 0;
    for (const convertedFileInfo of conversionResponse.files) {
      const convertedFileUrl = buildApiUrl(convertedFileInfo.url);

      signal?.throwIfAborted();
      const fileRes = await fetchConvertedFile(convertedFileInfo.url, signal);

      if (!fileRes.ok) {
        throw new Error(`Download failed with status ${fileRes.status}`);
      }

      const blob = await readConvertedBlob(
        fileRes,
        100 * 1024 * 1024 - totalBytes,
      );
      totalBytes += blob.size;
      if (totalBytes > 100 * 1024 * 1024) {
        throw new Error("Converted results exceed the download limit.");
      }

      const downloadedFile = new File([blob], convertedFileInfo.name, {
        type: blob.type,
      });
      downloadedResults.push({
        url: convertedFileUrl,
        file: downloadedFile,
      });
    }
  } catch (cause: unknown) {
    throw new ConversionError("download-failed", cause);
  }
  const [firstResult, ...remainingResults] = downloadedResults;

  if (!firstResult) {
    throw new ConversionError("invalid-response", conversionResponse);
  }

  const convertedResults: ConvertedResults = [firstResult, ...remainingResults];

  return convertedResults;
}
