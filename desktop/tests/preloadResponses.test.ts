import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  EasyConvertApi,
  StartConversionRequest,
} from "../../shared/desktopContract";

const mocks = vi.hoisted(() => ({
  exposeInMainWorld: vi.fn(),
  invoke: vi.fn(),
  getPathForFile: vi.fn(),
}));

vi.mock("electron", () => ({
  contextBridge: {
    exposeInMainWorld: mocks.exposeInMainWorld,
  },
  ipcRenderer: {
    invoke: mocks.invoke,
    on: vi.fn(),
    removeListener: vi.fn(),
  },
  webUtils: {
    getPathForFile: mocks.getPathForFile,
  },
}));

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  mocks.getPathForFile.mockReturnValue("C:/fixtures/photo.jpg");
});

async function loadApi(): Promise<EasyConvertApi> {
  await import("../preload/index");

  expect(mocks.exposeInMainWorld).toHaveBeenCalledTimes(1);

  const [name, api] = mocks.exposeInMainWorld.mock.calls[0];
  expect(name).toBe("easyConvert");

  return api as EasyConvertApi;
}

const source = {
  sourceId: "source-1",
  name: "photo.jpg",
  sizeBytes: 123,
};

const invalidSources: { label: string; value: unknown }[] = [
  { label: "null", value: null },
  { label: "a primitive", value: "source" },
  { label: "an array", value: [] },
  { label: "missing sourceId", value: { name: "photo.jpg", sizeBytes: 123 } },
  { label: "non-string sourceId", value: { ...source, sourceId: 123 } },
  { label: "empty sourceId", value: { ...source, sourceId: "" } },
  {
    label: "oversized sourceId",
    value: { ...source, sourceId: "s".repeat(129) },
  },
  { label: "missing name", value: { sourceId: "source-1", sizeBytes: 123 } },
  { label: "non-string name", value: { ...source, name: 123 } },
  { label: "empty name", value: { ...source, name: "" } },
  { label: "missing size", value: { sourceId: "source-1", name: "photo.jpg" } },
  { label: "non-number size", value: { ...source, sizeBytes: "123" } },
  { label: "zero size", value: { ...source, sizeBytes: 0 } },
  { label: "negative size", value: { ...source, sizeBytes: -1 } },
  { label: "fractional size", value: { ...source, sizeBytes: 1.5 } },
  { label: "NaN size", value: { ...source, sizeBytes: NaN } },
  { label: "infinite size", value: { ...source, sizeBytes: Infinity } },
  { label: "oversized file", value: { ...source, sizeBytes: 10_000_001 } },
];

describe.each(["dialog", "drop"] as const)(
  "preload source response: %s",
  (method) => {
    function invokeSelection(api: EasyConvertApi) {
      return method === "dialog"
        ? api.selectSource()
        : api.selectDroppedSource({} as File);
    }

    function responseFor(value: unknown) {
      return method === "dialog"
        ? { status: "selected", source: value }
        : value;
    }

    it("returns only validated metadata", async () => {
      const api = await loadApi();
      const receivedSource = {
        ...source,
        path: "C:/private/photo.jpg",
      };
      const received = responseFor(receivedSource);

      mocks.invoke.mockResolvedValueOnce(received);

      const result = await invokeSelection(api);

      expect(result).toEqual(responseFor(source));
      expect(result).not.toBe(received);

      if ("source" in result) {
        expect(result.source).not.toBe(receivedSource);
      }

      if (method === "dialog") {
        expect(mocks.invoke).toHaveBeenCalledExactlyOnceWith(
          "easyconvert:select-source",
        );
      } else {
        expect(mocks.invoke).toHaveBeenCalledExactlyOnceWith(
          "easyconvert:select-dropped-source",
          "C:/fixtures/photo.jpg",
        );
      }
    });

    it.each([1, 10_000_000])(
      "accepts the size boundary: %i bytes",
      async (sizeBytes) => {
        const api = await loadApi();
        const boundarySource = {
          sourceId: "s".repeat(128),
          name: `${"a".repeat(140)}.jpg`,
          sizeBytes,
        };

        mocks.invoke.mockResolvedValueOnce(responseFor(boundarySource));

        await expect(invokeSelection(api)).resolves.toEqual(
          responseFor(boundarySource),
        );
      },
    );

    it.each(invalidSources)("rejects $label", async ({ value }) => {
      const api = await loadApi();
      mocks.invoke.mockResolvedValueOnce(responseFor(value));

      await expect(invokeSelection(api)).rejects.toThrow();
    });

    it("propagates an IPC failure", async () => {
      const api = await loadApi();
      const error = new Error("Selection unavailable.");
      mocks.invoke.mockRejectedValueOnce(error);

      await expect(invokeSelection(api)).rejects.toBe(error);
    });
  },
);

describe("preload dialog response", () => {
  it("returns a new cancellation response without extra fields", async () => {
    const api = await loadApi();
    const received = {
      status: "cancelled",
      path: "C:/private/photo.jpg",
    };
    mocks.invoke.mockResolvedValueOnce(received);

    const result = await api.selectSource();

    expect(result).toEqual({ status: "cancelled" });
    expect(result).not.toBe(received);
  });

  it.each([
    { label: "null", value: null },
    { label: "undefined", value: undefined },
    { label: "an array", value: [] },
    { label: "missing status", value: {} },
    { label: "unknown status", value: { status: "other" } },
    { label: "missing source", value: { status: "selected" } },
  ])("rejects $label", async ({ value }) => {
    const api = await loadApi();
    mocks.invoke.mockResolvedValueOnce(value);

    await expect(api.selectSource()).rejects.toThrow(
      "Invalid source selection.",
    );
  });
});

describe("preload conversion start response", () => {
  const request: StartConversionRequest = {
    sourceId: "source-1",
    conversion: "jpg-to-png",
  };

  it("forwards the request and returns only the validated job ID", async () => {
    const api = await loadApi();
    const received = { jobId: "job-1", path: "C:/private/result.png" };

    mocks.invoke.mockResolvedValueOnce(received);

    const result = await api.startConversion(request);

    expect(mocks.invoke).toHaveBeenCalledExactlyOnceWith(
      "easyconvert:start-conversion",
      request,
    );
    expect(result).toEqual({ jobId: "job-1" });
    expect(result).not.toBe(received);
  });

  it("accepts a job ID at the maximum length", async () => {
    const api = await loadApi();
    const jobId = "j".repeat(128);
    mocks.invoke.mockResolvedValueOnce({ jobId });

    await expect(api.startConversion(request)).resolves.toEqual({ jobId });
  });

  it.each([
    { label: "null", value: null },
    { label: "undefined", value: undefined },
    { label: "a primitive", value: "job-1" },
    { label: "an array", value: [] },
    { label: "missing jobId", value: {} },
    { label: "non-string jobId", value: { jobId: 123 } },
    { label: "empty jobId", value: { jobId: "" } },
    { label: "oversized jobId", value: { jobId: "j".repeat(129) } },
  ])("rejects $label", async ({ value }) => {
    const api = await loadApi();
    mocks.invoke.mockResolvedValueOnce(value);

    await expect(api.startConversion(request)).rejects.toThrow();
  });

  it("propagates a start failure", async () => {
    const api = await loadApi();
    const error = new Error("Start failed.");
    mocks.invoke.mockRejectedValueOnce(error);

    await expect(api.startConversion(request)).rejects.toBe(error);
  });
});
