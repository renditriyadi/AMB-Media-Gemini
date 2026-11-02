import { CanvasFile } from '../types/canvas';

const DB_NAME = 'AmbMediaStudioCanvasDB';
const DB_VERSION = 1;
const STORE_NAME = 'canvas_files';

let dbPromise: Promise<IDBDatabase | null> | null = null;

function getDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }

  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = (err) => {
        console.warn('IndexedDB open error for canvas files:', err);
        resolve(null);
      };
    } catch (e) {
      console.warn('IndexedDB not supported or accessible:', e);
      resolve(null);
    }
  });

  return dbPromise;
}

/**
 * Retrieves all canvas files from IndexedDB.
 */
export async function getAllCanvasFilesFromIDB(): Promise<CanvasFile[] | null> {
  try {
    const db = await getDb();
    if (!db) return null;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();

        req.onsuccess = () => {
          const result = req.result;
          if (Array.isArray(result) && result.length > 0) {
            resolve(result);
          } else {
            resolve(null);
          }
        };

        req.onerror = () => {
          resolve(null);
        };
      } catch (e) {
        resolve(null);
      }
    });
  } catch (e) {
    return null;
  }
}

/**
 * Saves all canvas files into IndexedDB.
 */
export async function saveCanvasFilesToIDB(files: CanvasFile[]): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);

        // Clear and rewrite current files
        store.clear();
        for (const file of files) {
          store.put(file);
        }

        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
        tx.onabort = () => resolve();
      } catch (e) {
        resolve();
      }
    });
  } catch (e) {
    // Ignore IDB write failures silently
  }
}

/**
 * Saves or updates a single canvas file in IndexedDB.
 */
export async function saveSingleCanvasFileToIDB(file: CanvasFile): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put(file);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch (e) {
        resolve();
      }
    });
  } catch (e) {}
}

/**
 * Deletes a single canvas file from IndexedDB.
 */
export async function deleteCanvasFileFromIDB(fileId: string): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.delete(fileId);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch (e) {
        resolve();
      }
    });
  } catch (e) {}
}
