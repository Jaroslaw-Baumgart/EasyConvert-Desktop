import { describe, expect, it } from "vitest";

import { conversions } from "./conversions";

describe("conversions configuration", () => {
  it("contains at least one conversion", () => {
    expect(conversions.length).toBeGreaterThan(0);
  });

  it("contains unique conversion types", () => {
    const conversionTypes = conversions.map(
      (conversion) => conversion.conversionType,
    );

    const uniqueConversionTypes = new Set(conversionTypes);

    expect(uniqueConversionTypes.size).toBe(conversionTypes.length);
  });

  it("matches each conversion type with its source and target formats", () => {
    for (const conversion of conversions) {
      const expectedConversionType = `${conversion.sourceFormat}-to-${conversion.targetFormat}`;

      expect(conversion.conversionType).toBe(expectedConversionType);
    }
  });
});
