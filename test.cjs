const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.WORDSTART_PACKAGES ? path.join(process.env.WORDSTART_PACKAGES, 'playwright') : 'playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent('<main><p>Hello reading café café 中文 123.</p><a href="#target">Follow this link</a><input value="Keep this"><div contenteditable="true">Editable text</div><pre>Code example</pre></main><nav>Outside article</nav>');
    const original = await page.locator('body').textContent();
    await page.evaluate(() => { window.chrome = { runtime: { sendMessage: async () => ({}), onMessage: { addListener() {} } } }; });
    for (const file of ['format.js', 'content.js']) await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname, 'extension', file), 'utf8') });
    const state = await page.evaluate(() => wordStartReader.update(true, {}));
    assert.ok(state.count > 0);
    assert.equal(await page.locator('body').textContent(), original);
    assert.equal(await page.locator('pre [data-wordstart], [contenteditable] [data-wordstart], nav [data-wordstart]').count(), 0);
    assert.equal(await page.locator('input').inputValue(), 'Keep this');
    assert.equal(await page.locator('[data-wordstart-remainder]').first().evaluate(node => getComputedStyle(node).opacity), '0.4');
    assert.equal(await page.locator('[data-wordstart] > span:not([data-wordstart-remainder])').first().evaluate(node => getComputedStyle(node).opacity), '1');
    for (const background of ['#ffffff', '#111111']) {
      await page.evaluate(background => { document.body.style.background = background; wordStartReader.update(true, { opacity: 40 }); }, background);
      assert.equal(await page.locator('[data-wordstart-remainder]').first().evaluate(node => getComputedStyle(node).opacity), '0.4');
    }
    await page.evaluate(() => wordStartReader.update(true, { opacity: 100 }));
    assert.equal(await page.locator('[data-wordstart-remainder]').first().evaluate(node => getComputedStyle(node).opacity), '1');
    assert.equal(await page.evaluate(() => WordStartFormat.settings({ opacity: 0 }).opacity), 30);
    assert.equal(await page.evaluate(() => WordStartFormat.settings({}).opacity), 40);
    await page.locator('a').click();
    assert.ok(page.url().endsWith('#target'));
    await page.evaluate(() => { const p = document.createElement('p'); p.id = 'added'; p.textContent = 'Newly loaded content'; document.querySelector('main').append(p); });
    await page.waitForFunction(() => document.querySelector('#added [data-wordstart]'));
    await page.evaluate(() => wordStartReader.update(true, { percent: 20, scope: 'page' }));
    assert.ok(await page.locator('nav [data-wordstart]').count());
    assert.equal(await page.locator('[data-wordstart] [data-wordstart]').count(), 0);
    await page.evaluate(() => wordStartReader.update(false, {}));
    assert.equal(await page.locator('[data-wordstart]').count(), 0);
    assert.equal(await page.locator('body').textContent(), original.replace('Outside article', 'Newly loaded contentOutside article'));
    console.log('PASS: text preservation, settings, restoration, dynamic content, links, editable fields, code exclusions, and no nested formatting.');
    const popup = await browser.newPage();
    await popup.setContent(fs.readFileSync(path.join(__dirname, 'extension/popup.html'), 'utf8').replace(/<script[^>]*><\/script>/g, ''));
    await popup.addStyleTag({content: fs.readFileSync(path.join(__dirname, 'extension/popup.css'), 'utf8')});
    await popup.evaluate(() => {
      window.saved = {};
      window.chrome = {
        storage: { local: { get: async () => ({}), set: async value => { window.saved = value; } } },
        scripting: { executeScript: async () => {} },
        tabs: { query: async () => [{id: 1}], sendMessage: async (id, message) => ({enabled: message.enabled ?? false, count: 5, settings: message.settings}) }
      };
    });
    for (const file of ['format.js', 'popup.js']) await popup.addScriptTag({content: fs.readFileSync(path.join(__dirname, 'extension', file), 'utf8')});
    await popup.waitForFunction(() => !document.getElementById('toggle').disabled);
    assert.equal(await popup.getByRole('slider').count(), 4);
    assert.equal(await popup.locator('#opacity').inputValue(), '40');
    assert.equal(await popup.locator('#weight').inputValue(), '600');
    await popup.getByRole('button', {name: 'Switch to light mode'}).click();
    assert.equal(await popup.locator('body').evaluate(node => node.classList.contains('light')), true);
    assert.equal(await popup.locator('#theme svg path').count(), 1);
    await popup.getByRole('button', {name: 'Switch to dark mode'}).click();
    assert.equal(await popup.locator('body').evaluate(node => node.classList.contains('light')), false);
    for (const weight of ['400', '500']) {
      await popup.locator('#weight').fill(weight);
      await popup.waitForFunction(value => document.getElementById('weightValue').textContent === value, weight);
      assert.equal(await popup.evaluate(() => WordStartFormat.settings({weight: Number(document.getElementById('weight').value)}).weight), Number(weight));
    }
    await popup.locator('#reset').click();
    const scopeBox = await popup.locator('.action-row > div').boundingBox();
    const resetBox = await popup.locator('#reset').boundingBox();
    const previewBox = await popup.locator('.preview-panel').boundingBox();
    assert.ok(Math.abs(scopeBox.width - resetBox.width) < 1);
    assert.ok(resetBox.x > scopeBox.x);
    assert.ok(previewBox.y >= resetBox.y + resetBox.height);
    await popup.locator('[data-select="scope"] summary').click();
    await popup.getByRole('radio', {name: 'Whole page', exact: true}).check();
    await popup.waitForFunction(() => window.saved.settings?.scope === 'page');
    await popup.locator('#reset').click();
    await popup.waitForFunction(() => window.saved.settings?.scope === 'article');
    await popup.getByRole('switch').check();
    await popup.waitForFunction(() => document.getElementById('modeState').textContent === 'On');
    assert.equal(await popup.locator('header [style], #settings label[for] [style], footer [style], #reset [style]').count(), 0);
    assert.ok((await popup.locator('#logo').getAttribute('data-state')).includes('on'));
    await popup.locator('[data-select="scope"] summary').click();
    assert.ok(await popup.locator('[data-select="scope"] .choices span span[style]').count());
    await popup.locator('#weight').fill('800');
    await popup.waitForFunction(() => window.saved.settings?.weight === 800);
    await popup.locator('[data-select="scope"] summary').focus();
    await popup.keyboard.press('Escape');
    assert.equal(await popup.locator('[data-select="scope"]').getAttribute('open'), null);
    await popup.getByRole('switch').uncheck();
    await popup.waitForFunction(() => document.getElementById('modeState').textContent === 'Off');
    assert.equal(await popup.locator('[data-select="scope"] .choices span span[style]').count(), 0);
    assert.ok((await popup.locator('#logo').getAttribute('data-state')).includes('off'));
    await popup.locator('#reset').click();
    await popup.waitForFunction(() => window.saved.settings?.weight === 600);
    await popup.screenshot({path: path.join(__dirname, 'popup-off.png')});
    console.log('PASS: popup switch, formatted dropdown choices, setting persistence, reset, Escape, and popup logo states.');
    const vm = require('node:vm');
    const icons = []; let onMessage; let onUpdated;
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'extension/background.js'), 'utf8'), {chrome: {
      action: {setIcon: async value => icons.push(value), setTitle: async () => {}},
      runtime: {onMessage: {addListener: listener => { onMessage = listener; }}},
      tabs: {onUpdated: {addListener: listener => { onUpdated = listener; }}}
    }});
    await new Promise(resolve => onMessage({type:'wordstart-icon', enabled:true}, {tab:{id:12}}, resolve));
    assert.equal(icons.at(-1).path[16], 'icons/on-16.png');
    onUpdated(12, {status:'loading'});
    assert.equal(icons.at(-1).path[16], 'icons/off-16.png');
    assert.equal(icons.at(-1).tabId, 12);
    console.log('PASS: toolbar icon on state and navigation reset per tab.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });



