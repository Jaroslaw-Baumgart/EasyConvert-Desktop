import { describe, expect, it } from "vitest";

import { parseApiBaseUrl } from "./environment";

describe("parseApiBaseUrl", () => {
  it("rejects a missing API base URL", () => {
    expect(() => parseApiBaseUrl(undefined)).toThrow(
      "VITE_API_BASE_URL is not configured.",
    );
  });

  it.each(["", "   "])("rejects an empty API base URL", (value) => {
    expect(() => parseApiBaseUrl(value)).toThrow(
      "VITE_API_BASE_URL is not configured.",
    );
  });

  it("returns a trimmed API base URL", () => {
    expect(parseApiBaseUrl("  http://localhost:5000  ")).toBe(
      "http://localhost:5000",
    );
  });

  it.each(["not-an-address", "ftp://files.example.com"])(
    "rejects an invalid API base URL: %s",
    (value) => {
      expect(() => parseApiBaseUrl(value)).toThrow(
        "VITE_API_BASE_URL must be a valid HTTP(S) URL.",
      );
    },
  );
});
