import { _electron, test as base, expect, type ElectronApplication } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

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

const fixture = (name: string) => path.resolve("e2e", "fixtures", name);

test("converts JPG through IPC and downloads a real PNG without an HTTP server", async ({ electronApp, page }, testInfo) => {
  await chooseFile(electronApp, fixture("sample.jpg"));
  await page.getByRole("button", { name: "Choose File" }).click();
  await expect(page.getByRole("img", { name: "Preview", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /JPG.*PNG/ }).click();
  await page.getByRole("button", { name: "Convert", exact: true }).click();
  const download = page.getByRole("button", { name: "Download file" });
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
  // Return a wrapper so evaluateHandle does not await the completion Promise
  // before the click that starts the download.
  const transfer = await electronApp.evaluateHandle(({ session }, outputPath) => {
    const finished = new Promise<{ state: string; filename: string }>((resolve) => {
      session.defaultSession.once("will-download", (_event, item) => {
        item.setSavePath(outputPath);
        item.once("done", (_doneEvent, state) => {
          resolve({ state, filename: item.getFilename() });
        });
      });
    });
    return { finished };
  }, output);
  try {
    await download.click();
    const completed = await transfer.evaluate(({ finished }) => finished);
    expect(completed).toEqual({ state: "completed", filename: "sample.png" });
  } finally {
    await transfer.dispose();
  }

  const bytes = await readFile(output);
  expect((await sharp(bytes).metadata()).format).toBe("png");
  const actual = await sharp(bytes, { failOn: "warning" })
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const expected = await sharp(fixture("sample.jpg"))
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  expect(actual.info.width).toBe(expected.info.width);
  expect(actual.info.height).toBe(expected.info.height);
  expect(actual.data.equals(expected.data)).toBe(true);
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
