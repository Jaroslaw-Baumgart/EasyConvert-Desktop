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
  startConversion(
    request: StartConversionRequest,
  ): Promise<StartConversionResponse>;
  getJobState(): Promise<ConversionJobState>;
  onJobStateChanged(listener: (state: ConversionJobState) => void): () => void;
  resetSource(): Promise<void>;
  saveResult(resultId: string): Promise<{ status: "saved" | "cancelled" }>;
}

export type StartConversionRequest = {
  sourceId: string;
  conversion: "jpg-to-png";
};

export type StartConversionResponse = {
  jobId: string;
};

export type ConversionJobState =
  | { status: "idle" }
  | { status: "running"; jobId: string }
  | { status: "succeeded"; jobId: string; resultId: string }
  | { status: "failed"; jobId: string; message: string }
  | { status: "cancelled"; jobId: string };
