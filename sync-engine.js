/**
 * sync-engine.js
 *
 * Motore di sincronizzazione delle operazioni outbox offline.
 * Svuota la coda con ordine FIFO e lock anti-concorrenza.
 *
 * Dipende da offline-store.js e api-client.js (window.offlineStore, window.apiClient).
 * Esposto come window.syncEngine.
 *
 * Eventi pub/sub (onSyncEvent):
 *   sync:start       { count, reason }
 *   sync:end         { syncedCount, errorCount, remainingCount, elapsedMs, lastSyncAt }
 *   sync:skipped     { reason, source }
 *   operation:syncing { id }
 *   operation:synced  { id, syncedAt }
 *   operation:error   { id, error, permanent }
 *   operation:retry   { id, error }
 */

(function (global) {
  'use strict';

  const SAVE_ENDPOINT = '../api/save-modal.php';

  const MAX_ITEMS_PER_FLUSH = 50;

  let isSyncInProgress = false;

  const listeners = [];

  function emitEvent(type, detail) {
    listeners.forEach((fn) => {
      try {
        fn({ type, detail });
      } catch {
        // listener non deve bloccare il motore
      }
    });
  }

  function onSyncEvent(callback) {
    listeners.push(callback);
  }

  function offSyncEvent(callback) {
    const index = listeners.indexOf(callback);
    if (index !== -1) listeners.splice(index, 1);
  }

  async function performSingleSync(operation) {
    const store = global.offlineStore;

    await store.recordAttempt(operation.id);
    await store.markOperationSyncing(operation.id);
    emitEvent('operation:syncing', { id: operation.id });

    try {
      const response = await fetch(SAVE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(operation.payload),
      });

      // Tentiamo di leggere come JSON; se la risposta è HTML (errore PHP) gestiamo come errore di rete
      let responsePayload = null;
      let parseError = null;
      try {
        responsePayload = await response.json();
      } catch (err) {
        parseError = err;
      }

      if (parseError) {
        throw new Error(`Risposta non valida dal server (${response.status})`);
      }

      if (!response.ok || !responsePayload?.ok) {
        const errorMessage = responsePayload?.error || `HTTP ${response.status}`;

        if (response.status >= 400 && response.status < 500) {
          await store.markOperationError(operation.id, errorMessage);
          emitEvent('operation:error', { id: operation.id, error: errorMessage, permanent: true });
          return { success: false, permanent: true };
        }

        throw new Error(errorMessage);
      }

      const syncedAt = new Date().toISOString();
      await store.markOperationSynced(operation.id, {
        serverResponse: responsePayload,
      });
      emitEvent('operation:synced', { id: operation.id, syncedAt });
      return { success: true };
    } catch (error) {
      // Errore di rete o 5xx: rimette in pending mantenendo il messaggio di errore
      await store.markOperationPending(operation.id, error.message || 'Errore di rete');
      emitEvent('operation:retry', { id: operation.id, error: error.message });
      return { success: false, permanent: false };
    }
  }

  async function flushOutbox({ maxItems = MAX_ITEMS_PER_FLUSH, reason = 'manual' } = {}) {
    if (isSyncInProgress) {
      emitEvent('sync:skipped', { reason: 'lock', source: reason });
      return { skipped: true, reason: 'lock' };
    }
    if (!navigator.onLine) {
      emitEvent('sync:skipped', { reason: 'offline', source: reason });
      return { skipped: true, reason: 'offline' };
    }

    const store = global.offlineStore;
    if (!store) return { skipped: true, reason: 'no-store' };

    const pendingOps = await store.listPendingOperations();
    if (pendingOps.length === 0) return { skipped: true, reason: 'empty' };

    isSyncInProgress = true;

    const batchStartTime = Date.now();
    emitEvent('sync:start', { count: pendingOps.length, reason });

    const batch = pendingOps.slice(0, maxItems);
    let syncedCount = 0;
    let errorCount = 0;
    let networkFailure = false;

    try {
      for (const operation of batch) {
        if (!navigator.onLine) {
          networkFailure = true;
          break;
        }

        const result = await performSingleSync(operation);

        if (result.success) {
          syncedCount++;
        } else if (result.permanent) {
          errorCount++;
        } else {
          networkFailure = true;
          break;
        }
      }
    } finally {
      isSyncInProgress = false;
    }

    const remainingCount = await store.countPendingOperations();
    const elapsedMs = Date.now() - batchStartTime;
    const lastSyncAt = new Date().toISOString();

    if (syncedCount > 0) {
      await store.setLastSyncAt(lastSyncAt);
    }
    await store.setMetadata('lastFlushSummary', {
      syncedCount, errorCount, remainingCount, elapsedMs,
      reason, at: lastSyncAt,
    });

    console.info(
      `[SyncEngine] Batch completato (${reason}): synced=${syncedCount}, errors=${errorCount}, pending=${remainingCount}, elapsed=${elapsedMs}ms`
    );

    emitEvent('sync:end', { syncedCount, errorCount, remainingCount, elapsedMs, lastSyncAt });

    // Se ci sono ancora pending e non c'è stato un network failure, processiamo subito
    // il batch successivo (es. quando la coda supera MAX_ITEMS_PER_FLUSH)
    if (remainingCount > 0 && !networkFailure) {
      setTimeout(() => {
        flushOutbox({ reason: 'continue-batch' }).catch(console.error);
      }, 50);
      return { syncedCount, errorCount, remainingCount, elapsedMs };
    }

    return { syncedCount, errorCount, remainingCount, elapsedMs };
  }

  /**
   * Riprova esplicitamente una singola operazione per id.
   * Utile dalla pagina sync.html per i bottoni "Riprova".
   */
  async function syncSingleById(operationId) {
    const store = global.offlineStore;
    if (!store) throw new Error('offline-store non disponibile');
    if (!navigator.onLine) {
      emitEvent('sync:skipped', { reason: 'offline', source: 'single' });
      return { success: false, reason: 'offline' };
    }
    const op = await store.getOperationById(operationId);
    if (!op) return { success: false, reason: 'not-found' };
    if (op.status === 'syncing') return { success: false, reason: 'in-progress' };
    if (op.status === 'synced') return { success: true, reason: 'already-synced' };

    await store.markOperationPending(operationId, null);
    const result = await performSingleSync(op);
    return result;
  }

  async function getStats() {
    const store = global.offlineStore;
    if (!store) return null;
    const stats = await store.getStats();
    const lastSyncAt = await store.getLastSyncAt();
    const lastFlushSummary = await store.getMetadata('lastFlushSummary');
    return { ...stats, lastSyncAt, lastFlushSummary, isSyncInProgress };
  }

  function init() {
    // Modalità manuale: nessun trigger automatico di flush.
    // I listener sono lasciati per mantenere un lifecycle prevedibile.
    window.addEventListener('online', () => {});
    window.addEventListener('offline', () => {});
  }

  global.syncEngine = {
    init,
    flushOutbox,
    syncSingleById,
    getStats,
    onSyncEvent,
    offSyncEvent,
  };
})(window);
