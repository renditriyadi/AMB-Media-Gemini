(() => {
  if (location.hostname !== 'google.com' && !location.hostname.endsWith('.google.com')) {
    console.warn('Jalankan script ini di tab Gemini yang sudah login.');
    return;
  }

  const stateKey = '__ambGeminiLibraryEndpointCapture';
  if (window[stateKey]?.active) {
    console.info('Capture endpoint sudah aktif. Buka atau refresh halaman Library untuk menangkap request.');
    return;
  }

  const state = { active: true, rows: [], seen: new Set() };
  window[stateKey] = state;
  const isRelevant = (url) => /gemini\.google\.com|clients\d*\.google\.com/i.test(url);

  const safeEndpoint = (value) => {
    try {
      const url = new URL(value, location.href);
      const rpcids = (url.searchParams.get('rpcids') || '')
        .split(',')
        .map((id) => id.trim())
        .filter((id) => /^[A-Za-z0-9_-]{1,40}$/.test(id))
        .slice(0, 10);
      return {
        url: `${url.origin}${url.pathname}`,
        rpcids: rpcids.length ? rpcids.join(',') : '(tidak ada)',
      };
    } catch {
      return { url: '(URL tidak terbaca)', rpcids: '(tidak tersedia)' };
    }
  };

  const record = (method, value, status = 'pending', contentType = '') => {
    const rawUrl = String(value || '');
    if (!isRelevant(rawUrl)) return;
    const endpoint = safeEndpoint(rawUrl);
    const key = `${method} ${endpoint.url} ${endpoint.rpcids} ${status}`;
    if (state.seen.has(key)) return;
    state.seen.add(key);
    const row = {
      method,
      url: endpoint.url,
      rpcids: endpoint.rpcids,
      status,
      contentType: contentType || '(tidak tersedia)',
    };
    state.rows.push(row);
    console.info('[Gemini Library endpoint]', row);
  };

  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const input = args[0];
    const request = input instanceof Request ? input : null;
    const url = request?.url || String(input || '');
    const method = String(args[1]?.method || request?.method || 'GET').toUpperCase();
    try {
      const response = await originalFetch.apply(this, args);
      record(method, url, response.status, response.headers.get('content-type') || '');
      return response;
    } catch (error) {
      record(method, url, 'network error');
      throw error;
    }
  };

  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__ambGeminiCapture = { method: String(method || 'GET').toUpperCase(), url: String(url || '') };
    return originalOpen.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener('loadend', () => {
      const request = this.__ambGeminiCapture;
      if (!request) return;
      let contentType = '';
      try {
        contentType = this.getResponseHeader('content-type') || '';
      } catch {
        contentType = '';
      }
      record(request.method, request.url, this.status || 'network error', contentType);
    }, { once: true });
    return originalSend.apply(this, args);
  };

  const existingResources = performance.getEntriesByType('resource')
    .map((entry) => entry.name)
    .filter(isRelevant);
  for (const url of existingResources) record('RESOURCE', url, 'already loaded');

  console.info(
    'Capture aktif. Sekarang buka atau refresh Gemini Library. ' +
    'Hasil ringkas: window.__ambGeminiLibraryEndpointCapture.rows'
  );
  console.info('Untuk berhenti dan mengembalikan fetch/XHR, jalankan: window.location.reload()');
})();
