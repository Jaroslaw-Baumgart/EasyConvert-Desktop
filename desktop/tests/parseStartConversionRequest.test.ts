import { describe, expect, it } from "vitest";
import { parseStartConversionRequest } from "../main/parseStartConversionRequest";

describe("parseStartConversionRequest", () => {
  it("returns a new JPG to PNG request containing only allowed fields", () => {
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

  it("returns a PNG to JPG request with validated options", () => {
    const input = {
      sourceId: "source-123",
      conversion: "png-to-jpg",
      options: {
        quality: 85,
        backgroundColor: "#aBc123",
        extra: "ignored",
      },
      extra: "ignored",
    };

    const result = parseStartConversionRequest(input);

    expect(result).toEqual({
      sourceId: "source-123",
      conversion: "png-to-jpg",
      options: {
        quality: 85,
        backgroundColor: "#aBc123",
      },
    });
    expect(result).not.toBe(input);

    if (result.conversion !== "png-to-jpg") {
      throw new Error("Expected PNG to JPG request.");
    }

    expect(result.options).not.toBe(input.options);
  });

  it.each(["jpg-to-png", "png-to-jpg"])(
    "accepts a maximum-length sourceId for %s",
    (conversion) => {
      const sourceId = "a".repeat(128);

      expect(
        parseStartConversionRequest({
          sourceId,
          conversion,
          options: {
            quality: 85,
            backgroundColor: "#ffffff",
          },
        }).sourceId,
      ).toBe(sourceId);
    },
  );

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
    { sourceId: "source-123", conversion: null },
    { sourceId: "source-123", conversion: 123 },
  ])("rejects invalid input: %j", (input) => {
    expect(() => parseStartConversionRequest(input)).toThrow();
  });

  it("rejects an unsupported conversion", () => {
    expect(() =>
      parseStartConversionRequest({
        sourceId: "source-123",
        conversion: "jpg-to-pdf",
      }),
    ).toThrow("Unsupported conversion.");
  });

  it("rejects PNG to JPG without options", () => {
    expect(() =>
      parseStartConversionRequest({
        sourceId: "source-123",
        conversion: "png-to-jpg",
      }),
    ).toThrow("Missing options for PNG to JPG conversion.");
  });

  it.each([
    null,
    {},
    { quality: "85", backgroundColor: "#ffffff" },
    { quality: 0, backgroundColor: "#ffffff" },
    { quality: 85, backgroundColor: "red" },
  ])("rejects invalid PNG to JPG options: %j", (options) => {
    expect(() =>
      parseStartConversionRequest({
        sourceId: "source-123",
        conversion: "png-to-jpg",
        options,
      }),
    ).toThrow("Invalid PNG to JPG options.");
  });
});
