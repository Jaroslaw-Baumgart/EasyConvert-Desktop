import { strToU8, zipSync } from "fflate";

const packageNs = "http://schemas.openxmlformats.org/package/2006/relationships";
const officeNs = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

function archive(parts: Record<string, string>, main: string, overrides: Record<string, string>) {
  return zipSync(Object.fromEntries(Object.entries({
    ...parts,
    "_rels/.rels": `<Relationships xmlns="${packageNs}"><Relationship Id="rId1" Type="${officeNs}/officeDocument" Target="${main}"/></Relationships>`,
    "[Content_Types].xml": `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${Object.entries(overrides).map(([name, type]) => `<Override PartName="/${name}" ContentType="application/vnd.openxmlformats-officedocument.${type}+xml"/>`).join("")}</Types>`,
  }).map(([name, xml]) => [name, strToU8(xml)])));
}

export function xlsxFixture() {
  const ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
  const sheet = (text: string) => `<worksheet xmlns="${ns}"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>${text}</t></is></c></row></sheetData></worksheet>`;
  return archive({
    "xl/workbook.xml": `<workbook xmlns="${ns}" xmlns:r="${officeNs}"><sheets><sheet name="Revenue" sheetId="1" r:id="rId1"/><sheet name="Costs" sheetId="2" r:id="rId2"/></sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": `<Relationships xmlns="${packageNs}"><Relationship Id="rId1" Type="${officeNs}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${officeNs}/worksheet" Target="worksheets/sheet2.xml"/></Relationships>`,
    "xl/worksheets/sheet1.xml": sheet("REVENUE_ONLY"),
    "xl/worksheets/sheet2.xml": sheet("COSTS_ONLY"),
  }, "xl/workbook.xml", {
    "xl/workbook.xml": "spreadsheetml.sheet.main",
    "xl/worksheets/sheet1.xml": "spreadsheetml.worksheet",
    "xl/worksheets/sheet2.xml": "spreadsheetml.worksheet",
  });
}

export function docxFixture() {
  return archive({
    "word/document.xml": `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>DOCX_MARKER Zażółć gęślą jaźń</w:t></w:r></w:p><w:sectPr/></w:body></w:document>`,
  }, "word/document.xml", { "word/document.xml": "wordprocessingml.document.main" });
}

export function pptxFixture() {
  const ns = "http://schemas.openxmlformats.org/presentationml/2006/main";
  return archive({
    "ppt/presentation.xml": `<p:presentation xmlns:p="${ns}" xmlns:r="${officeNs}"><p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst><p:sldSz cx="9144000" cy="5143500"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`,
    "ppt/_rels/presentation.xml.rels": `<Relationships xmlns="${packageNs}"><Relationship Id="rId1" Type="${officeNs}/slide" Target="slides/slide1.xml"/></Relationships>`,
    "ppt/slides/slide1.xml": `<p:sld xmlns:p="${ns}" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/><p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="500000" y="500000"/><a:ext cx="8000000" cy="1000000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="pl-PL" sz="2400"/><a:t>PPTX_MARKER</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`,
  }, "ppt/presentation.xml", {
    "ppt/presentation.xml": "presentationml.presentation.main",
    "ppt/slides/slide1.xml": "presentationml.slide",
  });
}
