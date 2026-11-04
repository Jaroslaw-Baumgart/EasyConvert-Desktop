import { describe, expect, it, vi } from "vitest";
import { renderCsvTable } from "../../pdf/csvPdfTable";

function setup() {
  let currentFontSize = 10;

  const doc = {
    page: { width: 841.89, height: 595.28 },
    font: vi.fn(),
    fontSize: vi.fn(),
    text: vi.fn(),
    rect: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    lineWidth: vi.fn(),
    strokeColor: vi.fn(),
    fillColor: vi.fn(),
    addPage: vi.fn(),
    widthOfString: vi.fn(
      (value: string) => value.length * currentFontSize * 0.5,
    ),
    heightOfString: vi.fn((_value?: string) => 12),
  };

  doc.fontSize.mockImplementation((size: number) => {
    currentFontSize = size;
    return doc;
  });

  for (const method of [
    doc.font,
    doc.text,
    doc.rect,
    doc.fill,
    doc.stroke,
    doc.lineWidth,
    doc.strokeColor,
    doc.fillColor,
    doc.addPage,
  ]) {
    method.mockReturnValue(doc);
  }

  async function render(rows: Record<string, string>[]) {
    await renderCsvTable({
      doc: doc as unknown as PDFKit.PDFDocument,
      headers: Object.keys(rows[0] ?? {}),
      rows,
      regularFontPath: "fonts/regular.ttf",
      boldFontPath: "fonts/bold.ttf",
    });
  }

  return { doc, render };
}

describe("renderCsvTable", () => {
  it("renders headers and values as individual table cells", async () => {
    const { doc, render } = setup();

    await render([
      { ID: "1", Name: "Ada" },
      { ID: "2", Name: "Jan" },
    ]);

    const values = doc.text.mock.calls.map(([value]) => value);

    expect(values).toEqual(["ID", "Name", "1", "Ada", "2", "Jan"]);
    expect(doc.rect).toHaveBeenCalled();
    expect(doc.font).toHaveBeenCalledWith("fonts/regular.ttf");
    expect(doc.font).toHaveBeenCalledWith("fonts/bold.ttf");
  });

  it("starts a new page and repeats headers when rows exceed the page height", async () => {
    const { doc, render } = setup();

    await render(
      Array.from({ length: 25 }, (_, index) => ({
        ID: String(index + 1),
        Name: `Employee ${index + 1}`,
      })),
    );

    expect(doc.addPage).toHaveBeenCalledTimes(1);

    const values = doc.text.mock.calls.map(([value]) => value);

    expect(values.filter((value) => value === "ID")).toHaveLength(2);
    expect(values.filter((value) => value === "Name")).toHaveLength(2);

    for (let index = 1; index <= 25; index += 1) {
      expect(values).toContain(`Employee ${index}`);
    }
  });

  it("continues a tall row on following pages without losing its content", async () => {
    const { doc, render } = setup();
    const description = "A".repeat(1_000);

    doc.heightOfString.mockImplementation(
      (value?: string) => value?.length ?? 0,
    );

    await render([{ Description: description }]);

    const renderedDescription = doc.text.mock.calls
      .map(([value]) => value)
      .filter((value) => typeof value === "string" && /^A+$/.test(value))
      .join("");

    expect(doc.addPage).toHaveBeenCalled();
    expect(renderedDescription).toBe(description);

    const values = doc.text.mock.calls.map(([value]) => value);
    expect(values.filter((value) => value === "Description")).toHaveLength(
      doc.addPage.mock.calls.length + 1,
    );
  });

  it("shrinks the font to keep a wide table on one page", async () => {
    const { doc, render } = setup();
    const row = Object.fromEntries(
      Array.from({ length: 10 }, (_, index) => [
        `Column ${index + 1}`,
        "abcdefghijklmnopqrst",
      ]),
    );

    await render([row]);

    expect(doc.fontSize).toHaveBeenCalledWith(6);
    expect(doc.addPage).not.toHaveBeenCalled();
  });
});
