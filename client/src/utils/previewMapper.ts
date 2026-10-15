import { previewKindByFormat } from "../config/previews";
import type { PreviewData, PreviewKind } from "../types/preview";

function getPreviewKind(format: string): PreviewKind {
  const matchingEntry = Object.entries(previewKindByFormat).find(
    ([supportedFormat]) => supportedFormat === format,
  );

  return matchingEntry?.[1] ?? "unsupported";
}

function assertNever(value: never): never {
  throw new Error(`Unhandled preview variant: ${JSON.stringify(value)}`);
}

export function createPreviewData(
  file: File,
  url: string,
): PreviewData {
  const format = file.name.split(".").pop()?.toLowerCase() ?? "";
  const kind = getPreviewKind(format);

  switch (kind) {
    case "image":
      return { kind, url };

    case "pdf":
      return { kind, url };

    case "text":
      return { kind, file };

    case "word":
      return { kind, file };

    case "csv":
      return { kind, file };

    case "xlsx":
      return { kind, file };

    case "pptx":
      return { kind, file };

    case "unsupported":
      return { kind, fileType: file.type };

    default:
      return assertNever(kind);
  }
}
