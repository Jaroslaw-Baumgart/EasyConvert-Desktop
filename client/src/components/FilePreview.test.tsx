import { render, screen, act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import * as XLSX from "xlsx";
import userEvent from "@testing-library/user-event";

import FilePreview from "./FilePreview";
import * as xlsxUtils from "../utils/xlsx";
import { renderAsync } from "docx-preview";
import { getSlides, loadPresentation } from "@office-kit/pptx";
import { renderSlideToSvg } from "@office-kit/pptx-preview";

vi.mock("docx-preview", () => ({
  renderAsync: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@office-kit/pptx", () => ({
  getSlides: vi.fn(),
  loadPresentation: vi.fn(),
}));

vi.mock("@office-kit/pptx-preview", () => ({
  renderSlideToSvg: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("FilePreview", () => {
  it("renders an image preview", () => {
    render(
      <FilePreview
        preview={{
          kind: "image",
          url: "https://example.com/converted.jpg",
        }}
      />,
    );

    expect(screen.getByRole("img", { name: "Preview" })).toHaveAttribute(
      "src",
      "https://example.com/converted.jpg",
    );
  });

  it("renders a PDF preview", () => {
    render(
      <FilePreview
        preview={{
          kind: "pdf",
          url: "https://example.com/converted.pdf",
        }}
      />,
    );

    expect(screen.getByTitle("PDF Preview")).toHaveAttribute(
      "src",
      "https://example.com/converted.pdf",
    );
  });

  it("opens and closes the shared preview lightbox", async () => {
    const user = userEvent.setup();

    render(
      <FilePreview
        preview={{
          kind: "image",
          url: "https://example.com/converted.jpg",
        }}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Expand preview" }),
    );

    expect(
      screen.getByRole("dialog", { name: "File preview" }),
    ).toBeInTheDocument();

    const closeButton = screen.getByRole("button", {
      name: "Close preview",
    });
    expect(closeButton).toHaveFocus();

    await user.keyboard("{Tab}");
    expect(closeButton).toHaveFocus();

    await user.keyboard("{Escape}");

    expect(
      screen.queryByRole("dialog", { name: "File preview" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Expand preview" })).toHaveFocus();
  });

  it("renders a text preview", async () => {
    const file = new File(["text content"], "document.txt", {
      type: "text/plain",
    });

    render(
      <FilePreview
        preview={{
          kind: "text",
          file,
        }}
      />,
    );

    expect(await screen.findByDisplayValue("text content")).toBeInTheDocument();
  });

  it("renders a DOCX preview container", async () => {
    const file = new File([], "document.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    render(
      <FilePreview
        preview={{
          kind: "word",
          file,
        }}
      />,
    );

    expect(await screen.findByTestId("docx-preview")).toBeInTheDocument();
  });

  it("shows loading while DOCX is rendering", async () => {
    let finishRendering!: () => void;

    const rendering = new Promise<void>((resolve) => {
      finishRendering = resolve;
    });

    vi.mocked(renderAsync).mockReturnValueOnce(rendering);

    const file = new File(["DOCX content"], "loading.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    render(
      <FilePreview
        preview={{
          kind: "word",
          file,
        }}
      />,
    );

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Loading DOCX content...",
    );

    await act(async () => {
      finishRendering();
      await rendering;
    });

    await waitFor(() => {
      expect(
        screen.queryByText("Loading DOCX content..."),
      ).not.toBeInTheDocument();
    });
  });

  it("ignores a DOCX rendering failure after changing files", async () => {
    let rejectFirst!: (reason?: unknown) => void;

    const firstRendering = new Promise<void>((_, reject) => {
      rejectFirst = reject;
    });

    vi.mocked(renderAsync)
      .mockReturnValueOnce(firstRendering)
      .mockResolvedValueOnce(undefined);

    const firstFile = new File(["first"], "first.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    const secondFile = new File(["second"], "second.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    const { rerender } = render(
      <FilePreview
        preview={{
          kind: "word",
          file: firstFile,
        }}
      />,
    );

    await waitFor(() => {
      expect(renderAsync).toHaveBeenCalledTimes(1);
    });

    rerender(
      <FilePreview
        preview={{
          kind: "word",
          file: secondFile,
        }}
      />,
    );

    await waitFor(() => {
      expect(renderAsync).toHaveBeenCalledTimes(2);
    });

    await act(async () => {
      rejectFirst(new Error("First file failed"));
      await firstRendering.catch(() => undefined);
    });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(renderAsync).toHaveBeenLastCalledWith(
      secondFile,
      screen.getByTestId("docx-preview"),
    );
  });

  it("shows an error when DOCX rendering fails", async () => {
    vi.mocked(renderAsync).mockRejectedValueOnce(
      new Error("Invalid DOCX file"),
    );

    const file = new File(["broken content"], "broken.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    render(
      <FilePreview
        preview={{
          kind: "word",
          file,
        }}
      />,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Failed to render DOCX content",
    );
  });

  it("renders every PowerPoint slide as an SVG image", async () => {
    const createObjectUrl = vi
      .fn()
      .mockReturnValueOnce("blob:pptx-slide-1")
      .mockReturnValueOnce("blob:pptx-slide-2");
    vi.spyOn(URL, "createObjectURL").mockImplementation(createObjectUrl);
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.mocked(loadPresentation).mockResolvedValue({} as never);
    vi.mocked(getSlides).mockReturnValue([{}, {}] as never);
    vi.mocked(renderSlideToSvg)
      .mockReturnValueOnce("<svg />")
      .mockReturnValueOnce("<svg />");

    const file = new File(["presentation"], "slides.pptx", {
      type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    });
    Object.defineProperty(file, "arrayBuffer", {
      value: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
    });

    render(
      <FilePreview
        preview={{
          kind: "pptx",
          file,
        }}
      />,
    );

    expect(await screen.findAllByRole("img")).toHaveLength(2);
    expect(screen.getByRole("img", { name: "PowerPoint slide 1" })).toHaveAttribute(
      "src",
      "blob:pptx-slide-1",
    );
    expect(screen.getByRole("img", { name: "PowerPoint slide 2" })).toBeInTheDocument();
    expect(createObjectUrl).toHaveBeenCalledTimes(2);
  });

  it("shows an error when a PowerPoint presentation cannot be rendered", async () => {
    vi.mocked(loadPresentation).mockRejectedValueOnce(
      new Error("Invalid PPTX file"),
    );

    const file = new File(["broken presentation"], "broken.pptx", {
      type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    });
    Object.defineProperty(file, "arrayBuffer", {
      value: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
    });

    render(
      <FilePreview
        preview={{
          kind: "pptx",
          file,
        }}
      />,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Failed to render PowerPoint presentation.",
    );
  });

  it("renders an unsupported file message", () => {
    render(
      <FilePreview
        preview={{
          kind: "unsupported",
          fileType: "application/octet-stream",
        }}
      />,
    );

    expect(
      screen.getByText("Preview not available for this file type"),
    ).toBeInTheDocument();

    expect(
      screen.getByText("Type: application/octet-stream"),
    ).toBeInTheDocument();
  });

  it("renders parsed CSV rows as a table", async () => {
    const file = new File(["Name,Amount\nAnna,2\nJan,5"], "payments.csv", {
      type: "text/csv",
    });

    render(
      <FilePreview
        preview={{
          kind: "csv",
          file,
        }}
      />,
    );

    expect(await screen.findByRole("table")).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Name" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Amount" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Anna" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "2" })).toBeInTheDocument();
  });

  it("shows sheet names after loading an XLSX file", async () => {
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([["Produkt"], ["Kawa"]]),
      "Sprzedaż",
    );

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([["Status"], ["Gotowe"]]),
      "Podsumowanie",
    );

    const bytes = XLSX.write(workbook, {
      type: "array",
      bookType: "xlsx",
    });

    const file = new File([bytes], "report.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    render(
      <FilePreview
        preview={{
          kind: "xlsx",
          file,
        }}
      />,
    );

    expect(await screen.findByText("Sprzedaż")).toBeInTheDocument();
    expect(await screen.findByText("Podsumowanie")).toBeInTheDocument();
  });

  it("reports the initial and newly selected XLSX sheet", async () => {
    const user = userEvent.setup();
    const onXlsxSheetChange = vi.fn();

    const parseSpy = vi.spyOn(xlsxUtils, "parseXlsxFile").mockResolvedValue([
      {
        name: "Sprzedaż",
        rows: [["Produkt"], ["Kawa"]],
      },
      {
        name: "Magazyn",
        rows: [["Miasto"], ["Warszawa"]],
      },
    ]);

    try {
      const file = new File(["placeholder"], "report.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      render(
        <FilePreview
          preview={{
            kind: "xlsx",
            file,
          }}
          onXlsxSheetChange={onXlsxSheetChange}
        />,
      );

      await waitFor(() => {
        expect(onXlsxSheetChange).toHaveBeenCalledWith("Sprzedaż");
      });

      expect(
        screen.getByText(
          "If this sheet depends on formulas or charts from other sheets, choose All sheets.",
        ),
      ).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "All sheets" }));

      expect(onXlsxSheetChange).toHaveBeenLastCalledWith(undefined);
      expect(
        screen.queryByText(
          "If this sheet depends on formulas or charts from other sheets, choose All sheets.",
        ),
      ).not.toBeInTheDocument();
      expect(screen.getByRole("cell", { name: "Kawa" })).toBeInTheDocument();
      expect(
        screen.getByRole("cell", { name: "Warszawa" }),
      ).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Magazyn" }));

      expect(onXlsxSheetChange).toHaveBeenLastCalledWith("Magazyn");
    } finally {
      parseSpy.mockRestore();
    }
  });

  it("ignores an earlier XLSX result after changing files", async () => {
    let finishFirst!: (sheets: xlsxUtils.XlsxSheet[]) => void;
    let finishSecond!: (sheets: xlsxUtils.XlsxSheet[]) => void;

    const firstRead = new Promise<xlsxUtils.XlsxSheet[]>((resolve) => {
      finishFirst = resolve;
    });

    const secondRead = new Promise<xlsxUtils.XlsxSheet[]>((resolve) => {
      finishSecond = resolve;
    });

    const parseSpy = vi
      .spyOn(xlsxUtils, "parseXlsxFile")
      .mockReturnValueOnce(firstRead)
      .mockReturnValueOnce(secondRead);

    try {
      const { rerender } = render(
        <FilePreview
          preview={{
            kind: "xlsx",
            file: new File([], "first.xlsx"),
          }}
        />,
      );

      rerender(
        <FilePreview
          preview={{
            kind: "xlsx",
            file: new File([], "second.xlsx"),
          }}
        />,
      );

      await act(async () => {
        finishSecond([{ name: "Current sheet", rows: [["B"]] }]);
        await secondRead;
      });

      expect(screen.getByText("Current sheet")).toBeInTheDocument();

      await act(async () => {
        finishFirst([{ name: "Old sheet", rows: [["A"]] }]);
        await firstRead;
      });

      expect(screen.getByText("Current sheet")).toBeInTheDocument();
      expect(screen.queryByText("Old sheet")).not.toBeInTheDocument();
    } finally {
      parseSpy.mockRestore();
    }
  });

  it("displays the first sheet and allows switching sheets", async () => {
    const user = userEvent.setup();
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ["Produkt", "Ilość"],
        ["Kawa", 2],
      ]),
      "Sprzedaż",
    );

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ["Miasto", "Stan"],
        ["Warszawa", 15],
      ]),
      "Magazyn",
    );

    const bytes = XLSX.write(workbook, {
      type: "array",
      bookType: "xlsx",
    });

    const file = new File([bytes], "report.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    render(
      <FilePreview
        preview={{
          kind: "xlsx",
          file,
        }}
      />,
    );

    const firstSheetButton = await screen.findByRole("button", {
      name: "Sprzedaż",
    });

    expect(firstSheetButton).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Kawa" })).toBeInTheDocument();
    expect(
      screen.queryByRole("cell", { name: "Warszawa" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Magazyn" }));

    expect(screen.getByRole("button", { name: "Magazyn" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    expect(firstSheetButton).toHaveAttribute("aria-pressed", "false");

    expect(screen.getByRole("cell", { name: "Warszawa" })).toBeInTheDocument();
    expect(
      screen.queryByRole("cell", { name: "Kawa" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "Charts are not shown in this preview. To view them, convert the file to PDF.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "A" })).toBeInTheDocument();

    expect(screen.getByRole("columnheader", { name: "B" })).toBeInTheDocument();
  });

  it("shows an empty sheet message and allows selecting another sheet", async () => {
    const user = userEvent.setup();
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([]),
      "Pusty",
    );

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([["Kawa"]]),
      "Dane",
    );

    const bytes = XLSX.write(workbook, {
      type: "array",
      bookType: "xlsx",
    });

    const file = new File([bytes], "report.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    render(
      <FilePreview
        preview={{
          kind: "xlsx",
          file,
        }}
      />,
    );

    expect(await screen.findByText("This sheet is empty.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Dane" }));

    expect(screen.getByRole("cell", { name: "Kawa" })).toBeInTheDocument();
    expect(screen.queryByText("This sheet is empty.")).not.toBeInTheDocument();
  });

  it("limits the XLSX preview to the first 100 rows", async () => {
    const workbook = XLSX.utils.book_new();
    const rows = Array.from({ length: 105 }, (_, index) => [
      `Wiersz ${index + 1}`,
    ]);

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet(rows),
      "Dane",
    );

    const bytes = XLSX.write(workbook, {
      type: "array",
      bookType: "xlsx",
    });

    const file = new File([bytes], "large.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    render(
      <FilePreview
        preview={{
          kind: "xlsx",
          file,
        }}
      />,
    );

    expect(await screen.findByRole("table")).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(101);
    expect(
      screen.getByRole("cell", { name: "Wiersz 100" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("cell", { name: "Wiersz 101" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Showing first 100 of 105 rows."),
    ).toBeInTheDocument();
  });

  it("renders DOCX content inside the preview container", async () => {
    const file = new File(["docx content"], "document.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    render(
      <FilePreview
        preview={{
          kind: "word",
          file,
        }}
      />,
    );

    await waitFor(() => {
      expect(renderAsync).toHaveBeenCalledTimes(1);
    });

    expect(renderAsync).toHaveBeenCalledWith(
      expect.anything(),
      screen.getByTestId("docx-preview"),
    );
  });

  it("shows XLSX columns that appear only in later rows", async () => {
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([["Produkt"], ["Kawa", "Ilość", "Magazyn"]]),
      "Dane",
    );

    const bytes = XLSX.write(workbook, {
      type: "array",
      bookType: "xlsx",
    });

    const file = new File([bytes], "uneven-columns.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    render(
      <FilePreview
        preview={{
          kind: "xlsx",
          file,
        }}
      />,
    );

    expect(await screen.findByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "A" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "B" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "C" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Magazyn" })).toBeInTheDocument();
  });
});
