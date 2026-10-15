type ImagePreviewData = {
  kind: "image";
  url: string;
};

type PDFPreviewData = {
  kind: "pdf";
  url: string;
};

type TextPreviewData = {
  kind: "text";
  file: File;
};

type WordPreviewData = {
  kind: "word";
  file: File;
};

type CsvPreviewData = {
  kind: "csv";
  file: File;
}

type XlsxPreviewData = {
  kind: "xlsx";
  file: File;
}

type PptxPreviewData = {
  kind: "pptx";
  file: File;
}

type UnsupportedPreviewData = {
  kind: "unsupported";
  fileType: string;
};

export type PreviewData =
  | ImagePreviewData
  | PDFPreviewData
  | TextPreviewData
  | WordPreviewData
  | CsvPreviewData
  | XlsxPreviewData
  | PptxPreviewData
  | UnsupportedPreviewData;

export type PreviewKind = PreviewData["kind"];

export type ConfiguredPreviewKind = Exclude<PreviewKind, "unsupported">;
