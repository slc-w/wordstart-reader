(() => {
  const defaults = { percent: 50, minLength: 3, weight: 600, opacity: 40, scope: 'article' };
  function settings(input = {}) {
    const number = (key, min, max) => Number.isFinite(Number(input[key]))
      ? Math.max(min, Math.min(max, Math.round(Number(input[key])))) : defaults[key];
    return { percent: number('percent', 10, 80), minLength: number('minLength', 1, 10),
      weight: number('weight', 400, 900), opacity: number('opacity', 30, 100), scope: input.scope === 'page' ? 'page' : 'article' };
  }
  function parts(text, options) {
    const result = [];
    let last = 0;
    // Leave CJK scripts unchanged: their word boundaries require a different method.
    for (const match of text.matchAll(/[\p{Script=Latin}\p{Script=Greek}\p{Script=Cyrillic}][\p{Script=Latin}\p{Script=Greek}\p{Script=Cyrillic}\p{M}]*/gu)) {
      if (match.index > last) result.push([text.slice(last, match.index), false]);
      const letters = Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(match[0]), s => s.segment);
      const count = letters.length < options.minLength ? 0 : Math.ceil(letters.length * options.percent / 100);
      if (count) result.push([letters.slice(0, count).join(''), true]);
      if (count < letters.length) result.push([letters.slice(count).join(''), false, count > 0]);
      last = match.index + match[0].length;
    }
    if (last < text.length) result.push([text.slice(last), false]);
    return result;
  }
  globalThis.WordStartFormat = { defaults, settings, parts };
})();
