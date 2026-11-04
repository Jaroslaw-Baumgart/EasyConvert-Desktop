import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { convertJpgToPdf } from "../../image/convertJpgToPdf";
import { convertTxtToPdf } from "../../pdf/convertTxtToPdf";
import { convertCsvToPdf, CsvInputError } from "../../pdf/convertCsvToPdf";

const execute = promisify(execFile);
const fonts = path.resolve(__dirname, "../../../assets/fonts");
const regular = path.join(fonts, "NotoSans-Regular.ttf");
const bold = path.join(fonts, "NotoSans-Bold.ttf");
let directory: string;

async function inspect(tool: "pdfinfo" | "pdftotext", file: string) {
  const executable = process.platform === "win32" ? `${tool}.exe` : tool;
  const command = process.env.POPPLER_BIN
    ? path.join(process.env.POPPLER_BIN, executable)
    : executable;
  const args = tool === "pdftotext" ? ["-enc", "UTF-8", file, "-"] : [file];
  const { stdout } = await execute(command, args, {
    encoding: "utf8", windowsHide: true, timeout: 15000, maxBuffer: 4 * 1024 * 1024,
  });
  return stdout;
}

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "easyconvert-core-pdf-"));
});

afterEach(async () => {
  if (!path.resolve(directory).startsWith(path.join(tmpdir(), "easyconvert-core-pdf-"))) {
    throw new Error("Unexpected temporary test directory.");
  }
  await rm(directory, { recursive: true, force: true });
});

describe("PDF output without HTTP", () => {
  it.each([
    { pageSize: "A4", pageOrientation: "portrait", width: 595.28, height: 841.89 },
    { pageSize: "A4", pageOrientation: "landscape", width: 841.89, height: 595.28 },
    { pageSize: "A3", pageOrientation: "portrait", width: 841.89, height: 1190.55 },
    { pageSize: "A3", pageOrientation: "landscape", width: 1190.55, height: 841.89 },
  ] as const)("preserves Polish TXT and $pageSize $pageOrientation", async ({ pageSize, pageOrientation, width, height }) => {
    const input = path.join(directory, "input.txt");
    const output = path.join(directory, "output.pdf");
    const text = "Zażółć gęślą jaźń.\n\nDrugi akapit. KONIEC";
    await writeFile(input, text, "utf8");
    await convertTxtToPdf(input, output, { pageSize, pageOrientation }, regular);
    expect(await inspect("pdftotext", output)).toContain("Zażółć gęślą jaźń.");
    expect(await inspect("pdftotext", output)).toContain("Drugi akapit. KONIEC");
    const info = await inspect("pdfinfo", output);
    expect(info).toMatch(/^Pages:\s+1\s*$/m);
    const dimensions = info.match(/^Page size:\s+([\d.]+) x ([\d.]+)/m);
    expect(Number(dimensions?.[1])).toBeCloseTo(width, 1);
    expect(Number(dimensions?.[2])).toBeCloseTo(height, 1);
  });

  it("creates a one-page A3 landscape PDF from an actual JPEG", async () => {
    const input = path.join(directory, "input.jpg");
    const output = path.join(directory, "output.pdf");
    await sharp({ create: { width: 32, height: 24, channels: 3, background: "red" } }).jpeg().toFile(input);
    await convertJpgToPdf(input, output, { pageSize: "A3", pageOrientation: "landscape" });
    const info = await inspect("pdfinfo", output);
    expect(info).toMatch(/^Pages:\s+1\s*$/m);
    expect(info).toMatch(/^Page size:\s+1190\.55 x 841\.89/m);
    expect((await readFile(output)).subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("preserves every long CSV cell segment across multiple PDF pages", async () => {
    const input = path.join(directory, "input.csv");
    const output = path.join(directory, "output.pdf");
    await writeFile(input, `ID,Opis\n1,"${"Zażółć gęślą jaźń ".repeat(1500)} KONIEC"`, "utf8");
    await convertCsvToPdf(input, output, { pageSize: "A4", pageOrientation: "portrait" }, regular, bold);
    // Repeated page headers can appear between two segments of the same cell.
    const text = (await inspect("pdftotext", output)).replace(/ID|Opis|\s+/g, "");
    expect(text.match(/Zażółćgęśląjaźń/g)).toHaveLength(1500);
    expect(text).toContain("KONIEC");
    const info = await inspect("pdfinfo", output);
    expect(Number(info.match(/^Pages:\s+(\d+)/m)?.[1])).toBeGreaterThan(1);
  });

  it.each([
    { label: "row limit", csv: `ID\n${"1\n".repeat(10001)}` },
    { label: "cell limit", csv: `ID\n${"a".repeat(50001)}` },
    { label: "empty input", csv: "" },
  ])("rejects CSV $label without producing a PDF", async ({ csv }) => {
    const input = path.join(directory, "input.csv");
    const output = path.join(directory, "output.pdf");
    await writeFile(input, csv, "utf8");
    await expect(convertCsvToPdf(input, output, { pageSize: "A4", pageOrientation: "portrait" }, regular, bold))
      .rejects.toBeInstanceOf(CsvInputError);
    await expect(readFile(output)).rejects.toMatchObject({ code: "ENOENT" });
  });
});
