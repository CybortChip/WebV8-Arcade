const DB_NAME = 'WebV8ArcadeDB';
const DB_VERSION = 1;
const STORE_NAME = 'save_states';
const MAX_STATE_SIZE = 10 * 1024 * 1024; // 10 MB máximo por state

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveGameState(gameKey: string, slot: number, data: ArrayBuffer): Promise<boolean> {
  if (data.byteLength > MAX_STATE_SIZE) {
    console.error('El tamaño del Save State supera el límite permitido.');
    return false;
  }

  const safeKey = `${gameKey.replace(/[^a-zA-Z0-9_-]/g, '_')}_slot_${slot}`;
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(data, safeKey);

    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

export async function loadGameState(gameKey: string, slot: number): Promise<ArrayBuffer | null> {
  const safeKey = `${gameKey.replace(/[^a-zA-Z0-9_-]/g, '_')}_slot_${slot}`;
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(safeKey);

    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}
