import { beforeEach, describe, expect, it, vi } from "vitest";

const zipMocks = vi.hoisted(() => ({
  downloadZip: vi.fn(),
  blob: vi.fn(),
}));

vi.mock("client-zip", () => ({
  downloadZip: zipMocks.downloadZip,
}));

import { createZipFile } from "./createZipFile";

describe("createZipFile", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    zipMocks.downloadZip.mockReturnValue({
      blob: zipMocks.blob,
    });

    zipMocks.blob.mockResolvedValue(
      new Blob(["zip content"], {
        type: "application/zip",
      }),
    );
  });

  it("creates a ZIP file containing all supplied files", async () => {
    const files = [
      new File(["page one"], "page-1.jpg", {
        type: "image/jpeg",
      }),
      new File(["page two"], "page-2.jpg", {
        type: "image/jpeg",
      }),
    ];

    const archive = await createZipFile(files);

    expect(zipMocks.downloadZip).toHaveBeenCalledWith(files);
    expect(zipMocks.blob).toHaveBeenCalledOnce();
    expect(archive).toBeInstanceOf(File);
    expect(archive.name).toBe("conversion-results.zip");
    expect(archive.type).toBe("application/zip");
  });

  it("propagates an error when ZIP generation fails", async () => {
    const cause = new Error("ZIP generation failed");

    zipMocks.blob.mockRejectedValueOnce(cause);

    const files = [
      new File(["page one"], "page-1.jpg", {
        type: "image/jpeg",
      }),
    ];

    await expect(createZipFile(files)).rejects.toBe(cause);
  });
});
