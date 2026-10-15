import { expect, test } from "@playwright/test";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { inflateRawSync } from "node:zlib";

const fixturePath = (name: string) =>
  path.join(process.cwd(), "e2e", "fixtures", name);

const jpgToPngButton = /JPG.*PNG/;
const pdfToJpgButton = /PDF.*JPG/;

type ZipEntry = {
  name: string;
  contents: Buffer;
};

function readZipEntries(archive: Buffer): ZipEntry[] {
  const endOfDirectory = archive.lastIndexOf(Buffer.from("PK\x05\x06"));
  if (endOfDirectory < 0) {
    throw new Error("ZIP end-of-directory record is missing.");
  }

  const entryCount = archive.readUInt16LE(endOfDirectory + 10);
  let offset = archive.readUInt32LE(endOfDirectory + 16);
  const entries: ZipEntry[] = [];

  for (let index = 0; index < entryCount; index += 1) {
    if (archive.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error("ZIP central-directory entry is invalid.");
    }

    const compression = archive.readUInt16LE(offset + 10);
    const compressedSize = archive.readUInt32LE(offset + 20);
    const nameLength = archive.readUInt16LE(offset + 28);
    const extraLength = archive.readUInt16LE(offset + 30);
    const commentLength = archive.readUInt16LE(offset + 32);
    const localOffset = archive.readUInt32LE(offset + 42);
    const name = archive.toString("utf8", offset + 46, offset + 46 + nameLength);
    const localNameLength = archive.readUInt16LE(localOffset + 26);
    const localExtraLength = archive.readUInt16LE(localOffset + 28);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = archive.subarray(dataOffset, dataOffset + compressedSize);

    entries.push({
      name,
      contents: compression === 8 ? inflateRawSync(compressed) : compressed,
    });
    offset += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("online-file-converter-language", "en");
  });
});

test("converts a JPG file to PNG through the local server", async ({ page }) => {
  await page.goto("/");

  await page
    .getByLabel("Choose File")
    .setInputFiles(fixturePath("sample.jpg"));
  await page.getByRole("button", { name: jpgToPngButton }).click();
  await page.getByRole("button", { name: "Convert" }).click();

  const downloadButton = page.getByRole("button", { name: "Download file" });

  await expect(downloadButton).toBeVisible();
  await expect(downloadButton).toBeFocused();
  await expect(
    page.getByText("Conversion complete"),
  ).toBeVisible();
});

test("rejects an unsupported file before conversion", async ({ page }) => {
  await page.goto("/");

  await page
    .getByLabel("Choose File")
    .setInputFiles(fixturePath("unsupported.exe"));

  await expect(page.getByRole("alert")).toHaveText(
    /Unsupported file format/,
  );
});

test("converts a real two-page PDF and downloads both images as a ZIP", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Choose File").setInputFiles(fixturePath("two-pages.pdf"));
  await page.getByRole("button", { name: pdfToJpgButton }).click();
  await page.getByRole("button", { name: "Convert" }).click();
  await expect(page.getByRole("button", { name: "Page 1" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Page 2" })).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download all" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("conversion-results.zip");
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  const bytes = await readFile(downloadPath!);
  expect(bytes.subarray(0, 4).toString("hex")).toBe("504b0304");
  const entries = readZipEntries(bytes);

  expect(entries.map((entry) => entry.name)).toEqual([
    "page-1.jpg",
    "page-2.jpg",
  ]);
  expect(
    entries.every((entry) =>
      entry.contents.subarray(0, 2).equals(Buffer.from([0xff, 0xd8])),
    ),
  ).toBe(true);
});

test("shows a safe error when the conversion endpoint fails", async ({ page }) => {
  await page.route("**/convert", async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        success: false,
        code: "conversion-failed",
        error: "Test conversion failure",
      }),
    });
  });

  await page.goto("/");
  await page
    .getByLabel("Choose File")
    .setInputFiles(fixturePath("sample.jpg"));
  await page.getByRole("button", { name: jpgToPngButton }).click();
  await page.getByRole("button", { name: "Convert" }).click();

  await expect(page.getByRole("alert")).toHaveText(
    "The file could not be converted. Please try again.",
  );
});

test("shows and selects every file returned by a PDF to JPG conversion", async ({
  page,
}) => {
  await page.route("**/convert", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        success: true,
        files: [
          { url: "/output/page-1.jpg", name: "page-1.jpg" },
          { url: "/output/page-2.jpg", name: "page-2.jpg" },
        ],
      }),
    });
  });

  await page.route("**/output/page-*.jpg", async (route) => {
    await route.fulfill({
      contentType: "image/jpeg",
      headers: { "Access-Control-Allow-Origin": "*" },
      path: fixturePath("sample.jpg"),
    });
  });

  await page.goto("/");
  await page
    .getByLabel("Choose File")
    .setInputFiles(fixturePath("two-pages.pdf"));
  await page.getByRole("button", { name: pdfToJpgButton }).click();
  await page.getByRole("button", { name: "Convert" }).click();

  await expect(page.getByRole("button", { name: "Page 1" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Page 2" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Download all" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Page 2" }).click();
  await expect(page.getByText("page-2.jpg")).toBeVisible();
});

test("keeps the converter usable on a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await page
    .getByLabel("Choose File")
    .setInputFiles(fixturePath("sample.jpg"));

  await expect(
    page.getByRole("heading", { name: "1. File preview" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "2. Convert this file" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: jpgToPngButton })).toBeVisible();

  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});
