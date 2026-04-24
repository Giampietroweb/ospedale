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

const minZoom = 0.1;
const maxZoom = 50;
const zoomStep = 0.2;
let currentZoom = 2;
let baseImageWidth = 0;
let baseImageHeight = 0;
let activeFieldBeingEdited = null;

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

zoomInButton.addEventListener('click', handleZoomIn);
zoomOutButton.addEventListener('click', handleZoomOut);
zoomResetButton.addEventListener('click', handleZoomReset);
modalCloseButton.addEventListener('click', closeModal);
setupEditableFieldEvents('roomCode');
setupEditableFieldEvents('roomDescription');
setupEditableFieldEvents('roomDepartment');
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
