import { describe, expect, it } from "vitest";

import { parseConversionResponse } from "./conversionResponse";

describe("parseConversionResponse", () => {
  it("rejects a response without required fields", () => {
    const result = parseConversionResponse({});

    expect(result).toBeNull();
  });

  it("accepts a successful response with one file", () => {
    const response = {
      success: true,
      files: [
        {
          url: "/output/converted.png",
          name: "converted.png",
        },
      ],
    };

    const result = parseConversionResponse(response);

    expect(result).toEqual(response);
  });

  it("accepts an error response", () => {
    const response = {
      success: false,
      error: "Conversion failed",
      code: "conversion-failed",
    };

    const result = parseConversionResponse(response);

    expect(result).toEqual(response);
  });

  it("accepts a successful response with multiple files", () => {
    const response = {
      success: true,
      files: [
        {
          url: "/output/page-1.jpg",
          name: "page-1.jpg",
        },
        {
          url: "/output/page-2.jpg",
          name: "page-2.jpg",
        },
      ],
    };

    const result = parseConversionResponse(response);

    expect(result).toEqual(response);
  });

  it.each([
    {
      success: true,
      files: [],
    },
    {
      success: true,
      files: [{ url: "/output/file.png" }],
    },
    {
      success: false,
    },
    {
      success: "true",
      files: [
        {
          url: "/output/file.png",
          name: "file.png",
        },
      ],
    },
  ])("rejects an invalid response %o", (response) => {
    const result = parseConversionResponse(response);

    expect(result).toBeNull();
  });

  it("accepts a tool-unavailable error response", () => {
    const response = {
      success: false,
      error: "soffice is unavailable",
      code: "tool-unavailable",
    };

    const result = parseConversionResponse(response);

    expect(result).toEqual(response);
  });
});
