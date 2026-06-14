const DB_NAME = 'ExpansionEditorDB';
const STORE_NAME = 'settings';
const DB_VERSION = 1;

// ─── Single shared connection ─────────────────────────────────────────────────
// Cached promise so every caller awaits the same open operation rather than
// each one independently opening a new IDBDatabase connection.
let _dbPromise = null;

/**
 * Opens (or returns the already-open) IndexedDB database.
 * Caches the connection after the first successful open.
 * @returns {Promise<IDBDatabase>}
 */
function openDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = (e) => resolve(e.target.result);
      request.onerror  = ()  => {
        _dbPromise = null; // allow retry on next call
        reject(request.error);
      };
      request.onblocked = () => {
        // Another tab has an older version open; reset so we can retry later.
        _dbPromise = null;
        reject(new Error('IndexedDB connection blocked'));
      };
    } catch (err) {
      _dbPromise = null;
      reject(err);
    }
  });
  return _dbPromise;
}

/**
 * Generic read helper: resolves with the stored value or `null`.
 * @param {IDBValidKey} key
 * @returns {Promise<any>}
 */
function dbGet(key) {
  return openDB().then(
    db => new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror   = () => reject(req.error);
    })
  );
}

/**
 * Generic write helper: stores `value` under `key`.
 * @param {IDBValidKey} key
 * @param {any} value
 * @returns {Promise<void>}
 */
function dbPut(key, value) {
  return openDB().then(
    db => new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).put(value, key);
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    })
  );
}

/**
 * Generic delete helper: removes the entry under `key`.
 * Always resolves (treats missing key as a no-op).
 * @param {IDBValidKey} key
 * @returns {Promise<void>}
 */
function dbDelete(key) {
  return openDB().then(
    db => new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).delete(key);
      req.onsuccess = () => resolve();
      req.onerror   = () => resolve(); // non-fatal
    })
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────

const KEY_HANDLE  = 'directoryHandle';
const KEY_XML     = 'xmlItems';
const KEY_DRAFT   = 'draft';

// ── Directory handle ──────────────────────────────────────────────────────────

/**
 * Retrieves the saved FileSystemDirectoryHandle from IndexedDB.
 * @returns {Promise<FileSystemDirectoryHandle|null>}
 */
export function getSavedHandle() {
  return dbGet(KEY_HANDLE).catch(err => {
    console.error('IndexedDB getSavedHandle error:', err);
    return null;
  });
}

/**
 * Saves a FileSystemDirectoryHandle to IndexedDB.
 * @param {FileSystemDirectoryHandle} handle
 * @returns {Promise<void>}
 */
export function saveHandle(handle) {
  return dbPut(KEY_HANDLE, handle);
}

/**
 * Deletes the saved FileSystemDirectoryHandle from IndexedDB.
 * @returns {Promise<void>}
 */
export function clearSavedHandle() {
  return dbDelete(KEY_HANDLE).catch(err => {
    console.error('IndexedDB clearSavedHandle error:', err);
  });
}

// ── XML items ─────────────────────────────────────────────────────────────────

/**
 * Retrieves the saved types.xml items list from IndexedDB.
 * @returns {Promise<Array|null>}
 */
export function getXmlItems() {
  return dbGet(KEY_XML).catch(err => {
    console.error('IndexedDB getXmlItems error:', err);
    return null;
  });
}

/**
 * Saves types.xml items list to IndexedDB.
 * @param {Array} items
 * @returns {Promise<void>}
 */
export function saveXmlItems(items) {
  return dbPut(KEY_XML, items);
}

/**
 * Clears the saved types.xml items list from IndexedDB.
 * @returns {Promise<void>}
 */
export function clearXmlItems() {
  return dbDelete(KEY_XML).catch(err => {
    console.error('IndexedDB clearXmlItems error:', err);
  });
}

// ── Draft ─────────────────────────────────────────────────────────────────────

/**
 * Retrieves the saved draft from IndexedDB.
 * @returns {Promise<object|null>}
 */
export function getDraft() {
  return dbGet(KEY_DRAFT).catch(err => {
    console.error('IndexedDB getDraft error:', err);
    return null;
  });
}

/**
 * Saves a draft to IndexedDB.
 * @param {object} draft
 * @returns {Promise<void>}
 */
export function saveDraft(draft) {
  return dbPut(KEY_DRAFT, draft);
}

/**
 * Clears the saved draft from IndexedDB.
 * @returns {Promise<void>}
 */
export function clearDraft() {
  return dbDelete(KEY_DRAFT).catch(err => {
    console.error('IndexedDB clearDraft error:', err);
  });
}

// ── Custom Map Blob ───────────────────────────────────────────────────────────
const KEY_CUSTOM_MAP = 'customMapBlob';

/**
 * Saves the custom map image blob to IndexedDB.
 * @param {Blob|File} blob
 * @returns {Promise<void>}
 */
export function saveCustomMapBlob(blob) {
  return dbPut(KEY_CUSTOM_MAP, blob).catch(err => {
    console.error('IndexedDB saveCustomMapBlob error:', err);
  });
}

/**
 * Retrieves the saved custom map image blob from IndexedDB.
 * @returns {Promise<Blob|null>}
 */
export function getCustomMapBlob() {
  return dbGet(KEY_CUSTOM_MAP).catch(err => {
    console.error('IndexedDB getCustomMapBlob error:', err);
    return null;
  });
}
