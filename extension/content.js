(() => {
  if (globalThis.wordStartReader) return;
  let enabled = false;
  let options = WordStartFormat.defaults;
  const wrappers = new Set();
  const skip = 'script,style,noscript,textarea,input,select,option,button,pre,code,kbd,samp,svg,math,canvas,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[data-wordstart]';
  const observer = new MutationObserver(records => {
    observer.disconnect();
    try {
      for (const record of records) {
        if (record.type === 'characterData') process(record.target);
        else for (const node of record.addedNodes) process(node);
      }
      for (const wrapper of wrappers) if (!wrapper.isConnected) wrappers.delete(wrapper);
    } finally { if (enabled) observe(); }
  });
  function observe() { observer.observe(document.body, { subtree: true, childList: true, characterData: true }); }
  function eligible(node) {
    const parent = node.parentElement;
    if (!parent || parent.closest(skip) || parent.isContentEditable) return false;
    return options.scope === 'page' || !!parent.closest('article,main,[role="main"]');
  }
  function process(root) {
    if (!root.isConnected) return;
    const nodes = [];
    if (root.nodeType === Node.TEXT_NODE) nodes.push(root);
    else if (root.nodeType === Node.ELEMENT_NODE) {
      if (root.closest(skip)) return;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) nodes.push(walker.currentNode);
    }
    for (const node of nodes) {
      if (!eligible(node) || !node.data.trim()) continue;
      const parts = WordStartFormat.parts(node.data, options);
      if (!parts.some(part => part[1])) continue;
      const wrapper = document.createElement('span');
      wrapper.dataset.wordstart = '';
      for (const [text, bold, remainder] of parts) {
        if (!bold && !remainder) wrapper.append(document.createTextNode(text));
        else {
          const span = document.createElement('span');
          if (bold) span.style.setProperty('font-weight', String(options.weight), 'important');
          else {
            span.dataset.wordstartRemainder = '';
            span.style.setProperty('opacity', String(options.opacity / 100), 'important');
          }
          span.textContent = text;
          wrapper.append(span);
        }
      }
      node.replaceWith(wrapper);
      wrappers.add(wrapper);
    }
  }
  function restore() {
    observer.disconnect();
    for (const wrapper of wrappers) {
      if (wrapper.parentNode) wrapper.replaceWith(document.createTextNode(wrapper.textContent));
    }
    wrappers.clear();
  }
  function update(nextEnabled, nextOptions) {
    restore();
    options = WordStartFormat.settings(nextOptions);
    enabled = nextEnabled;
    if (enabled && document.body) { process(document.body); observe(); }
    chrome.runtime.sendMessage({ type: 'wordstart-icon', enabled }).catch(() => {});
    return { enabled, settings: options, count: wrappers.size };
  }
  globalThis.wordStartReader = { update };
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (message.type === 'wordstart-status') respond({ enabled, settings: options, count: wrappers.size });
    if (message.type === 'wordstart-update') respond(update(message.enabled, message.settings));
  });
})();
