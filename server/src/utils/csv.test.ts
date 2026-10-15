import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CsvLimitError, parseCsv } from "./csv";

describe("parseCsv", () => {
  it("parses headers, quoted separators and Polish characters", async () => {
    const fixturePath = path.join(
      process.cwd(),
      "src",
      "fixtures",
      "sample.csv",
    );
    const csv = await readFile(fixturePath, "utf8");

    expect(parseCsv(csv)).toEqual([
      {
        Imię: "Łukasz",
        "Nazwa produktu": "Kawa, duża",
        Ilość: "2",
        Opis: "Napój z mlekiem",
      },
      {
        Imię: "Anna",
        "Nazwa produktu": "Herbata",
        Ilość: "1",
        Opis: "Bez cukru",
      },
    ]);
  });

  it("rejects malformed CSV", () => {
    expect(() => parseCsv("Imię,Nazwa\nŁukasz")).toThrow(
      "Invalid CSV data.",
    );
  });

  it("stops parsing when the CSV exceeds the row limit", () => {
    const rows = Array.from({ length: 10_001 }, (_, index) => `${index}`);

    expect(() => parseCsv(`ID\n${rows.join("\n")}`)).toThrow(CsvLimitError);
  });

  it("stops parsing when the CSV exceeds the column limit", () => {
    const headers = Array.from({ length: 51 }, (_, index) => `Column ${index}`);
    const values = Array.from({ length: 51 }, () => "value");

    expect(() => parseCsv(`${headers.join(",")}\n${values.join(",")}`)).toThrow(
      CsvLimitError,
    );
  });
});
