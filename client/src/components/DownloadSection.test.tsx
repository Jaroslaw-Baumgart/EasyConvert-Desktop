import type { ComponentProps } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import DownloadSection from "./DownloadSection";
import type { ConvertedResults } from "../types/conversionResult";

vi.mock("docx-preview", () => ({
  renderAsync: vi.fn().mockResolvedValue(undefined),
}));

const createMultipleResults = (): ConvertedResults => [
  {
    resultId: "result-1",
    url: "https://example.com/page-1.jpg",
    file: new File(["page one"], "page-1.jpg", {
      type: "image/jpeg",
    }),
  },
  {
    resultId: "result-2",
    url: "https://example.com/page-2.jpg",
    file: new File(["page two"], "page-2.jpg", {
      type: "image/jpeg",
    }),
  },
];

type Props = ComponentProps<typeof DownloadSection>;

function setup(overrides: Partial<Props> = {}) {
  const props = {
    convertedResults: createMultipleResults(),
    onDownload: vi.fn(),
    onDownloadAll: vi.fn(),
    isSaving: false,
    isPreparingArchive: false,
    ...overrides,
  };
  const view = render(<DownloadSection {...props} />);
  return {
    ...view,
    ...props,
    rerender: (changes: Partial<Props>) => view.rerender(<DownloadSection {...props} {...changes} />),
  };
}

const renderDownloadSection = (file: File, url: string) =>
  setup({ convertedResults: [{ resultId: "result-3", url, file }] });

describe("DownloadSection", () => {
  it("disables export actions while saving and enables them afterwards", () => {
    const onDownload = vi.fn().mockResolvedValue(undefined);
    const onDownloadAll = vi.fn();
    const results = createMultipleResults();
    const { rerender } = setup({ convertedResults: results, onDownload, onDownloadAll, isSaving: true });

    for (const name of ["Save", "Save as…", "Save all as ZIP"]) {
      const button = screen.getByRole("button", { name });
      expect(button).toBeDisabled();
      fireEvent.click(button);
    }
    expect(onDownload).not.toHaveBeenCalled();
    expect(onDownloadAll).not.toHaveBeenCalled();

    rerender({ isSaving: false });

    for (const name of ["Save", "Save as…", "Save all as ZIP"]) {
      expect(screen.getByRole("button", { name })).toBeEnabled();
    }
  });

  it("requests scrolling only when the preview URL changes", async () => {
    const onPreviewReady = vi.fn();
    const result: ConvertedResults = [
      {
        resultId: "result-4",
        url: "https://example.com/converted.png",
        file: new File(["image content"], "converted.png", {
          type: "image/png",
        }),
      },
    ];
    const { rerender } = setup({ convertedResults: result, onPreviewReady });

    await waitFor(() => {
      expect(onPreviewReady).toHaveBeenCalledTimes(1);
    });

    rerender({ isPreparingArchive: true });

    expect(onPreviewReady).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["converted.png", "image/png", "https://example.com/converted.png"],
    ["converted.jpg", "image/jpeg", "https://example.com/converted.jpg"],
  ])("renders an image preview for %s", (fileName, mimeType, url) => {
    const file = new File(["image content"], fileName, {
      type: mimeType,
    });

    renderDownloadSection(file, url);

    expect(screen.getByRole("img", { name: "Preview" })).toHaveAttribute(
      "src", expect.stringMatching(/^blob:/),
    );
  });

  it("renders a PDF preview for a PDF result", () => {
    const file = new File(["pdf content"], "converted.pdf", {
      type: "application/pdf",
    });

    renderDownloadSection(file, "https://example.com/converted.pdf");

    expect(screen.getByTitle("PDF Preview")).toHaveAttribute(
      "src", expect.stringMatching(/^blob:/),
    );
  });

  it("renders a text preview for a text result", async () => {
    const file = new File(["converted text"], "converted.txt", {
      type: "text/plain",
    });

    renderDownloadSection(file, "https://example.com/converted.txt");

    expect(
      await screen.findByDisplayValue("converted text"),
    ).toBeInTheDocument();
  });

  it("renders guidance for a DOCX result", async () => {
    const file = new File(["docx content"], "converted.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    renderDownloadSection(file, "https://example.com/converted.docx");

    expect(await screen.findByTestId("docx-preview")).toBeInTheDocument();
  });

  it("renders an unsupported preview with the MIME type", () => {
    const file = new File(["binary content"], "converted.bin", {
      type: "application/octet-stream",
    });

    renderDownloadSection(file, "https://example.com/converted.bin");

    expect(
      screen.getByText("Preview not available for this file type"),
    ).toBeInTheDocument();

    expect(
      screen.getByText("Type: application/octet-stream"),
    ).toBeInTheDocument();
  });

  it("renders an error when an image preview fails to load", () => {
    const file = new File(["image content"], "converted.png", {
      type: "image/png",
    });

    renderDownloadSection(file, "https://example.com/converted.png");

    const image = screen.getByRole("img", {
      name: "Preview",
    });

    fireEvent.error(image);

    expect(
      screen.getByText("Failed to load image preview"),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("img", { name: "Preview" }),
    ).not.toBeInTheDocument();
  });

  it("selects and downloads a specific converted result", () => {
    const [firstResult, secondResult] = createMultipleResults();

    const onDownload = vi.fn();

    setup({ convertedResults: [firstResult, secondResult], onDownload });

    const firstPageButton = screen.getByRole("button", {
      name: "Page 1",
    });
    const secondPageButton = screen.getByRole("button", {
      name: "Page 2",
    });

    expect(firstPageButton).toHaveAttribute("aria-pressed", "true");
    expect(secondPageButton).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("img", { name: "Preview" })).toHaveAttribute(
      "src", expect.stringMatching(/^blob:/),
    );

    fireEvent.click(secondPageButton);

    expect(firstPageButton).toHaveAttribute("aria-pressed", "false");
    expect(secondPageButton).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("img", { name: "Preview" })).toHaveAttribute(
      "src", expect.stringMatching(/^blob:/),
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Save",
      }),
    );

    expect(onDownload).toHaveBeenCalledWith(secondResult);
    fireEvent.click(screen.getByRole("button", { name: "Save as…" }));
    expect(onDownload).toHaveBeenLastCalledWith(secondResult, true);
  });

  it("does not show Save all as ZIP for a single result", () => {
    const file = new File(["image"], "converted.jpg", {
      type: "image/jpeg",
    });

    renderDownloadSection(file, "https://example.com/converted.jpg");

    expect(
      screen.queryByRole("button", {
        name: "Save all as ZIP",
      }),
    ).not.toBeInTheDocument();
  });

  it.each([false, true])("saves the archive with saveAs=%s", (saveAs) => {
    const onDownloadAll = vi.fn();

    setup({ onDownloadAll });

    const popup = screen.getByRole("group", { hidden: true });
    popup.style.display = "block";
    const hidePopover = vi.fn();
    Object.defineProperty(popup, "hidePopover", { value: hidePopover });
    fireEvent.click(within(popup).getByRole("button", {
      name: saveAs ? "Save as…" : "Save",
    }));
    expect(hidePopover).toHaveBeenCalledOnce();
    expect(onDownloadAll).toHaveBeenCalledExactlyOnceWith(saveAs);
  });

  it("disables Save all as ZIP while the archive is being prepared", () => {
    setup({ isPreparingArchive: true });

    expect(
      screen.getByRole("button", {
        name: "Preparing archive...",
      }),
    ).toBeDisabled();

    expect(
      screen.queryByRole("button", {
        name: "Save all as ZIP",
      }),
    ).not.toBeInTheDocument();
  });

  it("does not render a result picker for one converted file", () => {
    const file = new File(["pdf content"], "converted.pdf", {
      type: "application/pdf",
    });

    renderDownloadSection(file, "https://example.com/converted.pdf");

    expect(screen.queryByLabelText("Converted files")).not.toBeInTheDocument();
  });
});
