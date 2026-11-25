import { useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import WebView, { WebViewProps } from 'react-native-webview';
import { allowedBrowserUrl, browserPageMatches, browserPagePresentation, snapshotScript } from '../sources/browser-policy';
import { BrowserSessionRequest, BrowserTask, currentBrowserTask } from '../sources/browser-session';

// The same native WebView remains mounted while idle, loading, and visible.
// Moving it into a Modal would recreate the document and interrupt verification.
export function BackgroundSourceBrowser({ session, task }: { session: BrowserSessionRequest; task: BrowserTask | null }) {
  const browser = useRef<WebView<WebViewProps>>(null);
  const startedAt = useRef(0);
  const navigation = useRef<{ id: number; url: string } | null>(null);
  const [interactiveTask, setInteractiveTask] = useState<number | null>(null);
  const insets = useSafeAreaInsets();
  const active = task?.id === session.id;
  const visible = active && interactiveTask === session.id;
  const capture = useMemo(() => `(() => {
    clearInterval(window.__novalCapture);
    const capture = () => { try {
      const page = ${snapshotScript(session.request.selector)};
      window.ReactNativeWebView.postMessage(JSON.stringify({...page,taskId:${session.id}}));
    } catch {} };
    capture();
    window.__novalCapture = setInterval(capture,900);
    window.addEventListener('pagehide',()=>clearInterval(window.__novalCapture),{once:true});
  })();true;`, [session.id, session.request.selector]);

  useEffect(() => {
    if (!active) {
      browser.current?.injectJavaScript('clearInterval(window.__novalCapture);true;');
      return;
    }
    startedAt.current = Date.now();
    const previous = navigation.current;
    navigation.current = { id: session.id, url: session.request.url };
    if (previous?.url === session.request.url && previous.id !== session.id) browser.current?.reload();
    else browser.current?.injectJavaScript(capture);
  }, [active, capture, session.id, session.request.url]);

  useEffect(() => {
    if (!visible || !task) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      task.fail(new Error('已取消网页验证。'));
      return true;
    });
    return () => subscription.remove();
  }, [visible, task]);

  return <View testID={visible ? 'washai-verification-panel' : 'washai-background-session'} pointerEvents={visible ? 'auto' : 'none'} accessibilityElementsHidden={!visible} importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
    style={[styles.host, !visible && styles.hidden, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
    <View style={styles.header}><Text style={styles.title}>书海阁 · 网站验证</Text><Pressable style={styles.button} accessibilityRole="button" onPress={() => task?.fail(new Error('已取消网页验证。'))}><Text>取消</Text></Pressable></View>
    <Text style={styles.hint}>网站需要你完成下方验证，完成后会自动继续阅读。</Text>
    <WebView<WebViewProps> ref={browser} source={{ uri: session.request.url }} style={styles.browser} sharedCookiesEnabled thirdPartyCookiesEnabled={false} incognito={false} domStorageEnabled javaScriptEnabled
      setSupportMultipleWindows={false} javaScriptCanOpenWindowsAutomatically={false} mixedContentMode="never"
      onShouldStartLoadWithRequest={event => {
        if (event.isTopFrame === false) {
          try { if (new URL(event.url).origin === 'https://challenges.cloudflare.com') return true; } catch { return false; }
        }
        return allowedBrowserUrl('washai', event.url);
      }}
      injectedJavaScript={capture} onLoadEnd={() => {
        browser.current?.injectJavaScript(active ? capture : 'clearInterval(window.__novalCapture);true;');
      }}
      onMessage={event => {
        if (!active || !task || currentBrowserTask()?.id !== session.id) return;
        try {
          const page = JSON.parse(event.nativeEvent.data);
          if (page.taskId !== session.id || typeof page.html !== 'string' || typeof page.url !== 'string' || typeof page.title !== 'string' || typeof page.text !== 'string') return;
          // Messages from the previous document can arrive while navigation starts.
          if (!allowedBrowserUrl('washai', page.url) || !browserPageMatches(session.request, page.url)) return;
          const presentation = browserPagePresentation(page, Date.now() - startedAt.current);
          if (presentation === 'ready') task.finish({ url: page.url, html: page.html });
          else if (presentation === 'interactive') setInteractiveTask(session.id);
        } catch { /* Ignore unrelated website messages. */ }
      }}
      onError={event => {
        if (active && currentBrowserTask()?.id === session.id) task?.fail(new Error(`书海阁网页加载失败：${event.nativeEvent.description}`));
      }} onHttpError={event => {
        const { statusCode, url } = event.nativeEvent;
        if (active && currentBrowserTask()?.id === session.id && statusCode !== 403 && statusCode !== 503 && browserPageMatches(session.request, url)) task?.fail(new Error(`书海阁返回 HTTP ${statusCode}，请重试。`));
      }} />
  </View>;
}

const styles = StyleSheet.create({
  host: { ...StyleSheet.absoluteFill, zIndex: 1000, backgroundColor: '#F8F5EE' },
  hidden: { opacity: 0 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  title: { flex: 1, fontSize: 16, fontWeight: '700' },
  button: { minHeight: 44, padding: 12, justifyContent: 'center' },
  hint: { padding: 12, color: '#706455', fontSize: 12, lineHeight: 18 },
  browser: { flex: 1 },
});
