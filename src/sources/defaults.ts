import document from '../../docs/sources/jgwxs.json';
import washaiDocument from '../../docs/sources/washai.json';
import bqg349Document from '../../docs/sources/bqg349.json';
import type { RuleManagedSource } from '../domain/books';
import { parseRuleSource } from './legado';

const source = { ...parseRuleSource(document), bookSourceGroup: '内置' };
const washaiSource = { ...parseRuleSource(washaiDocument), bookSourceGroup: '内置' };

export const jgwxsDefaultBundle: { id: string; sources: RuleManagedSource[] } = {
  id: 'jgwxs-2026-11-25-v1',
  sources: [{ kind: 'legado', document: source, enabled: source.enabled ?? true }],
};

export const washaiDefaultBundle: { id: string; sources: RuleManagedSource[] } = {
  id: 'washai-2026-11-25-v1',
  sources: [{ kind: 'legado', document: washaiSource, enabled: washaiSource.enabled ?? true }],
};

export const bqg349DefaultBundle: { id: string; sources: RuleManagedSource[] } = {
  id: 'bqg349-2026-11-25-v1',
  sources: [{ kind: 'legado', document: parseRuleSource(bqg349Document), enabled: true }],
};
