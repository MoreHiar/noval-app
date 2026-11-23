import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Page } from '../../components/Page';
import { theme } from '../../components/theme';
import { exampleJson } from '../../sources/builtin';
import { useLibrary } from '../../state/library';

const kindName = { builtin: '内置', json: 'JSON', javascript: 'JavaScript' };

export default function SourcesScreen() {
  const { sources, addJsonSource } = useLibrary();
  const [input, setInput] = useState('');
  const [message, setMessage] = useState('');

  const add = () => {
    try {
      addJsonSource(input);
      setInput('');
      setMessage('书源已添加，可以在发现页搜索。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '导入失败');
    }
  };

  return (
    <Page title="书源管理" eyebrow="SOURCE LIBRARY">
      <Text style={styles.sectionTitle}>已启用 · {sources.length}</Text>
      {sources.map((source) => (
        <View key={source.info.id} style={styles.source}>
          <View style={styles.badge}><Text style={styles.badgeText}>{source.info.name.slice(0, 1)}</Text></View>
          <View style={styles.sourceInfo}><Text style={styles.sourceName}>{source.info.name}</Text><Text style={styles.sourceDescription}>{source.info.description}</Text></View>
          <Text style={styles.kind}>{kindName[source.info.kind]}</Text>
        </View>
      ))}
      <Text style={[styles.sectionTitle, styles.importTitle]}>导入 JSON 书源</Text>
      <Text style={styles.helper}>第一阶段支持包含书籍与章节内容的静态 JSON。可先加载示例，修改后导入。</Text>
      <TextInput style={styles.editor} value={input} onChangeText={setInput} multiline placeholder="粘贴书源 JSON" placeholderTextColor="#A4AAA3" textAlignVertical="top" autoCapitalize="none" accessibilityLabel="书源 JSON 内容" />
      {message ? <Text style={styles.message}>{message}</Text> : null}
      <View style={styles.actions}>
        <Pressable onPress={() => { setInput(exampleJson); setMessage(''); }} style={styles.secondary}><Text style={styles.secondaryText}>加载示例</Text></Pressable>
        <Pressable onPress={add} style={styles.primary}><Text style={styles.primaryText}>导入书源</Text></Pressable>
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { color: theme.ink, fontSize: 18, fontWeight: '800', marginBottom: 14 },
  source: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.paper, padding: 14, borderRadius: 15, marginBottom: 9, gap: 12 },
  badge: { width: 42, height: 42, borderRadius: 12, backgroundColor: theme.accentSoft, justifyContent: 'center', alignItems: 'center' },
  badgeText: { color: theme.accent, fontSize: 18, fontWeight: '700' },
  sourceInfo: { flex: 1 },
  sourceName: { color: theme.ink, fontSize: 15, fontWeight: '700', marginBottom: 4 },
  sourceDescription: { color: theme.muted, fontSize: 11, lineHeight: 16 },
  kind: { color: theme.accent, fontSize: 11, fontWeight: '700' },
  importTitle: { marginTop: 28 },
  helper: { color: theme.muted, fontSize: 12, lineHeight: 19, marginBottom: 12 },
  editor: { minHeight: 160, maxHeight: 280, backgroundColor: theme.paper, borderRadius: 14, padding: 14, color: theme.ink, fontSize: 12, lineHeight: 18, borderWidth: 1, borderColor: theme.line },
  message: { color: theme.accent, fontSize: 12, marginTop: 10 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  primary: { backgroundColor: theme.accent, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 18 },
  primaryText: { color: 'white', fontWeight: '700' },
  secondary: { backgroundColor: theme.paper, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 18, borderWidth: 1, borderColor: theme.line },
  secondaryText: { color: theme.ink, fontWeight: '700' },
});
