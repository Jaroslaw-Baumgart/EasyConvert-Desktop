import { afterEach, describe, expect, it } from "vitest";
import {
  clearSource,
  getSourcePath,
  registerSource,
} from "../main/sourceRegistry";

afterEach(() => {
  clearSource();
});

describe("sourceRegistry", () => {
  it("registers a path under an opaque identifier", () => {
    const sourcePath = "C:/fixtures/photo.jpg";
    const sourceId = registerSource(sourcePath);

    expect(sourceId).toEqual(expect.any(String));
    expect(sourceId.length).toBeGreaterThan(0);
    expect(sourceId).not.toBe(sourcePath);
    expect(getSourcePath(sourceId)).toBe(sourcePath);
  });

  it("rejects an identifier when no source is registered", () => {
    expect(() => getSourcePath("unknown")).toThrow("Unknown source.");
  });

  it("rejects a foreign identifier", () => {
    registerSource("C:/fixtures/photo.jpg");

    expect(() => getSourcePath("unknown")).toThrow("Unknown source.");
  });

  it("invalidates the previous identifier after a new registration", () => {
    const firstId = registerSource("C:/fixtures/first.jpg");
    const secondId = registerSource("C:/fixtures/second.jpg");

    expect(secondId).not.toBe(firstId);
    expect(getSourcePath(secondId)).toBe("C:/fixtures/second.jpg");
    expect(() => getSourcePath(firstId)).toThrow("Unknown source.");
  });

  it("invalidates the identifier when cleared", () => {
    const sourceId = registerSource("C:/fixtures/photo.jpg");

    clearSource();

    expect(() => getSourcePath(sourceId)).toThrow("Unknown source.");
  });
});
