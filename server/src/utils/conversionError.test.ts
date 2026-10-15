import { describe, expect, it } from "vitest";

import { getConversionFailureCode } from "./conversionError";

describe("getConversionFailureCode", () => {
  it("recognizes an ENOENT error as an unavailable tool", () => {
    const error = {
      code: "ENOENT",
    };

    expect(getConversionFailureCode(error)).toBe("tool-unavailable");
  });

  it("recognizes a missing soffice command on Windows", () => {
    const error = new Error(
      "'soffice' is not recognized as an internal or external command",
    );

    expect(getConversionFailureCode(error)).toBe("tool-unavailable");
  });

  it("treats other errors as conversion failures", () => {
    const error = new Error("The document is corrupted");

    expect(getConversionFailureCode(error)).toBe("conversion-failed");
  });
});
