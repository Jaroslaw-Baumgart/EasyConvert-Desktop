import { _electron, test, expect, type ElectronApplication } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

async function launch(profile: string) {
  const env: Record<string, string> = {};
  for (const [name, value] of Object.entries(process.env)) {
    if (value !== undefined && name !== "ELECTRON_RUN_AS_NODE") env[name] = value;
  }
  const app = await _electron.launch({
    args: [`--user-data-dir=${profile}`, path.resolve("dist/desktop/main/index.js")], env,
  });
  await expect.poll(() => app.windows().some(p => p.url().startsWith("app://easyconvert/"))).toBe(true);
  const page = app.windows().find(p => p.url().startsWith("app://easyconvert/"))!;
  await expect(page.getByRole("link", { name: /Settings|Ustawienia/ })).toBeVisible();
  return { app, page };
}

async function close(app: ElectronApplication) {
  const exited = new Promise<void>(resolve => app.process().once("exit", () => resolve()));
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.close());
  await exited;
  await app.close();
}

test("restores preferences and window state after restart and recovers from corrupt files", async ({}, info) => {
  test.setTimeout(90_000);
  const profile = info.outputPath("profile");
  await mkdir(profile, { recursive: true });
  const outputDirectory = info.outputPath("exports");
  let current = await launch(profile);
  try {
    await current.page.getByRole("link", { name: "Settings" }).click();
    await current.page.getByRole("combobox", { name: "Interface language" }).selectOption("pl");
    await current.page.getByRole("combobox", { name: "Theme", exact: true }).selectOption("dark");
    await current.page.getByRole("radio", { name: "Purple", exact: true }).check();
    await current.app.evaluate(({ dialog }, selected) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [selected] });
    }, outputDirectory);
    await current.page.getByRole("button", { name: "Change folder" }).click();
    await expect(current.page.getByRole("textbox")).toHaveValue(outputDirectory);
    await current.page.getByRole("button", { name: "Save changes" }).click();
    await expect(current.page.getByRole("status")).toHaveText("Ustawienia zapisane.");
    const bounds = await current.app.evaluate(({ BrowserWindow, screen }) => {
      const window = BrowserWindow.getAllWindows()[0]!;
      const area = screen.getPrimaryDisplay().workArea;
      window.setBounds({ x: area.x + 20, y: area.y + 20, width: Math.min(1000, area.width - 40), height: Math.min(680, area.height - 40) });
      return window.getNormalBounds();
    });
    await close(current.app);
    const persisted = JSON.parse(await readFile(path.join(profile, "settings.json"), "utf8"));
    expect(persisted.settings).toEqual({ language: "pl", theme: "dark", accentColor: "purple", outputDirectory });
    current = await launch(profile);
    await expect(current.page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(current.page.locator("html")).toHaveAttribute("data-accent", "purple");
    expect(await current.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.getNormalBounds())).toEqual(bounds);
    await current.page.getByRole("link", { name: "Ustawienia" }).click();
    await expect(current.page.getByRole("textbox")).toHaveValue(outputDirectory);
    await current.page.getByRole("button", { name: /Maksymalizuj/ }).click();
    await expect.poll(() => current.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.isMaximized())).toBe(true);
    await close(current.app);
    current = await launch(profile);
    await expect.poll(() => current.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.isMaximized())).toBe(true);
    expect(await current.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.getNormalBounds())).toEqual(bounds);
    await close(current.app);
    await writeFile(path.join(profile, "settings.json"), "{broken json", "utf8");
    await writeFile(path.join(profile, "window-state.json"), JSON.stringify({ version: 1, bounds: {}, maximized: "invalid" }));
    current = await launch(profile);
    await expect(current.page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(current.page.locator("html")).toHaveAttribute("data-accent", "white");
    expect(await current.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.isMaximized())).toBe(false);
    await current.page.getByRole("link", { name: "Settings" }).click();
    await expect(current.page.getByRole("combobox", { name: "Interface language" })).toHaveValue("en");
    await expect(current.page.getByRole("textbox")).not.toHaveValue(outputDirectory);
  } finally {
    await current.app.close();
  }
});

test("supports keyboard navigation, preview Escape and close-dialog focus", async ({}, info) => {
  const profile = info.outputPath("profile");
  await mkdir(profile, { recursive: true });
  const { app, page } = await launch(profile);
  try {
    await page.getByRole("button", { name: "Minimize", exact: true }).focus();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Maximize or restore", exact: true })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Close", exact: true })).toBeFocused();
    await page.getByRole("link", { name: "About", exact: true }).focus();
    await page.keyboard.press("Enter");
    const { version } = JSON.parse(await readFile(path.resolve("package.json"), "utf8")) as { version: string };
    await expect(page.getByText(`Version ${version}`, { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Settings", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("combobox", { name: "Interface language" })).toBeVisible();
    await page.getByRole("button", { name: "Save changes" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("status")).toHaveText("Settings saved.");
    await page.getByRole("link", { name: "Converter", exact: true }).focus();
    await page.keyboard.press("Enter");
    await app.evaluate(({ dialog }, file) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] });
    }, path.resolve("fixtures/sample.jpg"));
    await page.getByRole("button", { name: "Choose File" }).focus();
    await page.keyboard.press("Enter");
    const expand = page.getByRole("button", { name: "Expand preview" });
    await expand.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Close preview" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Close preview" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(expand).toBeFocused();
    // Seed only the running state to inspect the dialog without racing a fast conversion.
    const registry = path.resolve("dist/desktop/main/conversions/jobRegistry.js");
    await app.evaluate((_, file) => process.getBuiltinModule("module").createRequire(file)(file).startJob(), registry);
    const closeButton = page.getByRole("button", { name: "Close", exact: true });
    await closeButton.focus();
    await page.keyboard.press("Enter");
    const back = page.getByRole("button", { name: "Go back", exact: true });
    await expect(back).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Stop and close" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(back).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(closeButton).toBeFocused();
  } finally {
    await page.screenshot({ path: info.outputPath("keyboard.png") }).catch(() => {});
    // The synthetic running job has no worker; destroy this test window during teardown.
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(window => window.destroy())).catch(() => {});
    await app.close();
  }
});
