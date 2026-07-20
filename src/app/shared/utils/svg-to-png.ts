// why: rasterizes a standalone SVG string to a PNG blob via an offscreen
//      <canvas> — the only DOM-based path available without a server or a
//      heavy rasterization dependency. `scale` renders at higher pixel
//      density than the SVG's own width/height so exports stay crisp.
export const svgToPngBlob = (
  svg: string,
  width: number,
  height: number,
  scale = 2,
): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      const ctx = canvas.getContext('2d');
      URL.revokeObjectURL(url);
      if (!ctx) {
        reject(new Error('canvas 2d context unavailable'));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('canvas toBlob failed'));
      }, 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('failed to rasterize svg'));
    };
    img.src = url;
  });
