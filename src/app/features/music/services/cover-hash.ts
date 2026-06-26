// why: covers dedup by content hash (sha1 of bytes). Two tracks of the same
//      album share one file in `music/covers/`; the Track only stores the
//      relative `coverPath`. Hash is hex (lowercased) and stable across runs.

export const sha1Hex = async (blob: Blob): Promise<string> => {
  const buf = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-1', buf);
  const bytes = new Uint8Array(digest);
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
};

export const extFromMime = (mime: string): string | null => {
  switch (mime.toLowerCase()) {
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    default:
      return null;
  }
};
