import { useState, useSyncExternalStore } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import WebView, { WebViewProps } from 'react-native-webview';
import { allowedBrowserUrl, browserPageReady, snapshotScript } from '../sources/browser-policy';
import { currentBrowserTask, subscribeBrowser } from '../sources/browser-session';

export function SourceBrowser() {
  const task = useSyncExternalStore(subscribeBrowser, currentBrowserTask, () => null);
  const [error, setError] = useState('');
  if (!task) return null;
  const capture = `(() => { const timer=setInterval(() => { try { const page=${snapshotScript(task.request.selector)}; window.ReactNativeWebView.postMessage(JSON.stringify(page)); }catch{} },900); window.addEventListener('pagehide',()=>clearInterval(timer)); })();true;`;
  return <Modal visible animationType="slide" onRequestClose={() => task.fail(new Error('已取消网页验证。'))}>
    <View style={styles.page}>
      <View style={styles.header}><Text style={styles.title}>{task.request.name} · {task.request.purpose}</Text><Pressable accessibilityRole="button" onPress={() => task.fail(new Error('已取消网页验证。'))} style={styles.button}><Text>取消</Text></Pressable></View>
      <Text style={styles.hint}>请在网页中完成验证码；验证成功后自动继续。会话保存在本机。</Text>
      {error ? <Text style={styles.hint}>{error}</Text> : null}
      <WebView<WebViewProps> key={task.id} source={{ uri: task.request.url }} sharedCookiesEnabled thirdPartyCookiesEnabled={false}
        setSupportMultipleWindows={false} javaScriptCanOpenWindowsAutomatically={false} mixedContentMode="never"
        onShouldStartLoadWithRequest={event => allowedBrowserUrl(task.request.source, event.url)}
        injectedJavaScript={capture} onMessage={event => {
          try { const page = JSON.parse(event.nativeEvent.data); if (typeof page.html === 'string' && typeof page.url === 'string' && browserPageReady(String(page.title), page.found === true, String(page.text))) task.finish(page); } catch { /* Ignore non-snapshot page messages. */ }
        }} onError={event => setError(event.nativeEvent.description)} />
    </View>
  </Modal>;
}
const styles = StyleSheet.create({ page: { flex: 1, paddingTop: 32, backgroundColor: '#F8F5EE' }, header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 }, title: { flex: 1, fontSize: 16, fontWeight: '700' }, button: { minHeight: 44, padding: 12, justifyContent: 'center' }, hint: { padding: 12, color: '#706455', fontSize: 12, lineHeight: 18 } });
