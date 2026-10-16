const fields = ['percent', 'opacity', 'minLength', 'weight', 'scope'];
const el = id => document.getElementById(id);
let tabId;
let enabled = false;
let available = false;
let queue = Promise.resolve();
function setTheme(light) {
  document.body.classList.toggle('light', light);
  el('theme').setAttribute('aria-pressed', String(light));
  el('theme').setAttribute('aria-label', light ? 'Switch to dark mode' : 'Switch to light mode');
  el('theme').firstElementChild.innerHTML = light
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>';
}
el('theme').addEventListener('click', async () => {
  const light = !document.body.classList.contains('light');
  setTheme(light);
  await chrome.storage.local.set({ theme: light ? 'light' : 'dark' });
});
function read() { return WordStartFormat.settings(Object.fromEntries(fields.map(key => [key, el(key).value]))); }
function show(settings) { for (const key of fields) el(key).value = settings[key]; preview(); }
function formatLabel(node, text, active) {
  node.replaceChildren();
  for (const [part, bold, remainder] of WordStartFormat.parts(text, read())) {
    const span = document.createElement('span');
    span.textContent = part;
    if (active && bold) span.style.fontWeight = read().weight;
    if (active && remainder) span.style.opacity = read().opacity / 100;
    node.append(span);
  }
}
function popupText() {
  for (const node of document.querySelectorAll('[data-reader]')) {
    node.dataset.originalText ??= node.textContent;
    formatLabel(node, node.dataset.originalText, enabled);
  }
  for (const select of document.querySelectorAll('select')) {
    const menu = document.querySelector(`[data-select="${select.id}"]`);
    if (!menu) continue;
    formatLabel(menu.querySelector('summary .choice-text'), select.selectedOptions[0].textContent, enabled);
    for (const radio of menu.querySelectorAll('input[type=radio]')) radio.checked = radio.value === select.value;
  }
}
// Native select menus cannot reliably render partial-word styles. Use native
// disclosure controls with radio choices so keyboard and screen-reader support remain.
for (const select of document.querySelectorAll('select')) {
  select.hidden = true;
  const menu = document.createElement('details');
  menu.className = 'choice';
  menu.dataset.select = select.id;
  const summary = document.createElement('summary');
  summary.id = `${select.id}-summary`;
  summary.innerHTML = '<span class="choice-text"></span><span aria-hidden="true">⌄</span>';
  const label = document.querySelector(`label[for="${select.id}"]`);
  label.id = `${select.id}-label`;
  summary.setAttribute('aria-labelledby', `${label.id} ${summary.id}`);
  label.addEventListener('click', () => summary.focus());
  menu.append(summary);
  const group = document.createElement('div');
  group.className = 'choices';
  group.setAttribute('role', 'group');
  group.setAttribute('aria-labelledby', label.id);
  for (const option of select.options) {
    const row = document.createElement('label');
    const radio = document.createElement('input');
    radio.type = 'radio'; radio.name = `choice-${select.id}`; radio.value = option.value;
    const text = document.createElement('span'); text.dataset.reader = ''; text.textContent = option.textContent;
    row.append(radio, text); group.append(row);
    radio.addEventListener('change', () => {
      select.value = radio.value;
      select.dispatchEvent(new Event('input', { bubbles: true }));
    });
    radio.addEventListener('click', () => { menu.open = false; summary.focus(); });
  }
  menu.append(group); select.after(menu);
  menu.addEventListener('keydown', event => { if (event.key === 'Escape') { menu.open = false; summary.focus(); } });
  menu.addEventListener('toggle', () => { if (menu.open) for (const other of document.querySelectorAll('.choice')) if (other !== menu) other.open = false; });
}
function preview() {
  const settings = read();
  el('percentValue').textContent = settings.percent + '%';
  el('opacityValue').textContent = settings.opacity + '%';
  el('minLengthValue').textContent = settings.minLength;
  el('weightValue').textContent = settings.weight;
  el('minLength').setAttribute('aria-valuetext', settings.minLength + ' letters');
  el('weight').setAttribute('aria-valuetext', ({400: 'Normal', 500: 'Medium', 600: 'Semi-bold', 700: 'Bold', 800: 'Extra bold'})[settings.weight] + ', ' + settings.weight);
  el('preview').replaceChildren();
  for (const [text, bold, remainder] of WordStartFormat.parts('Make reading comfortable at your own pace.', settings)) {
    const span = document.createElement('span');
    span.textContent = text;
    if (bold) span.style.fontWeight = settings.weight;
    if (remainder) span.style.opacity = settings.opacity / 100;
    el('preview').append(span);
  }
  popupText();
}
function render(state) {
  enabled = state.enabled;
  el('toggle').checked = enabled;
  el('modeState').textContent = enabled ? 'On' : 'Off';
  el('logo').dataset.state = enabled ? 'on' : 'off';
  el('status').textContent = enabled ? (state.count ? 'On for this page' : 'No matching text. Try Whole page in settings.') : 'Normal text is on';
  popupText();
}
function enqueue(task) {
  queue = queue.then(task).catch(() => {
    available = false;
    el('toggle').disabled = true;
    el('status').textContent = 'This page cannot be changed. Open a normal web page and try again.';
  });
}
el('settings').addEventListener('submit', event => event.preventDefault());
el('toggle').addEventListener('change', () => enqueue(async () => {
  render(await chrome.tabs.sendMessage(tabId, { type: 'wordstart-update', enabled: !enabled, settings: read() }));
}));
function save() {
  preview();
  const settings = read();
  enqueue(async () => {
    await chrome.storage.local.set({ settings });
    if (available) render(await chrome.tabs.sendMessage(tabId, { type: 'wordstart-update', enabled, settings }));
  });
}
for (const key of fields) el(key).addEventListener('input', save);
el('reset').addEventListener('click', () => { show(WordStartFormat.defaults); save(); });
(async () => {
  const stored = await chrome.storage.local.get(['settings', 'theme']);
  setTheme(stored.theme === 'light');
  show(WordStartFormat.settings(stored.settings));
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  tabId = tab.id;
  await chrome.scripting.executeScript({ target: { tabId }, files: ['format.js', 'content.js'] });
  const state = await chrome.tabs.sendMessage(tabId, { type: 'wordstart-status' });
  if (state.enabled) show(state.settings);
  available = true;
  render(state);
  el('toggle').disabled = false;
})().catch(() => {
  el('modeState').textContent = 'Off';
  el('status').textContent = 'Open a normal web page. Browser settings, extension stores, and PDF viewers are not supported.';
});
