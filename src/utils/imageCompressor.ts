/**
 * Utility to optimize and compress image files / data URLs before storing on canvas nodes.
 * Prevents memory bloat and keeps canvas rendering fluid without quality loss.
 */
export async function optimizeImageForCanvas(
  input: File | string,
  maxDimension = 1920,
  quality = 0.85
): Promise<{
  dataUrl: string;
  width: number;
  height: number;
  aspectRatio: string;
}> {
  return new Promise((resolve) => {
    let sourceUrl = '';
    let isBlobUrl = false;

    if (typeof input === 'string') {
      sourceUrl = input;
    } else {
      sourceUrl = URL.createObjectURL(input);
      isBlobUrl = true;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    const cleanup = () => {
      if (isBlobUrl && sourceUrl) {
        URL.revokeObjectURL(sourceUrl);
      }
    };

    img.onload = () => {
      try {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (!width || !height) {
          cleanup();
          resolve({
            dataUrl: typeof input === 'string' ? input : '',
            width: 1024,
            height: 1024,
            aspectRatio: '1:1',
          });
          return;
        }

        // Calculate aspect ratio label
        const ratio = width / height;
        let detectedRatio = '1:1';
        if (Math.abs(ratio - 16 / 9) < 0.15) detectedRatio = '16:9';
        else if (Math.abs(ratio - 9 / 16) < 0.15) detectedRatio = '9:16';
        else if (Math.abs(ratio - 4 / 3) < 0.15) detectedRatio = '4:3';
        else if (Math.abs(ratio - 3 / 4) < 0.15) detectedRatio = '3:4';
        else if (ratio > 1.2) detectedRatio = '16:9';
        else if (ratio < 0.8) detectedRatio = '9:16';

        // Check if resizing is necessary
        const needsResize = width > maxDimension || height > maxDimension;

        if (needsResize) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          cleanup();
          resolve({
            dataUrl: typeof input === 'string' ? input : '',
            width,
            height,
            aspectRatio: detectedRatio,
          });
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Export as JPEG unless input has transparency
        const isPng = typeof input !== 'string' && input.type === 'image/png';
        const format = isPng ? 'image/png' : 'image/jpeg';
        const optimizedDataUrl = canvas.toDataURL(format, isPng ? undefined : quality);

        cleanup();
        resolve({
          dataUrl: optimizedDataUrl,
          width,
          height,
          aspectRatio: detectedRatio,
        });
      } catch (err) {
        cleanup();
        resolve({
          dataUrl: typeof input === 'string' ? input : '',
          width: img.naturalWidth || 1024,
          height: img.naturalHeight || 1024,
          aspectRatio: '1:1',
        });
      }
    };

    img.onerror = () => {
      cleanup();
      resolve({
        dataUrl: typeof input === 'string' ? input : '',
        width: 1024,
        height: 1024,
        aspectRatio: '1:1',
      });
    };

    img.src = sourceUrl;
  });
}
