/**
 * Test unitari per offline-store.js (schema v2).
 *
 * Eseguibili con Node.js 18+ (ES Modules).
 * Usa una implementazione mock di IndexedDB.
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
    this.indexNames = { contains: (name) => name in this._indexes };
  }
  createIndex(name, keyPath) {
    this._indexes[name] = keyPath;
    return { name, keyPath };
  }
  add(record) {
    const req = new MockIDBRequest();
    setTimeout(() => {
      if (this._data.has(record.id ?? record.key)) {
        req._reject(new Error('ConstraintError'));
      } else {
        this._data.set(record.id ?? record.key, { ...record });
        req._resolve(record.id ?? record.key);
      }
    }, 0);
    return req;
  }
  put(record) {
    const req = new MockIDBRequest();
    setTimeout(() => {
      this._data.set(record.id ?? record.key, { ...record });
      req._resolve(record.id ?? record.key);
    }, 0);
    return req;
  }
  get(id) {
    const req = new MockIDBRequest();
    setTimeout(() => { req._resolve(this._data.get(id) ?? undefined); }, 0);
    return req;
  }
  delete(id) {
    const req = new MockIDBRequest();
    setTimeout(() => { this._data.delete(id); req._resolve(undefined); }, 0);
    return req;
  }
  getAll() {
    const req = new MockIDBRequest();
    setTimeout(() => { req._resolve([...this._data.values()]); }, 0);
    return req;
  }
  openCursor() {
    const records = [...this._data.values()];
    const req = new MockIDBRequest();
    setTimeout(() => {
      let i = 0;
      const advance = () => {
        if (i >= records.length) { req._resolve(null); return; }
        const value = records[i++];
        const cursor = {
          value,
          continue: () => setTimeout(advance, 0),
          update: (newVal) => { this._data.set(newVal.id, { ...newVal }); },
          delete: () => { this._data.delete(value.id); },
        };
        req.result = cursor;
        if (req.onsuccess) req.onsuccess({ target: req });
      };
      advance();
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
      openCursor: (value) => {
        const req = new MockIDBRequest();
        setTimeout(() => {
          const all = [...store._data.values()];
          const filtered = value !== undefined
            ? all.filter((r) => r[keyPath] === value)
            : all;
          let i = 0;
          const advance = () => {
            if (i >= filtered.length) { req._resolve(null); return; }
            const v = filtered[i++];
            const cursor = {
              value: v,
              continue: () => setTimeout(advance, 0),
              delete: () => { store._data.delete(v.id); },
            };
            req.result = cursor;
            if (req.onsuccess) req.onsuccess({ target: req });
          };
          advance();
        }, 0);
        return req;
      },
    };
  }
}

class MockTransaction {
  constructor(stores) {
    this._stores = stores;
    this.oncomplete = null;
    this.onerror = null;
    this.onabort = null;
    this.error = null;
    // Lungo abbastanza per permettere il completamento di cursor iterativi (delete + continue)
    setTimeout(() => { if (this.oncomplete) this.oncomplete(); }, 50);
  }
  objectStore(name) { return this._stores[name]; }
}

class MockIDBDatabase {
  constructor() {
    this._stores = {};
    this.objectStoreNames = { contains: (name) => name in this._stores };
  }
  createObjectStore(name) {
    const store = new MockIDBObjectStore();
    this._stores[name] = store;
    return store;
  }
  transaction(storeName) {
    return new MockTransaction(this._stores);
  }
}

function createMockIndexedDB() {
  const db = new MockIDBDatabase();
  return {
    open: () => {
      const req = new MockIDBRequest();
      setTimeout(() => {
        // Simula upgradeneeded passando una "transaction" mock con objectStore()
        const upgradeTx = { objectStore: (n) => db._stores[n] };
        req.onupgradeneeded?.({ target: { result: db, transaction: upgradeTx } });
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
  if (condition) { console.log(`  ✓ ${message}`); passed++; }
  else { console.error(`  ✗ ${message}`); failed++; }
}

// ── Test suite ─────────────────────────────────────────────────────────────────

async function runTests() {
  console.log('\n=== offline-store.js v2 — Test unitari ===\n');

  const mockIDB = createMockIndexedDB();
  const store = loadOfflineStore(mockIDB);

  console.log('generateOperationId');
  const id1 = store.generateOperationId();
  const id2 = store.generateOperationId();
  assert(typeof id1 === 'string' && id1.length > 0, 'genera un ID stringa non vuota');
  assert(id1 !== id2, 'genera ID univoci tra chiamate consecutive');

  console.log('\nopenOfflineDb');
  const db = await store.openOfflineDb();
  assert(db !== null && db !== undefined, 'apre il database senza errori');
  const db2 = await store.openOfflineDb();
  assert(db === db2, 'restituisce la stessa istanza (singleton)');

  console.log('\nenqueueOutboxOperation — campi v2');
  const op = await store.enqueueOutboxOperation({
    action: 'saveField',
    payload: { x: 1, roomRef: { blocco: 'nord', piano: '3', roomCode: 'N301' } },
  });
  assert(typeof op.id === 'string', 'genera un id per l\'operazione');
  assert(op.status === 'pending', 'imposta status pending');
  assert(typeof op.createdAt === 'string', 'imposta createdAt ISO string');
  assert(op.error === null, 'error è null per default');
  assert(op.attemptCount === 0, 'attemptCount inizializzato a 0');
  assert(op.lastAttemptAt === null, 'lastAttemptAt inizializzato a null');
  assert(op.syncedAt === null, 'syncedAt inizializzato a null');
  assert(op.roomRef && op.roomRef.blocco === 'nord', 'roomRef denormalizzato salvato');

  console.log('\nrecordAttempt');
  const afterAttempt = await store.recordAttempt(op.id);
  assert(afterAttempt.attemptCount === 1, 'attemptCount incrementato a 1');
  assert(typeof afterAttempt.lastAttemptAt === 'string', 'lastAttemptAt impostato');
  await store.recordAttempt(op.id);
  const afterAttempt2 = await store.getOperationById(op.id);
  assert(afterAttempt2.attemptCount === 2, 'attemptCount incrementato a 2');

  console.log('\nmarkOperationSynced — popola syncedAt');
  const synced = await store.markOperationSynced(op.id, { serverConfirmed: true });
  assert(synced.status === 'synced', 'imposta status synced');
  assert(typeof synced.syncedAt === 'string', 'syncedAt è una stringa ISO');
  assert(synced.error === null, 'error reset a null');
  assert(synced.serverConfirmed === true, 'merge dei metadata extra');

  console.log('\nlistPendingOperations');
  const op2 = await store.enqueueOutboxOperation({ action: 'saveApparecchiaturaRow' });
  const pending = await store.listPendingOperations();
  assert(Array.isArray(pending), 'restituisce un array');
  assert(pending.some((o) => o.id === op2.id), 'contiene l\'operazione pending appena creata');
  assert(pending.every((o) => o.status === 'pending'), 'tutti gli elementi hanno status pending');

  console.log('\nmarkOperationError');
  const errored = await store.markOperationError(op2.id, 'Timeout di rete');
  assert(errored.status === 'error', 'imposta status error');
  assert(errored.error === 'Timeout di rete', 'salva il messaggio di errore');

  console.log('\ngetOperationById');
  const fetched = await store.getOperationById(op2.id);
  assert(fetched && fetched.id === op2.id, 'recupera operazione per id');
  const notFound = await store.getOperationById('non-esiste');
  assert(notFound === null, 'restituisce null se non trovato');

  console.log('\nlistAllOperations — filtri');
  const allOps = await store.listAllOperations();
  assert(allOps.length >= 2, 'restituisce almeno 2 operazioni');
  const onlySynced = await store.listAllOperations({ status: 'synced' });
  assert(onlySynced.every((o) => o.status === 'synced'), 'filtra per status synced');
  const onlyByAction = await store.listAllOperations({ action: 'saveField' });
  assert(onlyByAction.every((o) => o.action === 'saveField'), 'filtra per action');

  console.log('\ncountPendingOperations');
  const count = await store.countPendingOperations();
  assert(typeof count === 'number', 'restituisce un numero');

  console.log('\ngetStats');
  const stats = await store.getStats();
  assert(typeof stats.total === 'number' && stats.total >= 2, 'stats.total >= 2');
  assert(typeof stats.synced === 'number', 'stats.synced presente');
  assert(typeof stats.error === 'number', 'stats.error presente');
  assert(typeof stats.pending === 'number', 'stats.pending presente');

  console.log('\nmetadata key-value');
  await store.setLastSyncAt('2026-01-01T00:00:00.000Z');
  const last = await store.getLastSyncAt();
  assert(last === '2026-01-01T00:00:00.000Z', 'lastSyncAt persistito e letto correttamente');
  await store.setMetadata('foo', { bar: 42 });
  const meta = await store.getMetadata('foo');
  assert(meta && meta.bar === 42, 'metadata generico get/set funziona');

  console.log('\ndeleteOperation');
  await store.deleteOperation(op2.id);
  const afterDelete = await store.getOperationById(op2.id);
  assert(afterDelete === null, 'operazione eliminata');

  console.log('\ndeleteAllSyncedOperations');
  // Aggiungo qualche synced di nuovo
  const a = await store.enqueueOutboxOperation({ action: 'saveField' });
  await store.markOperationSynced(a.id);
  const b = await store.enqueueOutboxOperation({ action: 'saveField' });
  await store.markOperationSynced(b.id);
  const removed = await store.deleteAllSyncedOperations();
  assert(typeof removed === 'number' && removed >= 2, `rimuove almeno 2 operazioni sincronizzate (ottenuto: ${removed})`);
  const remaining = await store.listAllOperations({ status: 'synced' });
  assert(remaining.length === 0, 'nessuna operazione synced residua');

  console.log(`\n--- Risultato: ${passed} passati, ${failed} falliti ---\n`);
  if (failed > 0) process.exitCode = 1;
}

runTests().catch((err) => {
  console.error('Errore imprevisto nel runner dei test:', err);
  process.exitCode = 1;
});
