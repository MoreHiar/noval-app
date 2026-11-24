import documents from './defaults/selected-four.json';
import { parseRuleSource } from './legado';
import type { RuleManagedSource } from '../domain/books';

export const selectedDefaultBundle = {
  id:'selected-four-2026-11-24-v1',
  sources:documents.map(value=>{
    const document=parseRuleSource(value);
    return {kind:'legado',document,enabled:document.enabled??true} as RuleManagedSource;
  }),
};
