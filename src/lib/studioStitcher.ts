import { StudioScene, StudioCompositeConfig } from '../types/studio';

/**
 * Loads an image from a URL or Base64 into an HTMLImageElement safely with CORS support
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => {
      // If CORS failed and it's a proxyable HTTP URL, try with proxy-image
      if (src.startsWith('http') && !src.includes('/api/proxy-image')) {
        const proxyImg = new Image();
        proxyImg.crossOrigin = 'anonymous';
        proxyImg.onload = () => resolve(proxyImg);
        proxyImg.onerror = (e) => reject(new Error(`Gagal memuat gambar: ${src}`));
        proxyImg.src = `/api/proxy-image?url=${encodeURIComponent(src)}`;
      } else {
        reject(new Error(`Gagal memuat gambar: ${src}`));
      }
    };
    img.src = src;
  });
}

/**
 * Stitches multiple scenes into a unified 1-sheet composite storyboard canvas
 */
export async function generateCompositeStoryboardCanvas(
  scenes: StudioScene[],
  config: StudioCompositeConfig,
  projectTitle?: string
): Promise<{ dataUrl: string; width: number; height: number; blob: Blob }> {
  const validScenes = scenes.filter((s) => s.imageUrl && s.status === 'completed');
  if (validScenes.length === 0) {
    throw new Error('Belum ada scene yang berhasil digenerate untuk digabungkan.');
  }

  const columns = config.gridColumns || 3;
  const rows = Math.ceil(validScenes.length / columns) || 2;
  const isVertical = config.aspectRatio === '9:16';

  // High-Resolution 4K Canvas Target
  const targetWidth = isVertical ? 2160 : 3840;
  const targetHeight = isVertical ? 3840 : 2160;

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context tidak tersedia.');

  // Background Fill
  ctx.fillStyle = config.borderColor || '#0A0A0E';
  ctx.fillRect(0, 0, targetWidth, targetHeight);

  // Layout Spacing Math
  const padding = config.padding || 24;
  const gap = config.borderWidth || 16;
  const bannerHeight = config.showTitleBanner ? (isVertical ? 180 : 140) : 0;

  const availableWidth = targetWidth - padding * 2 - gap * (columns - 1);
  const availableHeight = targetHeight - padding * 2 - bannerHeight - gap * (rows - 1);

  const cellWidth = availableWidth / columns;
  const cellHeight = availableHeight / rows;

  // 1. Draw Title Banner if enabled
  if (config.showTitleBanner) {
    ctx.save();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${isVertical ? 64 : 52}px "Plus Jakarta Sans", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const displayTitle = config.titleText || projectTitle || 'STORYBOARD VISUAL CAMPAIGN';
    ctx.fillText(displayTitle.toUpperCase(), targetWidth / 2, padding + bannerHeight / 2);
    ctx.restore();
  }

  // 2. Load and draw all scene images
  for (let i = 0; i < validScenes.length; i++) {
    const scene = validScenes[i];
    if (!scene.imageUrl) continue;

    const col = i % columns;
    const row = Math.floor(i / columns);

    const cellX = padding + col * (cellWidth + gap);
    const cellY = padding + bannerHeight + row * (cellHeight + gap);

    try {
      const img = await loadImage(scene.imageUrl);

      // Calculate object-fit: cover for the cell
      const imgAspect = img.naturalWidth / img.naturalHeight;
      const cellAspect = cellWidth / cellHeight;

      let sx = 0, sy = 0, sWidth = img.naturalWidth, sHeight = img.naturalHeight;

      if (imgAspect > cellAspect) {
        // Image is wider than cell -> crop sides
        sWidth = img.naturalHeight * cellAspect;
        sx = (img.naturalWidth - sWidth) / 2;
      } else {
        // Image is taller than cell -> crop top/bottom
        sHeight = img.naturalWidth / cellAspect;
        sy = (img.naturalHeight - sHeight) / 2;
      }

      // Draw rounded corner image clip
      const cornerRadius = 16;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(cellX, cellY, cellWidth, cellHeight, cornerRadius);
      ctx.clip();
      ctx.drawImage(img, sx, sy, sWidth, sHeight, cellX, cellY, cellWidth, cellHeight);
      ctx.restore();

      // 3. Draw Scene Badge Overlay if enabled
      if (config.showBadges) {
        ctx.save();
        const badgeText = `Scene ${scene.sceneNumber}: ${scene.title.replace(/^Scene\s*\d+:\s*/i, '')}`;
        ctx.font = `bold ${isVertical ? 36 : 30}px "Plus Jakarta Sans", sans-serif`;
        const textMetrics = ctx.measureText(badgeText);
        const badgePaddingX = 24;
        const badgePaddingY = 14;
        const badgeWidth = textMetrics.width + badgePaddingX * 2;
        const badgeHeight = (isVertical ? 36 : 30) + badgePaddingY * 2;

        const badgeX = cellX + 24;
        const badgeY = cellY + 24;

        // Badge pill background (Dark glassmorphism)
        ctx.fillStyle = 'rgba(10, 10, 14, 0.85)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 14);
        ctx.fill();
        ctx.stroke();

        // Badge text
        ctx.fillStyle = '#F59E0B'; // Amber / gold accent
        ctx.textBaseline = 'top';
        ctx.fillText(badgeText, badgeX + badgePaddingX, badgeY + badgePaddingY);
        ctx.restore();
      }
    } catch (drawErr) {
      console.warn(`[StudioStitcher] Error drawing scene ${scene.sceneNumber}:`, drawErr);
      // Fallback gray cell
      ctx.fillStyle = '#1E1E26';
      ctx.fillRect(cellX, cellY, cellWidth, cellHeight);
      ctx.fillStyle = '#888899';
      ctx.font = '24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`Scene ${scene.sceneNumber}`, cellX + cellWidth / 2, cellY + cellHeight / 2);
    }
  }

  // 4. Export to Blob and DataURL
  const dataUrl = canvas.toDataURL('image/png', 0.95);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Gagal mengekspor canvas ke blob'))), 'image/png', 0.95);
  });

  return {
    dataUrl,
    width: targetWidth,
    height: targetHeight,
    blob,
  };
}
