import { describe, expect, it } from "vitest";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

import { applyXlsxPageSetup } from "./xlsxPageSetup";

const createWorkbookArchive = () =>
  zipSync({
    "[Content_Types].xml": strToU8("<Types />"),
    "xl/workbook.xml": strToU8(`
      <workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <sheets>
          <sheet name="Overview" sheetId="1" r:id="rId1" />
          <sheet name="Details" sheetId="2" r:id="rId2" />
        </sheets>
      </workbook>
    `),
    "xl/_rels/workbook.xml.rels": strToU8(`
      <Relationships>
        <Relationship
          Id="rId1"
          Target="worksheets/sheet1.xml"
        />
        <Relationship
          Id="rId2"
          Target="worksheets/sheet2.xml"
        />
      </Relationships>
    `),
    "xl/worksheets/sheet1.xml": strToU8(`
      <worksheet>
        <sheetData />
        <pageSetup
          paperSize="9"
          orientation="portrait"
          fitToWidth="1"
        />
      </worksheet>
    `),
    "xl/worksheets/sheet2.xml": strToU8(`
      <worksheet>
        <sheetData />
      </worksheet>
    `),
    "xl/charts/chart1.xml": strToU8("<chart>unchanged chart</chart>"),
  });

const readXml = (archive: Uint8Array, filePath: string) => {
  const files = unzipSync(archive);
  return strFromU8(files[filePath]);
};

describe("applyXlsxPageSetup", () => {
  it("selects sheet names containing XML entities and preserves worksheet element order", async () => {
    const files = unzipSync(createWorkbookArchive());
    files["xl/workbook.xml"] = strToU8(strFromU8(files["xl/workbook.xml"]).replace('name="Overview"', "name='Sales &amp; Costs'"));
    files["xl/worksheets/sheet2.xml"] = strToU8('<worksheet><sheetData/><drawing r:id="rId2" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/></worksheet>');
    const prepared = await applyXlsxPageSetup(zipSync(files), "Sales & Costs", { pageSize: "A4", pageOrientation: "portrait" });
    expect(readXml(prepared, "xl/workbook.xml")).toContain('name="Sales &amp; Costs"');
    expect(readXml(prepared, "xl/workbook.xml")).not.toContain('name="Details"');
    const worksheet = readXml(prepared, "xl/worksheets/sheet2.xml");
    expect(worksheet.indexOf("<pageSetup")).toBeLessThan(worksheet.indexOf("<drawing"));
  });
  it("applies page settings to every worksheet", async () => {
    const prepared = await applyXlsxPageSetup(createWorkbookArchive(), "Overview", {
      pageSize: "A3",
      pageOrientation: "landscape",
    });

    const overview = readXml(prepared, "xl/worksheets/sheet1.xml");
    const details = readXml(prepared, "xl/worksheets/sheet2.xml");

    expect(overview).toContain('paperSize="8"');
    expect(overview).toContain('orientation="landscape"');
    expect(overview).toContain('fitToWidth="1"');
    expect(overview).toContain('fitToHeight="1"');
    expect(overview).toContain('<pageSetUpPr fitToPage="1"/>');

    expect(details).toContain("<pageSetup");
    expect(details).toContain('paperSize="8"');
    expect(details).toContain('orientation="landscape"');
    expect(details).toContain('fitToWidth="1"');
    expect(details).toContain('fitToHeight="1"');
    expect(details).toContain('<pageSetUpPr fitToPage="1"/>');
  });

  it("adds page settings when the selected sheet has none", async () => {
    const prepared = await applyXlsxPageSetup(createWorkbookArchive(), "Details", {
      pageSize: "A4",
      pageOrientation: "portrait",
    });

    const overview = readXml(prepared, "xl/worksheets/sheet1.xml");
    const details = readXml(prepared, "xl/worksheets/sheet2.xml");

    expect(overview).toContain('paperSize="9"');
    expect(overview).toContain('orientation="portrait"');

    expect(details).toContain("<pageSetup");
    expect(details).toContain('paperSize="9"');
    expect(details).toContain('orientation="portrait"');
  });

  it("preserves chart files while preparing the workbook", async () => {
    const prepared = await applyXlsxPageSetup(createWorkbookArchive(), "Overview", {
      pageSize: "A3",
      pageOrientation: "landscape",
    });

    expect(readXml(prepared, "xl/charts/chart1.xml")).toBe(
      "<chart>unchanged chart</chart>",
    );
  });

  it("rejects a sheet name that does not exist", async () => {
    await expect(
      applyXlsxPageSetup(createWorkbookArchive(), "Missing sheet", {
        pageSize: "A4",
        pageOrientation: "portrait",
      }),
    ).rejects.toThrow("Sheet not found: Missing sheet");
  });

  it("handles namespaced workbook XML and absolute worksheet targets", async () => {
    const namespacedArchive = zipSync({
      "xl/workbook.xml": strToU8(`
      <x:workbook xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
        <x:sheets>
          <x:sheet name="Kategorie" sheetId="1" r:id="rId1"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" />
        </x:sheets>
      </x:workbook>
    `),
      "xl/_rels/workbook.xml.rels": strToU8(`
      <Relationships>
        <Relationship Id="rId1" Target="/xl/worksheets/sheet1.xml" />
      </Relationships>
    `),
      "xl/worksheets/sheet1.xml": strToU8(`
      <x:worksheet xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
        <x:sheetData />
      </x:worksheet>
    `),
    });

    const prepared = await applyXlsxPageSetup(namespacedArchive, "Kategorie", {
      pageSize: "A3",
      pageOrientation: "landscape",
    });

    const worksheet = readXml(prepared, "xl/worksheets/sheet1.xml");

    expect(worksheet).toContain("<x:pageSetup");
    expect(worksheet).toContain('paperSize="8"');
    expect(worksheet).toContain('orientation="landscape"');
    expect(worksheet).toContain('fitToWidth="1"');
    expect(worksheet).toContain('fitToHeight="1"');
    expect(worksheet).toContain('<x:pageSetUpPr fitToPage="1"/>');
  });

  it("keeps only the selected sheet in the workbook for PDF export", async () => {
    const archive = unzipSync(createWorkbookArchive());

    const workbookXml = strFromU8(archive["xl/workbook.xml"]).replace(
      '<sheet name="Details"',
      '<sheet name="Details" state="hidden"',
    );

    archive["xl/workbook.xml"] = strToU8(workbookXml);

    const prepared = await applyXlsxPageSetup(zipSync(archive), "Details", {
      pageSize: "A4",
      pageOrientation: "portrait",
    });

    const preparedWorkbookXml = readXml(prepared, "xl/workbook.xml");

    const overview = preparedWorkbookXml.match(
      /<sheet\b[^>]*name="Overview"[^>]*>/,
    )?.[0];

    const details = preparedWorkbookXml.match(
      /<sheet\b[^>]*name="Details"[^>]*>/,
    )?.[0];

    expect(preparedWorkbookXml).not.toContain('name="Overview"');
    expect(preparedWorkbookXml).toContain('name="Details"');
  });

  it("keeps every sheet when no sheet is selected", async () => {
    const prepared = await applyXlsxPageSetup(createWorkbookArchive(), undefined, {
      pageSize: "A3",
      pageOrientation: "landscape",
    });

    const workbookXml = readXml(prepared, "xl/workbook.xml");

    expect(workbookXml).toContain('name="Overview"');
    expect(workbookXml).toContain('name="Details"');
  });
});
