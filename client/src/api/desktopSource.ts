import type {
  EasyConvertApi,
  SelectedSource,
} from "../../../shared/desktopContract";

export async function selectDesktopSource(
  api: EasyConvertApi,
): Promise<{ source: SelectedSource; file: File } | null> {
  const result = await api.selectSource();
  if (result.status === "cancelled") {
    return null;
  }

  const response = await fetch(
    `app://easyconvert/preview/source/${encodeURIComponent(result.source.sourceId)}`,
  );

  if (!response.ok) {
    throw new Error("Could not load the selected file.");
  }

  const size = Number(response.headers.get("Content-Length"));

  if (!Number.isSafeInteger(size) || size <= 0 || size > 10_000_000) {
    throw new Error("Invalid file size.");
  }

  const blob = await response.blob();

  if (blob.size !== size) {
    throw new Error("File size does not match the response.");
  }

  const file = new File([blob], result.source.name, {
    type: blob.type,
  });

  return { source: result.source, file };
}
