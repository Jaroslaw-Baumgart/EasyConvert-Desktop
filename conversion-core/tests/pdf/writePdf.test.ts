import { Readable, Writable } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createWriteStream: vi.fn(), PDFDocument: vi.fn(), unlink: vi.fn() }));
vi.mock("node:fs", () => ({ createWriteStream: mocks.createWriteStream }));
vi.mock("node:fs/promises", () => ({ unlink: mocks.unlink }));
vi.mock("pdfkit", () => ({ default: mocks.PDFDocument }));
import { writePdf } from "../../pdf/writePdf";

function setup(stream = new Writable({ write(_chunk, _encoding, done) { done(); } })) {
  const doc = Object.assign(new Readable({ read() {} }), {
    end: vi.fn(),
  });
  doc.end.mockImplementation(() => { doc.push(null); });
  const unpipe = vi.spyOn(doc, "unpipe");
  mocks.PDFDocument.mockImplementation(function () { return doc; });
  mocks.createWriteStream.mockReturnValue(stream);
  return { doc, stream, unpipe };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.unlink.mockResolvedValue(undefined);
});

describe("writePdf", () => {
  it("creates the document with supplied options and writes rendered content", async () => {
    const chunks: Buffer[] = [];
    const stream = new Writable({ write(chunk, _encoding, done) { chunks.push(Buffer.from(chunk)); done(); } });
    const { doc } = setup(stream);
    const render = vi.fn(() => { doc.push(Buffer.from("PDF content")); });

    await writePdf("output.pdf", { autoFirstPage: false }, render);

    expect(mocks.PDFDocument).toHaveBeenCalledExactlyOnceWith({ autoFirstPage: false });
    expect(mocks.createWriteStream).toHaveBeenCalledExactlyOnceWith("output.pdf");
    expect(render).toHaveBeenCalledExactlyOnceWith(doc);
    expect(Buffer.concat(chunks).toString()).toBe("PDF content");
    expect(doc.end).toHaveBeenCalledOnce();
    expect(mocks.unlink).not.toHaveBeenCalled();
  });

  it("waits for asynchronous rendering before ending the document", async () => {
    const { doc } = setup();
    let finishRender!: () => void;
    const rendering = new Promise<void>((resolve) => { finishRender = resolve; });
    const conversion = writePdf("output.pdf", {}, () => rendering);
    expect(doc.end).not.toHaveBeenCalled();
    finishRender();
    await conversion;
    expect(doc.end).toHaveBeenCalledOnce();
  });

  it("waits for the output finish event after ending the document", async () => {
    let finishWrite!: () => void;
    let signalFinal!: () => void;
    const reachedFinal = new Promise<void>((resolve) => { signalFinal = resolve; });
    const stream = new Writable({
      write(_chunk, _encoding, done) { done(); },
      final(done) { finishWrite = done; signalFinal(); },
    });
    const { doc } = setup(stream);
    const completed = vi.fn();
    const conversion = writePdf("output.pdf", {}, () => {}).then(completed);
    await reachedFinal;
    expect(doc.end).toHaveBeenCalledOnce();
    expect(completed).not.toHaveBeenCalled();
    finishWrite();
    await conversion;
    expect(completed).toHaveBeenCalledOnce();
  });

  it.each(["sync", "async"])("closes resources and removes partial output after a %s render failure", async (mode) => {
    const { doc, stream, unpipe } = setup();
    const error = new Error("Render failed");
    const render = mode === "sync"
      ? () => { throw error; }
      : async () => { throw error; };
    await expect(writePdf("output.pdf", {}, render)).rejects.toBe(error);
    expect(unpipe).toHaveBeenCalledWith(stream);
    expect(doc.destroyed).toBe(true);
    expect(stream.closed).toBe(true);
    expect(doc.end).not.toHaveBeenCalled();
    expect(mocks.unlink).toHaveBeenCalledExactlyOnceWith("output.pdf");
  });

  it.each(["document", "output"])("handles a %s error while rendering is pending", async (source) => {
    const { doc, stream } = setup();
    const error = new Error("Stream failed");
    let finishRender!: () => void;
    const rendering = new Promise<void>((resolve) => { finishRender = resolve; });
    const conversion = writePdf("output.pdf", {}, () => rendering);
    const assertion = expect(conversion).rejects.toBe(error);
    (source === "document" ? doc : stream).emit("error", error);
    await new Promise<void>((resolve) => setImmediate(resolve));
    finishRender();
    await assertion;
    expect(stream.closed).toBe(true);
    expect(mocks.unlink).toHaveBeenCalledExactlyOnceWith("output.pdf");
  });

  it("waits for close before removing the partial file", async () => {
    let finishClose!: () => void;
    let signalDestroy!: () => void;
    const destroying = new Promise<void>((resolve) => { signalDestroy = resolve; });
    const stream = new Writable({
      write(_chunk, _encoding, done) { done(); },
      destroy(_error, done) { finishClose = () => done(null); signalDestroy(); },
    });
    setup(stream);
    const error = new Error("Render failed");
    const conversion = writePdf("output.pdf", {}, () => { throw error; });
    const assertion = expect(conversion).rejects.toBe(error);
    await destroying;
    expect(mocks.unlink).not.toHaveBeenCalled();
    finishClose();
    await assertion;
    expect(stream.closed).toBe(true);
    expect(mocks.unlink).toHaveBeenCalledExactlyOnceWith("output.pdf");
  });

  it("keeps the original error when the partial file does not exist", async () => {
    setup();
    const error = new Error("Render failed");
    mocks.unlink.mockRejectedValue(Object.assign(new Error("Missing"), { code: "ENOENT" }));
    await expect(writePdf("output.pdf", {}, () => { throw error; })).rejects.toBe(error);
  });

  it("reports a cleanup error other than ENOENT", async () => {
    setup();
    const error = Object.assign(new Error("Permission denied"), { code: "EACCES" });
    mocks.unlink.mockRejectedValue(error);
    await expect(writePdf("output.pdf", {}, () => { throw new Error("Render failed"); })).rejects.toBe(error);
  });
});
