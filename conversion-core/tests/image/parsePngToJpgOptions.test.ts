import { describe, expect, it } from "vitest";
import { parsePngToJpgOptions } from "../../image/parsePngToJpgOptions";

describe("parsePngToJpgOptions", () => {
  it.each([1, 100])("accepts quality %i", (quality) => {
    expect(
      parsePngToJpgOptions({
        quality,
        backgroundColor: "#ffffff",
      }),
    ).toEqual({
      quality,
      backgroundColor: "#ffffff",
    });
  });

  it("accepts a mixed-case hexadecimal background color", () => {
    const backgroundColor = "#aBc123";
    expect(
      parsePngToJpgOptions({
        quality: 85,
        backgroundColor,
      }),
    ).toEqual({
      quality: 85,
      backgroundColor,
    });
  });

  it("returns a new object containing only allowed fields", () => {
    const input = {
      quality: 85,
      backgroundColor: "#ffffff",
      extra: "ignored",
    };

    const result = parsePngToJpgOptions(input);

    expect(result).toEqual({
      quality: 85,
      backgroundColor: "#ffffff",
    });
    expect(result).not.toBe(input);
    expect(input.extra).toBe("ignored");
  });

  it.each([
    null,
    [],
    "options",
    { backgroundColor: "#ffffff" },
    { quality: 85 },
  ])("rejects invalid input: %j", (value) => {
    expect(() => parsePngToJpgOptions(value)).toThrow(
      "Invalid PNG to JPG options.",
    );
  });

  it.each(["85", 0, 101, 85.5, Number.NaN])("rejects invalid quality: %s", (quality) => {
    expect(() =>
      parsePngToJpgOptions({
        quality,
        backgroundColor: "#ffffff",
      }),
    ).toThrow("Invalid PNG to JPG options.");
  });

  it.each([123, "ffffff", "#fff", "#ffffffff", "#gggggg", " #ffffff"])("rejects invalid background color: %s", (backgroundColor) => {
    expect(() =>
      parsePngToJpgOptions({
        quality: 85,
        backgroundColor,
      }),
    ).toThrow("Invalid PNG to JPG options.");
  });
});
