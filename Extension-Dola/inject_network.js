// inject_network.js - Berjalan di konteks halaman (MAIN world)
// Mencegat fetch & XMLHttpRequest untuk menangkap payload video Dola & link CDN tanpa watermark secara real-time
// Serta menyediakan sinkronisasi aktif langsung ke API internal Dola

(function() {
  if (window.__DOLA_SNIFFER_INITIALIZED__) return;
  window.__DOLA_SNIFFER_INITIALIZED__ = true;

  console.log("%c[Dola Sniffer]%c Network Interceptor & API Synchronizer Aktif!", "color:#10b981;font-weight:bold;", "color:#6b7280;");

  function safeAtob(str) {
    try {
      return atob(str);
    } catch (e) {
      return str;
    }
  }

  function toHttps(url) {
    if (!url) return "";
    return url.replace(/^http:\/\//i, "https://");
  }

  // Fungsi untuk ekstrak data video dari objek creation
  function extractVideoFromCreation(creation, promptContext = "") {
    if (!creation || creation.type !== 2) return null; // type 2 = video
    const vidObj = creation.video || {};
    const vidId = vidObj.vid || creation.id || "";
    
    let unwatermarkedUrl = "";
    let definition = "1080p";
    let coverUrl = toHttps(vidObj.cover?.image_preview?.url || vidObj.cover?.image_thumb?.url || "");
    let duration = vidObj.duration || 0;
    let width = vidObj.width || 720;
    let height = vidObj.height || 1280;
    let backupUrls = [];
    let isCleanCdn = false;
    let fallbackApi = "";

    // 1. Ekstrak dari video_model (yang memuat URL resolusi tinggi 1080p ASLI TANPA WATERMARK)
    if (vidObj.video_model) {
      try {
        let modelData = typeof vidObj.video_model === "string" ? JSON.parse(vidObj.video_model) : vidObj.video_model;
        if (modelData && modelData.video_list) {
          const list = modelData.video_list;
          // Cari item resolusi tertinggi / video_1
          const keys = Object.keys(list);
          const bestKey = keys.sort((a, b) => (list[b].vheight || 0) - (list[a].vheight || 0))[0] || "video_1";
          const bestItem = list[bestKey];

          if (bestItem) {
            definition = bestItem.definition || "1080p";
            if (bestItem.vwidth && bestItem.vheight) {
              width = bestItem.vwidth;
              height = bestItem.vheight;
            }
            if (bestItem.main_url) {
              unwatermarkedUrl = toHttps(safeAtob(bestItem.main_url));
              isCleanCdn = true;
            }
            if (bestItem.backup_url_1) {
              const bUrl = toHttps(safeAtob(bestItem.backup_url_1));
              backupUrls.push(bUrl);
            }
          }
        }
        if (modelData.fallback_api) {
          fallbackApi = toHttps(modelData.fallback_api);
        }
      } catch (err) {
        console.warn("[Dola Sniffer] Gagal parse video_model:", err);
      }
    }

    // 2. Jika belum dapat clean URL tapi ada fallback_api
    if (!unwatermarkedUrl && fallbackApi) {
      unwatermarkedUrl = fallbackApi;
      isCleanCdn = true;
    }

    // 3. Fallback terakhir: jika video_model belum siap (masih rendering)
    let watermarkedFallback = "";
    if (vidObj.download_url) {
      watermarkedFallback = toHttps(vidObj.download_url);
    }

    const finalVideoUrl = unwatermarkedUrl || watermarkedFallback;
    if (!finalVideoUrl && !coverUrl) return null;

    return {
      id: vidId,
      creationId: creation.id,
      duration: duration ? Math.round(duration) + "s" : "N/A",
      resolution: `${width}x${height} (${definition})`,
      coverUrl,
      videoUrl: finalVideoUrl,
      backupUrls,
      fallbackApi,
      isCleanCdn: isCleanCdn, // true = verified zero watermark
      prompt: promptContext || "Dola Generated Video",
      timestamp: Date.now()
    };
  }

  // Analisis struktur data respons Dola
  function parseResponsePayload(dataStr, requestUrl) {
    if (!dataStr) return;

    // A. Format SSE Stream (/chat/completion)
    if (dataStr.includes("event:") || dataStr.includes("data:")) {
      const lines = dataStr.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const json = JSON.parse(line.slice(6).trim());
            handleMessageBlocks(json);
          } catch (e) {}
        }
      }
    } else {
      // B. Format JSON Biasa (/recent_conv dsb)
      try {
        const json = JSON.parse(dataStr);
        handleMessageBlocks(json);
      } catch (e) {}
    }
  }

  function handleMessageBlocks(obj) {
    if (!obj) return;

    // 1. Dari downlink_body recent_conv
    const cells = obj.downlink_body?.pull_recent_conv_chain_downlink_body?.cells;
    if (Array.isArray(cells)) {
      cells.forEach(c => {
        const messages = c.conversation?.messages || [];
        // Cari prompt user terbaru dalam percakapan ini
        let convPrompt = "";
        for (let i = messages.length - 1; i >= 0; i--) {
          const m = messages[i];
          const text = extractTextFromMessage(m);
          if (text && !text.toLowerCase().includes("videomu sudah siap")) {
            convPrompt = text;
            break;
          }
        }

        messages.forEach(m => {
          processMessage(m, convPrompt);
        });
      });
      return;
    }

    // 2. Dari direct messages array
    if (Array.isArray(obj.messages)) {
      obj.messages.forEach(m => processMessage(m));
      return;
    }

    // 3. Dari payload SSE completion (patch_content dsb)
    if (obj.message_block || obj.content_block) {
      processBlock(obj.message_block || obj.content_block, "");
    }
  }

  function extractTextFromMessage(m) {
    if (!m) return "";
    let content = m.content;
    if (typeof content === "string") {
      try {
        content = JSON.parse(content);
      } catch (e) {
        return content;
      }
    }
    if (Array.isArray(content)) {
      for (const block of content) {
        if (block.content?.text_block?.text) return block.content.text_block.text;
        if (block.text) return block.text;
      }
    } else if (content && typeof content === "object") {
      if (content.text_block?.text) return content.text_block.text;
    }
    return "";
  }

  function processMessage(m, fallbackPrompt = "") {
    let content = m.content;
    if (typeof content === "string") {
      try {
        content = JSON.parse(content);
      } catch (e) {}
    }

    const msgPrompt = extractTextFromMessage(m) || fallbackPrompt;

    if (Array.isArray(content)) {
      content.forEach(b => processBlock(b, msgPrompt));
    } else if (content && typeof content === "object") {
      processBlock(content, msgPrompt);
    }
  }

  function processBlock(block, promptContext) {
    if (!block) return;
    // block_type 2074 = creation_block
    const creationBlock = block.content?.creation_block || (block.block_type === 2074 ? block.content : null);
    if (creationBlock && Array.isArray(creationBlock.creations)) {
      creationBlock.creations.forEach(cr => {
        const videoData = extractVideoFromCreation(cr, promptContext);
        if (videoData) {
          dispatchVideoFound(videoData);
        }
      });
    }
  }

  function dispatchVideoFound(videoData) {
    // Kirim event ke content script
    window.dispatchEvent(new CustomEvent("DOLA_VIDEO_FOUND_EVENT", {
      detail: videoData
    }));
  }

  // --- SINKRONISASI AKTIF DENGAN API DOLA (/im/chain/recent_conv) ---
  // Mengambil daftar percakapan terbaru & mengekstrak URL CDN master 1080p tanpa watermark
  async function syncDolaConversations() {
    console.log("[Dola Sniffer] Mengambil data video unwatermarked langsung dari API Dola...");
    try {
      const resp = await fetch("/im/chain/recent_conv?version_code=20800&language=en&device_platform=web&aid=495671&real_aid=495671", {
        method: "POST",
        headers: {
          "accept": "application/json, text/plain, */*",
          "agw-js-conv": "str",
          "content-type": "application/json; encoding=utf-8"
        },
        credentials: "include",
        body: JSON.stringify({
          cmd: 3200,
          uplink_body: {
            pull_recent_conv_chain_uplink_body: {
              limit: 20,
              message_count_per_conv: 30,
              api_version: 1,
              conv_version: 0,
              direction: 3,
              option: {
                not_need_message: false,
                need_complete_conversation: true,
                need_coco_bot: true,
                need_pc_pin_chain: true,
                pc_pin_query_type: 0,
                exclude_archive: true,
                only_archive: false
              }
            }
          },
          sequence_id: "ext-sync-" + Date.now(),
          channel: 2,
          version: "1"
        })
      });

      if (resp.ok) {
        const data = await resp.json();
        handleMessageBlocks(data);
        console.log("%c[Dola Sniffer]%c Sinkronisasi API berhasil!", "color:#10b981;font-weight:bold;", "color:#6b7280;");
        window.dispatchEvent(new CustomEvent("DOLA_SYNC_COMPLETED", { detail: { success: true } }));
      } else {
        console.warn("[Dola Sniffer] Respon API non-200:", resp.status);
      }
    } catch (err) {
      console.warn("[Dola Sniffer] Error sinkronisasi API:", err);
    }
  }

  // Dengar event permintaan sinkronisasi dari Content Script / Side Panel
  window.addEventListener("DOLA_TRIGGER_SYNC", () => {
    syncDolaConversations();
  });

  // Auto-sync 1.5 detik setelah halaman dimuat
  setTimeout(syncDolaConversations, 1500);

  // --- INTERCEPT FETCH ---
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const response = await originalFetch.apply(this, args);
    const url = typeof args[0] === "string" ? args[0] : (args[0]?.url || "");

    if (url.includes("/chat/completion") || url.includes("/im/chain/recent_conv") || url.includes("/samantha/chat/")) {
      try {
        const clone = response.clone();
        clone.text().then(text => {
          parseResponsePayload(text, url);
          // Jika ini adalah generate baru, trigger sync 2 detik kemudian untuk dapat video_model final
          if (url.includes("/chat/completion")) {
            setTimeout(syncDolaConversations, 2500);
          }
        }).catch(() => {});
      } catch (e) {}
    }
    return response;
  };

  // --- INTERCEPT XHR ---
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url) {
    this.__reqUrl = url;
    return originalOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function() {
    this.addEventListener("load", () => {
      if (this.__reqUrl && (this.__reqUrl.includes("/chat/completion") || this.__reqUrl.includes("/im/chain/recent_conv") || this.__reqUrl.includes("/samantha/chat/"))) {
        try {
          parseResponsePayload(this.responseText, this.__reqUrl);
          if (this.__reqUrl.includes("/chat/completion")) {
            setTimeout(syncDolaConversations, 2500);
          }
        } catch (e) {}
      }
    });
    return originalSend.apply(this, arguments);
  };

})();
