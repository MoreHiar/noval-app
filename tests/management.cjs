const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
};

const { definitionId } = require('../src/sources/legado.ts');
const { deleteRuleSources, exportSources, parseLibraryData, setAllRuleSourcesEnabled } = require('../src/sources/management.ts');

const demo = {
  kind: 'builtin', enabled: true,
  document: { version: 1, id: 'sample-library', name: '离线示例', books: [{ id: 'demo', title: '示例', author: '作者', summary: '简介', category: '小说', status: '已完结', accent: '#526C63' }], chapters: [] },
};
const rule = (name, enabled) => ({ kind: 'legado', enabled, document: { bookSourceName: name, bookSourceUrl: `https://${name}.example`, enabled, searchUrl: '/search' } });
const a = rule('one', true);
const b = rule('two', false);
const original = { version: 1, definitions: [demo, a, b], shelf: ['sample-library/demo', `${definitionId(a)}/book-1`, `${definitionId(b)}/book-2`] };

test('enable and disable all website sources without changing offline examples or mutating the original', () => {
  for (const enabled of [true, false]) {
    const result = setAllRuleSourcesEnabled(original, enabled);
    assert.equal(result.definitions[0], demo);
    assert.deepEqual(result.definitions.slice(1).map(entry => [entry.enabled, entry.document.enabled]), [[enabled, enabled], [enabled, enabled]]);
    assert.deepEqual(result.shelf, original.shelf);
    const restored = parseLibraryData(JSON.stringify(result));
    assert.deepEqual(restored.definitions.slice(1).map(entry => entry.enabled), [enabled, enabled]);
    assert.deepEqual(JSON.parse(exportSources(restored.definitions.slice(1))).map(entry => entry.enabled), [enabled, enabled]);
  }
  assert.equal(original.definitions[1].document.enabled, true);
  assert.equal(original.definitions[2].document.enabled, false);
});

test('bulk delete removes only selected website sources and their shelf references', () => {
  const one = deleteRuleSources(original, [definitionId(a), 'sample-library', 'missing']);
  assert.deepEqual(one.definitions, [demo, b]);
  assert.deepEqual(one.shelf, ['sample-library/demo', `${definitionId(b)}/book-2`]);
  const all = deleteRuleSources(original, [definitionId(a), definitionId(b)]);
  assert.deepEqual(all.definitions, [demo]);
  assert.deepEqual(all.shelf, ['sample-library/demo']);
  assert.equal(original.definitions.length, 3);
});
