// content.js - Berjalan di konteks ekstensi (ISOLATED world) pada https://www.dola.com/*
// Menghubungkan DOM, Network Interceptor, dan Side Panel Ekstensi

const detectedVideos = new Map();

// Muat cache video yang sudah disimpan sebelumnya
chrome.storage.local.get(["dola_saved_videos"], (res) => {
  if (res.dola_saved_videos && Array.isArray(res.dola_saved_videos)) {
    res.dola_saved_videos.forEach(v => detectedVideos.set(v.id, v));
  }
});

// Simpan ke storage local dan kabari Side Panel
function saveAndNotifyVideo(videoData) {
  if (!videoData || !videoData.id) return;

  const existing = detectedVideos.get(videoData.id);
  // Jika data baru memiliki isCleanCdn, prioritaskan
  const merged = { ...existing, ...videoData };
  if (videoData.isCleanCdn) {
    merged.isCleanCdn = true;
    merged.videoUrl = videoData.videoUrl;
  }

  detectedVideos.set(videoData.id, merged);

  const allVideos = Array.from(detectedVideos.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  chrome.storage.local.set({ dola_saved_videos: allVideos });

  // Kirim ke runtime (Side Panel)
  chrome.runtime.sendMessage({
    type: "NEW_VIDEO_DETECTED",
    payload: merged,
    allVideos: allVideos
  }).catch(() => {
    // Side Panel belum dibuka, ini normal
  });

  // Perbarui atau pasang tombol download langsung di atas video
  injectDownloadButtonsOnDOM();
}

// 1. Dengar event dari inject_network.js (MAIN world)
window.addEventListener("DOLA_VIDEO_FOUND_EVENT", (e) => {
  if (e.detail) {
    console.log("[Dola ContentScript] Video clean tertangkap dari API:", e.detail);
    saveAndNotifyVideo(e.detail);
  }
});

window.addEventListener("DOLA_SYNC_COMPLETED", () => {
  console.log("[Dola ContentScript] Sinkronisasi API selesai.");
  injectDownloadButtonsOnDOM();
});

// 2. Scan elemen video di halaman DOM secara berkala
function scanDomForVideos() {
  const videoElements = document.querySelectorAll("video");
  if (videoElements.length === 0) return;

  // Cek apakah kita sudah punya video dengan isCleanCdn
  const hasCleanVideos = Array.from(detectedVideos.values()).some(v => v.isCleanCdn);

  // Jika ada video di layar tapi belum ada clean video di storage, minta sync API sekarang
  if (!hasCleanVideos) {
    window.dispatchEvent(new CustomEvent("DOLA_TRIGGER_SYNC"));
  }

  videoElements.forEach((vidEl, idx) => {
    const src = vidEl.src || vidEl.currentSrc;
    const poster = vidEl.poster || "";

    // Cari prompt dari teks container terdekat
    let promptTitle = "Video AI Dola";
    const container = vidEl.closest("div") || vidEl.parentElement;
    if (container) {
      const parentCard = container.closest("[class*='message'], [class*='chat'], [class*='card']") || container.parentElement;
      if (parentCard) {
        const textNodes = parentCard.querySelectorAll("p, span, div, h3, h4");
        for (const el of textNodes) {
          const t = el.textContent?.trim() || "";
          if (t && t.length > 5 && !t.includes("Videomu sudah siap") && !t.includes("Download")) {
            promptTitle = t.slice(0, 100);
            break;
          }
        }
      }
    }

    // Coba cocokkan dengan video clean yang sudah ditangkap
    let matchedClean = null;
    for (const v of detectedVideos.values()) {
      if (v.isCleanCdn && (poster.includes(v.id) || (v.coverUrl && poster.includes(v.coverUrl.slice(0, 30))))) {
        matchedClean = v;
        break;
      }
    }

    // Jika belum cocok dan hanya ada 1 video clean di storage, gunakan itu
    if (!matchedClean && hasCleanVideos) {
      const cleanList = Array.from(detectedVideos.values()).filter(v => v.isCleanCdn);
      if (cleanList.length === 1) {
        matchedClean = cleanList[0];
      }
    }

    if (matchedClean) {
      // Perbarui prompt jika sebelumnya generic
      if (matchedClean.prompt === "Dola Generated Video" && promptTitle !== "Video AI Dola") {
        matchedClean.prompt = promptTitle;
        saveAndNotifyVideo(matchedClean);
      }
    }
  });
}

// 3. Pasang Tombol "Download No Watermark (1080p)" di atas kartu video di Dola
function injectDownloadButtonsOnDOM() {
  const videoElements = document.querySelectorAll("video");
  videoElements.forEach((video) => {
    const container = video.closest("div") || video.parentElement;
    if (!container) return;

    let overlayBtn = container.querySelector(".dola-dl-btn-overlay");
    if (!overlayBtn) {
      container.style.position = "relative";
      overlayBtn = document.createElement("button");
      overlayBtn.className = "dola-dl-btn-overlay";
      container.appendChild(overlayBtn);
    }

    overlayBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
      </svg>
      <span>Download No Watermark (1080p)</span>
    `;

    // Pasang listener sekali saja
    if (!overlayBtn.__hasClickListener) {
      overlayBtn.__hasClickListener = true;
      overlayBtn.addEventListener("click", async (evt) => {
        evt.preventDefault();
        evt.stopPropagation();

        overlayBtn.innerHTML = `<span>⏳ Mengambil Link Tanpa Watermark...</span>`;

        // 1. Cari video dengan isCleanCdn
        let targetVideo = null;
        const poster = video.poster || "";
        const cleanList = Array.from(detectedVideos.values()).filter(v => v.isCleanCdn);

        // Cari berdasarkan poster image key
        if (poster) {
          targetVideo = cleanList.find(v => v.coverUrl && poster.includes(v.coverUrl.slice(0, 30)));
        }

        // Jika tidak ketemu berdasarkan poster, ambil yang paling baru
        if (!targetVideo && cleanList.length > 0) {
          targetVideo = cleanList[0];
        }

        // 2. Jika belum ada di cache, picu sinkronisasi API dan tunggu sejenak
        if (!targetVideo) {
          window.dispatchEvent(new CustomEvent("DOLA_TRIGGER_SYNC"));
          await new Promise(r => setTimeout(r, 1200));
          const updatedCleanList = Array.from(detectedVideos.values()).filter(v => v.isCleanCdn);
          if (updatedCleanList.length > 0) {
            targetVideo = updatedCleanList[0];
          }
        }

        if (targetVideo && targetVideo.videoUrl) {
          const dlUrl = targetVideo.videoUrl.replace(/^http:\/\//i, "https://");
          chrome.runtime.sendMessage({
            type: "DOWNLOAD_VIDEO",
            payload: {
              url: dlUrl,
              filename: `Dola_NoWatermark_${targetVideo.id || Date.now()}.mp4`
            }
          }, (res) => {
            if (res && res.success) {
              overlayBtn.innerHTML = `<span>✓ Unduhan Dimulai!</span>`;
            } else {
              overlayBtn.innerHTML = `<span>⚠️ Mengunduh via Tab...</span>`;
              window.open(dlUrl, "_blank");
            }
            setTimeout(() => {
              overlayBtn.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                <span>Download No Watermark (1080p)</span>
              `;
            }, 2500);
          });
        } else {
          overlayBtn.innerHTML = `<span>⚠️ Buka Panel Samping untuk Sync</span>`;
          // Buka side panel
          chrome.runtime.sendMessage({ type: "OPEN_SIDE_PANEL" }).catch(() => {});
          setTimeout(() => {
            overlayBtn.innerHTML = `<span>Download No Watermark (1080p)</span>`;
          }, 3000);
        }
      });
    }
  });
}

// 4. Tombol Melayang Cepat untuk Buka Side Panel
function injectFloatingLauncher() {
  if (document.getElementById("dola-extension-launcher")) return;

  const btn = document.createElement("div");
  btn.id = "dola-extension-launcher";
  btn.title = "Buka Dola Downloader Split Screen Panel";
  btn.innerHTML = `
    <div class="dola-launcher-inner">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="15" y1="3" x2="15" y2="21"></line>
        <polyline points="9 10 12 13 9 16"></polyline>
      </svg>
      <span>Panel Download</span>
    </div>
  `;

  btn.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "OPEN_SIDE_PANEL" }, (resp) => {
      if (!resp || !resp.success) {
        window.dispatchEvent(new CustomEvent("DOLA_TRIGGER_SYNC"));
      }
    });
  });

  document.body.appendChild(btn);
}

// Inisialisasi pengamatan DOM
const observer = new MutationObserver(() => {
  scanDomForVideos();
  injectDownloadButtonsOnDOM();
});

if (document.body) {
  observer.observe(document.body, { childList: true, subtree: true });
  injectFloatingLauncher();
  scanDomForVideos();
  injectDownloadButtonsOnDOM();
} else {
  window.addEventListener("DOMContentLoaded", () => {
    observer.observe(document.body, { childList: true, subtree: true });
    injectFloatingLauncher();
    scanDomForVideos();
    injectDownloadButtonsOnDOM();
  });
}

// 5. Pesan dari Side Panel (Trigger scan / sync)
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "TRIGGER_DOM_SCAN" || msg.type === "SYNC_DOLA_API") {
    // Picu sinkronisasi API dari MAIN world
    window.dispatchEvent(new CustomEvent("DOLA_TRIGGER_SYNC"));
    scanDomForVideos();
    injectDownloadButtonsOnDOM();
    sendResponse({
      status: "scanning_and_syncing",
      count: detectedVideos.size
    });
    return true;
  }
});
