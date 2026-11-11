import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("electron", () => ({ app: { getPath: vi.fn() } }));

import { saveResultFile } from "../main/saveResultFile";

let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "easyconvert-save-test-"));
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

it("preserves occupied names and saves Unicode names with the next free number", async () => {
  const source = path.join(directory, "source.pdf");
  await writeFile(source, "new PDF");
  await writeFile(path.join(directory, "Łódź raport.pdf"), "first PDF");
  await writeFile(path.join(directory, "Łódź raport (1).pdf"), "second PDF");

  const destination = await saveResultFile(source, directory, "Łódź raport.pdf");

  expect(destination).toBe(path.join(directory, "Łódź raport (2).pdf"));
  expect(await readFile(destination, "utf8")).toBe("new PDF");
  expect(await readFile(path.join(directory, "Łódź raport.pdf"), "utf8")).toBe("first PDF");
  expect(await readFile(path.join(directory, "Łódź raport (1).pdf"), "utf8")).toBe("second PDF");
});

it("propagates a missing source instead of retrying with another name", async () => {
  await expect(saveResultFile(path.join(directory, "missing.pdf"), directory, "result.pdf"))
    .rejects.toMatchObject({ code: "ENOENT" });
});

it("propagates a directory creation failure", async () => {
  const blocked = path.join(directory, "blocked");
  await writeFile(blocked, "existing file");

  await expect(saveResultFile("source.pdf", blocked, "result.pdf")).rejects.toMatchObject({ code: "EEXIST" });
  expect(await readFile(blocked, "utf8")).toBe("existing file");
});
