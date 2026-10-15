import { downloadZip } from "client-zip";

export async function createZipFile(files: readonly File[]): Promise<File> {
  const zipResponse = downloadZip(files);
  const archiveBlob = await zipResponse.blob();
  return new File([archiveBlob], "conversion-results.zip", {
    type: "application/zip",
  });
}
