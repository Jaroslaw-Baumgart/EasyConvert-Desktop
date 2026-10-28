import { selectDesktopSource } from "../api/desktopSource";
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EasyConvertApi } from "../../../shared/desktopContract";

import FileUpload from "./FileUpload";

beforeEach(() => vi.mocked(selectDesktopSource).mockReset());
afterEach(() => vi.unstubAllGlobals());

const renderFileUpload = (onFileSelect: (file: File) => void) => {
  render(<FileUpload onFileSelect={onFileSelect} />);
};

describe("FileUpload", () => {
  it("preserves the selection when the native dialog is cancelled", async () => {
    const onFileSelect = vi.fn();
    vi.mocked(selectDesktopSource).mockResolvedValueOnce(null);
    renderFileUpload(onFileSelect);
    await userEvent.click(screen.getByRole("button", { name: "Choose File" }));
    expect(onFileSelect).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Choose File" })).toBeEnabled();
  });

  it("blocks another dialog while selection is pending", async () => {
    let finish!: (value: null) => void;
    vi.mocked(selectDesktopSource).mockImplementationOnce(
      () => new Promise((resolve) => { finish = resolve; }),
    );
    renderFileUpload(vi.fn());
    const button = screen.getByRole("button", { name: "Choose File" });
    await userEvent.click(button);
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(selectDesktopSource).toHaveBeenCalledTimes(1);
    await act(async () => finish(null));
    expect(button).toBeEnabled();
  });

  it("reports a native selection failure and allows retry", async () => {
    vi.mocked(selectDesktopSource).mockRejectedValueOnce(new Error("Dialog failed."));
    renderFileUpload(vi.fn());
    const button = screen.getByRole("button", { name: "Choose File" });
    await userEvent.click(button);
    expect(screen.getByRole("alert")).toHaveTextContent("Dialog failed.");
    vi.mocked(selectDesktopSource).mockResolvedValueOnce(null);
    await userEvent.click(button);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(button).toBeEnabled();
  });
  it("rejects a file with an unsupported extension", async () => {
    const user = userEvent.setup({
      applyAccept: false,
    });

    const onFileSelect = vi.fn();

    renderFileUpload(onFileSelect);

    const input = screen.getByRole("button", { name: "Choose File" });

    const unsupportedFile = new File(["content"], "photo.exe", {
      type: "application/octet-stream",
    });

    await selectNativeFile(user, input, unsupportedFile);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Unsupported file format. Supported formats: PDF, JPG, PNG, TXT, DOCX, CSV, XLSX, PPTX.",
    );

    expect(onFileSelect).not.toHaveBeenCalled();
  });

  it("rejects a file larger than 10 MB", async () => {
    const user = userEvent.setup();
    const onFileSelect = vi.fn();

    renderFileUpload(onFileSelect);

    const input = screen.getByRole("button", { name: "Choose File" });

    const oversizedFile = new File(
      [new Uint8Array(10 * 1024 * 1024 + 1)], // 10 MB + 1 byte
      "largefile.pdf",
      { type: "application/pdf" },
    );

    await selectNativeFile(user, input, oversizedFile);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "File is too large. Maximum size is 10 MB.",
    );
    expect(onFileSelect).not.toHaveBeenCalled();
  });

  it("accepts a file exactly at the 10 MB limit", async () => {
    const user = userEvent.setup();
    const onFileSelect = vi.fn();

    renderFileUpload(onFileSelect);

    const input = screen.getByRole("button", { name: "Choose File" });

    const exactSizeFile = new File(
      [new Uint8Array(10 * 1024 * 1024)], // 10 MB
      "exactfile.pdf",
      { type: "application/pdf" },
    );

    await selectNativeFile(user, input, exactSizeFile);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(onFileSelect).toHaveBeenCalledWith(exactSizeFile, "source-1");
  });

  it("rejects an unsupported file dropped onto the upload area", () => {
    const onFileSelect = vi.fn();

    renderFileUpload(onFileSelect);

    const unsupportedFile = new File(["content"], "photo.exe", {
      type: "application/octet-stream",
    });

    const uploadArea = screen.getByRole("region", {
      name: "Upload File",
    });

    fireEvent.drop(uploadArea, {
      dataTransfer: {
        files: [unsupportedFile],
      },
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Unsupported file format. Supported formats: PDF, JPG, PNG, TXT, DOCX, CSV, XLSX, PPTX.",
    );
    expect(onFileSelect).not.toHaveBeenCalled();
  });

  it("registers a supported dropped file before forwarding its source identifier", async () => {
    const onFileSelect = vi.fn();
    let finishRegistration!: (source: Awaited<ReturnType<EasyConvertApi["selectDroppedSource"]>>) => void;
    const selectDroppedSource = vi.fn<EasyConvertApi["selectDroppedSource"]>(
      () => new Promise((resolve) => { finishRegistration = resolve; }),
    );
    const api: EasyConvertApi = {
      platform: "desktop",
      selectSource: vi.fn(),
      selectDroppedSource,
      startConversion: vi.fn(),
      getJobState: vi.fn(),
      onJobStateChanged: vi.fn(),
      resetSource: vi.fn(),
      saveResult: vi.fn(),
    };
    vi.stubGlobal("easyConvert", api);

    renderFileUpload(onFileSelect);

    const supportedFile = new File(["content"], "document.pdf", {
      type: "application/pdf",
    });

    const uploadArea = screen.getByRole("region", {
      name: "Upload File",
    });

    fireEvent.drop(uploadArea, {
      dataTransfer: {
        files: [supportedFile],
      },
    });

    expect(selectDroppedSource).toHaveBeenCalledExactlyOnceWith(supportedFile);
    expect(onFileSelect).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Choose File" })).toBeDisabled();

    await act(async () => {
      finishRegistration({ sourceId: "dropped-source-1", name: supportedFile.name, sizeBytes: supportedFile.size });
    });

    await waitFor(() => {
      expect(onFileSelect).toHaveBeenCalledExactlyOnceWith(supportedFile, "dropped-source-1");
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Choose File" })).toBeEnabled();
  });

  it("shows the maximum file size and a conversion legend", () => {
    const onFileSelect = vi.fn();

    renderFileUpload(onFileSelect);

    expect(
      screen.getByText("Maximum file size: 10 MB."),
    ).toBeInTheDocument();

    expect(
      screen.getByText("View supported conversions"),
    ).toBeInTheDocument();
  });

  it("opens the native picker and forwards the source identifier", async () => {
 const user = userEvent.setup();
 const onFileSelect = vi.fn();
 renderFileUpload(onFileSelect);
 const file = new File(["jpg"], "photo.jpg", { type: "image/jpeg" });
 await selectNativeFile(user, screen.getByRole("button", { name: "Choose File" }), file);
 expect(selectDesktopSource).toHaveBeenCalled();
 expect(onFileSelect).toHaveBeenCalledExactlyOnceWith(file, "source-1");
 });

  it("clears a previous error after selecting a valid file", async () => {
    const user = userEvent.setup({
      applyAccept: false,
    });
    const onFileSelect = vi.fn();

    renderFileUpload(onFileSelect);

    const input = screen.getByRole("button", { name: "Choose File" });
    const unsupportedFile = new File(["content"], "photo.exe", {
      type: "application/octet-stream",
    });
    const supportedFile = new File(["content"], "document.pdf", {
      type: "application/pdf",
    });

    await selectNativeFile(user, input, unsupportedFile);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(onFileSelect).not.toHaveBeenCalled();

    await selectNativeFile(user, input, supportedFile);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(onFileSelect).toHaveBeenCalledTimes(1);
    expect(onFileSelect).toHaveBeenCalledWith(supportedFile, "source-1");
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
}
