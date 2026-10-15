import type { BackendConversionErrorCode } from "../../../shared/conversionContract";

export function getConversionFailureCode(
  error: unknown,
): BackendConversionErrorCode {
  if (typeof error === "object" && error !== null && "code" in error) {
    if (error.code === "ENOENT") {
      return "tool-unavailable";
    }
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (
      message.includes("soffice") &&
      (message.includes("not recognized") || message.includes("not found"))
    ) {
      return "tool-unavailable";
    }
  }
  return "conversion-failed";
}
