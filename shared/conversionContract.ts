export const backendConversionErrorCodes = [
  "conversion-failed",
  "tool-unavailable",
  "invalid-settings",
  "service-busy",
] as const;

export type BackendConversionErrorCode =
  (typeof backendConversionErrorCodes)[number];

export type FileItem = {
  url: string;
  name: string;
};

export type ConversionSuccessResponse = {
  success: true;
  files: [FileItem, ...FileItem[]];
};

export type ConversionErrorResponse = {
  success: false;
  error: string;
  code: BackendConversionErrorCode;
};

export type ConversionResponse =
  | ConversionSuccessResponse
  | ConversionErrorResponse;

export function isBackendConversionErrorCode(
  value: unknown,
): value is BackendConversionErrorCode {
  return (
    typeof value === "string" &&
    backendConversionErrorCodes.includes(value as BackendConversionErrorCode)
  );
}
