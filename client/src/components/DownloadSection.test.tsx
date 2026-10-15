import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import DownloadSection from "./DownloadSection";
import type { ConvertedResults } from "../types/conversionResult";

vi.mock("docx-preview", () => ({
  renderAsync: vi.fn().mockResolvedValue(undefined),
}));

const createMultipleResults = (): ConvertedResults => [
  {
    url: "https://example.com/page-1.jpg",
    file: new File(["page one"], "page-1.jpg", {
      type: "image/jpeg",
    }),
  },
  {
    url: "https://example.com/page-2.jpg",
    file: new File(["page two"], "page-2.jpg", {
      type: "image/jpeg",
    }),
  },
];

const renderDownloadSection = (file: File, url: string) => {
  render(
    <DownloadSection
      convertedResults={[
        {
          url,
          file,
        },
      ]}
      onDownload={vi.fn()}
      onDownloadAll={vi.fn()}
      isPreparingArchive={false}
    />,
  );
};

describe("DownloadSection", () => {
  it("requests scrolling only when the preview URL changes", async () => {
    const onPreviewReady = vi.fn();
    const result: ConvertedResults = [
      {
        url: "https://example.com/converted.png",
        file: new File(["image content"], "converted.png", {
          type: "image/png",
        }),
      },
    ];
    const { rerender } = render(
      <DownloadSection
        convertedResults={result}
        onDownload={vi.fn()}
        onDownloadAll={vi.fn()}
        isPreparingArchive={false}
        onPreviewReady={onPreviewReady}
      />,
    );

    await waitFor(() => {
      expect(onPreviewReady).toHaveBeenCalledTimes(1);
    });

    rerender(
      <DownloadSection
        convertedResults={result}
        onDownload={vi.fn()}
        onDownloadAll={vi.fn()}
        isPreparingArchive
        onPreviewReady={onPreviewReady}
      />,
    );

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
    const firstFile = new File(["page one"], "page-1.jpg", {
      type: "image/jpeg",
    });
    const secondFile = new File(["page two"], "page-2.jpg", {
      type: "image/jpeg",
    });

    const firstResult = {
      url: "https://example.com/page-1.jpg",
      file: firstFile,
    };
    const secondResult = {
      url: "https://example.com/page-2.jpg",
      file: secondFile,
    };

    const onDownload = vi.fn();

    render(
      <DownloadSection
        convertedResults={[firstResult, secondResult]}
        onDownload={onDownload}
        onDownloadAll={vi.fn()}
        isPreparingArchive={false}
      />,
    );

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
        name: "Download file",
      }),
    );

    expect(onDownload).toHaveBeenCalledWith(secondResult);
  });

  it("does not show Download all for a single result", () => {
    const file = new File(["image"], "converted.jpg", {
      type: "image/jpeg",
    });

    renderDownloadSection(file, "https://example.com/converted.jpg");

    expect(
      screen.queryByRole("button", {
        name: "Download all",
      }),
    ).not.toBeInTheDocument();
  });

  it("downloads all results when Download all is clicked", () => {
    const onDownloadAll = vi.fn();

    render(
      <DownloadSection
        convertedResults={createMultipleResults()}
        onDownload={vi.fn()}
        onDownloadAll={onDownloadAll}
        isPreparingArchive={false}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Download all",
      }),
    );

    expect(onDownloadAll).toHaveBeenCalledOnce();
  });

  it("disables Download all while the archive is being prepared", () => {
    render(
      <DownloadSection
        convertedResults={createMultipleResults()}
        onDownload={vi.fn()}
        onDownloadAll={vi.fn()}
        isPreparingArchive
      />,
    );

    expect(
      screen.getByRole("button", {
        name: "Preparing archive...",
      }),
    ).toBeDisabled();

    expect(
      screen.queryByRole("button", {
        name: "Download all",
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
