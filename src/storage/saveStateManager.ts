export class SaveStateManager {
  private dbName = 'WebV8ArcadeSaves';
  private storeName = 'savestates';
  private db: IDBDatabase | null = null;

  constructor() {}

  public async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };

      request.onsuccess = (event: Event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };

      request.onerror = (event: Event) => {
        console.error('[SaveStateManager] Error al abrir IndexedDB:', (event.target as IDBOpenDBRequest).error);
        reject((event.target as IDBOpenDBRequest).error);
      };
    });
  }

  public async saveState(romName: string, buffer: ArrayBuffer): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      const request = store.put(buffer, romName);

      request.onsuccess = () => resolve();
      request.onerror = (event) => {
        console.error('[SaveStateManager] Error guardando estado:', (event.target as IDBRequest).error);
        reject((event.target as IDBRequest).error);
      };
    });
  }

  public async loadState(romName: string): Promise<ArrayBuffer | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);

      const request = store.get(romName);

      request.onsuccess = (event) => {
        const result = (event.target as IDBRequest).result;
        resolve(result || null);
      };

      request.onerror = (event) => {
        console.error('[SaveStateManager] Error cargando estado:', (event.target as IDBRequest).error);
        reject((event.target as IDBRequest).error);
      };
    });
  }

  public async deleteState(romName: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      const request = store.delete(romName);

      request.onsuccess = () => resolve();

      request.onerror = (event) => {
        console.error('[SaveStateManager] Error borrando estado:', (event.target as IDBRequest).error);
        reject((event.target as IDBRequest).error);
      };
    });
  }
}
