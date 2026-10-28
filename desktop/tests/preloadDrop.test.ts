import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EasyConvertApi } from "../../shared/desktopContract";

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
});

async function setup(): Promise<EasyConvertApi> {
  await import("../preload/index");

  const registration = mocks.exposeInMainWorld.mock.calls.find(
    ([name]) => name === "easyConvert",
  );

  if (!registration) {
    throw new Error("Preload API was not exposed.");
  }

  return registration[1] as EasyConvertApi;
}

describe("preload dropped source", () => {
  it("extracts the path and invokes the dropped-source channel", async () => {
    const api = await setup();
    const file = {} as File;
    const sourcePath = "C:/fixtures/photo.jpg";
    const source = {
      sourceId: "source-1",
      name: "photo.jpg",
      sizeBytes: 123,
    };

    mocks.getPathForFile.mockReturnValue(sourcePath);
    mocks.invoke.mockResolvedValue(source);

    await expect(api.selectDroppedSource(file)).resolves.toEqual(source);

    expect(mocks.getPathForFile).toHaveBeenCalledExactlyOnceWith(file);
    expect(mocks.invoke).toHaveBeenCalledExactlyOnceWith(
      "easyconvert:select-dropped-source",
      sourcePath,
    );
  });

  it("rejects a file without a filesystem path before invoking IPC", async () => {
    const api = await setup();
    mocks.getPathForFile.mockReturnValue("");

    await expect(api.selectDroppedSource({} as File)).rejects.toThrow(
      "Dropped file has no filesystem path.",
    );

    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it("propagates a registration failure", async () => {
    const api = await setup();
    const error = new Error("Selected file is empty.");

    mocks.getPathForFile.mockReturnValue("C:/fixtures/empty.jpg");
    mocks.invoke.mockRejectedValue(error);

    await expect(api.selectDroppedSource({} as File)).rejects.toBe(error);
  });
});
