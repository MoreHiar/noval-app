import document from '../../docs/sources/jgwxs.json';
import type { RuleManagedSource } from '../domain/books';
import { parseRuleSource } from './legado';

const source = { ...parseRuleSource(document), bookSourceGroup: '内置' };

export const jgwxsDefaultBundle: { id: string; sources: RuleManagedSource[] } = {
  id: 'jgwxs-2026-11-25-v1',
  sources: [{ kind: 'legado', document: source, enabled: source.enabled ?? true }],
};
