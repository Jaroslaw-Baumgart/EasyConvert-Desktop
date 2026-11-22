import { describe, expect, it } from "vitest";
import { parseCsvFile } from "./csv";

describe("parseCsvFile", () => {
  it("parses a CSV File with headers, quoted separators and Polish characters", async () => {
    const file = new File(
      [
        `Imię,Nazwa produktu,Ilość,Opis
Łukasz,"Kawa, duża",2,"Napój z mlekiem"
Anna,Herbata,1,"Bez cukru"`,
      ],
      "sample.csv",
      { type: "text/csv" },
    );

    await expect(parseCsvFile(file)).resolves.toEqual([
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

  it("rejects malformed CSV", async () => {
    const file = new File(["Imię,Nazwa produktu\nŁukasz"], "invalid.csv", {
      type: "text/csv",
    });

    await expect(parseCsvFile(file)).rejects.toThrow("Invalid CSV data.");
  });
});
