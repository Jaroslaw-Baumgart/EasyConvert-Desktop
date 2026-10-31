import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { previewResponse } from "../main/previewResponse";
import { registerSource, clearSource } from "../main/sourceRegistry";
import { registerResult, clearResult } from "../main/resultRegistry";

const FILE_SIZE = 2 * 1024 * 1024;
const DIRECTORY_PREFIX = "easyconvert-large-preview-";

let directory: string | undefined;
let filePath: string;
let contents: Buffer;
let sourceId: string;
let resultId: string;

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), DIRECTORY_PREFIX));
  filePath = path.join(directory, "large.txt");

  contents = Buffer.alloc(FILE_SIZE);

  for (let index = 0; index < contents.length; index += 1) {
    contents[index] = 97 + (index % 26);
  }

  await writeFile(filePath, contents);
  sourceId = registerSource(filePath);
  resultId = registerResult(filePath);
});

afterEach(async () => {
  clearSource();
  clearResult();

  if (directory) {
    await rm(directory, { recursive: true, force: true });
    directory = undefined;
  }
});

function sourceRequest(headers?: HeadersInit): Request {
  return new Request(`app://easyconvert/preview/source/${sourceId}`, {
    headers,
  });
}

function resultRequest(): Request {
  return new Request(`app://easyconvert/preview/result/${resultId}`);
}

describe("large preview resources", () => {
  it("returns the complete contents of a source larger than 1 MiB", async () => {
    const response = await previewResponse(sourceRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Length")).toBe(String(FILE_SIZE));
    expect(response.headers.get("Content-Type")).toBe(
      "text/plain; charset=utf-8",
    );
    expect(response.body).not.toBeNull();

    const received = Buffer.from(await response.arrayBuffer());

    expect(received.length).toBe(FILE_SIZE);
    expect(received.equals(contents)).toBe(true);
  });

  it("returns the requested range across the 1 MiB boundary", async () => {
    const start = 1024 * 1024 - 16;
    const end = 1024 * 1024 + 31;

    const response = await previewResponse(
      sourceRequest({ Range: `bytes=${start}-${end}` }),
    );

    expect(response.status).toBe(206);
    expect(response.headers.get("Content-Range")).toBe(
      `bytes ${start}-${end}/${FILE_SIZE}`,
    );
    expect(response.headers.get("Content-Length")).toBe(
      String(end - start + 1),
    );

    const received = Buffer.from(await response.arrayBuffer());

    expect(received.equals(contents.subarray(start, end + 1))).toBe(true);
  });

  it("returns the complete contents through a registered result ID", async () => {
    const response = await previewResponse(resultRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Length")).toBe(String(FILE_SIZE));

    const received = Buffer.from(await response.arrayBuffer());

    expect(received.equals(contents)).toBe(true);
  });

  it("rejects expired source and result IDs even though the file still exists", async () => {
    clearSource();
    clearResult();

    expect((await stat(filePath)).size).toBe(FILE_SIZE);

    const sourceResponse = await previewResponse(sourceRequest());
    const resultResponse = await previewResponse(resultRequest());

    expect(sourceResponse.status).toBe(404);
    expect(resultResponse.status).toBe(404);
  });
});
