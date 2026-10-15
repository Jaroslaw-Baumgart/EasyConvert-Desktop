import {
  mkdtemp,
  mkdir,
  readdir,
  rm,
  utimes,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { cleanupExpiredOutputs } from "./file";

const retentionMs = 30 * 60 * 1000;

let outputDirectory = "";

afterEach(async () => {
  if (outputDirectory) {
    await rm(outputDirectory, { recursive: true, force: true });
  }
});

describe("cleanupExpiredOutputs", () => {
  it("allows overlapping cleanup runs to remove the same expired files", async () => {
    outputDirectory = await mkdtemp(path.join(tmpdir(), "converter-retention-race-"));
    const file = path.join(outputDirectory, "expired.pdf");
    await writeFile(file, "old result");
    await utimes(file, new Date(0), new Date(0));
    await Promise.all([cleanupExpiredOutputs(outputDirectory), cleanupExpiredOutputs(outputDirectory)]);
    expect(await readdir(outputDirectory)).toEqual([]);
  });
  it("does nothing when the output directory does not exist", async () => {
    const missingDirectory = path.join(
      tmpdir(),
      `missing-output-${Date.now()}`,
    );

    await expect(
      cleanupExpiredOutputs(missingDirectory, Date.now()),
    ).resolves.toBeUndefined();
  });

  it("removes expired files and directories but keeps fresh results", async () => {
    outputDirectory = await mkdtemp(
      path.join(tmpdir(), "converter-output-test-"),
    );

    const now = Date.now();
    const expiredTime = new Date(now - retentionMs - 1);
    const freshTime = new Date(now - retentionMs + 1);

    const expiredFile = path.join(outputDirectory, "expired.pdf");
    const freshFile = path.join(outputDirectory, "fresh.pdf");
    const expiredDirectory = path.join(outputDirectory, "old-pages");

    await writeFile(expiredFile, "old result");
    await writeFile(freshFile, "fresh result");
    await mkdir(expiredDirectory);
    await writeFile(path.join(expiredDirectory, "page-1.jpg"), "old page");

    await utimes(expiredFile, expiredTime, expiredTime);
    await utimes(expiredDirectory, expiredTime, expiredTime);
    await utimes(freshFile, freshTime, freshTime);

    await cleanupExpiredOutputs(outputDirectory, now);

    expect(await readdir(outputDirectory)).toEqual(["fresh.pdf"]);
  });
});
