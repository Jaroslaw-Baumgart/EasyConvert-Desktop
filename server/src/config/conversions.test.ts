import { describe, expect, it, vi } from "vitest";

import {
  allowedExtensions,
  allowedMimeTypes,
  conversionDefinitions,
} from "./conversions";

describe("conversionDefinitions", () => {
  it("defines each conversion type only once", () => {
    const conversionTypes = conversionDefinitions.map(
      (definition) => definition.conversionType,
    );

    expect(new Set(conversionTypes).size).toBe(conversionTypes.length);
  });

  it("provides a handler, source extension and MIME type for every conversion", () => {
    for (const definition of conversionDefinitions) {
      expect(definition.sourceExtension).not.toBe("");
      expect(definition.mimeType).not.toBe("");
      expect(definition.handler).toEqual(expect.any(Function));
    }
  });

  it("derives allowed file extensions and MIME types from the definitions", () => {
    for (const definition of conversionDefinitions) {
      expect(allowedExtensions).toContain(
        `.${definition.sourceExtension}`,
      );
      expect(allowedMimeTypes).toContain(definition.mimeType);
    }

    expect(new Set(allowedExtensions).size).toBe(allowedExtensions.length);
    expect(new Set(allowedMimeTypes).size).toBe(allowedMimeTypes.length);
  });
});
