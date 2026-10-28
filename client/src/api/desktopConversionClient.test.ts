import { afterEach, describe, expect, it, vi } from "vitest";
import type { EasyConvertApi } from "../../../shared/desktopContract";
import { convertDesktopFile } from "./desktopConversionClient";
import { waitForDesktopJob } from "./waitForDesktopJob";

vi.mock("./waitForDesktopJob", () => ({
  waitForDesktopJob: vi.fn(),
}));

afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

function setup() {
  const api: EasyConvertApi = {
    platform: "desktop",
    selectSource: vi.fn(),
    startConversion: vi.fn().mockResolvedValue({ jobId: "job-1" }),
    getJobState: vi.fn(),
    onJobStateChanged: vi.fn(),
    resetSource: vi.fn(),
    saveResult: vi.fn(),
  };

  vi.mocked(waitForDesktopJob).mockResolvedValue("result-1");

  const response = {
    ok: true,
    headers: new Headers({ "Content-Length": "3" }),
    blob: vi.fn().mockResolvedValue(new Blob(["png"], { type: "image/png" })),
  };

  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);

  return { api, response, fetchMock };
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

describe("convertDesktopFile", () => {
  it("starts conversion and returns the actual result in the frontend format", async () => {
    const { api, fetchMock } = setup();

    const results = await convertDesktopFile(
      api,
      "source-1",
      "photo.final.jpg",
    );

    expect(api.startConversion).toHaveBeenCalledExactlyOnceWith({
      sourceId: "source-1",
      conversion: "jpg-to-png",
    });
    expect(waitForDesktopJob).toHaveBeenCalledExactlyOnceWith(
      api,
      "job-1",
      undefined,
    );
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      "app://easyconvert/preview/result/result-1",
      { signal: undefined },
    );

    expect(results).toHaveLength(1);
    expect(results[0].url).toBe("app://easyconvert/preview/result/result-1");
    expect(results[0].file).toBeInstanceOf(File);
    expect(results[0].file.name).toBe("photo.final.png");
    expect(results[0].file.type).toBe("image/png");
    expect(await readFile(results[0].file)).toBe("png");
  });

  it("passes the signal to waiting and fetching", async () => {
    const { api, fetchMock } = setup();
    const controller = new AbortController();

    await convertDesktopFile(api, "source-1", "photo.jpg", controller.signal);

    expect(waitForDesktopJob).toHaveBeenCalledExactlyOnceWith(
      api,
      "job-1",
      controller.signal,
    );
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      "app://easyconvert/preview/result/result-1",
      { signal: controller.signal },
    );
  });

  it("does not start when the signal is already aborted", async () => {
    const { api, fetchMock } = setup();
    const controller = new AbortController();
    const reason = new DOMException("Cancelled.", "AbortError");
    controller.abort(reason);

    await expect(
      convertDesktopFile(api, "source-1", "photo.jpg", controller.signal),
    ).rejects.toBe(reason);

    expect(api.startConversion).not.toHaveBeenCalled();
    expect(waitForDesktopJob).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not fetch after waiting is aborted", async () => {
    const { api, fetchMock } = setup();
    const controller = new AbortController();
    const reason = new DOMException("Cancelled.", "AbortError");

    vi.mocked(waitForDesktopJob).mockImplementationOnce(async () => {
      controller.abort(reason);
      throw reason;
    });

    await expect(
      convertDesktopFile(api, "source-1", "photo.jpg", controller.signal),
    ).rejects.toBe(reason);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not fetch if the signal is aborted as waiting completes", async () => {
    const { api, fetchMock } = setup();
    const controller = new AbortController();
    const reason = new DOMException("Cancelled.", "AbortError");

    vi.mocked(waitForDesktopJob).mockImplementationOnce(async () => {
      controller.abort(reason);
      return "result-1";
    });

    await expect(
      convertDesktopFile(api, "source-1", "photo.jpg", controller.signal),
    ).rejects.toBe(reason);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("propagates an aborted fetch without reading the body", async () => {
    const { api, fetchMock, response } = setup();
    const controller = new AbortController();
    const reason = new DOMException("Cancelled.", "AbortError");

    fetchMock.mockImplementationOnce(async () => {
      controller.abort(reason);
      throw reason;
    });

    await expect(
      convertDesktopFile(api, "source-1", "photo.jpg", controller.signal),
    ).rejects.toBe(reason);

    expect(response.blob).not.toHaveBeenCalled();
  });

  it("does not return a file if aborted while reading the body", async () => {
    const { api, response } = setup();
    const controller = new AbortController();
    const reason = new DOMException("Cancelled.", "AbortError");

    response.blob.mockImplementationOnce(async () => {
      controller.abort(reason);
      return new Blob(["png"], { type: "image/png" });
    });

    await expect(
      convertDesktopFile(api, "source-1", "photo.jpg", controller.signal),
    ).rejects.toBe(reason);
  });

  it("does not wait or fetch when starting fails", async () => {
    const { api, fetchMock } = setup();
    const error = new Error("Start failed.");
    vi.mocked(api.startConversion).mockRejectedValue(error);

    await expect(convertDesktopFile(api, "source-1", "photo.jpg")).rejects.toBe(
      error,
    );

    expect(waitForDesktopJob).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not fetch when the job fails", async () => {
    const { api, fetchMock } = setup();
    const error = new Error("Worker failed.");
    vi.mocked(waitForDesktopJob).mockRejectedValue(error);

    await expect(convertDesktopFile(api, "source-1", "photo.jpg")).rejects.toBe(
      error,
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an unsuccessful response before reading its body", async () => {
    const { api, response } = setup();
    response.ok = false;

    await expect(
      convertDesktopFile(api, "source-1", "photo.jpg"),
    ).rejects.toThrow("Could not load the converted file.");

    expect(response.blob).not.toHaveBeenCalled();
  });

  it.each([null, "", "0", "-1", "1.5", "invalid", "104857601"])(
    "rejects invalid Content-Length: %s",
    async (size) => {
      const { api, response } = setup();

      if (size === null) {
        response.headers.delete("Content-Length");
      } else {
        response.headers.set("Content-Length", size);
      }

      await expect(
        convertDesktopFile(api, "source-1", "photo.jpg"),
      ).rejects.toThrow("Invalid result size.");

      expect(response.blob).not.toHaveBeenCalled();
    },
  );

  it("rejects a body whose size differs from the header", async () => {
    const { api, response } = setup();
    response.headers.set("Content-Length", "4");

    await expect(
      convertDesktopFile(api, "source-1", "photo.jpg"),
    ).rejects.toThrow("File size does not match the response.");
  });

  it("propagates a fetch failure", async () => {
    const { api, fetchMock } = setup();
    const error = new Error("Result unavailable.");
    fetchMock.mockRejectedValue(error);

    await expect(convertDesktopFile(api, "source-1", "photo.jpg")).rejects.toBe(
      error,
    );
  });
});
