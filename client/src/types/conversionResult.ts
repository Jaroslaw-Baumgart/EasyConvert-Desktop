export type ConvertedResult = {
  readonly url: string;
  readonly file: File;
};

export type ConvertedResults = readonly [ConvertedResult, ...ConvertedResult[]];
