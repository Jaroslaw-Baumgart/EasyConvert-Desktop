import path from "node:path";
import { strFromU8, strToU8, zip } from "fflate";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { unzipOfficeArchive } from "./officeArchive";

export type XlsxPageSettings = {
  pageSize: "A4" | "A3";
  pageOrientation: "portrait" | "landscape";
};

function parseXml(bytes: Uint8Array | undefined) {
  if (!bytes) {
    throw new Error("Missing Office XML file.");
  }
  const xml = strFromU8(bytes);
  if (/<!DOCTYPE/i.test(xml)) {
    throw new Error("Office XML must not contain a DOCTYPE.");
  }

  return new DOMParser({
    onError: (level, message) => {
      if (level !== "warning") {
        throw new Error(`Invalid Office XML: ${message}`);
      }
    },
  }).parseFromString(xml, "application/xml");
}

export async function applyXlsxPageSetup(
  archive: Uint8Array,
  sheetName: string | undefined,
  settings: XlsxPageSettings,
): Promise<Uint8Array> {
  const files = await unzipOfficeArchive(archive);
  const workbook = parseXml(files["xl/workbook.xml"]);
  const relationships = parseXml(files["xl/_rels/workbook.xml.rels"]);
  const sheets = Array.from(workbook.getElementsByTagNameNS("*", "sheet"));
  const serializer = new XMLSerializer();
  if (sheetName !== undefined) {
    const selected = sheets.find(
      (sheet) => sheet.getAttribute("name") === sheetName,
    );
    if (!selected) {
      throw new Error(`Sheet not found: ${sheetName}`);
    }
    for (const sheet of sheets) {
      if (sheet === selected) sheet.removeAttribute("state");
      else sheet.parentNode?.removeChild(sheet);
    }
    files["xl/workbook.xml"] = strToU8(serializer.serializeToString(workbook));
  }
  for (const sheet of sheets) {
    const relationshipId = sheet.getAttributeNS(
      "http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id",
    ) || sheet.getAttribute("r:id");
    const relationship = Array.from(
      relationships.getElementsByTagNameNS("*", "Relationship"),
    ).find((item) => item.getAttribute("Id") === relationshipId);
    const target = relationship?.getAttribute("Target");
    if (!target || relationship?.getAttribute("TargetMode") === "External") {
      throw new Error(`Worksheet file not found: ${sheet.getAttribute("name")}`);
    }
    const worksheetPath = path.posix.normalize(
      target.startsWith("/") ? target.slice(1) : `xl/${target}`,
    );
    if (!worksheetPath.startsWith("xl/")) {
      throw new Error("Invalid worksheet path.");
    }
    const worksheet = parseXml(files[worksheetPath]);
    const root = worksheet.documentElement;
    if (!root || root.localName !== "worksheet") {
      throw new Error("Invalid worksheet XML.");
    }
    const createElement = (name: string) =>
      worksheet.createElementNS(
        root.namespaceURI,
        root.prefix ? `${root.prefix}:${name}` : name,
      );
    let sheetPr = worksheet.getElementsByTagNameNS("*", "sheetPr").item(0);
    if (!sheetPr) {
      sheetPr = createElement("sheetPr");
      root.insertBefore(sheetPr, root.firstChild);
    }
    let setupPr = sheetPr.getElementsByTagNameNS("*", "pageSetUpPr").item(0);
    if (!setupPr) {
      setupPr = createElement("pageSetUpPr");
      sheetPr.appendChild(setupPr);
    }
    setupPr.setAttribute("fitToPage", "1");
    let setup = worksheet.getElementsByTagNameNS("*", "pageSetup").item(0);
    if (!setup) {
      setup = createElement("pageSetup");
      const following = new Set([
        "headerFooter",
        "rowBreaks",
        "colBreaks",
        "customProperties",
        "cellWatches",
        "ignoredErrors",
        "smartTags",
        "drawing",
        "legacyDrawing",
        "legacyDrawingHF",
        "picture",
        "oleObjects",
        "controls",
        "webPublishItems",
        "tableParts",
        "extLst",
      ]);
      const next = Array.from(root.childNodes).find(
        (node) => node.nodeType === 1 && following.has(node.localName ?? ""),
      );
      root.insertBefore(setup, next ?? null);
    }
    setup.removeAttribute("scale");
    setup.setAttribute("paperSize", settings.pageSize === "A3" ? "8" : "9");
    setup.setAttribute("orientation", settings.pageOrientation);
    setup.setAttribute("fitToWidth", "1");
    setup.setAttribute("fitToHeight", "1");
    files[worksheetPath] = strToU8(serializer.serializeToString(worksheet));
  }
  return new Promise((resolve, reject) => {
    zip(files, (error, bytes) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(bytes);
    });
  });
}
