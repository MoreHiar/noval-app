import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Page } from '../../components/Page';
import { SourceButton, SourceMessage, sourceStyles as s } from '../../components/SourceControls';
import { theme } from '../../components/theme';
import { RuleManagedSource } from '../../domain/books';
import { pickSourceFile } from '../../sources/files';
import { definitionId, isRuleSource, ruleSourceId, sourceTypeName } from '../../sources/legado';
import { parseSourceImport } from '../../sources/management';
import { downloadSourceJson, XIU2_SOURCE_URL } from '../../sources/network';
import { useLibrary } from '../../state/library';

type Mode = 'network' | 'local';

export default function SourceImportScreen() {
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
      <Page title="导入书源" eyebrow="IMPORT SOURCES">
        <Text style={s.helper}>支持「阅读 / Legado」单个书源对象和书源数组。网络地址需直接返回书源 JSON。</Text>
        <View style={s.actions}>
          <SourceButton secondary={mode !== 'network'} onPress={() => changeMode('network')} disabled={locked}>网络导入</SourceButton>
          <SourceButton secondary={mode !== 'local'} onPress={() => changeMode('local')} disabled={locked}>本地 JSON 导入</SourceButton>
        </View>
        {mode === 'network' ? <>
          <Text style={s.label}>书源 JSON 地址</Text>
          <TextInput style={s.input} value={url} onChangeText={text => { setUrl(text); change(''); }} editable={!locked} autoCapitalize="none" autoCorrect={false} placeholder="https://…/shuyuan.json" accessibilityLabel="网络书源地址" />
          <Text style={s.helper}>XIU2 分享页是 yuedu.xiu2.xyz，实际 JSON 地址为 yuedu.xiu2.xyz/shuyuan。链接不一定以 .json 结尾。</Text>
          <View style={s.actions}>
            <SourceButton onPress={download} disabled={locked || !ready || !url.trim()}>{downloading ? '下载中…' : '下载并预览'}</SourceButton>
            {downloading ? <SourceButton secondary onPress={() => request.current?.abort()}>取消下载</SourceButton> : <SourceButton secondary onPress={() => { setUrl(XIU2_SOURCE_URL); change(''); }} disabled={busy}>填入 XIU2 地址</SourceButton>}
          </View>
        </> : <>
          <View style={s.actions}><SourceButton onPress={selectFile} disabled={locked || !ready}>选择 JSON 文件</SourceButton></View>
          {fileName ? <Text style={s.helper}>已选择：{fileName}</Text> : null}
          <Text style={s.label}>也可粘贴书源 JSON</Text>
          <TextInput style={[s.input, s.editor]} value={input} onChangeText={text => { change(text); setFileName(''); }} editable={!locked} multiline autoCapitalize="none" autoCorrect={false} textAlignVertical="top" placeholder={'[{"bookSourceName":"…","bookSourceUrl":"…","ruleSearch":{…}}]'} accessibilityLabel="导入书源 JSON" />
          {!preview && <SourceButton onPress={validate} disabled={locked || !ready || !input.trim()}>校验并预览</SourceButton>}
        </>}
        {storageError ? <SourceMessage error>{storageError}</SourceMessage> : null}
        {error ? <SourceMessage error>{error}</SourceMessage> : null}
        {message ? <><SourceMessage>{message}</SourceMessage><View style={s.actions}><SourceButton onPress={() => router.dismissTo('/sources')}>返回书源列表</SourceButton></View></> : null}
        {preview && <View>
          <Text style={s.sectionTitle}>待导入 · {preview.length} 个书源</Text>
          {preview.slice(0, 30).map(({ document, enabled }) => (
            <View key={ruleSourceId(document)} style={s.card}>
              <Text style={s.label}>{document.bookSourceName}</Text>
              <Text style={styles.meta}>{document.bookSourceUrl}</Text>
              <Text style={styles.meta}>{sourceTypeName(document)} · {document.bookSourceGroup || '未分组'} · {enabled ? '启用' : '停用'}</Text>
              {existingIds.has(ruleSourceId(document)) && <Text style={styles.conflict}>书源地址已存在，将{replace ? '覆盖现有书源' : '跳过此书源'}</Text>}
            </View>
          ))}
          {preview.length > 30 && <Text style={s.helper}>另有 {preview.length - 30} 个书源，确认后将一并导入。</Text>}
          {conflicts > 0 && <View style={s.switchRow}>
            <View style={s.switchCopy}><Text style={s.switchLabel}>覆盖 {conflicts} 个重复书源</Text><Text style={s.switchHint}>按 bookSourceUrl 匹配。默认跳过；覆盖会替换规则与启用状态。</Text></View>
            <Switch value={replace} onValueChange={setReplace} disabled={locked} accessibilityLabel="覆盖重复书源" thumbColor={theme.paper} trackColor={{ true: theme.accent }} />
          </View>}
          <Text style={s.helper}>导入会保存完整原始配置。当前在线解析与脚本运行尚未接入，导入成功不代表网站已可搜索或阅读。</Text>
          <SourceButton onPress={importNow} disabled={locked || !ready}>{busy ? '导入中…' : '确认导入'}</SourceButton>
        </View>}
      </Page>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  meta: { color: theme.muted, fontSize: 12, lineHeight: 19 },
  conflict: { color: theme.accent, fontSize: 12, marginTop: 8 },
});
