import { createReadStream } from "node:fs";
import { Zip, ZipPassThrough } from "fflate";

export type ArchiveEntry = {
  resultPath: string;
  fileName: string;
};

export async function* createZipChunks(
  entries: readonly ArchiveEntry[],
): AsyncGenerator<Uint8Array> {
  const pendingChunks: Uint8Array[] = [];

  const archive = new Zip((error, data) => {
    if (error) throw error;
    pendingChunks.push(data);
  });

  try {
    for (const entry of entries) {
      const file = new ZipPassThrough(entry.fileName);
      archive.add(file);
      yield* pendingChunks.splice(0);

      for await (const chunk of createReadStream(entry.resultPath)) {
        file.push(chunk);
        yield* pendingChunks.splice(0);
      }

      file.push(new Uint8Array(), true);
      yield* pendingChunks.splice(0);
    }

    archive.end();
    yield* pendingChunks.splice(0);
  } finally {
    archive.terminate();
  }
}
