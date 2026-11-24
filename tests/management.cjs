const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
};

const { definitionId, parseRuleSource, sourceTypeName } = require('../src/sources/legado.ts');
const { fanqieSource, fanqieSourceId } = require('../src/sources/fanqie.ts');
const { deleteDefinition, deleteRuleSources, exportSources, mergeSources, parseLibraryData, saveDefinition, setAllRuleSourcesEnabled } = require('../src/sources/management.ts');

const demo = {
  kind: 'builtin', enabled: true,
  document: { version: 1, id: 'sample-library', name: '离线示例', books: [{ id: 'demo', title: '示例', author: '作者', summary: '简介', category: '小说', status: '已完结', accent: '#526C63' }], chapters: [] },
};
const rule = (name, enabled) => ({ kind: 'legado', enabled, document: { bookSourceName: name, bookSourceUrl: `https://${name}.example`, enabled, searchUrl: '/search' } });
const a = rule('one', true);
const b = rule('two', false);
const original = { version: 1, definitions: [demo, a, b], shelf: ['sample-library/demo', `${definitionId(a)}/book-1`, `${definitionId(b)}/book-2`] };

test('video source metadata round-trips without executing imported scripts', () => {
  const input = { bookSourceName: '短剧', bookSourceUrl: 'https://video.example', bookSourceType: 4, ruleExplore: [], jsLib: 'throw new Error("must never execute")' };
  const document = parseRuleSource(input);
  assert.equal(sourceTypeName(document), '视频');
  assert.deepEqual(JSON.parse(exportSources([{ kind: 'legado', enabled: true, document }], true)), input);
  assert.throws(() => parseRuleSource({ ...input, bookSourceType: 5 }), /bookSourceType/);
});

test('enable and disable all website sources without changing offline examples or mutating the original', () => {
  for (const enabled of [true, false]) {
    const result = setAllRuleSourcesEnabled(original, enabled);
    assert.equal(result.definitions[0], demo);
    assert.deepEqual(result.definitions.slice(1).map(entry => [entry.enabled, entry.document.enabled]), [[enabled, enabled], [enabled, enabled]]);
    assert.deepEqual(result.shelf, original.shelf);
    const restored = parseLibraryData(JSON.stringify(result));
    assert.deepEqual(restored.definitions.filter(entry => entry.kind === 'legado').map(entry => entry.enabled), [enabled, enabled]);
    assert.deepEqual(JSON.parse(exportSources(restored.definitions.filter(entry => entry.kind === 'legado'))).map(entry => entry.enabled), [enabled, enabled]);
  }
  assert.equal(original.definitions[1].document.enabled, true);
  assert.equal(original.definitions[2].document.enabled, false);
});

test('restoring empty or old libraries never installs or overwrites sources', () => {
  const restored = parseLibraryData(JSON.stringify(original));
  assert.deepEqual(restored.definitions.map(definitionId), [definitionId(a), definitionId(b)]);
  assert.deepEqual(restored.shelf, [`${definitionId(a)}/book-1`, `${definitionId(b)}/book-2`]);
  const disabled = { ...original, definitions: [demo, fanqieSource(false), a] };
  const again = parseLibraryData(JSON.stringify(disabled));
  assert.equal(again.definitions[0].enabled, false);
  assert.deepEqual(again.definitions[0].document.ruleSearch, fanqieSource().document.ruleSearch);
  assert.equal(parseLibraryData(JSON.stringify(again)).definitions.length, again.definitions.length);
  assert.deepEqual(parseLibraryData(JSON.stringify({ version: 1, definitions: [], shelf: [] })).definitions, []);
});

test('previously protected Fanqie source can be deleted, edited and replaced', () => {
  const current = { version: 1, definitions: [fanqieSource(), a], shelf: [`${fanqieSourceId}/book`, `${definitionId(a)}/other`] };
  assert.equal(deleteDefinition(current, fanqieSourceId).definitions.length, 1);
  assert.equal(saveDefinition(current, { ...fanqieSource().document, bookSourceName: '自定义' }, true, fanqieSourceId).definitions[0].document.bookSourceName, '自定义');
  const removed = deleteRuleSources(current, [fanqieSourceId, definitionId(a)]);
  assert.deepEqual(removed.definitions, []);
  assert.deepEqual(removed.shelf, []);
  const impostor = { ...fanqieSource(false), document: { ...fanqieSource().document, bookSourceName: '替换规则', searchUrl: 'https://invalid.example' } };
  const merged = mergeSources(current, [impostor], true);
  assert.equal(merged.updated, 1);
  assert.deepEqual(merged.data.definitions[0], impostor);
  assert.equal(setAllRuleSourcesEnabled(current, false).definitions[0].enabled, false);
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
