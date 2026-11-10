import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  validateImagePixels: vi.fn(),
  writePdf: vi.fn(),
}));

vi.mock("../../image/imageLimits", () => ({
  validateImagePixels: mocks.validateImagePixels,
}));

vi.mock("../../pdf/writePdf", () => ({ writePdf: mocks.writePdf }));

import { convertJpgToPdf } from "../../image/convertJpgToPdf";

function setupDocument() {
  const doc = {
    page: { width: 1190.55, height: 841.89 },
    addPage: vi.fn(),
    image: vi.fn(),
  };
  mocks.writePdf.mockImplementation(async (_path, _options, render) => render(doc));
  return { doc };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.validateImagePixels.mockResolvedValue(undefined);
});

describe("convertJpgToPdf", () => {
  it.each([
    { pageSize: "A4", pageOrientation: "portrait" },
    { pageSize: "A4", pageOrientation: "landscape" },
    { pageSize: "A3", pageOrientation: "portrait" },
    { pageSize: "A3", pageOrientation: "landscape" },
  ] as const)("uses $pageSize and $pageOrientation", async (options) => {
    const { doc } = setupDocument();

    await convertJpgToPdf("input.jpg", "output.pdf", options);

    expect(mocks.validateImagePixels).toHaveBeenCalledExactlyOnceWith(
      "input.jpg",
    );
    expect(mocks.writePdf).toHaveBeenCalledExactlyOnceWith(
      "output.pdf", { autoFirstPage: false }, expect.any(Function),
    );
    expect(doc.addPage).toHaveBeenCalledExactlyOnceWith({
      size: options.pageSize,
      layout: options.pageOrientation,
    });
  });

  it("fits and centers the image within 36-point page margins", async () => {
    const { doc } = setupDocument();

    await convertJpgToPdf("input.jpg", "output.pdf", {
      pageSize: "A3",
      pageOrientation: "landscape",
    });

    expect(doc.image).toHaveBeenCalledExactlyOnceWith("input.jpg", 36, 36, {
      fit: [1118.55, 769.89],
      align: "center",
      valign: "center",
    });
  });

  it("does not create a PDF when image validation fails", async () => {
    setupDocument();
    const error = new Error("Image pixel limit exceeded.");
    mocks.validateImagePixels.mockRejectedValue(error);

    await expect(
      convertJpgToPdf("input.jpg", "output.pdf", {
        pageSize: "A4",
        pageOrientation: "portrait",
      }),
    ).rejects.toBe(error);

    expect(mocks.writePdf).not.toHaveBeenCalled();
  });

});
