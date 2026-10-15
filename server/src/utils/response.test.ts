import { describe, expect, it, vi } from "vitest";

import { sendErrorResponse, sendSuccessResponse } from "./response";

const createResponseMock = () => {
  const response = {
    status: vi.fn(),
    json: vi.fn(),
  };

  response.status.mockReturnValue(response);

  return response;
};

describe("sendResponse", () => {
  it("sends a successful conversion response", () => {
    const response = createResponseMock();

    sendSuccessResponse(response, [
      {
        url: "/output/converted.png",
        name: "converted.png",
      },
    ]);

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      success: true,
      files: [
        {
          url: "/output/converted.png",
          name: "converted.png",
        },
      ],
    });
  });

  it.each([
    [400, "No file uploaded", "conversion-failed"],
    [500, "Conversion failed", "conversion-failed"],
    [500, "Required tool is unavailable", "tool-unavailable"],
    [400, "Choose A3 landscape", "invalid-settings"],
    [429, "Service is busy", "service-busy"],
  ] as const)(
    "sends status %i with error: %s and code: %s",
    (status, error, code) => {
      const response = createResponseMock();

      sendErrorResponse(response, status, error, code);

      expect(response.status).toHaveBeenCalledWith(status);
      expect(response.json).toHaveBeenCalledWith({
        success: false,
        error,
        code,
      });
    },
  );
});
