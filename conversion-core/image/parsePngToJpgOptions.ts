import type { PngToJpgOptions } from "../../shared/conversionOptions";

export function parsePngToJpgOptions(value: unknown): PngToJpgOptions {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Invalid PNG to JPG options.");
  }

  if (
    !("quality" in value) ||
    typeof value.quality !== "number" ||
    !Number.isInteger(value.quality) ||
    value.quality < 1 ||
    value.quality > 100
  ) {
    throw new Error("Invalid PNG to JPG options.");
  }

  if (
    !("backgroundColor" in value) ||
    typeof value.backgroundColor !== "string" ||
    !/^#[0-9a-f]{6}$/i.test(value.backgroundColor)
  ) {
    throw new Error("Invalid PNG to JPG options.");
  }

  return {
    quality: value.quality,
    backgroundColor: value.backgroundColor,
  };
}
