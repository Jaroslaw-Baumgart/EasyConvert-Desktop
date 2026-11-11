export type ConvertedResult = {
  readonly url: string;
  readonly file: File;
  resultId: string;
};

export type ConvertedResults = readonly [ConvertedResult, ...ConvertedResult[]];
