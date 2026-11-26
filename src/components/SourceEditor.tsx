import { useAppTheme } from '../state/appearance';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { RuleManagedSource, RuleSourceDocument } from '../domain/books';
import { parseRuleSource, readSourceJson, ruleSourceExample, ruleSourceId } from '../sources/legado';
import { useLibrary } from '../state/library';
import { Page } from './Page';
import { SourceButton, SourceMessage, useSourceStyles } from './SourceControls';
import { useThemedStyles, type AppTheme } from './theme';

function extraFields(document: RuleSourceDocument) {
  const fields: Record<string, unknown> = { ...document };
  for (const key of ['bookSourceName', 'bookSourceUrl', 'bookSourceGroup', 'bookSourceComment', 'enabled']) delete fields[key];
  return JSON.stringify(fields, null, 2);
}

export function SourceEditor({ entry }: { entry?: RuleManagedSource }) {
  const styles = useThemedStyles(createStyles);
  const s = useSourceStyles();
  const { theme } = useAppTheme();
  const { saveSource } = useLibrary();
  const [name, setName] = useState(entry?.document.bookSourceName ?? '');
  const [url, setUrl] = useState(entry?.document.bookSourceUrl ?? '');
  const [group, setGroup] = useState(entry?.document.bookSourceGroup ?? '');
  const [description, setDescription] = useState(entry?.document.bookSourceComment ?? '');
  const [enabled, setEnabled] = useState(entry?.enabled ?? true);
  const [content, setContent] = useState(extraFields(entry?.document ?? { ...ruleSourceExample, searchUrl: '', ruleSearch: {}, ruleBookInfo: {}, ruleToc: {}, ruleContent: {} }));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setError(''); setBusy(true);
    try {
      const raw = readSourceJson(content);
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new Error('规则配置需要是 JSON 对象。');
      const document = parseRuleSource({
        ...raw, bookSourceName: name, bookSourceUrl: url,
        ...((group || entry?.document.bookSourceGroup !== undefined) ? { bookSourceGroup: group } : {}),
        ...((description || entry?.document.bookSourceComment !== undefined) ? { bookSourceComment: description } : {}),
        enabled,
      });
      await saveSource(document, enabled, entry ? ruleSourceId(entry.document) : undefined);
      router.dismissTo('/sources');
    } catch (cause) { setError(cause instanceof Error ? cause.message : '保存失败，请重试。'); }
    finally { setBusy(false); }
  };
  const loadExample = () => {
    setName(ruleSourceExample.bookSourceName); setUrl(ruleSourceExample.bookSourceUrl);
    setGroup(ruleSourceExample.bookSourceGroup ?? ''); setDescription(ruleSourceExample.bookSourceComment ?? '');
    setContent(extraFields(ruleSourceExample)); setError('');
  };

  return (
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Page title={entry ? '编辑书源' : '新增书源'} eyebrow="书源配置 / 阅读与 Legado 格式">
        <Text style={s.label}>书源名称</Text>
        <TextInput placeholderTextColor={theme.muted} style={s.input} value={name} onChangeText={setName} editable={!busy} placeholder="为书源起个名字" accessibilityLabel="书源名称" />
        <Text style={s.label}>书源地址</Text>
        <TextInput placeholderTextColor={theme.muted} style={s.input} value={url} onChangeText={setUrl} editable={!busy} placeholder="https://www.example.com" autoCapitalize="none" autoCorrect={false} accessibilityLabel="书源地址" />
        <Text style={[s.helper, styles.urlHint]}>通常填写网站首页，用于识别重复书源。</Text>
        <Text style={s.label}>分组（可选）</Text>
        <TextInput placeholderTextColor={theme.muted} style={s.input} value={group} onChangeText={setGroup} editable={!busy} placeholder="例如：正版、玄幻" accessibilityLabel="书源分组" />
        <Text style={s.label}>说明（可选）</Text>
        <TextInput placeholderTextColor={theme.muted} style={[s.input, styles.description]} value={description} onChangeText={setDescription} editable={!busy} multiline placeholder="书源使用说明" accessibilityLabel="书源说明" />
        <View style={[s.switchRow, styles.enabledRow]}>
          <View style={s.switchCopy}><Text style={s.switchLabel}>启用书源</Text><Text style={s.switchHint}>启用后参与搜索，导出时保留启用状态。</Text></View>
          <Switch value={enabled} onValueChange={setEnabled} disabled={busy} accessibilityLabel="启用书源" thumbColor={theme.paper} trackColor={{ true: theme.dark }} />
        </View>
        <View style={styles.contentHeading}><Text style={s.sectionTitle}>规则与其他配置</Text>{!entry && <SourceButton secondary onPress={loadExample} disabled={busy}>填入示例</SourceButton>}</View>
        <Text style={s.helper}>JSON 中保留搜索、详情、目录、正文规则和其他原始字段。名称、地址、分组、说明及启用状态由上方表单保存。</Text>
        <TextInput placeholderTextColor={theme.muted} style={[s.input, s.editor]} value={content} onChangeText={setContent} editable={!busy} multiline autoCapitalize="none" autoCorrect={false} textAlignVertical="top" accessibilityLabel="书源规则 JSON" />
        <Text style={s.helper}>支持「阅读 / Legado」格式。规则字段包括 searchUrl、ruleSearch、ruleBookInfo、ruleToc、ruleContent；在线解析及脚本运行仍在接入中。</Text>
        {error ? <SourceMessage error>{error}</SourceMessage> : null}
        <View style={s.actions}>
          <SourceButton secondary onPress={() => router.dismissTo('/sources')} disabled={busy}>取消</SourceButton>
          <SourceButton onPress={save} disabled={busy}>{busy ? '保存中…' : '保存书源'}</SourceButton>
        </View>
      </Page>
    </KeyboardAvoidingView>
  );
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  fill: { flex: 1 },
  urlHint: { marginTop: -12, marginBottom: 20 },
  description: { minHeight: 80, textAlignVertical: 'top' },
  enabledRow: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: theme.line, marginTop: 3, marginBottom: 22, paddingVertical: 17 },
  contentHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
});
