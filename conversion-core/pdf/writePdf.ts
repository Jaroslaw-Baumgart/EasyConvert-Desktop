import PDFDocument from "pdfkit";
import { createWriteStream } from "node:fs";
import { unlink } from "node:fs/promises";
import { Readable } from "node:stream";

export async function writePdf(
  outputPath: string,
  documentOptions: PDFKit.PDFDocumentOptions,
  render: (doc: PDFKit.PDFDocument) => void | Promise<void>,
): Promise<void> {
  const doc = new PDFDocument(documentOptions);
  const stream = createWriteStream(outputPath);
  const completed = new Promise<void>((resolve, reject) => {
    stream.once("finish", resolve);
    stream.once("error", reject);
    doc.once("error", reject);
  });
  void completed.catch(() => {});

  try {
    doc.pipe(stream);
    await render(doc);
    doc.end();
    await completed;
  } catch (error) {
    doc.unpipe(stream);
    if (doc instanceof Readable) {
      doc.destroy();
    }
    if (!stream.closed) {
      const closed = new Promise<void>((resolve) => {
        stream.once("close", resolve);
      });

      stream.destroy();
      await closed;
    }

    try {
      await unlink(outputPath);
    } catch (cleanupError: unknown) {
      if (
        typeof cleanupError !== "object" ||
        cleanupError === null ||
        !("code" in cleanupError) ||
        cleanupError.code !== "ENOENT"
      ) {
        throw cleanupError;
      }
    }
    throw error;
  }
}
