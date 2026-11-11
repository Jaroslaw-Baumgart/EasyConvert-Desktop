import { _electron, test as base, expect, type ElectronApplication, type Locator } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { unzipSync } from "fflate";
import { docxFixture, pptxFixture, xlsxFixture } from "./officeFixtures";

const execFileAsync = promisify(execFile);
const poppler = (name: string) => path.resolve(
  "node_modules/pdf-poppler/lib/win/poppler-0.51/bin", `${name}.exe`,
);

async function pdfText(filePath: string) {
  return (await execFileAsync(poppler("pdftotext"), [filePath, "-"], { encoding: "utf8" })).stdout;
}

async function downloadResult(app: ElectronApplication, button: Locator, output: string) {
  const transfer = await app.evaluateHandle(({ session }, outputPath) => {
    const finished = new Promise<{ state: string; filename: string }>((resolve) => {
      session.defaultSession.once("will-download", (_event, item) => {
        item.setSavePath(outputPath);
        item.once("done", (_doneEvent, state) => resolve({ state, filename: item.getFilename() }));
      });
    });
    return { finished };
  }, output);
  try {
    await button.click();
    const completed = await transfer.evaluate(({ finished }) => finished);
    expect(completed.state).toBe("completed");
    return completed.filename;
  } finally {
    await transfer.dispose();
  }
}

async function saveResultAs(app: ElectronApplication, button: Locator, output: string) {
  await app.evaluate(({ dialog }, outputPath) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: outputPath });
  }, output);
  await button.click();
  await expect.poll(async () => {
    try { return (await readFile(output)).byteLength; }
    catch { return 0; }
  }).toBeGreaterThan(0);
}

// Only OS dialogs are replaced; preload, IPC, filesystem and Sharp run for real.
const test = base.extend<{ electronApp: ElectronApplication }>({
  electronApp: async ({}, use, testInfo) => {
    const profile = testInfo.outputPath("profile");
    await mkdir(profile, { recursive: true });
    const env: Record<string, string> = {};
    for (const [name, value] of Object.entries(process.env)) {
      if (value !== undefined && name !== "ELECTRON_RUN_AS_NODE") env[name] = value;
    }
    const app = await _electron.launch({
      args: ["--user-data-dir=" + profile, path.resolve("dist/desktop/main/index.js")],
      env,
      timeout: 30_000,
    });
    const logs: string[] = [];
    app.process().stdout?.on("data", (data) => logs.push(String(data)));
    app.process().stderr?.on("data", (data) => logs.push(String(data)));
    let tracingStarted = false;
    try {
      await app.context().tracing.start({ screenshots: true, snapshots: true });
      tracingStarted = true;
      await use(app);
    } finally {
      try {
        if (tracingStarted && testInfo.status !== testInfo.expectedStatus) {
          for (const [index, window] of app.windows().entries()) {
            await window.screenshot({ path: testInfo.outputPath(`window-${index}.png`) }).catch(() => {});
          }
          await app.context().tracing.stop({ path: testInfo.outputPath("trace.zip") });
        } else if (tracingStarted) {
          await app.context().tracing.stop();
        }
        await writeFile(testInfo.outputPath("electron.log"), logs.join(""));
      } finally {
        await app.close();
      }
    }
  },
  page: async ({ electronApp }, use) => {
    // DevTools may open before the application document finishes loading.
    await expect.poll(() => electronApp.windows().some(
      (candidate) => candidate.url().startsWith("app://easyconvert/"),
    )).toBe(true);
    const window = electronApp.windows().find(
      (candidate) => candidate.url().startsWith("app://easyconvert/"),
    )!;
    await electronApp.evaluate(({ BrowserWindow }) => {
      for (const browserWindow of BrowserWindow.getAllWindows()) {
        browserWindow.webContents.closeDevTools();
      }
    });
    await window.waitForURL("app://easyconvert/");
    await window.evaluate(() => localStorage.setItem("online-file-converter-language", "en"));
    await window.reload();
    await expect(window.getByRole("button", { name: "Choose File" })).toBeVisible();
    await use(window);
  },
});

async function chooseFile(app: ElectronApplication, filePath: string | null) {
  await app.evaluate(({ dialog }, selectedPath) => {
    dialog.showOpenDialog = async () => ({
      canceled: selectedPath === null,
      filePaths: selectedPath === null ? [] : [selectedPath],
    });
  }, filePath);
}

const fixture = (name: string) => path.resolve("fixtures", name);

for (const scenario of [
  { source: "png", target: "jpg" },
  { source: "jpg", target: "pdf" },
  { source: "txt", target: "pdf" },
  { source: "csv", target: "pdf" },
  { source: "docx", target: "pdf" },
  { source: "pptx", target: "pdf" },
] as const) {
  test(`converts ${scenario.source} to ${scenario.target} and downloads real output`, async ({ electronApp, page }, testInfo) => {
    test.setTimeout(90_000);
    const input = testInfo.outputPath(`input.${scenario.source}`);
    const marker = `${scenario.source.toUpperCase()}_MARKER`;
    if (scenario.source === "png") {
      await sharp({ create: { width: 16, height: 12, channels: 4, background: "#ff0000" } }).png().toFile(input);
    } else if (scenario.source === "jpg") {
      await writeFile(input, await readFile(fixture("sample.jpg")));
    } else if (scenario.source === "docx") {
      await writeFile(input, docxFixture());
    } else if (scenario.source === "pptx") {
      await writeFile(input, pptxFixture());
    } else {
      await writeFile(input, scenario.source === "csv" ? `Name,Value\n${marker},123\n` : `${marker} Zażółć gęślą jaźń`);
    }
    await chooseFile(electronApp, input);
    await page.getByRole("button", { name: "Choose File" }).click();
    await page.getByRole("button", { name: new RegExp(`${scenario.source}.*${scenario.target}`, "i") }).click();
    await page.getByRole("button", { name: "Convert", exact: true }).click();
    const button = page.getByRole("button", { name: "Save as…", exact: true });
    await expect(button).toBeVisible({ timeout: 60_000 });
    const output = testInfo.outputPath(`result.${scenario.target}`);
    await saveResultAs(electronApp, button, output);
    if (scenario.target === "jpg") {
      const decoded = await sharp(output).raw().toBuffer({ resolveWithObject: true });
      expect(decoded.info.width).toBe(16);
      expect(decoded.info.height).toBe(12);
      expect((await sharp(output).metadata()).format).toBe("jpeg");
    } else {
      expect((await readFile(output)).subarray(0, 5).toString()).toBe("%PDF-");
      if (scenario.source !== "jpg") expect(await pdfText(output)).toContain(marker);
      if (scenario.source === "txt" || scenario.source === "docx") {
        expect(await pdfText(output)).toContain("Zażółć gęślą jaźń");
      }
    }
  });
}

for (const selection of ["Revenue", "Costs", "All sheets"]) {
  test(`exports XLSX selection: ${selection}`, async ({ electronApp, page }, testInfo) => {
    test.setTimeout(90_000);
    const input = testInfo.outputPath("workbook.xlsx");
    await writeFile(input, xlsxFixture());
    await chooseFile(electronApp, input);
    await page.getByRole("button", { name: "Choose File" }).click();
    await page.getByRole("button", { name: selection, exact: true }).click();
    await page.getByRole("button", { name: /XLSX.*PDF/ }).click();
    await page.getByLabel("A3", { exact: true }).check();
    await page.getByLabel("Landscape", { exact: true }).check();
    await page.getByRole("button", { name: "Convert", exact: true }).click();
    const button = page.getByRole("button", { name: "Save as…", exact: true });
    await expect(button).toBeVisible({ timeout: 60_000 });
    const output = testInfo.outputPath("workbook.pdf");
    await saveResultAs(electronApp, button, output);
    const text = await pdfText(output);
    if (selection !== "Costs") expect(text).toContain("REVENUE_ONLY");
    else expect(text).not.toContain("REVENUE_ONLY");
    if (selection !== "Revenue") expect(text).toContain("COSTS_ONLY");
    else expect(text).not.toContain("COSTS_ONLY");
    const { stdout } = await execFileAsync(poppler("pdfinfo"), [output], { encoding: "utf8" });
    expect(stdout).toMatch(/Page size:\s+1190\.\d+ x 841\.\d+ pts/);
  });
}

test("extracts PDF text through the desktop and downloads both pages", async ({ electronApp, page }, testInfo) => {
  await chooseFile(electronApp, fixture("two-pages.pdf"));
  await page.getByRole("button", { name: "Choose File" }).click();
  await page.getByRole("button", { name: /PDF.*TXT/ }).click();
  await page.getByRole("button", { name: "Convert", exact: true }).click();
  const button = page.getByRole("button", { name: "Save as…", exact: true });
  await expect(button).toBeVisible();
  const output = testInfo.outputPath("two-pages.txt");
  await saveResultAs(electronApp, button, output);
  expect(await readFile(output, "utf8")).toMatch(/Page 1[\s\S]*Page 2/);
});

test("converts PDF pages, downloads their ZIP and resets all previews", async ({ electronApp, page }, testInfo) => {
  await chooseFile(electronApp, fixture("two-pages.pdf"));
  await page.getByRole("button", { name: "Choose File" }).click();
  await page.getByRole("button", { name: /PDF.*JPG/ }).click();
  await page.getByRole("button", { name: "Convert", exact: true }).click();
  const downloads = page.getByRole("button", { name: "Save as…", exact: true });
  await expect(downloads).toBeVisible();
  await expect(page.getByRole("button", { name: "Page 1", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Page 2", exact: true })).toBeVisible();
  const individualPages: Buffer[] = [];
  for (const number of [1, 2]) {
    await page.getByRole("button", { name: `Page ${number}`, exact: true }).click();
    const individual = testInfo.outputPath(`page-${number}.jpg`);
    await saveResultAs(electronApp, downloads, individual);
    individualPages.push(await readFile(individual));
  }
  const output = testInfo.outputPath("pages.zip");
  await downloadResult(electronApp, page.getByRole("button", { name: "Download all", exact: true }), output);
  const files = unzipSync(await readFile(output));
  expect(Object.keys(files).sort()).toEqual(["two-pages-page-1.jpg", "two-pages-page-2.jpg"]);
  for (const [index, name] of Object.keys(files).sort().entries()) {
    const bytes = files[name];
    expect(Buffer.from(bytes).equals(individualPages[index])).toBe(true);
    expect((await sharp(bytes).metadata()).format).toBe("jpeg");
    expect((await sharp(bytes).raw().toBuffer()).length).toBeGreaterThan(0);
  }
  await page.getByRole("button", { name: /remove/i }).click();
  await expect(downloads).toHaveCount(0);
  await expect(page.getByRole("img", { name: "Preview", exact: true })).toHaveCount(0);
});

test("converts JPG through IPC and downloads a real PNG without an HTTP server", async ({ electronApp, page }, testInfo) => {
  await chooseFile(electronApp, fixture("sample.jpg"));
  await page.getByRole("button", { name: "Choose File" }).click();
  await expect(page.getByRole("img", { name: "Preview", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /JPG.*PNG/ }).click();
  await page.getByRole("button", { name: "Convert", exact: true }).click();
  const download = page.getByRole("button", { name: "Save", exact: true });
  await expect(download).toBeVisible();
  await expect(download).toBeFocused();
  await expect(page.getByText("Conversion complete", { exact: true })).toBeVisible();
  const previews = page.getByRole("img", { name: "Preview", exact: true });
  await expect(previews).toHaveCount(2);
  await expect.poll(() => previews.evaluateAll((images) => images.map((element) => {
    const image = element as HTMLImageElement;
    return image.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
  }))).toEqual([true, true]);
  await expect(page.getByText("sample.png", { exact: true })).toBeVisible();
  const output = testInfo.outputPath("sample.png");
  await saveResultAs(electronApp, page.getByRole("button", { name: "Save as…", exact: true }), output);

  const bytes = await readFile(output);
  expect((await sharp(bytes).metadata()).format).toBe("png");
  const actual = await sharp(bytes, { failOn: "warning" })
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const expected = await sharp(fixture("sample.jpg"))
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  expect(actual.info.width).toBe(expected.info.width);
  expect(actual.info.height).toBe(expected.info.height);
  expect(actual.data.equals(expected.data)).toBe(true);

  const desktopDirectory = testInfo.outputPath("desktop");
  await mkdir(desktopDirectory, { recursive: true });
  await electronApp.evaluate(({ app }, directory) => app.setPath("desktop", directory), desktopDirectory);
  for (const name of ["sample.png", "sample (1).png"]) {
    await download.click();
    const savedPath = path.join(desktopDirectory, "EasyConvert Output", name);
    await expect.poll(async () => {
      try { return (await readFile(savedPath)).equals(bytes); }
      catch { return false; }
    }).toBe(true);
  }
});

test("cancels the native dialog and allows another selection", async ({ electronApp, page }) => {
  await chooseFile(electronApp, null);
  await page.getByRole("button", { name: "Choose File" }).click();
  await expect(page.getByRole("button", { name: "Choose File" })).toBeEnabled();
  await expect(page.getByRole("img", { name: "Preview", exact: true })).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await chooseFile(electronApp, fixture("sample.jpg"));
  await page.getByRole("button", { name: "Choose File" }).click();
  await expect(page.getByText("sample.jpg", { exact: true })).toBeVisible();
});

test("rejects an unsupported dropped file before conversion", async ({ page }) => {
  await page.evaluate(() => {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(new File(["unsupported"], "unsupported.exe"));
    document.querySelector("section[aria-label='Upload File']")!.dispatchEvent(
      new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer }),
    );
  });
  await expect(page.getByRole("alert")).toContainText("Unsupported file format");
  await expect(page.getByRole("button", { name: "Convert", exact: true })).toHaveCount(0);
});

test("shows a safe error when the real worker rejects invalid JPG bytes", async ({ electronApp, page }, testInfo) => {
  const input = testInfo.outputPath("broken.jpg");
  await writeFile(input, "This is not an image.");
  await chooseFile(electronApp, input);
  await page.getByRole("button", { name: "Choose File" }).click();
  await page.getByRole("button", { name: /JPG.*PNG/ }).click();
  await page.getByRole("button", { name: "Convert", exact: true }).click();
  await expect(page.getByRole("alert").filter({
    hasText: "The file could not be converted. Please try again.",
  })).toBeVisible();
});

test("registers a dropped disk file and converts it", async ({ page }) => {
  // A test-only input obtains a real disk-backed File, unlike new File([...]).
  await page.evaluate(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.id = "e2e-disk-file";
    input.hidden = true;
    document.body.append(input);
  });
  await page.locator("#e2e-disk-file").setInputFiles(fixture("sample.jpg"));
  await page.evaluate(() => {
    const input = document.querySelector<HTMLInputElement>("#e2e-disk-file")!;
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(input.files![0]);
    document.querySelector("section[aria-label='Upload File']")!.dispatchEvent(
      new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer }),
    );
    input.remove();
  });
  await expect(page.getByText("sample.jpg", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /JPG.*PNG/ }).click();
  await page.getByRole("button", { name: "Convert", exact: true }).click();
  await expect(page.getByText("Conversion complete", { exact: true })).toBeVisible();
});

test("keeps hash navigation and the converter usable on a narrow window", async ({ electronApp, page }) => {
  const windowHandle = await electronApp.browserWindow(page);
  await windowHandle.evaluate((browserWindow) => browserWindow.setSize(390, 844));
  await page.getByRole("link", { name: "About", exact: true }).click();
  await expect(page).toHaveURL("app://easyconvert/#/about");
  await page.getByRole("link", { name: "Privacy", exact: true }).click();
  await expect(page).toHaveURL("app://easyconvert/#/privacy");
  await page.getByRole("link", { name: "Converter", exact: true }).click();
  await chooseFile(electronApp, fixture("sample.jpg"));
  await page.getByRole("button", { name: "Choose File" }).click();
  await expect(page.getByRole("heading", { name: "1. File preview" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "2. Convert this file" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
