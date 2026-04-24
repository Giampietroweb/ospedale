const zoomOutButton = document.getElementById('zoomOut');
const zoomInButton = document.getElementById('zoomIn');
const zoomResetButton = document.getElementById('zoomReset');
const zoomValueLabel = document.getElementById('zoomValue');
const viewer = document.getElementById('viewer');
const mapWrapper = document.getElementById('mapWrapper');
const mapObject = document.getElementById('mapObject');
const mapLoaderOverlay = document.getElementById('mapLoaderOverlay');
const mapErrorCenterMessage = document.getElementById('mapErrorCenterMessage');
const modalOverlay = document.getElementById('modalOverlay');
const modalCloseButton = document.getElementById('modalClose');
const roomCodeValue = document.getElementById('roomCodeValue');
const roomDescriptionValue = document.getElementById('roomDescriptionValue');
const roomDepartmentValue = document.getElementById('roomDepartmentValue');
const roomCodeInput = document.getElementById('roomCodeInput');
const roomDescriptionInput = document.getElementById('roomDescriptionInput');
const roomDepartmentInput = document.getElementById('roomDepartmentInput');
const editRoomCodeButton = document.getElementById('editRoomCodeButton');
const editRoomDescriptionButton = document.getElementById('editRoomDescriptionButton');
const editRoomDepartmentButton = document.getElementById('editRoomDepartmentButton');
const sectionApparecchiaturaButton = document.getElementById('sectionApparecchiatura');
const sectionImpiantisticaButton = document.getElementById('sectionImpiantistica');
const contentApparecchiatura = document.getElementById('contentApparecchiatura');
const contentImpiantistica = document.getElementById('contentImpiantistica');
const apparecchiaturaTableBody = document.getElementById('apparecchiaturaTableBody');
const impiantisticaTableBody = document.getElementById('impiantisticaTableBody');
const appTipologiaInput = document.getElementById('appTipologiaInput');
const appInstallazioneTipologiaInput = document.getElementById('appInstallazioneTipologiaInput');
const appQtaInput = document.getElementById('appQtaInput');
const appNuovoInput = document.getElementById('appNuovoInput');
const appTrasferimentoInput = document.getElementById('appTrasferimentoInput');
const appInvInput = document.getElementById('appInvInput');
const appNoteInput = document.getElementById('appNoteInput');
const appAddButton = document.getElementById('appAddButton');
const appSaveButton = document.getElementById('appSaveButton');
const appCancelButton = document.getElementById('appCancelButton');
const impTipologiaInput = document.getElementById('impTipologiaInput');
const impQtaPresentiInput = document.getElementById('impQtaPresentiInput');
const impQtaImplementareInput = document.getElementById('impQtaImplementareInput');
const impAddButton = document.getElementById('impAddButton');
const impSaveButton = document.getElementById('impSaveButton');
const impCancelButton = document.getElementById('impCancelButton');

const minZoom = 0.1;
const maxZoom = 50;
const zoomStep = 0.2;
let currentZoom = 2;
let baseImageWidth = 0;
let baseImageHeight = 0;
let activeFieldBeingEdited = null;
let editingApparecchiaturaIndex = null;
let editingImpiantisticaIndex = null;
let requestedFloorName = '';
const floorNamePattern = /^[a-z0-9-]+$/i;
const mapLoadMinMs = 2000;
let mapLoadMinMet = false;
let mapLoadResourceMet = false;
let mapLoadMinTimeoutId = null;
const apparecchiaturaTipologiaOptions = ['', 'Carrellato', 'Parete', 'Pensile', 'Soffitto'];

function resetMapLoadSequence() {
  console.log('[MapLoader] resetMapLoadSequence');
  mapLoadMinMet = false;
  mapLoadResourceMet = false;
  if (mapLoadMinTimeoutId !== null) {
    window.clearTimeout(mapLoadMinTimeoutId);
    mapLoadMinTimeoutId = null;
  }
}

function showMapLoader() {
  console.log('[MapLoader] showMapLoader');
  if (mapLoaderOverlay) {
    mapLoaderOverlay.hidden = false;
  }
  if (viewer) {
    viewer.setAttribute('aria-busy', 'true');
  }
}

function hideMapLoader() {
  console.log('[MapLoader] hideMapLoader');
  if (mapLoaderOverlay) {
    mapLoaderOverlay.hidden = true;
  }
  if (viewer) {
    viewer.removeAttribute('aria-busy');
  }
}

function tryReleaseMapLoader() {
  console.log('[MapLoader] tryReleaseMapLoader', {
    mapLoadMinMet,
    mapLoadResourceMet
  });
  if (mapLoadMinMet && mapLoadResourceMet) {
    hideMapLoader();
  }
}

function startMapLoadSequence() {
  console.log('[MapLoader] startMapLoadSequence', { mapLoadMinMs });
  resetMapLoadSequence();
  showMapLoader();
  mapLoadMinTimeoutId = window.setTimeout(() => {
    console.log('[MapLoader] minimum timeout met');
    mapLoadMinMet = true;
    tryReleaseMapLoader();
  }, mapLoadMinMs);
}

function markMapResourceReady() {
  console.log('[MapLoader] markMapResourceReady');
  mapLoadResourceMet = true;
  tryReleaseMapLoader();
}

function setCenteredMapErrorMessage(text) {
  if (!mapErrorCenterMessage) {
    return;
  }

  mapErrorCenterMessage.textContent = text;
  mapErrorCenterMessage.hidden = text === '';
}

function setMapControlsEnabled(isEnabled) {
  zoomOutButton.disabled = !isEnabled;
  zoomInButton.disabled = !isEnabled;
  zoomResetButton.disabled = !isEnabled;
}

function getFloorNameFromQuery() {
  const searchParams = new URLSearchParams(window.location.search);
  return (searchParams.get('piano') || '').trim();
}

function validateFloorFromQueryString() {
  const floorName = getFloorNameFromQuery();
  requestedFloorName = floorName;
  console.log('[MapLoader] validateFloorFromQueryString', { floorName });
  if (!floorName) {
    setCenteredMapErrorMessage('Parametro "piano" mancante nella URL.');
    setMapControlsEnabled(false);
    return false;
  }

  if (!floorNamePattern.test(floorName)) {
    setCenteredMapErrorMessage('Parametro "piano" non valido.');
    setMapControlsEnabled(false);
    return false;
  }

  setCenteredMapErrorMessage('');
  setMapControlsEnabled(true);
  return true;
}

const apparecchiaturaRows = [];

const impiantisticaRows = [];

function updateZoomDisplay() {
  mapObject.style.width = 'auto';
  mapObject.style.height = 'auto';
  mapObject.style.transformOrigin = 'top left';
  mapObject.style.transform = `scale(${currentZoom})`;
  mapWrapper.style.width = `${baseImageWidth * currentZoom}px`;
  mapWrapper.style.height = `${baseImageHeight * currentZoom}px`;
  zoomValueLabel.textContent = `${Math.round(currentZoom * 100)}%`;
}

function centerMapInViewport() {
  const targetScrollLeft = Math.max(0, (viewer.scrollWidth - viewer.clientWidth) / 2);
  const targetScrollTop = Math.max(0, (viewer.scrollHeight - viewer.clientHeight) / 2);

  viewer.scrollLeft = targetScrollLeft;
  viewer.scrollTop = targetScrollTop;
}

function updateZoomKeepingViewportCenter() {
  const centerRatioX = viewer.scrollWidth > 0
    ? (viewer.scrollLeft + (viewer.clientWidth / 2)) / viewer.scrollWidth
    : 0.5;
  const centerRatioY = viewer.scrollHeight > 0
    ? (viewer.scrollTop + (viewer.clientHeight / 2)) / viewer.scrollHeight
    : 0.5;

  updateZoomDisplay();

  viewer.scrollLeft = Math.max(0, (viewer.scrollWidth * centerRatioX) - (viewer.clientWidth / 2));
  viewer.scrollTop = Math.max(0, (viewer.scrollHeight * centerRatioY) - (viewer.clientHeight / 2));
}

function handleZoomIn() {
  currentZoom = Math.min(maxZoom, Number((currentZoom + zoomStep).toFixed(2)));
  updateZoomKeepingViewportCenter();
}

function handleZoomOut() {
  currentZoom = Math.max(minZoom, Number((currentZoom - zoomStep).toFixed(2)));
  updateZoomKeepingViewportCenter();
}

function handleZoomReset() {
  currentZoom = 1;
  updateZoomDisplay();
  centerMapInViewport();
}

function getRoomCodeWithoutAsterisks(textValue) {
  return textValue.replace(/^\*/, '').replace(/\*$/, '');
}

const editableFieldConfigs = {
  roomCode: {
    valueElement: roomCodeValue,
    inputElement: roomCodeInput,
    buttonElement: editRoomCodeButton
  },
  roomDescription: {
    valueElement: roomDescriptionValue,
    inputElement: roomDescriptionInput,
    buttonElement: editRoomDescriptionButton
  },
  roomDepartment: {
    valueElement: roomDepartmentValue,
    inputElement: roomDepartmentInput,
    buttonElement: editRoomDepartmentButton
  }
};

function stopEditingField(fieldName, saveChanges) {
  const fieldConfig = editableFieldConfigs[fieldName];
  if (!fieldConfig) {
    return;
  }

  if (saveChanges) {
    fieldConfig.valueElement.textContent = fieldConfig.inputElement.value.trim() || fieldConfig.valueElement.textContent;
  }

  fieldConfig.valueElement.hidden = false;
  fieldConfig.inputElement.hidden = true;
  fieldConfig.buttonElement.textContent = 'Modifica';
  activeFieldBeingEdited = null;
}

function startEditingField(fieldName) {
  const fieldConfig = editableFieldConfigs[fieldName];
  if (!fieldConfig) {
    return;
  }

  if (activeFieldBeingEdited && activeFieldBeingEdited !== fieldName) {
    stopEditingField(activeFieldBeingEdited, true);
  }

  fieldConfig.inputElement.value = fieldConfig.valueElement.textContent.trim();
  fieldConfig.valueElement.hidden = true;
  fieldConfig.inputElement.hidden = false;
  fieldConfig.buttonElement.textContent = 'Salva';
  fieldConfig.inputElement.focus();
  fieldConfig.inputElement.select();
  activeFieldBeingEdited = fieldName;
}

function handleEditFieldClick(fieldName) {
  if (activeFieldBeingEdited === fieldName) {
    stopEditingField(fieldName, true);
    return;
  }

  startEditingField(fieldName);
}

function setupEditableFieldEvents(fieldName) {
  const fieldConfig = editableFieldConfigs[fieldName];
  fieldConfig.buttonElement.addEventListener('click', () => handleEditFieldClick(fieldName));
  fieldConfig.inputElement.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      stopEditingField(fieldName, true);
    }

    if (event.key === 'Escape') {
      stopEditingField(fieldName, false);
    }
  });
}

function resetEditableFieldsState() {
  Object.keys(editableFieldConfigs).forEach((fieldName) => {
    const fieldConfig = editableFieldConfigs[fieldName];
    fieldConfig.valueElement.hidden = false;
    fieldConfig.inputElement.hidden = true;
    fieldConfig.buttonElement.textContent = 'Modifica';
  });
  activeFieldBeingEdited = null;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function normalizeApparecchiaturaTipologiaValue(value) {
  const trimmedValue = String(value || '').trim();
  if (trimmedValue === '') {
    return '';
  }

  if (apparecchiaturaTipologiaOptions.includes(trimmedValue)) {
    return trimmedValue;
  }

  const normalizedValue = trimmedValue.toLowerCase();
  const legacyToCurrentTipologiaMap = {
    carrellato: 'Carrellato',
    'a parete': 'Parete',
    parete: 'Parete',
    'su pensile': 'Pensile',
    pensile: 'Pensile',
    'a soffitto': 'Soffitto',
    soffitto: 'Soffitto'
  };

  return legacyToCurrentTipologiaMap[normalizedValue] || '';
}

function normalizeApparecchiaturaRow(row) {
  const safeRow = row && typeof row === 'object' ? row : {};
  const apparecchiaturaValue = String(safeRow.apparecchiatura || safeRow.tipologia || '-').trim() || '-';

  return {
    apparecchiatura: apparecchiaturaValue,
    tipologia: normalizeApparecchiaturaTipologiaValue(safeRow.tipologia),
    qta: String(safeRow.qta || '0').trim() || '0',
    nuovo: String(safeRow.nuovo || '-').trim() || '-',
    trasferimento: String(safeRow.trasferimento || '-').trim() || '-',
    inv: String(safeRow.inv || '-').trim() || '-',
    note: String(safeRow.note || '-').trim() || '-'
  };
}

function setApparecchiaturaEditMode(isEditing) {
  appAddButton.hidden = isEditing;
  appSaveButton.hidden = !isEditing;
  appCancelButton.hidden = !isEditing;
}

function setImpiantisticaEditMode(isEditing) {
  impAddButton.hidden = isEditing;
  impSaveButton.hidden = !isEditing;
  impCancelButton.hidden = !isEditing;
}

function getApparecchiaturaFormData() {
  return {
    apparecchiatura: appTipologiaInput.value.trim(),
    tipologia: normalizeApparecchiaturaTipologiaValue(appInstallazioneTipologiaInput.value),
    qta: appQtaInput.value.trim(),
    nuovo: appNuovoInput.value.trim(),
    trasferimento: appTrasferimentoInput.value.trim(),
    inv: appInvInput.value.trim(),
    note: appNoteInput.value.trim()
  };
}

function getImpiantisticaFormData() {
  return {
    tipologia: impTipologiaInput.value.trim(),
    qtaPresenti: impQtaPresentiInput.value.trim(),
    qtaDaImplementare: impQtaImplementareInput.value.trim()
  };
}

function resetApparecchiaturaForm() {
  appTipologiaInput.value = '';
  appInstallazioneTipologiaInput.value = '';
  appQtaInput.value = '';
  appNuovoInput.value = '';
  appTrasferimentoInput.value = '';
  appInvInput.value = '';
  appNoteInput.value = '';
  editingApparecchiaturaIndex = null;
  setApparecchiaturaEditMode(false);
}

function resetImpiantisticaForm() {
  impTipologiaInput.value = '';
  impQtaPresentiInput.value = '';
  impQtaImplementareInput.value = '';
  editingImpiantisticaIndex = null;
  setImpiantisticaEditMode(false);
}

function renderApparecchiaturaTable() {
  const rowsHtml = apparecchiaturaRows.map((row, index) => {
    const normalizedRow = normalizeApparecchiaturaRow(row);
    apparecchiaturaRows[index] = normalizedRow;
    return `
    <tr>
      <td>${escapeHtml(normalizedRow.apparecchiatura)}</td>
      <td>${escapeHtml(normalizedRow.tipologia || '-')}</td>
      <td>${escapeHtml(normalizedRow.qta)}</td>
      <td>${escapeHtml(normalizedRow.nuovo)}</td>
      <td>${escapeHtml(normalizedRow.trasferimento)}</td>
      <td>${escapeHtml(normalizedRow.inv)}</td>
      <td>${escapeHtml(normalizedRow.note)}</td>
      <td><button type="button" class="row-edit-button" data-app-edit="${index}">Modifica</button></td>
    </tr>
  `;
  }).join('');

  apparecchiaturaTableBody.innerHTML = rowsHtml || `
    <tr><td colspan="8">Nessun dato inserito.</td></tr>
  `;

  apparecchiaturaTableBody.querySelectorAll('[data-app-edit]').forEach((button) => {
    button.addEventListener('click', () => {
      const rowIndex = Number(button.dataset.appEdit);
      const selectedRow = apparecchiaturaRows[rowIndex];
      if (!selectedRow) {
        return;
      }

      const normalizedSelectedRow = normalizeApparecchiaturaRow(selectedRow);
      apparecchiaturaRows[rowIndex] = normalizedSelectedRow;

      appTipologiaInput.value = normalizedSelectedRow.apparecchiatura;
      appInstallazioneTipologiaInput.value = normalizedSelectedRow.tipologia;
      appQtaInput.value = normalizedSelectedRow.qta;
      appNuovoInput.value = normalizedSelectedRow.nuovo;
      appTrasferimentoInput.value = normalizedSelectedRow.trasferimento;
      appInvInput.value = normalizedSelectedRow.inv;
      appNoteInput.value = normalizedSelectedRow.note;
      editingApparecchiaturaIndex = rowIndex;
      setApparecchiaturaEditMode(true);
    });
  });
}

function renderImpiantisticaTable() {
  const rowsHtml = impiantisticaRows.map((row, index) => `
    <tr>
      <td>${escapeHtml(row.tipologia)}</td>
      <td>${escapeHtml(row.qtaPresenti)}</td>
      <td>${escapeHtml(row.qtaDaImplementare)}</td>
      <td><button type="button" class="row-edit-button" data-imp-edit="${index}">Modifica</button></td>
    </tr>
  `).join('');

  impiantisticaTableBody.innerHTML = rowsHtml || `
    <tr><td colspan="4">Nessun dato inserito.</td></tr>
  `;

  impiantisticaTableBody.querySelectorAll('[data-imp-edit]').forEach((button) => {
    button.addEventListener('click', () => {
      const rowIndex = Number(button.dataset.impEdit);
      const selectedRow = impiantisticaRows[rowIndex];
      if (!selectedRow) {
        return;
      }

      impTipologiaInput.value = selectedRow.tipologia;
      impQtaPresentiInput.value = selectedRow.qtaPresenti;
      impQtaImplementareInput.value = selectedRow.qtaDaImplementare;
      editingImpiantisticaIndex = rowIndex;
      setImpiantisticaEditMode(true);
    });
  });
}

function setActiveModalSection(sectionName) {
  const isApparecchiatura = sectionName === 'apparecchiatura';

  sectionApparecchiaturaButton.classList.toggle('is-active', isApparecchiatura);
  sectionApparecchiaturaButton.setAttribute('aria-selected', String(isApparecchiatura));
  contentApparecchiatura.classList.toggle('is-active', isApparecchiatura);
  contentApparecchiatura.hidden = !isApparecchiatura;

  sectionImpiantisticaButton.classList.toggle('is-active', !isApparecchiatura);
  sectionImpiantisticaButton.setAttribute('aria-selected', String(!isApparecchiatura));
  contentImpiantistica.classList.toggle('is-active', !isApparecchiatura);
  contentImpiantistica.hidden = isApparecchiatura;
}

function openModal(textValue) {
  const roomCode = getRoomCodeWithoutAsterisks(textValue);
  roomCodeValue.textContent = roomCode;
  roomDescriptionValue.textContent = 'Placeholder descrizione stanza';
  roomDepartmentValue.textContent = 'cardiologia';
  resetEditableFieldsState();
  resetApparecchiaturaForm();
  resetImpiantisticaForm();
  setActiveModalSection('apparecchiatura');
  modalOverlay.classList.add('is-open');
  modalOverlay.setAttribute('aria-hidden', 'false');
}

function closeModal() {
  modalOverlay.classList.remove('is-open');
  modalOverlay.setAttribute('aria-hidden', 'true');
}

function isClickableOccurrence(textNode) {
  const rawText = textNode.textContent ? textNode.textContent.trim() : '';
  return /^\*.+\*$/.test(rawText);
}

function bindOccurrencesClick(svgDocument) {
  const textNodes = svgDocument.querySelectorAll('text');

  textNodes.forEach((textNode) => {
    if (!isClickableOccurrence(textNode)) {
      return;
    }

    textNode.style.cursor = 'pointer';
    textNode.addEventListener('click', () => {
      const textValue = textNode.textContent.trim();
      openModal(textValue);
    });
  });
}

function getSvgSizeFromViewBox(svgRoot) {
  if (!svgRoot) {
    return null;
  }

  const animatedViewBox = svgRoot.viewBox;
  if (
    animatedViewBox &&
    animatedViewBox.baseVal &&
    animatedViewBox.baseVal.width > 0 &&
    animatedViewBox.baseVal.height > 0
  ) {
    return {
      width: animatedViewBox.baseVal.width,
      height: animatedViewBox.baseVal.height
    };
  }

  const viewBoxAttribute = svgRoot.getAttribute('viewBox');
  if (!viewBoxAttribute) {
    return null;
  }

  const viewBoxValues = viewBoxAttribute.trim().split(/\s+/).map(Number);
  if (viewBoxValues.length !== 4 || viewBoxValues.some((value) => Number.isNaN(value))) {
    return null;
  }

  const width = viewBoxValues[2];
  const height = viewBoxValues[3];
  if (width <= 0 || height <= 0) {
    return null;
  }

  return { width, height };
}

function applyFallbackMapSize() {
  baseImageWidth = mapObject.clientWidth || 1000;
  baseImageHeight = mapObject.clientHeight || 1000;
  updateZoomDisplay();
  centerMapInViewport();
}

function initializeMapDimensions() {
  console.log('[MapLoader] initializeMapDimensions start');
  const svgDocument = mapObject.contentDocument;
  if (!svgDocument || !svgDocument.documentElement) {
    console.log('[MapLoader] initializeMapDimensions failed: missing svgDocument');
    setCenteredMapErrorMessage(`Errore nel caricamento della planimetria SVG. Planimetria non trovata: ${requestedFloorName || '-'}.`);
    setMapControlsEnabled(false);
    markMapResourceReady();
    return;
  }

  const svgRoot = svgDocument.documentElement;
  const svgSize = getSvgSizeFromViewBox(svgRoot);

  if (svgSize) {
    baseImageWidth = svgSize.width;
    baseImageHeight = svgSize.height;
  } else {
    baseImageWidth = mapObject.clientWidth || 1000;
    baseImageHeight = mapObject.clientHeight || 1000;
  }

  bindOccurrencesClick(svgDocument);
  setCenteredMapErrorMessage('');
  updateZoomDisplay();
  centerMapInViewport();
  console.log('[MapLoader] initializeMapDimensions success');
  markMapResourceReady();
}

function handleAddApparecchiatura() {
  const rawRow = getApparecchiaturaFormData();
  const newRow = normalizeApparecchiaturaRow({
    apparecchiatura: rawRow.apparecchiatura || '-',
    tipologia: rawRow.tipologia,
    qta: rawRow.qta || '0',
    nuovo: rawRow.nuovo || '-',
    trasferimento: rawRow.trasferimento || '-',
    inv: rawRow.inv || '-',
    note: rawRow.note || '-'
  });

  const hasAtLeastOneTypedValue = Object.values(rawRow).some((value) => value !== '');
  if (!hasAtLeastOneTypedValue) {
    window.alert('Inserisci almeno un valore prima di aggiungere la riga.');
    return;
  }

  apparecchiaturaRows.push(newRow);
  renderApparecchiaturaTable();
  resetApparecchiaturaForm();
}

function handleSaveApparecchiatura() {
  if (editingApparecchiaturaIndex === null) {
    return;
  }

  const updatedRow = normalizeApparecchiaturaRow(getApparecchiaturaFormData());
  if (!updatedRow.apparecchiatura || !updatedRow.qta) {
    window.alert('Compila almeno Apparecchiatura e QTA per Apparecchiatura.');
    return;
  }

  apparecchiaturaRows[editingApparecchiaturaIndex] = updatedRow;
  renderApparecchiaturaTable();
  resetApparecchiaturaForm();
}

function handleAddImpiantistica() {
  const rawRow = getImpiantisticaFormData();
  const newRow = {
    tipologia: rawRow.tipologia || '-',
    qtaPresenti: rawRow.qtaPresenti || '0',
    qtaDaImplementare: rawRow.qtaDaImplementare || '0'
  };

  const hasAtLeastOneTypedValue = Object.values(rawRow).some((value) => value !== '');
  if (!hasAtLeastOneTypedValue) {
    window.alert('Inserisci almeno un valore prima di aggiungere la riga.');
    return;
  }

  impiantisticaRows.push(newRow);
  renderImpiantisticaTable();
  resetImpiantisticaForm();
}

function handleSaveImpiantistica() {
  if (editingImpiantisticaIndex === null) {
    return;
  }

  const updatedRow = getImpiantisticaFormData();
  if (!updatedRow.tipologia || !updatedRow.qtaPresenti) {
    window.alert('Compila almeno Tipologia e Qta presenti per Impiantistica.');
    return;
  }

  impiantisticaRows[editingImpiantisticaIndex] = updatedRow;
  renderImpiantisticaTable();
  resetImpiantisticaForm();
}

zoomInButton.addEventListener('click', handleZoomIn);
zoomOutButton.addEventListener('click', handleZoomOut);
zoomResetButton.addEventListener('click', handleZoomReset);
modalCloseButton.addEventListener('click', closeModal);
setupEditableFieldEvents('roomCode');
setupEditableFieldEvents('roomDescription');
setupEditableFieldEvents('roomDepartment');
appAddButton.addEventListener('click', handleAddApparecchiatura);
appSaveButton.addEventListener('click', handleSaveApparecchiatura);
appCancelButton.addEventListener('click', resetApparecchiaturaForm);
impAddButton.addEventListener('click', handleAddImpiantistica);
impSaveButton.addEventListener('click', handleSaveImpiantistica);
impCancelButton.addEventListener('click', resetImpiantisticaForm);
sectionApparecchiaturaButton.addEventListener('click', () => setActiveModalSection('apparecchiatura'));
sectionImpiantisticaButton.addEventListener('click', () => setActiveModalSection('impiantistica'));
modalOverlay.addEventListener('click', (event) => {
  if (event.target === modalOverlay) {
    closeModal();
  }
});

const isFloorMapReady = validateFloorFromQueryString();
console.log('[MapLoader] isFloorMapReady', { isFloorMapReady, requestedFloorName });

if (isFloorMapReady) {
  startMapLoadSequence();

  let mapInitDone = false;
  function runMapInitOnce() {
    console.log('[MapLoader] runMapInitOnce called', { mapInitDone });
    if (mapInitDone) {
      return;
    }
    mapInitDone = true;
    try {
      initializeMapDimensions();
    } catch (error) {
      console.error('Errore inizializzazione mappa:', error);
      setCenteredMapErrorMessage('Errore durante l\'inizializzazione della planimetria.');
      setMapControlsEnabled(false);
      markMapResourceReady();
    }
  }

  // Registrare `load` prima di assegnare `data`, altrimenti l'evento può essere emesso
  // e perso in corsa (il loader resterebbe all'infinito).
  mapObject.addEventListener('load', runMapInitOnce, { once: true });
  console.log('[MapLoader] load listener registered');
  mapObject.addEventListener('error', () => {
    console.log('[MapLoader] object error event');
    const errorMessage = `Errore nel caricamento della planimetria SVG. Planimetria non trovata: ${requestedFloorName || '-'}.`;
    setCenteredMapErrorMessage(errorMessage);
    setMapControlsEnabled(false);
    markMapResourceReady();
  });
  console.log('[MapLoader] error listener registered');

  mapObject.data = `../planimetrie/${requestedFloorName}.svg`;
  console.log('[MapLoader] mapObject.data assigned', { data: mapObject.data });

  // Fallback di sicurezza: se per qualsiasi motivo `load` non arriva,
  // proviamo una sola inizializzazione ritardata.
  window.setTimeout(() => {
    console.log('[MapLoader] fallback timeout tick', {
      mapInitDone,
      hasContentDocument: Boolean(mapObject.contentDocument)
    });
    if (!mapInitDone && mapObject.contentDocument) {
      runMapInitOnce();
    }
  }, 3000);
}

renderApparecchiaturaTable();
renderImpiantisticaTable();
