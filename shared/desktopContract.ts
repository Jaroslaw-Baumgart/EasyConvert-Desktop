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
}
