/* ============================================================
   LLM SWITCHBOARD — Application Logic
   ============================================================

   NOTE: Direct Anthropic API calls from a browser are blocked
   by CORS. To use Anthropic in production, route requests
   through a server-side proxy. The implementation below follows
   the spec exactly; wire up your proxy URL in callAnthropic().
   ============================================================ */

// ── State ──────────────────────────────────────────────────
const state = {
  provider: 'openai',
  mode: 'text',
  loading: false,
  a11y: false,
  strobe: 'off',
  session: { reqs: 0, totalMs: 0, totalTokens: 0, totalCost: 0 }
};

// ── Pricing (per 1K tokens) ────────────────────────────────
const PRICING = {
  openai: {
    'gpt-4o':        { in: 0.0025,  out: 0.01    },
    'gpt-4o-mini':   { in: 0.00015, out: 0.0006  },
    'gpt-3.5-turbo': { in: 0.0005,  out: 0.0015  }
  },
  anthropic: {
    'claude-opus-4-6':   { in: 0.015,   out: 0.075   },
    'claude-sonnet-4-6': { in: 0.003,   out: 0.015   },
    'claude-haiku-4-5':  { in: 0.00025, out: 0.00125 }
  }
};

// Anthropic display name → API model ID
const ANTHROPIC_IDS = {
  'claude-opus-4-6':   'claude-opus-4-6',
  'claude-sonnet-4-6': 'claude-sonnet-4-6',
  'claude-haiku-4-5':  'claude-haiku-4-5-20251001'
};

// ── Example Prompts ────────────────────────────────────────
const PROMPTS = {
  creative:  'Write a short sci-fi story about AI discovering it can dream.',
  code:      'Create a Python function that sorts a list of dictionaries by a given key, with support for ascending and descending order.',
  data:      'Analyze the following dataset and provide insights:\n[12, 45, 7, 23, 56, 34, 89, 2, 67, 41, 18, 95, 3, 72]',
  summarize: 'Summarize this article in 3 bullet points:\n\nThe global economy continues to face challenges from inflation, supply chain disruptions, and geopolitical tensions. Central banks have been raising interest rates to combat inflation, while governments debate fiscal stimulus measures. Experts disagree on whether a recession is inevitable.',
  translate: 'Translate the following text to Spanish:\n\nHello, my name is Alex. I am learning about artificial intelligence and its applications in modern technology.'
};

// ── Schema Templates ───────────────────────────────────────
const SCHEMAS = {
  product: {
    type: 'object',
    properties: {
      rating:         { type: 'number', minimum: 1, maximum: 5 },
      pros:           { type: 'array', items: { type: 'string' } },
      cons:           { type: 'array', items: { type: 'string' } },
      recommendation: { type: 'string' }
    },
    required: ['rating', 'recommendation']
  },
  contact: {
    type: 'object',
    properties: {
      name:    { type: 'string' },
      email:   { type: 'string', format: 'email' },
      phone:   { type: 'string' },
      company: { type: 'string' }
    },
    required: ['name', 'email']
  },
  tasks: {
    type: 'object',
    properties: {
      tasks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title:    { type: 'string' },
            priority: { type: 'string', enum: ['high', 'medium', 'low'] },
            due_date: { type: 'string', format: 'date' }
          }
        }
      }
    }
  },
  sentiment: {
    type: 'object',
    properties: {
      sentiment:   { type: 'string', enum: ['positive', 'negative', 'neutral'] },
      confidence:  { type: 'number', minimum: 0, maximum: 1 },
      key_phrases: { type: 'array', items: { type: 'string' } }
    }
  },
  recipe: {
    type: 'object',
    properties: {
      name:         { type: 'string' },
      ingredients:  { type: 'array', items: { type: 'string' } },
      instructions: { type: 'array', items: { type: 'string' } },
      prep_time:    { type: 'number' },
      servings:     { type: 'number' }
    }
  }
};

// ── DOM Shortcuts ──────────────────────────────────────────
const el = id => document.getElementById(id);

const dom = {
  body:            el('body'),
  // provider
  openaiBtn:       el('openaiBtn'),
  anthropicBtn:    el('anthropicBtn'),
  providerSwitch:  el('providerSwitch'),
  // mode
  textBtn:         el('textBtn'),
  jsonBtn:         el('jsonBtn'),
  modeSwitch:      el('modeSwitch'),
  // model / key
  modelSelect:     el('modelSelect'),
  apiKeyGroup:     el('apiKeyGroup'),
  apiKeyInput:     el('apiKeyInput'),
  keyStatus:       el('keyStatus'),
  anthKeyGroup:    el('anthKeyGroup'),
  anthKeyInput:    el('anthKeyInput'),
  anthKeyStatus:   el('anthKeyStatus'),
  // templates
  promptTpl:       el('promptTpl'),
  loadPromptBtn:   el('loadPromptBtn'),
  schemaTplGroup:  el('schemaTplGroup'),
  schemaTpl:       el('schemaTpl'),
  loadSchemaBtn:   el('loadSchemaBtn'),
  // input
  promptInput:     el('promptInput'),
  schemaWrap:      el('schemaWrap'),
  schemaInput:     el('schemaInput'),
  schemaErr:       el('schemaErr'),
  // actions
  sendBtn:         el('sendBtn'),
  sendBothBtn:     el('sendBothBtn'),
  clearBtn:        el('clearBtn'),
  // response
  responsePanels:  el('responsePanels'),
  primaryPanel:    el('primaryPanel'),
  primaryLabel:    el('primaryLabel'),
  primaryModel:    el('primaryModel'),
  primaryStatus:   el('primaryStatus'),
  primaryBody:     el('primaryBody'),
  primaryBadge:    el('primaryBadge'),
  compPanel:       el('compPanel'),
  compModel:       el('compModel'),
  compStatus:      el('compStatus'),
  compBody:        el('compBody'),
  compBadge:       el('compBadge'),
  // metrics
  mRT:             el('mRT'),
  mTTFT:           el('mTTFT'),
  mTPS:            el('mTPS'),
  mTotal:          el('mTotal'),
  mIn:             el('mIn'),
  mOut:            el('mOut'),
  mCost:           el('mCost'),
  sReqs:           el('sReqs'),
  sAvg:            el('sAvg'),
  sTokens:         el('sTokens'),
  sCost:           el('sCost'),
  // strobe / a11y
  strobeSelect:    el('strobeSelect'),
  a11yBtn:         el('a11yBtn'),
  // error toast
  errToast:        el('errToast'),
  errMsg:          el('errMsg'),
  closeErr:        el('closeErr')
};

// ── Initialise ─────────────────────────────────────────────
function init() {
  restorePrefs();
  rebuildModelSelect();
  updateProviderUI();
  bindAll();
}

// ── Restore localStorage Prefs ─────────────────────────────
function restorePrefs() {
  const key = localStorage.getItem('llm_openai_key');
  if (key) { dom.apiKeyInput.value = key; setKeyStatus(true); }

  const anthKey = localStorage.getItem('llm_anthropic_key');
  if (anthKey) { dom.anthKeyInput.value = anthKey; setAnthKeyStatus(true); }

  const strobe = localStorage.getItem('llm_strobe') || 'off';
  dom.strobeSelect.value = strobe;
  applyStrobe(strobe);

  if (localStorage.getItem('llm_a11y') === 'true') enableA11y();
}

// ── Event Binding ──────────────────────────────────────────
function bindAll() {
  // provider
  dom.openaiBtn.addEventListener('click', () => setProvider('openai'));
  dom.anthropicBtn.addEventListener('click', () => setProvider('anthropic'));
  dom.providerSwitch.addEventListener('click', () =>
    setProvider(state.provider === 'openai' ? 'anthropic' : 'openai'));
  dom.providerSwitch.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setProvider(state.provider === 'openai' ? 'anthropic' : 'openai');
    }
  });

  // mode
  dom.textBtn.addEventListener('click', () => setMode('text'));
  dom.jsonBtn.addEventListener('click', () => setMode('json'));
  dom.modeSwitch.addEventListener('click', () =>
    setMode(state.mode === 'text' ? 'json' : 'text'));
  dom.modeSwitch.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setMode(state.mode === 'text' ? 'json' : 'text');
    }
  });

  // api keys
  dom.apiKeyInput.addEventListener('input', () => {
    const k = dom.apiKeyInput.value.trim();
    if (k) { localStorage.setItem('llm_openai_key', k); setKeyStatus(true); }
    else   { localStorage.removeItem('llm_openai_key');  setKeyStatus(false); }
  });

  dom.anthKeyInput.addEventListener('input', () => {
    const k = dom.anthKeyInput.value.trim();
    if (k) { localStorage.setItem('llm_anthropic_key', k); setAnthKeyStatus(true); }
    else   { localStorage.removeItem('llm_anthropic_key');  setAnthKeyStatus(false); }
  });

  // templates
  dom.loadPromptBtn.addEventListener('click', loadPrompt);
  dom.loadSchemaBtn.addEventListener('click', loadSchema);

  // actions
  dom.sendBtn.addEventListener('click', handleSend);
  dom.sendBothBtn.addEventListener('click', handleSendBoth);
  dom.clearBtn.addEventListener('click', handleClear);

  // schema live-validate
  dom.schemaInput.addEventListener('input', validateSchema);

  // strobe
  dom.strobeSelect.addEventListener('change', () => {
    applyStrobe(dom.strobeSelect.value);
    localStorage.setItem('llm_strobe', dom.strobeSelect.value);
  });

  // a11y
  dom.a11yBtn.addEventListener('click', toggleA11y);

  // toast close
  dom.closeErr.addEventListener('click', hideErr);
}

// ── Provider ───────────────────────────────────────────────
function setProvider(p) {
  state.provider = p;
  const isOAI = p === 'openai';

  dom.openaiBtn.classList.toggle('active', isOAI);
  dom.openaiBtn.classList.toggle('openai-active', isOAI);
  dom.anthropicBtn.classList.toggle('active', !isOAI);
  dom.providerSwitch.classList.toggle('on', !isOAI);
  dom.providerSwitch.setAttribute('aria-checked', String(!isOAI));
  dom.openaiBtn.setAttribute('aria-pressed', String(isOAI));
  dom.anthropicBtn.setAttribute('aria-pressed', String(!isOAI));

  dom.apiKeyGroup.style.display  = isOAI  ? 'flex' : 'none';
  dom.anthKeyGroup.style.display = !isOAI ? 'flex' : 'none';

  rebuildModelSelect();
  updateProviderUI();
}

function updateProviderUI() {
  const isOAI = state.provider === 'openai';
  dom.primaryLabel.textContent = isOAI ? 'OpenAI' : 'Anthropic';
  dom.primaryPanel.className   = `resp-panel ${isOAI ? 'openai-panel' : 'anthropic-panel'}`;
}

function rebuildModelSelect() {
  const isOAI = state.provider === 'openai';
  const models = isOAI
    ? [['gpt-4o','GPT-4o'], ['gpt-4o-mini','GPT-4o Mini'], ['gpt-3.5-turbo','GPT-3.5 Turbo']]
    : [['claude-opus-4-6','Claude Opus 4.6'],
       ['claude-sonnet-4-6','Claude Sonnet 4.6'],
       ['claude-haiku-4-5','Claude Haiku 4.5']];

  dom.modelSelect.innerHTML = models
    .map(([v, t]) => `<option value="${v}">${t}</option>`)
    .join('');

  // Default selection
  const defaults = { openai: 'gpt-4o', anthropic: 'claude-sonnet-4-6' };
  dom.modelSelect.value = defaults[state.provider];
}

// ── Mode ───────────────────────────────────────────────────
function setMode(m) {
  state.mode = m;
  const isJSON = m === 'json';

  dom.textBtn.classList.toggle('active', !isJSON);
  dom.jsonBtn.classList.toggle('active', isJSON);
  dom.modeSwitch.classList.toggle('on', isJSON);
  dom.modeSwitch.setAttribute('aria-checked', String(isJSON));
  dom.textBtn.setAttribute('aria-pressed', String(!isJSON));
  dom.jsonBtn.setAttribute('aria-pressed', String(isJSON));

  dom.schemaWrap.style.display      = isJSON ? 'block' : 'none';
  dom.schemaTplGroup.style.display  = isJSON ? 'flex'  : 'none';
}

// ── Key Status ─────────────────────────────────────────────
function setKeyStatus(ok) {
  dom.keyStatus.textContent = ok ? '✓' : '';
  dom.keyStatus.style.color = ok ? 'var(--green)' : '';
}

function setAnthKeyStatus(ok) {
  dom.anthKeyStatus.textContent = ok ? '✓' : '';
  dom.anthKeyStatus.style.color = ok ? 'var(--green)' : '';
}

// ── Templates ──────────────────────────────────────────────
function loadPrompt() {
  const key = dom.promptTpl.value;
  if (key && PROMPTS[key]) dom.promptInput.value = PROMPTS[key];
}

function loadSchema() {
  const key = dom.schemaTpl.value;
  if (key && SCHEMAS[key]) {
    dom.schemaInput.value = JSON.stringify(SCHEMAS[key], null, 2);
    validateSchema();
  }
}

// ── Schema Validation ──────────────────────────────────────
function validateSchema() {
  const raw = dom.schemaInput.value.trim();
  if (!raw) { dom.schemaErr.style.display = 'none'; return true; }
  try {
    JSON.parse(raw);
    dom.schemaErr.style.display = 'none';
    return true;
  } catch (e) {
    dom.schemaErr.style.display = 'block';
    dom.schemaErr.textContent   = `Invalid JSON: ${e.message}`;
    return false;
  }
}

function getSchema() {
  if (state.mode !== 'json') return null;
  if (!validateSchema()) return undefined; // signals validation failure
  const raw = dom.schemaInput.value.trim();
  return raw ? JSON.parse(raw) : null;
}

// ── API Calls ──────────────────────────────────────────────
async function callOpenAI(prompt, schema, model, apiKey) {
  const body = {
    model,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 4096
  };

  if (schema) {
    body.response_format = {
      type: 'json_schema',
      json_schema: { name: 'structured_response', schema, strict: true }
    };
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `OpenAI error ${res.status}`);
  return data;
}

async function callAnthropic(prompt, schema, model, apiKey) {
  const apiUrl = 'http://localhost:3001/v1/messages';

  const content = schema
    ? `${prompt}\n\nRespond ONLY with valid JSON matching this schema:\n${JSON.stringify(schema, null, 2)}`
    : prompt;

  const body = {
    model: ANTHROPIC_IDS[model] || model,
    max_tokens: 4096,
    messages: [{ role: 'user', content }]
  };

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, __apiKey: apiKey.replace(/['"]/g, '').trim() })
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `Anthropic error ${res.status}`);
  return data;
}

// ── Response Parsing ───────────────────────────────────────
function parseTokens(data, provider) {
  return provider === 'openai'
    ? { inp: data.usage?.prompt_tokens    ?? 0, out: data.usage?.completion_tokens ?? 0 }
    : { inp: data.usage?.input_tokens     ?? 0, out: data.usage?.output_tokens     ?? 0 };
}

function parseText(data, provider) {
  return provider === 'openai'
    ? (data.choices?.[0]?.message?.content ?? '')
    : (data.content?.[0]?.text ?? '');
}

// ── Metrics Tracker ────────────────────────────────────────
function makeTracker() {
  return {
    t0:   Date.now(),
    tFFT: null,
    t1:   null,
    inp:  0,
    out:  0,
    mark()  { if (!this.tFFT) this.tFFT = Date.now(); },
    finish(i, o) { this.t1 = Date.now(); this.inp = i; this.out = o; },
    calc(provider, model) {
      const total   = this.t1 - this.t0;
      const ttft    = (this.tFFT ?? this.t1) - this.t0;
      const durOut  = this.t1 - (this.tFFT ?? this.t0);
      const tps     = durOut > 0 ? this.out / (durOut / 1000) : 0;
      const rates   = PRICING[provider]?.[model] ?? { in: 0, out: 0 };
      const cost    = (this.inp / 1000) * rates.in + (this.out / 1000) * rates.out;
      return { total, ttft, tps, cost };
    }
  };
}

// ── Display Helpers ────────────────────────────────────────
function setLoading(on) {
  state.loading        = on;
  dom.sendBtn.disabled = on;
  dom.sendBothBtn.disabled = on;
}

function setPanel(bodyEl, statusEl, { loading, text, isJSON, isError } = {}) {
  if (loading) {
    statusEl.textContent = '⟳ Loading…';
    statusEl.className   = 'resp-status loading';
    bodyEl.className     = 'resp-body loading';
    bodyEl.innerHTML     = '<p class="placeholder">Waiting for response…</p>';
    return;
  }
  if (isError) {
    statusEl.textContent = '✕ Error';
    statusEl.className   = 'resp-status err';
    bodyEl.className     = 'resp-body err';
    bodyEl.textContent   = text;
    return;
  }
  statusEl.textContent = '✓ Done';
  statusEl.className   = 'resp-status done';
  bodyEl.className     = 'resp-body done';
  if (isJSON) {
    try {
      bodyEl.innerHTML = `<pre class="json-out">${JSON.stringify(JSON.parse(text), null, 2)}</pre>`;
    } catch { bodyEl.textContent = text; }
  } else {
    bodyEl.textContent = text;
  }
  setTimeout(() => bodyEl.classList.remove('done'), 600);
}

function showMetrics(tracker, provider, model) {
  const { total, ttft, tps, cost } = tracker.calc(provider, model);
  dom.mRT.textContent    = `${total.toLocaleString()}ms`;
  dom.mTTFT.textContent  = `${ttft.toLocaleString()}ms`;
  dom.mTPS.textContent   = tps.toFixed(1);
  dom.mTotal.textContent = (tracker.inp + tracker.out).toLocaleString();
  dom.mIn.textContent    = tracker.inp.toLocaleString();
  dom.mOut.textContent   = tracker.out.toLocaleString();
  dom.mCost.textContent  = `$${cost.toFixed(6)}`;

  const s = state.session;
  s.reqs++;
  s.totalMs     += total;
  s.totalTokens += tracker.inp + tracker.out;
  s.totalCost   += cost;

  dom.sReqs.textContent   = String(s.reqs);
  dom.sAvg.textContent    = `${Math.round(s.totalMs / s.reqs)}ms`;
  dom.sTokens.textContent = s.totalTokens.toLocaleString();
  dom.sCost.textContent   = `$${s.totalCost.toFixed(4)}`;
}

// ── Error Toast ────────────────────────────────────────────
function showErr(msg) {
  dom.errMsg.textContent      = msg;
  dom.errToast.style.display  = 'flex';
  clearTimeout(showErr._timer);
  showErr._timer = setTimeout(hideErr, 8000);
}
function hideErr() { dom.errToast.style.display = 'none'; }

// ── Strobe ─────────────────────────────────────────────────
function applyStrobe(level) {
  state.strobe = level;
  dom.body.classList.remove('strobe-low', 'strobe-medium', 'strobe-high');
  if (level !== 'off' && !state.a11y) {
    dom.body.classList.add(`strobe-${level}`);
  }
}

// ── Accessibility ──────────────────────────────────────────
function toggleA11y() { state.a11y ? disableA11y() : enableA11y(); }

function enableA11y() {
  state.a11y = true;
  dom.body.classList.add('a11y');
  dom.body.classList.remove('strobe-low', 'strobe-medium', 'strobe-high');
  dom.a11yBtn.style.cssText = 'border-color:var(--green);color:var(--green);box-shadow:0 0 8px var(--green)';
  localStorage.setItem('llm_a11y', 'true');
}

function disableA11y() {
  state.a11y = false;
  dom.body.classList.remove('a11y');
  dom.a11yBtn.style.cssText = '';
  applyStrobe(state.strobe);
  localStorage.setItem('llm_a11y', 'false');
}

// ── Send (single provider) ─────────────────────────────────
async function handleSend() {
  const prompt = dom.promptInput.value.trim();
  if (!prompt) { showErr('Please enter a prompt.'); return; }

  const schema = getSchema();
  if (schema === undefined) { showErr('Fix the JSON schema errors before sending.'); return; }

  const model    = dom.modelSelect.value;
  const provider = state.provider;

  if (provider === 'openai' && !dom.apiKeyInput.value.trim()) {
    showErr('Please enter your OpenAI API key.'); return;
  }
  if (provider === 'anthropic' && !dom.anthKeyInput.value.trim()) {
    showErr('Please enter your Anthropic API key.'); return;
  }

  // Reset to single panel
  dom.compPanel.style.display = 'none';
  dom.responsePanels.classList.remove('split');
  dom.primaryBadge.style.display = 'none';
  updateProviderUI();
  dom.primaryModel.textContent = model;

  setLoading(true);
  setPanel(dom.primaryBody, dom.primaryStatus, { loading: true });

  const tracker = makeTracker();
  tracker.mark(); // no streaming — first token = request start

  try {
    const data = provider === 'openai'
      ? await callOpenAI(prompt, schema, model, dom.apiKeyInput.value.trim())
      : await callAnthropic(prompt, schema, model, dom.anthKeyInput.value.trim());

    const { inp, out } = parseTokens(data, provider);
    tracker.finish(inp, out);
    setPanel(dom.primaryBody, dom.primaryStatus, {
      text: parseText(data, provider),
      isJSON: state.mode === 'json'
    });
    showMetrics(tracker, provider, model);
  } catch (err) {
    tracker.t1 = Date.now();
    setPanel(dom.primaryBody, dom.primaryStatus, { text: err.message, isError: true });
    showErr(err.message);
  } finally {
    setLoading(false);
  }
}

// ── Send to Both ───────────────────────────────────────────
async function handleSendBoth() {
  const prompt = dom.promptInput.value.trim();
  if (!prompt) { showErr('Please enter a prompt.'); return; }

  const schema = getSchema();
  if (schema === undefined) { showErr('Fix the JSON schema errors before sending.'); return; }

  if (!dom.apiKeyInput.value.trim()) {
    showErr('Please enter your OpenAI API key for comparison mode.'); return;
  }

  const oaiModel  = 'gpt-4o';
  const anthModel = 'claude-sonnet-4-6';
  const apiKey    = dom.apiKeyInput.value.trim();
  const isJSON    = state.mode === 'json';

  // Show both panels side by side
  dom.compPanel.style.display = 'flex';
  dom.responsePanels.classList.add('split');
  dom.primaryBadge.style.display  = 'none';
  dom.compBadge.style.display     = 'none';

  // Primary = OpenAI
  dom.primaryLabel.textContent = 'OpenAI';
  dom.primaryPanel.className   = 'resp-panel openai-panel';
  dom.primaryModel.textContent = oaiModel;
  dom.compModel.textContent    = anthModel;

  setLoading(true);
  setPanel(dom.primaryBody, dom.primaryStatus, { loading: true });
  setPanel(dom.compBody, dom.compStatus, { loading: true });

  const tA = makeTracker();
  const tB = makeTracker();

  // Fire both concurrently
  const [resA, resB] = await Promise.allSettled([
    callOpenAI(prompt, schema, oaiModel, apiKey)
      .then(d => {
        tA.mark();
        const { inp, out } = parseTokens(d, 'openai');
        tA.finish(inp, out);
        setPanel(dom.primaryBody, dom.primaryStatus, { text: parseText(d, 'openai'), isJSON });
        return { tracker: tA, provider: 'openai', model: oaiModel };
      })
      .catch(e => {
        tA.t1 = Date.now();
        setPanel(dom.primaryBody, dom.primaryStatus, { text: e.message, isError: true });
        throw e;
      }),

    callAnthropic(prompt, schema, anthModel, dom.anthKeyInput.value.trim())
      .then(d => {
        tB.mark();
        const { inp, out } = parseTokens(d, 'anthropic');
        tB.finish(inp, out);
        setPanel(dom.compBody, dom.compStatus, { text: parseText(d, 'anthropic'), isJSON });
        return { tracker: tB, provider: 'anthropic', model: anthModel };
      })
      .catch(e => {
        tB.t1 = Date.now();
        setPanel(dom.compBody, dom.compStatus, { text: e.message, isError: true });
        throw e;
      })
  ]);

  setLoading(false);

  // Speed badge & metrics
  const okA = resA.status === 'fulfilled';
  const okB = resB.status === 'fulfilled';

  if (okA && okB) {
    const timeA = tA.t1 - tA.t0;
    const timeB = tB.t1 - tB.t0;
    if (timeA <= timeB) dom.primaryBadge.style.display = 'inline';
    else                dom.compBadge.style.display    = 'inline';
    // Show metrics for the faster one
    const winner = timeA <= timeB ? resA.value : resB.value;
    showMetrics(winner.tracker, winner.provider, winner.model);
  } else if (okA) {
    showMetrics(resA.value.tracker, resA.value.provider, resA.value.model);
  } else if (okB) {
    showMetrics(resB.value.tracker, resB.value.provider, resB.value.model);
  }

  if (!okA && !okB) showErr('Both requests failed. Check your API keys and network.');
}

// ── Clear ──────────────────────────────────────────────────
function handleClear() {
  dom.promptInput.value   = '';
  dom.schemaInput.value   = '';
  dom.schemaErr.style.display = 'none';

  const reset = (body, status) => {
    body.innerHTML    = '<p class="placeholder">Response will appear here…</p>';
    body.className    = 'resp-body';
    status.textContent = '';
    status.className   = 'resp-status';
  };
  reset(dom.primaryBody, dom.primaryStatus);
  reset(dom.compBody, dom.compStatus);

  dom.compPanel.style.display           = 'none';
  dom.responsePanels.classList.remove('split');
  dom.primaryBadge.style.display        = 'none';
  dom.compBadge.style.display           = 'none';

  ['mRT','mTTFT','mTPS','mTotal','mIn','mOut','mCost']
    .forEach(id => el(id).textContent = '--');

  hideErr();
  updateProviderUI();
}

// ── Boot ───────────────────────────────────────────────────
init();
