// AMB Media - Extension Bridge Client
// Menghubungkan Web App (run.app / localhost) dengan Ekstensi Chrome (ektension-weavy)
// Fitur Lengkap:
// 1. Deteksi koneksi ekstensi otomatis via postMessage handshake
// 2. Auto-Import akun aktif dari tab browser (app.weavy.ai)
// 3. Login / Sync sesi akun individu langsung ke tab browser Weavy yang terbuka
// 4. Eksekusi request API Weavy (Chat, Image Generation, Video Generation, Polling) via ekstensi untuk bypass 403 Forbidden & Cloudflare WAF

import {
  WEAVY_MASTER_DIRECTOR_PROMPT,
  WEAVY_STORYBOARD_CONTRACT_BLOCK,
  WEAVY_QUICK_PRESET_BLOCK,
  buildWeavyReferenceCatalog,
  buildWeavyProductCardSection,
} from './weavyPrompts';

export interface ExtensionBridgeStatus {
  isConnected: boolean;
  version?: string;
  lastSeen?: number;
}

export interface ImportedWeavyAccount {
  id: string;
  userId?: string;
  email: string;
  name: string;
  displayName?: string;
  refreshToken: string;
  idToken?: string;
  credits: number;
  totalCredits?: number;
  provider: 'weavy';
  cookie?: string;
  lastVerified: string;
  isActive?: boolean;
}

export interface WeavyGenerateOptions {
  prompt: string;
  model?: string;
  aspect_ratio?: string;
  resolution?: string;
  duration?: string | number;
  image_url?: string;
  images?: string[];
  video_url?: string;
  attached_media?: any[];
  generate_audio?: boolean;
  refreshToken?: string;
  idToken?: string;
}

export interface WeavyPollOptions {
  recipeId: string;
  taskId?: string;
  batchId?: string;
  nodeId?: string;
  idToken?: string;
  refreshToken?: string;
  bridgeOnly?: boolean;
  maxAttempts?: number;
  pollInterval?: number;
  onProgress?: (progress: number) => void;
  onCreditUpdate?: (credits: number) => void;
}

export interface WeavyOptimizedContext {
  /** System prompt final (Master Director + kontrak storyboard + memory + katalog media). */
  systemPrompt: string;
  /** Instruksi current turn (preset sudah diexpand). */
  currentPrompt: string;
  /** Riwayat yang sudah di-prune. */
  historyMessages: Array<{ role: string; content: string; attachments?: any[] }>;
  /** Asset multimodal yang wajib dikirim (gambar referensi). */
  referenceAssets?: any[];
  /** Katalog media sesi (@imgX / @vidX). */
  mediaCatalog?: { mediaList: Array<{ key: string; type: string; name: string; url?: string; duration?: number | null }> } | null;
}

export interface WeavyChatOptions {
  messages: Array<{
    role: string;
    content: string;
    attachments?: any[];
    weavyAction?: any;
    generatedImage?: any;
  }>;
  model?: string;
  mode?: string;
  thinking?: boolean;
  temperature?: number;
  refreshToken?: string;
  idToken?: string;
  systemPrompt?: string;
  /** Aktifkan kontrak output storyboard_project (JSON) untuk Weavy. */
  storyboardMode?: boolean;
  /** Konteks tambahan (JSON storyboard aktif, ringkasan hasil riset, dll). */
  extraContext?: string;
  /** Hasil riset AI Worker (scrape link e-commerce/video) -> blok product_card. */
  scrapingContext?: string;
  /** Context teroptimasi Agent V1 (history pruning, project memory, media catalog). */
  optimizedContext?: WeavyOptimizedContext;
  /** Quick Preset AI Enhancement ( Director Quick Enhancement ). */
  quickPresetEnabled?: boolean;
  onStatusUpdate?: (statusText: string) => void;
}

export interface ExtensionOwnedChatOptions {
  session: {
    id: string;
    title?: string;
    messages: any[];
    metadata?: Record<string, any>;
    createdAt?: string;
  };
  userMsg: {
    id: string;
    content: string;
    attachments?: any[];
    extractedProducts?: any[];
    videoPreviews?: any[];
  };
  model: string;
  idToken: string;
  refreshToken?: string;
  isStoryboardCopilotActive?: boolean;
  quickPresetEnabled?: boolean;
  scrapingContext?: string;
}

type BridgeStatusListener = (status: ExtensionBridgeStatus) => void;

class ExtensionBridgeManager {
  private isConnected = false;
  private version = '';
  private lastSeen = 0;
  private listeners: Set<BridgeStatusListener> = new Set();
  private pendingRequests: Map<string, { resolve: (val: any) => void; reject: (err: any) => void; timeout: NodeJS.Timeout }> = new Map();
  private tokenRefreshListeners: Set<(account: ImportedWeavyAccount) => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('message', this.handleWindowMessage);
      // Kirim ping awal
      this.ping();
      // Periodik cek koneksi ekstensi
      setInterval(() => {
        if (Date.now() - this.lastSeen > 8000) {
          if (this.isConnected) {
            this.isConnected = false;
            this.notifyListeners();
          }
        }
        this.ping();
      }, 4000);
    }
  }

  private handleWindowMessage = (event: MessageEvent) => {
    if (event.source !== window || !event.data || typeof event.data !== 'object') {
      return;
    }

    const { type, taskId, version, ...rest } = event.data;

    // 1. Handshake siap / pong dari content-bridge.js
    if (type === 'AMB_EXTENSION_BRIDGE_READY' || type === 'AMB_PONG_EXTENSION') {
      const wasConnected = this.isConnected;
      this.isConnected = true;
      this.version = version || '3.0.0';
      this.lastSeen = Date.now();
      if (!wasConnected) {
        console.log('[ExtensionBridge] Ekstensi Weavy AI terhubung siap mengirim signal/task!');
      }
      this.notifyListeners();
      return;
    }

    // 2. Respon hasil task eksekusi
    if (type === 'AMB_TASK_RESULT' && taskId) {
      const pending = this.pendingRequests.get(taskId);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(taskId);
        pending.resolve(rest);
      }
      return;
    }

    // 3. Respon hasil auto-import akun aktif
    if (type === 'AMB_AUTO_IMPORT_RESULT' && taskId) {
      const pending = this.pendingRequests.get(taskId);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(taskId);
        pending.resolve(rest);
      }
      return;
    }

    // 4. Respon hasil sinkronisasi login akun ke tab browser
    if (type === 'AMB_SYNC_ACCOUNT_RESULT' && taskId) {
      const pending = this.pendingRequests.get(taskId);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(taskId);
        pending.resolve(rest);
      }
      return;
    }

    // 5. Respon hasil refresh token Weavy (reload tab + baca ulang session Firebase)
    if (type === 'AMB_TOKEN_REFRESHED' && taskId) {
      const pending = this.pendingRequests.get(taskId);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(taskId);
        pending.resolve(rest);
      }
      return;
    }

    // 6. Respon upload asset Weavy (gambar) dari dalam tab app.weavy.ai
    if (type === 'AMB_ASSET_UPLOADED' && taskId) {
      const pending = this.pendingRequests.get(taskId);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(taskId);
        pending.resolve(rest);
      }
      return;
    }
  };

  private notifyListeners() {
    const status: ExtensionBridgeStatus = {
      isConnected: this.isConnected,
      version: this.version,
      lastSeen: this.lastSeen,
    };
    this.listeners.forEach((fn) => {
      try {
        fn(status);
      } catch (_) {}
    });
  }

  public subscribe(listener: BridgeStatusListener): () => void {
    this.listeners.add(listener);
    listener({
      isConnected: this.isConnected,
      version: this.version,
      lastSeen: this.lastSeen,
    });
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getStatus(): ExtensionBridgeStatus {
    return {
      isConnected: this.isConnected,
      version: this.version,
      lastSeen: this.lastSeen,
    };
  }

  public ping(): void {
    if (typeof window === 'undefined') return;
    window.postMessage({ type: 'AMB_PING_EXTENSION' }, '*');
  }

  /**
   * Tunggu sampai ekstensi terhubung (ping berulang). Dipakai sebelum refresh akun
   * agar tidak salah mengira ekstensi mati hanya karena handshake belum sempat selesai.
   */
  public async waitForConnection(timeoutMs: number = 4000): Promise<boolean> {
    if (this.isConnected) return true;
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      this.ping();
      await new Promise((r) => setTimeout(r, 250));
      if (this.isConnected) return true;
    }
    return this.isConnected;
  }

  /** Bandingkan versi ekstensi (mis. '3.1.0') dengan versi minimum. */
  public isVersionAtLeast(min: string): boolean {
    const a = (this.version || '0').split('.').map((n) => parseInt(n, 10) || 0);
    const b = min.split('.').map((n) => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const x = a[i] || 0;
      const y = b[i] || 0;
      if (x !== y) return x > y;
    }
    return true;
  }

  /**
   * Mengambil sesi login dan token akun aktif dari tab browser (app.weavy.ai)
   */
  public async autoImportActiveAccount(provider: string = 'weavy'): Promise<{
    success: boolean;
    account?: ImportedWeavyAccount;
    error?: string;
  }> {
    if (typeof window === 'undefined') {
      return { success: false, error: 'Window tidak tersedia.' };
    }

    const taskId = `import_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(taskId);
        resolve({
          success: false,
          error: 'Waktu habis (timeout). Pastikan Ekstensi Weavy sudah terpasang dan tab https://app.weavy.ai terbuka dan sudah Login.',
        });
      }, provider === 'weavy' ? 60000 : 10000);

      this.pendingRequests.set(taskId, {
        resolve,
        reject: (err) => resolve({ success: false, error: err?.message || 'Gagal mengimpor akun.' }),
        timeout,
      });

      window.postMessage(
        {
          type: 'AMB_AUTO_IMPORT_REQUEST',
          taskId,
          payload: { provider },
        },
        '*'
      );
    });
  }

  /**
   * Mengirim task ke Ekstensi lewat content-bridge & menunggu jawabannya.
   */
  private postBridgeTask(type: string, payload: any, timeoutMs: number = 60000): Promise<any> {
    const taskId = `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(taskId);
        resolve({
          success: false,
          error: 'Waktu eksekusi melalui ekstensi habis (timeout).',
        });
      }, timeoutMs);

      this.pendingRequests.set(taskId, {
        resolve,
        reject: (err) => resolve({ success: false, error: err?.message || 'Eksekusi ekstensi gagal.' }),
        timeout,
      });

      window.postMessage({ type, taskId, payload }, '*');
    });
  }

  /**
   * Mendaftarkan listener yang dipanggil setiap token Weavy diperbarui oleh Ekstensi.
   */
  public onTokenRefreshed(listener: (account: ImportedWeavyAccount) => void): () => void {
    this.tokenRefreshListeners.add(listener);
    return () => {
      this.tokenRefreshListeners.delete(listener);
    };
  }

  private notifyTokenRefreshed(account: ImportedWeavyAccount) {
    this.tokenRefreshListeners.forEach((fn) => {
      try {
        fn(account);
      } catch (_) {}
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('weavy-token-refreshed', { detail: account }));
    }
  }

  /**
   * Memulihkan sesi Weavy lewat Ekstensi: reload tab app.weavy.ai, baca ulang
   * session Firebase, lalu dapat refresh token + id token baru.
   */
  public async refreshWeavyToken(): Promise<{
    success: boolean;
    account?: ImportedWeavyAccount;
    error?: string;
  }> {
    if (typeof window === 'undefined') {
      return { success: false, error: 'Window tidak tersedia.' };
    }

    const connected = await this.waitForConnection(3000);
    if (!connected) {
      return { success: false, error: 'Ekstensi Weavy belum terhubung.' };
    }

    const res = await this.postBridgeTask('AMB_REFRESH_WEAVY_TOKEN', {}, 60000);
    if (!res?.success || !res?.account) {
      return {
        success: false,
        error: res?.error || 'Gagal memulihkan sesi Weavy melalui Ekstensi.',
      };
    }

    const account: ImportedWeavyAccount = {
      id: res.account.id || res.account.userId || 'weavy_active',
      userId: res.account.userId,
      email: res.account.email || '',
      name: res.account.name || 'Weavy User',
      displayName: res.account.name || 'Weavy User',
      refreshToken: res.account.refreshToken || '',
      idToken: res.account.idToken || '',
      credits: typeof res.account.credits === 'number' ? res.account.credits : 0,
      provider: 'weavy',
      lastVerified: new Date().toISOString(),
    };

    this.notifyTokenRefreshed(account);
    return { success: true, account };
  }

  /**
   * Mengunggah gambar ke Weavy Asset Store lewat Ekstensi (dijalankan di dalam
   * tab app.weavy.ai supaya tidak kena CORS/WAF).
   * - URL http(s): dipakai langsung sebagai asset
   * - data:/blob:  : dikonversi ke data URL lalu diunggah oleh Ekstensi
   */
  public async uploadWeavyAsset(
    source: string,
    options: { name?: string; idToken: string }
  ): Promise<{
    success: boolean;
    asset?: {
      type: 'image';
      url: string;
      width: number;
      height: number;
      thumbnailUrl: string;
      id: string;
      name: string;
    };
    error?: string;
  }> {
    const { idToken, name } = options;

    if (!source) {
      return { success: false, error: 'Sumber gambar kosong.' };
    }

    if (/^https?:\/\//i.test(source)) {
      // URL remote diunggah dari dalam tab Weavy (CORS aman, cookie sesi ikut terbawa)
      const res = await this.postBridgeTask(
        'AMB_UPLOAD_WEAVY_ASSET',
        { sourceUrl: source, fileName: name || 'reference.png', idToken },
        60000
      );

      if (!res?.success || !res?.data?.url) {
        return { success: false, error: res?.error || 'Upload gambar ke Weavy gagal.' };
      }

      const uploaded = res.data;
      return {
        success: true,
        asset: {
          type: 'image',
          url: uploaded.url,
          width: uploaded.width || 1024,
          height: uploaded.height || 1024,
          thumbnailUrl: uploaded.thumbnailUrl || uploaded.url,
          id: uploaded.id || `img_${Date.now()}`,
          name: uploaded.name || name || 'reference.png',
        },
      };
    }

    let dataUrl = source;
    if (!source.startsWith('data:')) {
      try {
        const blobRes = await fetch(source);
        const blob = await blobRes.blob();
        dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(new Error('Gagal membaca gambar lokal.'));
          reader.readAsDataURL(blob);
        });
      } catch (_) {
        return { success: false, error: 'Gagal membaca gambar referensi.' };
      }
    }

    const res = await this.postBridgeTask(
      'AMB_UPLOAD_WEAVY_ASSET',
      { dataUrl, fileName: name || 'reference.png', idToken },
      60000
    );

    if (!res?.success || !res?.data?.url) {
      return { success: false, error: res?.error || 'Upload gambar ke Weavy gagal.' };
    }

    const uploaded = res.data;
    return {
      success: true,
      asset: {
        type: 'image',
        url: uploaded.url,
        width: uploaded.width || 1024,
        height: uploaded.height || 1024,
        thumbnailUrl: uploaded.thumbnailUrl || uploaded.url,
        id: uploaded.id || `img_${Date.now()}`,
        name: uploaded.name || name || 'reference.png',
      },
    };
  }

  /**
   * Mengeksekusi permintaan Weavy API melalui Ekstensi Chrome (100% lolos WAF & 403).
   * Jika Ekstensi membalas 401/403, token sesi diperbarui otomatis lalu request diulang.
   */
  public async executeWeavyTask(payload: {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    body?: any;
  }): Promise<{
    success: boolean;
    ok?: boolean;
    status?: number;
    text?: string;
    json?: any;
    error?: string;
    tokenRefreshed?: boolean;
  }> {
    if (typeof window === 'undefined') {
      return { success: false, error: 'Window tidak tersedia.' };
    }

    let res = await this.postBridgeTask('AMB_EXECUTE_TASK', payload, 60000);

    // Token yang diperbarui oleh Ekstensi (retry internal) diteruskan ke aplikasi
    if (res?.refreshedAccount?.idToken) {
      this.notifyTokenRefreshed({
        id: res.refreshedAccount.userId || 'weavy_active',
        userId: res.refreshedAccount.userId,
        email: res.refreshedAccount.email || '',
        name: res.refreshedAccount.name || 'Weavy User',
        displayName: res.refreshedAccount.name || 'Weavy User',
        refreshToken: res.refreshedAccount.refreshToken || '',
        idToken: res.refreshedAccount.idToken,
        credits: 0,
        provider: 'weavy',
        lastVerified: new Date().toISOString(),
      });
    }

    // 401/403 yang belum tertangani Ekstensi: pulihkan token lewat Ekstensi lalu ulangi request
    const status = res?.status;
    if ((status === 401 || status === 403) && !res?.tokenRefreshed && this.isConnected) {
      const refreshed = await this.refreshWeavyToken();
      const freshToken = refreshed?.account?.idToken;
      if (refreshed?.success && freshToken) {
        const retry = await this.postBridgeTask(
          'AMB_EXECUTE_TASK',
          {
            ...payload,
            headers: {
              ...(payload.headers || {}),
              Authorization: `Bearer ${freshToken}`,
            },
          },
          60000
        );

        if (retry && (retry.ok || retry.status === 200 || retry.json)) {
          return { ...retry, tokenRefreshed: true };
        }

        if (retry) res = retry;
      }
    }

    return res;
  }

  /**
   * Refresh / Login akun Weavy lewat ekstensi.
   * - mode 'refresh' (default): ekstensi membuka tab app.weavy.ai otomatis bila belum ada, menukar token,
   *   lalu membaca kredit dari DALAM tab Weavy (lolos 403 / Cloudflare). Sesi login tab tidak diubah.
   * - mode 'login': sama seperti refresh + menulis sesi akun ke tab Weavy lalu reload tab.
   */
  public async syncAccountToWeavyTab(
    account: {
      id?: string;
      userId?: string;
      email?: string;
      name?: string;
      displayName?: string;
      refreshToken?: string;
      idToken?: string;
      credits?: number;
      expiresAt?: number;
    },
    options: { mode?: 'refresh' | 'login' } = {}
  ): Promise<{
    success: boolean;
    credits?: number;
    totalCredits?: number;
    email?: string;
    name?: string;
    idToken?: string;
    refreshToken?: string;
    expiresIn?: number;
    tabId?: number;
    openedTab?: boolean;
    code?: string;
    error?: string;
  }> {
    if (typeof window === 'undefined') {
      return { success: false, error: 'Window tidak tersedia.' };
    }

    const connected = await this.waitForConnection(4000);
    if (!connected) {
      return {
        success: false,
        code: 'NOT_CONNECTED',
        error: 'Ekstensi Weavy belum terhubung. Pastikan ekstensi aktif, lalu refresh halaman AMB Media (F5).',
      };
    }
    if (!this.isVersionAtLeast('3.1.0')) {
      return {
        success: false,
        code: 'OLD_EXTENSION',
        error: 'Ekstensi Weavy versi lama. Buka chrome://extensions, klik Reload pada ekstensi, lalu refresh halaman ini (F5).',
      };
    }

    const taskId = `sync_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    return new Promise((resolve) => {
      // 60 dtk: mencakup pembukaan tab Weavy otomatis (maks ~30 dtk) + ambil kredit
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(taskId);
        resolve({
          success: false,
          code: 'TIMEOUT',
          error: 'Waktu habis saat menghubungi tab Weavy. Pastikan app.weavy.ai bisa dibuka & sudah login, lalu coba lagi.',
        });
      }, 60000);

      this.pendingRequests.set(taskId, {
        resolve,
        reject: (err) => resolve({ success: false, error: err?.message || 'Gagal sinkronisasi tab Weavy.' }),
        timeout,
      });

      window.postMessage(
        {
          type: 'AMB_SYNC_ACCOUNT_TO_TAB',
          taskId,
          payload: { account, mode: options.mode || 'refresh' },
        },
        '*'
      );
    });
  }

  /**
   * Helper pemanggilan API Weavy universal dengan fallback cerdas ke Ekstensi jika server diblokir WAF/403
   */
  public async callWeavyApi(endpoint: string, options: {
    method?: string;
    headers?: Record<string, string>;
    body?: any;
    idToken?: string;
  } = {}): Promise<{
    ok: boolean;
    status: number;
    text: string;
    json: any;
    viaBridge?: boolean;
  }> {
    const { method = 'GET', headers = {}, body, idToken } = options;
    const finalHeaders = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/plain, */*',
      'x-app-version': '4.1.1316',
      'x-weavy-auth-provider': 'firebase',
      ...headers,
    };
    if (idToken && !finalHeaders['Authorization']) {
      finalHeaders['Authorization'] = `Bearer ${idToken}`;
    }

    // 1. Jika Ekstensi terhubung, prioritaskan eksekusi via Ekstensi (100% lolos WAF 403)
    if (this.isConnected) {
      try {
        const fullUrl = endpoint.startsWith('http')
          ? (endpoint.includes('/api/weavy') ? endpoint.replace('/api/weavy', 'https://api.weavy.ai') : endpoint)
          : `https://api.weavy.ai${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

        const bridgeRes = await this.executeWeavyTask({
          url: fullUrl,
          method,
          headers: finalHeaders,
          body: typeof body === 'object' && body !== null ? JSON.stringify(body) : body,
        });

        if (bridgeRes && (bridgeRes.ok || bridgeRes.status === 200 || bridgeRes.json)) {
          return {
            ok: bridgeRes.ok ?? true,
            status: bridgeRes.status ?? 200,
            text: bridgeRes.text || JSON.stringify(bridgeRes.json || {}),
            json: bridgeRes.json || {},
            viaBridge: true,
          };
        }
      } catch (bridgeErr) {
        console.warn('[ExtensionBridge callWeavyApi Warn]:', bridgeErr);
      }
    }

    // 2. Fallback via server API
    const serverUrl = endpoint.startsWith('http') ? endpoint : (endpoint.startsWith('/api') ? endpoint : `/api${endpoint.startsWith('/') ? '' : '/'}${endpoint}`);
    const res = await fetch(serverUrl, {
      method,
      headers: finalHeaders,
      body: typeof body === 'object' && body !== null ? JSON.stringify(body) : body,
    });

    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch (_) {}

    return {
      ok: res.ok,
      status: res.status,
      text,
      json,
      viaBridge: false,
    };
  }

  /**
   * Buat tugas generasi lewat ekstensi jika terhubung; gunakan server hanya jika ekstensi offline.
   */
  public async generateWeavy(options: WeavyGenerateOptions, settings: { bridgeOnly?: boolean } = {}): Promise<{
    success: boolean;
    taskId?: string;
    recipeId?: string;
    nodeId?: string;
    batchId?: string;
    error?: string;
    viaBridge?: boolean;
  }> {
    if (settings.bridgeOnly && !this.isConnected) {
      return { success: false, error: 'Ekstensi Weavy belum terhubung. Generasi Canvas tidak dikirim ke server.' };
    }

    // 1. Jika Ekstensi aktif, eksekusi pembuatan Recipe & Batch Run LANGSUNG via Ekstensi (100% Lolos 403 & WAF)
    if (this.isConnected) {
      try {
        console.log('[ExtensionBridge] Mengeksekusi generasi Weavy via Chrome Extension Bridge...');

        // Helper extractor media URL dari Weavy API (sesuai ektension-weavy response-parsers)
        const extractMediaUrlFromObject = (obj: any, excludeUrls: string[] = []): string | null => {
          if (!obj) return null;
          const isExcluded = (u: string) => {
            if (!u || typeof u !== 'string') return false;
            const cleanU = u.trim();
            return excludeUrls.some((ex) => ex && (cleanU === ex.trim() || cleanU.includes(ex.trim()) || (ex.length > 20 && ex.trim().includes(cleanU))));
          };

          if (typeof obj === 'string') {
            const trimmed = obj.trim();
            if ((trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:image')) && !isExcluded(trimmed)) {
              return trimmed;
            }
            return null;
          }
          if (Array.isArray(obj)) {
            for (const item of obj) {
              const found = extractMediaUrlFromObject(item, excludeUrls);
              if (found) return found;
            }
            return null;
          }
          if (typeof obj === 'object') {
            for (const key of ['resultUrl', 'outputUrl', 'imageUrl', 'videoUrl', 'image', 'video', 'url', 'downloadUrl', 'fileUrl']) {
              if (typeof obj[key] === 'string' && (obj[key].startsWith('http://') || obj[key].startsWith('https://'))) {
                if (!isExcluded(obj[key])) return obj[key].trim();
              }
            }
            if (obj.result) {
              const res = extractMediaUrlFromObject(obj.result, excludeUrls);
              if (res) return res;
            }
            if (obj.output) {
              const res = extractMediaUrlFromObject(obj.output, excludeUrls);
              if (res) return res;
            }
            if (obj.outputs) {
              const res = extractMediaUrlFromObject(obj.outputs, excludeUrls);
              if (res) return res;
            }
            if (obj.file) {
              const res = extractMediaUrlFromObject(obj.file, excludeUrls);
              if (res) return res;
            }
            for (const key of Object.keys(obj)) {
              if (key === 'input' || key === 'params' || key === 'inputs' || key === 'parameters') continue;
              const val = obj[key];
              if (typeof val === 'string' && (val.startsWith('http://') || val.startsWith('https://'))) {
                if (!isExcluded(val)) return val.trim();
              }
              if (typeof val === 'object' && val !== null) {
                const sub = extractMediaUrlFromObject(val, excludeUrls);
                if (sub) return sub;
              }
            }
          }
          return null;
        };

        let activeIdToken = options.idToken || '';
        if (!activeIdToken && options.refreshToken) {
          try {
            const tokenRes = await fetch('https://securetoken.googleapis.com/v1/token?key=AIzaSyC-qLy3TFyXMogJPfMkZJ9H_q46hEu1sxI', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: options.refreshToken,
              }).toString(),
            });
            if (tokenRes.ok) {
              const tData = await tokenRes.json();
              activeIdToken = tData.id_token || '';
            }
          } catch (_) {}
        }

        if (!activeIdToken) {
          throw new Error('Token sesi Weavy tidak tersedia. Silakan segarkan akun di Pengaturan.');
        }

        const authHeader = {
          Authorization: `Bearer ${activeIdToken}`,
          'x-weavy-auth-provider': 'firebase',
          'x-app-version': '4.1.1316',
          'Content-Type': 'application/json',
        };

        // Step 1: Create or get Recipe Canvas
        const listRes = await this.executeWeavyTask({
          url: 'https://api.weavy.ai/api/v1/recipes?limit=50',
          method: 'GET',
          headers: authHeader,
        });

        const list = Array.isArray(listRes.json) ? listRes.json : (listRes.json?.recipes || []);
        let recipeId = list.find((r: any) => r.name && (r.name.includes('AMB') || r.name.includes('Generation') || r.name.includes('Canvas') || r.name.includes('Image')))?.id || list[0]?.id;

        if (!recipeId) {
          const createRes = await this.executeWeavyTask({
            url: 'https://api.weavy.ai/api/v1/recipes/create',
            method: 'POST',
            headers: authHeader,
            body: JSON.stringify({
              name: `AMB Studio Canvas (${Date.now()})`,
              description: 'Created with AMB Media & Chrome Extension Bridge',
            }),
          });
          recipeId = createRes.json?.id || createRes.json?._id || createRes.json?.recipe?.id;
        }

        if (!recipeId) {
          throw new Error('Gagal menginisialisasi Recipe Canvas di Weavy AI.');
        }

        const promptNodeId = `prompt_${Date.now()}`;
        const modelNodeId = `node_model_${Date.now()}`;
        const cleanPrompt = (options.prompt || '').trim();

        // 1. Text Prompt Node (promptV3)
        const promptNode = {
          id: promptNodeId,
          type: 'promptV3',
          position: { x: 200, y: 200 },
          data: {
            name: 'Prompt',
            color: 'Yambo_Green',
            prompt: cleanPrompt,
            output: { type: 'text', prompt: cleanPrompt },
            result: { prompt: cleanPrompt },
            handles: { output: { prompt: { type: 'text', order: 0 } } },
            version: 3,
          },
        };

        // Model Classification sesuai ektension-weavy
        const rawModel = String(options.model || '').trim().toLowerCase();
        const isSeedream = rawModel.includes('seedream');
        const isNanoBanana = rawModel.includes('banana');
        const isGrok = rawModel.includes('grok');
        const isGptEdit = rawModel === 'gpt_image_1_edit' || (rawModel.includes('gpt') && rawModel.includes('edit'));
        const isGpt2 = rawModel === 'gpt_image_2';
        const isGpt25 = rawModel.includes('flare') || rawModel.includes('2.5') || rawModel.includes('gpt_image_2_5');
        const isKlingMotion = rawModel.includes('kling');
        const isSeeDance25 = rawModel.includes('seedance') && rawModel.includes('2.5');
        const isSeeDance = rawModel.includes('seedance') || isSeeDance25;
        const isVideo = (options as any).mode === 'video' || isSeeDance || isKlingMotion;

        const randomSeed = Math.floor(Math.random() * 2147483647);
        const imageSizeMap: Record<string, string> = {
          '9:16': 'portrait_16_9',
          '16:9': 'landscape_16_9',
          '1:1': 'square_hd',
          '4:3': 'landscape_4_3',
          '3:4': 'portrait_4_3',
        };
        const cleanAr = (options.aspect_ratio || '9:16').split(' ')[0];
        const imageSize = imageSizeMap[cleanAr] || 'portrait_16_9';

        let targetModelName = 'fal-ai/nano-banana-pro/edit';
        let targetDisplayName = 'Nano Banana Pro';
        let targetDescription = 'Edit images with Nano Banana Pro';
        let targetMenuDisplayName = 'Nano Banana Pro';
        let modelCredits = 7;
        let outputSchema: any[] = [{ id: 'result', title: 'Result', description: 'The generated image.', dataType: 'image' }];
        let parametersList: any[] = [];
        let paramsObj: any = {};
        let inputObj: any = { prompt: cleanPrompt };
        let nodeHandles: any = {
          input: { prompt: { type: 'text', order: 0, required: true } },
          output: { result: { type: 'image', order: 0 } },
        };
        let nodeSchema: any = {};

        const inputsList: any[] = [
          [
            { id: 'prompt', title: 'Prompt', description: 'Text description', validTypes: ['text'], required: true },
            { nodeId: promptNodeId, outputId: 'prompt', string: cleanPrompt },
          ],
        ];

        // 2. Reference Image/Video Nodes (Import)
        const refNodes: any[] = [];
        const refEdges: any[] = [];
        const rawReadyAssets: any[] = [
          ...(options.images || []),
          ...(options.image_url ? [options.image_url] : []),
          ...(options.attached_media || []),
        ];

        const readyAssets = Array.from(new Set(rawReadyAssets.map((item: any) => typeof item === 'string' ? item : item?.url).filter(Boolean)))
          .map((url: string, idx: number) => ({
            id: `asset_${Date.now()}_${idx}`,
            url,
            viewUrl: url,
            type: url.includes('.mp4') ? 'video' : 'image',
          }));

        readyAssets.forEach((asset, idx) => {
          const fNodeId = `file_ref_${Date.now()}_${idx}`;
          const handleName = (isGptEdit && idx === 0) ? 'image' : (isGrok && readyAssets.length === 1) ? 'image' : `image_${idx + 1}`;

          refNodes.push({
            id: fNodeId,
            isModel: false,
            type: 'import',
            dragHandle: '.node-header',
            position: { x: 200, y: 380 + idx * 180 },
            data: {
              name: `File ${idx + 1}`,
              color: 'Yambo_Blue',
              files: [asset],
              output: { file: asset },
              result: asset,
              handles: {
                output: {
                  file: {
                    type: 'any',
                    label: 'File',
                    order: 0,
                    format: 'uri',
                    description: 'The uploaded file',
                  },
                },
              },
              version: 3,
              dark_color: 'Yambo_Blue_Dark',
              border_color: 'Yambo_Blue_Stroke',
            },
          });

          refEdges.push({
            id: `edge_ref_${idx + 1}_${Date.now()}`,
            type: 'custom',
            source: fNodeId,
            target: modelNodeId,
            sourceHandle: `${fNodeId}-output-file`,
            targetHandle: `${modelNodeId}-input-${handleName}`,
            data: {
              sourceColor: 'Yambo_Blue',
              targetColor: 'Yambo_Purple',
              sourceHandleType: 'any',
              targetHandleType: 'image',
            },
          });

          nodeHandles.input[handleName] = { type: 'image', order: idx + 1, required: (isGptEdit && idx === 0) };
          inputsList.push([
            { id: handleName, title: handleName, description: `Reference image ${idx + 1}`, validTypes: ['image'], required: (isGptEdit && idx === 0) },
            { nodeId: fNodeId, outputId: 'file', file: asset },
          ]);
          paramsObj[handleName] = asset;
          inputObj[handleName] = asset;
        });

        if (isVideo) {
          if (isKlingMotion) {
            targetModelName = 'fal-ai/kling-Video/v2.6/standard/motion-control';
            targetDisplayName = 'Kling Motion Control';
            targetDescription = 'Kling Motion Control video generation';
            modelCredits = 15;
          } else if (isSeeDance25) {
            targetModelName = 'bytedance/seedance-2.5';
            targetDisplayName = 'SeeDance 2.5';
            targetDescription = 'Next-gen video generation by ByteDance';
            modelCredits = 14;
          } else {
            targetModelName = 'bytedance/seedance-2.0-mini';
            targetDisplayName = 'SeeDance 2.0 Mini';
            targetDescription = 'Cost-effective video generation from ByteDance';
            modelCredits = 12;
          }
          outputSchema = [{ id: 'result', title: 'Video Result', description: 'The generated video.', dataType: 'video' }];
          nodeHandles.output = { result: { type: 'video', order: 0 } };
          paramsObj = {
            ...paramsObj,
            prompt: cleanPrompt,
            aspect_ratio: cleanAr,
            resolution: options.resolution || '720p',
            duration: typeof options.duration === 'number' ? options.duration : 15,
            generate_audio: options.generate_audio ?? true,
          };
        } else if (isGpt25) {
          targetModelName = 'gpt-image-2.5';
          targetDisplayName = 'GPT Image 2.5';
          targetDescription = 'Generates images with GPT Image 2.5';
          targetMenuDisplayName = 'GPT Image 2.5';
          modelCredits = 10;
          parametersList = [
            [{ id: 'model', title: 'Variant', constraint: { type: 'enum', options: ['Flare', 'Sunburst'] }, defaultValue: { type: 'string', value: 'Flare' } }, { type: 'value', data: { type: 'string', value: 'Flare' } }],
            [{ id: 'quality', title: 'Quality', constraint: { type: 'enum', options: ['auto', 'low', 'medium', 'high', 'xhigh', 'max'] }, defaultValue: { type: 'string', value: 'high' } }, { type: 'value', data: { type: 'string', value: 'high' } }],
            [{ id: 'image_size', title: 'Aspect Ratio', constraint: { type: 'image_size' }, defaultValue: { type: 'image_size', value: { type: 'built_in', value: imageSize } } }, { type: 'value', data: { type: 'image_size', value: { type: 'built_in', value: imageSize } } }],
            [{ id: 'output_format', title: 'Output Format', constraint: { type: 'enum', options: ['png', 'jpeg', 'webp'] }, defaultValue: { type: 'string', value: 'png' } }, { type: 'value', data: { type: 'string', value: 'png' } }],
          ];
          paramsObj = {
            ...paramsObj,
            model: 'Flare',
            prompt: cleanPrompt,
            quality: 'high',
            background: 'auto',
            image_size: imageSize,
            output_format: 'png',
          };
        } else if (isSeedream) {
          targetModelName = 'fal-ai/bytedance/seedream/v5/lite/edit';
          targetDisplayName = 'Seedream V5.0 Pro Edit';
          targetDescription = 'Edit images with Seedream V5.0 Pro';
          targetMenuDisplayName = 'Seedream V5.0 Pro Edit';
          modelCredits = 6;
          parametersList = [
            [{ id: 'model', title: 'Model', constraint: { type: 'enum', options: ['V4.0', 'V4.5', 'V5.0', 'V5.0 Pro'] }, defaultValue: { type: 'string', value: 'V5.0 Pro' } }, { type: 'value', data: { type: 'string', value: 'V5.0 Pro' } }],
            [{ id: 'seed', title: 'Seed', constraint: { type: 'seed' }, defaultValue: { type: 'seed', value: { seed: 1, isRandom: false } } }, { type: 'value', data: { type: 'seed', value: { seed: randomSeed, isRandom: true } } }],
            [{ id: 'image_size', title: 'Image Size', constraint: { type: 'image_size' }, defaultValue: { type: 'image_size', value: { type: 'built_in', value: imageSize } } }, { type: 'value', data: { type: 'image_size', value: { type: 'built_in', value: imageSize } } }],
          ];
          paramsObj = {
            ...paramsObj,
            model: 'V5.0 Pro',
            prompt: cleanPrompt,
            seed: randomSeed,
            image_size: imageSize,
            enhance_prompt_mode: 'standard',
          };
        } else if (isGrok) {
          targetModelName = 'xai/grok-imagine-image';
          targetDisplayName = 'Grok Imagine Image';
          targetDescription = 'Generates images with Grok Imagine Image';
          targetMenuDisplayName = 'Grok Imagine Image';
          modelCredits = 8;
          paramsObj = {
            ...paramsObj,
            prompt: cleanPrompt,
            seed: randomSeed,
            aspect_ratio: cleanAr,
          };
        } else if (isGptEdit) {
          targetModelName = 'gpt_image_1_edit';
          targetDisplayName = 'ChatGPT Images 2.0 Edit';
          targetDescription = "Edit images with OpenAI's GPT Image 2";
          modelCredits = 9;
          paramsObj = {
            ...paramsObj,
            size: 'auto',
            model: 'GPT Image 2',
            quality: 'medium',
            number_of_images: 1,
            prompt: cleanPrompt,
          };
        } else {
          // Default: Nano Banana Pro (Google Gemini Image Model di Weavy)
          targetModelName = 'fal-ai/nano-banana-pro/edit';
          targetDisplayName = 'Nano Banana Pro';
          targetDescription = 'Edit images with Nano Banana Pro';
          targetMenuDisplayName = 'Nano Banana Pro';
          modelCredits = 7;
          const cleanRes = (options.resolution === '2K' || options.resolution === '4K') ? options.resolution : '1K';
          parametersList = [
            [{ id: 'seed', title: 'Seed', constraint: { type: 'seed' }, defaultValue: { type: 'seed', value: { seed: 1, isRandom: false } } }, { type: 'value', data: { type: 'seed', value: { seed: randomSeed, isRandom: true } } }],
            [{ id: 'resolution', title: 'Resolution', constraint: { type: 'enum', options: ['1K', '2K', '4K'] }, defaultValue: { type: 'string', value: '1K' } }, { type: 'value', data: { type: 'string', value: cleanRes } }],
            [{ id: 'aspect_ratio', title: 'Aspect Ratio', constraint: { type: 'enum' }, defaultValue: { type: 'string', value: 'auto' } }, { type: 'value', data: { type: 'string', value: cleanAr } }],
          ];
          paramsObj = {
            ...paramsObj,
            prompt: cleanPrompt,
            seed: randomSeed,
            num_images: 1,
            resolution: cleanRes,
            aspect_ratio: cleanAr,
            output_format: 'png',
            enable_web_search: false,
          };
        }

        const isFalImported = isSeedream || isNanoBanana || isGrok || isKlingMotion;

        // 3. Model Node (custommodelV2 100% format asli Weavy)
        const modelNode = {
          id: modelNodeId,
          type: 'custommodelV2',
          isModel: true,
          dragHandle: '.node-header',
          position: { x: 650, y: 200 },
          data: {
            name: targetDisplayName,
            description: targetDescription,
            ...(isGptEdit ? { color: 'Red' } : {}),
            menu: { icon: 'EmojiObjectsIcon', isModel: true, displayName: targetMenuDisplayName },
            model: {
              name: targetModelName,
              ...(isFalImported ? { service: 'fal_imported', version: targetModelName } : {}),
            },
            ...(Object.keys(nodeSchema).length > 0 ? { schema: nodeSchema } : {}),
            kind: {
              type: 'wildcard',
              model: {
                type: 'predefined',
                name: targetModelName,
                description: targetDescription,
                ...(isFalImported ? { service: 'fal_imported', version: targetModelName } : {}),
              },
              inputs: inputsList,
              parameters: parametersList,
              outputs: outputSchema,
            },
            params: paramsObj,
            input: inputObj,
            handles: nodeHandles,
            version: 3,
          },
        };

        const nodes = [promptNode, modelNode, ...refNodes];
        const edges = [
          {
            id: `edge_p_${Date.now()}`,
            type: 'custom',
            source: promptNodeId,
            target: modelNodeId,
            sourceHandle: `${promptNodeId}-output-prompt`,
            targetHandle: `${modelNodeId}-input-prompt`,
            data: {
              sourceColor: 'Yambo_Green',
              targetColor: 'Yambo_Purple',
              sourceHandleType: 'text',
              targetHandleType: 'text',
            },
          },
          ...refEdges,
        ];

        const executePayload = {
          numberOfRuns: 1,
          nodes,
          edges,
          displayedCost: {
            credits: modelCredits,
            perSecondRate: 0,
            surface: 'drawer',
          },
        };

        const execHeaders = {
          ...authHeader,
          'x-app-recipeid': recipeId,
        };

        // Simpan recipe canvas workflow
        await this.executeWeavyTask({
          url: `https://api.weavy.ai/api/v1/recipes/${recipeId}/save`,
          method: 'POST',
          headers: execHeaders,
          body: JSON.stringify({ nodes, edges, files: readyAssets, v3: true, lastUpdatedAt: new Date().toISOString() }),
        });

        // Trigger batch execution di Weavy
        let runRes = await this.executeWeavyTask({
          url: `https://api.weavy.ai/api/v1/batches/recipes/${recipeId}/execute`,
          method: 'POST',
          headers: execHeaders,
          body: JSON.stringify(executePayload),
        });

        // Jika model butuh persetujuan workspace
        if (runRes.status === 403) {
          try {
            await this.executeWeavyTask({
              url: 'https://api.weavy.ai/api/v1/workspaces/models/approve',
              method: 'POST',
              headers: execHeaders,
              body: JSON.stringify({
                modelIds: [targetModelName, 'fal-ai/nano-banana-pro/edit', 'fal-ai/bytedance/seedream/v5/lite/edit', 'xai/grok-imagine-image', 'gpt_image_1_edit', 'bytedance/seedance-2.0-mini', 'bytedance/seedance-2.5'],
              }),
            });
            runRes = await this.executeWeavyTask({
              url: `https://api.weavy.ai/api/v1/batches/recipes/${recipeId}/execute`,
              method: 'POST',
              headers: execHeaders,
              body: JSON.stringify(executePayload),
            });
          } catch (_) {}
        }

        let batchId = runRes.json?.batchId || runRes.json?.id;
        if (!batchId) {
          runRes = await this.executeWeavyTask({
            url: `https://api.weavy.ai/api/v1/batches/recipes/${recipeId}/runs`,
            method: 'POST',
            headers: execHeaders,
            body: JSON.stringify({}),
          });
          batchId = runRes.json?.batchId || runRes.json?.id;
        }

        if (!batchId) {
          throw new Error('Weavy AI tidak mengembalikan ID batch eksekusi.');
        }

        console.log(`[ExtensionBridge ✅] Sukses submit generasi Weavy! recipeId: ${recipeId}, batchId: ${batchId}`);

        return {
          success: true,
          taskId: batchId,
          batchId,
          recipeId,
          nodeId: modelNodeId,
          viaBridge: true,
        };
      } catch (bridgeErr: any) {
        const error = bridgeErr?.message || 'Generasi Weavy melalui ekstensi gagal.';
        console.error('[ExtensionBridge] generateWeavy bridge error:', error);
        return { success: false, error };
      }
    }

    if (settings.bridgeOnly) {
      return { success: false, error: 'Koneksi Ekstensi Weavy terputus. Generasi Canvas tidak dikirim ke server.' };
    }

    // 2. Fallback via server endpoint `/api/generate-weavy` (hanya jika ekstensi belum terhubung)
    try {
      const resp = await fetch('/api/generate-weavy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
      });

      const text = await resp.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch (_) {}

      if (resp.ok && data && data.success) {
        return {
          success: true,
          taskId: data.taskId || data.batchId,
          recipeId: data.recipeId,
          nodeId: data.nodeId,
          batchId: data.batchId || data.taskId,
          viaBridge: false,
        };
      }

      return {
        success: false,
        error: data?.error || data?.message || `Gagal membuat generasi Weavy (HTTP ${resp.status}).`,
      };
    } catch (serverErr: any) {
      return {
        success: false,
        error: serverErr?.message || 'Tidak dapat menghubungi server Weavy atau Ekstensi Chrome.',
      };
    }
  }

  /**
   * Helper polling status generasi Weavy AI dengan auto fallback ke Ekstensi (100% Bebas 403 & WAF)
   */
  public async pollWeavyStatus(options: WeavyPollOptions): Promise<string> {
    const { recipeId, taskId, batchId, idToken, refreshToken, bridgeOnly = false, maxAttempts = 60, pollInterval = 2500, onProgress, onCreditUpdate } = options;
    const activeBatchId = taskId || batchId;

    if (bridgeOnly && !this.isConnected) {
      throw new Error('Ekstensi Weavy belum terhubung. Status generasi Canvas tidak diperiksa melalui server.');
    }

    // Helper extractor media URL dari Weavy API
    const extractMediaUrlFromObject = (obj: any, excludeUrls: string[] = []): string | null => {
      if (!obj) return null;
      const isExcluded = (u: string) => {
        if (!u || typeof u !== 'string') return false;
        const cleanU = u.trim();
        return excludeUrls.some((ex) => ex && (cleanU === ex.trim() || cleanU.includes(ex.trim()) || (ex.length > 20 && ex.trim().includes(cleanU))));
      };

      if (typeof obj === 'string') {
        const trimmed = obj.trim();
        if ((trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:image')) && !isExcluded(trimmed)) {
          return trimmed;
        }
        return null;
      }
      if (Array.isArray(obj)) {
        for (const item of obj) {
          const found = extractMediaUrlFromObject(item, excludeUrls);
          if (found) return found;
        }
        return null;
      }
      if (typeof obj === 'object') {
        for (const key of ['resultUrl', 'outputUrl', 'imageUrl', 'videoUrl', 'image', 'video', 'url', 'downloadUrl', 'fileUrl']) {
          if (typeof obj[key] === 'string' && (obj[key].startsWith('http://') || obj[key].startsWith('https://'))) {
            if (!isExcluded(obj[key])) return obj[key].trim();
          }
        }
        if (obj.result) {
          const res = extractMediaUrlFromObject(obj.result, excludeUrls);
          if (res) return res;
        }
        if (obj.output) {
          const res = extractMediaUrlFromObject(obj.output, excludeUrls);
          if (res) return res;
        }
        if (obj.outputs) {
          const res = extractMediaUrlFromObject(obj.outputs, excludeUrls);
          if (res) return res;
        }
        if (obj.file) {
          const res = extractMediaUrlFromObject(obj.file, excludeUrls);
          if (res) return res;
        }
        for (const key of Object.keys(obj)) {
          if (key === 'input' || key === 'params' || key === 'inputs' || key === 'parameters') continue;
          const val = obj[key];
          if (typeof val === 'string' && (val.startsWith('http://') || val.startsWith('https://'))) {
            if (!isExcluded(val)) return val.trim();
          }
          if (typeof val === 'object' && val !== null) {
            const sub = extractMediaUrlFromObject(val, excludeUrls);
            if (sub) return sub;
          }
        }
      }
      return null;
    };

    let attempts = 0;
    while (attempts < maxAttempts) {
      if (bridgeOnly && !this.isConnected) {
        throw new Error('Koneksi Ekstensi Weavy terputus saat memeriksa status generasi Canvas.');
      }

      await new Promise((r) => setTimeout(r, pollInterval));
      attempts++;

      const calculatedProgress = Math.min(10 + attempts * 3, 94);
      if (onProgress) onProgress(calculatedProgress);

      // Strategy 1: Polling via Extension Bridge LANGSUNG jika ekstensi aktif (100% Lolos 403 & WAF)
      if (this.isConnected && recipeId) {
        try {
          let activeIdToken = idToken || '';
          if (!activeIdToken && refreshToken) {
            try {
              const tokenRes = await fetch('https://securetoken.googleapis.com/v1/token?key=AIzaSyC-qLy3TFyXMogJPfMkZJ9H_q46hEu1sxI', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }).toString(),
              });
              if (tokenRes.ok) {
                const tData = await tokenRes.json();
                activeIdToken = tData.id_token || '';
              }
            } catch (_) {}
          }

          const authHeader = {
            Authorization: `Bearer ${activeIdToken}`,
            'x-weavy-auth-provider': 'firebase',
            'x-app-version': '4.1.1316',
            'x-app-recipeid': recipeId,
          };

          const checkUrls = [
            activeBatchId ? `https://api.weavy.ai/api/v1/batches/recipes/${recipeId}/batches/${activeBatchId}/status` : null,
            `https://api.weavy.ai/api/v1/recipes/${recipeId}`,
          ].filter(Boolean) as string[];

          for (const cUrl of checkUrls) {
            const res = await this.executeWeavyTask({
              url: cUrl,
              method: 'GET',
              headers: authHeader,
            });

            if (res && res.json) {
              const resData = res.json;
              const creditVal = resData.userRemainingCredits ?? resData.remainingCredits ?? resData.credits;
              if (typeof creditVal === 'number' && onCreditUpdate) {
                onCreditUpdate(creditVal);
              }

              const run = resData.recipeRuns?.[0] || resData.recipeRun;
              const currentStatus = (run?.status || resData.status || '').toUpperCase();
              if (currentStatus === 'FAILED' || currentStatus === 'ERROR') {
                const errMsg = run?.error?.message || run?.error || resData.error || 'Proses rendering Weavy gagal.';
                throw new Error(typeof errMsg === 'object' ? JSON.stringify(errMsg) : String(errMsg));
              }

              // Periksa hasil media pada nodeRuns
              const nodeRuns = Array.isArray(run?.nodeRuns) ? run.nodeRuns : [];
              for (const nr of nodeRuns) {
                if (nr.result || nr.output) {
                  const mediaUrl = extractMediaUrlFromObject(nr.result || nr.output);
                  if (mediaUrl) {
                    if (onProgress) onProgress(100);
                    return mediaUrl;
                  }
                }
              }

              const foundMedia = extractMediaUrlFromObject(run || resData);
              if (foundMedia) {
                if (onProgress) onProgress(100);
                return foundMedia;
              }
            }
          }
          continue; // Lanjut ke polling berikutnya via bridge
        } catch (bridgePollErr: any) {
          if (bridgeOnly) {
            throw new Error(bridgePollErr?.message || 'Gagal memeriksa status generasi melalui Ekstensi Weavy.');
          }
          if (bridgePollErr.message && bridgePollErr.message.includes('gagal')) {
            throw bridgePollErr;
          }
        }
      }

      if (bridgeOnly) continue;

      // Strategy 2: Coba via server status endpoint (fallback jika ekstensi tidak aktif)
      try {
        const resp = await fetch('/api/poll-weavy-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipeId,
            taskId: activeBatchId,
            batchId: activeBatchId,
            idToken,
            refreshToken,
          }),
        });

        if (resp.ok) {
          const pollData = await resp.json();
          if (typeof pollData.remainingCredits === 'number' && onCreditUpdate) {
            onCreditUpdate(pollData.remainingCredits);
          }

          if (pollData.status === 'completed' && pollData.resultUrl) {
            return pollData.resultUrl;
          }
          if (pollData.status === 'failed') {
            throw new Error(pollData.error || 'Generasi Weavy gagal dibuat.');
          }
        }
      } catch (pollErr: any) {
        if (pollErr.message && pollErr.message.includes('gagal')) {
          throw pollErr;
        }
      }
    }

    throw new Error('Waktu tunggu generasi Weavy AI habis (timeout).');
  }

  /**
   * Eksekusi Chat / Any LLM Weavy AI via Ekstensi Chrome (100% Bebas 403 & WAF)
   */
  public async executeWeavyChat(options: WeavyChatOptions): Promise<{
    success: boolean;
    text: string;
    remainingCredits?: number;
    error?: string;
  }> {
    const { messages, model = 'anthropic/claude-sonnet-5', mode = 'chat', thinking = false, temperature, onStatusUpdate } = options;

    if (onStatusUpdate) onStatusUpdate('Menghubungkan ke Weavy AI via Ekstensi...');

    // 1. Resolve ID Token
    let activeIdToken = options.idToken || '';
    if (!activeIdToken && options.refreshToken) {
      try {
        const tokenRes = await fetch('https://securetoken.googleapis.com/v1/token?key=AIzaSyC-qLy3TFyXMogJPfMkZJ9H_q46hEu1sxI', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: options.refreshToken,
          }).toString(),
        });
        if (tokenRes.ok) {
          const tData = await tokenRes.json();
          activeIdToken = tData.id_token || '';
        }
      } catch (_) {}
    }

    if (!activeIdToken) {
      throw new Error('Token sesi Weavy tidak tersedia. Silakan hubungkan ulang akun di Pengaturan.');
    }

    const authHeaders = {
      Authorization: `Bearer ${activeIdToken}`,
      'x-weavy-auth-provider': 'firebase',
      'x-app-version': '4.1.1316',
      'Content-Type': 'application/json',
    };

    // 2. Normalize Model Name
    let targetModel = model;
    const lower = String(targetModel || '').toLowerCase();
    if (lower.includes('claude') || lower.includes('anthropic') || lower.includes('sonnet')) {
      if (lower.includes('opus')) targetModel = 'anthropic/claude-opus-5';
      else if (lower.includes('haiku')) targetModel = 'anthropic/claude-haiku-4-5';
      else targetModel = 'anthropic/claude-sonnet-5';
    } else if (lower.includes('gpt') || lower.includes('openai') || lower.includes('chatgpt')) {
      if (lower.includes('sol')) targetModel = 'openai/gpt-5.6-sol';
      else if (lower.includes('terra')) targetModel = 'openai/gpt-5.6-terra';
      else if (lower.includes('luna')) targetModel = 'openai/gpt-5.6-luna';
      else if (lower.includes('4.1')) targetModel = 'openai/gpt-4.1';
      else targetModel = 'openai/gpt-4o';
    } else if (lower.includes('gemini') || lower.includes('google')) {
      if (lower.includes('3.6')) targetModel = 'google/gemini-3.6-flash';
      else if (lower.includes('3.5')) targetModel = 'google/gemini-3.5-flash-lite';
      else if (lower.includes('3-pro') || lower.includes('3.1')) targetModel = 'google/gemini-3.1-pro';
      else targetModel = 'google/gemini-2.5-flash';
    } else if (lower.includes('llama') || lower.includes('meta')) {
      targetModel = 'meta-llama/llama-4-maverick';
    }

    // 3. Find or Create Recipe Canvas for Chat
    if (onStatusUpdate) onStatusUpdate(`Menyiapkan Recipe Canvas untuk model ${targetModel}...`);

    let recipeId = '';
    const listRes = await this.executeWeavyTask({
      url: 'https://api.weavy.ai/api/v1/recipes?limit=15',
      method: 'GET',
      headers: authHeaders,
    });

    const existingList = Array.isArray(listRes.json) ? listRes.json : (listRes.json?.recipes || []);
    const chatRecipe = existingList.find((r: any) =>
      r.name && (r.name.includes('Chat LLM') || r.name.includes('Chat Assistant') || r.name.includes('AMB'))
    ) || existingList[0];

    if (chatRecipe?.id) {
      recipeId = chatRecipe.id;
    } else {
      const createRes = await this.executeWeavyTask({
        url: 'https://api.weavy.ai/api/v1/recipes/create',
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          name: `Chat LLM Assistant (${Date.now().toString().slice(-4)})`,
          description: 'Automated Recipe Canvas for Weavy AI Chat',
        }),
      });
      recipeId = createRes.json?.id || createRes.json?._id;
    }

    if (!recipeId) {
      throw new Error('Gagal menginisialisasi Recipe Canvas Chat di Weavy AI.');
    }

    // 4. Assemble Prompt & Context
    let fullPromptText = '';
    const defaultInstruction = WEAVY_MASTER_DIRECTOR_PROMPT;
    const optimized = options.optimizedContext;
    const activeSysPrompt = optimized?.systemPrompt || options.systemPrompt || defaultInstruction;
    const effectiveTemperature =
      typeof temperature === 'number' ? temperature : (optimized || options.systemPrompt ? 0.3 : 0.7);

    // Kumpulkan lampiran gambar (multimodal) dari seluruh pesan
    const attachmentSources: string[] = [];
    const attachmentMeta: Array<{ src: string; name?: string; role?: string }> = [];
    const collectAttachment = (att: any) => {
      const src =
        typeof att === 'string'
          ? att
          : att?.url || att?.imageUrl || att?.dataUrl || att?.base64 || att?.src || '';
      if (src && !attachmentSources.includes(src)) {
        attachmentSources.push(src);
        attachmentMeta.push({
          src,
          name: typeof att === 'string' ? undefined : att?.name,
          role: typeof att === 'string' ? undefined : att?.referenceRole || att?.role,
        });
      }
    };
    for (const m of messages || []) {
      const attachments = Array.isArray((m as any).attachments) ? ((m as any).attachments as any[]) : [];
      for (const att of attachments) collectAttachment(att);
    }
    // Asset wajib hasil Agent V1 context selector (session memory / tagged context)
    if (optimized?.referenceAssets?.length) {
      for (const asset of optimized.referenceAssets) collectAttachment(asset);
    }
    const imageSources = attachmentSources.slice(0, 5);

    // System prompt: Master Director + kontrak storyboard + konteks tambahan + memory
    let sysSection = optimized ? `${activeSysPrompt}\n` : `[System Instruction]\n${activeSysPrompt}\n`;
    if (!optimized && options.storyboardMode) {
      sysSection += `\n${WEAVY_STORYBOARD_CONTRACT_BLOCK}\n`;
    }
    if (options.extraContext) {
      sysSection += `\n${options.extraContext}\n`;
    }
    if (options.quickPresetEnabled) {
      sysSection += `\n${WEAVY_QUICK_PRESET_BLOCK}\n`;
    }

    // Katalog media sesi (@imgX / @vidX) + aturan repost 0 kredit
    let mediaCatalogSection = '';
    const mediaList = optimized?.mediaCatalog?.mediaList || [];
    if (mediaList.length > 0) {
      mediaCatalogSection = `\n\n[KATALOG RESMI MEDIA SESI INI (@imgX & @vidX)]\n`;
      for (const m of mediaList) {
        if (m.type === 'video') {
          mediaCatalogSection += `- ${m.key}: Video "${m.name}" (durasi terdeteksi ~${m.duration || 24}s)\n`;
        } else {
          mediaCatalogSection += `- ${m.key}: Foto "${m.name}"\n`;
        }
      }
      mediaCatalogSection += `Aturan Penting Repost: Jika pengguna ingin melihat ulang media lama (misal "mana foto pertama tadi", "tampilkan @img1"), DILARANG menyuruh render ulang dan DILARANG memotong koin. Wajib sertakan tag: [weavy_repost:${
        mediaList[0]?.key || '@img1'
      }] agar langsung dimunculkan di UI tanpa kredit.\n`;
    }

    // Metadata scraping (AI Worker) -> kontrak product_card
    let scrapingSection = '';
    if (options.scrapingContext && options.scrapingContext.trim()) {
      scrapingSection = `\n\n${buildWeavyProductCardSection(options.scrapingContext.trim())}\n`;
    }

    const referenceSection = buildWeavyReferenceCatalog(
      attachmentMeta.slice(0, 5).map((a) => ({ name: a.name, url: a.src, role: a.role }))
    );
    fullPromptText += `${sysSection}${mediaCatalogSection}${scrapingSection}${referenceSection}\n\n`;

    // Riwayat = pesan history (sudah di-prune oleh Agent V1) atau semua pesan kecuali terakhir
    const historyMessages: Array<{ role: string; content: string; attachments?: any[] }> = optimized
      ? optimized.historyMessages
      : (messages || []).slice(0, -1);
    const currentMessage = optimized
      ? null
      : (messages || [])[messages.length - 1];

    fullPromptText += '[Conversation History]\n';
    if (historyMessages.length === 0) {
      fullPromptText += '(Percakapan baru)\n';
    } else {
      for (const m of historyMessages) {
        const roleLabel = m.role === 'assistant' || m.role === 'model' ? 'Assistant' : 'User';
        let c = m.content || '';
        const attachments = Array.isArray((m as any).attachments) ? ((m as any).attachments as any[]) : [];
        for (const att of attachments) {
          if (att && (att.type === 'image' || att.url || att.base64)) {
            c += `\n[Lampiran Gambar "${att.name || 'Foto'}" disertakan]`;
          }
        }
        if (c.trim()) {
          fullPromptText += `${roleLabel}: ${c}\n`;
        }
      }
    }

    const currentPromptText =
      optimized?.currentPrompt ||
      currentMessage?.content ||
      (imageSources.length > 0
        ? 'Analisis gambar dan rancang storyboard terstruktur.'
        : 'Halo!');
    fullPromptText += `\nUser: ${currentPromptText}\n\nAssistant:`;

    // 5. Build Nodes & Edges
    const promptNodeId = `prompt_${Date.now()}`;
    const modelNodeId = `model_${Date.now()}`;

    const promptNode = {
      id: promptNodeId,
      type: 'promptV3',
      position: { x: 200, y: 200 },
      data: {
        name: 'Prompt',
        color: 'Yambo_Green',
        prompt: fullPromptText,
        output: { type: 'text', prompt: fullPromptText },
        result: { prompt: fullPromptText },
        handles: { output: { prompt: { type: 'text', order: 0 } } },
        version: 3,
      },
    };

    const modelNode: any = {
      id: modelNodeId,
      isModel: true,
      type: 'custommodelV2',
      position: { x: 650, y: 200 },
      data: {
        name: 'Any LLM',
        color: 'Yambo_Purple',
        model: { name: 'any_llm' },
        kind: {
          type: 'any_llm',
          model: { type: 'value', data: { type: 'string', value: targetModel } },
          prompt: { nodeId: promptNodeId, string: fullPromptText, outputId: 'prompt' },
          thinking: { type: 'value', data: { type: 'boolean', value: Boolean(thinking) } },
          temperature: { type: 'value', data: { type: 'float', value: effectiveTemperature } },
        },
        params: {
          model: targetModel,
          temperature: effectiveTemperature,
          prompt: fullPromptText,
          thinking: Boolean(thinking),
        },
        input: {
          prompt: fullPromptText,
        },
        handles: {
          input: {
            prompt: { type: 'text', order: 0, required: true },
            system_prompt: { type: 'text', order: 1, required: false },
          },
          output: {
            text: { type: 'text', order: 0 },
          },
        },
        version: 3,
      },
    };

    // 5b. Unggah lampiran gambar ke Weavy Asset Store (multimodal)
    const imageAssets: any[] = [];
    for (const src of imageSources) {
      const uploaded = await this.uploadWeavyAsset(src, {
        name: `storyboard_ref_${imageAssets.length + 1}.png`,
        idToken: activeIdToken,
      });
      if (uploaded.success && uploaded.asset) {
        imageAssets.push(uploaded.asset);
      }
    }

    const fileNodes: any[] = [];
    const fileEdges: any[] = [];

    if (imageAssets.length > 0) {
      modelNode.data.handles.input.image = { type: 'image', order: 2, required: false };
      modelNode.data.kind.images = [];

      imageAssets.forEach((asset, idx) => {
        const fNodeId = `file_ref_${Date.now()}_${idx}`;
        const handleKey = idx === 0 ? 'image' : `image_${idx + 1}`;

        fileNodes.push({
          id: fNodeId,
          type: 'import',
          position: { x: 200, y: 480 + idx * 220 },
          data: {
            name: `File ${idx + 1}`,
            color: 'Yambo_Blue',
            files: [asset],
            output: { file: asset },
            result: asset,
            handles: { output: { file: { type: 'any', order: 0 } } },
            version: 3,
          },
        });

        modelNode.data.kind.images.push([handleKey, { file: asset, nodeId: fNodeId, outputId: 'file' }]);

        if (idx > 0) {
          modelNode.data.handles.input[handleKey] = { type: 'image', order: 2 + idx, required: false };
        }

        fileEdges.push({
          id: `edge_f_${idx}_${Date.now()}`,
          type: 'custom',
          source: fNodeId,
          target: modelNodeId,
          sourceHandle: `${fNodeId}-output-file`,
          targetHandle: `${modelNodeId}-input-${handleKey}`,
          data: {
            sourceColor: 'Yambo_Blue',
            targetColor: 'Yambo_Purple',
            sourceHandleType: 'any',
            targetHandleType: 'image',
          },
        });
      });
    }

    const nodes = [promptNode, modelNode, ...fileNodes];
    const edges = [
      {
        id: `edge_p_${Date.now()}`,
        type: 'custom',
        source: promptNodeId,
        target: modelNodeId,
        sourceHandle: `${promptNodeId}-output-prompt`,
        targetHandle: `${modelNodeId}-input-prompt`,
        data: {
          sourceColor: 'Yambo_Green',
          targetColor: 'Yambo_Purple',
          sourceHandleType: 'text',
          targetHandleType: 'text',
        },
      },
      ...fileEdges,
    ];

    // 6. Save Recipe
    if (onStatusUpdate) onStatusUpdate('Menyimpan alur kerja kanvas di Weavy...');
    await this.executeWeavyTask({
      url: `https://api.weavy.ai/api/v1/recipes/${recipeId}/save`,
      method: 'POST',
      headers: { ...authHeaders, 'x-app-recipeid': recipeId },
      body: JSON.stringify({ nodes, edges, v3: true, lastUpdatedAt: new Date().toISOString() }),
    });

    // 7. Execute Batch
    if (onStatusUpdate) onStatusUpdate(`Mengirim request ke ${targetModel}...`);
    const execRes = await this.executeWeavyTask({
      url: `https://api.weavy.ai/api/v1/batches/recipes/${recipeId}/execute`,
      method: 'POST',
      headers: { ...authHeaders, 'x-app-recipeid': recipeId },
      body: JSON.stringify({
        numberOfRuns: 1,
        nodes,
        edges,
        displayedCost: { credits: 1, perSecondRate: 0, surface: 'drawer' },
      }),
    });

    const batchId = execRes.json?.batchId || execRes.json?.id;
    if (!batchId) {
      throw new Error('Weavy AI tidak mengembalikan ID eksekusi batch.');
    }

    // 8. Poll for Result
    if (onStatusUpdate) onStatusUpdate('Menjalankan inferensi model AI...');

    const extractText = (obj: any): string => {
      if (!obj) return '';
      if (typeof obj === 'string') {
        const trimmed = obj.trim();
        if (trimmed && !trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return trimmed;
        return trimmed;
      }
      if (Array.isArray(obj)) {
        for (const item of obj) {
          const t = extractText(item);
          if (t) return t;
        }
      }
      if (typeof obj === 'object') {
        for (const key of ['value', 'text', 'output', 'response', 'content', 'prompt', 'latestPrediction', 'result']) {
          if (obj[key]) {
            const t = extractText(obj[key]);
            if (t) return t;
          }
        }
      }
      return '';
    };

    let responseText = '';
    let remainingCredits: number | undefined = undefined;

    for (let poll = 0; poll < 60; poll++) {
      await new Promise((r) => setTimeout(r, 1400));

      const stRes = await this.executeWeavyTask({
        url: `https://api.weavy.ai/api/v1/batches/recipes/${recipeId}/batches/${batchId}/status`,
        method: 'GET',
        headers: { ...authHeaders, 'x-app-recipeid': recipeId },
      });

      const stData = stRes.json || {};
      if (typeof stData.userRemainingCredits === 'number') remainingCredits = stData.userRemainingCredits;
      else if (typeof stData.remainingCredits === 'number') remainingCredits = stData.remainingCredits;

      const run = stData.recipeRuns?.[0] || stData.recipeRun;
      const status = (run?.status || stData.status || '').toUpperCase();

      if (status === 'COMPLETED' || status === 'SUCCESS') {
        const nodeRuns = Array.isArray(run?.nodeRuns) ? run.nodeRuns : [];
        const modelRun = nodeRuns.find((nr: any) => nr.nodeId === modelNodeId) ||
          nodeRuns.find((nr: any) => nr.nodeType === 'custommodelV2' || nr.name?.includes('LLM')) ||
          nodeRuns[nodeRuns.length - 1];

        if (modelRun) {
          responseText = extractText(modelRun.result) || extractText(modelRun.output) || extractText(modelRun);
        }

        if (!responseText) {
          for (const nr of nodeRuns) {
            if (nr.nodeId !== promptNodeId) {
              const candidate = extractText(nr.result) || extractText(nr.output);
              if (candidate && candidate.length > 5) {
                responseText = candidate;
                break;
              }
            }
          }
        }

        if (responseText) break;
      }

      if (status === 'FAILED' || status === 'ERROR') {
        const errMsg = run?.error?.message || run?.error || stData.error || 'Eksekusi model LLM di Weavy gagal.';
        throw new Error(typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg));
      }
    }

    // Fallback: Check Canvas nodes
    if (!responseText) {
      try {
        const cRes = await this.executeWeavyTask({
          url: `https://api.weavy.ai/api/v1/recipes/${recipeId}`,
          method: 'GET',
          headers: authHeaders,
        });
        const recipeNodes = cRes.json?.nodes || [];
        const canvasModel = recipeNodes.find((n: any) => n.id === modelNodeId) ||
          recipeNodes.find((n: any) => n.isModel || n.type === 'custommodelV2');
        if (canvasModel) {
          responseText = extractText(canvasModel.data?.result) ||
            extractText(canvasModel.data?.output) ||
            extractText(canvasModel.data?.latestPrediction) ||
            extractText(canvasModel.result);
        }
      } catch (_) {}
    }

    if (!responseText) {
      throw new Error('Model Weavy AI tidak mengembalikan output teks yang valid.');
    }

    return {
      success: true,
      text: responseText,
      remainingCredits,
    };
  }

  public async executeWeavyChatFromExtension(options: ExtensionOwnedChatOptions): Promise<{
    success: boolean;
    text?: string;
    provider?: string;
    model?: string;
    taskType?: string;
    metadata?: Record<string, any>;
    remainingCredits?: number;
    error?: string;
  }> {
    const connected = await this.waitForConnection(4000);
    if (!connected) {
      return { success: false, error: 'Ekstensi Weavy belum terhubung.' };
    }

    return this.postBridgeTask('AMB_EXECUTE_WEAVY_CHAT', options, 180000);
  }
}

export const extensionBridge = new ExtensionBridgeManager();
