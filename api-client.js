/**
 * api-client.js
 *
 * Wrapper per le chiamate POST verso save-modal.php.
 * Se online tenta l'invio diretto; se offline o in caso di errore di rete
 * accoda l'operazione in IndexedDB tramite window.offlineStore.
 *
 * Dipende da offline-store.js che deve essere caricato prima.
 */

(function (global) {
  'use strict';

  const SAVE_ENDPOINT = '../api/save-modal.php';

  function isNetworkError(error) {
    return (
      error instanceof TypeError &&
      (error.message.includes('Failed to fetch') ||
        error.message.includes('NetworkError') ||
        error.message.includes('Network request failed') ||
        error.message.includes('Load failed'))
    );
  }

  async function enqueueAndReturn(action, body, operationId) {
    const store = global.offlineStore;
    await store.enqueueOutboxOperation({
      id: operationId,
      action,
      payload: body,
    });
    return { status: 'queued', operationId };
  }

  /**
   * Invia un salvataggio al server oppure lo accoda offline.
   *
   * @param {string} action - es. 'saveField', 'saveApparecchiaturaRow'
   * @param {object} roomRef - { blocco, piano, roomCode }
   * @param {object} autoAttributes - attributi automatici stanza
   * @param {object} extraPayload - payload specifico dell'azione
   * @returns {Promise<{ status: 'saved'|'queued', operationId: string, payload?: object }>}
   */
  async function saveRoom(action, roomRef, autoAttributes, extraPayload) {
    const store = global.offlineStore;
    if (!store) {
      throw new Error('[api-client] offline-store.js non ancora caricato');
    }

    const operationId = store.generateOperationId();
    const body = {
      action,
      roomRef,
      autoAttributes,
      operationId,
      ...(extraPayload || {}),
    };

    if (navigator.onLine) {
      try {
        const response = await fetch(SAVE_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        const responsePayload = await response.json();

        if (!response.ok || !responsePayload?.ok) {
          const errorMessage = responsePayload?.error || `HTTP ${response.status}`;

          // Errori 4xx applicativi: non accodare, sono errori di validazione
          if (response.status >= 400 && response.status < 500) {
            throw new Error(errorMessage);
          }

          // Errori 5xx: accoda per retry
          return enqueueAndReturn(action, body, operationId);
        }

        return { status: 'saved', operationId, payload: responsePayload };
      } catch (error) {
        if (isNetworkError(error)) {
          return enqueueAndReturn(action, body, operationId);
        }
        throw error;
      }
    }

    return enqueueAndReturn(action, body, operationId);
  }

  global.apiClient = { saveRoom };
})(window);
