import { selectDesktopSource } from "../api/desktopSource";
import {
  render,
  screen,
  within,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convertDesktopFile } from "../api/desktopConversionClient";
import { ConversionError } from "../api/conversionError";
import { createDesktopApi, convertedResult } from "../test/desktopApi";

vi.mock("../api/desktopConversionClient", () => ({ convertDesktopFile: vi.fn() }));
import { conversions as conversionOptions } from "../config/conversions";
import FileConverter from "./FileConverter";
import * as XLSX from "xlsx";

vi.mock("docx-preview", () => ({
  renderAsync: vi.fn().mockResolvedValue(undefined),
}));

const getOptionCard = (text: string): HTMLElement => {
  return screen.getByRole("button", {
    name: (name) => name.replace(/\s/g, "") === text,
  });
};

const getConvertButton = (optionText: string) => {
  fireEvent.click(getOptionCard(optionText));

  return screen.getByRole("button", { name: "Convert" });
};

beforeEach(() => {
  vi.mocked(convertDesktopFile).mockReset();
  vi.mocked(convertDesktopFile).mockResolvedValue(convertedResult());
  vi.stubGlobal("easyConvert", createDesktopApi());
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const createTestFile = {
  pdf: (name = "document.pdf") =>
    new File(["pdf content"], name, {
      type: "application/pdf",
    }),

  png: (name = "image.png") =>
    new File(["png content"], name, {
      type: "image/png",
    }),

  jpg: (name = "image.jpg") =>
    new File(["jpg content"], name, {
      type: "image/jpeg",
    }),

  txt: (name = "document.txt") =>
    new File(["text content"], name, {
      type: "text/plain",
    }),

  docx: (name = "document.docx") =>
    new File(["docx content"], name, {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }),

  csv: (name = "report.csv") =>
    new File(["ID,Name\n1,Ada"], name, {
      type: "text/csv",
    }),

  xlsx: () => {
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([["Product"], ["Coffee"]]),
      "Overview",
    );

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([["City"], ["Warsaw"]]),
      "Warehouse",
    );

    const bytes = XLSX.write(workbook, {
      type: "array",
      bookType: "xlsx",
    });

    return new File([bytes], "workbook.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
  },
};

const setupFileConverter = () => {
  const user = userEvent.setup();

  render(<FileConverter conversionOptions={conversionOptions} />);

  return {
    user,
    input: screen.getByRole("button", { name: "Choose File" }),
  };
};

describe("FileConverter", () => {
  it("shows the upload prompt before a file is selected", () => {
    setupFileConverter();

    expect(
      screen.getByRole("region", { name: "Upload File" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /→/ })).not.toBeInTheDocument();
  });

  it.each(["document.pdf", "document.PDF"])(
    "shows only conversions allowed for PDF file %s",
    async (fileName) => {
      const file = createTestFile.pdf(fileName);

      const { user, input } = setupFileConverter();

      await selectNativeFile(user, input, file);

      expect(screen.getByTitle("PDF Preview")).toBeInTheDocument();

      expect(getOptionCard("PDF→JPG")).toBeInTheDocument();
      expect(getOptionCard("PDF→TXT")).toBeInTheDocument();
      expect(getOptionCard("PDF→JPG")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      expect(
        screen.queryByRole("button", { name: "JPG→PNG" }),
      ).not.toBeInTheDocument();
      expect(getConvertButton("PDF→JPG")).toBeEnabled();
    },
  );

  it("shows only conversions allowed for a PNG file", async () => {
    const file = createTestFile.png();
    const { user, input } = setupFileConverter();

    await selectNativeFile(user, input, file);

    expect(screen.getByRole("img", { name: "Preview" })).toBeInTheDocument();

    expect(getOptionCard("PNG→JPG")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "PDF→JPG" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "JPG→PNG" }),
    ).not.toBeInTheDocument();
    expect(getConvertButton("PNG→JPG")).toBeEnabled();
  });

  it("moves focus to settings after choosing a conversion format", async () => {
    const { user, input } = setupFileConverter();

    await selectNativeFile(user, input, createTestFile.pdf());
    await user.click(getOptionCard("PDF→TXT"));

    expect(
      screen.getByRole("heading", { name: "Conversion settings" }),
    ).toHaveFocus();
  });

  it("updates available conversions when the selected file changes", async () => {
    const pdfFile = createTestFile.pdf();
    const pngFile = createTestFile.png();

    const { user, input } = setupFileConverter();

    await selectNativeFile(user, input, pdfFile);

    expect(getOptionCard("PDF→JPG")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "PNG→JPG" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove file" }));

    const replacementInput = screen.getByRole("button", { name: "Choose File" });
    await selectNativeFile(user, replacementInput, pngFile);

    expect(
      screen.queryByRole("button", { name: "PDF→JPG" }),
    ).not.toBeInTheDocument();
    expect(getOptionCard("PNG→JPG")).toBeInTheDocument();
  });

  it("clears the previous conversion result when a new file is selected", async () => {
    const initialFile = createTestFile.jpg();
    const newFile = createTestFile.pdf();
    vi.spyOn(HTMLElement.prototype, "scrollIntoView").mockImplementation(
      function (this: HTMLElement) {
        this.dataset.scrolledIntoView = "true";
      },
    );



    const { user, input } = setupFileConverter();

    await selectNativeFile(user, input, initialFile);

    await user.click(getConvertButton("JPG→PNG"));

    expect(
      await screen.findByRole("heading", {
        name: "Converted file",
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: "Download file" }),
    ).toHaveFocus();
    await waitFor(() => {
      expect(screen.getByTestId("converted-file-preview")).toHaveAttribute(
        "data-scrolled-into-view",
        "true",
      );
    });

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(getConvertButton("JPG→PNG")).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Remove file" }));

    const replacementInput = screen.getByRole("button", { name: "Choose File" });
    await selectNativeFile(user, replacementInput, newFile);

    expect(
      screen.queryByRole("heading", {
        name: "Converted file",
      }),
    ).not.toBeInTheDocument();

    expect(screen.getByText("document.pdf")).toBeInTheDocument();
  });

  it("renders a text preview for a TXT file", async () => {
    const file = createTestFile.txt();
    const { user, input } = setupFileConverter();

    await selectNativeFile(user, input, file);

    expect(await screen.findByDisplayValue("text content")).toBeInTheDocument();
  });

  it("renders guidance for a DOCX file", async () => {
    const file = createTestFile.docx();
    const { user, input } = setupFileConverter();

    await selectNativeFile(user, input, file);

    await screen.findByTestId("docx-preview");
  });

  it("shows a safe conversion error when the desktop adapter rejects the conversion", async () => {
    vi.mocked(convertDesktopFile).mockRejectedValueOnce(new Error("Conversion failed"));

    const { user, input } = setupFileConverter();

    await selectNativeFile(user, input, createTestFile.jpg());
    await user.click(getConvertButton("JPG→PNG"));

    const errorAlert = await screen.findByRole("alert");

    expect(errorAlert).toHaveTextContent(
      "The file could not be converted. Please try again.",
    );
    expect(errorAlert).toHaveFocus();
  });

  it("show a loading state while conversion is in progress", async () => {
    let finishRequest: (() => void) | undefined;

    const requestGate = new Promise<void>((resolve) => {
      finishRequest = resolve;
    });

    vi.mocked(convertDesktopFile).mockImplementationOnce(async () => {
      await requestGate;
      throw new Error("Conversion failed");
    });

    const { user, input } = setupFileConverter();

    await selectNativeFile(user, input, createTestFile.jpg());
    await user.click(getConvertButton("JPG→PNG"));

    expect(screen.getByRole("status")).toHaveTextContent("Converting");

    finishRequest?.();

    expect(
      await screen.findByText(
        "The file could not be converted. Please try again.",
      ),
    ).toBeInTheDocument();
  });

  it("sends only one request when Convert is clicked repeatedly", async () => {
    let requestCount = 0;
    let finishRequest: (() => void) | undefined;

    const requestGate = new Promise<void>((resolve) => {
      finishRequest = resolve;
    });

    vi.mocked(convertDesktopFile).mockImplementationOnce(async () => {
      requestCount += 1;
      await requestGate;
      throw new Error("Conversion failed");
    });

    const { user, input } = setupFileConverter();

    await selectNativeFile(user, input, createTestFile.jpg());

    const convertButton = getConvertButton("JPG→PNG");

    await user.dblClick(convertButton);

    expect(convertButton).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Converting");
    expect(requestCount).toBe(1);

    finishRequest?.();

    expect(
      await screen.findByText(
        "The file could not be converted. Please try again.",
      ),
    ).toBeInTheDocument();
  });

  it("shows an error when the desktop adapter rejects an invalid response", async () => {
    vi.mocked(convertDesktopFile).mockRejectedValueOnce(new ConversionError("invalid-response"));

    const { user, input } = setupFileConverter();

    await selectNativeFile(user, input, createTestFile.jpg());
    await user.click(getConvertButton("JPG→PNG"));

    expect(
      await screen.findByText(
        "The application returned an unexpected response. Please try again.",
      ),
    ).toBeInTheDocument();

    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    expect(getConvertButton("JPG→PNG")).toBeEnabled();

    expect(
      screen.queryByRole("heading", {
        name: "Converted file",
      }),
    ).not.toBeInTheDocument();
  });

  it("shows a download error when the converted file cannot be fetched", async () => {
    vi.mocked(convertDesktopFile).mockRejectedValueOnce(new ConversionError("download-failed"));

    const { user, input } = setupFileConverter();

    await selectNativeFile(user, input, createTestFile.jpg());
    await user.click(getConvertButton("JPG→PNG"));

    expect(
      await screen.findByText(
        "The converted file could not be downloaded. Please try again.",
      ),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("heading", {
        name: "Converted file",
      }),
    ).not.toBeInTheDocument();
  });

  it("successfully retries a conversion without selecting the file again", async () => {
    let requestCount = 0;

    vi.mocked(convertDesktopFile).mockImplementation(async () => {
      requestCount += 1;
      if (requestCount === 1) throw new Error("Temporary conversion failure");
      return convertedResult();
    });

    const { user, input } = setupFileConverter();

    await selectNativeFile(user, input, createTestFile.jpg());
    await user.click(getConvertButton("JPG→PNG"));

    expect(
      await screen.findByText(
        "The file could not be converted. Please try again.",
      ),
    ).toBeInTheDocument();

    expect(screen.getByText("image.jpg")).toBeInTheDocument();

    await user.click(getConvertButton("JPG→PNG"));

    expect(
      await screen.findByRole("heading", {
        name: "Converted file",
      }),
    ).toBeInTheDocument();

    expect(
      screen.queryByText("The file could not be converted. Please try again."),
    ).not.toBeInTheDocument();

    expect(requestCount).toBe(2);
  });

  it("shows a tool unavailable message when required software is missing", async () => {
    vi.mocked(convertDesktopFile).mockRejectedValueOnce(new ConversionError("tool-unavailable"));

    const { user, input } = setupFileConverter();

    await selectNativeFile(user, input, createTestFile.docx());
    await user.click(getConvertButton("DOCX→PDF"));

    expect(
      await screen.findByText(
        "This conversion is currently unavailable. Please try again later.",
      ),
    ).toBeInTheDocument();

    expect(
      screen.queryByText("soffice is not recognized as a command"),
    ).not.toBeInTheDocument();
  });

  it("shows an error when downloading the converted file fails", async () => {


    const { user, input } = setupFileConverter();

    await selectNativeFile(user, input, createTestFile.jpg());
    await user.click(getConvertButton("JPG→PNG"));

    const downloadButton = await screen.findByRole("button", {
      name: "Download file",
    });

    vi.spyOn(URL, "createObjectURL").mockImplementationOnce(() => {
      throw new Error("Browser download failed");
    });

    await user.click(downloadButton);

    expect(
      await screen.findByText(
        "The converted file could not be downloaded. Please try again.",
      ),
    ).toBeInTheDocument();

    expect(downloadButton).toBeInTheDocument();

    await user.click(downloadButton);

    expect(
      screen.queryByText(
        "The converted file could not be downloaded. Please try again.",
      ),
    ).not.toBeInTheDocument();
  });

  it("sends customized PNG to JPG settings", async () => {
    vi.mocked(convertDesktopFile).mockResolvedValueOnce(convertedResult("converted.jpg", "image/jpeg"));

    const { user, input } = setupFileConverter();

    await selectNativeFile(user, input, createTestFile.png());

    const pngToJpgCard = getOptionCard("PNG→JPG");
    await user.click(pngToJpgCard);

    const qualityInput = screen.getByLabelText("Quality");

    await user.clear(qualityInput);
    await user.type(qualityInput, "95");

    fireEvent.change(
      screen.getByLabelText("Replace transparent areas with"),
      {
        target: {
          value: "#000000",
        },
      },
    );

    await user.click(
      screen.getByRole("button", {
        name: "Convert",
      }),
    );

    expect(
      await screen.findByRole("heading", {
        name: "Converted file",
      }),
    ).toBeInTheDocument();
    expect(vi.mocked(convertDesktopFile).mock.calls[0][1]).toEqual({
      sourceId: "source-1", conversion: "png-to-jpg",
      options: { quality: 95, backgroundColor: "#000000" },
    });
  });

  it("downloads and displays every file returned by a conversion", async () => {

    vi.mocked(convertDesktopFile).mockResolvedValueOnce([
      { url: "app://easyconvert/preview/result/page-1", file: new File(["one"], "page-1.jpg", { type: "image/jpeg" }) },
      { url: "app://easyconvert/preview/result/page-2", file: new File(["two"], "page-2.jpg", { type: "image/jpeg" }) },
    ]);

    const { user, input } = setupFileConverter();

    await selectNativeFile(user, input, createTestFile.pdf());
    await user.click(getConvertButton("PDF→JPG"));

    expect(
      await screen.findByRole("heading", {
        name: "Converted file",
      }),
    ).toBeInTheDocument();

    expect(convertDesktopFile).toHaveBeenCalledOnce();

    const convertedFiles = screen.getByLabelText("Converted files");

    expect(
      within(convertedFiles).getByRole("button", {
        name: "Page 1",
      }),
    ).toHaveAttribute("aria-pressed", "true");

    const secondPageButton = within(convertedFiles).getByRole("button", {
      name: "Page 2",
    });

    expect(secondPageButton).toHaveAttribute("aria-pressed", "false");

    const firstPreviewUrl = screen
      .getByRole("img", { name: "Preview" })
      .getAttribute("src");

    await user.click(secondPageButton);

    expect(secondPageButton).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => {
      const secondPreviewUrl = screen
        .getByRole("img", { name: "Preview" })
        .getAttribute("src");

      expect(secondPreviewUrl).toMatch(/^blob:/);
      expect(secondPreviewUrl).not.toBe(firstPreviewUrl);
    });
  });

  it("shows PDF page settings for CSV to PDF", async () => {
    const { user, input } = setupFileConverter();

    await selectNativeFile(user, input, createTestFile.csv());

    const csvToPdfCard = getOptionCard("CSV→PDF");
    await user.click(csvToPdfCard);

    expect(
      screen.getByRole("radio", {
        name: "A4",
      }),
    ).toBeChecked();

    expect(
      screen.getByRole("radio", {
        name: "A3",
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("radio", {
        name: "Portrait",
      }),
    ).toBeChecked();

    expect(
      screen.getByRole("radio", {
        name: "Landscape",
      }),
    ).toBeInTheDocument();
  });

  it("sends the selected XLSX sheet with page settings", async () => {
    const { user, input } = setupFileConverter();
    await selectNativeFile(user, input, createTestFile.xlsx());
    await user.click(await screen.findByRole("button", { name: "Warehouse" }));
    await user.click(getOptionCard("XLSX→PDF"));
    await user.click(screen.getByRole("radio", { name: "A3" }));
    await user.click(screen.getByRole("radio", { name: "Landscape" }));
    await user.click(screen.getByRole("button", { name: "Convert" }));
    await screen.findByRole("heading", { name: "Converted file" });
    expect(vi.mocked(convertDesktopFile).mock.calls[0][1]).toEqual({
      sourceId: "source-1", conversion: "xlsx-to-pdf",
      options: { sheetName: "Warehouse", pageSize: "A3", pageOrientation: "landscape" },
    });
    await user.click(screen.getByRole("button", { name: "All sheets" }));
    await user.click(screen.getByRole("button", { name: "Convert" }));
    await waitFor(() => expect(convertDesktopFile).toHaveBeenCalledTimes(2));
    expect(vi.mocked(convertDesktopFile).mock.calls[1][1]).toEqual({
      sourceId: "source-1", conversion: "xlsx-to-pdf",
      options: { pageSize: "A3", pageOrientation: "landscape" },
    });
  });
});

vi.mock("../api/desktopSource", () => ({ selectDesktopSource: vi.fn() }));
async function selectNativeFile(
  user: ReturnType<typeof userEvent.setup>, button: HTMLElement, file: File,
) {
  vi.mocked(selectDesktopSource).mockResolvedValueOnce({
    source: { sourceId: "source-1", name: file.name, sizeBytes: file.size }, file,
  });
  await user.click(button);
  await screen.findByText(file.name);
}
