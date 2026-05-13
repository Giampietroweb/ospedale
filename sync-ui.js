/**
 * sync-ui.js
 *
 * Componenti UI per lo stato rete e la coda di sincronizzazione offline.
 * Si integra con window.syncEngine e window.offlineStore tramite pub/sub.
 * Esposto come window.syncUI.
 *
 * Dipende da: offline-store.js, sync-engine.js
 */

(function (global) {
  'use strict';

  // ── Stato ──────────────────────────────────────────────────────────────────

  let networkBadgeEl = null;
  let queueBadgeEl = null;
  let debugPanelEl = null;
  let debugListEl = null;
  let isDebugPanelVisible = false;

  // ── Creazione elementi UI ──────────────────────────────────────────────────

  function createNetworkBadge() {
    const badge = document.createElement('button');
    badge.id = 'pwa-network-badge';
    badge.className = 'pwa-network-badge';
    badge.setAttribute('aria-live', 'polite');
    badge.setAttribute('aria-label', 'Stato connessione — clicca per monitor sync');
    badge.setAttribute('title', 'Monitor sincronizzazione');
    badge.type = 'button';
    badge.addEventListener('click', toggleDebugPanel);
    return badge;
  }

  function createQueueBadge() {
    const badge = document.createElement('button');
    badge.id = 'pwa-queue-badge';
    badge.className = 'pwa-queue-badge pwa-queue-badge--idle';
    badge.setAttribute('aria-live', 'polite');
    badge.setAttribute('title', 'Operazioni in coda — clicca per dettagli');
    badge.type = 'button';
    badge.addEventListener('click', toggleDebugPanel);
    return badge;
  }

  function createDebugPanel() {
    const panel = document.createElement('div');
    panel.id = 'pwa-debug-panel';
    panel.className = 'pwa-debug-panel';
    panel.style.display = 'none';
    panel.setAttribute('aria-label', 'Monitor sincronizzazione');

    panel.innerHTML = `
      <div class="pwa-debug-header">
        <h3 class="pwa-debug-title">Monitor sincronizzazione</h3>
        <div class="pwa-debug-actions">
          <button id="pwa-sync-now-btn" type="button" class="pwa-debug-btn">Riprova ora</button>
          <button id="pwa-debug-close-btn" type="button" class="pwa-debug-close" aria-label="Chiudi pannello">&#x2715;</button>
        </div>
      </div>
      <p id="pwa-sync-status-line" class="pwa-sync-status-line" aria-live="polite"></p>
      <ul id="pwa-debug-list" class="pwa-debug-list" aria-label="Ultime operazioni outbox"></ul>
      <p id="pwa-debug-empty" class="pwa-debug-empty">Nessuna operazione in coda.</p>
    `;

    panel.querySelector('#pwa-sync-now-btn').addEventListener('click', async () => {
      const btn = panel.querySelector('#pwa-sync-now-btn');
      if (!btn || btn.disabled) return;

      btn.disabled = true;
      btn.textContent = 'Sincronizzando...';

      try {
        if (global.syncEngine) {
          await global.syncEngine.flushOutbox({ reason: 'manual' });
        }
        await refreshDebugList();
        await updateQueueBadge();
      } catch (err) {
        console.error('[syncUI] Errore durante "Riprova ora":', err);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Riprova ora';
      }
    });

    panel.querySelector('#pwa-debug-close-btn').addEventListener('click', () => {
      hideDebugPanel();
    });

    return panel;
  }

  function mountUI() {
    // Il pannello è appeso direttamente al body — indipendente dalla struttura toolbar
    debugPanelEl = createDebugPanel();
    debugListEl = debugPanelEl.querySelector('#pwa-debug-list');
    document.body.appendChild(debugPanelEl);

    // I badge sono in un contenitore fisso in alto a destra,
    // per evitare conflitti con il grid a 3 colonne del toolbar planimetria
    const badgeContainer = document.createElement('div');
    badgeContainer.id = 'pwa-badge-container';
    badgeContainer.className = 'pwa-badge-container';
    document.body.appendChild(badgeContainer);

    networkBadgeEl = createNetworkBadge();
    queueBadgeEl = createQueueBadge();
    badgeContainer.appendChild(networkBadgeEl);
    badgeContainer.appendChild(queueBadgeEl);
  }

  // ── Aggiornamenti UI ───────────────────────────────────────────────────────

  function updateNetworkBadge(isOnline) {
    if (!networkBadgeEl) return;
    networkBadgeEl.textContent = isOnline ? 'Online' : 'Offline';
    networkBadgeEl.className = `pwa-network-badge pwa-network-badge--${isOnline ? 'online' : 'offline'}`;
  }

  async function updateQueueBadge() {
    if (!queueBadgeEl) return;

    if (!global.offlineStore) {
      queueBadgeEl.textContent = 'Sync';
      queueBadgeEl.className = 'pwa-queue-badge pwa-queue-badge--idle';
      return;
    }

    const count = await global.offlineStore.countPendingOperations().catch(() => 0);
    if (count > 0) {
      queueBadgeEl.textContent = `${count} in coda`;
      queueBadgeEl.className = 'pwa-queue-badge pwa-queue-badge--active';
    } else {
      queueBadgeEl.textContent = 'Sync';
      queueBadgeEl.className = 'pwa-queue-badge pwa-queue-badge--idle';
    }
  }

  async function refreshDebugList() {
    if (!debugListEl || !global.offlineStore) return;

    const emptyEl = debugPanelEl.querySelector('#pwa-debug-empty');
    const ops = await global.offlineStore.listAllOperations({ limit: 20 }).catch(() => []);

    debugListEl.innerHTML = '';

    if (ops.length === 0) {
      emptyEl.hidden = false;
      return;
    }

    emptyEl.hidden = true;

    ops.forEach((op) => {
      const li = document.createElement('li');
      li.className = `pwa-debug-item pwa-debug-item--${op.status}`;

      const time = new Date(op.createdAt).toLocaleString('it-IT', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
      });

      li.innerHTML = `
        <span class="pwa-debug-item-status">${statusLabel(op.status)}</span>
        <span class="pwa-debug-item-action">${escapeHtml(op.action)}</span>
        <span class="pwa-debug-item-time">${time}</span>
        ${op.error ? `<span class="pwa-debug-item-error">${escapeHtml(op.error)}</span>` : ''}
      `;
      debugListEl.appendChild(li);
    });
  }

  function statusLabel(status) {
    const map = {
      pending: 'In attesa',
      syncing: 'Sincronizzando...',
      synced: 'Sincronizzato',
      error: 'Errore',
    };
    return map[status] || status;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  }

  // ── Pannello debug ─────────────────────────────────────────────────────────

  function toggleDebugPanel() {
    if (isDebugPanelVisible) {
      hideDebugPanel();
    } else {
      showDebugPanel();
    }
  }

  function showDebugPanel() {
    if (!debugPanelEl) {
      console.error('[syncUI] showDebugPanel: debugPanelEl non inizializzato. Chiama syncUI.init() prima.');
      return;
    }
    isDebugPanelVisible = true;
    debugPanelEl.style.display = 'block';
    refreshDebugList();
  }

  function hideDebugPanel() {
    if (!debugPanelEl) return;
    isDebugPanelVisible = false;
    debugPanelEl.style.display = 'none';
  }

  // ── Feedback salvataggio modale ────────────────────────────────────────────

  /**
   * Mostra un messaggio di esito salvataggio nella modale stanza.
   *
   * @param {'saved'|'queued'|'error'} status
   * @param {string} [errorMessage]
   */
  function showSaveStatus(status, errorMessage) {
    let statusEl = document.getElementById('pwa-save-status');
    if (!statusEl) {
      statusEl = document.createElement('p');
      statusEl.id = 'pwa-save-status';
      statusEl.className = 'pwa-save-status';
      statusEl.setAttribute('aria-live', 'polite');
      statusEl.setAttribute('role', 'status');

      const modalFooter = document.querySelector('.modal-footer, .modal-actions, .modal-save-section');
      if (modalFooter) {
        modalFooter.prepend(statusEl);
      }
    }

    statusEl.className = `pwa-save-status pwa-save-status--${status}`;

    const messages = {
      saved: 'Salvato sul server',
      queued: 'Salvato in locale, in attesa di sincronizzazione',
      error: `Errore sincronizzazione${errorMessage ? ': ' + errorMessage : ''}`,
    };

    statusEl.textContent = messages[status] || '';

    clearTimeout(statusEl._hideTimer);
    if (status === 'saved') {
      statusEl._hideTimer = setTimeout(() => {
        statusEl.textContent = '';
        statusEl.className = 'pwa-save-status';
      }, 3000);
    }
  }

  // ── Inizializzazione ───────────────────────────────────────────────────────

  function init() {
    if (debugPanelEl) {
      console.warn('[syncUI] init() chiamato più volte — skip.');
      return;
    }

    mountUI();

    if (!debugPanelEl) {
      console.error('[syncUI] mountUI() fallito: impossibile inizializzare i componenti PWA.');
      return;
    }

    updateNetworkBadge(navigator.onLine);
    updateQueueBadge();

    window.addEventListener('online', () => {
      updateNetworkBadge(true);
      updateQueueBadge();
    });

    window.addEventListener('offline', () => {
      updateNetworkBadge(false);
      updateQueueBadge();
    });

    if (global.syncEngine) {
      global.syncEngine.onSyncEvent(async (event) => {
        const relevantEvents = [
          'sync:end', 'sync:skipped',
          'operation:synced', 'operation:error', 'operation:retry',
        ];
        if (relevantEvents.includes(event.type)) {
          await updateQueueBadge();
          if (isDebugPanelVisible) {
            await refreshDebugList();
          }
        }

        if (event.type === 'sync:skipped' && isDebugPanelVisible) {
          const btn = debugPanelEl && debugPanelEl.querySelector('#pwa-sync-now-btn');
          if (btn && !btn.disabled) {
            const reason = event.detail?.reason === 'offline'
              ? 'Dispositivo offline'
              : 'Sincronizzazione già in corso';
            const statusLine = debugPanelEl.querySelector('#pwa-sync-status-line');
            if (statusLine) {
              statusLine.textContent = reason;
              clearTimeout(statusLine._timer);
              statusLine._timer = setTimeout(() => { statusLine.textContent = ''; }, 3000);
            }
          }
        }
      });
    }
  }

  global.syncUI = {
    init,
    showSaveStatus,
    updateQueueBadge,
    showDebugPanel,
    hideDebugPanel,
  };
})(window);
