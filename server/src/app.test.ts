import request from "supertest";
import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import { mkdtemp, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

vi.mock("./middlewares/routeDispatcher", () => ({
  routeDispatcher: vi.fn(),
}));

import { createApp } from "./app";
import { routeDispatcher } from "./middlewares/routeDispatcher";

let uploadDirectory: string;
let app: ReturnType<typeof createApp>;

beforeEach(async () => {
  vi.resetAllMocks();

  uploadDirectory = await mkdtemp(
    path.join(tmpdir(), "converter-upload-test-"),
  );
  app = createApp(uploadDirectory);
});

afterEach(async () => {
  await rm(uploadDirectory, { recursive: true, force: true });
});

describe("POST /convert", () => {
  it("keeps a slot reserved when a client disconnects during conversion", async () => {
    const finishConversions: Array<() => void> = [];
    vi.mocked(routeDispatcher).mockImplementation(
      async (_req, res) =>
        new Promise<void>((resolve) => {
          finishConversions.push(() => {
            res.status(200).json({ success: true });
            resolve();
          });
        }),
    );

    const startConversion = () =>
      request(app)
        .post("/convert")
        .field("conversionType", "txt-to-pdf")
        .attach("file", Buffer.from("Example text"), "document.txt");

    const firstRequest = startConversion();
    const secondRequest = startConversion();
    const firstResponse = firstRequest.catch(() => undefined);
    const secondResponse = secondRequest.catch(() => undefined);

    await vi.waitFor(() => {
      expect(routeDispatcher).toHaveBeenCalledTimes(2);
    });

    firstRequest.abort();
    await vi.waitFor(() => {
      expect(routeDispatcher).toHaveBeenCalledTimes(2);
    });

    await startConversion().expect(429);

    finishConversions.forEach((finish) => finish());
    await Promise.all([firstResponse, secondResponse]);

    vi.mocked(routeDispatcher).mockImplementation(async (_req, res) => {
      res.status(200).json({ success: true });
    });
    await Promise.all([
      startConversion().expect(200),
      startConversion().expect(200),
    ]);
    expect(routeDispatcher).toHaveBeenCalledTimes(4);
  });

  it("rejects a JPEG renamed to PNG even when the upload declares image/png", async () => {
    const jpeg = await import("sharp").then(({ default: sharp }) =>
      sharp({ create: { width: 2, height: 2, channels: 3, background: "white" } }).jpeg().toBuffer());
    const response = await request(app).post("/convert")
      .field("conversionType", "png-to-jpg")
      .attach("file", jpeg, { filename: "fake.png", contentType: "image/png" });
    expect(response.status).toBe(400);
    expect(routeDispatcher).not.toHaveBeenCalled();
    expect(await readdir(uploadDirectory)).toEqual([]);
  });

  it("accepts normal filenames containing dots", async () => {
    vi.mocked(routeDispatcher).mockImplementationOnce(async (_req, res) => { res.status(200).json({ success: true }); });
    await request(app).post("/convert")
      .field("conversionType", "txt-to-pdf")
      .attach("file", Buffer.from("Example text"), { filename: "report.v2.txt", contentType: "text/plain" })
      .expect(200);
  });

  it("turns a rejected async handler into JSON and cleans the upload", async () => {
    vi.mocked(routeDispatcher).mockRejectedValueOnce(new Error("private server details"));
    const response = await request(app).post("/convert")
      .field("conversionType", "txt-to-pdf")
      .attach("file", Buffer.from("Example text"), { filename: "report.txt", contentType: "text/plain" });
    expect(response.status).toBe(500);
    expect(response.body).toEqual({ success: false, error: "The file could not be converted.", code: "conversion-failed" });
    expect(await readdir(uploadDirectory)).toEqual([]);
  });

  it("rejects requests from untrusted web origins before saving an upload", async () => {
    await request(app).post("/convert").set("Origin", "https://untrusted.example")
      .attach("file", Buffer.from("text"), "document.txt").expect(403);
    expect(await readdir(uploadDirectory)).toEqual([]);
  });

  it("returns JSON for malformed multipart uploads", async () => {
    const response = await request(app).post("/convert")
      .attach("unexpected", Buffer.from("text"), "document.txt");
    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(await readdir(uploadDirectory)).toEqual([]);
  });
  it("rejects a request without a file", async () => {
    const response = await request(app)
      .post("/convert")
      .field("target", "jpg")
      .expect("Content-Type", /json/)
      .expect(400);

    expect(response.body).toEqual({
      success: false,
      error: "No file uploaded.",
      code: "conversion-failed",
    });

    expect(routeDispatcher).not.toHaveBeenCalled();
  });

  it("rejects an unsupported file and removes the uploaded file", async () => {
    const response = await request(app)
      .post("/convert")
      .field("target", "jpg")
      .attach("file", Buffer.from("unsupported file content"), {
        filename: "document.exe",
        contentType: "application/octet-stream",
      })
      .expect("Content-Type", /json/)
      .expect(400);

    expect(response.body).toEqual({
      success: false,
      error: expect.stringContaining("Invalid file extension."),
      code: "conversion-failed",
    });

    expect(routeDispatcher).not.toHaveBeenCalled();

    expect(await readdir(uploadDirectory)).toEqual([]);
  });

  it("passes a valid uploaded file to the dispatcher", async () => {
    vi.mocked(routeDispatcher).mockImplementationOnce(async (req, res) => {
      res.status(200).json({
        originalName: req.file?.originalname,
        size: req.file?.size,
        target: req.body.target,
      });
    });

    const content = Buffer.from("Example text");

    const response = await request(app)
      .post("/convert")
      .field("target", "pdf")
      .attach("file", content, {
        filename: "document.txt",
        contentType: "text/plain",
      })
      .expect("Content-Type", /json/)
      .expect(200);

    expect(routeDispatcher).toHaveBeenCalledTimes(1);

    expect(response.body).toEqual({
      originalName: "document.txt",
      size: content.length,
      target: "pdf",
    });
  });

  it("rejects an oversized file and removes it", async () => {
    const content = Buffer.alloc(10 * 1024 * 1024 + 1, "a");

    const response = await request(app)
      .post("/convert")
      .field("target", "pdf")
      .attach("file", content, {
        filename: "document.txt",
        contentType: "text/plain",
      })
      .expect("Content-Type", /json/)
      .expect(400);

    expect(response.body).toEqual({
      success: false,
      error: "File is too large. Max size: 10 MB",
      code: "conversion-failed",
    });

    expect(routeDispatcher).not.toHaveBeenCalled();
    expect(await readdir(uploadDirectory)).toEqual([]);
  });
});
