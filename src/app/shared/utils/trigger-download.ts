// why: same client-side download dance used by ExportZipService and the
//      files feature (createObjectURL + throwaway anchor) — kept here as the
//      shared version now that a third feature (books markdown export) needs it.
export const triggerDownload = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
