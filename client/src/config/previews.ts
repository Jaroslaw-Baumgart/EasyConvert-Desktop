import type { SupportedFormat } from "./conversions";
import type { ConfiguredPreviewKind } from "../types/preview";

export const previewKindByFormat = {
  pdf: "pdf",
  jpg: "image",
  png: "image",
  txt: "text",
  docx: "word",
  csv: "csv",
  xlsx: "xlsx",
  pptx: "pptx",
} satisfies Record<SupportedFormat, ConfiguredPreviewKind>;
