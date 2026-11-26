import { useAppTheme } from '../../state/appearance';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Page } from '../../components/Page';
import { SourceButton, SourceMessage, useSourceStyles } from '../../components/SourceControls';
import { useThemedStyles, type AppTheme } from '../../components/theme';
import { RuleManagedSource } from '../../domain/books';
import { pickSourceFile } from '../../sources/files';
import { definitionId, isRuleSource, ruleSourceId, sourceTypeName } from '../../sources/legado';
import { parseSourceImport } from '../../sources/management';
import { downloadSourceJson, XIU2_SOURCE_URL } from '../../sources/network';
import { useLibrary } from '../../state/library';

type Mode = 'network' | 'local';

export default function SourceImportScreen() {
  const styles = useThemedStyles(createStyles);
  const s = useSourceStyles();
  const { theme } = useAppTheme();
  const { importSources, sourceDefinitions, ready, storageError } = useLibrary();
  const [mode, setMode] = useState<Mode>('network');
  const [url, setUrl] = useState('');
  const [input, setInput] = useState('');
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<RuleManagedSource[] | null>(null);
  const [replace, setReplace] = useState(false);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => { request.current?.abort(); request.current = null; }, []);
  const locked = busy || downloading;

  const change = (text: string) => { setInput(text); setPreview(null); setError(''); setMessage(''); };
  const changeMode = (next: Mode) => { setMode(next); change(''); setFileName(''); };
  const selectFile = async () => {
    setError(''); setBusy(true);
    try {
      const file = await pickSourceFile();
      if (file) { change(file.text); setFileName(file.name); setPreview(parseSourceImport(file.text)); }
    } catch (cause) { setPreview(null); setError(cause instanceof Error ? cause.message : '文件读取失败。'); }
    finally { setBusy(false); }
  };
  const download = async () => {
    const controller = new AbortController();
    request.current = controller;
    setDownloading(true); change('');
    try {
      const result = await downloadSourceJson(url, controller.signal);
      if (request.current !== controller) return;
      setInput(result.text); setPreview(result.sources);
    } catch (cause) {
      if (request.current === controller) setError(cause instanceof Error ? cause.message : '下载失败。');
    } finally {
      if (request.current === controller) { request.current = null; setDownloading(false); }
    }
  };
  const validate = () => {
    try { setPreview(parseSourceImport(input)); setError(''); }
    catch (cause) { setPreview(null); setError(cause instanceof Error ? cause.message : '书源格式无效。'); }
  };
  const importNow = async () => {
    setBusy(true); setError('');
    try {
      const result = await importSources(input, replace);
      setMessage(`导入完成：新增 ${result.added} 个，更新 ${result.updated} 个，跳过 ${result.skipped} 个。`);
      setPreview(null); setInput(''); setFileName('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : '导入失败。'); }
    finally { setBusy(false); }
  };
  const existingIds = new Set(sourceDefinitions.filter(isRuleSource).map(definitionId));
  const conflicts = preview?.filter(item => existingIds.has(definitionId(item))).length ?? 0;

  return (
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Page title="导入书源" eyebrow="把新的故事，放进口袋">
        <View style={styles.modeTabs} accessibilityRole="tablist">
          <Pressable style={[styles.modeTab, mode === 'network' && styles.activeModeTab]} onPress={() => changeMode('network')} disabled={locked} accessibilityRole="tab" accessibilityState={{ selected: mode === 'network' }}><Text style={[styles.modeText, mode === 'network' && styles.activeModeText]}>网络导入</Text></Pressable>
          <Pressable style={[styles.modeTab, mode === 'local' && styles.activeModeTab]} onPress={() => changeMode('local')} disabled={locked} accessibilityRole="tab" accessibilityState={{ selected: mode === 'local' }}><Text style={[styles.modeText, mode === 'local' && styles.activeModeText]}>本地 JSON 导入</Text></Pressable>
        </View>
        {mode === 'network' ? <>
          <Text style={s.label}>书源 JSON 地址</Text>
          <TextInput placeholderTextColor={theme.muted} style={s.input} value={url} onChangeText={text => { setUrl(text); change(''); }} editable={!locked} autoCapitalize="none" autoCorrect={false} placeholder="https://…/shuyuan.json" accessibilityLabel="网络书源地址" />
          <Text style={styles.fieldHint}>填写直接返回书源 JSON 的链接。链接不一定以 .json 结尾。</Text>
          {downloading ? <SourceButton secondary onPress={() => request.current?.abort()} style={styles.fullAction}>取消下载</SourceButton> : <Pressable onPress={() => { setUrl(XIU2_SOURCE_URL); change(''); }} disabled={busy} style={styles.linkButton} accessibilityRole="button"><Text style={styles.linkText}>填入 XIU2 地址  →</Text></Pressable>}
          <SourceButton onPress={download} disabled={locked || !ready || !url.trim()} style={styles.fullAction}>{downloading ? '下载中…' : '下载并预览  ⌄'}</SourceButton>
        </> : <>
          <SourceButton secondary onPress={selectFile} disabled={locked || !ready} style={styles.uploadAction}>⇧  选择 JSON 文件</SourceButton>
          {fileName ? <Text style={s.helper}>已选择：{fileName}</Text> : null}
          <Text style={s.label}>也可粘贴书源 JSON</Text>
          <TextInput placeholderTextColor={theme.muted} style={[s.input, s.editor]} value={input} onChangeText={text => { change(text); setFileName(''); }} editable={!locked} multiline autoCapitalize="none" autoCorrect={false} textAlignVertical="top" placeholder={'[{"bookSourceName":"…","bookSourceUrl":"…","ruleSearch":{…}}]'} accessibilityLabel="导入书源 JSON" />
          {!preview && <SourceButton onPress={validate} disabled={locked || !ready || !input.trim()} style={styles.fullAction}>校验并预览</SourceButton>}
        </>}
        {!preview && !message ? <View style={styles.hintCard}><Text style={styles.hintText}>支持「阅读 / Legado」格式的单个书源对象或数组。导入前会显示预览，已有书源默认保留。XIU2 分享页为 yuedu.xiu2.xyz，实际 JSON 地址是 yuedu.xiu2.xyz/shuyuan。</Text></View> : null}
        {storageError ? <SourceMessage error>{storageError}</SourceMessage> : null}
        {error ? <SourceMessage error>{error}</SourceMessage> : null}
        {message ? <><SourceMessage>{message}</SourceMessage><View style={s.actions}><SourceButton onPress={() => router.dismissTo('/sources')}>返回书源列表</SourceButton></View></> : null}
        {preview && <View style={styles.previewSection}>
          <View style={styles.previewHeading}><Text style={s.sectionTitle}>待导入 · {preview.length} 个书源</Text>{conflicts > 0 ? <Text style={styles.conflictPill}>{conflicts} 个重复</Text> : null}</View>
          {preview.slice(0, 30).map(({ document, enabled }) => (
            <View key={ruleSourceId(document)} style={s.card}>
              <Text style={s.label}>{document.bookSourceName}</Text>
              <Text style={styles.meta}>{document.bookSourceUrl}</Text>
              <Text style={styles.meta}>{sourceTypeName(document)} · {document.bookSourceGroup || '未分组'} · {enabled ? '启用' : '停用'}</Text>
              {existingIds.has(ruleSourceId(document)) && <Text style={styles.conflict}>书源地址已存在，将{replace ? '覆盖现有规则与启用状态' : '跳过此书源'}</Text>}
            </View>
          ))}
          {preview.length > 30 && <Text style={s.helper}>另有 {preview.length - 30} 个书源，确认后将一并导入。</Text>}
          {conflicts > 0 && <View style={s.switchRow}>
            <View style={s.switchCopy}><Text style={s.switchLabel}>覆盖 {conflicts} 个重复书源</Text><Text style={s.switchHint}>按 bookSourceUrl 匹配。默认跳过；覆盖会替换规则与启用状态。</Text></View>
            <Switch value={replace} onValueChange={setReplace} disabled={locked} accessibilityLabel="覆盖重复书源" thumbColor={theme.paper} trackColor={{ true: theme.dark }} />
          </View>}
          <Text style={s.helper}>导入会保存完整原始配置。当前在线解析与脚本运行尚未接入，导入成功不代表网站已可搜索或阅读。</Text>
          <SourceButton onPress={importNow} disabled={locked || !ready} style={styles.fullAction}>{busy ? '导入中…' : '确认导入'}</SourceButton>
        </View>}
      </Page>
    </KeyboardAvoidingView>
  );
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  fill: { flex: 1 },
  modeTabs: { flexDirection: 'row', gap: 4, backgroundColor: theme.secondary, borderRadius: 12, padding: 4, marginBottom: 26 },
  modeTab: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 9 },
  activeModeTab: { backgroundColor: theme.paper },
  modeText: { color: theme.muted, fontSize: 13 },
  activeModeText: { color: theme.dark, fontWeight: '700' },
  fieldHint: { color: theme.muted, fontSize: 11, lineHeight: 19, marginTop: -12, marginBottom: 8 },
  linkButton: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', marginBottom: 6 },
  linkText: { color: theme.dark, fontSize: 13, fontWeight: '600' },
  fullAction: { width: '100%' },
  uploadAction: { minHeight: 92, borderStyle: 'dashed', marginBottom: 22 },
  hintCard: { backgroundColor: theme.secondary, borderRadius: 14, padding: 16, marginTop: 19 },
  hintText: { color: theme.muted, fontSize: 12, lineHeight: 21 },
  previewSection: { borderTopWidth: 1, borderTopColor: theme.line, marginTop: 22, paddingTop: 20 },
  previewHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  conflictPill: { color: theme.muted, backgroundColor: theme.secondary, fontSize: 11, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6, overflow: 'hidden' },
  meta: { color: theme.muted, fontSize: 12, lineHeight: 19 },
  conflict: { color: theme.accent, fontSize: 12, marginTop: 8 },
});
