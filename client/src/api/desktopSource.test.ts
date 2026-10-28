import { afterEach, describe, expect, it, vi } from "vitest";
import type { EasyConvertApi } from "../../../shared/desktopContract";
import { selectDesktopSource } from "./desktopSource";

afterEach(() => {
  vi.unstubAllGlobals();
});

function setup() {
  const source = {
    sourceId: "source-123",
    name: "photo.jpg",
    sizeBytes: 3,
  };

  const api: EasyConvertApi = {
    platform: "desktop",
    selectSource: vi.fn().mockResolvedValue({
      status: "selected",
      source,
    }),
    startConversion: vi.fn(),
    getJobState: vi.fn(),
    onJobStateChanged: vi.fn(),
    resetSource: vi.fn(),
    saveResult: vi.fn(),
  };

  const response = {
    ok: true,
    headers: new Headers({ "Content-Length": "3" }),
    blob: vi.fn().mockResolvedValue(new Blob(["abc"], { type: "image/jpeg" })),
  };

  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);

  return { api, source, response, fetchMock };
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

describe("selectDesktopSource", () => {
  it("returns null after cancellation without fetching a file", async () => {
    const { api, fetchMock } = setup();

    vi.mocked(api.selectSource).mockResolvedValue({
      status: "cancelled",
    });

    await expect(selectDesktopSource(api)).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns source metadata and a File with the actual content", async () => {
    const { api, source, fetchMock } = setup();

    const result = await selectDesktopSource(api);

    if (!result) {
      throw new Error("Expected a selected file.");
    }

    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      "app://easyconvert/preview/source/source-123",
    );
    expect(result.source).toEqual(source);
    expect(result.file).toBeInstanceOf(File);
    expect(result.file.name).toBe("photo.jpg");
    expect(result.file.type).toBe("image/jpeg");
    expect(result.file.size).toBe(3);
    expect(await readFile(result.file)).toBe("abc");
  });

  it("rejects an unsuccessful response before reading its body", async () => {
    const { api, response } = setup();
    response.ok = false;

    await expect(selectDesktopSource(api)).rejects.toThrow(
      "Could not load the selected file.",
    );
    expect(response.blob).not.toHaveBeenCalled();
  });

  it.each([null, "", "0", "-1", "1.5", "invalid", "10000001"])(
    "rejects invalid Content-Length: %s",
    async (size) => {
      const { api, response } = setup();

      if (size === null) {
        response.headers.delete("Content-Length");
      } else {
        response.headers.set("Content-Length", size);
      }

      await expect(selectDesktopSource(api)).rejects.toThrow(
        "Invalid file size.",
      );
      expect(response.blob).not.toHaveBeenCalled();
    },
  );

  it("rejects content that does not match the declared size", async () => {
    const { api, response } = setup();
    response.headers.set("Content-Length", "4");

    await expect(selectDesktopSource(api)).rejects.toThrow(
      "File size does not match the response.",
    );
  });

  it("propagates a native dialog failure", async () => {
    const { api, fetchMock } = setup();
    const error = new Error("Dialog failed.");

    vi.mocked(api.selectSource).mockRejectedValue(error);

    await expect(selectDesktopSource(api)).rejects.toBe(error);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("propagates a file fetch failure", async () => {
    const { api, fetchMock } = setup();
    const error = new Error("Preview unavailable.");

    fetchMock.mockRejectedValue(error);

    await expect(selectDesktopSource(api)).rejects.toBe(error);
  });
});
