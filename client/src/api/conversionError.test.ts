import { describe, expect, it } from "vitest";

import {
  getConversionErrorMessage,
  ConversionError,
  type ConversionErrorCode,
} from "./conversionError";

const cases: Array<[ConversionErrorCode, string]> = [
  [
    "network",
    "Could not connect to the conversion service. Check your connection and try again.",
  ],
  ["conversion-failed", "The file could not be converted. Please try again."],
  [
    "invalid-response",
    "The server returned an unexpected response. Please try again.",
  ],
  [
    "download-failed",
    "The converted file could not be downloaded. Please try again.",
  ],
  [
    "tool-unavailable",
    "This conversion is currently unavailable. Please try again later.",
  ],
];

describe("getConversionErrorMessage", () => {
  it.each(cases)("maps %s to its user-facing message", (code, expected) => {
    expect(getConversionErrorMessage(code)).toBe(expected);
  });
});

describe("ConversionError", () => {
  it("stores the error code and original cause", () => {
    const cause = new TypeError("Filed to fetch");

    const error = new ConversionError("network", cause);

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ConversionError);
    expect(error.name).toBe("ConversionError");
    expect(error.code).toBe("network");
    expect(error.message).toBe(
      "Could not connect to the conversion service. Check your connection and try again.",
    );
    expect(error.cause).toBe(cause);
  });
});
