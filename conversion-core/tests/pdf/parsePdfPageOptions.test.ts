import { describe, expect, it } from "vitest";
import { parsePdfPageOptions } from "../../pdf/parsePdfPageOptions";

describe("parsePdfPageOptions", () => {
  it.each([
    { pageSize: "A4", pageOrientation: "portrait" },
    { pageSize: "A4", pageOrientation: "landscape" },
    { pageSize: "A3", pageOrientation: "portrait" },
    { pageSize: "A3", pageOrientation: "landscape" },
  ])("accepts $pageSize with $pageOrientation", (options) => {
    expect(parsePdfPageOptions(options)).toEqual(options);
  });

  it("returns a new object containing only allowed fields", () => {
    const input = {
      pageSize: "A4",
      pageOrientation: "portrait",
      extra: "ignored",
    };

    const result = parsePdfPageOptions(input);

    expect(result).toEqual({
      pageSize: "A4",
      pageOrientation: "portrait",
    });
    expect(result).not.toBe(input);
    expect(input).toEqual({
      pageSize: "A4",
      pageOrientation: "portrait",
      extra: "ignored",
    });
  });

  it.each([
    { label: "null", value: null },
    { label: "undefined", value: undefined },
    { label: "array", value: [] },
    { label: "string", value: "A4" },
    { label: "number", value: 42 },
    { label: "boolean", value: true },
    { label: "empty object", value: {} },
    {
      label: "missing pageSize",
      value: { pageOrientation: "portrait" },
    },
    {
      label: "missing pageOrientation",
      value: { pageSize: "A4" },
    },
  ])("rejects $label", ({ value }) => {
    expect(() => parsePdfPageOptions(value)).toThrow(
      "Invalid PDF page options.",
    );
  });

  it.each(["A5", "a4", "", 4, null, undefined])(
    "rejects invalid pageSize: %s",
    (pageSize) => {
      expect(() =>
        parsePdfPageOptions({
          pageSize,
          pageOrientation: "portrait",
        }),
      ).toThrow("Invalid PDF page options.");
    },
  );

  it.each(["sideways", "Portrait", "", 1, null, undefined])(
    "rejects invalid pageOrientation: %s",
    (pageOrientation) => {
      expect(() =>
        parsePdfPageOptions({
          pageSize: "A4",
          pageOrientation,
        }),
      ).toThrow("Invalid PDF page options.");
    },
  );
});
