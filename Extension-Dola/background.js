// Background Service Worker untuk Dola Downloader Extension
// Mengelola Side Panel, Download Manager, dan Komunikasi Tab

// Aktifkan Side Panel saat icon ekstensi diklik
chrome.runtime.onInstalled.addListener(() => {
  console.log("[Dola Downloader] Extension installed");
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
      .catch((err) => console.error("Error setting side panel behavior:", err));
  }
});

// Listener pesan dari Content Script atau Side Panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "DOWNLOAD_VIDEO") {
    const { url, filename } = message.payload;
    if (!url) {
      sendResponse({ success: false, error: "URL tidak ditemukan" });
      return true;
    }

    const downloadUrl = url.replace(/^http:\/\//i, "https://");
    const cleanFilename = (filename || `Dola_Video_${Date.now()}.mp4`)
      .replace(/[\\/:*?"<>|]/g, "_");

    chrome.downloads.download({
      url: downloadUrl,
      filename: `Dola_Downloads/${cleanFilename}`,
      conflictAction: "uniquify",
      saveAs: false
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error("Download error:", chrome.runtime.lastError.message);
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        console.log("Download started with ID:", downloadId);
        sendResponse({ success: true, downloadId });
      }
    });

    return true; // Keep response channel open for async
  }

  if (message.type === "OPEN_SIDE_PANEL") {
    if (sender.tab && sender.tab.id && chrome.sidePanel && chrome.sidePanel.open) {
      chrome.sidePanel.open({ tabId: sender.tab.id })
        .then(() => sendResponse({ success: true }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    }
  }

  return false;
});
