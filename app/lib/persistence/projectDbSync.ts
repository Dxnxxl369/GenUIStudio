/**
 * GenUI Studio - Project Database & Storage Synchronizer
 * Bridges data between the preview iframe, parent window localStorage,
 * and IndexedDB ('projectDB') so tables and records are always visible
 * in both the Database tab and browser DevTools (IndexedDB & LocalStorage).
 */

const DB_NAME = 'projectDB';

let syncQueue: Promise<void> = Promise.resolve();

function saveRowsToStore(db: IDBDatabase, storeName: string, rows: any[]): Promise<void> {
  return new Promise((resolve) => {
    try {
      if (!db.objectStoreNames.contains(storeName)) {
        resolve();
        return;
      }
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.clear();
      rows.forEach((row, index) => {
        try {
          if (typeof row === 'object' && row !== null) {
            const record = { ...row };
            if (record.id === undefined && record._id !== undefined) {
              record.id = record._id;
            } else if (record.id === undefined) {
              record.id = index + 1;
            }
            store.put(record);
          } else {
            store.put({ id: index + 1, value: row });
          }
        } catch (err) {
          console.warn(`[projectDbSync] Failed to put row in ${storeName}:`, err);
        }
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch (err) {
      console.warn(`[projectDbSync] Transaction error for ${storeName}:`, err);
      resolve();
    }
  });
}

function getDbWithStore(storeName: string): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const openReq = indexedDB.open(DB_NAME);

      openReq.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: 'id', autoIncrement: true });
        }
      };

      openReq.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (db.objectStoreNames.contains(storeName)) {
          resolve(db);
          return;
        }

        // Store doesn't exist yet, upgrade database version
        const currentVersion = db.version;
        db.close();

        const upgradeReq = indexedDB.open(DB_NAME, currentVersion + 1);
        upgradeReq.onupgradeneeded = (ue) => {
          const udb = (ue.target as IDBOpenDBRequest).result;
          if (!udb.objectStoreNames.contains(storeName)) {
            udb.createObjectStore(storeName, { keyPath: 'id', autoIncrement: true });
          }
        };
        upgradeReq.onsuccess = (ue) => {
          resolve((ue.target as IDBOpenDBRequest).result);
        };
        upgradeReq.onerror = () => {
          resolve(null);
        };
        upgradeReq.onblocked = () => {
          console.warn(`[projectDbSync] Upgrade blocked for store ${storeName}`);
          resolve(null);
        };
      };

      openReq.onerror = () => {
        resolve(null);
      };
    } catch (err) {
      console.warn('[projectDbSync] Error opening IndexedDB:', err);
      resolve(null);
    }
  });
}

async function doSyncTable(tableName: string, dataOrJson: string | any[]): Promise<void> {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') return;

  const cleanName = tableName.trim().toLowerCase();
  if (
    !cleanName ||
    cleanName.startsWith('bolt-') ||
    cleanName.startsWith('sb-') ||
    cleanName.startsWith('chakra-') ||
    cleanName === 'theme' ||
    cleanName === 'providers' ||
    cleanName === 'apikeys'
  ) {
    return;
  }

  let rows: any[] = [];
  if (typeof dataOrJson === 'string') {
    try {
      const parsed = JSON.parse(dataOrJson);
      if (Array.isArray(parsed)) rows = parsed;
      else if (parsed && typeof parsed === 'object') rows = [parsed];
      else return;
    } catch {
      return;
    }
  } else if (Array.isArray(dataOrJson)) {
    rows = dataOrJson;
  } else if (dataOrJson && typeof dataOrJson === 'object') {
    rows = [dataOrJson];
  } else {
    return;
  }

  const db = await getDbWithStore(cleanName);
  if (!db) return;

  await saveRowsToStore(db, cleanName, rows);
  db.close();
}

async function doSyncSingleRow(storeName: string, row: any): Promise<void> {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined' || !row) return;
  const cleanName = storeName.trim().toLowerCase();
  if (!cleanName || cleanName.startsWith('bolt-') || cleanName.startsWith('sb-')) return;

  const db = await getDbWithStore(cleanName);
  if (!db) return;

  try {
    const tx = db.transaction(cleanName, 'readwrite');
    const store = tx.objectStore(cleanName);
    const record = typeof row === 'object' && row !== null ? { ...row } : { value: row };
    if (record.id === undefined && record._id !== undefined) {
      record.id = record._id;
    }
    store.put(record);
    await new Promise((res) => {
      tx.oncomplete = () => res(undefined);
      tx.onerror = () => res(undefined);
    });
  } catch (err) {
    console.warn(`[projectDbSync] Error syncing single row to ${cleanName}:`, err);
  } finally {
    db.close();
  }
}

export function syncTableToIndexedDB(tableName: string, dataOrJson: string | any[]): Promise<void> {
  syncQueue = syncQueue.then(() => doSyncTable(tableName, dataOrJson)).catch((err) => {
    console.warn('[projectDbSync] Sync table error:', err);
  });
  return syncQueue;
}

export function syncSingleRowToIndexedDB(storeName: string, row: any): Promise<void> {
  syncQueue = syncQueue.then(() => doSyncSingleRow(storeName, row)).catch((err) => {
    console.warn('[projectDbSync] Sync single row error:', err);
  });
  return syncQueue;
}

export function broadcastStorageToPreview(key: string, value: string) {
  if (typeof document === 'undefined') return;
  const iframes = document.querySelectorAll('iframe');
  iframes.forEach((iframe) => {
    try {
      iframe.contentWindow?.postMessage(
        {
          type: 'BOLT_STORAGE_SET',
          key,
          value,
        },
        '*',
      );
    } catch {}
  });
}

export function initStorageBridge() {
  if (typeof window === 'undefined') return;

  // Listen for storage events posted from preview iframe
  window.addEventListener('message', (event) => {
    if (!event.data) return;

    if (event.data.type === 'BOLT_STORAGE_SYNC') {
      const { action, key, value } = event.data;
      if (action === 'set' && key && value !== undefined) {
        try {
          window.localStorage.setItem(key, value);
          syncTableToIndexedDB(key, value);
        } catch {}
      } else if (action === 'remove' && key) {
        try {
          window.localStorage.removeItem(key);
        } catch {}
      }

      window.dispatchEvent(new Event('storage'));
      document.dispatchEvent(new CustomEvent('bolt-data-updated'));
    } else if (event.data.type === 'BOLT_STORAGE_SYNC_BULK') {
      const { data } = event.data;
      if (data && typeof data === 'object') {
        Object.entries(data).forEach(([k, v]) => {
          try {
            window.localStorage.setItem(k, v as string);
            syncTableToIndexedDB(k, v as string);
          } catch {}
        });
        window.dispatchEvent(new Event('storage'));
        document.dispatchEvent(new CustomEvent('bolt-data-updated'));
      }
    } else if (event.data.type === 'BOLT_IDB_SYNC_ROW') {
      const { store, row } = event.data;
      if (store && row) {
        syncSingleRowToIndexedDB(store, row);
      }
    }
  });

  // Sync existing localStorage keys to IndexedDB on startup
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && !k.startsWith('bolt-') && !k.startsWith('sb-') && k !== 'theme' && k !== 'providers' && k !== 'apiKeys') {
        const val = window.localStorage.getItem(k);
        if (val) {
          syncTableToIndexedDB(k, val);
        }
      }
    }
  } catch {}
}
