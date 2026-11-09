export type PngToJpgOptions = {
  quality: number;
  backgroundColor: string;
};

export type PdfPageOptions = {
  pageSize: "A4" | "A3";
  pageOrientation: "portrait" | "landscape";
};

export type XlsxToPdfOptions = PdfPageOptions & {
  sheetName?: string;
};
