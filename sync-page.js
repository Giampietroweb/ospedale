/**
 * sync-page.js
 *
 * Logica della pagina sync.html — Monitor sincronizzazione.
 * Mostra una tabella dettagliata di tutte le operazioni outbox con filtri e azioni.
 *
 * Esposto come window.syncPage. Dipende da offline-store.js, sync-engine.js, sync-ui.js.
 */

(function (global) {
  'use strict';

  const AUTO_REFRESH_INTERVAL_MS = 5000;
  const MAX_ROWS = 500;

  const filters = {
    status: '',
    action: '',
    roomQuery: '',
    since: '',
  };

  let autoRefreshTimerId = null;
  let isRefreshing = false;
  let currentRows = [];

  // ── DOM utilities ──────────────────────────────────────────────────────────

  function $(id) { return document.getElementById(id); }

  function fmt(iso) {
    return iso ? window.syncUI.formatDateTime(iso) : '—';
  }

  function fmtRelative(iso) {
    return iso ? window.syncUI.formatRelative(iso) : '—';
  }

  function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  }

  // ── Descrizione operazione ─────────────────────────────────────────────────

  function describePayloadShort(op) {
    const payload = op.payload || {};
    const row = payload.row || {};
    switch (op.action) {
      case 'saveField':
        return `${escapeHtml(payload.fieldName || '—')}: ${escapeHtml(payload.value ?? '(vuoto)')}`;
      case 'saveApparecchiaturaRow':
        return escapeHtml(
          row.apparecchiatura || row.tipologia || row.modello || `riga #${payload.rowIndex ?? '?'}`
        );
      case 'saveImpiantisticaRow':
        return escapeHtml(row.tipologia || `riga #${payload.rowIndex ?? '?'}`);
      case 'saveAltreDotazioniRow':
        return escapeHtml(row.altraDotazione || `riga #${payload.rowIndex ?? '?'}`);
      default:
        return '—';
    }
  }

  // ── Filtri ─────────────────────────────────────────────────────────────────

  function matchesFilters(op) {
    if (filters.status && op.status !== filters.status) return false;
    if (filters.action && op.action !== filters.action) return false;
    if (filters.since) {
      const sinceMs = new Date(filters.since).getTime();
      if (new Date(op.createdAt).getTime() < sinceMs) return false;
    }
    if (filters.roomQuery) {
      const q = filters.roomQuery.trim().toLowerCase();
      if (!q) return true;
      const room = op.roomRef || {};
      const desc = `${room.blocco || ''}/${room.piano || ''}/${room.roomCode || ''}`.toLowerCase();
      if (!desc.includes(q)) return false;
    }
    return true;
  }

  // ── Render tabella ─────────────────────────────────────────────────────────

  function renderTable() {
    const tbody = $('syncTableBody');
    if (!tbody) return;

    const filtered = currentRows.filter(matchesFilters);

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" class="estrazioni-empty">Nessuna operazione corrisponde ai filtri.</td></tr>';
      $('syncTableFooter').textContent = `0 operazioni mostrate (totale: ${currentRows.length})`;
      return;
    }

    tbody.innerHTML = filtered.map((op) => renderRow(op)).join('');

    // Eventi sui pulsanti delle righe
    filtered.forEach((op) => {
      const detailBtn = tbody.querySelector(`[data-action="detail"][data-id="${op.id}"]`);
      if (detailBtn) detailBtn.addEventListener('click', () => openDetailModal(op));

      const retryBtn = tbody.querySelector(`[data-action="retry"][data-id="${op.id}"]`);
      if (retryBtn) retryBtn.addEventListener('click', () => retryOperation(op.id, retryBtn));

      const deleteBtn = tbody.querySelector(`[data-action="delete"][data-id="${op.id}"]`);
      if (deleteBtn) deleteBtn.addEventListener('click', () => deleteOperation(op.id));
    });

    $('syncTableFooter').textContent = `${filtered.length} operazioni mostrate (totale: ${currentRows.length})`;
  }

  function renderRow(op) {
    const room = window.syncUI.describeRoom(op.roomRef);
    const actionName = window.syncUI.actionLabel(op.action);
    const statusName = window.syncUI.statusLabel(op.status);
    const detail = describePayloadShort(op);
    const errorMarkup = op.error
      ? `<div class="sync-row-error" title="${escapeHtml(op.error)}">${escapeHtml(op.error)}</div>`
      : '';

    const canRetry = op.status === 'pending' || op.status === 'error';

    return `
      <tr class="sync-row sync-row--${op.status}" data-id="${escapeHtml(op.id)}">
        <td data-label="Stato"><span class="sync-status-pill sync-status-pill--${op.status}">${statusName}</span></td>
        <td data-label="Operazione">${escapeHtml(actionName)}</td>
        <td data-label="Stanza"><code class="sync-room-code">${escapeHtml(room)}</code></td>
        <td data-label="Dettaglio">${detail}${errorMarkup}</td>
        <td data-label="Creato" title="${escapeHtml(fmt(op.createdAt))}">${escapeHtml(fmtRelative(op.createdAt))}<br><span class="sync-time-abs">${escapeHtml(fmt(op.createdAt))}</span></td>
        <td data-label="Ultimo tentativo" title="${op.lastAttemptAt ? escapeHtml(fmt(op.lastAttemptAt)) : ''}">${op.lastAttemptAt ? escapeHtml(fmtRelative(op.lastAttemptAt)) : '—'}</td>
        <td data-label="Sincronizzato" title="${op.syncedAt ? escapeHtml(fmt(op.syncedAt)) : ''}">${op.syncedAt ? escapeHtml(fmtRelative(op.syncedAt)) : '—'}</td>
        <td data-label="Tentativi" class="sync-cell-numeric">${op.attemptCount || 0}</td>
        <td data-label="Azioni" class="sync-actions-cell">
          <button type="button" class="sync-row-btn" data-action="detail" data-id="${escapeHtml(op.id)}">Dettaglio</button>
          ${canRetry ? `<button type="button" class="sync-row-btn sync-row-btn--primary" data-action="retry" data-id="${escapeHtml(op.id)}">Riprova</button>` : ''}
          <button type="button" class="sync-row-btn sync-row-btn--danger" data-action="delete" data-id="${escapeHtml(op.id)}">Elimina</button>
        </td>
      </tr>
    `;
  }

  // ── Aggiornamento dati ─────────────────────────────────────────────────────

  async function refresh() {
    if (isRefreshing) return;
    isRefreshing = true;
    try {
      const [ops, stats, lastSyncAt] = await Promise.all([
        window.offlineStore.listAllOperations({ limit: MAX_ROWS }),
        window.offlineStore.getStats(),
        window.offlineStore.getLastSyncAt(),
      ]);
      currentRows = ops;
      renderSummary(stats, lastSyncAt);
      renderTable();
    } catch (err) {
      console.error('[syncPage] Errore refresh:', err);
    } finally {
      isRefreshing = false;
    }
  }

  function renderSummary(stats, lastSyncAt) {
    $('syncStatPending').textContent = stats.pending || 0;
    $('syncStatSyncing').textContent = stats.syncing || 0;
    $('syncStatSynced').textContent = stats.synced || 0;
    $('syncStatError').textContent = stats.error || 0;

    if (lastSyncAt) {
      $('syncLastSync').innerHTML = `${fmt(lastSyncAt)}<br><span class="sync-time-rel">${fmtRelative(lastSyncAt)}</span>`;
    } else {
      $('syncLastSync').textContent = 'Mai';
    }

    const online = navigator.onLine;
    const netEl = $('syncNetworkStatus');
    netEl.innerHTML = online
      ? '<span class="sync-net-dot sync-net-dot--online"></span> Dispositivo online'
      : '<span class="sync-net-dot sync-net-dot--offline"></span> Dispositivo offline';
  }

  // ── Azioni ─────────────────────────────────────────────────────────────────

  async function retryOperation(id, btn) {
    if (btn) {
      btn.disabled = true;
      btn.textContent = '…';
    }
    try {
      if (!navigator.onLine) {
        alert('Dispositivo offline. Connettiti e riprova.');
        return;
      }
      const result = await window.syncEngine.syncSingleById(id);
      if (!result.success && result.reason !== 'already-synced') {
        console.warn('[syncPage] Retry non riuscito:', result);
      }
    } catch (err) {
      console.error('[syncPage] retryOperation:', err);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Riprova';
      }
      await refresh();
    }
  }

  async function deleteOperation(id) {
    if (!confirm('Eliminare definitivamente questa operazione dalla coda locale? L\'azione non può essere annullata.')) return;
    try {
      await window.offlineStore.deleteOperation(id);
      await refresh();
    } catch (err) {
      console.error('[syncPage] deleteOperation:', err);
      alert('Errore eliminazione: ' + err.message);
    }
  }

  async function clearAllSynced() {
    if (!confirm('Eliminare tutte le operazioni sincronizzate dal log locale? Resteranno solo quelle in attesa o in errore.')) return;
    try {
      const removed = await window.offlineStore.deleteAllSyncedOperations();
      await refresh();
      console.info(`[syncPage] Eliminate ${removed} operazioni sincronizzate.`);
    } catch (err) {
      console.error('[syncPage] clearAllSynced:', err);
      alert('Errore pulizia: ' + err.message);
    }
  }

  async function flushNow(btn) {
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Sincronizzazione…';
    }
    try {
      if (!navigator.onLine) {
        alert('Dispositivo offline. Connettiti per sincronizzare.');
        return;
      }
      await window.syncEngine.flushOutbox({ reason: 'sync-page' });
    } catch (err) {
      console.error('[syncPage] flushNow:', err);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Sincronizza ora';
      }
      await refresh();
    }
  }

  // ── Modal dettaglio ────────────────────────────────────────────────────────

  function openDetailModal(op) {
    const overlay = $('syncDetailModal');
    const meta = $('syncDetailMeta');
    const payloadPre = $('syncDetailPayload');
    const responsePre = $('syncDetailResponse');
    const responseTitle = $('syncDetailResponseTitle');

    const room = window.syncUI.describeRoom(op.roomRef);
    const rows = [
      ['ID operazione', op.id],
      ['Tipo', window.syncUI.actionLabel(op.action)],
      ['Stato', window.syncUI.statusLabel(op.status)],
      ['Stanza', room],
      ['Creato', fmt(op.createdAt)],
      ['Ultimo aggiornamento', fmt(op.updatedAt)],
      ['Ultimo tentativo', op.lastAttemptAt ? fmt(op.lastAttemptAt) : '—'],
      ['Sincronizzato', op.syncedAt ? fmt(op.syncedAt) : '—'],
      ['Tentativi', op.attemptCount || 0],
    ];
    if (op.error) rows.push(['Ultimo errore', op.error]);

    meta.innerHTML = rows.map(([k, v]) =>
      `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`
    ).join('');

    try {
      payloadPre.textContent = JSON.stringify(op.payload, null, 2);
    } catch {
      payloadPre.textContent = String(op.payload);
    }

    if (op.serverResponse) {
      responseTitle.hidden = false;
      responsePre.hidden = false;
      try {
        responsePre.textContent = JSON.stringify(op.serverResponse, null, 2);
      } catch {
        responsePre.textContent = String(op.serverResponse);
      }
    } else {
      responseTitle.hidden = true;
      responsePre.hidden = true;
    }

    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
  }

  function closeDetailModal() {
    const overlay = $('syncDetailModal');
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
  }

  // ── Auto-refresh ───────────────────────────────────────────────────────────

  function startAutoRefresh() {
    if (autoRefreshTimerId) return;
    autoRefreshTimerId = setInterval(refresh, AUTO_REFRESH_INTERVAL_MS);
  }

  function stopAutoRefresh() {
    if (autoRefreshTimerId) {
      clearInterval(autoRefreshTimerId);
      autoRefreshTimerId = null;
    }
  }

  // ── Inizializzazione ───────────────────────────────────────────────────────

  function bindFilters() {
    $('syncFilterStatus').addEventListener('change', (e) => { filters.status = e.target.value; renderTable(); });
    $('syncFilterAction').addEventListener('change', (e) => { filters.action = e.target.value; renderTable(); });
    $('syncFilterSince').addEventListener('change', (e) => { filters.since = e.target.value; renderTable(); });
    $('syncFilterRoom').addEventListener('input', (e) => { filters.roomQuery = e.target.value; renderTable(); });

    $('syncBtnRefresh').addEventListener('click', () => refresh());
    $('syncBtnFlush').addEventListener('click', (e) => flushNow(e.currentTarget));
    $('syncBtnClearSynced').addEventListener('click', clearAllSynced);

    $('syncAutoRefresh').addEventListener('change', (e) => {
      if (e.target.checked) startAutoRefresh();
      else stopAutoRefresh();
    });

    $('syncDetailClose').addEventListener('click', closeDetailModal);
    $('syncDetailModal').addEventListener('click', (e) => {
      if (e.target.id === 'syncDetailModal') closeDetailModal();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeDetailModal();
    });

    window.addEventListener('online', refresh);
    window.addEventListener('offline', refresh);
    window.addEventListener('pwa:enqueued', refresh);
    window.addEventListener('pwa:saved-online', refresh);

    if (window.syncEngine) {
      window.syncEngine.onSyncEvent((event) => {
        if (event.type === 'sync:end' || event.type === 'operation:synced' || event.type === 'operation:error') {
          refresh();
        }
      });
    }
  }

  function init() {
    bindFilters();
    refresh();
    if ($('syncAutoRefresh').checked) startAutoRefresh();
  }

  global.syncPage = { init, refresh };
})(window);
