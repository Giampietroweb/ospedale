/**
 * Pagina estrazioni: filtri a cascata e ricerca apparecchiature.
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

function renderResults(rows) {
  const tbody = document.getElementById('estrazioniTableBody');
  const emptyEl = document.getElementById('estrazioniEmpty');
  if (!tbody) {
    return;
  }
  tbody.replaceChildren();

  if (!rows || rows.length === 0) {
    if (emptyEl) {
      emptyEl.hidden = false;
    }
    return;
  }
  if (emptyEl) {
    emptyEl.hidden = true;
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
const filterApparecchiaturaEl = document.getElementById('filterApparecchiatura');

const TomSelect = getTomSelectConstructor();
let tsBlocco = null;
let tsPiano = null;
let tsReparto = null;
let tsStanza = null;
let tsApparecchiatura = null;

async function loadRootOptions() {
  const payload = await fetchJson(`${API_URL}?action=options`);
  fillTomSelectOptions(tsBlocco, payload.blocchi || [], labelBlocco);
  fillTomSelectOptions(tsPiano, payload.piani || [], labelPiano);
  updateRepartoOptions(payload.reparti || [], Boolean(payload.hasEmptyReparto));
  fillTomSelectOptions(tsStanza, payload.stanze || [], (v) => v);
  fillTomSelectOptions(tsApparecchiatura, payload.apparecchiature || [], (v) => v);
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
  const params = new URLSearchParams({ action: 'options' });
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

function buildEstrazioniFilterParams() {
  const params = new URLSearchParams();
  const blocco = tsBlocco ? tsBlocco.getValue() : '';
  const piano = tsPiano ? tsPiano.getValue() : '';
  const reparto = tsReparto ? tsReparto.getValue() : '';
  const stanza = tsStanza ? tsStanza.getValue() : '';
  const apparecchiatura = tsApparecchiatura ? tsApparecchiatura.getValue() : '';

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
  if (apparecchiatura) {
    params.set('apparecchiatura', apparecchiatura);
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

function initTomSelects() {
  const TS = getTomSelectConstructor();
  if (!TS) {
    setErrorMessage('TomSelect non disponibile: controlla la connessione al CDN.');
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
  tsApparecchiatura = new TS(filterApparecchiaturaEl, {
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

if (!initTomSelects()) {
  // stop
} else {
  loadRootOptions().catch((error) => {
    console.error('[Estrazioni] opzioni iniziali', error);
    setErrorMessage(error.message || 'Errore caricamento filtri');
  });
}
