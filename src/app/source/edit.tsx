import { router, useLocalSearchParams } from 'expo-router';
import { Text } from 'react-native';
import { Page } from '../../components/Page';
import { SourceButton, SourceMessage } from '../../components/SourceControls';
import { SourceEditor } from '../../components/SourceEditor';
import { definitionId, isRuleSource } from '../../sources/legado';
import { isFanqieSourceId } from '../../sources/fanqie';
import { useLibrary } from '../../state/library';

export default function SourceEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { ready, storageError, retryLoad, sourceDefinitions } = useLibrary();
  if (!ready) return <Page title="书源管理">{storageError ? <><SourceMessage error>{storageError}</SourceMessage><SourceButton onPress={retryLoad}>重试</SourceButton></> : <Text>正在加载书源…</Text>}</Page>;
  const entry = sourceDefinitions.filter(isRuleSource).find(item => definitionId(item) === id);
  if (id && !entry) return <Page title="书源不存在"><SourceButton onPress={() => router.dismissTo('/sources')}>返回书源列表</SourceButton></Page>;
  if (id && isFanqieSourceId(id)) return <Page title="内置书源"><Text>番茄书源不可编辑，可在书源列表中禁用。</Text><SourceButton onPress={() => router.dismissTo('/sources')}>返回书源列表</SourceButton></Page>;
  return <SourceEditor key={id ?? 'new'} entry={entry} />;
}
