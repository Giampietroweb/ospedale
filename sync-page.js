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

  const MAX_ROWS = 500;
  const HISTORY_ENDPOINT = 'api/sync-history.php';

  const filters = {
    status: '',
    action: '',
    roomQuery: '',
    since: '',
  };

  let isRefreshing = false;
  let currentRows = [];
  let localOperationsById = new Map();
  let lastManualSyncAtOverride = null;

  // ── DOM utilities ──────────────────────────────────────────────────────────

  function $(id) { return document.getElementById(id); }

  function fmt(iso) {
    return iso ? window.syncUI.formatDateTime(iso) : '—';
  }

  function fmtRelative(iso) {
    return iso ? window.syncUI.formatRelative(iso) : '—';
  }

  function pickMostRecentIso(firstIso, secondIso) {
    const firstMs = firstIso ? new Date(firstIso).getTime() : 0;
    const secondMs = secondIso ? new Date(secondIso).getTime() : 0;
    if (!firstMs && !secondMs) return null;
    return firstMs >= secondMs ? firstIso : secondIso;
  }

  function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  }

  // ── Descrizione operazione ─────────────────────────────────────────────────

  function describePayloadShort(op) {
    const payload = op.payload || op.requestPayload || {};
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
    const uiStatus = op.status === 'success' ? 'synced' : op.status;
    if (filters.status && uiStatus !== filters.status) return false;
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
    const uiStatus = op.status === 'success' ? 'synced' : op.status;
    const statusName = window.syncUI.statusLabel(uiStatus);
    const detail = describePayloadShort(op);
    const errorMessage = op.error || op.errorMessage || null;
    const errorMarkup = errorMessage
      ? `<div class="sync-row-error" title="${escapeHtml(errorMessage)}">${escapeHtml(errorMessage)}</div>`
      : '';

    const canRetry = op.source === 'local' && (op.status === 'pending' || op.status === 'error');
    const canDelete = op.source === 'local';
    const operationTag = op.source === 'local'
      ? '<div class="sync-row-origin">Locale (questo browser)</div>'
      : '<div class="sync-row-origin">Storico server</div>';
    const processedAt = op.processedAt || op.syncedAt || null;

    return `
      <tr class="sync-row sync-row--${uiStatus}" data-id="${escapeHtml(op.id)}">
        <td data-label="Stato"><span class="sync-status-pill sync-status-pill--${uiStatus}">${statusName}</span></td>
        <td data-label="Operazione">${escapeHtml(actionName)}</td>
        <td data-label="Stanza"><code class="sync-room-code">${escapeHtml(room)}</code></td>
        <td data-label="Dettaglio">${detail}${operationTag}${errorMarkup}</td>
        <td data-label="Creato" title="${escapeHtml(fmt(op.createdAt))}">${escapeHtml(fmtRelative(op.createdAt))}<br><span class="sync-time-abs">${escapeHtml(fmt(op.createdAt))}</span></td>
        <td data-label="Ultimo tentativo" title="${op.lastAttemptAt ? escapeHtml(fmt(op.lastAttemptAt)) : ''}">${op.lastAttemptAt ? escapeHtml(fmtRelative(op.lastAttemptAt)) : '—'}</td>
        <td data-label="Sincronizzato" title="${processedAt ? escapeHtml(fmt(processedAt)) : ''}">${processedAt ? escapeHtml(fmtRelative(processedAt)) : '—'}</td>
        <td data-label="Tentativi" class="sync-cell-numeric">${op.attemptCount || 0}</td>
        <td data-label="Azioni" class="sync-actions-cell">
          <button type="button" class="sync-row-btn" data-action="detail" data-id="${escapeHtml(op.id)}">Dettaglio</button>
          ${canRetry ? `<button type="button" class="sync-row-btn sync-row-btn--primary" data-action="retry" data-id="${escapeHtml(op.id)}">Riprova</button>` : ''}
          ${canDelete ? `<button type="button" class="sync-row-btn sync-row-btn--danger" data-action="delete" data-id="${escapeHtml(op.id)}">Elimina</button>` : ''}
        </td>
      </tr>
    `;
  }

  // ── Aggiornamento dati ─────────────────────────────────────────────────────

  function buildHistoryUrl() {
    const params = new URLSearchParams();
    params.set('limit', String(MAX_ROWS));
    params.set('offset', '0');
    if (filters.status) {
      const statusToOutcome = { synced: 'success', error: 'error', pending: 'pending' };
      const outcome = statusToOutcome[filters.status] || filters.status;
      params.set('outcome', outcome);
    }
    if (filters.action) params.set('action', filters.action);
    if (filters.roomQuery) params.set('roomQuery', filters.roomQuery);
    if (filters.since) params.set('since', filters.since);
    return `${HISTORY_ENDPOINT}?${params.toString()}`;
  }

  async function fetchServerHistory() {
    const response = await fetch(buildHistoryUrl(), {
      headers: { Accept: 'application/json' },
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.error || `HTTP ${response.status}`);
    }
    return payload;
  }

  function toUiRowFromServer(row) {
    const roomRef = row.roomRef || {};
    const requestPayload = row.requestPayload || {};
    const responsePayload = row.responsePayload || {};
    return {
      id: row.operationId || `${row.action}-${row.createdAt || Date.now()}`,
      source: 'server',
      status: row.outcome || 'success',
      action: row.action || 'unknown',
      roomRef: {
        blocco: roomRef.blocco || '',
        piano: roomRef.piano || '',
        roomCode: roomRef.roomCode || '',
      },
      payload: requestPayload,
      requestPayload,
      responsePayload,
      serverResponse: responsePayload,
      errorMessage: row.errorMessage || null,
      error: row.errorMessage || null,
      createdAt: row.createdAt || null,
      lastAttemptAt: row.processedAt || null,
      processedAt: row.processedAt || null,
      syncedAt: row.processedAt || null,
      attemptCount: 0,
    };
  }

  function toUiRowFromLocal(operation) {
    return {
      ...operation,
      source: 'local',
      id: operation.id,
      processedAt: operation.syncedAt || null,
      requestPayload: operation.payload || null,
      responsePayload: operation.serverResponse || null,
      errorMessage: operation.error || null,
    };
  }

  async function refresh() {
    if (isRefreshing) return;
    isRefreshing = true;
    try {
      const [historyPayload, localOps, localStats, localLastSyncAt] = await Promise.all([
        fetchServerHistory(),
        window.offlineStore.listAllOperations({ limit: MAX_ROWS }),
        window.offlineStore.getStats(),
        window.offlineStore.getLastSyncAt(),
      ]);
      const localOutstanding = (localOps || []).filter((op) => op.status === 'pending' || op.status === 'error');
      localOperationsById = new Map(localOutstanding.map((op) => [op.id, op]));
      const serverRows = (historyPayload.rows || []).map(toUiRowFromServer);
      const localRows = localOutstanding.map(toUiRowFromLocal);
      currentRows = [...localRows, ...serverRows];
      const serverLastSyncAt = historyPayload?.stats?.lastSuccessAt || null;
      renderSummary(historyPayload.stats || {}, localStats, serverLastSyncAt, localLastSyncAt);
      renderTable();
    } catch (err) {
      console.error('[syncPage] Errore refresh:', err);
    } finally {
      isRefreshing = false;
    }
  }

  function renderSummary(serverStats, localStats, serverLastSyncAt, localLastSyncAt) {
    $('syncStatPending').textContent = (localStats?.pending || 0);
    $('syncStatSyncing').textContent = (localStats?.syncing || 0);
    $('syncStatSynced').textContent = (serverStats.success || 0);
    $('syncStatError').textContent = (serverStats.error || 0);

    const effectiveLastSyncAt = pickMostRecentIso(
      pickMostRecentIso(serverLastSyncAt, localLastSyncAt),
      lastManualSyncAtOverride
    );
    if (effectiveLastSyncAt) {
      $('syncLastSync').innerHTML = `${fmt(effectiveLastSyncAt)}<br><span class="sync-time-rel">${fmtRelative(effectiveLastSyncAt)}</span>`;
    } else {
      $('syncLastSync').textContent = 'Nessuna sincronizzazione manuale eseguita';
    }

    const online = navigator.onLine;
    const netEl = $('syncNetworkStatus');
    netEl.innerHTML = online
      ? '<span class="sync-net-dot sync-net-dot--online"></span> Dispositivo online'
      : '<span class="sync-net-dot sync-net-dot--offline"></span> Dispositivo offline';
  }

  // ── Azioni ─────────────────────────────────────────────────────────────────

  async function retryOperation(id, btn) {
    const localOp = localOperationsById.get(id);
    if (!localOp) return;
    if (btn) {
      btn.disabled = true;
      btn.textContent = '…';
    }
    try {
      if (!navigator.onLine) {
        alert('Dispositivo offline. Connettiti e riprova.');
        return;
      }
      const result = await window.syncEngine.syncSingleById(localOp.id);
      if (!result.success && result.reason !== 'already-synced') {
        console.warn('[syncPage] Retry non riuscito:', result);
      } else if (result.success) {
        // Aggiornamento UI immediato anche prima del rientro completo dello storico server.
        lastManualSyncAtOverride = new Date().toISOString();
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
    const localOp = localOperationsById.get(id);
    if (!localOp) return;
    if (!confirm('Eliminare definitivamente questa operazione dalla coda locale? L\'azione non può essere annullata.')) return;
    try {
      await window.offlineStore.deleteOperation(localOp.id);
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
      lastManualSyncAtOverride = new Date().toISOString();
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
      ['Origine', op.source === 'local' ? 'Coda locale (questo browser)' : 'Storico server'],
      ['Ultimo aggiornamento', fmt(op.updatedAt || op.processedAt || op.createdAt)],
      ['Ultimo tentativo', op.lastAttemptAt ? fmt(op.lastAttemptAt) : '—'],
      ['Sincronizzato', (op.processedAt || op.syncedAt) ? fmt(op.processedAt || op.syncedAt) : '—'],
      ['Tentativi', op.attemptCount || 0],
    ];
    if (op.error || op.errorMessage) rows.push(['Ultimo errore', op.error || op.errorMessage]);

    meta.innerHTML = rows.map(([k, v]) =>
      `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`
    ).join('');

    try {
      payloadPre.textContent = JSON.stringify(op.requestPayload || op.payload, null, 2);
    } catch {
      payloadPre.textContent = String(op.payload);
    }

    if (op.responsePayload || op.serverResponse) {
      responseTitle.hidden = false;
      responsePre.hidden = false;
      try {
        responsePre.textContent = JSON.stringify(op.responsePayload || op.serverResponse, null, 2);
      } catch {
        responsePre.textContent = String(op.responsePayload || op.serverResponse);
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

  // ── Inizializzazione ───────────────────────────────────────────────────────

  function bindFilters() {
    $('syncFilterStatus').addEventListener('change', (e) => { filters.status = e.target.value; renderTable(); });
    $('syncFilterAction').addEventListener('change', (e) => { filters.action = e.target.value; renderTable(); });
    $('syncFilterSince').addEventListener('change', (e) => { filters.since = e.target.value; renderTable(); });
    $('syncFilterRoom').addEventListener('input', (e) => { filters.roomQuery = e.target.value; renderTable(); });

    $('syncBtnRefresh').addEventListener('click', () => refresh());
    $('syncBtnFlush').addEventListener('click', (e) => flushNow(e.currentTarget));
    $('syncBtnClearSynced').addEventListener('click', clearAllSynced);

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
  }

  global.syncPage = { init, refresh };
})(window);
