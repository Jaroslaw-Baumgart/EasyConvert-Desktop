import { describe, expect, it } from "vitest";
import { createPreviewData } from "./previewMapper";

describe("createPreviewData", () => {
  it("creates CSV preview data for a CSV file", () => {
    const file = new File(["Name,Amount\nAnna,2"], "payments.csv", {
      type: "text/csv",
    });

    const preview = createPreviewData(file, "");

    expect(preview).toEqual({
      kind: "csv",
      file,
    });
  });

  it("creates XLSX preview data and preserves the loading state", () => {
    const file = new File([], "report.XLSX", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    expect(createPreviewData(file, "unused-url")).toEqual({
      kind: "xlsx",
      file,
    });
  });
});
