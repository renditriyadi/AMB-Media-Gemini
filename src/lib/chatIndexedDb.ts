import { ChatSession } from '../types';

const DB_NAME = 'AmbMediaStudioChatDB';
const DB_VERSION = 1;
const STORE_NAME = 'chat_sessions';

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
        console.warn('IndexedDB open error for chat sessions:', err);
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
 * Retrieves all chat sessions from IndexedDB.
 */
export async function getAllChatSessionsFromIDB(): Promise<ChatSession[] | null> {
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
            // Sort by updatedAt descending (newest first)
            result.sort((a, b) => {
              const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
              const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
              return timeB - timeA;
            });
            resolve(result);
          } else {
            resolve(null);
          }
        };

        req.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  } catch (e) {
    return null;
  }
}

/**
 * Saves all chat sessions into IndexedDB.
 */
export async function saveChatSessionsToIDB(sessions: ChatSession[]): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);

        // Clear and rewrite current sessions
        store.clear();
        for (const session of sessions) {
          store.put(session);
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
 * Saves or updates a single chat session in IndexedDB.
 */
export async function saveSingleChatSessionToIDB(session: ChatSession): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put(session);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch (e) {
        resolve();
      }
    });
  } catch (e) {}
}

/**
 * Deletes a single chat session from IndexedDB.
 */
export async function deleteChatSessionFromIDB(sessionId: string): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.delete(sessionId);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch (e) {
        resolve();
      }
    });
  } catch (e) {}
}
