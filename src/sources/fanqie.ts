import type { RuleManagedSource, RuleSourceDocument } from '../domain/books';
import { ruleSourceId } from './legado';

export const fanqieDocument: RuleSourceDocument = {
  bookSourceName: '番茄小说',
  bookSourceUrl: 'https://novel.snssdk.com',
  bookSourceType: 0,
  bookSourceGroup: '内置',
  bookSourceComment: '番茄公开搜索与阅读页面；支持搜索、目录及公开章节正文。',
  enabled: true,
  enabledExplore: false,
  searchUrl: 'https://novel.snssdk.com/api/novel/channel/homepage/search/search/v1/?aid=1967&offset={{(page-1)*10}}&q={{key}}',
  ruleSearch: {
    bookList: "$.data.ret_data[?(@.genre == '0')]",
    name: '$.title',
    author: '$.author',
    intro: '$.abstract',
    coverUrl: '$.thumb_url',
    coverFallbackUrl: '$.audio_thumb_uri',
    bookUrl: '$.book_id##^([0-9]+).*$##https://fanqienovel.com/page/$1',
  },
};

export const fanqieSourceId = ruleSourceId(fanqieDocument);
export const isFanqieSourceId = (id: string) => id === fanqieSourceId;
export const fanqieSource = (enabled = true): RuleManagedSource => ({
  kind: 'legado', enabled, document: { ...fanqieDocument, enabled },
});
