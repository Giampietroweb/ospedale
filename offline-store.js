/**
 * offline-store.js
 *
 * Gestione IndexedDB per la coda outbox delle operazioni offline.
 * Esposto come window.offlineStore per compatibilità con il vanilla JS esistente.
 */

(function (global) {
  'use strict';

  const DB_NAME = 'ospedale_offline_db';
  const DB_VERSION = 1;
  const OUTBOX_STORE = 'outbox';

  let dbInstance = null;

  function generateOperationId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }

  function openOfflineDb() {
    if (dbInstance) return Promise.resolve(dbInstance);

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
          const store = db.createObjectStore(OUTBOX_STORE, { keyPath: 'id' });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        dbInstance = event.target.result;
        resolve(dbInstance);
      };

      request.onerror = () => {
        reject(new Error(`Impossibile aprire IndexedDB: ${request.error?.message}`));
      };
    });
  }

  async function enqueueOutboxOperation(operationData) {
    const db = await openOfflineDb();
    const now = new Date().toISOString();

    const operation = {
      id: generateOperationId(),
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      error: null,
      ...operationData,
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(OUTBOX_STORE, 'readwrite');
      const request = tx.objectStore(OUTBOX_STORE).add(operation);
      request.onsuccess = () => resolve(operation);
      request.onerror = () =>
        reject(new Error(`Errore enqueue operazione: ${request.error?.message}`));
    });
  }

  async function listPendingOperations() {
    const db = await openOfflineDb();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(OUTBOX_STORE, 'readonly');
      const request = tx.objectStore(OUTBOX_STORE).index('status').getAll('pending');

      request.onsuccess = () => {
        const results = (request.result || []).sort(
          (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
        );
        resolve(results);
      };
      request.onerror = () =>
        reject(new Error(`Errore lettura pending: ${request.error?.message}`));
    });
  }

  async function listAllOperations({ limit = 20 } = {}) {
    const db = await openOfflineDb();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(OUTBOX_STORE, 'readonly');
      const request = tx.objectStore(OUTBOX_STORE).index('createdAt').getAll();

      request.onsuccess = () => {
        const sorted = (request.result || []).sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        );
        resolve(sorted.slice(0, limit));
      };
      request.onerror = () =>
        reject(new Error(`Errore lettura operazioni: ${request.error?.message}`));
    });
  }

  async function updateOperationStatus(id, updates) {
    const db = await openOfflineDb();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(OUTBOX_STORE, 'readwrite');
      const store = tx.objectStore(OUTBOX_STORE);
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const operation = getRequest.result;
        if (!operation) {
          reject(new Error(`Operazione non trovata: ${id}`));
          return;
        }
        const updated = { ...operation, ...updates, updatedAt: new Date().toISOString() };
        const putRequest = store.put(updated);
        putRequest.onsuccess = () => resolve(updated);
        putRequest.onerror = () =>
          reject(new Error(`Errore aggiornamento: ${putRequest.error?.message}`));
      };

      getRequest.onerror = () =>
        reject(new Error(`Errore lettura operazione: ${getRequest.error?.message}`));
    });
  }

  function markOperationSynced(id, metadata) {
    return updateOperationStatus(id, { status: 'synced', error: null, ...metadata });
  }

  function markOperationSyncing(id) {
    return updateOperationStatus(id, { status: 'syncing', error: null });
  }

  function markOperationError(id, errorMessage) {
    return updateOperationStatus(id, { status: 'error', error: String(errorMessage) });
  }

  function markOperationPending(id) {
    return updateOperationStatus(id, { status: 'pending', error: null });
  }

  async function countPendingOperations() {
    const db = await openOfflineDb();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(OUTBOX_STORE, 'readonly');
      const request = tx.objectStore(OUTBOX_STORE).index('status').count('pending');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(new Error(`Errore conteggio pending: ${request.error?.message}`));
    });
  }

  global.offlineStore = {
    generateOperationId,
    openOfflineDb,
    enqueueOutboxOperation,
    listPendingOperations,
    listAllOperations,
    updateOperationStatus,
    markOperationSynced,
    markOperationSyncing,
    markOperationError,
    markOperationPending,
    countPendingOperations,
  };
})(window);
