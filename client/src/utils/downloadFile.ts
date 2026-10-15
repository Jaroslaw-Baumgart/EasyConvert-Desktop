export function downloadFile(file: File): void {
  const blobUrl = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  let downloadStarted = false;

  try {
    anchor.href = blobUrl;
    anchor.download = file.name || "converted-file";

    document.body.appendChild(anchor);
    anchor.click();
    downloadStarted = true;
  } finally {
    anchor.remove();

    if (downloadStarted) {
      setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
      }, 0);
    } else {
      URL.revokeObjectURL(blobUrl);
    }
  }
}
