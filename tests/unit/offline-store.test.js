/**
 * Test unitari per offline-store.js
 *
 * Eseguibili con Node.js 18+.
 * Usa una implementazione mock di IndexedDB per isolare i test.
 *
 * Esecuzione: node tests/unit/offline-store.test.js
 */

// ── Mock IndexedDB minimo ──────────────────────────────────────────────────────

class MockIDBRequest {
  constructor() {
    this.result = undefined;
    this.error = null;
    this.onsuccess = null;
    this.onerror = null;
  }

  _resolve(value) {
    this.result = value;
    if (this.onsuccess) this.onsuccess({ target: this });
  }

  _reject(err) {
    this.error = err;
    if (this.onerror) this.onerror({ target: this });
  }
}

class MockIDBObjectStore {
  constructor() {
    this._data = new Map();
    this._indexes = {};
  }

  createIndex(name, keyPath) {
    this._indexes[name] = keyPath;
    return { name, keyPath };
  }

  add(record) {
    const req = new MockIDBRequest();
    setTimeout(() => {
      if (this._data.has(record.id)) {
        req._reject(new Error('ConstraintError'));
      } else {
        this._data.set(record.id, { ...record });
        req._resolve(record.id);
      }
    }, 0);
    return req;
  }

  put(record) {
    const req = new MockIDBRequest();
    setTimeout(() => {
      this._data.set(record.id, { ...record });
      req._resolve(record.id);
    }, 0);
    return req;
  }

  get(id) {
    const req = new MockIDBRequest();
    setTimeout(() => {
      req._resolve(this._data.get(id) ?? undefined);
    }, 0);
    return req;
  }

  index(name) {
    const keyPath = this._indexes[name];
    const store = this;
    return {
      getAll: (value) => {
        const req = new MockIDBRequest();
        setTimeout(() => {
          const all = [...store._data.values()];
          const filtered = value !== undefined
            ? all.filter((r) => r[keyPath] === value)
            : all;
          req._resolve(filtered);
        }, 0);
        return req;
      },
      count: (value) => {
        const req = new MockIDBRequest();
        setTimeout(() => {
          const all = [...store._data.values()];
          const filtered = value !== undefined
            ? all.filter((r) => r[keyPath] === value)
            : all;
          req._resolve(filtered.length);
        }, 0);
        return req;
      },
    };
  }
}

class MockIDBDatabase {
  constructor() {
    this._stores = {};
    this.objectStoreNames = { contains: (name) => name in this._stores };
  }

  createObjectStore(name, options) {
    const store = new MockIDBObjectStore(options);
    this._stores[name] = store;
    return store;
  }

  transaction(storeName, mode) {
    const store = this._stores[storeName];
    return { objectStore: () => store };
  }
}

function createMockIndexedDB() {
  const db = new MockIDBDatabase();
  return {
    open: (name, version) => {
      const req = new MockIDBRequest();
      setTimeout(() => {
        req.onupgradeneeded?.({ target: { result: db } });
        req._resolve(db);
      }, 0);
      return req;
    },
  };
}

// ── Caricamento modulo offline-store in ambiente mock ──────────────────────────

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadOfflineStore(mockIndexedDB) {
  const mockWindow = { indexedDB: mockIndexedDB };

  const src = readFileSync(resolve(__dirname, '../../offline-store.js'), 'utf-8');

  const fn = new Function('window', `
    const indexedDB = window.indexedDB;
    ${src}
    return window.offlineStore;
  `);

  return fn(mockWindow);
}

// ── Helper assert ──────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ ${message}`);
    failed++;
  }
}

function assertThrows(fn, message) {
  let threw = false;
  try {
    fn();
  } catch {
    threw = true;
  }
  assert(threw, message);
}

// ── Test suite ─────────────────────────────────────────────────────────────────

async function runTests() {
  console.log('\n=== offline-store.js — Test unitari ===\n');

  const mockIDB = createMockIndexedDB();
  const store = loadOfflineStore(mockIDB);

  // Test: generateOperationId
  console.log('generateOperationId');
  const id1 = store.generateOperationId();
  const id2 = store.generateOperationId();
  assert(typeof id1 === 'string' && id1.length > 0, 'genera un ID stringa non vuota');
  assert(id1 !== id2, 'genera ID univoci tra chiamate consecutive');

  // Test: openOfflineDb
  console.log('\nopenOfflineDb');
  const db = await store.openOfflineDb();
  assert(db !== null && db !== undefined, 'apre il database senza errori');
  const db2 = await store.openOfflineDb();
  assert(db === db2, 'restituisce la stessa istanza (singleton)');

  // Test: enqueueOutboxOperation
  console.log('\nenqueueOutboxOperation');
  const op = await store.enqueueOutboxOperation({ action: 'saveField', payload: { x: 1 } });
  assert(typeof op.id === 'string', 'genera un id per l\'operazione');
  assert(op.status === 'pending', 'imposta status pending');
  assert(typeof op.createdAt === 'string', 'imposta createdAt ISO string');
  assert(op.error === null, 'error è null per default');

  // Test: listPendingOperations
  console.log('\nlistPendingOperations');
  const pending = await store.listPendingOperations();
  assert(Array.isArray(pending), 'restituisce un array');
  assert(pending.length >= 1, 'contiene almeno l\'operazione accodata');
  assert(pending.every((o) => o.status === 'pending'), 'tutti gli elementi hanno status pending');

  // Test: markOperationSynced
  console.log('\nmarkOperationSynced');
  const synced = await store.markOperationSynced(op.id, { serverConfirmed: true });
  assert(synced.status === 'synced', 'imposta status synced');
  assert(synced.error === null, 'mantiene error a null');
  assert(synced.serverConfirmed === true, 'aggiunge metadata extra');

  // Test: markOperationError
  console.log('\nmarkOperationError');
  const op2 = await store.enqueueOutboxOperation({ action: 'saveApparecchiaturaRow' });
  const errored = await store.markOperationError(op2.id, 'Timeout di rete');
  assert(errored.status === 'error', 'imposta status error');
  assert(errored.error === 'Timeout di rete', 'salva il messaggio di errore');

  // Test: countPendingOperations
  console.log('\ncountPendingOperations');
  const count = await store.countPendingOperations();
  assert(typeof count === 'number', 'restituisce un numero');

  // Test: listAllOperations
  console.log('\nlistAllOperations');
  const all = await store.listAllOperations({ limit: 5 });
  assert(Array.isArray(all), 'restituisce un array');
  assert(all.length <= 5, 'rispetta il limite');

  // Riepilogo
  console.log(`\n--- Risultato: ${passed} passati, ${failed} falliti ---\n`);
  if (failed > 0) process.exitCode = 1;
}

runTests().catch((err) => {
  console.error('Errore imprevisto nel runner dei test:', err);
  process.exitCode = 1;
});
