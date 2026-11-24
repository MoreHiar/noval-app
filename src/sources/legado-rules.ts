import { compile, selectAll } from 'css-select';
import { getInnerHTML, textContent } from 'domutils';
import { parseDocument } from 'htmlparser2';

type RuleNode = ReturnType<typeof parseDocument>['children'][number];
type SearchNode = { format: 'html'; value: RuleNode } | { format: 'json'; value: unknown };
type Stage = { selector: string; index?: number; exclude?: number };

export class UnsupportedSearchRule extends Error {}

function stages(rule: string): Stage[] {
  if (!rule.trim()) throw new UnsupportedSearchRule('选择器为空。');
  if (/@js:|<js>|\{\{|^\$|^\/|&&|\|\|/i.test(rule)) throw new UnsupportedSearchRule('搜索规则包含尚未支持的脚本、JSONPath、XPath 或组合表达式。');
  // Split Legado traversal steps, preserving @ inside CSS attribute values.
  const parts = rule.match(/(?:\[[^\]]*\]|[^@])+/g) ?? [];
  return parts.map(raw => {
    let selector = raw.trim();
    const exclude = selector.match(/!(\d+)$/);
    if (exclude) selector = selector.slice(0, exclude.index);
    const index = selector.match(/\.(-?\d+)$/);
    if (index) selector = selector.slice(0, index.index);
    selector = selector.replace(/^class\./, '.').replace(/^id\./, '#').replace(/^tag\./, '');
    try { compile(selector); }
    catch { throw new UnsupportedSearchRule('暂不支持选择器：' + raw); }
    return { selector, ...(index ? { index: Number(index[1]) } : {}), ...(exclude ? { exclude: Number(exclude[1]) } : {}) };
  });
}

function select(nodes: RuleNode[], steps: Stage[]): RuleNode[] {
  return steps.reduce((current, step) => current.flatMap(node => {
    const found = selectAll(step.selector, node);
    const filtered = step.exclude === undefined ? found : found.filter((_, index) => index !== step.exclude);
    if (step.index === undefined) return filtered;
    const index = step.index < 0 ? filtered.length + step.index : step.index;
    return filtered[index] ? [filtered[index]] : [];
  }), nodes);
}

function replacement(expression: string): { rule: string; replace(value: string): string } {
  const [rule, pattern, replace = ''] = expression.split('##');
  let regex: RegExp | undefined;
  if (pattern) {
    try { regex = new RegExp(pattern, 'g'); }
    catch { throw new UnsupportedSearchRule('搜索规则包含无效的正则替换。'); }
  }
  return { rule, replace: value => (regex ? value.replace(regex, replace) : value).trim() };
}

function jsonPath(expression: string): (input: unknown) => unknown[] {
  if (!expression.startsWith('$')) throw new UnsupportedSearchRule('JSONPath 必须以 $ 开始。');
  const steps: (string | number | null)[] = [];
  let rest = expression.slice(1);
  while (rest) {
    const match = rest.match(/^(?:\.([\w-]+)|\[(?:(\d+)|(["'])(.*?)\3|(\*))\])/);
    if (!match) throw new UnsupportedSearchRule('暂不支持此 JSONPath 表达式：' + expression);
    steps.push(match[1] ?? (match[2] !== undefined ? Number(match[2]) : match[5] ? null : match[4]));
    rest = rest.slice(match[0].length);
  }
  return input => steps.reduce<unknown[]>((items, key) => items.flatMap(item => {
    if (item === null || typeof item !== 'object') return [];
    if (key === null) return Array.isArray(item) ? item : Object.values(item);
    if (!Object.prototype.hasOwnProperty.call(item, key)) return [];
    return [(item as Record<string | number, unknown>)[key]];
  }), [input]);
}

const jsonText = (value: unknown) => value === null || value === undefined ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);

export function compileListRule(expression: unknown): (html: string) => SearchNode[] {
  if (typeof expression !== 'string') throw new UnsupportedSearchRule('缺少搜索列表规则 bookList。');
  if (expression.trim().startsWith('$')) {
    const filter = expression.trim().match(/^(\$[^?]*?)\[\?\(@\.([\w-]+)\s*==\s*(['"])(.*?)\3\)\]$/);
    const path = jsonPath(filter ? filter[1] : expression.trim());
    if (!filter && expression.includes('[?')) throw new UnsupportedSearchRule('暂不支持此 JSONPath 过滤表达式：' + expression);
    return body => {
      let data: unknown;
      try { data = JSON.parse(body); }
      catch { throw new Error('书源应返回 JSON，但收到的内容不是有效 JSON。'); }
      if (data && typeof data === 'object' && 'code' in data && Number(data.code) >= 400) {
        throw new Error('书源接口返回错误（' + String(data.code).slice(0,20) + '），请稍后重试。');
      }
      const values = path(data);
      if (!values.length || values.every(value => value === null)) throw new Error('书源响应中缺少搜索列表，请检查规则是否失效。');
      const items = values.flatMap(value => Array.isArray(value) ? value : [value]);
      return (filter ? items.filter(value => value !== null && typeof value === 'object' && String((value as Record<string, unknown>)[filter[2]]) === filter[4]) : items)
        .map(value => ({ format: 'json', value }));
    };
  }
  const steps = stages(expression);
  return html => select([parseDocument(html)], steps).map(value => ({ format: 'html', value }));
}

export function compileFieldRule(expression: unknown): (node: SearchNode) => string {
  if (typeof expression !== 'string' || !expression.trim()) return () => '';
  const { rule, replace } = replacement(expression);
  if (/@js:|<js>/i.test(rule)) throw new UnsupportedSearchRule('字段规则包含尚未支持的脚本。');
  if (rule.startsWith('$')) {
    const path = jsonPath(rule);
    return node => node.format === 'json' ? replace(path(node.value).map(jsonText).join(' ')) : '';
  }
  if (rule.includes('{{')) {
    const fields = [...rule.matchAll(/\{\{\s*(\$[^{}]*?)\s*\}\}/g)].map(match => ({ token: match[0], path: jsonPath(match[1]) }));
    const remaining = fields.reduce((value, field) => value.replace(field.token, ''), rule);
    if (!fields.length || /\{\{|\}\}/.test(remaining)) throw new UnsupportedSearchRule('暂不支持此字段模板。');
    return node => node.format === 'json' ? replace(fields.reduce((value, field) => value.replace(field.token, field.path(node.value).map(jsonText).join(' ')), rule)) : '';
  }
  const output = rule.match(/(?:^|@)(text|textNodes|ownText|html|[\w-]+)$/);
  const hasOutput = !!output && (output.index! > 0 || ['text', 'textNodes', 'ownText', 'html', 'href', 'src'].includes(rule));
  const method = hasOutput ? output![1] : 'text';
  const path = hasOutput ? rule.slice(0, output!.index) : rule;
  const steps = path.trim() ? stages(path) : [];
  return node => node.format === 'html' ? replace(select([node.value], steps).map(target => {
    if (method === 'html') return getInnerHTML(target);
    if (method === 'ownText' || method === 'textNodes') return 'children' in target ? target.children.filter(child => child.type === 'text').map(child => textContent(child)).join(' ') : '';
    if (method === 'text') return textContent(target).replace(/\s+/g, ' ').trim();
    return 'attribs' in target ? target.attribs[method] ?? '' : '';
  }).filter(Boolean).join(' ')) : '';
}
