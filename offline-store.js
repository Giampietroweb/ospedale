/**
 * offline-store.js
 *
 * Gestione IndexedDB per la coda outbox delle operazioni offline.
 * Esposto come window.offlineStore per compatibilità con il vanilla JS esistente.
 *
 * Schema DB v2:
 *   outbox (keyPath: id)
 *     - id          string (uuid)
 *     - status      'pending' | 'syncing' | 'synced' | 'error'
 *     - action      string  (es. 'saveApparecchiaturaRow')
 *     - payload     object  (corpo completo POST)
 *     - roomRef     object  (denormalizzato per query: { blocco, piano, roomCode })
 *     - createdAt   string  ISO — quando l'operazione è stata accodata
 *     - updatedAt   string  ISO — ultimo aggiornamento qualunque
 *     - lastAttemptAt  string|null — ultimo tentativo di sync
 *     - syncedAt       string|null — timestamp del sync riuscito
 *     - attemptCount   number — quanti tentativi sono stati fatti
 *     - error          string|null
 *   indexes: status, createdAt, action
 *
 *   metadata (keyPath: key)
 *     - key      'lastSyncAt' | 'lastFlushSummary'
 *     - value    qualunque (string|object)
 */

(function (global) {
  'use strict';

  const DB_NAME = 'ospedale_offline_db';
  const DB_VERSION = 2;
  const OUTBOX_STORE = 'outbox';
  const META_STORE = 'metadata';

  let dbInstance = null;

  function nowIso() {
    return new Date().toISOString();
  }

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
        const tx = event.target.transaction;

        let outboxStore;
        if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
          outboxStore = db.createObjectStore(OUTBOX_STORE, { keyPath: 'id' });
          outboxStore.createIndex('status', 'status', { unique: false });
          outboxStore.createIndex('createdAt', 'createdAt', { unique: false });
          outboxStore.createIndex('action', 'action', { unique: false });
        } else if (tx) {
          outboxStore = tx.objectStore(OUTBOX_STORE);
          if (!outboxStore.indexNames.contains('action')) {
            outboxStore.createIndex('action', 'action', { unique: false });
          }
        }

        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE, { keyPath: 'key' });
        }

        if (outboxStore && tx) {
          backfillOperationFields(outboxStore);
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

  // Migrazione: aggiunge campi mancanti alle operazioni preesistenti (DB v1 → v2).
  function backfillOperationFields(store) {
    const cursorRequest = store.openCursor();
    cursorRequest.onsuccess = (evt) => {
      const cursor = evt.target.result;
      if (!cursor) return;
      const record = cursor.value;
      let mutated = false;
      if (record.attemptCount === undefined) { record.attemptCount = 0; mutated = true; }
      if (record.lastAttemptAt === undefined) { record.lastAttemptAt = null; mutated = true; }
      if (record.syncedAt === undefined) {
        record.syncedAt = record.status === 'synced' ? (record.updatedAt || null) : null;
        mutated = true;
      }
      if (record.roomRef === undefined) {
        record.roomRef = record.payload?.roomRef || null;
        mutated = true;
      }
      if (mutated) cursor.update(record);
      cursor.continue();
    };
  }

  // ── Helpers transazione ────────────────────────────────────────────────────

  function runOutboxTx(mode, fn) {
    return openOfflineDb().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(OUTBOX_STORE, mode);
      let result;
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(new Error(`Errore transazione outbox: ${tx.error?.message}`));
      tx.onabort = () => reject(new Error(`Transazione outbox annullata: ${tx.error?.message}`));
      fn(tx.objectStore(OUTBOX_STORE), (value) => { result = value; });
    }));
  }

  function runMetaTx(mode, fn) {
    return openOfflineDb().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(META_STORE, mode);
      let result;
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(new Error(`Errore transazione metadata: ${tx.error?.message}`));
      tx.onabort = () => reject(new Error(`Transazione metadata annullata: ${tx.error?.message}`));
      fn(tx.objectStore(META_STORE), (value) => { result = value; });
    }));
  }

  // ── CRUD operazioni ────────────────────────────────────────────────────────

  async function enqueueOutboxOperation(operationData) {
    const now = nowIso();
    const operation = {
      id: generateOperationId(),
      status: 'pending',
      attemptCount: 0,
      lastAttemptAt: null,
      syncedAt: null,
      createdAt: now,
      updatedAt: now,
      error: null,
      action: operationData.action || 'unknown',
      payload: operationData.payload || null,
      roomRef: operationData.payload?.roomRef || operationData.roomRef || null,
      ...operationData,
    };
    // Garantisce che createdAt non venga sovrascritto se l'oggetto in ingresso lo include
    operation.createdAt = now;
    operation.updatedAt = now;

    return runOutboxTx('readwrite', (store, setResult) => {
      const req = store.add(operation);
      req.onsuccess = () => setResult(operation);
    });
  }

  async function listPendingOperations() {
    return runOutboxTx('readonly', (store, setResult) => {
      const req = store.index('status').getAll('pending');
      req.onsuccess = () => {
        const results = (req.result || []).sort(
          (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
        );
        setResult(results);
      };
    });
  }

  async function listAllOperations({ limit = 200, status, action, since } = {}) {
    return runOutboxTx('readonly', (store, setResult) => {
      const req = store.getAll();
      req.onsuccess = () => {
        let all = req.result || [];

        if (status) {
          const statuses = Array.isArray(status) ? status : [status];
          all = all.filter((op) => statuses.includes(op.status));
        }
        if (action) {
          all = all.filter((op) => op.action === action);
        }
        if (since) {
          const sinceMs = new Date(since).getTime();
          all = all.filter((op) => new Date(op.createdAt).getTime() >= sinceMs);
        }

        all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setResult(all.slice(0, limit));
      };
    });
  }

  async function getOperationById(id) {
    return runOutboxTx('readonly', (store, setResult) => {
      const req = store.get(id);
      req.onsuccess = () => setResult(req.result || null);
    });
  }

  async function updateOperationStatus(id, updates) {
    return runOutboxTx('readwrite', (store, setResult) => {
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const operation = getReq.result;
        if (!operation) return; // non rejecta: l'operazione potrebbe essere stata eliminata
        const merged = { ...operation, ...updates, updatedAt: nowIso() };
        const putReq = store.put(merged);
        putReq.onsuccess = () => setResult(merged);
      };
    });
  }

  function markOperationSynced(id, metadata) {
    const syncedAt = nowIso();
    return updateOperationStatus(id, { status: 'synced', error: null, syncedAt, ...metadata });
  }

  function markOperationSyncing(id) {
    return updateOperationStatus(id, { status: 'syncing', error: null });
  }

  function markOperationError(id, errorMessage) {
    return updateOperationStatus(id, { status: 'error', error: String(errorMessage) });
  }

  function markOperationPending(id, errorMessage = null) {
    return updateOperationStatus(id, { status: 'pending', error: errorMessage });
  }

  // Aumenta attemptCount e setta lastAttemptAt — chiamato prima di ogni tentativo
  async function recordAttempt(id) {
    return runOutboxTx('readwrite', (store, setResult) => {
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const operation = getReq.result;
        if (!operation) return;
        const merged = {
          ...operation,
          attemptCount: (operation.attemptCount || 0) + 1,
          lastAttemptAt: nowIso(),
          updatedAt: nowIso(),
        };
        const putReq = store.put(merged);
        putReq.onsuccess = () => setResult(merged);
      };
    });
  }

  async function deleteOperation(id) {
    return runOutboxTx('readwrite', (store) => {
      store.delete(id);
    });
  }

  async function deleteAllSyncedOperations() {
    return runOutboxTx('readwrite', (store, setResult) => {
      const req = store.index('status').openCursor('synced');
      let removed = 0;
      req.onsuccess = (evt) => {
        const cursor = evt.target.result;
        if (cursor) {
          cursor.delete();
          removed++;
          cursor.continue();
        } else {
          setResult(removed);
        }
      };
    });
  }

  async function purgeSyncedOlderThan(milliseconds) {
    const thresholdMs = Date.now() - milliseconds;
    return runOutboxTx('readwrite', (store, setResult) => {
      const req = store.index('status').openCursor('synced');
      let removed = 0;
      req.onsuccess = (evt) => {
        const cursor = evt.target.result;
        if (cursor) {
          const syncedAtMs = new Date(cursor.value.syncedAt || cursor.value.updatedAt || 0).getTime();
          if (syncedAtMs < thresholdMs) {
            cursor.delete();
            removed++;
          }
          cursor.continue();
        } else {
          setResult(removed);
        }
      };
    });
  }

  async function countPendingOperations() {
    return runOutboxTx('readonly', (store, setResult) => {
      const req = store.index('status').count('pending');
      req.onsuccess = () => setResult(req.result);
    });
  }

  async function getStats() {
    return runOutboxTx('readonly', (store, setResult) => {
      const req = store.getAll();
      req.onsuccess = () => {
        const all = req.result || [];
        const stats = {
          total: all.length,
          pending: 0,
          syncing: 0,
          synced: 0,
          error: 0,
          lastCreatedAt: null,
          firstPendingCreatedAt: null,
        };
        for (const op of all) {
          if (stats[op.status] !== undefined) stats[op.status]++;
          if (!stats.lastCreatedAt || op.createdAt > stats.lastCreatedAt) {
            stats.lastCreatedAt = op.createdAt;
          }
          if (op.status === 'pending') {
            if (!stats.firstPendingCreatedAt || op.createdAt < stats.firstPendingCreatedAt) {
              stats.firstPendingCreatedAt = op.createdAt;
            }
          }
        }
        setResult(stats);
      };
    });
  }

  // ── Metadata key-value ─────────────────────────────────────────────────────

  async function setMetadata(key, value) {
    return runMetaTx('readwrite', (store) => {
      store.put({ key, value, updatedAt: nowIso() });
    });
  }

  async function getMetadata(key) {
    return runMetaTx('readonly', (store, setResult) => {
      const req = store.get(key);
      req.onsuccess = () => setResult(req.result?.value ?? null);
    });
  }

  async function getLastSyncAt() {
    return getMetadata('lastSyncAt');
  }

  async function setLastSyncAt(timestampIso) {
    return setMetadata('lastSyncAt', timestampIso || nowIso());
  }

  global.offlineStore = {
    generateOperationId,
    openOfflineDb,
    enqueueOutboxOperation,
    listPendingOperations,
    listAllOperations,
    getOperationById,
    updateOperationStatus,
    markOperationSynced,
    markOperationSyncing,
    markOperationError,
    markOperationPending,
    recordAttempt,
    deleteOperation,
    deleteAllSyncedOperations,
    purgeSyncedOlderThan,
    countPendingOperations,
    getStats,
    setMetadata,
    getMetadata,
    getLastSyncAt,
    setLastSyncAt,
  };
})(window);
