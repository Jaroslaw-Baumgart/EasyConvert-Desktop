import {
  render,
  screen,
  within,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";

import { server } from "../test/server";
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
    input: screen.getByLabelText("Choose File"),
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

      await user.upload(input, file);

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

    await user.upload(input, file);

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

    await user.upload(input, createTestFile.pdf());
    await user.click(getOptionCard("PDF→TXT"));

    expect(
      screen.getByRole("heading", { name: "Conversion settings" }),
    ).toHaveFocus();
  });

  it("updates available conversions when the selected file changes", async () => {
    const pdfFile = createTestFile.pdf();
    const pngFile = createTestFile.png();

    const { user, input } = setupFileConverter();

    await user.upload(input, pdfFile);

    expect(getOptionCard("PDF→JPG")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "PNG→JPG" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove file" }));

    const replacementInput = screen.getByLabelText("Choose File");
    await user.upload(replacementInput, pngFile);

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

    server.use(
      http.post("http://localhost:5000/convert", () => {
        return HttpResponse.json({
          success: true,
          files: [
            {
              url: "/output/converted.png",
              name: "converted.png",
            },
          ],
        });
      }),

      http.get("http://localhost:5000/output/converted.png", () => {
        return new HttpResponse("converted content", {
          headers: {
            "Content-Type": "image/png",
          },
        });
      }),
    );

    const { user, input } = setupFileConverter();

    await user.upload(input, initialFile);

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

    const replacementInput = screen.getByLabelText("Choose File");
    await user.upload(replacementInput, newFile);

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

    await user.upload(input, file);

    expect(await screen.findByDisplayValue("text content")).toBeInTheDocument();
  });

  it("renders guidance for a DOCX file", async () => {
    const file = createTestFile.docx();
    const { user, input } = setupFileConverter();

    await user.upload(input, file);

    await screen.findByTestId("docx-preview");
  });

  it("shows a safe conversion error when the backend rejects the conversion", async () => {
    server.use(
      http.post("http://localhost:5000/convert", () => {
        return HttpResponse.json(
          {
            success: false,
            error: "Unsupported conversion",
            code: "conversion-failed",
          },
          { status: 400 },
        );
      }),
    );

    const { user, input } = setupFileConverter();

    await user.upload(input, createTestFile.jpg());
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

    server.use(
      http.post("http://localhost:5000/convert", async () => {
        await requestGate;

        return HttpResponse.json(
          {
            success: false,
            error: "Test conversion stopped",
            code: "conversion-failed",
          },
          { status: 500 },
        );
      }),
    );

    const { user, input } = setupFileConverter();

    await user.upload(input, createTestFile.jpg());
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

    server.use(
      http.post("http://localhost:5000/convert", async () => {
        requestCount += 1;
        await requestGate;

        return HttpResponse.json(
          {
            success: false,
            error: "Test conversion stopped",
            code: "conversion-failed",
          },
          { status: 500 },
        );
      }),
    );

    const { user, input } = setupFileConverter();

    await user.upload(input, createTestFile.jpg());

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

  it("shows an error when the backend returns an invalid response", async () => {
    server.use(
      http.post("http://localhost:5000/convert", async () => {
        return HttpResponse.json({
          success: true,
          files: [],
        });
      }),
    );

    const { user, input } = setupFileConverter();

    await user.upload(input, createTestFile.jpg());
    await user.click(getConvertButton("JPG→PNG"));

    expect(
      await screen.findByText(
        "The server returned an unexpected response. Please try again.",
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
    server.use(
      http.post("http://localhost:5000/convert", () => {
        return HttpResponse.json({
          success: true,
          files: [
            {
              url: "/output/converted.png",
              name: "converted.png",
            },
          ],
        });
      }),

      http.get("http://localhost:5000/output/converted.png", () => {
        return new HttpResponse(null, { status: 500 });
      }),
    );

    const { user, input } = setupFileConverter();

    await user.upload(input, createTestFile.jpg());
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

  it("shows an invalid response error when the backend returns malformed JSON", async () => {
    server.use(
      http.post("http://localhost:5000/convert", () => {
        return new HttpResponse("not valid JSON", {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        });
      }),
    );

    const { user, input } = setupFileConverter();

    await user.upload(input, createTestFile.jpg());
    await user.click(getConvertButton("JPG→PNG"));

    expect(
      await screen.findByText(
        "The server returned an unexpected response. Please try again.",
      ),
    ).toBeInTheDocument();
  });

  it("successfully retries a conversion without selecting the file again", async () => {
    let requestCount = 0;

    server.use(
      http.post("http://localhost:5000/convert", () => {
        requestCount += 1;

        if (requestCount === 1) {
          return HttpResponse.json(
            {
              success: false,
              error: "Temporary backend failure",
              code: "conversion-failed",
            },
            { status: 500 },
          );
        }

        return HttpResponse.json({
          success: true,
          files: [
            {
              url: "/output/converted.png",
              name: "converted.png",
            },
          ],
        });
      }),

      http.get("http://localhost:5000/output/converted.png", () => {
        return new HttpResponse("converted content", {
          headers: {
            "Content-Type": "image/png",
          },
        });
      }),
    );

    const { user, input } = setupFileConverter();

    await user.upload(input, createTestFile.jpg());
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
    server.use(
      http.post("http://localhost:5000/convert", () => {
        return HttpResponse.json(
          {
            success: false,
            error: "soffice is not recognized as a command",
            code: "tool-unavailable",
          },
          { status: 500 },
        );
      }),
    );

    const { user, input } = setupFileConverter();

    await user.upload(input, createTestFile.docx());
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
    server.use(
      http.post("http://localhost:5000/convert", () => {
        return HttpResponse.json({
          success: true,
          files: [
            {
              url: "/output/converted.png",
              name: "converted.png",
            },
          ],
        });
      }),

      http.get("http://localhost:5000/output/converted.png", () => {
        return new HttpResponse("converted content", {
          headers: {
            "Content-Type": "image/png",
          },
        });
      }),
    );

    const { user, input } = setupFileConverter();

    await user.upload(input, createTestFile.jpg());
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
    server.use(
      http.post("http://localhost:5000/convert", async () => {
        return HttpResponse.json({
          success: true,
          files: [
            {
              url: "/output/converted.jpg",
              name: "converted.jpg",
            },
          ],
        });
      }),

      http.get("http://localhost:5000/output/converted.jpg", () => {
        return new HttpResponse("converted content", {
          headers: {
            "Content-Type": "image/jpeg",
          },
        });
      }),
    );

    const { user, input } = setupFileConverter();

    await user.upload(input, createTestFile.png());

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
  });

  it("downloads and displays every file returned by a conversion", async () => {
    const firstFileRequest = vi.fn();
    const secondFileRequest = vi.fn();

    server.use(
      http.post("http://localhost:5000/convert", () => {
        return HttpResponse.json({
          success: true,
          files: [
            {
              url: "/output/page-1.jpg",
              name: "page-1.jpg",
            },
            {
              url: "/output/page-2.jpg",
              name: "page-2.jpg",
            },
          ],
        });
      }),

      http.get("http://localhost:5000/output/page-1.jpg", () => {
        firstFileRequest();

        return new HttpResponse("page one", {
          headers: {
            "Content-Type": "image/jpeg",
          },
        });
      }),

      http.get("http://localhost:5000/output/page-2.jpg", () => {
        secondFileRequest();

        return new HttpResponse("page two", {
          headers: {
            "Content-Type": "image/jpeg",
          },
        });
      }),
    );

    const { user, input } = setupFileConverter();

    await user.upload(input, createTestFile.pdf());
    await user.click(getConvertButton("PDF→JPG"));

    expect(
      await screen.findByRole("heading", {
        name: "Converted file",
      }),
    ).toBeInTheDocument();

    expect(firstFileRequest).toHaveBeenCalledOnce();
    expect(secondFileRequest).toHaveBeenCalledOnce();

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

    await user.upload(input, createTestFile.csv());

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
    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >(async (input) => {
      if (String(input).endsWith("/convert")) {
        return HttpResponse.json({
          success: true,
          files: [
            {
              name: "workbook.pdf",
              url: "/output/workbook.pdf",
            },
          ],
        });
      }

      return new HttpResponse("PDF content", {
        headers: {
          "Content-Type": "application/pdf",
        },
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    const { user, input } = setupFileConverter();

    await user.upload(input, createTestFile.xlsx());

    await screen.findByRole("button", { name: "Overview" });
    await user.click(screen.getByRole("button", { name: "Warehouse" }));

    const xlsxToPdfCard = getOptionCard("XLSX→PDF");
    await user.click(xlsxToPdfCard);

    await user.click(
      screen.getByRole("radio", {
        name: "A3",
      }),
    );

    await user.click(
      screen.getByRole("radio", {
        name: "Landscape",
      }),
    );

    await user.click(
      screen.getByRole("button", {
        name: "Convert",
      }),
    );

    await waitFor(() => {
      const conversionRequests = fetchMock.mock.calls.filter(([input]) =>
        String(input).endsWith("/convert"),
      );

      expect(conversionRequests).toHaveLength(1);
    });

    const selectedSheetRequests = fetchMock.mock.calls.filter(([input]) =>
      String(input).endsWith("/convert"),
    );

    const [, selectedSheetRequestOptions] = selectedSheetRequests[0] ?? [];
    const selectedSheetFormData = selectedSheetRequestOptions?.body;

    expect(selectedSheetFormData).toBeInstanceOf(FormData);

    if (!(selectedSheetFormData instanceof FormData)) {
      throw new Error("Conversion request did not contain FormData.");
    }

    expect(selectedSheetFormData.get("conversionType")).toBe("xlsx-to-pdf");
    expect(selectedSheetFormData.get("sheetName")).toBe("Warehouse");
    expect(selectedSheetFormData.get("pageSize")).toBe("A3");
    expect(selectedSheetFormData.get("pageOrientation")).toBe("landscape");

    await user.click(screen.getByRole("button", { name: "All sheets" }));

    await user.click(
      screen.getByRole("button", {
        name: "Convert",
      }),
    );

    await waitFor(() => {
      const conversionRequests = fetchMock.mock.calls.filter(([input]) =>
        String(input).endsWith("/convert"),
      );

      expect(conversionRequests).toHaveLength(2);
    });

    const allSheetsRequests = fetchMock.mock.calls.filter(([input]) =>
      String(input).endsWith("/convert"),
    );

    const [, allSheetsRequestOptions] = allSheetsRequests[1] ?? [];
    const allSheetsFormData = allSheetsRequestOptions?.body;

    expect(allSheetsFormData).toBeInstanceOf(FormData);

    if (!(allSheetsFormData instanceof FormData)) {
      throw new Error("All-sheets request did not contain FormData.");
    }

    expect(allSheetsFormData.get("conversionType")).toBe("xlsx-to-pdf");
    expect(allSheetsFormData.has("sheetName")).toBe(false);
    expect(allSheetsFormData.get("pageSize")).toBe("A3");
    expect(allSheetsFormData.get("pageOrientation")).toBe("landscape");
  });
});
