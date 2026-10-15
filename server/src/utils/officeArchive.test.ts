import { describe, expect, it } from "vitest";
import { zipSync } from "fflate";
import { unzipOfficeArchive } from "./officeArchive";
import { MAX_OFFICE_UNCOMPRESSED_BYTES, MAX_OFFICE_ENTRIES } from "./constants";

describe("Office archive budget", () => {
  it("rejects declared uncompressed sizes before decompressing", async () => {
    const archive = zipSync({ "file.xml": new Uint8Array([1]) });
    const data = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
    for (let offset = 0; offset < archive.length - 46; offset++) {
      if (data.getUint32(offset, true) === 0x02014b50) {
        data.setUint32(offset + 24, MAX_OFFICE_UNCOMPRESSED_BYTES + 1, true);
        break;
      }
    }
    await expect(async () => unzipOfficeArchive(archive)).rejects.toThrow("processing limits");
  });
  it("rejects excessive archive entry counts", async () => {
    const entries = Object.fromEntries(Array.from({ length: MAX_OFFICE_ENTRIES + 1 }, (_, index) => [`${index}.xml`, new Uint8Array()]));
    await expect(async () => unzipOfficeArchive(zipSync(entries))).rejects.toThrow("processing limits");
  });
});
