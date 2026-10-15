import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { server } from "../test/server";
import { convertFile } from "./conversionClient";

describe("convertFile", () => {
  it("rejects oversized downloads before collecting their bodies", async () => {
    server.use(
      http.post("http://localhost:5000/convert", () => HttpResponse.json({
        success: true, files: [{ url: "/output/large.png", name: "large.png" }],
      })),
      http.get("http://localhost:5000/output/large.png", () => new HttpResponse("small body", {
        headers: { "Content-Length": String(101 * 1024 * 1024) },
      })),
    );
    await expect(convertFile(new FormData())).rejects.toMatchObject({ code: "download-failed" });
  });
  it("posts form data and returns downloaded converted files", async () => {
    const formData = new FormData();
    formData.append("conversionType", "jpg-to-png");

    server.use(
      http.post("http://localhost:5000/convert", async ({ request }) => {
        const receivedFormData = await request.formData();

        expect(receivedFormData.get("conversionType")).toBe("jpg-to-png");

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

    const results = await convertFile(formData);
    const [result] = results;

    expect(results).toHaveLength(1);
    expect(result?.url).toBe("http://localhost:5000/output/converted.png");
    expect(result?.file.name).toBe("converted.png");
    expect(await result?.file.text()).toBe("converted content");
  });

  it("reports a download failure when a converted file cannot be fetched", async () => {
    server.use(
      http.post("http://localhost:5000/convert", () =>
        HttpResponse.json({
          success: true,
          files: [
            {
              url: "/output/missing.png",
              name: "missing.png",
            },
          ],
        }),
      ),
      http.get(
        "http://localhost:5000/output/missing.png",
        () => new HttpResponse(null, { status: 404 }),
      ),
    );

    await expect(convertFile(new FormData())).rejects.toMatchObject({
      code: "download-failed",
    });
  });
});
