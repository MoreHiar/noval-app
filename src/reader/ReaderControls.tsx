import { useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import type { Book, ChapterMeta } from '../domain/books';
import { useLibrary } from '../state/library';
import { LINE_SPACING_OPTIONS, TURN_ANIMATION_OPTIONS, type ReaderPreferences } from './preferences';

type Panel = 'menu' | 'chapters' | 'settings';
type Props = {
  visible: boolean;
  book: Book | null;
  chapters: ChapterMeta[];
  chapterId: string;
  pageLabel: string;
  busy: boolean;
  preferences: ReaderPreferences;
  error: string;
  onClose(): void;
  onBack(): void;
  onChapter(chapter: ChapterMeta): void;
  onPreferences(patch: Partial<ReaderPreferences>): void;
};

function Icon({ name, color = '#514B41' }: { name: 'back' | 'shelf' | 'check' | 'chapters' | 'settings' | 'close'; color?: string }) {
  const paths = { back: 'm14 5-7 7 7 7', shelf: 'M6 3h12v18l-6-4-6 4V3Zm3 6h6m-3-3v6', check: 'm5 12 4 4L19 6', chapters: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01', settings: 'M4 6h16M4 12h16M4 18h16M9 3v6m6 0v6m-5 0v6', close: 'm6 6 12 12M6 18 18 6' };
  return <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden><Path d={paths[name]} stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}

export function ReaderControls(props: Props) {
  const { visible, book, chapters, chapterId, pageLabel, busy, preferences, error, onClose, onBack, onChapter, onPreferences } = props;
  const [panel, setPanel] = useState<Panel>('menu');
  const [saving, setSaving] = useState(false);
  const [shelfError, setShelfError] = useState('');
  const { isOnShelf, setBookOnShelf } = useLibrary();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const chapterIndex = chapters.findIndex(chapter => chapter.id === chapterId);
  const collected = book ? isOnShelf(book) : false;
  const previous = chapterIndex > 0 ? chapters[chapterIndex - 1] : undefined;
  const next = chapterIndex >= 0 ? chapters[chapterIndex + 1] : undefined;
  const close = () => { setPanel('menu'); onClose(); };

  async function addToShelf() {
    if (!book || saving || collected) return;
    setSaving(true); setShelfError('');
    try { await setBookOnShelf(book, true); }
    catch (cause) { setShelfError(cause instanceof Error ? cause.message : '加入书架失败，请重试。'); }
    finally { setSaving(false); }
  }

  return <Modal visible={visible} transparent statusBarTranslucent navigationBarTranslucent supportedOrientations={["portrait", "landscape-left", "landscape-right"]} animationType="fade" onRequestClose={() => panel === 'menu' ? close() : setPanel('menu')}>
    <View style={styles.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityRole="button" accessibilityLabel="收起阅读菜单" />
      <View style={[styles.topBar, { paddingTop: insets.top, paddingLeft: Math.max(insets.left, 12), paddingRight: Math.max(insets.right, 12) }]}>
        <View style={styles.topRow}>
          <Pressable style={styles.iconButton} onPress={onBack} accessibilityRole="button" accessibilityLabel="返回"><Icon name="back" /></Pressable>
          <Text numberOfLines={1} style={styles.bookTitle}>{book?.title ?? '阅读'}</Text>
          <Pressable onPress={addToShelf} disabled={!book || saving || collected} style={({ pressed }) => [styles.shelfButton, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={collected ? '已在书架' : '加入书架'} accessibilityState={{ disabled: !book || saving || collected, busy: saving }}>
            {saving ? <ActivityIndicator size="small" color="#526C63" /> : <Icon name={collected ? 'check' : 'shelf'} color="#526C63" />}
            <Text style={styles.shelfLabel}>{collected ? '已在书架' : saving ? '保存中' : '加入书架'}</Text>
          </Pressable>
        </View>
        {shelfError ? <Text accessibilityRole="alert" style={styles.error}>{shelfError}</Text> : null}
      </View>

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12), paddingLeft: insets.left, paddingRight: insets.right, maxHeight: Math.max(180, height - insets.top - 76) }]}>
        {panel === 'chapters' ? <View style={[styles.catalog, { height: Math.min(height * 0.58, 500) }]}>
          <View style={styles.panelHeading}>
            <View style={styles.headingCopy}><Text style={styles.panelTitle}>章节目录</Text><Text style={styles.caption}>共 {chapters.length} 章 · 当前第 {chapterIndex + 1} 章</Text></View>
            <Pressable style={styles.iconButton} onPress={() => setPanel('menu')} accessibilityRole="button" accessibilityLabel="收起章节目录"><Icon name="close" /></Pressable>
          </View>
          <FlatList data={chapters} keyExtractor={chapter => chapter.id} initialScrollIndex={Math.max(0, chapterIndex)} getItemLayout={(_, index) => ({ length: 64, offset: 64 * index, index })} initialNumToRender={12} maxToRenderPerBatch={12} windowSize={7}
            ListEmptyComponent={<Text style={styles.empty}>暂无章节目录</Text>}
            renderItem={({ item, index }) => <Pressable onPress={() => item.id === chapterId ? close() : onChapter(item)} disabled={busy || item.locked} accessibilityRole="button" accessibilityLabel={`${item.title}${item.locked ? '，未解锁' : item.id === chapterId ? '，正在阅读' : ''}`} accessibilityState={{ selected: item.id === chapterId, disabled: busy || !!item.locked }} style={({ pressed }) => [styles.chapterRow, item.id === chapterId && styles.currentChapter, item.locked && styles.disabled, pressed && styles.pressed]}>
              <Text style={styles.chapterIndex}>{String(index + 1).padStart(2, '0')}</Text><Text numberOfLines={1} style={[styles.chapterTitle, item.id === chapterId && styles.activeText]}>{item.title}</Text><Text style={styles.chapterState}>{item.locked ? '未解锁' : item.id === chapterId ? '在读' : ''}</Text>
            </Pressable>} />
        </View> : panel === 'settings' ? <ScrollView style={styles.settings} contentContainerStyle={styles.settingsContent}>
          <View style={styles.panelHeading}><View style={styles.headingCopy}><Text style={styles.panelTitle}>阅读设置</Text><Text style={styles.caption}>找到舒服的阅读节奏</Text></View><Pressable style={styles.iconButton} onPress={() => setPanel('menu')} accessibilityRole="button" accessibilityLabel="收起阅读设置"><Icon name="close" /></Pressable></View>
          <View style={styles.settingRow}><Text style={styles.settingLabel}>字号</Text><View style={styles.fontStepper}>
            <Pressable disabled={preferences.fontSize <= 14} onPress={() => onPreferences({ fontSize: preferences.fontSize - 2 })} accessibilityRole="button" accessibilityLabel="减小字号" style={[styles.stepButton, preferences.fontSize <= 14 && styles.disabled]}><Text style={styles.stepText}>A−</Text></Pressable>
            <Text style={styles.fontValue}>{preferences.fontSize}</Text>
            <Pressable disabled={preferences.fontSize >= 30} onPress={() => onPreferences({ fontSize: preferences.fontSize + 2 })} accessibilityRole="button" accessibilityLabel="增大字号" style={[styles.stepButton, preferences.fontSize >= 30 && styles.disabled]}><Text style={styles.stepText}>A＋</Text></Pressable>
          </View></View>
          <View style={styles.settingRow}><Text style={styles.settingLabel}>行间距</Text><View style={styles.options}>{LINE_SPACING_OPTIONS.map(option => <Pressable key={option.value} onPress={() => onPreferences({ lineSpacing: option.value })} accessibilityRole="radio" accessibilityLabel={`行间距${option.label}`} aria-checked={option.value === preferences.lineSpacing} style={[styles.option, option.value === preferences.lineSpacing && styles.selectedOption]}><Text style={[styles.optionText, option.value === preferences.lineSpacing && styles.activeText]}>{option.label}</Text></Pressable>)}</View></View>
          <View style={styles.settingRow}><Text style={styles.settingLabel}>翻页动画</Text><View style={styles.options}>{TURN_ANIMATION_OPTIONS.map(option => <Pressable key={option.value} onPress={() => onPreferences({ animation: option.value })} accessibilityRole="radio" aria-checked={option.value === preferences.animation} style={[styles.option, option.value === preferences.animation && styles.selectedOption]}><Text style={[styles.optionText, option.value === preferences.animation && styles.activeText]}>{option.label}</Text></Pressable>)}</View></View>
          <Text style={styles.settingsHint}>设置即时生效，并自动保存</Text>
        </ScrollView> : <View style={styles.chapterNavigation}>
          <Pressable onPress={() => previous && onChapter(previous)} disabled={busy || !previous || previous.locked} accessibilityRole="button" style={[styles.chapterButton, (!previous || previous.locked || busy) && styles.disabled]}><Text style={styles.navigationText}>上一章</Text></Pressable>
          <View style={styles.readingPosition}><Text numberOfLines={1} style={styles.positionTitle}>{chapters[chapterIndex]?.title ?? '当前章节'}</Text><Text style={styles.caption}>{pageLabel}</Text></View>
          <Pressable onPress={() => next && onChapter(next)} disabled={busy || !next || next.locked} accessibilityRole="button" style={[styles.chapterButton, (!next || next.locked || busy) && styles.disabled]}><Text style={styles.navigationText}>下一章</Text></Pressable>
        </View>}
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <View style={styles.tools}>
          <Pressable style={[styles.tool, panel === 'chapters' && styles.activeTool]} onPress={() => setPanel(panel === 'chapters' ? 'menu' : 'chapters')} accessibilityRole="button" accessibilityLabel="章节目录" aria-expanded={panel === 'chapters'}><Icon name="chapters" color={panel === 'chapters' ? '#526C63' : undefined} /><Text style={[styles.toolLabel, panel === 'chapters' && styles.activeText]}>目录</Text></Pressable>
          <View style={styles.toolDivider} />
          <Pressable style={[styles.tool, panel === 'settings' && styles.activeTool]} onPress={() => setPanel(panel === 'settings' ? 'menu' : 'settings')} accessibilityRole="button" accessibilityLabel="阅读设置" aria-expanded={panel === 'settings'}><Icon name="settings" color={panel === 'settings' ? '#526C63' : undefined} /><Text style={[styles.toolLabel, panel === 'settings' && styles.activeText]}>设置</Text></Pressable>
        </View>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'space-between', backgroundColor: 'rgba(38, 33, 26, 0.22)' },
  topBar: { backgroundColor: '#FAF7F0', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#E5DED1' },
  topRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  bookTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: '#39352F', marginRight: 6 },
  shelfButton: { minHeight: 44, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 5 },
  shelfLabel: { color: '#526C63', fontSize: 12, fontWeight: '600' },
  bottomBar: { backgroundColor: '#FAF7F0', borderTopLeftRadius: 22, borderTopRightRadius: 22, overflow: 'hidden' },
  chapterNavigation: { paddingTop: 18, paddingBottom: 14, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  chapterButton: { minHeight: 48, paddingHorizontal: 12, justifyContent: 'center' },
  navigationText: { fontSize: 13, color: '#514B41' },
  readingPosition: { flex: 1, alignItems: 'center', gap: 7 },
  positionTitle: { fontSize: 12, color: '#6F675A' },
  caption: { fontSize: 11, color: '#948A7B', marginTop: 4 },
  tools: { flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#E5DED1', marginHorizontal: 20, paddingTop: 10 },
  tool: { flex: 1, minHeight: 64, justifyContent: 'center', alignItems: 'center', gap: 7, borderRadius: 12 },
  activeTool: { backgroundColor: '#EBEFE7' },
  toolLabel: { color: '#514B41', fontSize: 12 },
  toolDivider: { width: 1, height: 24, backgroundColor: '#E5DED1', marginHorizontal: 14 },
  panelHeading: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingTop: 20, paddingBottom: 14 },
  headingCopy: { flex: 1 },
  panelTitle: { color: '#39352F', fontSize: 18, fontWeight: '700' },
  catalog: { flexShrink: 1 },
  chapterRow: { height: 64, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#EBE5DA' },
  currentChapter: { backgroundColor: '#EBEFE7' },
  chapterIndex: { color: '#A29889', fontSize: 11, minWidth: 28, fontVariant: ['tabular-nums'] },
  chapterTitle: { flex: 1, fontSize: 14, color: '#514B41' },
  chapterState: { color: '#526C63', fontSize: 11 },
  activeText: { color: '#526C63', fontWeight: '700' },
  settings: { flexShrink: 1 },
  settingsContent: { paddingBottom: 12 },
  settingRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 12, gap: 14 },
  settingLabel: { width: 56, fontSize: 13, color: '#6F675A' },
  fontStepper: { flex: 1, minWidth: 180, flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepButton: { flex: 1, minHeight: 44, borderRadius: 10, backgroundColor: '#F0EBE1', alignItems: 'center', justifyContent: 'center' },
  stepText: { color: '#514B41', fontSize: 18 },
  fontValue: { minWidth: 28, textAlign: 'center', color: '#526C63', fontSize: 16, fontVariant: ['tabular-nums'] },
  options: { flex: 1, minWidth: 180, flexDirection: 'row', gap: 6 },
  option: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderRadius: 10, backgroundColor: '#F0EBE1', borderWidth: 1, borderColor: 'transparent' },
  selectedOption: { borderColor: '#B7C5B5', backgroundColor: '#E8EEE3' },
  optionText: { color: '#776D5E', fontSize: 12, textAlign: 'center' },
  settingsHint: { textAlign: 'center', fontSize: 11, color: '#A29889', paddingTop: 9 },
  error: { color: '#A44036', fontSize: 12, paddingHorizontal: 24, paddingVertical: 8, textAlign: 'center' },
  empty: { padding: 24, color: '#948A7B', textAlign: 'center' },
  disabled: { opacity: 0.35 },
  pressed: { opacity: 0.55 },
});
