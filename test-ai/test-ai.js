(function () {
  const ROOMS_API = 'api/list-rooms.php';
  const ROOM_DETAILS_API = '../api/get-room.php';
  const TEST_AI_JSON = 'test-ai.json';

  const THINKING_STEPS = [
    'Query al database (attributi stanza + dotazioni)…',
    'Normalizzazione e sintesi del contesto clinico…',
    'Iniezione del contesto nel prompt dell’utente…',
    'Composizione della risposta (demo)…',
  ];

  const MIN_THINKING_MS = 2600;

  const form = document.getElementById('testAiForm');
  const input = document.getElementById('testAiPrompt');
  const roomSelect = document.getElementById('testAiRoom');
  const submitBtn = document.getElementById('testAiSubmit');
  const messagesEl = document.getElementById('testAiMessages');
  const errorEl = document.getElementById('testAiError');
  const emptyHintEl = document.getElementById('testAiEmptyHint');
  const contextStatusEl = document.getElementById('testAiContextStatus');
  const contextBodyEl = document.getElementById('testAiContextBody');
  const promptPreviewEl = document.getElementById('testAiPromptPreview');
  const composedPromptEl = document.getElementById('testAiComposedPrompt');
  const copyPromptBtn = document.getElementById('testAiCopyPrompt');
  const copyStatusEl = document.getElementById('testAiCopyStatus');

  if (!form || !input || !messagesEl || !errorEl) {
    return;
  }

  let testAiConfigCache = null;
  let roomSelectUsable = false;
  let selectedRoomContext = null;

  function sleep(ms) {
    return new Promise(function resolveSleep(resolve) {
      setTimeout(resolve, ms);
    });
  }

  function setText(el, value) {
    if (!el) return;
    el.textContent = value;
  }

  async function loadTestAiConfig() {
    if (testAiConfigCache !== null) {
      return testAiConfigCache;
    }

    const res = await fetch(TEST_AI_JSON, { cache: 'no-store' });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    testAiConfigCache = data;
    return data;
  }

  function clearRoomContextUI() {
    selectedRoomContext = null;
    setText(contextStatusEl, 'Seleziona una stanza');
    if (contextBodyEl) {
      contextBodyEl.innerHTML =
        '<p class="test-ai-context-empty">Qui mostriamo in tempo reale i dati della stanza (attributi + apparecchiature) recuperati dal database e usati come contesto del prompt.</p>';
    }
    setText(composedPromptEl, '');
    if (promptPreviewEl) {
      promptPreviewEl.open = false;
    }
  }

  function renderRoomContextUI(context) {
    if (!contextBodyEl) return;

    if (!context || context.exists !== true) {
      contextBodyEl.innerHTML =
        '<p class="test-ai-context-empty">Nessuna stanza trovata per il riferimento selezionato.</p>';
      return;
    }

    const ref = context.roomRef || {};
    const a = context.attributiStanza || {};
    const apparecchiature = Array.isArray(context.apparecchiature)
      ? context.apparecchiature
      : [];

    const kvRows = [
      ['Blocco', ref.blocco ?? ''],
      ['Piano', ref.piano ?? ''],
      ['ID stanza', ref.roomCode ?? ''],
      ['Nome', a.roomCodeName ?? ''],
      ['Reparto', a.reparto ?? ''],
      ['Occupazione', a.occupazione ?? ''],
      ['Superficie', a.superficie ? `${a.superficie} m²` : ''],
    ].filter((row) => String(row[1]).trim() !== '');

    const apparecchiatureLis = apparecchiature
      .slice(0, 10)
      .map((item) => {
        const label = item && item.apparecchiatura ? String(item.apparecchiatura) : '';
        const qta = item && item.qta != null && String(item.qta).trim() !== '' ? ` <span class="test-ai-context-muted">(qta ${item.qta})</span>` : '';
        return label ? `<li>${escapeHtml(label)}${qta}</li>` : '';
      })
      .filter(Boolean)
      .join('');

    const moreCount = apparecchiature.length > 10 ? apparecchiature.length - 10 : 0;

    contextBodyEl.innerHTML =
      `<div class="test-ai-context-grid">` +
      kvRows
        .map(([k, v]) => `<div class="test-ai-context-kv"><span>${escapeHtml(k)}</span><strong>${escapeHtml(String(v))}</strong></div>`)
        .join('') +
      `</div>` +
      `<div class="test-ai-context-section">` +
      `<p class="test-ai-context-section-title">Apparecchiature recuperate</p>` +
      (apparecchiatureLis
        ? `<ul class="test-ai-context-list">${apparecchiatureLis}</ul>` +
          (moreCount ? `<p class="test-ai-context-more">… e altre ${moreCount} apparecchiature</p>` : '')
        : `<p class="test-ai-context-empty">Nessuna apparecchiatura associata.</p>`) +
      `</div>`;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function buildComposedPrompt(userPrompt) {
    const context = selectedRoomContext;
    const header = '### CONTESTO RECUPERATO DAL DATABASE';
    const footer = '### RICHIESTA UTENTE';

    if (!context || context.exists !== true) {
      return `${footer}\n${userPrompt}`;
    }

    const ref = context.roomRef || {};
    const a = context.attributiStanza || {};
    const apparecchiature = Array.isArray(context.apparecchiature)
      ? context.apparecchiature
      : [];

    const lines = [];
    lines.push(header);
    lines.push(`Blocco: ${ref.blocco ?? ''}`);
    lines.push(`Piano: ${ref.piano ?? ''}`);
    lines.push(`ID stanza: ${ref.roomCode ?? ''}`);
    if (a.roomCodeName) lines.push(`Nome: ${a.roomCodeName}`);
    if (a.reparto) lines.push(`Reparto: ${a.reparto}`);
    if (a.occupazione) lines.push(`Occupazione: ${a.occupazione}`);
    if (a.superficie) lines.push(`Superficie: ${a.superficie} m²`);
    if (apparecchiature.length) {
      lines.push('');
      lines.push('Apparecchiature:');
      for (const item of apparecchiature.slice(0, 20)) {
        if (!item || !item.apparecchiatura) continue;
        const qta = item.qta != null && String(item.qta).trim() !== '' ? ` (qta: ${item.qta})` : '';
        lines.push(`- ${item.apparecchiatura}${qta}`);
      }
      if (apparecchiature.length > 20) {
        lines.push(`- … +${apparecchiature.length - 20} altre`);
      }
    }
    lines.push('');
    lines.push(footer);
    lines.push(userPrompt);

    return lines.join('\n');
  }

  async function loadRoomsIntoSelect() {
    if (!roomSelect) {
      return;
    }

    roomSelect.disabled = true;
    roomSelect.setAttribute('aria-busy', 'true');
    roomSelectUsable = false;

    try {
      const res = await fetch(ROOMS_API, { cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      if (!data || data.ok !== true || !Array.isArray(data.rooms)) {
        throw new Error('Risposta API non valida');
      }

      roomSelect.innerHTML = '';
      const placeholderOpt = document.createElement('option');
      placeholderOpt.value = '';
      placeholderOpt.textContent = '— Nessuna stanza selezionata —';
      roomSelect.appendChild(placeholderOpt);

      for (const room of data.rooms) {
        if (!room || typeof room.label !== 'string' || room.id == null) {
          continue;
        }
        const opt = document.createElement('option');
        opt.value = String(room.id);
        opt.textContent = room.label;
        if (room.blocco) opt.dataset.blocco = String(room.blocco);
        if (room.piano != null) opt.dataset.piano = String(room.piano);
        if (room.roomCode) opt.dataset.roomCode = String(room.roomCode);
        roomSelect.appendChild(opt);
      }

      roomSelect.disabled = false;
      roomSelect.setAttribute('aria-busy', 'false');
      roomSelectUsable = true;
      errorEl.hidden = true;
    } catch (err) {
      console.error(err);
      roomSelect.innerHTML = '';
      const errOpt = document.createElement('option');
      errOpt.value = '';
      errOpt.textContent = 'Impossibile caricare le stanze';
      roomSelect.appendChild(errOpt);
      roomSelect.disabled = true;
      roomSelect.setAttribute('aria-busy', 'false');
      roomSelectUsable = false;
      errorEl.textContent =
        'Impossibile caricare l’elenco stanze dal database. Verifica la connessione e che il server PHP sia attivo.';
      errorEl.hidden = false;
    }
  }

  async function loadRoomContextFromDb() {
    if (!roomSelect || !roomSelect.value) {
      clearRoomContextUI();
      return;
    }

    const opt = roomSelect.selectedOptions && roomSelect.selectedOptions[0];
    const blocco = opt && opt.dataset ? opt.dataset.blocco : '';
    const piano = opt && opt.dataset ? opt.dataset.piano : '';
    const roomCode = opt && opt.dataset ? opt.dataset.roomCode : '';

    if (!blocco || !piano || !roomCode) {
      selectedRoomContext = null;
      setText(contextStatusEl, 'Riferimento stanza incompleto');
      return;
    }

    setText(contextStatusEl, 'Recupero dati stanza…');
    if (contextBodyEl) {
      contextBodyEl.innerHTML =
        '<p class="test-ai-context-loading">Query DB in corso…</p>';
    }

    try {
      const params = new URLSearchParams();
      params.set('blocco', blocco);
      params.set('piano', piano);
      params.set('roomCode', roomCode);

      const res = await fetch(`${ROOM_DETAILS_API}?${params.toString()}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      if (!data || data.ok !== true) {
        throw new Error('Risposta API non valida');
      }

      selectedRoomContext = data;
      setText(contextStatusEl, 'Contesto aggiornato (da DB)');
      renderRoomContextUI(data);

      const composed = buildComposedPrompt(input.value.trim() || '');
      setText(composedPromptEl, composed);
      if (promptPreviewEl) {
        promptPreviewEl.open = true;
      }
    } catch (err) {
      console.error(err);
      selectedRoomContext = null;
      setText(contextStatusEl, 'Errore nel recupero contesto');
      if (contextBodyEl) {
        contextBodyEl.innerHTML =
          '<p class="test-ai-context-empty">Impossibile recuperare i dati stanza dal DB. Verifica API e connessione.</p>';
      }
      setText(composedPromptEl, '');
    }
  }

  if (roomSelect) {
    roomSelect.addEventListener('change', function handleRoomChange() {
      void loadRoomContextFromDb();
    });
  }

  input.addEventListener('input', function handlePromptInput() {
    if (!composedPromptEl || !selectedRoomContext || selectedRoomContext.exists !== true) {
      return;
    }
    setText(composedPromptEl, buildComposedPrompt(input.value.trim() || ''));
  });

  Promise.all([loadRoomsIntoSelect(), loadTestAiConfig().catch(() => null)]).catch(
    function preloadErr(err) {
      console.error(err);
    }
  );

  if (copyPromptBtn) {
    copyPromptBtn.addEventListener('click', async function handleCopyPrompt() {
      const text = composedPromptEl ? composedPromptEl.textContent || '' : '';
      if (!text.trim()) {
        setText(copyStatusEl, 'Nessun prompt da copiare.');
        return;
      }
      try {
        await navigator.clipboard.writeText(text);
        setText(copyStatusEl, 'Copiato.');
      } catch (err) {
        console.error(err);
        setText(copyStatusEl, 'Copia non riuscita.');
      }
      setTimeout(function clearCopyStatus() {
        setText(copyStatusEl, '');
      }, 1600);
    });
  }

  function removeEmptyHint() {
    if (emptyHintEl && emptyHintEl.parentNode) {
      emptyHintEl.remove();
    }
  }

  function setFormBusy(busy) {
    form.classList.toggle('is-busy', busy);
    form.setAttribute('aria-busy', busy ? 'true' : 'false');
    input.disabled = busy;
    if (submitBtn) {
      submitBtn.disabled = busy;
    }
    if (roomSelect) {
      roomSelect.disabled = busy || !roomSelectUsable;
    }
  }

  function appendThinkingRow() {
    removeEmptyHint();

    const row = document.createElement('div');
    row.className = 'test-ai-msg test-ai-msg--assistant test-ai-msg--thinking';
    row.setAttribute('role', 'status');
    row.setAttribute('aria-live', 'polite');

    row.innerHTML =
      '<div class="test-ai-bubble test-ai-thinking-bubble">' +
      '<div class="test-ai-thinking-head">' +
      '<span class="test-ai-thinking-orb" aria-hidden="true"></span>' +
      '<span class="test-ai-thinking-brand">Modello clinico</span>' +
      '</div>' +
      '<p class="test-ai-thinking-step"></p>' +
      '<div class="test-ai-thinking-track" aria-hidden="true">' +
      '<div class="test-ai-thinking-track-fill"></div>' +
      '</div>' +
      '<div class="test-ai-thinking-dots" aria-hidden="true">' +
      '<span></span><span></span><span></span>' +
      '</div>' +
      '</div>';

    messagesEl.appendChild(row);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    const stepEl = row.querySelector('.test-ai-thinking-step');
    return {
      row: row,
      setStep: function setStep(text) {
        if (stepEl) {
          stepEl.textContent = text;
        }
        messagesEl.scrollTop = messagesEl.scrollHeight;
      },
    };
  }

  async function runThinkingSequence(thinking) {
    const stepMs = Math.max(380, Math.floor(MIN_THINKING_MS / THINKING_STEPS.length));

    for (let i = 0; i < THINKING_STEPS.length; i++) {
      thinking.setStep(THINKING_STEPS[i]);
      await sleep(stepMs);
    }
  }

  function appendBubble(role, content, options = {}) {
    removeEmptyHint();

    const row = document.createElement('div');
    row.className = `test-ai-msg test-ai-msg--${role}`;
    const bubble = document.createElement('div');
    bubble.className = 'test-ai-bubble';
    if (options.html && role === 'assistant') {
      bubble.innerHTML = content;
    } else {
      bubble.textContent = content;
    }
    row.appendChild(bubble);
    messagesEl.appendChild(row);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  form.addEventListener('submit', async function handleSubmit(event) {
    event.preventDefault();
    errorEl.hidden = true;
    errorEl.textContent = '';

    const prompt = input.value.trim();
    if (!prompt) {
      input.focus();
      return;
    }

    const composedPrompt = buildComposedPrompt(prompt);
    setText(composedPromptEl, composedPrompt);
    if (promptPreviewEl) {
      promptPreviewEl.open = true;
    }

    appendBubble('user', composedPrompt);
    input.value = '';

    const thinking = appendThinkingRow();
    thinking.setStep(THINKING_STEPS[0]);

    setFormBusy(true);

    const configPromise = loadTestAiConfig().catch(function configErr(e) {
      return { __error: e };
    });

    const thinkingPromise = runThinkingSequence(thinking);
    const t0 = Date.now();

    await thinkingPromise;

    const result = await configPromise;
    const elapsed = Date.now() - t0;
    if (elapsed < MIN_THINKING_MS) {
      await sleep(MIN_THINKING_MS - elapsed);
    }

    thinking.row.remove();

    if (result && result.__error) {
      console.error(result.__error);
      errorEl.textContent =
        'Impossibile leggere test-ai.json. Controlla che il file esista e sia JSON valido.';
      errorEl.hidden = false;
      appendBubble(
        'assistant',
        'Errore nel caricamento della risposta simulata da test-ai.json.'
      );
      setFormBusy(false);
      return;
    }

    const data = result;
    const reply =
      typeof data.response === 'string'
        ? data.response
        : 'Nel file test-ai.json manca una stringa nel campo "response".';
    appendBubble('assistant', reply, { html: true });
    setFormBusy(false);
  });
})();
