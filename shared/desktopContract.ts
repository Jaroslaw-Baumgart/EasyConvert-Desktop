import type {
  PdfPageOptions,
  PngToJpgOptions,
  XlsxToPdfOptions,
} from "./conversionOptions";

export type SelectedSource = {
  sourceId: string;
  name: string;
  sizeBytes: number;
};

export type SourceSelection =
  | { status: "cancelled" }
  | { status: "selected"; source: SelectedSource };

export interface EasyConvertApi {
  platform: "desktop";
  selectSource(): Promise<SourceSelection>;
  selectDroppedSource(file: File): Promise<SelectedSource>;
  startConversion(
    request: StartConversionRequest,
  ): Promise<StartConversionResponse>;
  getJobState(): Promise<ConversionJobState>;
  onJobStateChanged(listener: (state: ConversionJobState) => void): () => void;
  resetSource(): Promise<void>;
  saveResult(resultId: string): Promise<{ status: "saved" | "cancelled" }>;
  saveResultAs(resultId: string): Promise<{ status: "saved" | "cancelled" }>;
  saveArchive(resultIds: string[], saveAs?: boolean): Promise<{ status: "saved" | "cancelled" }>;
}

export type StartConversionRequest =
  | { sourceId: string; conversion: "jpg-to-png" }
  | { sourceId: string; conversion: "png-to-jpg"; options: PngToJpgOptions }
  | { sourceId: string; conversion: "jpg-to-pdf"; options: PdfPageOptions }
  | { sourceId: string; conversion: "txt-to-pdf"; options: PdfPageOptions }
  | { sourceId: string; conversion: "csv-to-pdf"; options: PdfPageOptions }
  | { sourceId: string; conversion: "pdf-to-jpg" }
  | { sourceId: string; conversion: "pdf-to-txt" }
  | { sourceId: string; conversion: "docx-to-pdf" }
  | { sourceId: string; conversion: "pptx-to-pdf" }
  | { sourceId: string; conversion: "xlsx-to-pdf"; options: XlsxToPdfOptions };

export type StartConversionResponse = {
  jobId: string;
};

export type ConversionJobState =
  | { status: "idle" }
  | { status: "running"; jobId: string }
  | { status: "succeeded"; jobId: string; resultIds: string[] }
  | { status: "failed"; jobId: string; message: string }
  | { status: "cancelled"; jobId: string };
