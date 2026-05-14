/**
 * Test integrazione per sync-engine.js
 *
 * Simula scenari online/offline con mock di fetch e offlineStore.
 * Eseguibile con Node 18+.
 *
 * Esecuzione: node tests/unit/sync-engine.test.js
 */

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

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

// ── Mock offlineStore ──────────────────────────────────────────────────────────

function createMockOfflineStore(initialOps = []) {
  const ops = [...initialOps];
  const metadata = new Map();

  return {
    listPendingOperations: async () => ops.filter((o) => o.status === 'pending'),
    countPendingOperations: async () => ops.filter((o) => o.status === 'pending').length,
    getOperationById: async (id) => ops.find((o) => o.id === id) || null,
    markOperationSyncing: async (id) => {
      const op = ops.find((o) => o.id === id);
      if (op) op.status = 'syncing';
    },
    markOperationSynced: async (id, metadata) => {
      const op = ops.find((o) => o.id === id);
      if (op) {
        op.status = 'synced';
        op.error = null;
        op.syncedAt = new Date().toISOString();
        Object.assign(op, metadata || {});
      }
    },
    markOperationError: async (id, error) => {
      const op = ops.find((o) => o.id === id);
      if (op) { op.status = 'error'; op.error = error; }
    },
    markOperationPending: async (id, errorMessage = null) => {
      const op = ops.find((o) => o.id === id);
      if (op) { op.status = 'pending'; op.error = errorMessage; }
    },
    recordAttempt: async (id) => {
      const op = ops.find((o) => o.id === id);
      if (op) {
        op.attemptCount = (op.attemptCount || 0) + 1;
        op.lastAttemptAt = new Date().toISOString();
      }
    },
    setLastSyncAt: async (iso) => { metadata.set('lastSyncAt', iso); },
    getLastSyncAt: async () => metadata.get('lastSyncAt') || null,
    setMetadata: async (key, value) => { metadata.set(key, value); },
    getMetadata: async (key) => metadata.get(key) ?? null,
    getStats: async () => ({
      total: ops.length,
      pending: ops.filter((o) => o.status === 'pending').length,
      syncing: ops.filter((o) => o.status === 'syncing').length,
      synced: ops.filter((o) => o.status === 'synced').length,
      error: ops.filter((o) => o.status === 'error').length,
    }),
    getOps: () => ops,
  };
}

// ── Caricamento sync-engine con ambiente mock ──────────────────────────────────

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadSyncEngine({ offlineStore, fetchImpl, isOnline = true }) {
  const mockWindow = {
    offlineStore,
    syncUI: null,
    navigator: { onLine: isOnline },
    addEventListener: () => {},
    fetch: fetchImpl,
  };

  const src = readFileSync(resolve(__dirname, '../../sync-engine.js'), 'utf-8');

  // Rimpiazza riferimenti a global.fetch con la versione mock
  const patchedSrc = src
    .replace(/fetch\(SAVE_ENDPOINT/g, 'global._mockFetch(SAVE_ENDPOINT')
    .replace(/navigator\.onLine/g, 'global.navigator.onLine');

  mockWindow._mockFetch = fetchImpl;

  const fn = new Function('window', `
    const global = window;
    ${patchedSrc}
    return window.syncEngine;
  `);

  return fn(mockWindow);
}

// ── Test suite ─────────────────────────────────────────────────────────────────

async function runTests() {
  console.log('\n=== sync-engine.js — Test integrazione ===\n');

  // Test 1: flushOutbox con coda vuota non fa nulla
  console.log('flushOutbox — coda vuota');
  {
    const store = createMockOfflineStore([]);
    let fetchCalled = false;
    const engine = loadSyncEngine({
      offlineStore: store,
      fetchImpl: async () => { fetchCalled = true; },
      isOnline: true,
    });

    await engine.flushOutbox({ reason: 'test' });
    assert(!fetchCalled, 'non chiama fetch se la coda è vuota');
  }

  // Test 2: flushOutbox online — operazione sincronizzata con successo
  console.log('\nflushOutbox — online, success');
  {
    const op = { id: 'op-1', status: 'pending', createdAt: new Date().toISOString(), action: 'saveField', payload: {} };
    const store = createMockOfflineStore([op]);
    let events = [];

    const engine = loadSyncEngine({
      offlineStore: store,
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({ ok: true }),
        status: 200,
      }),
      isOnline: true,
    });

    engine.onSyncEvent((e) => events.push(e.type));
    await engine.flushOutbox({ reason: 'test' });

    const finalOp = store.getOps().find((o) => o.id === 'op-1');
    assert(finalOp.status === 'synced', 'marca l\'operazione come synced');
    assert(events.includes('sync:start'), 'emette evento sync:start');
    assert(events.includes('sync:end'), 'emette evento sync:end');
    assert(events.includes('operation:synced'), 'emette evento operation:synced');
  }

  // Test 3: flushOutbox online — errore 4xx permanente
  console.log('\nflushOutbox — errore 4xx permanente');
  {
    const op = { id: 'op-2', status: 'pending', createdAt: new Date().toISOString(), action: 'saveField', payload: {} };
    const store = createMockOfflineStore([op]);

    const engine = loadSyncEngine({
      offlineStore: store,
      fetchImpl: async () => ({
        ok: false,
        json: async () => ({ ok: false, error: 'Campo non valido' }),
        status: 422,
      }),
      isOnline: true,
    });

    await engine.flushOutbox({ reason: 'test' });

    const finalOp = store.getOps().find((o) => o.id === 'op-2');
    assert(finalOp.status === 'error', 'marca come error per 4xx');
    assert(finalOp.error !== null, 'salva il messaggio di errore');
  }

  // Test 4: flushOutbox online — errore 5xx torna pending
  console.log('\nflushOutbox — errore 5xx, torna pending');
  {
    const op = { id: 'op-3', status: 'pending', createdAt: new Date().toISOString(), action: 'saveField', payload: {} };
    const store = createMockOfflineStore([op]);

    const engine = loadSyncEngine({
      offlineStore: store,
      fetchImpl: async () => ({
        ok: false,
        json: async () => ({ ok: false, error: 'Internal Server Error' }),
        status: 500,
      }),
      isOnline: true,
    });

    await engine.flushOutbox({ reason: 'test' });

    const finalOp = store.getOps().find((o) => o.id === 'op-3');
    assert(finalOp.status === 'pending', 'rimette pending per 5xx (retry)');
  }

  // Test 5: flushOutbox offline non avvia la sincronizzazione
  console.log('\nflushOutbox — offline');
  {
    const op = { id: 'op-4', status: 'pending', createdAt: new Date().toISOString(), action: 'saveField', payload: {} };
    const store = createMockOfflineStore([op]);
    let fetchCalled = false;

    const engine = loadSyncEngine({
      offlineStore: store,
      fetchImpl: async () => { fetchCalled = true; },
      isOnline: false,
    });

    await engine.flushOutbox({ reason: 'test' });
    assert(!fetchCalled, 'non chiama fetch quando offline');
  }

  // Test 6: eventi pub/sub
  console.log('\nonSyncEvent / offSyncEvent');
  {
    const op = { id: 'op-5', status: 'pending', createdAt: new Date().toISOString(), action: 'saveField', payload: {} };
    const store = createMockOfflineStore([op]);
    const received = [];
    const handler = (e) => received.push(e.type);

    const engine = loadSyncEngine({
      offlineStore: store,
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({ ok: true }),
        status: 200,
      }),
      isOnline: true,
    });

    engine.onSyncEvent(handler);
    await engine.flushOutbox({ reason: 'test' });
    assert(received.length > 0, 'onSyncEvent riceve eventi');

    engine.offSyncEvent(handler);
    const countBefore = received.length;

    const op2 = { id: 'op-6', status: 'pending', createdAt: new Date().toISOString(), action: 'saveField', payload: {} };
    store.getOps().push(op2);
    await engine.flushOutbox({ reason: 'test' });
    assert(received.length === countBefore, 'offSyncEvent rimuove il listener');
  }

  // Test 7: recordAttempt e syncedAt vengono popolati
  console.log('\nrecordAttempt / syncedAt');
  {
    const op = { id: 'op-7', status: 'pending', createdAt: new Date().toISOString(), action: 'saveField', payload: {}, attemptCount: 0 };
    const store = createMockOfflineStore([op]);

    const engine = loadSyncEngine({
      offlineStore: store,
      fetchImpl: async () => ({ ok: true, json: async () => ({ ok: true }), status: 200 }),
      isOnline: true,
    });

    await engine.flushOutbox({ reason: 'test' });
    const finalOp = store.getOps().find((o) => o.id === 'op-7');
    assert(finalOp.attemptCount === 1, 'attemptCount incrementato a 1 dopo flush');
    assert(typeof finalOp.lastAttemptAt === 'string', 'lastAttemptAt impostato dopo flush');
    assert(typeof finalOp.syncedAt === 'string', 'syncedAt impostato al success');
    const lastSync = await store.getLastSyncAt();
    assert(typeof lastSync === 'string', 'lastSyncAt metadata aggiornato');
  }

  // Test 8: syncSingleById funziona su una singola operazione
  console.log('\nsyncSingleById');
  {
    const op = { id: 'op-8', status: 'pending', createdAt: new Date().toISOString(), action: 'saveField', payload: {} };
    const store = createMockOfflineStore([op]);

    const engine = loadSyncEngine({
      offlineStore: store,
      fetchImpl: async () => ({ ok: true, json: async () => ({ ok: true }), status: 200 }),
      isOnline: true,
    });

    const result = await engine.syncSingleById('op-8');
    assert(result.success === true, 'syncSingleById ritorna success: true');
    const finalOp = store.getOps().find((o) => o.id === 'op-8');
    assert(finalOp.status === 'synced', 'op marcata come synced');

    const offlineResult = await engine.syncSingleById('op-not-exist');
    assert(offlineResult.success === false && offlineResult.reason === 'not-found', 'gestisce id non esistente');
  }

  // Test 9: lock rilasciato anche in caso di errore (try/finally)
  console.log('\nlock rilasciato dopo errore');
  {
    const op = { id: 'op-9', status: 'pending', createdAt: new Date().toISOString(), action: 'saveField', payload: {} };
    const store = createMockOfflineStore([op]);
    let callCount = 0;

    const engine = loadSyncEngine({
      offlineStore: store,
      fetchImpl: async () => {
        callCount++;
        // Primo tentativo fallisce con 500 (pending), secondo va a buon fine
        if (callCount === 1) return { ok: false, json: async () => ({ ok: false }), status: 500 };
        return { ok: true, json: async () => ({ ok: true }), status: 200 };
      },
      isOnline: true,
    });

    await engine.flushOutbox({ reason: 'test' });
    assert(callCount === 1, 'fetch chiamato 1 volta nel primo flush');
    // Se il lock fosse bloccato, il secondo flush non andrebbe avanti
    await engine.flushOutbox({ reason: 'test-2' });
    assert(callCount === 2, 'lock rilasciato: secondo flush procede');
    const finalOp = store.getOps().find((o) => o.id === 'op-9');
    assert(finalOp.status === 'synced', 'op finalmente sincronizzata');
  }

  // Riepilogo
  console.log(`\n--- Risultato: ${passed} passati, ${failed} falliti ---\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error('Errore imprevisto nel runner dei test:', err);
  process.exitCode = 1;
});
