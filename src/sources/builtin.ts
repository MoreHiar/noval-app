import { StaticSourceDocument } from '../domain/books';
import { createStaticAdapter } from './static';

export const builtinDocument: StaticSourceDocument = {
  version: 1,
  id: 'sample-library',
  name: '演示书库',
  description: '离线示例内容，可立即体验书架、搜索、目录和阅读。',
  books: [
    { id: 'starlight', title: '星河邮差', author: '林南', summary: '在群星之间送信的人，终于收到了寄给自己的那封信。', category: '科幻', status: '连载中', accent: '#455D7A' },
    { id: 'rain', title: '雨后书店', author: '叶迟', summary: '一间只在雨后开门的书店，收藏着每个人未说出口的故事。', category: '治愈', status: '已完结', accent: '#8C715C' },
    { id: 'mountain', title: '山海行记', author: '宋青', summary: '沿着旧地图出发，去寻找传说里仍会发光的山海。', category: '奇幻', status: '连载中', accent: '#5F796B' },
    { id: 'moon', title: '月光档案', author: '苏未', summary: '一卷记录月光的旧档案，指向一座被遗忘的海边小城。', category: '悬疑', status: '连载中', accent: '#8D7899' },
    { id: 'summer', title: '漫长夏日', author: '周见', summary: '那年夏天，我们在海风里交换了关于未来的秘密。', category: '青春', status: '已完结', accent: '#B58462' },
    { id: 'garden', title: '夜间花园', author: '闻溪', summary: '每到午夜，花园便为迷路的人亮起一盏灯。', category: '幻想', status: '已完结', accent: '#607A72' },
    { id: 'north', title: '北境来信', author: '顾白', summary: '寄自雪线以北的信，带来一段漫长旅途的起点。', category: '冒险', status: '连载中', accent: '#6B8498' },
  ],
  chapters: [
    { id: '1', bookId: 'starlight', title: '第一章 · 没有地址的信', paragraphs: ['凌晨四点，星港的灯还亮着。许舟把最后一袋邮件放进飞船，发现袋底压着一封没有地址的信。', '信封上只有一句话：请在日出之前，送给那个还记得星星名字的人。', '他抬头望向舷窗。城市上方的天空被灯光照得发白，只有最远的一颗星，仍在安静地闪烁。'] },
    { id: '2', bookId: 'starlight', title: '第二章 · 向晨光出发', paragraphs: ['飞船离港时，天边刚露出一线蓝色。许舟调出旧航图，决定先去没有路灯的环城岛。', '他不知道收信人是谁，却隐约觉得，这一次旅程会和以往不同。'] },
    { id: '1', bookId: 'rain', title: '第一章 · 雨停以后', paragraphs: ['雨停的第三分钟，街角那扇一直紧闭的木门开了。', '门口挂着一块小牌子，上面写着：今天也欢迎带着故事来。'] },
    { id: '2', bookId: 'rain', title: '第二章 · 借来的一页', paragraphs: ['书架最上层有一本没有封面的书。她翻开第一页，看见了自己的名字。', '窗外的云慢慢散开，阳光落在那一行尚未写完的字上。'] },
    { id: '1', bookId: 'mountain', title: '第一章 · 旧地图', paragraphs: ['地图是从祖父的箱底找出来的。纸已经泛黄，山脊却仍用鲜亮的青色描着。', '宋野把地图放到窗前，发现背面还藏着一条只有逆光才能看见的小路。'] },
    { id: '1', bookId: 'moon', title: '第一章 · 银色卷宗', paragraphs: ['档案室里没有窗，月光却落在第七排书架上。', '苏禾抽出那卷银色纸带，发现上面写着一座从地图上消失的小城。'] },
    { id: '1', bookId: 'summer', title: '第一章 · 海风', paragraphs: ['暑假的第一天，海边的风比约定来得更早。', '我们把写给未来的信装进玻璃瓶，埋在离潮线很远的沙地里。'] },
    { id: '1', bookId: 'garden', title: '第一章 · 第七盏灯', paragraphs: ['花园里的灯从不同时亮起。', '直到那天夜里，第七盏灯照亮了一条不在地图上的小路。'] },
    { id: '1', bookId: 'north', title: '第一章 · 雪线以北', paragraphs: ['邮戳上只有一个模糊的日期，和从未听过的地名。', '她沿着地图北上，直到最后一条公路消失在雪里。'] },
  ],
};

export const builtinSource = createStaticAdapter(builtinDocument, 'builtin');
