import { net, protocol } from "electron";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { previewResponse } from "./previewResponse";

const rendererCsp = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self' blob: data:",
  "connect-src 'self' blob:",
  "worker-src 'self' blob:",
  "frame-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

export function registerAppProtocol(): void {
  const rendererDirectory = path.resolve(__dirname, "../../../client/dist");

  protocol.handle("app", async (request) => {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/preview/")) return previewResponse(request);

    if (url.host !== "easyconvert" || request.method !== "GET") {
      return new Response("Forbidden", { status: 403 });
    }

    let pathname: string;

    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      return new Response("Invalid URL", { status: 400 });
    }

    const relativePath = pathname === "/" ? "index.html" : pathname.slice(1);

    const allowed =
      relativePath === "index.html" ||
      relativePath === "favicon.png" ||
      /^assets\/[a-zA-Z0-9_.-]+$/.test(relativePath);

    if (!allowed) {
      return new Response("Not found", { status: 404 });
    }

    const filePath = path.resolve(rendererDirectory, relativePath);
    const relative = path.relative(rendererDirectory, filePath);

    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      return new Response("Forbidden", { status: 403 });
    }

    try {
      const response = await net.fetch(pathToFileURL(filePath).href);
      const headers = new Headers(response.headers);

      headers.set("Content-Security-Policy", rendererCsp);

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch {
      return new Response("Not found", { status: 404 });
    }
  });
}
