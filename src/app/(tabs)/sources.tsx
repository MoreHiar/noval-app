import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SourceButton, SourceMessage, sourceStyles as s } from '../../components/SourceControls';
import { TabBarIcon } from '../../components/TabBarIcon';
import { theme } from '../../components/theme';
import { RuleManagedSource } from '../../domain/books';
import { exportSourceFile } from '../../sources/files';
import { definitionId, isRuleSource, sourceTypeName } from '../../sources/legado';
import { exportSources } from '../../sources/management';
import { useLibrary } from '../../state/library';

const filters = [{ key: 'all', label: '全部' }, { key: 'enabled', label: '已启用' }, { key: 'disabled', label: '已停用' }] as const;
type Filter = typeof filters[number]['key'];

export default function SourcesScreen() {
  const { sourceDefinitions: allDefinitions, ready, storageError, retryLoad, setSourceEnabled, setAllSourcesEnabled, removeSource, removeSources, shelf } = useLibrary();
  const sourceDefinitions = useMemo(() => allDefinitions.filter(isRuleSource), [allDefinitions]);
  const deletableCount = sourceDefinitions.length;
  const enabledCount = sourceDefinitions.filter(entry => entry.enabled).length;
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<RuleManagedSource | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const visible = useMemo(() => sourceDefinitions.filter(entry => {
    const matchesFilter = filter === 'all' || (filter === 'enabled' ? entry.enabled : !entry.enabled);
    const term = query.trim().toLocaleLowerCase();
    const { bookSourceName: name, bookSourceUrl: id, bookSourceComment: description, bookSourceGroup: group } = entry.document;
    return matchesFilter && (!term || `${name} ${id} ${group ?? ''} ${description ?? ''}`.toLocaleLowerCase().includes(term));
  }), [sourceDefinitions, filter, query]);
  const selected = sourceDefinitions.filter(entry => selectedIds.includes(definitionId(entry)));
  const selectedSet = new Set(selected.map(definitionId));
  const selectableVisible = visible;
  const allVisibleSelected = selectableVisible.length > 0 && selectableVisible.every(entry => selectedSet.has(definitionId(entry)));
  const deletingIds = confirmBulkDelete ? selected.map(definitionId) : deleting ? [definitionId(deleting)] : [];
  const deletingIdSet = new Set(deletingIds);
  const deletedShelfCount = shelf.filter(key => deletingIdSet.has(key.split('/')[0])).length;

  const perform = async (action: () => Promise<void>) => {
    setBusy(true); setError(''); setMessage('');
    try { await action(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '操作失败，请重试。'); }
    finally { setBusy(false); }
  };
  const exportItems = (entries: RuleManagedSource[], single = false) => perform(async () => {
    await exportSourceFile(single ? `${entries[0].document.bookSourceName.replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]/g, '_').slice(0, 60) || 'source'}.json` : 'noval-sources.json', exportSources(entries, single));
    setMessage('已发起书源导出，导出的 JSON 文件可再次导入。');
  });
  const deleteNow = () => perform(async () => {
    if (confirmBulkDelete) {
      if (!selected.length) { setConfirmBulkDelete(false); return; }
      await removeSources(selected.map(definitionId));
      setMessage(`已删除 ${selected.length} 个书源。`);
      setSelectedIds([]);
      setSelecting(false);
      setConfirmBulkDelete(false);
    } else if (deleting) {
      await removeSource(definitionId(deleting));
      setMessage(`已删除「${deleting.document.bookSourceName}」。`);
      setDeleting(null);
    }
  });
  const setAllEnabled = (enabled: boolean) => perform(async () => {
    await setAllSourcesEnabled(enabled);
    setMessage(`已${enabled ? '启用' : '禁用'}全部 ${sourceDefinitions.length} 个书源。`);
  });
  const toggleSelection = (id: string) => setSelectedIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  const toggleVisibleSelection = () => setSelectedIds(current => allVisibleSelected
    ? current.filter(id => !selectableVisible.some(entry => definitionId(entry) === id))
    : [...new Set([...current, ...selectableVisible.map(definitionId)])]);
  const cancelSelection = () => { setSelecting(false); setSelectedIds([]); setConfirmBulkDelete(false); };

  return (
    <View style={styles.page}>
      <FlatList
        data={ready ? visible : []}
        keyExtractor={item => definitionId(item)}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 22 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            <Text style={styles.eyebrow}>YOUR READING SOURCES</Text>
            <View style={styles.headingRow}><Text style={styles.heading}>书源管理</Text><View style={styles.totalBadge}><Text style={styles.totalText}>{sourceDefinitions.length} 个书源</Text></View></View>
            <Text style={styles.subtitle}>管理网站、搜索和解析规则，兼容阅读书源格式。</Text>
            <View style={styles.summary}>
              <View style={styles.summaryIcon}><TabBarIcon name="sources" color={theme.dark} size={29} /></View>
              <View style={styles.summaryCopy}><Text style={styles.summaryTitle}>{enabledCount} 个已启用</Text><Text style={styles.summaryHint}>启用状态与规则保存在本地，可随时导出。</Text></View>
            </View>
            <Text style={styles.runtimeHint}>已启用书源会参与搜索；暂支持简单 GET／POST 与 CSS／Legado 选择器，未支持的规则会在搜索页显示原因。在线目录、正文与脚本运行仍在接入中。</Text>
            <View style={styles.toolbar}>
              <SourceButton onPress={() => { setMessage(''); setError(''); router.push('/source/edit'); }} disabled={!ready || busy || selecting}>＋ 新增书源</SourceButton>
              <SourceButton secondary onPress={() => { setMessage(''); setError(''); router.push('/source/import'); }} disabled={!ready || busy || selecting}>导入</SourceButton>
              <SourceButton secondary onPress={() => exportItems(sourceDefinitions)} disabled={!ready || busy || !sourceDefinitions.length || selecting}>全部导出</SourceButton>
            </View>
            <View style={styles.bulkToolbar}>
              <SourceButton secondary onPress={() => setAllEnabled(true)} disabled={!ready || busy || selecting || enabledCount === sourceDefinitions.length}>全部启用</SourceButton>
              <SourceButton secondary onPress={() => setAllEnabled(false)} disabled={!ready || busy || selecting || enabledCount === 0}>全部禁用</SourceButton>
              <SourceButton danger onPress={() => { setError(''); setMessage(''); setSelecting(true); }} disabled={!ready || busy || selecting || !deletableCount}>批量删除</SourceButton>
            </View>
            <View style={styles.search}>
              <TabBarIcon name="search" color={theme.muted} size={18} />
              <TextInput style={styles.searchInput} value={query} onChangeText={setQuery} placeholder="搜索名称、网址或分组" placeholderTextColor={theme.muted} accessibilityLabel="搜索书源" autoCapitalize="none" autoCorrect={false} />
            </View>
            <View style={styles.filters}>
              {filters.map(item => <Pressable key={item.key} onPress={() => setFilter(item.key)} accessibilityRole="button" accessibilityState={{ selected: filter === item.key }} style={[styles.filter, filter === item.key && styles.activeFilter]}><Text style={[styles.filterText, filter === item.key && styles.activeFilterText]}>{item.label}</Text></Pressable>)}
              <Text style={styles.resultCount}>{visible.length} 个</Text>
            </View>
            {selecting && <View style={styles.selectionBar}>
              <Text style={styles.selectionCount}>已选 {selected.length} 个</Text>
              <SourceButton secondary onPress={toggleVisibleSelection} disabled={busy || !selectableVisible.length}>{allVisibleSelected ? '取消选中当前' : '选中当前可见'}</SourceButton>
              <SourceButton secondary onPress={cancelSelection} disabled={busy}>取消</SourceButton>
              <SourceButton danger onPress={() => setConfirmBulkDelete(true)} disabled={busy || !selected.length}>删除所选</SourceButton>
            </View>}
            {storageError ? <><SourceMessage error>{storageError}</SourceMessage><SourceButton secondary onPress={retryLoad}>重新加载</SourceButton></> : null}
            {error ? <SourceMessage error>{error}</SourceMessage> : null}
            {message ? <SourceMessage>{message}</SourceMessage> : null}
          </View>
        }
        ListEmptyComponent={ready ? <View style={styles.empty}><Text style={styles.emptyTitle}>{sourceDefinitions.length ? '没有匹配的书源' : '添加第一个书源'}</Text><Text style={styles.emptyHint}>{sourceDefinitions.length ? '试试其他关键词或筛选条件。' : '通过网络地址或本地 JSON 文件导入书源。'}</Text></View> : !storageError ? <ActivityIndicator color={theme.accent} style={styles.loading} /> : undefined}
        renderItem={({ item }) => (
          <View style={[styles.source, !item.enabled && styles.disabledSource]}>
            <View style={styles.sourceHeading}>
              {selecting ? <Pressable onPress={() => toggleSelection(definitionId(item))} accessibilityRole="checkbox" accessibilityState={{ checked: selectedSet.has(definitionId(item)) }} accessibilityLabel={`选择${item.document.bookSourceName}`} style={[styles.checkbox, selectedSet.has(definitionId(item)) && styles.checkedBox]}><Text style={styles.checkmark}>{selectedSet.has(definitionId(item)) ? '✓' : ''}</Text></Pressable> : <View style={styles.sourceBadge}><TabBarIcon name="sources" color={item.enabled ? theme.accent : theme.muted} size={24} /></View>}
              <View style={styles.sourceInfo}><Text style={styles.sourceName}>{item.document.bookSourceName}</Text><Text style={styles.sourceId} selectable>{item.document.bookSourceUrl}</Text></View>
              {!selecting && <Switch value={item.enabled} onValueChange={enabled => perform(() => setSourceEnabled(definitionId(item), enabled))} disabled={busy || !ready} accessibilityLabel={`启用${item.document.bookSourceName}`} thumbColor={theme.paper} trackColor={{ true: theme.accent }} />}
            </View>
            {item.document.bookSourceComment ? <Text style={styles.description} numberOfLines={2}>{item.document.bookSourceComment}</Text> : null}
            <View style={styles.metadata}><Text style={styles.kind}>{sourceTypeName(item.document)}书源</Text><Text style={styles.metaText}>{item.document.bookSourceGroup || '未分组'}</Text><Text style={styles.metaText}>{item.document.enabledExplore ? '含发现规则' : '无发现入口'}</Text><Text style={[styles.status, !item.enabled && styles.inactiveStatus]}>{item.enabled ? '已启用' : '已停用'}</Text></View>
            {selecting ? <Pressable style={styles.selectRow} onPress={() => toggleSelection(definitionId(item))} accessibilityRole="checkbox" accessibilityState={{ checked: selectedSet.has(definitionId(item)) }} accessibilityLabel={`${selectedSet.has(definitionId(item)) ? '取消选择' : '选择'}${item.document.bookSourceName}`}><Text style={styles.rowButtonText}>{selectedSet.has(definitionId(item)) ? '已选择' : '选择此书源'}</Text></Pressable> : <View style={styles.sourceActions}>
              <Pressable style={styles.rowButton} onPress={() => { setMessage(''); setError(''); router.push({ pathname: '/source/edit', params: { id: definitionId(item) } }); }} disabled={busy} accessibilityRole="button" accessibilityLabel={`编辑${item.document.bookSourceName}`}><Text style={styles.rowButtonText}>编辑</Text></Pressable>
              <View style={styles.actionDivider} />
              <Pressable style={styles.rowButton} onPress={() => exportItems([item], true)} disabled={busy} accessibilityRole="button" accessibilityLabel={`导出${item.document.bookSourceName}`}><Text style={styles.rowButtonText}>导出</Text></Pressable>
              <View style={styles.actionDivider} />
              <Pressable style={styles.rowButton} onPress={() => { setError(''); setDeleting(item); }} disabled={busy} accessibilityRole="button" accessibilityLabel={`删除${item.document.bookSourceName}`}><Text style={styles.deleteText}>删除</Text></Pressable>
            </View>}
          </View>
        )}
      />
      {(deleting !== null || confirmBulkDelete) && <Modal visible transparent animationType="fade" onRequestClose={() => { if (!busy) { setDeleting(null); setConfirmBulkDelete(false); } }}>
        <View style={[styles.backdrop, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.dialog} accessibilityViewIsModal>
            <Text style={s.sectionTitle}>{confirmBulkDelete ? `删除所选 ${selected.length} 个书源？` : '删除书源？'}</Text>
            <Text style={styles.dialogText}>{confirmBulkDelete ? `删除所选 ${selected.length} 个书源后，这些书源的书籍将不再可用` : `删除「${deleting?.document.bookSourceName}」后，该书源的书籍将不再可用`}{deletedShelfCount > 0 ? `，并从书架移除 ${deletedShelfCount} 本收藏` : ''}。如需保留，请先导出备份。</Text>
            {error ? <SourceMessage error>{error}</SourceMessage> : null}
            <View style={styles.dialogActions}><SourceButton secondary onPress={() => { setDeleting(null); setConfirmBulkDelete(false); }} disabled={busy}>取消</SourceButton><SourceButton danger onPress={deleteNow} disabled={busy || !deletingIds.length}>{busy ? '删除中…' : '确认删除'}</SourceButton></View>
          </View>
        </View>
      </Modal>}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.background },
  content: { paddingHorizontal: 20, paddingBottom: 130, maxWidth: 760, width: '100%', alignSelf: 'center' },
  eyebrow: { color: theme.accent, fontSize: 10, fontWeight: '700', letterSpacing: 2.5, marginBottom: 9 },
  headingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  heading: { color: theme.ink, fontSize: 30, fontWeight: '800', letterSpacing: 1 },
  totalBadge: { backgroundColor: '#EAE8E0', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  totalText: { color: '#666E62', fontSize: 11, fontWeight: '600' },
  runtimeHint: { color: theme.muted, fontSize: 12, lineHeight: 19, marginBottom: 18 },
  subtitle: { color: theme.muted, fontSize: 12, lineHeight: 20, marginTop: 9, marginBottom: 22 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#EAEDE5', borderRadius: 18, padding: 18, marginBottom: 18 },
  summaryIcon: { width: 45, height: 45, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFFA0', borderRadius: 14 },
  summaryCopy: { flex: 1 },
  summaryTitle: { color: theme.dark, fontSize: 18, fontWeight: '800', marginBottom: 5 },
  summaryHint: { color: '#7A8376', fontSize: 11, lineHeight: 18 },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginBottom: 22 },
  bulkToolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginBottom: 18 },
  selectionBar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 18 },
  selectionCount: { color: theme.ink, fontSize: 13, fontWeight: '700', minWidth: 64 },
  checkbox: { width: 43, height: 43, borderRadius: 8, borderWidth: 2, borderColor: theme.line, alignItems: 'center', justifyContent: 'center' },
  checkedBox: { backgroundColor: theme.accent, borderColor: theme.accent },
  checkmark: { color: '#FFFFFF', fontSize: 24, fontWeight: '700' },
  selectRow: { borderTopWidth: 1, borderTopColor: theme.line, minHeight: 46, justifyContent: 'center', alignItems: 'center' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, height: 48, backgroundColor: theme.paper, borderRadius: 13, borderWidth: 1, borderColor: theme.line, marginBottom: 16 },
  searchInput: { flex: 1, minWidth: 0, height: '100%', color: theme.ink, fontSize: 13 },
  filters: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 18 },
  filter: { minHeight: 40, paddingHorizontal: 15, paddingVertical: 11, borderRadius: 20 },
  activeFilter: { backgroundColor: theme.dark },
  filterText: { color: theme.muted, fontSize: 12, fontWeight: '600' },
  activeFilterText: { color: '#FFFFFF' },
  resultCount: { marginLeft: 'auto', fontSize: 11, color: theme.muted },
  source: { backgroundColor: theme.paper, borderRadius: 18, paddingHorizontal: 17, paddingTop: 17, marginBottom: 14, borderWidth: 1, borderColor: theme.line },
  disabledSource: { backgroundColor: '#FBFAF7' },
  sourceHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sourceBadge: { width: 43, height: 43, backgroundColor: theme.accentSoft, alignItems: 'center', justifyContent: 'center', borderRadius: 13 },
  sourceInfo: { flex: 1, minWidth: 0 },
  sourceName: { color: theme.ink, fontSize: 16, lineHeight: 23, fontWeight: '700' },
  sourceId: { color: theme.muted, fontSize: 10, marginTop: 3 },
  description: { color: '#7F857D', fontSize: 12, lineHeight: 19, marginTop: 13 },
  metadata: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginVertical: 15 },
  kind: { color: theme.accent, fontSize: 10, backgroundColor: theme.accentSoft, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, overflow: 'hidden' },
  metaText: { color: theme.muted, fontSize: 11 },
  status: { marginLeft: 'auto', color: '#4B785A', fontSize: 10 },
  inactiveStatus: { color: theme.muted },
  sourceActions: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F0EEE8' },
  rowButton: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center' },
  rowButtonText: { color: '#586252', fontSize: 12, fontWeight: '600' },
  deleteText: { color: '#B57365', fontSize: 12, fontWeight: '600' },
  actionDivider: { width: 1, height: 12, backgroundColor: theme.line },
  empty: { paddingVertical: 60, alignItems: 'center' },
  emptyTitle: { color: theme.ink, fontSize: 18, fontWeight: '700', marginBottom: 10 },
  emptyHint: { color: theme.muted, fontSize: 12, lineHeight: 20, textAlign: 'center' },
  loading: { padding: 50 },
  backdrop: { flex: 1, backgroundColor: '#202A2766', paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center' },
  dialog: { width: '100%', maxWidth: 420, backgroundColor: theme.background, borderRadius: 22, padding: 24 },
  dialogText: { color: '#737C72', fontSize: 13, lineHeight: 23, marginBottom: 24 },
  dialogActions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
});
