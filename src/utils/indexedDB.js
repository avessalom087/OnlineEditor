const DB_NAME = 'ExpansionEditorDB';
const STORE_NAME = 'settings';
const KEY_NAME = 'directoryHandle';

/**
 * Retrieves the saved FileSystemDirectoryHandle from IndexedDB.
 * @returns {Promise<FileSystemDirectoryHandle|null>}
 */
export function getSavedHandle() {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = (e) => {
        const db = e.target.result;
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const getReq = store.get(KEY_NAME);
        getReq.onsuccess = () => {
          resolve(getReq.result || null);
        };
        getReq.onerror = () => {
          resolve(null);
        };
      };
      request.onerror = () => {
        resolve(null);
      };
    } catch (err) {
      console.error('IndexedDB open error:', err);
      resolve(null);
    }
  });
}

/**
 * Saves a FileSystemDirectoryHandle to IndexedDB.
 * @param {FileSystemDirectoryHandle} handle 
 * @returns {Promise<void>}
 */
export function saveHandle(handle) {
  return new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = (e) => {
        const db = e.target.result;
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const putReq = store.put(handle, KEY_NAME);
        putReq.onsuccess = () => {
          resolve();
        };
        putReq.onerror = () => {
          reject(putReq.error);
        };
      };
      request.onerror = () => {
        reject(request.error);
      };
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Deletes the saved FileSystemDirectoryHandle from IndexedDB.
 * @returns {Promise<void>}
 */
export function clearSavedHandle() {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onsuccess = (e) => {
        const db = e.target.result;
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const deleteReq = store.delete(KEY_NAME);
        deleteReq.onsuccess = () => {
          resolve();
        };
        deleteReq.onerror = () => {
          resolve();
        };
      };
      request.onerror = () => {
        resolve();
      };
    } catch (err) {
      console.error('IndexedDB clear error:', err);
      resolve();
    }
  });
}

const XML_ITEMS_KEY = 'xmlItems';

/**
 * Retrieves the saved types.xml items list from IndexedDB.
 * @returns {Promise<Array|null>}
 */
export function getXmlItems() {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = (e) => {
        const db = e.target.result;
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const getReq = store.get(XML_ITEMS_KEY);
        getReq.onsuccess = () => {
          resolve(getReq.result || null);
        };
        getReq.onerror = () => {
          resolve(null);
        };
      };
      request.onerror = () => {
        resolve(null);
      };
    } catch (err) {
      console.error('IndexedDB open error (xml items):', err);
      resolve(null);
    }
  });
}

/**
 * Saves types.xml items list to IndexedDB.
 * @param {Array} items 
 * @returns {Promise<void>}
 */
export function saveXmlItems(items) {
  return new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = (e) => {
        const db = e.target.result;
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const putReq = store.put(items, XML_ITEMS_KEY);
        putReq.onsuccess = () => {
          resolve();
        };
        putReq.onerror = () => {
          reject(putReq.error);
        };
      };
      request.onerror = () => {
        reject(request.error);
      };
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Clears the saved types.xml items list from IndexedDB.
 * @returns {Promise<void>}
 */
export function clearXmlItems() {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onsuccess = (e) => {
        const db = e.target.result;
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const deleteReq = store.delete(XML_ITEMS_KEY);
        deleteReq.onsuccess = () => {
          resolve();
        };
        deleteReq.onerror = () => {
          resolve();
        };
      };
      request.onerror = () => {
        resolve();
      };
    } catch (err) {
      console.error('IndexedDB clear error (xml items):', err);
      resolve();
    }
  });
}
