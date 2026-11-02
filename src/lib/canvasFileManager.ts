import { CanvasFile, CanvasRecipe } from '../types/canvas';
import { createEmptyCanvasRecipe } from './canvasRecipes';
import {
  getAllCanvasFilesFromIDB,
  saveCanvasFilesToIDB,
} from './canvasIndexedDb';

const FILES_STORAGE_KEY = 'amb_media_canvas_files';
const LEGACY_RECIPE_KEY = 'amb_media_canvas_recipe';

// In-memory cache to guarantee synchronous, blazing-fast access with full fidelity
let _inMemoryFilesCache: CanvasFile[] | null = null;
let _hasInitializedIDB = false;

/**
 * Checks if a recipe is one of the hardcoded default demo presets.
 */
export function isDefaultPresetRecipe(recipe?: CanvasRecipe): boolean {
  if (!recipe) return false;
  const promptTexts = (recipe.nodes || [])
    .map((n) => n.data?.prompt || '')
    .join(' ');
  const defaultPrompts = [
    'a majestic cyberpunk samurai tiger',
    'transform this woman into a fantasy goddess',
    'cinematic close up of a retro futuristic robot barista',
  ];
  if (defaultPrompts.some((dp) => promptTexts.includes(dp))) {
    return true;
  }
  if (
    recipe.name === 'Nano Banana Pro Pipeline' ||
    recipe.name === 'ByteDance Seedream Edit' ||
    recipe.name === 'Grok Imagine Pipeline' ||
    recipe.description === 'Pipeline generasi gambar photorealistic Google Gemini 3 dengan prompt teks'
  ) {
    return true;
  }
  return false;
}

/**
 * Sanitizes files for localStorage by removing large base64 data URLs.
 * High-resolution base64 media is persisted safely in IndexedDB, preventing
 * localStorage QuotaExceededError while preserving full metadata in localStorage.
 */
function sanitizeFilesForLocalStorage(files: CanvasFile[], ultraLean = false): CanvasFile[] {
  return files.map((file) => {
    if (!file.recipe || !file.recipe.nodes) return file;

    const sanitizedNodes = file.recipe.nodes.map((node) => {
      if (!node.data) return node;
      const data = { ...node.data };

      // Strip large data URLs (> 1024 chars) or all data URLs if ultraLean
      if (typeof data.imageUrl === 'string' && (ultraLean || data.imageUrl.startsWith('data:image/') && data.imageUrl.length > 1024)) {
        data.imageUrl = '';
      }
      if (typeof data.outputImage === 'string' && (ultraLean || data.outputImage.startsWith('data:image/') && data.outputImage.length > 1024)) {
        data.outputImage = '';
      }
      if (typeof data.resultUrl === 'string' && (ultraLean || data.resultUrl.startsWith('data:image/') && data.resultUrl.length > 1024)) {
        data.resultUrl = '';
      }
      if (typeof data.inputImageUrl === 'string' && (ultraLean || data.inputImageUrl.startsWith('data:image/') && data.inputImageUrl.length > 1024)) {
        data.inputImageUrl = '';
      }
      if (typeof data.coverUrl === 'string' && (ultraLean || data.coverUrl.startsWith('data:image/') && data.coverUrl.length > 1024)) {
        data.coverUrl = '';
      }

      return {
        ...node,
        data,
      };
    });

    return {
      ...file,
      recipe: {
        ...file.recipe,
        nodes: sanitizedNodes,
      },
    };
  });
}

/**
 * Loads all canvas files.
 * Uses in-memory cache if available, falling back to localStorage,
 * while asynchronously hydrating the full high-fidelity files from IndexedDB.
 */
export function loadAllCanvasFiles(): CanvasFile[] {
  if (_inMemoryFilesCache !== null) {
    return _inMemoryFilesCache;
  }

  let cleanedFiles: CanvasFile[] = [];

  try {
    const raw = localStorage.getItem(FILES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // 1. Filter out any auto-seeded default preset files
        let filtered = parsed.filter((f) => !isDefaultPresetRecipe(f.recipe));

        // 2. Filter out redundant empty 'untitled' duplicate files
        let hasKeptOneEmptyUntitled = false;
        filtered = filtered.filter((f) => {
          const isEmptyUntitled =
            (!f.name || f.name === 'untitled') &&
            (!f.recipe || !f.recipe.nodes || f.recipe.nodes.length === 0);

          if (isEmptyUntitled) {
            if (!hasKeptOneEmptyUntitled) {
              hasKeptOneEmptyUntitled = true;
              return true;
            }
            return false;
          }
          return true;
        });

        cleanedFiles = filtered;
      }
    }
  } catch (e) {
    console.warn('Could not parse localStorage canvas files:', e);
  }

  // Purge legacy storage completely so it never spawns duplicate files
  try {
    localStorage.removeItem(LEGACY_RECIPE_KEY);
  } catch (e) {}

  _inMemoryFilesCache = cleanedFiles;

  // Initialize IndexedDB sync in background
  if (!_hasInitializedIDB && typeof window !== 'undefined') {
    _hasInitializedIDB = true;
    getAllCanvasFilesFromIDB().then((idbFiles) => {
      if (idbFiles && Array.isArray(idbFiles) && idbFiles.length > 0) {
        // Filter and update in-memory cache with full fidelity
        let filteredIdb = idbFiles.filter((f) => !isDefaultPresetRecipe(f.recipe));
        _inMemoryFilesCache = filteredIdb;
        window.dispatchEvent(new CustomEvent('canvas-files-synced', { detail: filteredIdb }));
      } else if (cleanedFiles.length > 0) {
        // Migrate initial localStorage files into IndexedDB
        saveCanvasFilesToIDB(cleanedFiles).then(() => {
          // Keep localStorage lean now that IndexedDB has the master copy
          try {
            const lean = sanitizeFilesForLocalStorage(cleanedFiles);
            localStorage.setItem(FILES_STORAGE_KEY, JSON.stringify(lean));
          } catch (e) {}
        });
      }
    }).catch(() => {});
  }

  return cleanedFiles;
}

/**
 * Saves all canvas files.
 * Writes immediately to in-memory cache and IndexedDB,
 * and safely writes a lean/sanitized copy to localStorage without throwing quota errors.
 */
export function saveAllCanvasFiles(files: CanvasFile[]): void {
  // 1. Update in-memory cache immediately
  _inMemoryFilesCache = files;

  // 2. Persist full fidelity files (including any large base64 media) to IndexedDB
  if (typeof window !== 'undefined') {
    saveCanvasFilesToIDB(files).catch((err) => {
      console.warn('Failed to save canvas files to IndexedDB:', err);
    });
  }

  // 3. Persist lean copy to localStorage as fast synchronous fallback
  try {
    const lean = sanitizeFilesForLocalStorage(files);
    localStorage.setItem(FILES_STORAGE_KEY, JSON.stringify(lean));
  } catch (e) {
    // If quota exceeded, try ultraLean (strip all data URLs)
    try {
      const ultraLean = sanitizeFilesForLocalStorage(files, true);
      localStorage.setItem(FILES_STORAGE_KEY, JSON.stringify(ultraLean));
    } catch (fallbackErr) {
      // If still exceeding, clear corrupted or oversized keys gracefully
      console.warn('LocalStorage quota limit reached for canvas cache; persisted safely in IndexedDB.');
    }
  }
}

/**
 * Creates a brand new canvas file and appends it to storage.
 * If there is already an existing empty untitled file with 0 nodes, reuses it
 * instead of generating duplicate empty recipes.
 */
export function createNewCanvasFile(title = 'untitled', customRecipe?: CanvasRecipe): CanvasFile {
  const currentFiles = loadAllCanvasFiles();

  // If the user already has an unused empty untitled file (0 nodes, 0 edges),
  // reuse it instead of creating duplicate empty files!
  if (!customRecipe && (title === 'untitled' || !title)) {
    const existingEmpty = currentFiles.find(
      (f) =>
        !f.isTrash &&
        (!f.name || f.name === 'untitled') &&
        (!f.recipe || !f.recipe.nodes || f.recipe.nodes.length === 0)
    );
    if (existingEmpty) {
      return existingEmpty;
    }
  }

  const recipe = customRecipe || createEmptyCanvasRecipe(title);
  recipe.id = `recipe_${Date.now()}`;
  recipe.name = title;

  const newFile: CanvasFile = {
    id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: title,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    recipe,
  };

  const updatedList = [newFile, ...currentFiles];
  saveAllCanvasFiles(updatedList);
  return newFile;
}

/**
 * Deletes all empty canvas files (files with 0 nodes and name 'untitled').
 */
export function deleteAllEmptyCanvasFiles(): CanvasFile[] {
  const currentFiles = loadAllCanvasFiles();
  const retained = currentFiles.filter((f) => {
    const isEmpty = !f.recipe || !f.recipe.nodes || f.recipe.nodes.length === 0;
    return !isEmpty || (f.name && f.name !== 'untitled');
  });
  saveAllCanvasFiles(retained);
  return retained;
}

/**
 * Updates a canvas file by ID (e.g. recipe updates or rename).
 */
export function updateCanvasFile(
  id: string,
  updater: Partial<CanvasFile> | ((file: CanvasFile) => CanvasFile)
): CanvasFile | null {
  const currentFiles = loadAllCanvasFiles();
  const index = currentFiles.findIndex((f) => f.id === id);
  if (index === -1) return null;

  const existing = currentFiles[index];
  const updated: CanvasFile =
    typeof updater === 'function'
      ? updater(existing)
      : { ...existing, ...updater, updatedAt: Date.now() };

  currentFiles[index] = updated;
  saveAllCanvasFiles(currentFiles);
  return updated;
}

/**
 * Duplicates a canvas file.
 */
export function duplicateCanvasFile(id: string): CanvasFile | null {
  const currentFiles = loadAllCanvasFiles();
  const target = currentFiles.find((f) => f.id === id);
  if (!target) return null;

  const clonedRecipe: CanvasRecipe = JSON.parse(JSON.stringify(target.recipe));
  clonedRecipe.id = `recipe_${Date.now()}`;
  clonedRecipe.name = `${target.name} (Copy)`;

  const duplicate: CanvasFile = {
    id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: `${target.name} (Copy)`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    recipe: clonedRecipe,
  };

  const updatedList = [duplicate, ...currentFiles];
  saveAllCanvasFiles(updatedList);
  return duplicate;
}

/**
 * Deletes or trashes a canvas file.
 */
export function deleteCanvasFile(id: string, permanent = false): void {
  const currentFiles = loadAllCanvasFiles();
  if (permanent) {
    const filtered = currentFiles.filter((f) => f.id !== id);
    saveAllCanvasFiles(filtered);
  } else {
    // Mark as trash
    const updated = currentFiles.map((f) => (f.id === id ? { ...f, isTrash: true, updatedAt: Date.now() } : f));
    saveAllCanvasFiles(updated);
  }
}

/**
 * Restores a file from trash.
 */
export function restoreCanvasFile(id: string): void {
  const currentFiles = loadAllCanvasFiles();
  const updated = currentFiles.map((f) => (f.id === id ? { ...f, isTrash: false, updatedAt: Date.now() } : f));
  saveAllCanvasFiles(updated);
}

/**
 * Formats relative time nicely like Weavy:
 * "Last edited 60 seconds ago", "Last edited 15 minutes ago", "Last edited 29 days ago"
 */
export function formatLastEdited(timestamp: number): string {
  if (!timestamp) return 'Last edited recently';
  const elapsedMs = Math.max(0, Date.now() - timestamp);
  const seconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) {
    return `Last edited ${Math.max(1, seconds)} seconds ago`;
  }
  if (minutes < 60) {
    return `Last edited ${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  }
  if (hours < 24) {
    return `Last edited ${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  }
  return `Last edited ${days} ${days === 1 ? 'day' : 'days'} ago`;
}
