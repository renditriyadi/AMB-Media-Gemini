(() => {
  const visible = (element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
  };

  const isMediaLabel = (element) => {
    const text = [...element.childNodes]
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent || '')
      .join(' ')
      .trim()
      .toLowerCase();
    return text === 'media';
  };
  const headingCandidates = [...document.querySelectorAll('body *')]
    .filter((element) => visible(element) && isMediaLabel(element))
    .sort((a, b) => {
      const aArea = a.getBoundingClientRect().width * a.getBoundingClientRect().height;
      const bArea = b.getBoundingClientRect().width * b.getBoundingClientRect().height;
      return aArea - bArea;
    });
  const heading = headingCandidates[0] || null;

  if (!location.hostname.endsWith('google.com') || !location.pathname.includes('/library')) {
    console.warn('Buka https://gemini.google.com/library terlebih dahulu, lalu jalankan ulang script ini.');
    return;
  }
  if (!heading) {
    console.warn('Heading "Media" tidak ditemukan. Pastikan halaman Library sudah selesai dimuat.');
    return;
  }

  let mediaImages = [];
  let scope = heading;
  for (let depth = 0; depth < 6 && scope; depth += 1, scope = scope.parentElement) {
    const images = [...scope.querySelectorAll('img')].filter((image) => {
      const rect = image.getBoundingClientRect();
      return visible(image) && rect.width >= 80 && rect.height >= 80;
    });
    if (images.length > 0) {
      mediaImages = images;
      break;
    }
  }

  const videoPattern = /video|videocam|movie|play_arrow|play_circle|media_type_video/i;
  const videoFilePattern = /\.(?:mp4|webm|mov|m4v|m3u8)(?:$|[?#])/i;
  const videoUrlHintPattern = /(?:^|[/_.?&=#-])(?:video|videos|veo|generated-video|media_type_video)(?:$|[/_.?&=#-])/i;
  const inspectVideoUrl = (value) => {
    try {
      const url = new URL(value, location.href);
      const normalized = decodeURIComponent(`${url.pathname}${url.search}`).toLowerCase();
      if (videoFilePattern.test(normalized)) return 'video URL file type';
      if (videoUrlHintPattern.test(normalized)) return 'video URL path/metadata hint';
    } catch {
      return '';
    }
    return '';
  };
  const candidates = mediaImages.map((image, index) => {
    let card = image;
    for (let depth = 0; depth < 7 && card.parentElement; depth += 1) {
      const rect = card.getBoundingClientRect();
      if (rect.width >= 80 && rect.width <= 500 && rect.height >= 80 && rect.height <= 600) break;
      card = card.parentElement;
    }

    const elements = [card, ...card.querySelectorAll('*')];
    const urlElements = [...new Set([
      ...(card.closest('a') ? [card.closest('a')] : []),
      ...elements,
    ])];
    const labels = elements
      .flatMap((element) => [
        element.getAttribute('aria-label'),
        element.getAttribute('title'),
        element.getAttribute('data-testid'),
        element.getAttribute('data-icon'),
        element.getAttribute('data-mime-type'),
        element.getAttribute('type'),
      ])
      .filter(Boolean);
    const mediaUrls = urlElements.flatMap((element) => {
      const values = [
        element.currentSrc,
        element.getAttribute('src'),
        element.getAttribute('href'),
        element.getAttribute('poster'),
        element.getAttribute('content'),
        element.getAttribute('data-src'),
        element.getAttribute('data-href'),
        element.getAttribute('srcset'),
      ].filter(Boolean);
      return values.flatMap((value) => value.split(/\s*,\s*/).map((part) => part.trim().split(/\s+/)[0]));
    });
    const svgMarkup = [...card.querySelectorAll('svg')]
      .map((svg) => `${svg.getAttribute('aria-label') || ''} ${svg.getAttribute('class') || ''} ${svg.innerHTML}`)
      .join(' ');

    const evidence = [];
    if (card.querySelector('video, video source')) evidence.push('video element');
    if (videoPattern.test(labels.join(' '))) evidence.push('video label/icon metadata');
    const urlEvidence = [...new Set(mediaUrls.map(inspectVideoUrl).filter(Boolean))];
    evidence.push(...urlEvidence);
    if (videoPattern.test(svgMarkup)) evidence.push('video/play SVG metadata');

    return {
      item: index + 1,
      classification: evidence.length ? 'video candidate' : 'uncertain media item',
      evidence: evidence.join(', ') || 'no accessible video marker',
      thumbnailAlt: image.alt || '(no alt text)',
    };
  });

  const confirmed = candidates.filter((candidate) => candidate.classification === 'video candidate').length;
  const uncertain = candidates.length - confirmed;
  console.table(candidates);
  console.info(`Media thumbnails found: ${candidates.length}`);
  console.info(`Video candidates detected from page metadata: ${confirmed}`);
  if (uncertain) {
    console.warn(`${uncertain} item(s) are ambiguous: the page did not expose a readable video marker for them.`);
  }
  console.info('This is a DOM-based estimate of visible Library items, not an official Gemini quota reading.');
})();
