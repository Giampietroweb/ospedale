const catalogTypeEl = document.getElementById('catalogType');
const catalogLabelEl = document.getElementById('catalogLabel');
const catalogCodeEl = document.getElementById('catalogCode');
const catalogSortOrderEl = document.getElementById('catalogSortOrder');
const catalogAddBtn = document.getElementById('catalogAddBtn');
const catalogTableBody = document.getElementById('catalogTableBody');
const catalogError = document.getElementById('catalogError');

function setCatalogError(message) {
  if (!catalogError) return;
  catalogError.textContent = message || '';
  catalogError.hidden = !message;
}

async function catalogRequest(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json();
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || `HTTP ${response.status}`);
  }
  return payload;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function renderCatalogRows(rows) {
  const safeRows = Array.isArray(rows) ? rows : [];
  catalogTableBody.innerHTML = safeRows.map((row) => `
    <tr>
      <td data-label="ID">${escapeHtml(row.id)}</td>
      <td data-label="Code">${escapeHtml(row.code)}</td>
      <td data-label="Label">${escapeHtml(row.label)}</td>
      <td data-label="Sort">${escapeHtml(row.sortOrder)}</td>
      <td data-label="Attivo">${Number(row.isActive) === 1 ? 'Si' : 'No'}</td>
      <td data-label="Azioni">
        <button
          type="button"
          class="estrazioni-page-btn"
          data-toggle-id="${row.id}"
          data-next-active="${Number(row.isActive) === 1 ? '0' : '1'}"
        >
          Toggle
        </button>
      </td>
    </tr>
  `).join('');

  catalogTableBody.querySelectorAll('[data-toggle-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      const id = Number(button.dataset.toggleId);
      const isActive = Number(button.dataset.nextActive);
      await catalogRequest(`./api/catalogs.php?action=setActive&type=${encodeURIComponent(catalogTypeEl.value)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isActive })
      });
      await loadCatalogRows();
    });
  });
}

async function loadCatalogRows() {
  setCatalogError('');
  try {
    const payload = await catalogRequest(`./api/catalogs.php?action=list&type=${encodeURIComponent(catalogTypeEl.value)}&activeOnly=0`);
    renderCatalogRows(payload.rows);
  } catch (error) {
    setCatalogError(error.message || 'Errore caricamento');
  }
}

const bundleSectionEl = document.getElementById('bundleSection');
let bundleCatalogOptionsLoaded = false;

function isApparecchiatureCatalogSelected() {
  return catalogTypeEl?.value === 'apparecchiature';
}

function updateBundleSectionVisibility() {
  if (!bundleSectionEl) {
    return;
  }
  const showBundleSection = isApparecchiatureCatalogSelected();
  bundleSectionEl.hidden = !showBundleSection;
  if (!showBundleSection) {
    bundleSectionEl.removeAttribute('open');
    closeBundleForm();
    return;
  }
  if (!bundleCatalogOptionsLoaded) {
    bundleCatalogOptionsLoaded = true;
    Promise.all([loadBundleApparecchiatureOptions(), loadBundleProduttoriOptions()])
      .then(() => loadBundles())
      .catch(() => {});
  }
}

catalogTypeEl.addEventListener('change', () => {
  loadCatalogRows();
  updateBundleSectionVisibility();
});

catalogAddBtn.addEventListener('click', async () => {
  setCatalogError('');
  try {
    await catalogRequest(`./api/catalogs.php?action=upsert&type=${encodeURIComponent(catalogTypeEl.value)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        label: String(catalogLabelEl.value || '').trim(),
        code: String(catalogCodeEl.value || '').trim(),
        sortOrder: Number(catalogSortOrderEl.value || 0)
      })
    });
    catalogLabelEl.value = '';
    catalogCodeEl.value = '';
    catalogSortOrderEl.value = '';
    await loadCatalogRows();
  } catch (error) {
    setCatalogError(error.message || 'Errore salvataggio');
  }
});

loadCatalogRows();

const bundleCreateBtn = document.getElementById('bundleCreateBtn');
const bundleForm = document.getElementById('bundleForm');
const bundleEditId = document.getElementById('bundleEditId');
const bundleNameInput = document.getElementById('bundleNameInput');
const bundleDescInput = document.getElementById('bundleDescInput');
const bundleItemsContainer = document.getElementById('bundleItemsContainer');
const bundleAddItemBtn = document.getElementById('bundleAddItemBtn');
const bundleSaveBtn = document.getElementById('bundleSaveBtn');
const bundleCancelBtn = document.getElementById('bundleCancelBtn');
const bundleTableBody = document.getElementById('bundleTableBody');
const bundleError = document.getElementById('bundleError');

let bundleApparecchiatureOptions = [];
let bundleProduttoriOptions = [];
const bundleRowTomSelects = new WeakMap();

const bundleEquipmentTomSelectOptions = {
  create: false,
  maxItems: 1,
  closeAfterSelect: true,
  allowEmptyOption: true,
  maxOptions: 500,
  searchField: ['text', 'value'],
  sortField: [{ field: 'text', direction: 'asc' }],
  onItemAdd() {
    this.close();
    this.blur();
  }
};

function setBundleError(message) {
  if (!bundleError) {
    return;
  }
  bundleError.textContent = message || '';
  bundleError.hidden = !message;
}

async function bundleRequest(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json();
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || `HTTP ${response.status}`);
  }
  return payload;
}

async function loadBundleApparecchiatureOptions() {
  try {
    const payload = await catalogRequest('./api/catalogs.php?action=list&type=apparecchiature&activeOnly=1');
    bundleApparecchiatureOptions = (payload.rows || [])
      .map((row) => String(row.label || '').trim())
      .filter((label) => label !== '');
  } catch (error) {
    bundleApparecchiatureOptions = [];
    setBundleError(error.message || 'Errore caricamento catalogo apparecchiature');
  }
}

async function loadBundleProduttoriOptions() {
  try {
    const payload = await catalogRequest('./api/catalogs.php?action=list&type=produttore&activeOnly=1');
    bundleProduttoriOptions = (payload.rows || [])
      .map((row) => String(row.label || '').trim())
      .filter((label) => label !== '');
  } catch (error) {
    bundleProduttoriOptions = [];
    setBundleError(error.message || 'Errore caricamento catalogo produttori');
  }
}

function buildCatalogSelectOptions(optionValues, selectedValue) {
  const normalizedSelected = String(selectedValue || '').trim();
  const optionsMarkup = ['<option value=""></option>'];
  optionValues.forEach((label) => {
    const isSelected = label === normalizedSelected ? ' selected' : '';
    optionsMarkup.push(`<option value="${escapeHtml(label)}"${isSelected}>${escapeHtml(label)}</option>`);
  });
  if (normalizedSelected && !optionValues.includes(normalizedSelected)) {
    optionsMarkup.push(`<option value="${escapeHtml(normalizedSelected)}" selected>${escapeHtml(normalizedSelected)}</option>`);
  }
  return optionsMarkup.join('');
}

function fillBundleTomSelect(tomSelectInstance, optionValues, selectedValue) {
  if (!tomSelectInstance) {
    return;
  }
  const normalizedSelected = String(selectedValue || '').trim();
  tomSelectInstance.clear(true);
  tomSelectInstance.clearOptions();
  tomSelectInstance.addOption({ value: '', text: '' });
  optionValues.forEach((optionValue) => {
    tomSelectInstance.addOption({ value: optionValue, text: optionValue });
  });
  if (normalizedSelected !== '' && !optionValues.includes(normalizedSelected)) {
    tomSelectInstance.addOption({ value: normalizedSelected, text: normalizedSelected });
  }
  tomSelectInstance.refreshOptions(false);
  if (normalizedSelected !== '') {
    tomSelectInstance.setValue(normalizedSelected, true);
  } else {
    tomSelectInstance.clear(true);
  }
}

function initBundleRowTomSelects(rowElement, item = {}) {
  if (typeof window.TomSelect !== 'function') {
    return;
  }
  const apparecchiaturaSelect = rowElement.querySelector('.bundle-item-apparecchiatura');
  const produttoreSelect = rowElement.querySelector('.bundle-item-produttore');
  const instances = {};

  if (apparecchiaturaSelect) {
    instances.apparecchiatura = new window.TomSelect(apparecchiaturaSelect, {
      ...bundleEquipmentTomSelectOptions,
      placeholder: 'Cerca apparecchiatura...'
    });
    fillBundleTomSelect(instances.apparecchiatura, bundleApparecchiatureOptions, item.apparecchiatura);
  }

  if (produttoreSelect) {
    instances.produttore = new window.TomSelect(produttoreSelect, {
      ...bundleEquipmentTomSelectOptions,
      placeholder: 'Cerca produttore...'
    });
    fillBundleTomSelect(instances.produttore, bundleProduttoriOptions, item.produttore);
  }

  bundleRowTomSelects.set(rowElement, instances);
}

function destroyBundleRowTomSelects(rowElement) {
  const instances = bundleRowTomSelects.get(rowElement);
  if (!instances) {
    return;
  }
  Object.values(instances).forEach((tomSelectInstance) => {
    try {
      tomSelectInstance.destroy();
    } catch {
      // ignore destroy errors on detached nodes
    }
  });
  bundleRowTomSelects.delete(rowElement);
}

function destroyAllBundleRowTomSelects() {
  if (!bundleItemsContainer) {
    return;
  }
  bundleItemsContainer.querySelectorAll('.bundle-equipment-row').forEach((rowElement) => {
    destroyBundleRowTomSelects(rowElement);
  });
}

function getBundleRowFieldValue(rowElement, selector, tomSelectKey) {
  const instances = bundleRowTomSelects.get(rowElement);
  const tomSelectInstance = instances?.[tomSelectKey];
  if (tomSelectInstance) {
    const value = tomSelectInstance.getValue();
    return Array.isArray(value) ? String(value[0] || '').trim() : String(value || '').trim();
  }
  return String(rowElement.querySelector(selector)?.value || '').trim();
}

function selectedOptionMarkup(value, optionValue) {
  return optionValue === value ? ' selected' : '';
}

function addBundleItemRow(item = {}) {
  if (!bundleItemsContainer) {
    return;
  }
  const tipologia = String(item.tipologia || '').trim();
  const nuovo = String(item.nuovo || '').trim();
  const trasferimento = String(item.trasferimento || '').trim();
  const rowElement = document.createElement('div');
  rowElement.className = 'table-editor bundle-equipment-row';
  rowElement.innerHTML = `
    <p class="table-editor-title">Inserisci nuova apparecchiatura</p>
    <div class="table-editor-grid">
      <label class="table-editor-field">
        <span>Apparecchiatura</span>
        <select class="bundle-item-apparecchiatura" required>${buildCatalogSelectOptions(bundleApparecchiatureOptions, item.apparecchiatura)}</select>
      </label>
      <label class="table-editor-field">
        <span>Ancoraggio</span>
        <select class="bundle-item-tipologia table-editor-tipologia-select">
          <option value=""></option>
          <option value="Carrellato"${selectedOptionMarkup(tipologia, 'Carrellato')}>Carrellato</option>
          <option value="Parete"${selectedOptionMarkup(tipologia, 'Parete')}>Parete</option>
          <option value="Pensile"${selectedOptionMarkup(tipologia, 'Pensile')}>Pensile</option>
          <option value="Soffitto"${selectedOptionMarkup(tipologia, 'Soffitto')}>Soffitto</option>
          <option value="Barra"${selectedOptionMarkup(tipologia, 'Barra')}>Barra</option>
        </select>
      </label>
      <label class="table-editor-field">
        <span>Produttore</span>
        <select class="bundle-item-produttore">${buildCatalogSelectOptions(bundleProduttoriOptions, item.produttore)}</select>
      </label>
      <label class="table-editor-field">
        <span>Modello</span>
        <input class="bundle-item-modello" type="text" value="${escapeHtml(item.modello || '')}">
      </label>
      <label class="table-editor-field">
        <span>Qta</span>
        <input class="bundle-item-qta" type="number" min="1" value="${escapeHtml(item.qta || '1')}">
      </label>
      <label class="table-editor-field">
        <span>Nuovo</span>
        <select class="bundle-item-nuovo">
          <option value=""></option>
          <option value="Si"${selectedOptionMarkup(nuovo, 'Si')}>Si</option>
          <option value="No"${selectedOptionMarkup(nuovo, 'No')}>No</option>
        </select>
      </label>
      <label class="table-editor-field">
        <span>Trasferimento</span>
        <select class="bundle-item-trasferimento">
          <option value=""></option>
          <option value="Si"${selectedOptionMarkup(trasferimento, 'Si')}>Si</option>
          <option value="No"${selectedOptionMarkup(trasferimento, 'No')}>No</option>
        </select>
      </label>
      <label class="table-editor-field">
        <span>Note</span>
        <input class="bundle-item-note" type="text" value="${escapeHtml(item.note || '')}">
      </label>
    </div>
    <div class="table-editor-actions">
      <button type="button" class="table-editor-button table-editor-button-muted bundle-item-remove" aria-label="Rimuovi riga">Rimuovi</button>
    </div>
  `;
  rowElement.querySelector('.bundle-item-remove')?.addEventListener('click', () => {
    destroyBundleRowTomSelects(rowElement);
    rowElement.remove();
  });
  bundleItemsContainer.appendChild(rowElement);
  initBundleRowTomSelects(rowElement, item);
}

function collectBundleItemsFromForm() {
  if (!bundleItemsContainer) {
    return [];
  }
  return Array.from(bundleItemsContainer.querySelectorAll('.bundle-equipment-row')).map((rowElement) => ({
    apparecchiatura: getBundleRowFieldValue(rowElement, '.bundle-item-apparecchiatura', 'apparecchiatura'),
    tipologia: String(rowElement.querySelector('.bundle-item-tipologia')?.value || '').trim(),
    produttore: getBundleRowFieldValue(rowElement, '.bundle-item-produttore', 'produttore'),
    modello: String(rowElement.querySelector('.bundle-item-modello')?.value || '').trim(),
    qta: String(rowElement.querySelector('.bundle-item-qta')?.value || '').trim(),
    nuovo: String(rowElement.querySelector('.bundle-item-nuovo')?.value || '').trim(),
    trasferimento: String(rowElement.querySelector('.bundle-item-trasferimento')?.value || '').trim(),
    note: String(rowElement.querySelector('.bundle-item-note')?.value || '').trim()
  })).filter((item) => item.apparecchiatura !== '');
}

function openBundleForm(bundle = null) {
  if (!bundleForm) {
    return;
  }
  bundleSectionEl?.setAttribute('open', '');
  setBundleError('');
  bundleForm.hidden = false;
  bundleEditId.value = bundle?.id ? String(bundle.id) : '';
  bundleNameInput.value = bundle?.name || '';
  bundleDescInput.value = bundle?.description || '';
  destroyAllBundleRowTomSelects();
  bundleItemsContainer.innerHTML = '';
  const items = Array.isArray(bundle?.items) ? bundle.items : [];
  if (items.length === 0) {
    addBundleItemRow();
  } else {
    items.forEach((item) => addBundleItemRow(item));
  }
}

function closeBundleForm() {
  if (!bundleForm) {
    return;
  }
  bundleForm.hidden = true;
  bundleEditId.value = '';
  bundleNameInput.value = '';
  bundleDescInput.value = '';
  destroyAllBundleRowTomSelects();
  bundleItemsContainer.innerHTML = '';
  setBundleError('');
}

function renderBundleList(bundles) {
  if (!bundleTableBody) {
    return;
  }
  const safeBundles = Array.isArray(bundles) ? bundles : [];
  bundleTableBody.innerHTML = safeBundles.map((bundle) => `
    <tr>
      <td data-label="ID">${escapeHtml(bundle.id)}</td>
      <td data-label="Nome">${escapeHtml(bundle.name)}</td>
      <td data-label="N. righe">${escapeHtml(bundle.itemCount)}</td>
      <td data-label="Attivo">${Number(bundle.isActive) === 1 ? 'Si' : 'No'}</td>
      <td data-label="Azioni">
        <button type="button" class="estrazioni-page-btn" data-bundle-edit="${bundle.id}">Modifica</button>
        <button type="button" class="estrazioni-page-btn" data-bundle-delete="${bundle.id}">Disattiva</button>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="5">Nessun bundle creato.</td></tr>';

  bundleTableBody.querySelectorAll('[data-bundle-edit]').forEach((button) => {
    button.addEventListener('click', async () => {
      const bundleId = Number(button.dataset.bundleEdit);
      try {
        const payload = await bundleRequest(`./api/bundles.php?action=get&id=${encodeURIComponent(bundleId)}`);
        openBundleForm(payload.bundle);
      } catch (error) {
        setBundleError(error.message || 'Errore caricamento bundle');
      }
    });
  });

  bundleTableBody.querySelectorAll('[data-bundle-delete]').forEach((button) => {
    button.addEventListener('click', async () => {
      const bundleId = Number(button.dataset.bundleDelete);
      const shouldDelete = window.confirm('Disattivare questo bundle?');
      if (!shouldDelete) {
        return;
      }
      await deleteBundle(bundleId);
    });
  });
}

async function loadBundles() {
  setBundleError('');
  try {
    const payload = await bundleRequest('./api/bundles.php?action=list&activeOnly=0');
    renderBundleList(payload.bundles);
  } catch (error) {
    setBundleError(error.message || 'Errore caricamento bundle');
  }
}

async function saveBundleForm() {
  setBundleError('');
  const name = String(bundleNameInput?.value || '').trim();
  if (name === '') {
    setBundleError('Il nome del bundle è obbligatorio.');
    return;
  }
  const items = collectBundleItemsFromForm();
  if (items.length === 0) {
    setBundleError('Aggiungi almeno un\'apparecchiatura al bundle.');
    return;
  }

  try {
    const bundleId = Number(bundleEditId?.value || 0);
    await bundleRequest('./api/bundles.php?action=save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: bundleId > 0 ? bundleId : undefined,
        name,
        description: String(bundleDescInput?.value || '').trim(),
        items
      })
    });
    closeBundleForm();
    await loadBundles();
  } catch (error) {
    setBundleError(error.message || 'Errore salvataggio bundle');
  }
}

async function deleteBundle(bundleId) {
  setBundleError('');
  try {
    await bundleRequest('./api/bundles.php?action=delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: bundleId })
    });
    await loadBundles();
  } catch (error) {
    setBundleError(error.message || 'Errore disattivazione bundle');
  }
}

bundleCreateBtn?.addEventListener('click', () => openBundleForm());
bundleAddItemBtn?.addEventListener('click', () => addBundleItemRow());
bundleSaveBtn?.addEventListener('click', () => {
  saveBundleForm();
});
bundleCancelBtn?.addEventListener('click', () => closeBundleForm());

updateBundleSectionVisibility();
