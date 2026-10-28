import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { previewResponse } from "../main/previewResponse";
import { registerSource, clearSource } from "../main/sourceRegistry";
import { registerResult, clearResult } from "../main/resultRegistry";

let directory: string;
let sourceId: string;
beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), "easyconvert-preview-test-"));
  const input = path.join(directory, "sample.jpg");
  await writeFile(input, "0123456789");
  sourceId = registerSource(input);
});
afterEach(async () => {
  clearSource(); clearResult();
  await rm(directory, { recursive: true, force: true });
});
function request(id = sourceId, options?: RequestInit) {
  return new Request(`app://easyconvert/preview/source/${id}`, options);
}
describe("registered preview resources", () => {
  it("streams an existing registered source with its MIME and size", async () => {
    const response = await previewResponse(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/jpeg");
    expect(response.headers.get("Content-Length")).toBe("10");
    expect(await response.text()).toBe("0123456789");
  });
  it.each([
    ["bytes=2-5", "2345", "bytes 2-5/10"],
    ["bytes=7-", "789", "bytes 7-9/10"],
    ["bytes=-3", "789", "bytes 7-9/10"],
  ])("supports range %s", async (range, body, contentRange) => {
    const response = await previewResponse(request(sourceId, { headers: { Range: range } }));
    expect(response.status).toBe(206);
    expect(response.headers.get("Content-Range")).toBe(contentRange);
    expect(await response.text()).toBe(body);
  });
  it.each(["bytes=99-", "bytes=5-2", "bytes=0-1,4-5", "bytes=-0"])("rejects invalid range %s", async (range) => {
    expect((await previewResponse(request(sourceId, { headers: { Range: range } }))).status).toBe(416);
  });
  it("supports HEAD without reading the body", async () => {
    const response = await previewResponse(request(sourceId, { method: "HEAD" }));
    expect(response.status).toBe(200);
    expect(response.body).toBeNull();
    expect(response.headers.get("Content-Length")).toBe("10");
  });
  it("rejects unknown and expired source/result IDs", async () => {
    expect((await previewResponse(request("foreign"))).status).toBe(404);
    clearSource();
    expect((await previewResponse(request())).status).toBe(404);
    const resultFile = path.join(directory, "result.png");
    await writeFile(resultFile, "png");
    const id = registerResult(resultFile);
    const resultRequest = new Request(`app://easyconvert/preview/result/${id}`);
    expect(await (await previewResponse(resultRequest)).text()).toBe("png");
    clearResult();
    expect((await previewResponse(resultRequest)).status).toBe(404);
  });
  it("rejects writes, external origins and arbitrary paths", async () => {
    expect((await previewResponse(request(sourceId, { method: "POST" }))).status).toBe(403);
    expect((await previewResponse(request(sourceId, { headers: { Origin: "https://example.com" } }))).status).toBe(403);
    expect((await previewResponse(new Request("app://easyconvert/preview/source/C:/secret.txt"))).status).toBe(404);
    expect((await previewResponse(new Request(`app://foreign/preview/source/${sourceId}`))).status).toBe(404);
  });
  it("permits the explicitly configured Vite origin", async () => {
    const response = await previewResponse(request(sourceId, { headers: { Origin: "http://localhost:5173" } }));
    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:5173");
    await response.body?.cancel();
  });
});
