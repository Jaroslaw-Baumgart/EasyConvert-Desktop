import type { StartConversionRequest } from "../../shared/desktopContract";
import { parsePngToJpgOptions } from "../../conversion-core/image/parsePngToJpgOptions";

export function parseStartConversionRequest(
  value: unknown,
): StartConversionRequest {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Expected a conversion request object.");
  }

  if (!("sourceId" in value)) {
    throw new Error("Missing sourceId.");
  }

  if (typeof value.sourceId !== "string") {
    throw new Error("sourceId must be a string.");
  }

  if (value.sourceId.length === 0 || value.sourceId.length > 128) {
    throw new Error(
      "sourceId must be a non-empty string with a maximum length of 128 characters.",
    );
  }

  if (!("conversion" in value)) {
    throw new Error("Missing conversion.");
  }

  if (value.conversion === "jpg-to-png") {
    return {
      sourceId: value.sourceId,
      conversion: value.conversion,
    };
  }

  if (value.conversion === "png-to-jpg") {
    if (!("options" in value)) {
      throw new Error("Missing options for PNG to JPG conversion.");
    }

    return {
      sourceId: value.sourceId,
      conversion: value.conversion,
      options: parsePngToJpgOptions(value.options),
    };
  }

  throw new Error("Unsupported conversion.");
}
