// Shared storage service for the side panel modules.
export const storage = {
  async get(key) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return new Promise((resolve) => {
        chrome.storage.local.get([key], (result) => resolve(result[key]));
      });
    }

    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      return null;
    }
  },

  async set(key, value) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return new Promise((resolve) => {
        chrome.storage.local.set({ [key]: value }, () => {
          const error = chrome.runtime?.lastError;
          if (error) {
            console.warn(`[Storage] Failed to save ${key}: ${error.message}`);
          }
          resolve(!error);
        });
      });
    }

    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      // Storage failures should not prevent the panel from opening.
    }
  },

  async remove(key) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return new Promise((resolve) => {
        chrome.storage.local.remove([key], resolve);
      });
    }

    try {
      localStorage.removeItem(key);
    } catch (error) {
      // Storage failures should not prevent the panel from opening.
    }
  },
};
