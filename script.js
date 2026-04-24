const zoomOutButton = document.getElementById('zoomOut');
const zoomInButton = document.getElementById('zoomIn');
const zoomResetButton = document.getElementById('zoomReset');
const zoomValueLabel = document.getElementById('zoomValue');
const viewer = document.getElementById('viewer');
const mapObject = document.getElementById('mapObject');
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

const apparecchiaturaRows = [
  {
    tipologia: 'Monitor paziente',
    qta: '2',
    nuovo: 'Si',
    trasferimento: 'No',
    inv: 'INV-001245',
    note: 'Verifica annuale pianificata'
  },
  {
    tipologia: 'Defibrillatore',
    qta: '1',
    nuovo: 'No',
    trasferimento: 'Si',
    inv: 'INV-004872',
    note: 'Trasferito da terapia intensiva'
  }
];

const impiantisticaRows = [
  {
    tipologia: 'Punti rete dati',
    qtaPresenti: '6',
    qtaDaImplementare: '2'
  },
  {
    tipologia: 'Prese elettriche dedicate',
    qtaPresenti: '8',
    qtaDaImplementare: '4'
  }
];

function updateZoomDisplay() {
  mapObject.style.width = `${baseImageWidth * currentZoom}px`;
  mapObject.style.height = `${baseImageHeight * currentZoom}px`;
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
    tipologia: appTipologiaInput.value.trim(),
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
  const rowsHtml = apparecchiaturaRows.map((row, index) => `
    <tr>
      <td>${escapeHtml(row.tipologia)}</td>
      <td>${escapeHtml(row.qta)}</td>
      <td>${escapeHtml(row.nuovo)}</td>
      <td>${escapeHtml(row.trasferimento)}</td>
      <td>${escapeHtml(row.inv)}</td>
      <td>${escapeHtml(row.note)}</td>
      <td><button type="button" class="row-edit-button" data-app-edit="${index}">Modifica</button></td>
    </tr>
  `).join('');

  apparecchiaturaTableBody.innerHTML = rowsHtml || `
    <tr><td colspan="7">Nessun dato inserito.</td></tr>
  `;

  apparecchiaturaTableBody.querySelectorAll('[data-app-edit]').forEach((button) => {
    button.addEventListener('click', () => {
      const rowIndex = Number(button.dataset.appEdit);
      const selectedRow = apparecchiaturaRows[rowIndex];
      if (!selectedRow) {
        return;
      }

      appTipologiaInput.value = selectedRow.tipologia;
      appQtaInput.value = selectedRow.qta;
      appNuovoInput.value = selectedRow.nuovo;
      appTrasferimentoInput.value = selectedRow.trasferimento;
      appInvInput.value = selectedRow.inv;
      appNoteInput.value = selectedRow.note;
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
  const svgDocument = mapObject.contentDocument;
  if (!svgDocument || !svgDocument.documentElement) {
    console.warn('Impossibile accedere al DOM interno di planimetrie/mappa.svg. Se apri il file con file:// avvia un server locale (es. python -m http.server).');
    applyFallbackMapSize();
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
  updateZoomDisplay();
  centerMapInViewport();
}

function handleAddApparecchiatura() {
  const rawRow = getApparecchiaturaFormData();
  const newRow = {
    tipologia: rawRow.tipologia || '-',
    qta: rawRow.qta || '0',
    nuovo: rawRow.nuovo || '-',
    trasferimento: rawRow.trasferimento || '-',
    inv: rawRow.inv || '-',
    note: rawRow.note || '-'
  };

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

  const updatedRow = getApparecchiaturaFormData();
  if (!updatedRow.tipologia || !updatedRow.qta) {
    window.alert('Compila almeno Tipologia e QTA per Apparecchiatura.');
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

mapObject.addEventListener('load', initializeMapDimensions);

if (mapObject.contentDocument) {
  initializeMapDimensions();
}

renderApparecchiaturaTable();
renderImpiantisticaTable();
