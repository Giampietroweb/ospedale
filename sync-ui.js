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
  let refreshClockTimerId = null;

  // Quale path usare per il link alla pagina di report (rispetto alla pagina corrente)
  function syncReportHref() {
    const path = window.location.pathname;
    if (path.includes('/piani/')) return '../sync.html';
    return 'sync.html';
  }

  // ── Format utilities ───────────────────────────────────────────────────────

  function formatDateTime(isoString) {
    if (!isoString) return '—';
    const d = new Date(isoString);
    return d.toLocaleString('it-IT', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  }

  function formatShortTime(isoString) {
    if (!isoString) return '—';
    const d = new Date(isoString);
    return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  }

  function formatRelative(isoString) {
    if (!isoString) return '—';
    const diffSec = Math.round((Date.now() - new Date(isoString).getTime()) / 1000);
    if (diffSec < 0) return 'in arrivo';
    if (diffSec < 5) return 'ora';
    if (diffSec < 60) return `${diffSec}s fa`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m fa`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h fa`;
    return `${Math.floor(diffSec / 86400)}g fa`;
  }

  function statusLabel(status) {
    const map = {
      pending: 'In attesa',
      syncing: 'Sincronizzando',
      synced: 'Sincronizzato',
      error: 'Errore',
    };
    return map[status] || status;
  }

  function actionLabel(action) {
    const map = {
      saveField: 'Modifica campo stanza',
      saveApparecchiaturaRow: 'Apparecchiatura',
      saveImpiantisticaRow: 'Impiantistica',
      saveAltreDotazioniRow: 'Altre dotazioni',
    };
    return map[action] || action || '—';
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  }

  function describeRoom(roomRef) {
    if (!roomRef) return '—';
    const parts = [roomRef.blocco, roomRef.piano, roomRef.roomCode].filter(Boolean);
    return parts.join(' / ') || '—';
  }

  // ── Creazione elementi UI ──────────────────────────────────────────────────

  function createNetworkBadge() {
    const badge = document.createElement('button');
    badge.id = 'pwa-network-badge';
    badge.className = 'pwa-network-badge';
    badge.setAttribute('aria-live', 'polite');
    badge.setAttribute('aria-label', 'Stato connessione');
    badge.setAttribute('title', 'Stato connessione — clicca per dettaglio sync');
    badge.type = 'button';
    badge.addEventListener('click', toggleDebugPanel);
    return badge;
  }

  function createQueueBadge() {
    const badge = document.createElement('button');
    badge.id = 'pwa-queue-badge';
    badge.className = 'pwa-queue-badge pwa-queue-badge--idle';
    badge.setAttribute('aria-live', 'polite');
    badge.setAttribute('title', 'Coda operazioni — clicca per dettagli');
    badge.type = 'button';
    badge.addEventListener('click', toggleDebugPanel);
    return badge;
  }

  function createDebugPanel() {
    const panel = document.createElement('section');
    panel.id = 'pwa-debug-panel';
    panel.className = 'pwa-debug-panel';
    panel.style.display = 'none';
    panel.setAttribute('aria-label', 'Monitor sincronizzazione');

    panel.innerHTML = `
      <header class="pwa-debug-header">
        <div class="pwa-debug-header-text">
          <h3 class="pwa-debug-title">Monitor sincronizzazione</h3>
          <p class="pwa-debug-subtitle" id="pwa-debug-last-sync">Ultima sync: —</p>
        </div>
        <div class="pwa-debug-actions">
          <button id="pwa-sync-now-btn" type="button" class="pwa-debug-btn pwa-debug-btn--primary">Riprova ora</button>
          <button id="pwa-debug-close-btn" type="button" class="pwa-debug-close" aria-label="Chiudi pannello">&#x2715;</button>
        </div>
      </header>

      <div class="pwa-debug-summary">
        <div class="pwa-debug-stat" data-stat="pending">
          <span class="pwa-debug-stat-value" data-stat-value="pending">0</span>
          <span class="pwa-debug-stat-label">In attesa</span>
        </div>
        <div class="pwa-debug-stat" data-stat="syncing">
          <span class="pwa-debug-stat-value" data-stat-value="syncing">0</span>
          <span class="pwa-debug-stat-label">In corso</span>
        </div>
        <div class="pwa-debug-stat" data-stat="synced">
          <span class="pwa-debug-stat-value" data-stat-value="synced">0</span>
          <span class="pwa-debug-stat-label">Sincronizzate</span>
        </div>
        <div class="pwa-debug-stat" data-stat="error">
          <span class="pwa-debug-stat-value" data-stat-value="error">0</span>
          <span class="pwa-debug-stat-label">Errori</span>
        </div>
      </div>

      <p id="pwa-sync-status-line" class="pwa-sync-status-line" aria-live="polite"></p>

      <ul id="pwa-debug-list" class="pwa-debug-list" aria-label="Ultime operazioni outbox"></ul>
      <p id="pwa-debug-empty" class="pwa-debug-empty" hidden>Nessuna operazione registrata.</p>

      <footer class="pwa-debug-footer">
        <a id="pwa-debug-full-report" class="pwa-debug-footer-link" href="${syncReportHref()}">
          Apri report completo →
        </a>
      </footer>
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
        await refreshDebugPanel();
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
    debugPanelEl = createDebugPanel();
    debugListEl = debugPanelEl.querySelector('#pwa-debug-list');
    document.body.appendChild(debugPanelEl);

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
    const icon = isOnline
      ? '<span class="pwa-badge-dot pwa-badge-dot--online" aria-hidden="true"></span>'
      : '<span class="pwa-badge-dot pwa-badge-dot--offline" aria-hidden="true"></span>';
    networkBadgeEl.innerHTML = `${icon}<span class="pwa-badge-text">${isOnline ? 'Online' : 'Offline'}</span>`;
    networkBadgeEl.className = `pwa-network-badge pwa-network-badge--${isOnline ? 'online' : 'offline'}`;
  }

  async function updateQueueBadge() {
    if (!queueBadgeEl) return;

    if (!global.offlineStore) {
      queueBadgeEl.innerHTML = '<span class="pwa-badge-text">Sync</span>';
      queueBadgeEl.className = 'pwa-queue-badge pwa-queue-badge--idle';
      return;
    }

    try {
      const stats = await global.offlineStore.getStats();
      const pending = stats.pending || 0;
      const errors = stats.error || 0;
      const syncing = stats.syncing || 0;

      let cls = 'pwa-queue-badge--idle';
      let label = 'Sync';

      if (syncing > 0) {
        cls = 'pwa-queue-badge--syncing';
        label = `Sync ${syncing}...`;
      } else if (errors > 0) {
        cls = 'pwa-queue-badge--error';
        label = `${errors} errori`;
      } else if (pending > 0) {
        cls = 'pwa-queue-badge--active';
        label = `${pending} in coda`;
      }

      queueBadgeEl.innerHTML = `<span class="pwa-badge-text">${label}</span>`;
      queueBadgeEl.className = `pwa-queue-badge ${cls}`;
    } catch (err) {
      console.warn('[syncUI] Errore aggiornamento badge:', err);
    }
  }

  async function refreshDebugPanel() {
    await Promise.all([refreshDebugList(), updateLastSyncIndicator(), updateSummaryStats()]);
    await updateQueueBadge();
  }

  async function updateLastSyncIndicator() {
    if (!debugPanelEl || !global.offlineStore) return;
    const lastSyncAt = await global.offlineStore.getLastSyncAt().catch(() => null);
    const el = debugPanelEl.querySelector('#pwa-debug-last-sync');
    if (!el) return;
    if (lastSyncAt) {
      el.innerHTML = `Ultima sync: <strong>${formatShortTime(lastSyncAt)}</strong> <span class="pwa-debug-subtitle-rel">(${formatRelative(lastSyncAt)})</span>`;
    } else {
      el.textContent = 'Nessuna sincronizzazione ancora effettuata';
    }
  }

  async function updateSummaryStats() {
    if (!debugPanelEl || !global.offlineStore) return;
    const stats = await global.offlineStore.getStats().catch(() => null);
    if (!stats) return;
    ['pending', 'syncing', 'synced', 'error'].forEach((key) => {
      const el = debugPanelEl.querySelector(`[data-stat-value="${key}"]`);
      if (el) el.textContent = String(stats[key] || 0);
    });
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

      const roomDescription = describeRoom(op.roomRef);
      const createdLabel = formatShortTime(op.createdAt);
      const syncedLabel = op.syncedAt ? formatShortTime(op.syncedAt) : null;
      const attemptInfo = op.attemptCount > 0
        ? `<span class="pwa-debug-item-attempts" title="Tentativi effettuati">${op.attemptCount}×</span>`
        : '';

      const subtitleParts = [];
      subtitleParts.push(`<span class="pwa-debug-item-room">${escapeHtml(roomDescription)}</span>`);
      subtitleParts.push(`<span class="pwa-debug-item-time" title="Creato il ${formatDateTime(op.createdAt)}">${createdLabel}</span>`);
      if (syncedLabel) {
        subtitleParts.push(`<span class="pwa-debug-item-synced" title="Sincronizzato il ${formatDateTime(op.syncedAt)}">→ ${syncedLabel}</span>`);
      }

      li.innerHTML = `
        <div class="pwa-debug-item-row">
          <span class="pwa-debug-item-status">${statusLabel(op.status)}</span>
          <span class="pwa-debug-item-action">${escapeHtml(actionLabel(op.action))}</span>
          ${attemptInfo}
        </div>
        <div class="pwa-debug-item-meta">${subtitleParts.join('')}</div>
        ${op.error ? `<div class="pwa-debug-item-error" title="${escapeHtml(op.error)}">${escapeHtml(op.error)}</div>` : ''}
      `;
      debugListEl.appendChild(li);
    });
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
      console.error('[syncUI] showDebugPanel: debugPanelEl non inizializzato.');
      return;
    }
    isDebugPanelVisible = true;
    debugPanelEl.style.display = 'flex';
    refreshDebugPanel();

    // Aggiorna il "Ultima sync ... (X min fa)" ogni 15s quando il pannello è aperto
    if (refreshClockTimerId) clearInterval(refreshClockTimerId);
    refreshClockTimerId = setInterval(() => {
      if (isDebugPanelVisible) updateLastSyncIndicator();
    }, 15000);
  }

  function hideDebugPanel() {
    if (!debugPanelEl) return;
    isDebugPanelVisible = false;
    debugPanelEl.style.display = 'none';
    if (refreshClockTimerId) {
      clearInterval(refreshClockTimerId);
      refreshClockTimerId = null;
    }
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

    const time = formatShortTime(new Date().toISOString());
    const messages = {
      saved: `<strong>Salvato sul server</strong> alle ${time}`,
      queued: `<strong>Salvato in locale</strong> alle ${time} — sarà sincronizzato al ritorno online`,
      error: `<strong>Errore sincronizzazione</strong>${errorMessage ? ': ' + escapeHtml(errorMessage) : ''}`,
    };

    statusEl.innerHTML = messages[status] || '';

    clearTimeout(statusEl._hideTimer);
    if (status === 'saved') {
      statusEl._hideTimer = setTimeout(() => {
        statusEl.innerHTML = '';
        statusEl.className = 'pwa-save-status';
      }, 4000);
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

    // Aggiornamento immediato del badge dopo un enqueue
    window.addEventListener('pwa:enqueued', () => {
      updateQueueBadge();
      if (isDebugPanelVisible) refreshDebugPanel();
    });

    window.addEventListener('pwa:saved-online', () => {
      updateQueueBadge();
      if (isDebugPanelVisible) refreshDebugPanel();
    });

    if (global.syncEngine) {
      global.syncEngine.onSyncEvent(async (event) => {
        const relevantEvents = [
          'sync:end', 'sync:start', 'sync:skipped',
          'operation:synced', 'operation:error', 'operation:retry', 'operation:syncing',
        ];
        if (relevantEvents.includes(event.type)) {
          await updateQueueBadge();
          if (isDebugPanelVisible) {
            await refreshDebugPanel();
          }
        }

        if (event.type === 'sync:skipped' && isDebugPanelVisible) {
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
      });
    }
  }

  global.syncUI = {
    init,
    showSaveStatus,
    updateQueueBadge,
    showDebugPanel,
    hideDebugPanel,
    formatDateTime,
    formatShortTime,
    formatRelative,
    statusLabel,
    actionLabel,
    describeRoom,
  };
})(window);
