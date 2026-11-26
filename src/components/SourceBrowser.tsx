import { useAppTheme } from '../state/appearance';
import { useThemedStyles, type AppTheme } from './theme';
import { useRef, useState, useSyncExternalStore } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import WebView, { WebViewProps } from 'react-native-webview';
import { allowedBrowserUrl, browserPageReady, snapshotScript } from '../sources/browser-policy';
import { BrowserTask, currentBrowserTask, latestBrowserRequest, subscribeBrowser } from '../sources/browser-session';
import { BackgroundSourceBrowser } from './BackgroundSourceBrowser';

export function SourceBrowser() {
  const task = useSyncExternalStore(subscribeBrowser, currentBrowserTask, () => null);
  const washai = useSyncExternalStore(subscribeBrowser, () => latestBrowserRequest('washai'), () => null);
  return <>
    {washai ? <BackgroundSourceBrowser session={washai} task={task?.request.source === 'washai' ? task : null} /> : null}
    {task && task.request.source !== 'washai' ? <BrowserWindow key={task.id} task={task} /> : null}
  </>;
}

function BrowserWindow({ task }: { task: BrowserTask }) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const [error, setError] = useState('');
  const browser = useRef<WebView<WebViewProps>>(null);
  const insets = useSafeAreaInsets();
  const capture = `(() => { clearInterval(window.__novalCapture); const capture=() => { try { const page=${snapshotScript(task.request.selector)}; window.ReactNativeWebView.postMessage(JSON.stringify({...page,taskId:${task.id}})); }catch{} }; capture(); window.__novalCapture=setInterval(capture,900); window.addEventListener('pagehide',()=>clearInterval(window.__novalCapture),{once:true}); })();true;`;
  return <Modal visible animationType="slide" supportedOrientations={['portrait', 'landscape-left', 'landscape-right']} onRequestClose={() => task.fail(new Error('已取消网页验证。'))}>
    <View style={[styles.page, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}><Text style={styles.title}>{task.request.name} · {task.request.purpose}</Text><Pressable accessibilityRole="button" onPress={() => task.fail(new Error('已取消网页验证。'))} style={styles.button}><Text style={{ color: theme.ink }}>取消</Text></Pressable></View>
      <Text style={styles.hint}>正在加载书源网页。如出现验证，请在下方完成，成功后自动继续。</Text>
      {error ? <View style={styles.errorRow}><Text accessibilityRole="alert" style={[styles.hint, styles.error]}>{error}</Text><Pressable style={styles.button} accessibilityRole="button" onPress={() => { setError(''); browser.current?.reload(); }}><Text style={{ color: theme.ink }}>重新加载</Text></Pressable></View> : null}
      <WebView<WebViewProps> ref={browser} source={{ uri: task.request.url }} sharedCookiesEnabled thirdPartyCookiesEnabled={false} incognito={false} domStorageEnabled javaScriptEnabled
        setSupportMultipleWindows={false} javaScriptCanOpenWindowsAutomatically={false} mixedContentMode="never"
        onShouldStartLoadWithRequest={event => {
          if (event.isTopFrame === false) {
            try { if (new URL(event.url).origin === 'https://challenges.cloudflare.com') return true; } catch { return false; }
          }
          return allowedBrowserUrl(task.request.source, event.url);
        }}
        onLoadEnd={() => browser.current?.injectJavaScript(capture)}
        injectedJavaScript={capture} onMessage={event => {
          try { const page = JSON.parse(event.nativeEvent.data); if (page.taskId === task.id && typeof page.html === 'string' && typeof page.url === 'string' && browserPageReady(String(page.title), page.found === true, String(page.text))) task.finish(page); } catch { /* Ignore non-snapshot page messages. */ }
        }} onError={event => setError(event.nativeEvent.description)} onHttpError={event => {
          if (event.nativeEvent.statusCode !== 403 && event.nativeEvent.statusCode !== 503) setError(`网页返回 HTTP ${event.nativeEvent.statusCode}，可重新加载。`);
        }} />
    </View>
  </Modal>;
}
const createStyles = (theme: AppTheme) => StyleSheet.create({ page: { flex: 1, backgroundColor: theme.background }, header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 }, title: { flex: 1, fontSize: 16, fontWeight: '700', color: theme.ink }, button: { minHeight: 44, padding: 12, justifyContent: 'center' }, hint: { padding: 12, color: theme.muted, fontSize: 12, lineHeight: 18 }, errorRow: { flexDirection: 'row', alignItems: 'center' }, error: { flex: 1, color: theme.danger } });
