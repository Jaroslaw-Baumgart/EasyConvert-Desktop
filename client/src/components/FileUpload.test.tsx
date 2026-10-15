import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import FileUpload from "./FileUpload";

const renderFileUpload = (onFileSelect: (file: File) => void) => {
  render(<FileUpload onFileSelect={onFileSelect} />);
};

describe("FileUpload", () => {
  it("rejects a file with an unsupported extension", async () => {
    const user = userEvent.setup({
      applyAccept: false,
    });

    const onFileSelect = vi.fn();

    renderFileUpload(onFileSelect);

    const input = screen.getByLabelText("Choose File");

    const unsupportedFile = new File(["content"], "photo.exe", {
      type: "application/octet-stream",
    });

    await user.upload(input, unsupportedFile);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Unsupported file format. Supported formats: PDF, JPG, PNG, TXT, DOCX, CSV, XLSX, PPTX.",
    );

    expect(onFileSelect).not.toHaveBeenCalled();
  });

  it("rejects a file larger than 10 MB", async () => {
    const user = userEvent.setup();
    const onFileSelect = vi.fn();

    renderFileUpload(onFileSelect);

    const input = screen.getByLabelText("Choose File");

    const oversizedFile = new File(
      [new Uint8Array(10 * 1024 * 1024 + 1)], // 10 MB + 1 byte
      "largefile.pdf",
      { type: "application/pdf" },
    );

    await user.upload(input, oversizedFile);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "File is too large. Maximum size is 10 MB.",
    );
    expect(onFileSelect).not.toHaveBeenCalled();
  });

  it("accepts a file exactly at the 10 MB limit", async () => {
    const user = userEvent.setup();
    const onFileSelect = vi.fn();

    renderFileUpload(onFileSelect);

    const input = screen.getByLabelText("Choose File");

    const exactSizeFile = new File(
      [new Uint8Array(10 * 1024 * 1024)], // 10 MB
      "exactfile.pdf",
      { type: "application/pdf" },
    );

    await user.upload(input, exactSizeFile);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(onFileSelect).toHaveBeenCalledWith(exactSizeFile);
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

  it("accepts a supported file dropped onto the upload area", () => {
    const onFileSelect = vi.fn();

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

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(onFileSelect).toHaveBeenCalledWith(supportedFile);
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

  it("hints supported file extensions to the file picker", () => {
    const onFileSelect = vi.fn();

    renderFileUpload(onFileSelect);

    expect(screen.getByLabelText("Choose File")).toHaveAttribute(
      "accept",
      ".pdf,.jpg,.png,.txt,.docx,.csv,.xlsx,.pptx",
    );
  });

  it("clears a previous error after selecting a valid file", async () => {
    const user = userEvent.setup({
      applyAccept: false,
    });
    const onFileSelect = vi.fn();

    renderFileUpload(onFileSelect);

    const input = screen.getByLabelText("Choose File");
    const unsupportedFile = new File(["content"], "photo.exe", {
      type: "application/octet-stream",
    });
    const supportedFile = new File(["content"], "document.pdf", {
      type: "application/pdf",
    });

    await user.upload(input, unsupportedFile);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(onFileSelect).not.toHaveBeenCalled();

    await user.upload(input, supportedFile);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(onFileSelect).toHaveBeenCalledTimes(1);
    expect(onFileSelect).toHaveBeenCalledWith(supportedFile);
  });
});
