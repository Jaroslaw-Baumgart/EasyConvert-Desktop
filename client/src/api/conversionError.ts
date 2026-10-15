export const conversionErrorCodes = [
  "network",
  "conversion-failed",
  "invalid-response",
  "download-failed",
  "tool-unavailable",
  "invalid-settings",
  "service-busy",
] as const;

export type ConversionErrorCode = (typeof conversionErrorCodes)[number];

export function isConversionErrorCode(
  value: string,
): value is ConversionErrorCode {
  return conversionErrorCodes.includes(value as ConversionErrorCode);
}

const ERROR_MESSAGES = {
  network:
    "Could not connect to the conversion service. Check your connection and try again.",
  "conversion-failed": "The file could not be converted. Please try again.",
  "invalid-response":
    "The server returned an unexpected response. Please try again.",
  "download-failed":
    "The converted file could not be downloaded. Please try again.",
  "tool-unavailable":
    "This conversion is currently unavailable. Please try again later.",
  "invalid-settings":
    "These settings cannot fit the file on the selected page. Try A3 landscape.",
  "service-busy": "The conversion service is busy. Please try again shortly.",
} satisfies Record<ConversionErrorCode, string>;

export function getConversionErrorMessage(code: ConversionErrorCode): string {
  return ERROR_MESSAGES[code];
}

export class ConversionError extends Error {
  readonly code: ConversionErrorCode;
  readonly cause: unknown;

  constructor(code: ConversionErrorCode, cause?: unknown) {
    super(getConversionErrorMessage(code));

    this.name = "ConversionError";
    this.code = code;
    this.cause = cause;
  }
}
