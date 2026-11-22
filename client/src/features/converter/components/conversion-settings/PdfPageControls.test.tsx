import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import PdfPageControls from "./PdfPageControls";

const setup = (disabled = false) => {
  const onConvert = vi.fn();
  const user = userEvent.setup();

  render(<PdfPageControls disabled={disabled} onConvert={onConvert} />);

  return { user, onConvert };
};

describe("PdfPageControls", () => {
  it("shows A4 portrait as the default page settings", () => {
    setup();

    expect(screen.getByRole("radio", { name: "A4" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "A3" })).not.toBeChecked();

    expect(screen.getByRole("radio", { name: "Portrait" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Landscape" })).not.toBeChecked();
  });

  it("submits default page settings", async () => {
    const { user, onConvert } = setup();

    await user.click(
      screen.getByRole("button", {
        name: "Convert",
      }),
    );

    expect(onConvert.mock.calls[0]?.[0]).toEqual({
      pageSize: "A4",
      pageOrientation: "portrait",
    });
  });

  it("submits A3 landscape settings", async () => {
    const { user, onConvert } = setup();

    await user.click(screen.getByRole("radio", { name: "A3" }));
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

    expect(onConvert.mock.calls[0]?.[0]).toEqual({
      pageSize: "A3",
      pageOrientation: "landscape",
    });
  });

  it("disables conversion when requested by the parent", () => {
    setup(true);

    expect(
      screen.getByRole("button", {
        name: "Convert",
      }),
    ).toBeDisabled();
  });
});
