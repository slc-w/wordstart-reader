function setState(tabId, enabled) {
  const state = enabled ? 'on' : 'off';
  return Promise.all([
    chrome.action.setIcon({ tabId, path: { 16: `icons/${state}-16.png`, 32: `icons/${state}-32.png` } }),
    chrome.action.setTitle({ tabId, title: `WordStart Reader — ${enabled ? 'On' : 'Off'}` })
  ]);
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message.type !== 'wordstart-icon' || !sender.tab) return;
  setState(sender.tab.id, message.enabled === true).then(() => respond({ ok: true }), () => respond({ ok: false }));
  return true;
});
chrome.tabs.onUpdated.addListener((tabId, change) => {
  if (change.status === 'loading') setState(tabId, false).catch(() => {});
});
