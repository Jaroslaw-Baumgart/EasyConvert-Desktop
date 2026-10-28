import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname } from "node:path";
import { Readable } from "node:stream";
import { getSourcePath } from "./sourceRegistry";
import { getResultPath } from "./resultRegistry";

const mimeTypes: Record<string, string> = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
  ".pdf": "application/pdf", ".txt": "text/plain; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

export async function previewResponse(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const match = /^\/preview\/(source|result)\/([a-zA-Z0-9-]{1,128})$/.exec(url.pathname);
  if (!match || url.search || url.host !== "easyconvert") return new Response("Not found", { status: 404 });
  if (request.method !== "GET" && request.method !== "HEAD") return new Response("Forbidden", { status: 403 });
  const origin = request.headers.get("Origin");
  if (origin && origin !== "app://easyconvert" && origin !== "http://localhost:5173") {
    return new Response("Forbidden", { status: 403 });
  }
  try {
    const filePath = match[1] === "source" ? getSourcePath(match[2]) : getResultPath(match[2]);
    const info = await stat(filePath);
    const mime = mimeTypes[extname(filePath).toLowerCase()];
    if (!info.isFile() || !mime) return new Response("Not found", { status: 404 });
    const headers = new Headers({
      "Content-Type": mime, "Content-Length": String(info.size),
      "Accept-Ranges": "bytes", "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Access-Control-Allow-Origin": "http://localhost:5173", "Vary": "Origin",
    });
    let start = 0;
    let end = info.size - 1;
    let status = 200;
    const range = request.headers.get("Range");
    if (range) {
      const parts = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!parts || (!parts[1] && !parts[2]) || info.size === 0) {
        headers.set("Content-Range", `bytes */${info.size}`);
        headers.set("Content-Length", "0");
        return new Response(null, { status: 416, headers });
      }
      if (!parts[1]) start = Math.max(0, info.size - Number(parts[2]));
      else {
        start = Number(parts[1]);
        if (parts[2]) end = Math.min(end, Number(parts[2]));
      }
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= info.size) {
        headers.set("Content-Range", `bytes */${info.size}`);
        headers.set("Content-Length", "0");
        return new Response(null, { status: 416, headers });
      }
      status = 206;
      headers.set("Content-Range", `bytes ${start}-${end}/${info.size}`);
      headers.set("Content-Length", String(end - start + 1));
    }
    if (request.method === "HEAD" || info.size === 0) return new Response(null, { status, headers });
    const stream = createReadStream(filePath, { start, end, signal: request.signal });
    return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, { status, headers });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
