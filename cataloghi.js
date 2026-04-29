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

catalogTypeEl.addEventListener('change', () => {
  loadCatalogRows();
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
