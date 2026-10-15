import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import fs from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import sharp from "sharp";
import { zipSync, strToU8 } from "fflate";
import { createApp } from "./app";
import { OUTPUT_DIR, MAX_CSV_ROWS, MAX_CSV_CELL_CHARACTERS } from "./utils/constants";
import { runPoppler } from "./utils/poppler";

let uploads: string;
let app: ReturnType<typeof createApp>;
const generated: string[] = [];

beforeEach(async () => {
  uploads = await fs.mkdtemp(path.join(tmpdir(), "converter-real-test-"));
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  app = createApp(uploads);
});
afterEach(async () => {
  await fs.rm(uploads, { recursive: true, force: true });
  for (const output of generated.splice(0)) await fs.rm(output, { recursive: true, force: true });
});

async function convert(content: Buffer, filename: string, conversionType: string) {
  const response = await request(app).post("/convert").field("conversionType", conversionType)
    .attach("file", content, { filename, contentType: "application/octet-stream" });
  expect(response.status, JSON.stringify(response.body)).toBe(200);
  for (const file of response.body.files as { name: string; url: string }[]) {
    generated.push(path.join(OUTPUT_DIR, file.url.slice("/output/".length)));
  }
  await vi.waitFor(async () => expect(await fs.readdir(uploads)).toEqual([]));
  return generated[generated.length - 1];
}

describe("real conversion output", () => {
  it("rejects excessive CSV cells before measuring and rendering them", async () => {
    const response = await request(app).post("/convert").field("conversionType", "csv-to-pdf")
      .attach("file", Buffer.from(`ID,Name\n1,${"a".repeat(MAX_CSV_CELL_CHARACTERS + 1)}`), { filename: "large-cell.csv", contentType: "text/csv" });
    expect(response.status).toBe(400);
    expect(response.body.error).toContain("character processing limit");
    await vi.waitFor(async () => expect(await fs.readdir(uploads)).toEqual([]));
  });
  it("creates a readable PNG with the original image dimensions", async () => {
    const source = await sharp({ create: { width: 32, height: 24, channels: 3, background: "red" } }).jpeg().toBuffer();
    const output = await convert(source, "photo.v2.jpg", "jpg-to-png");
    expect(await sharp(output).metadata()).toMatchObject({ format: "png", width: 32, height: 24 });
  });

  it("preserves Polish characters in the generated TXT PDF", async () => {
    const text = "Zażółć gęślą jaźń";
    const output = await convert(Buffer.from(text), "tekst.v2.txt", "txt-to-pdf");
    expect(await runPoppler("pdftotext", [output, "-"])).toContain(text);
  });

  it("preserves long CSV cells across multiple PDF pages", async () => {
    const source = `ID,Opis\n1,"${"Zażółć gęślą jaźń ".repeat(1500)} KONIEC"`;
    const output = await convert(Buffer.from(source), "table.csv", "csv-to-pdf");
    const text = await runPoppler("pdftotext", [output, "-"]);
    expect(text).toContain("Zażółć");
    const normalized = text.replace(/ID|Opis|\s+/g, "");
    expect(normalized).toContain("KONIEC");
    expect(normalized.match(/Zażółćgęśląjaźń/g)).toHaveLength(1500);
    const info = await runPoppler("pdfinfo", [output]);
    expect(Number(info.match(/^Pages:\s+(\d+)/m)?.[1])).toBeGreaterThan(1);
  });

  it("rejects CSVs beyond the row budget and leaves no partial PDF", async () => {
    const response = await request(app).post("/convert").field("conversionType", "csv-to-pdf")
      .attach("file", Buffer.from(`ID,Name\n${"1,Ada\n".repeat(MAX_CSV_ROWS + 1)}`), { filename: "large.csv", contentType: "text/csv" });
    expect(response.status).toBe(400);
    expect(response.body.error).toContain("processing limits");
    expect(await fs.readdir(uploads)).toEqual([]);
  });

  it("converts an actual DOCX through LibreOffice and validates its PDF content", async () => {
    const text = "Zażółć gęślą jaźń";
    const source = Buffer.from(zipSync({
      "[Content_Types].xml": strToU8('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),
      "_rels/.rels": strToU8('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'),
      "word/document.xml": strToU8(`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`),
    }));
    const output = await convert(source, "document.docx", "docx-to-pdf");
    expect(await runPoppler("pdftotext", [output, "-"])).toContain(text);
  }, 120000);
});
