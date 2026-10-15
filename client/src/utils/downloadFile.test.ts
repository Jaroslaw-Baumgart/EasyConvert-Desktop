import { afterEach, describe, expect, it, vi } from "vitest";

import { downloadFile } from "./downloadFile";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("downloadFile", () => {
  it("downloads a file and revokes its object URL", () => {
    vi.useFakeTimers();

    const createObjectURL = vi.fn().mockReturnValue("blob:download-url");
    const revokeObjectURL = vi.fn();

    vi.stubGlobal("URL", {
      createObjectURL,
      revokeObjectURL,
    });

    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    const file = new File(["content"], "converted.png", {
      type: "image/png",
    });

    downloadFile(file);

    expect(createObjectURL).toHaveBeenCalledWith(file);
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).not.toHaveBeenCalled();
    expect(document.querySelector("a")).not.toBeInTheDocument();

    vi.runAllTimers();

    expect(revokeObjectURL).toHaveBeenCalledWith("blob:download-url");
  });

  it("revokes the object URL when starting the download throws", () => {
    const createObjectURL = vi.fn().mockReturnValue("blob:download-url");
    const revokeObjectURL = vi.fn();

    vi.stubGlobal("URL", {
      createObjectURL,
      revokeObjectURL,
    });

    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {
      throw new Error("Download failed");
    });

    const file = new File(["content"], "converted.png", {
      type: "image/png",
    });

    expect(() => downloadFile(file)).toThrow("Download failed");

    expect(revokeObjectURL).toHaveBeenCalledWith("blob:download-url");
    expect(document.querySelector("a")).not.toBeInTheDocument();
  });
});
