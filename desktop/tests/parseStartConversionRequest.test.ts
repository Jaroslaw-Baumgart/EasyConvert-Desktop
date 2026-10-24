import { describe, expect, it } from "vitest";
import { parseStartConversionRequest } from "../main/parseStartConversionRequest";

describe("parseStartConversionRequest", () => {
  it("returns a new request containing only allowed fields", () => {
    const input = {
      sourceId: "source-123",
      conversion: "jpg-to-png",
      extra: "ignored",
    };

    const result = parseStartConversionRequest(input);

    expect(result).toEqual({
      sourceId: "source-123",
      conversion: "jpg-to-png",
    });
    expect(result).not.toBe(input);
  });

  it("accepts a sourceId at the maximum length", () => {
    const sourceId = "a".repeat(128);

    expect(
      parseStartConversionRequest({
        sourceId,
        conversion: "jpg-to-png",
      }).sourceId,
    ).toBe(sourceId);
  });

  it.each([
    null,
    undefined,
    "request",
    42,
    true,
    [],
    {},
    { conversion: "jpg-to-png" },
    { sourceId: 123, conversion: "jpg-to-png" },
    { sourceId: "", conversion: "jpg-to-png" },
    { sourceId: "a".repeat(129), conversion: "jpg-to-png" },
    { sourceId: "source-123" },
    { sourceId: "source-123", conversion: "png-to-jpg" },
    { sourceId: "source-123", conversion: null },
    { sourceId: "source-123", conversion: 123 },
  ])("rejects invalid input: %j", (input) => {
    expect(() => parseStartConversionRequest(input)).toThrow();
  });
});
