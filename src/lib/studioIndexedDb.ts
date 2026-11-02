import { StudioProject } from '../types/studio';

const DB_NAME = 'AMB_StudioDB';
const DB_VERSION = 1;
const STORE_PROJECTS = 'studio_projects';

function openStudioDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB tidak didukung pada browser ini.'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result as IDBDatabase;
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        const store = db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Gagal membuka IndexedDB Studio.'));
  });
}

export async function saveStudioProjectToDb(project: StudioProject): Promise<void> {
  try {
    const db = await openStudioDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_PROJECTS], 'readwrite');
      const store = tx.objectStore(STORE_PROJECTS);
      const req = store.put({
        ...project,
        updatedAt: new Date().toISOString(),
      });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[StudioIndexedDB Save Warning]:', err);
    // Fallback to localStorage for small data
    try {
      localStorage.setItem(`amb_studio_last_proj`, JSON.stringify(project));
    } catch (e) {}
  }
}

export async function getStudioProjectFromDb(id: string): Promise<StudioProject | null> {
  try {
    const db = await openStudioDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_PROJECTS], 'readonly');
      const store = tx.objectStore(STORE_PROJECTS);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[StudioIndexedDB Get Warning]:', err);
    return null;
  }
}

export async function getAllStudioProjectsFromDb(): Promise<StudioProject[]> {
  try {
    const db = await openStudioDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_PROJECTS], 'readonly');
      const store = tx.objectStore(STORE_PROJECTS);
      const req = store.getAll();
      req.onsuccess = () => {
        const results = req.result || [];
        results.sort((a: StudioProject, b: StudioProject) => {
          return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
        });
        resolve(results);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[StudioIndexedDB GetAll Warning]:', err);
    return [];
  }
}

export async function deleteStudioProjectFromDb(id: string): Promise<void> {
  try {
    const db = await openStudioDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_PROJECTS], 'readwrite');
      const store = tx.objectStore(STORE_PROJECTS);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[StudioIndexedDB Delete Warning]:', err);
  }

  // Clean localStorage fallback if it matches
  try {
    const raw = localStorage.getItem('amb_studio_last_proj');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.id === id) {
        localStorage.removeItem('amb_studio_last_proj');
      }
    }
  } catch (e) {}
}
