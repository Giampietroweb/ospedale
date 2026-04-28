/**
 * Pagina estrazioni: filtri a cascata e ricerca per tipo (apparecchiature, impiantistica, altre dotazioni).
 */

const API_URL = 'api/estrazioni.php';
const EXPORT_URL = 'api/estrazioni-export.php';
const SENZA_REPARTO_VALUE = '__SENZA_REPARTO__';

const BLOCCO_LABELS = {
  nord: 'Blocco Nord',
  sud: 'Blocco Sud',
  piastra: 'Piastra Centrale',
  sotterraneo: 'Interrato',
};

const TIPO_DETTAGLIO_LABEL = {
  apparecchiature: 'Apparecchiatura',
  impiantistica: 'Tipologia impiantistica',
  altre_dotazioni: 'Altra dotazione',
};

const TABLE_HEADERS = {
  apparecchiature: [
    'Blocco',
    'Piano',
    'Reparto',
    'ID Stanza',
    'Apparecchiatura',
    'Tipologia',
    'Produttore',
    'Modello',
    'Q.tà',
    'Nuovo',
    'Trasferimento',
    'Inv.',
    'Note',
  ],
  impiantistica: [
    'Blocco',
    'Piano',
    'Reparto',
    'ID Stanza',
    'Tipologia impiantistica',
    'Q.tà presenti',
    'Q.tà da implementare',
    'Note',
  ],
  altre_dotazioni: [
    'Blocco',
    'Piano',
    'Reparto',
    'ID Stanza',
    'Altra dotazione',
    'Presente',
    'Da implementare',
    'Note',
  ],
};

function labelBlocco(value) {
  if (!value) {
    return '';
  }
  return BLOCCO_LABELS[value] || value;
}

function labelPiano(piano) {
  if (piano === '' || piano === null || piano === undefined) {
    return '';
  }
  const n = Number(piano);
  if (Number.isFinite(n) && n < 0) {
    return `Piano ${n}`;
  }
  return `Piano ${piano}`;
}

function getSelectedTipo() {
  const checked = document.querySelector('input[name="estrazioniTipo"]:checked');
  return checked && checked.value ? checked.value : 'apparecchiature';
}

function updateDettaglioLabel() {
  const labelEl = document.getElementById('estrazioniDettaglioLabel');
  const legacyLabel = document.querySelector('label[for=\"filterApparecchiatura\"]');
  if (!labelEl && !legacyLabel) {
    return;
  }
  const tipo = getSelectedTipo();
  const labelText = TIPO_DETTAGLIO_LABEL[tipo] || 'Dettaglio';
  if (labelEl) {
    labelEl.textContent = labelText;
  }
  if (legacyLabel) {
    legacyLabel.textContent = labelText;
  }
}

function tomSelectBaseOptions() {
  return {
    create: false,
    allowEmptyOption: true,
    plugins: ['dropdown_input', 'clear_button'],
    maxOptions: null,
  };
}

function fillTomSelectOptions(tomSelectInstance, rawValues, labelForValue) {
  if (!tomSelectInstance) {
    return;
  }
  const values = Array.isArray(rawValues) ? rawValues : [];
  const previous = tomSelectInstance.getValue();
  tomSelectInstance.clear(true);
  tomSelectInstance.clearOptions();
  tomSelectInstance.addOption({ value: '', text: '' });
  values.forEach((value) => {
    tomSelectInstance.addOption({
      value,
      text: labelForValue(value),
    });
  });
  tomSelectInstance.refreshOptions(false);
  if (previous && values.includes(previous)) {
    tomSelectInstance.setValue(previous, true);
  } else {
    tomSelectInstance.clear(true);
  }
}

async function fetchJson(url) {
  const response = await fetch(url);
  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    throw new Error('Risposta non JSON dal server');
  }
  if (!response.ok) {
    const message = payload && payload.error ? String(payload.error) : `HTTP ${response.status}`;
    throw new Error(message);
  }
  if (!payload || payload.ok !== true) {
    throw new Error(payload && payload.error ? String(payload.error) : 'Risposta non valida');
  }
  return payload;
}

function setErrorMessage(message) {
  const el = document.getElementById('estrazioniError');
  if (!el) {
    return;
  }
  if (!message) {
    el.textContent = '';
    el.hidden = true;
    return;
  }
  el.textContent = message;
  el.hidden = false;
}

function setLoading(isLoading) {
  const btn = document.getElementById('estrazioniSearchBtn');
  if (btn) {
    btn.disabled = isLoading;
    btn.setAttribute('aria-busy', isLoading ? 'true' : 'false');
  }
}

function formatInvForCell(inv) {
  if (Array.isArray(inv)) {
    return inv.join(', ');
  }
  if (inv === null || inv === undefined) {
    return '';
  }
  return String(inv);
}

function appendTextCell(row, text) {
  const cell = document.createElement('td');
  cell.textContent = text ?? '';
  row.appendChild(cell);
}

function renderTableHead(tipo) {
  const thead = document.getElementById('estrazioniTableHead');
  if (!thead) {
    return;
  }
  const headers = TABLE_HEADERS[tipo] || TABLE_HEADERS.apparecchiature;
  const tr = document.createElement('tr');
  headers.forEach((text) => {
    const th = document.createElement('th');
    th.textContent = text;
    tr.appendChild(th);
  });
  thead.replaceChildren(tr);
}

function renderResults(rows) {
  const tbody = document.getElementById('estrazioniTableBody');
  const emptyEl = document.getElementById('estrazioniEmpty');
  const tipo = getSelectedTipo();
  if (!tbody) {
    return;
  }
  tbody.replaceChildren();
  renderTableHead(tipo);

  if (!rows || rows.length === 0) {
    if (emptyEl) {
      emptyEl.hidden = false;
    }
    return;
  }
  if (emptyEl) {
    emptyEl.hidden = true;
  }

  if (tipo === 'impiantistica') {
    rows.forEach((row) => {
      const tr = document.createElement('tr');
      const tipologia =
        row.tipologiaImpianto ?? row.tipologiaimpianto ?? row.TipologiaImpianto ?? '';
      const qtaPr = row.qtaPresenti ?? row.qtapresenti ?? row.QtaPresenti;
      const qtaDi = row.qtaDaImplementare ?? row.qtadaimplementare ?? row.QtaDaImplementare;
      appendTextCell(tr, labelBlocco(row.blocco));
      appendTextCell(tr, labelPiano(row.piano));
      appendTextCell(tr, row.reparto ?? '');
      appendTextCell(tr, row.roomCode ?? row.roomcode ?? '');
      appendTextCell(tr, tipologia);
      appendTextCell(tr, qtaPr != null && qtaPr !== '' ? String(qtaPr) : '');
      appendTextCell(tr, qtaDi != null && qtaDi !== '' ? String(qtaDi) : '');
      appendTextCell(tr, row.note ?? '');
      tbody.appendChild(tr);
    });
    return;
  }

  if (tipo === 'altre_dotazioni') {
    rows.forEach((row) => {
      const tr = document.createElement('tr');
      const altra =
        row.altraDotazione ?? row.altadotazione ?? row.AltraDotazione ?? '';
      const daImp = row.daImplementare ?? row.daimplementare ?? row.DaImplementare ?? '';
      appendTextCell(tr, labelBlocco(row.blocco));
      appendTextCell(tr, labelPiano(row.piano));
      appendTextCell(tr, row.reparto ?? '');
      appendTextCell(tr, row.roomCode ?? row.roomcode ?? '');
      appendTextCell(tr, altra);
      appendTextCell(tr, row.presente ?? '');
      appendTextCell(tr, daImp);
      appendTextCell(tr, row.note ?? '');
      tbody.appendChild(tr);
    });
    return;
  }

  rows.forEach((row) => {
    const tr = document.createElement('tr');
    appendTextCell(tr, labelBlocco(row.blocco));
    appendTextCell(tr, labelPiano(row.piano));
    appendTextCell(tr, row.reparto ?? '');
    appendTextCell(tr, row.roomCode ?? '');
    appendTextCell(tr, row.apparecchiatura ?? '');
    appendTextCell(tr, row.tipologia ?? '');
    appendTextCell(tr, row.produttore ?? '');
    appendTextCell(tr, row.modello ?? '');
    appendTextCell(tr, row.qta ?? '');
    appendTextCell(tr, row.nuovo ?? '');
    appendTextCell(tr, row.trasferimento ?? '');
    appendTextCell(tr, formatInvForCell(row.inv));
    appendTextCell(tr, row.note ?? '');
    tbody.appendChild(tr);
  });
}

function getTomSelectConstructor() {
  return typeof window.TomSelect === 'function' ? window.TomSelect : null;
}

const filterBloccoEl = document.getElementById('filterBlocco');
const filterPianoEl = document.getElementById('filterPiano');
const filterRepartoEl = document.getElementById('filterReparto');
const filterStanzaEl = document.getElementById('filterStanza');
const filterDettaglioEl =
  document.getElementById('filterDettaglio') || document.getElementById('filterApparecchiatura');

const TomSelect = getTomSelectConstructor();
let tsBlocco = null;
let tsPiano = null;
let tsReparto = null;
let tsStanza = null;
let tsDettaglio = null;

function applyDettaglioChoicesFromPayload(payload) {
  const choices = Array.isArray(payload.dettaglioChoices)
    ? payload.dettaglioChoices
    : Array.isArray(payload.apparecchiature)
      ? payload.apparecchiature
      : [];
  fillTomSelectOptions(tsDettaglio, choices, (v) => v);
}

async function loadRootOptions() {
  const tipo = getSelectedTipo();
  const payload = await fetchJson(`${API_URL}?action=options&tipo=${encodeURIComponent(tipo)}`);
  fillTomSelectOptions(tsBlocco, payload.blocchi || [], labelBlocco);
  fillTomSelectOptions(tsPiano, payload.piani || [], labelPiano);
  updateRepartoOptions(payload.reparti || [], Boolean(payload.hasEmptyReparto));
  fillTomSelectOptions(tsStanza, payload.stanze || [], (v) => v);
  applyDettaglioChoicesFromPayload(payload);
}

function updateRepartoOptions(reparti, hasEmptyReparto) {
  if (!tsReparto) {
    return;
  }
  const previousReparto = tsReparto.getValue();
  tsReparto.clear(true);
  tsReparto.clearOptions();
  tsReparto.addOption({ value: '', text: '' });
  if (hasEmptyReparto) {
    tsReparto.addOption({ value: SENZA_REPARTO_VALUE, text: '(Senza reparto)' });
  }
  reparti.forEach((value) => {
    tsReparto.addOption({ value, text: value });
  });
  tsReparto.refreshOptions(false);
  if (
    previousReparto &&
    (reparti.includes(previousReparto) || (previousReparto === SENZA_REPARTO_VALUE && hasEmptyReparto))
  ) {
    tsReparto.setValue(previousReparto, true);
  } else {
    tsReparto.clear(true);
  }
}

async function loadOptionsForContext(blocco, piano) {
  const tipo = getSelectedTipo();
  const params = new URLSearchParams({
    action: 'options',
    tipo,
  });
  if (blocco) {
    params.set('blocco', blocco);
  }
  if (piano) {
    params.set('piano', piano);
  }
  const payload = await fetchJson(`${API_URL}?${params.toString()}`);

  if (Array.isArray(payload.piani)) {
    fillTomSelectOptions(tsPiano, payload.piani, labelPiano);
  }
  if (Array.isArray(payload.reparti)) {
    updateRepartoOptions(payload.reparti, Boolean(payload.hasEmptyReparto));
  }
  if (Array.isArray(payload.stanze)) {
    fillTomSelectOptions(tsStanza, payload.stanze, (v) => v);
  }
  applyDettaglioChoicesFromPayload(payload);
}

async function onBloccoChanged() {
  const blocco = tsBlocco ? tsBlocco.getValue() : '';
  const piano = tsPiano ? tsPiano.getValue() : '';
  try {
    setErrorMessage('');
    await loadOptionsForContext(blocco, piano);
  } catch (error) {
    console.error('[Estrazioni] blocco changed', error);
    setErrorMessage(error.message || 'Errore aggiornamento filtri');
  }
}

async function onPianoChanged() {
  const blocco = tsBlocco ? tsBlocco.getValue() : '';
  const piano = tsPiano ? tsPiano.getValue() : '';
  try {
    setErrorMessage('');
    await loadOptionsForContext(blocco, piano);
  } catch (error) {
    console.error('[Estrazioni] reparti/stanze', error);
    setErrorMessage(error.message || 'Errore caricamento reparti e stanze');
  }
}

async function onTipoChanged() {
  updateDettaglioLabel();
  try {
    setErrorMessage('');
    await loadRootOptions();
    const tbody = document.getElementById('estrazioniTableBody');
    if (tbody) {
      tbody.replaceChildren();
    }
    renderTableHead(getSelectedTipo());
    const emptyEl = document.getElementById('estrazioniEmpty');
    if (emptyEl) {
      emptyEl.hidden = true;
    }
  } catch (error) {
    console.error('[Estrazioni] tipo changed', error);
    setErrorMessage(error.message || 'Errore aggiornamento opzioni');
  }
}

function wireTipoListeners() {
  const tipoInputs = document.querySelectorAll('input[name=\"estrazioniTipo\"]');
  if (!tipoInputs.length) {
    return;
  }
  tipoInputs.forEach((input) => {
    input.addEventListener('change', () => {
      onTipoChanged();
    });
  });
}

function buildEstrazioniFilterParams() {
  const params = new URLSearchParams();
  const tipo = getSelectedTipo();
  params.set('tipo', tipo);

  const blocco = tsBlocco ? tsBlocco.getValue() : '';
  const piano = tsPiano ? tsPiano.getValue() : '';
  const reparto = tsReparto ? tsReparto.getValue() : '';
  const stanza = tsStanza ? tsStanza.getValue() : '';
  const dettaglio = tsDettaglio ? tsDettaglio.getValue() : '';

  if (blocco) {
    params.set('blocco', blocco);
  }
  if (piano) {
    params.set('piano', piano);
  }
  if (reparto !== '') {
    if (reparto === SENZA_REPARTO_VALUE) {
      params.set('reparto', '');
    } else {
      params.set('reparto', reparto);
    }
  }
  if (stanza) {
    params.set('room_code', stanza);
  }
  if (dettaglio) {
    params.set('dettaglio', dettaglio);
  }

  return params;
}

function buildSearchUrl() {
  const params = buildEstrazioniFilterParams();
  params.set('action', 'search');
  return `${API_URL}?${params.toString()}`;
}

function buildExportUrl() {
  const params = buildEstrazioniFilterParams();
  return `${EXPORT_URL}?${params.toString()}`;
}

function clearAllTomSelectFilters() {
  [tsBlocco, tsPiano, tsReparto, tsStanza, tsDettaglio].forEach((tomSelectInstance) => {
    if (tomSelectInstance) {
      tomSelectInstance.clear(true);
    }
  });
}

function clearResultsTable() {
  const tbody = document.getElementById('estrazioniTableBody');
  if (tbody) {
    tbody.replaceChildren();
  }
  renderTableHead(getSelectedTipo());
  const emptyEl = document.getElementById('estrazioniEmpty');
  if (emptyEl) {
    emptyEl.hidden = true;
  }
}

async function runSearch() {
  setErrorMessage('');
  const emptyEl = document.getElementById('estrazioniEmpty');
  if (emptyEl) {
    emptyEl.hidden = true;
  }
  setLoading(true);
  try {
    const payload = await fetchJson(buildSearchUrl());
    renderResults(payload.rows || []);
  } catch (error) {
    console.error('[Estrazioni] ricerca', error);
    setErrorMessage(error.message || 'Errore durante la ricerca');
    renderResults([]);
  } finally {
    setLoading(false);
  }
}

async function resetFilters() {
  const defaultTipo = 'apparecchiature';
  const radioToSelect = document.querySelector(
    `input[name="estrazioniTipo"][value="${defaultTipo}"]`
  );
  const shouldSwitchTipo = getSelectedTipo() !== defaultTipo;

  if (radioToSelect) {
    radioToSelect.checked = true;
  }

  setErrorMessage('');
  setLoading(true);
  try {
    if (shouldSwitchTipo) {
      updateDettaglioLabel();
    }
    clearAllTomSelectFilters();
    await loadRootOptions();
    clearResultsTable();
  } catch (error) {
    console.error('[Estrazioni] reset filtri', error);
    setErrorMessage(error.message || 'Errore durante il reset dei filtri');
  } finally {
    setLoading(false);
  }
}

function initTomSelects() {
  const TS = getTomSelectConstructor();
  if (!TS) {
    setErrorMessage('TomSelect non disponibile: controlla la connessione al CDN.');
    return false;
  }
  if (!filterBloccoEl || !filterPianoEl || !filterRepartoEl || !filterStanzaEl || !filterDettaglioEl) {
    setErrorMessage('Markup filtri non allineato: ricarica la pagina senza cache (Cmd+Shift+R).');
    return false;
  }

  tsBlocco = new TS(filterBloccoEl, {
    ...tomSelectBaseOptions(),
    onChange() {
      onBloccoChanged();
    },
  });

  tsPiano = new TS(filterPianoEl, {
    ...tomSelectBaseOptions(),
    onChange() {
      onPianoChanged();
    },
  });

  tsReparto = new TS(filterRepartoEl, tomSelectBaseOptions());
  tsStanza = new TS(filterStanzaEl, tomSelectBaseOptions());
  tsDettaglio = new TS(filterDettaglioEl, {
    ...tomSelectBaseOptions(),
    sortField: { field: 'text', direction: 'asc' },
  });

  return true;
}

document.getElementById('estrazioniSearchBtn')?.addEventListener('click', () => {
  runSearch();
});

document.getElementById('estrazioniExportBtn')?.addEventListener('click', () => {
  setErrorMessage('');
  window.location.assign(buildExportUrl());
});

document.getElementById('estrazioniResetBtn')?.addEventListener('click', () => {
  resetFilters();
});

if (!initTomSelects()) {
  // stop
} else {
  updateDettaglioLabel();
  renderTableHead(getSelectedTipo());
  wireTipoListeners();
  loadRootOptions().catch((error) => {
    console.error('[Estrazioni] opzioni iniziali', error);
    setErrorMessage(error.message || 'Errore caricamento filtri');
  });
}
