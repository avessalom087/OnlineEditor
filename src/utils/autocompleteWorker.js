const workerCode = `
  let items = [];
  self.onmessage = function(e) {
    const { type, payload } = e.data;
    if (type === 'INIT') {
      items = payload || [];
    } else if (type === 'SEARCH') {
      const { query, limit, searchId } = payload;
      const lower = (query || '').toLowerCase();
      const results = [];
      
      if (lower.trim() === '') {
        self.postMessage({ type: 'RESULTS', payload: { results: [], searchId } });
        return;
      }

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.toLowerCase().includes(lower)) {
          results.push(item);
          if (results.length >= limit) break;
        }
      }
      self.postMessage({ type: 'RESULTS', payload: { results, searchId } });
    }
  };
`;

export class AutocompleteWorkerWrapper {
  constructor() {
    try {
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const blobUrl = URL.createObjectURL(blob);
      this.worker = new Worker(blobUrl);
      // Immediately revoke the Blob URL — the Worker already holds an internal
      // reference to the compiled script, so this is safe and prevents a leak.
      URL.revokeObjectURL(blobUrl);
      this.callbacks = new Map();
      this.searchId = 0;

      this.worker.onmessage = (e) => {
        const { type, payload } = e.data;
        if (type === 'RESULTS') {
          const { results, searchId } = payload;
          const cb = this.callbacks.get(searchId);
          if (cb) {
            cb(results);
            this.callbacks.delete(searchId);
          }
        }
      };
    } catch (e) {
      console.error('Failed to initialize Autocomplete Web Worker, falling back to main thread.', e);
      this.worker = null;
      this.items = [];
    }
  }

  init(items) {
    if (this.worker) {
      this.worker.postMessage({ type: 'INIT', payload: items });
    } else {
      this.items = items || [];
    }
  }

  search(query, limit = 50, callback) {
    if (this.worker) {
      const id = ++this.searchId;
      // Clean up previous pending callbacks to avoid memory leaks
      this.callbacks.clear();
      this.callbacks.set(id, callback);
      this.worker.postMessage({ type: 'SEARCH', payload: { query, limit, searchId: id } });
    } else {
      // Main-thread fallback if Web Worker fails to load
      const lower = (query || '').toLowerCase();
      if (lower.trim() === '') {
        callback([]);
        return;
      }
      const results = [];
      for (let i = 0; i < this.items.length; i++) {
        const item = this.items[i];
        if (item.toLowerCase().includes(lower)) {
          results.push(item);
          if (results.length >= limit) break;
        }
      }
      callback(results);
    }
  }

  terminate() {
    if (this.worker) {
      this.worker.terminate();
    }
  }
}
