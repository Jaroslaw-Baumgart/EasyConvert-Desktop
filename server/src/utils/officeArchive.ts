import { Unzip, UnzipInflate, unzipSync, type Unzipped } from "fflate";
import { MAX_OFFICE_ENTRIES, MAX_OFFICE_UNCOMPRESSED_BYTES } from "./constants";

export async function unzipOfficeArchive(archive: Uint8Array): Promise<Unzipped> {
  let size = 0;
  let count = 0;
  // Inspect sizes before allocating decompression buffers.
  unzipSync(archive, { filter: (entry) => {
    size += entry.originalSize;
    count += 1;
    if (size > MAX_OFFICE_UNCOMPRESSED_BYTES || count > MAX_OFFICE_ENTRIES) {
      throw new Error("Office archive exceeds processing limits.");
    }
    return false;
  } });
  const files: Unzipped = {};
  let actualSize = 0;
  let actualCount = 0;
  const unzip = new Unzip((file) => {
    if (++actualCount > MAX_OFFICE_ENTRIES) throw new Error("Office archive exceeds processing limits.");
    const chunks: Uint8Array[] = [];
    let fileSize = 0;
    file.ondata = (error, data, final) => {
      if (error) throw error;
      actualSize += data.byteLength;
      fileSize += data.byteLength;
      if (actualSize > MAX_OFFICE_UNCOMPRESSED_BYTES) {
        throw new Error("Office archive exceeds processing limits.");
      }
      chunks.push(data);
      if (final) {
        const bytes = new Uint8Array(fileSize);
        let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
        files[file.name] = bytes;
        chunks.length = 0;
      }
    };
    file.start();
  });
  unzip.register(UnzipInflate);
  // Small input chunks bound each inflation step, even with forged ZIP sizes.
  for (let offset = 0; offset < archive.length; offset += 2048) {
    unzip.push(archive.subarray(offset, offset + 2048), offset + 2048 >= archive.length);
    if (offset % (2048 * 32) === 0) await new Promise<void>((resolve) => setImmediate(resolve));
  }
  return files;
}
