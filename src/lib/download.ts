export function downloadJson(data: unknown, filename: string): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
  } finally {
    // Let the browser consume the download URL before releasing the Blob.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
