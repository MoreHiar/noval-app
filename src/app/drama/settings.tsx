import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useThemedStyles, type AppTheme } from '../../components/theme';
import { readDramaIdentity, saveDramaIdentity } from '../../dramas/deviceIdentity';

export default function DramaSettingsScreen() {
  const styles = useThemedStyles(createStyles);
  const [deviceId, setDeviceId] = useState('');
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(Platform.OS !== 'web');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let mounted = true;
    readDramaIdentity().then(value => {
      if (mounted) { setDeviceId(value.deviceId); setUserId(value.userId); }
    }).catch(() => { if (mounted) setError('本机设备信息读取失败'); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const save = async (clear = false) => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const value = await saveDramaIdentity(clear ? { deviceId: '', userId: '' } : { deviceId, userId });
      setDeviceId(value.deviceId);
      setUserId(value.userId);
      setMessage(clear ? '已删除本机设备信息' : '已保存在本机');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存失败');
    } finally { setSaving(false); }
  };

  return <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Text style={styles.title}>设备信息</Text>
    <Text style={styles.explanation}>信息仅保存在这台设备。当前短剧仍播放公开预览，填写以下编号不会启用完整剧集。</Text>
    {Platform.OS === 'web' ? <Text style={styles.error}>请在 Android 或 iOS 应用中填写。</Text> : loading ? <ActivityIndicator style={styles.loader} /> : <>
      <View style={styles.field}>
        <Text style={styles.label}>deviceId</Text>
        <TextInput style={styles.input} value={deviceId} onChangeText={value => { setDeviceId(value); setMessage(''); }} keyboardType="number-pad" maxLength={30} autoCorrect={false} autoCapitalize="none" placeholder="设备编号" placeholderTextColor={styles.placeholder.color} accessibilityLabel="deviceId" />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>userId</Text>
        <TextInput style={styles.input} value={userId} onChangeText={value => { setUserId(value); setMessage(''); }} keyboardType="number-pad" maxLength={30} autoCorrect={false} autoCapitalize="none" placeholder="用户编号" placeholderTextColor={styles.placeholder.color} accessibilityLabel="userId" />
      </View>
      <Pressable style={[styles.save, saving && styles.disabled]} onPress={() => void save()} disabled={saving} accessibilityRole="button"><Text style={styles.saveText}>保存到本机</Text></Pressable>
      {(deviceId || userId) ? <Pressable style={styles.clear} onPress={() => void save(true)} disabled={saving} accessibilityRole="button"><Text style={styles.clearText}>删除本机信息</Text></Pressable> : null}
      {message ? <Text accessibilityRole="alert" style={styles.success}>{message}</Text> : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <Text style={styles.note}>完整播放还需要设备注册产生的 iid、cdid、会话信息，以及播放签名和媒体处理。请不要通过聊天发送设备编号或登录凭据。</Text>
    </>}
  </ScrollView>;
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.background },
  content: { padding: 20, paddingBottom: 50, maxWidth: 600, width: '100%', alignSelf: 'center' },
  title: { color: theme.ink, fontSize: 22, fontWeight: '700' },
  explanation: { color: theme.muted, fontSize: 13, lineHeight: 21, marginTop: 10, marginBottom: 28 },
  field: { marginBottom: 20 },
  label: { color: theme.ink, fontSize: 13, fontWeight: '700', marginBottom: 9 },
  input: { minHeight: 50, borderWidth: 1, borderColor: theme.line, borderRadius: 6, backgroundColor: theme.paper, color: theme.ink, fontSize: 15, paddingHorizontal: 14 },
  placeholder: { color: theme.muted },
  save: { height: 50, borderRadius: 6, backgroundColor: theme.dark, alignItems: 'center', justifyContent: 'center', marginTop: 5 },
  saveText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  clear: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  clearText: { color: theme.danger, fontSize: 13, fontWeight: '600' },
  disabled: { opacity: 0.5 },
  loader: { marginVertical: 40 },
  note: { color: theme.muted, fontSize: 12, lineHeight: 20, marginTop: 28 },
  success: { color: theme.dark, fontSize: 12, marginTop: 12 },
  error: { color: theme.danger, fontSize: 12, marginTop: 12 },
});
