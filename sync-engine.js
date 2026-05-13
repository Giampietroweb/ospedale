/**
 * sync-engine.js
 *
 * Motore di sincronizzazione delle operazioni outbox offline.
 * Svuota la coda con ordine FIFO, backoff esponenziale e lock anti-concorrenza.
 *
 * Dipende da offline-store.js e api-client.js (window.offlineStore, window.apiClient).
 * Esposto come window.syncEngine.
 */

(function (global) {
  'use strict';

  const SAVE_ENDPOINT = '../api/save-modal.php';

  // Backoff: 1s, 2s, 4s, 8s, 16s, 30s (max)
  const BACKOFF_DELAYS_MS = [1000, 2000, 4000, 8000, 16000, 30000];
  const PERIODIC_CHECK_INTERVAL_MS = 30000;
  const MAX_ITEMS_PER_FLUSH = 50;

  let isSyncInProgress = false;
  let retryAttempt = 0;
  let retryTimerId = null;
  let periodicTimerId = null;

  // Pub/sub minimale per aggiornare la UI
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

  async function syncSingleOperation(operation) {
    const store = global.offlineStore;

    await store.markOperationSyncing(operation.id);
    emitEvent('operation:syncing', { id: operation.id });

    try {
      const response = await fetch(SAVE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(operation.payload),
      });

      const responsePayload = await response.json();

      if (!response.ok || !responsePayload?.ok) {
        const errorMessage = responsePayload?.error || `HTTP ${response.status}`;

        if (response.status >= 400 && response.status < 500) {
          // Errore applicativo permanente: non ritentare
          await store.markOperationError(operation.id, errorMessage);
          emitEvent('operation:error', { id: operation.id, error: errorMessage, permanent: true });
          return { success: false, permanent: true };
        }

        throw new Error(errorMessage);
      }

      await store.markOperationSynced(operation.id);
      emitEvent('operation:synced', { id: operation.id });
      return { success: true };
    } catch (error) {
      // Errore di rete o 5xx: rimetti in pending mantenendo il messaggio di errore
      await store.updateOperationStatus(operation.id, {
        status: 'pending',
        error: error.message || 'Errore di rete',
      });
      emitEvent('operation:retry', { id: operation.id, error: error.message });
      return { success: false, permanent: false };
    }
  }

  async function flushOutbox({ maxItems = MAX_ITEMS_PER_FLUSH, reason = 'manual' } = {}) {
    if (isSyncInProgress) {
      emitEvent('sync:skipped', { reason: 'lock', source: reason });
      return;
    }
    if (!navigator.onLine) {
      emitEvent('sync:skipped', { reason: 'offline', source: reason });
      return;
    }

    const store = global.offlineStore;
    if (!store) return;

    const pendingOps = await store.listPendingOperations();
    if (pendingOps.length === 0) return;

    isSyncInProgress = true;
    clearScheduledRetry();

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

        const result = await syncSingleOperation(operation);

        if (result.success) {
          syncedCount++;
          retryAttempt = 0;
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

    console.info(
      `[SyncEngine] Batch completato (${reason}): synced=${syncedCount}, errors=${errorCount}, pending=${remainingCount}, elapsed=${elapsedMs}ms`
    );

    emitEvent('sync:end', { syncedCount, errorCount, remainingCount, elapsedMs });

    if (networkFailure && remainingCount > 0) {
      scheduleRetry();
    }
  }

  function scheduleRetry() {
    if (retryTimerId) return;

    const delayMs = BACKOFF_DELAYS_MS[Math.min(retryAttempt, BACKOFF_DELAYS_MS.length - 1)];
    retryAttempt++;

    retryTimerId = setTimeout(async () => {
      retryTimerId = null;
      await flushOutbox({ reason: 'retry' });
    }, delayMs);
  }

  function clearScheduledRetry() {
    if (retryTimerId) {
      clearTimeout(retryTimerId);
      retryTimerId = null;
    }
  }

  function startPeriodicCheck() {
    if (periodicTimerId) return;

    periodicTimerId = setInterval(async () => {
      const store = global.offlineStore;
      if (!store) return;

      const count = await store.countPendingOperations().catch(() => 0);
      if (count > 0 && navigator.onLine) {
        await flushOutbox({ reason: 'periodic' });
      }
    }, PERIODIC_CHECK_INTERVAL_MS);
  }

  function stopPeriodicCheck() {
    if (periodicTimerId) {
      clearInterval(periodicTimerId);
      periodicTimerId = null;
    }
  }

  function init() {
    // Sincronizza all'avvio se ci sono operazioni pendenti
    flushOutbox({ reason: 'bootstrap' }).catch(console.error);

    // Sincronizza quando torna la connessione
    window.addEventListener('online', () => {
      clearScheduledRetry();
      retryAttempt = 0;
      flushOutbox({ reason: 'online' }).catch(console.error);
    });

    // Sospendi retry quando va offline
    window.addEventListener('offline', () => {
      clearScheduledRetry();
    });

    startPeriodicCheck();
  }

  global.syncEngine = {
    init,
    flushOutbox,
    onSyncEvent,
    offSyncEvent,
  };
})(window);
