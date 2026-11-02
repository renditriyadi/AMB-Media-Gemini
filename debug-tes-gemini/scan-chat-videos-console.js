(() => {
  const stateKey = '__ambGeminiChatVideoScan';
  if (window[stateKey]?.running) {
    console.warn('Pemindaian Gemini masih berjalan.');
    return;
  }
  if (location.hostname !== 'gemini.google.com') {
    console.error('Buka gemini.google.com dengan akun yang ingin diperiksa, lalu jalankan ulang script ini.');
    return;
  }

  const state = { running: true, results: [], totalUniqueVideos: 0, complete: false };
  window[stateKey] = state;
  const endpoint = '/_/BardChatUi/data/batchexecute';
  const MAX_CHATS = 100;
  const CONCURRENCY = 3;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const extractSessionConfig = (html) => {
    const wizMatch = html.match(/window\.WIZ_global_data\s*=\s*(\{[\s\S]*?\});/);
    let wiz = {};
    if (wizMatch) {
      try {
        wiz = JSON.parse(wizMatch[1]);
      } catch {
        wiz = {};
      }
    }
    const matchValue = (key) => {
      const match = html.match(new RegExp(`"${key}":"([^"]+)"`));
      return match?.[1] || '';
    };
    return {
      token: wiz.SNlM0e || wiz.uS02ke || matchValue('SNlM0e') || matchValue('uS02ke'),
      buildId: wiz.cfb2h || matchValue('cfb2h'),
    };
  };

  const rpc = async (rpcId, rpcArgs, buildId, token) => {
    const envelope = [[[
      rpcId,
      JSON.stringify(rpcArgs),
      null,
      'generic',
    ]]];
    const body = new URLSearchParams({
      'f.req': JSON.stringify(envelope),
      at: token,
    });
    const url = `${endpoint}?rpcids=${encodeURIComponent(rpcId)}&bl=${encodeURIComponent(buildId)}&rt=c`;
    const response = await fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'X-Same-Domain': '1',
      },
      body,
    });
    if (!response.ok) throw new Error(`RPC ${rpcId} gagal (HTTP ${response.status}).`);

    const text = await response.text();
    for (const line of text.split('\n')) {
      if (!line.startsWith('[[')) continue;
      try {
        for (const item of JSON.parse(line)) {
          if (item?.[0] === 'er') {
            throw new Error(`Gemini menolak RPC ${rpcId}. Sesi mungkin kedaluwarsa.`);
          }
          if (item?.[0] === 'wrb.fr' && item[1] === rpcId && typeof item[2] === 'string') {
            return JSON.parse(item[2]);
          }
        }
      } catch (error) {
        if (error instanceof SyntaxError) continue;
        throw error;
      }
    }
    throw new Error(`Respons RPC ${rpcId} tidak berisi data yang dikenali.`);
  };

  const listChats = async (buildId, token) => {
    const data = await rpc('MaZiqc', [MAX_CHATS, null, []], buildId, token);
    if (!Array.isArray(data) || !Array.isArray(data[2])) {
      throw new Error('Format daftar percakapan Gemini tidak dikenali.');
    }
    const seen = new Set();
    return data[2]
      .filter((chat) => Array.isArray(chat) && typeof chat[0] === 'string' && chat[0].trim())
      .filter((chat) => {
        const id = chat[0].trim();
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      })
      .slice(0, MAX_CHATS)
      .map((chat) => ({ id: chat[0].trim() }));
  };

  const getHistory = async (chatId, buildId, token) => {
    const normalizedId = chatId.startsWith('c_') ? chatId : `c_${chatId}`;
    return rpc('hNvQHb', [normalizedId, 50, null, 1], buildId, token);
  };

  const getAssistantPayloads = (history) => {
    if (!Array.isArray(history) || !Array.isArray(history[0])) return [];
    const payloads = [];
    for (let index = history[0].length - 1; index >= 0; index -= 1) {
      const turn = history[0][index];
      if (Array.isArray(turn?.[3]) && Array.isArray(turn[3][0])) payloads.push(turn[3]);
    }
    return payloads;
  };

  const getUrlIdentities = (urls) => {
    const volatileParams = new Set([
      'authuser', 'expire', 'keepalive', 'range', 'rn', 'rbuf',
      'signature', 'sig', 'source', 'token', 'itag',
    ]);
    const identities = new Set();
    for (const rawUrl of urls) {
      if (typeof rawUrl !== 'string' || !rawUrl) continue;
      try {
        const url = new URL(rawUrl);
        const params = [...url.searchParams.entries()]
          .filter(([key]) => !volatileParams.has(key.toLowerCase()))
          .sort(([keyA, valueA], [keyB, valueB]) => keyA.localeCompare(keyB) || valueA.localeCompare(valueB));
        const base = `${url.origin}${url.pathname.replace(/=(?:m\d+|s\d+)$/i, '')}`;
        if (params.length) identities.add(`${base}?${new URLSearchParams(params)}`);
        else if (!/\/videoplayback\/?$/i.test(url.pathname)) identities.add(base);
        else identities.add(`${url.origin}${url.pathname}`);
      } catch {
        identities.add(rawUrl.replace(/=(?:m\d+|s\d+)$/i, ''));
      }
    }
    return identities;
  };

  const extractVideoAssets = (history) => {
    const assets = [];
    const seenIdentities = new Set();
    const scan = (value) => {
      if (!value) return;
      if (Array.isArray(value)) {
        const filenameLooksVideo = typeof value[2] === 'string' &&
          (value[2] === 'video.mp4' || /\.(?:mp4|mov|webm)$/i.test(value[2]));
        const urls = Array.isArray(value[7]) ? value[7] : [];
        const urlsLookVideo = urls.some((url) =>
          typeof url === 'string' &&
          (url.includes('contribution.usercontent.google.com') ||
            url.includes('=m22') ||
            url.includes('googlevideo.com') ||
            /\.(?:mp4|mov|webm)(?:[?#]|$)/i.test(url))
        );
        if (value.length >= 8 && urls.length && (filenameLooksVideo || urlsLookVideo)) {
          const identities = getUrlIdentities(urls);
          if (identities.size && ![...identities].some((identity) => seenIdentities.has(identity))) {
            for (const identity of identities) seenIdentities.add(identity);
            assets.push(identities);
          }
        }
        for (const item of value) scan(item);
      } else if (typeof value === 'object') {
        for (const item of Object.values(value)) scan(item);
      }
    };
    for (const payload of getAssistantPayloads(history)) scan(payload);
    return assets;
  };

  const run = async () => {
    const appResponse = await fetch('/app', { credentials: 'same-origin' });
    if (!appResponse.ok) throw new Error(`Gemini /app tidak dapat dibaca (HTTP ${appResponse.status}).`);
    const { token, buildId } = extractSessionConfig(await appResponse.text());
    if (!token || !buildId) {
      throw new Error('Token sesi/build Gemini tidak ditemukan. Muat ulang halaman Gemini dan coba lagi.');
    }

    const chats = await listChats(buildId, token);
    if (!chats.length) throw new Error('Gemini tidak mengembalikan daftar percakapan.');
    console.info(`Daftar percakapan diterima: ${chats.length}. Memindai riwayat dengan batas ${MAX_CHATS} chat...`);

    const allVideoIdentities = new Set();
    let totalUniqueVideos = 0;
    let failures = 0;
    for (let start = 0; start < chats.length; start += CONCURRENCY) {
      const batch = chats.slice(start, start + CONCURRENCY);
      const scanned = await Promise.all(batch.map(async (chat) => {
        try {
          const history = await getHistory(chat.id, buildId, token);
          return { chatId: chat.id, videos: extractVideoAssets(history), error: false };
        } catch {
          return { chatId: chat.id, videos: [], error: true };
        }
      }));
      for (const chat of scanned) {
        let videoCount = 0;
        if (chat.error) failures += 1;
        for (const identities of chat.videos) {
          if ([...identities].some((identity) => allVideoIdentities.has(identity))) continue;
          for (const identity of identities) allVideoIdentities.add(identity);
          videoCount += 1;
          totalUniqueVideos += 1;
        }
        state.results.push({ chatId: chat.chatId, videoCount, error: chat.error });
      }
      console.info(`Progres: ${state.results.length}/${chats.length} percakapan`);
      if (start + CONCURRENCY < chats.length) await sleep(250);
    }

    state.totalUniqueVideos = totalUniqueVideos;
    state.complete = chats.length < MAX_CHATS && failures === 0;
    state.failures = failures;
    console.table(state.results);
    console.info(`Total video unik terdeteksi: ${state.totalUniqueVideos}`);
    console.info(`Percakapan dipindai: ${chats.length} | Gagal dibaca: ${failures}`);
    if (chats.length >= MAX_CHATS) {
      console.warn(`Daftar mencapai batas ${MAX_CHATS} chat; hasil mungkin belum mencakup semua percakapan.`);
    }
    if (failures) {
      console.warn('Hasil belum lengkap karena ada riwayat chat yang gagal dibaca; cek kolom error.');
    }
    console.info('Jumlah ini perkiraan dari aset video yang terbaca pada riwayat chat, bukan saldo/kuota resmi Gemini.');
    console.info('Hasil tersedia di window.__ambGeminiChatVideoScan');
  };

  run()
    .catch((error) => {
      state.error = error.message || String(error);
      console.error(`Pemindaian gagal: ${state.error}`);
    })
    .finally(() => {
      state.running = false;
    });
})();
