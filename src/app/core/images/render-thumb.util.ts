// why: canvas-based thumbnail rendering, shared by every feature that stores
//      user-uploaded images on disk (galleries, and book cover/back/chapter
//      overrides) so the resize/encode logic exists exactly once (§4.11.25b —
//      this was the shared helper docs/deferred/trash-books.md asked for).
export const THUMB_MIME = 'image/webp';
export const THUMB_MAX_DIM = 320;
export const THUMB_QUALITY = 0.8;

export interface RenderedThumb {
  readonly width: number;
  readonly height: number;
  readonly thumbBlob: Blob | null;
}

// why: SVG and exotic codecs may fail in createImageBitmap; callers still want
//      to record the image (without a thumb) and let the UI fall back to the
//      original.
export const renderThumb = async (blob: Blob): Promise<RenderedThumb> => {
  try {
    const bitmap = await createImageBitmap(blob);
    const width = bitmap.width;
    const height = bitmap.height;
    const longest = Math.max(width, height);
    const scale = longest > THUMB_MAX_DIM ? THUMB_MAX_DIM / longest : 1;
    const tw = Math.max(1, Math.round(width * scale));
    const th = Math.max(1, Math.round(height * scale));
    if (typeof OffscreenCanvas !== 'undefined') {
      const canvas = new OffscreenCanvas(tw, th);
      const ctx = canvas.getContext('2d');
      if (!ctx) return { width, height, thumbBlob: null };
      ctx.drawImage(bitmap, 0, 0, tw, th);
      bitmap.close();
      const thumbBlob = await canvas.convertToBlob({ type: THUMB_MIME, quality: THUMB_QUALITY });
      return { width, height, thumbBlob };
    }
    bitmap.close();
    return { width, height, thumbBlob: null };
  } catch (cause) {
    console.warn('[images] thumb render failed', cause);
    return { width: 0, height: 0, thumbBlob: null };
  }
};

export const guessMimeFromName = (name: string): string => {
  const dot = name.lastIndexOf('.');
  if (dot < 0) return '';
  const ext = name.slice(dot + 1).toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'avif') return 'image/avif';
  if (ext === 'svg') return 'image/svg+xml';
  if (ext === 'bmp') return 'image/bmp';
  return '';
};
