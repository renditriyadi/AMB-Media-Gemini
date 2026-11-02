// sidepanel.js - Mengontrol logika tampilan split-screen Side Panel

let allVideos = [];

// Elemen DOM
const videoListContainer = document.getElementById("video-list");
const emptyState = document.getElementById("empty-state");
const videoCountBadge = document.getElementById("video-count-badge");
const searchInput = document.getElementById("search-input");
const btnScan = document.getElementById("btn-scan");
const btnClear = document.getElementById("btn-clear");
const btnOpenDola = document.getElementById("btn-open-dola");
const tabStatusText = document.getElementById("tab-status-text");
const toast = document.getElementById("toast");

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
  }, 2500);
}

// Format waktu relatif atau tanggal
function formatTimestamp(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Render daftar video ke dalam panel
function renderVideos(videosToRender) {
  videoListContainer.innerHTML = "";

  if (!videosToRender || videosToRender.length === 0) {
    emptyState.style.display = "flex";
    videoCountBadge.textContent = "0";
    return;
  }

  emptyState.style.display = "none";
  videoCountBadge.textContent = videosToRender.length.toString();

  videosToRender.forEach((vid, index) => {
    const card = document.createElement("div");
    card.className = "video-card";
    card.id = `video-card-${vid.id || index}`;

    // Pastikan URL video menggunakan HTTPS
    let cleanUrl = (vid.videoUrl || "").replace(/^http:\/\//i, "https://");
    const isClean = vid.isCleanCdn === true;

    const shortId = vid.id ? vid.id.slice(0, 16) : `Video #${index + 1}`;
    const filename = `Dola_${vid.id || Date.now()}_clean_no_watermark.mp4`;

    card.innerHTML = `
      <div class="video-preview-wrapper">
        ${cleanUrl ? `
          <video controls preload="metadata" poster="${vid.coverUrl || ''}">
            <source src="${cleanUrl}" type="video/mp4">
          </video>
        ` : `
          <img src="${vid.coverUrl || ''}" alt="Video Cover" />
        `}
        <div class="badge-overlay-quality ${isClean ? 'clean' : 'pending'}">
          ${isClean ? '✨ 1080p Master (Tanpa Watermark)' : '⚡ Belum Disinkron (Klik Scan)'}
        </div>
        <div class="badge-overlay-duration">${vid.duration || '15s'}</div>
      </div>
      <div class="video-card-body">
        <div class="video-meta-title" title="${vid.prompt || shortId}">
          ${vid.prompt && vid.prompt !== "Detected from active video player" ? vid.prompt : `Prompt Video Dola (${shortId})`}
        </div>
        <div class="video-meta-info">
          <span>📐 ${vid.resolution || '1080p HD'}</span>
          <span>⏱️ ${vid.duration || '15s'}</span>
          <span>🕒 ${formatTimestamp(vid.timestamp)}</span>
        </div>
        <div class="video-actions">
          <button class="btn-primary btn-dl-video" data-url="${cleanUrl}" data-filename="${filename}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            ${isClean ? 'Download Clean (MP4)' : 'Download (MP4)'}
          </button>
          <button class="btn-secondary btn-copy-url" data-url="${cleanUrl}" title="Salin URL CDN Langsung">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          </button>
          <button class="btn-secondary btn-open-tab" data-url="${cleanUrl}" title="Buka Link CDN di Tab Baru">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
          </button>
        </div>
      </div>
    `;

    // Event Listener Download
    const dlBtn = card.querySelector(".btn-dl-video");
    dlBtn.addEventListener("click", () => {
      const url = dlBtn.getAttribute("data-url");
      const name = dlBtn.getAttribute("data-filename");
      if (!url) {
        showToast("URL video belum tersedia, silakan klik Scan");
        return;
      }
      showToast("Sedang memulai pengunduhan video...");
      chrome.runtime.sendMessage({
        type: "DOWNLOAD_VIDEO",
        payload: { url, filename: name }
      }, (resp) => {
        if (resp && resp.success) {
          showToast("✓ Unduhan berhasil disimpan di folder Downloads/Dola_Downloads!");
        } else {
          // Fallback buka tab baru
          chrome.tabs.create({ url });
        }
      });
    });

    // Event Listener Copy URL
    const copyBtn = card.querySelector(".btn-copy-url");
    copyBtn.addEventListener("click", () => {
      const url = copyBtn.getAttribute("data-url");
      if (url) {
        navigator.clipboard.writeText(url).then(() => {
          showToast("✓ Link CDN master berhasil disalin!");
        }).catch(() => {
          showToast("Gagal menyalin link");
        });
      }
    });

    // Event Listener Open in Tab
    const openBtn = card.querySelector(".btn-open-tab");
    openBtn.addEventListener("click", () => {
      const url = openBtn.getAttribute("data-url");
      if (url) {
        chrome.tabs.create({ url });
      }
    });

    videoListContainer.appendChild(card);
  });
}

// Muat data dari storage
function loadSavedVideos() {
  chrome.storage.local.get(["dola_saved_videos"], (res) => {
    if (res.dola_saved_videos && Array.isArray(res.dola_saved_videos)) {
      // Prioritaskan video yang isCleanCdn
      allVideos = res.dola_saved_videos.sort((a, b) => {
        if (a.isCleanCdn && !b.isCleanCdn) return -1;
        if (!a.isCleanCdn && b.isCleanCdn) return 1;
        return (b.timestamp || 0) - (a.timestamp || 0);
      });
      renderVideos(allVideos);
    } else {
      renderVideos([]);
    }
  });
}

// Cek koneksi tab aktif
function checkActiveTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];
    if (activeTab && activeTab.url && activeTab.url.includes("dola.com")) {
      tabStatusText.textContent = "Tab Dola Terhubung";
      tabStatusText.style.color = "#10b981";
    } else {
      tabStatusText.textContent = "Buka dola.com di tab utama";
      tabStatusText.style.color = "#94a3b8";
    }
  });
}

// Dengar pesan dari content script
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "NEW_VIDEO_DETECTED") {
    loadSavedVideos();
    showToast("🎉 Video CDN tanpa watermark terdeteksi!");
  }
});

// Fitur Filter / Search
searchInput.addEventListener("input", (e) => {
  const query = e.target.value.toLowerCase().trim();
  if (!query) {
    renderVideos(allVideos);
    return;
  }
  const filtered = allVideos.filter(v => 
    (v.id && v.id.toLowerCase().includes(query)) ||
    (v.prompt && v.prompt.toLowerCase().includes(query)) ||
    (v.resolution && v.resolution.toLowerCase().includes(query))
  );
  renderVideos(filtered);
});

// Tombol Scan & Sinkronisasi API
btnScan.addEventListener("click", () => {
  triggerSync();
});

function triggerSync() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];
    if (activeTab && activeTab.id) {
      btnScan.classList.add("loading");
      btnScan.innerHTML = `<span>⏳ Syncing...</span>`;
      chrome.tabs.sendMessage(activeTab.id, { type: "SYNC_DOLA_API" }, (res) => {
        setTimeout(() => {
          btnScan.classList.remove("loading");
          btnScan.innerHTML = `
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 4 23 10 17 10"></polyline>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
            </svg> Scan
          `;
          if (chrome.runtime.lastError) {
            showToast("Buka atau refresh tab dola.com di sebelah kiri");
          } else {
            loadSavedVideos();
            showToast(`✓ Berhasil sync video tanpa watermark!`);
          }
        }, 1200);
      });
    } else {
      showToast("Buka tab dola.com terlebih dahulu");
    }
  });
}

// Tombol Hapus Riwayat
btnClear.addEventListener("click", () => {
  if (confirm("Hapus semua daftar video dari panel ini?")) {
    chrome.storage.local.set({ dola_saved_videos: [] }, () => {
      allVideos = [];
      renderVideos([]);
      showToast("Riwayat dibersihkan");
    });
  }
});

// Tombol Buka Dola
btnOpenDola.addEventListener("click", () => {
  chrome.tabs.create({ url: "https://www.dola.com/chat/" });
});

// Inisialisasi awal
document.addEventListener("DOMContentLoaded", () => {
  loadSavedVideos();
  checkActiveTab();
  setInterval(checkActiveTab, 3000);
  // Auto-sync saat panel dibuka
  setTimeout(triggerSync, 500);
});
