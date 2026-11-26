import { useAppTheme } from '../state/appearance';
import { useThemedStyles, type AppTheme } from './theme';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { BrowserTask, currentBrowserTask, subscribeBrowser } from '../sources/browser-session';
import type { BrowserSource } from '../sources/browser-policy';

const sessions = new Map<BrowserSource,string>();
export function SourceBrowser() {
  const task = useSyncExternalStore(subscribeBrowser,currentBrowserTask,() => null);
  return task ? <BrowserWindow key={task.id} task={task} /> : null;
}
function BrowserButton({label,onPress}:{label:string;onPress():void}) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  return <Pressable accessibilityRole="button" style={styles.button} onPress={onPress}><Text style={{ color: theme.ink }}>{label}</Text></Pressable>;
}
function BrowserWindow({task}:{task:BrowserTask}) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const [screenshot,setScreenshot] = useState('');
  const [error,setError] = useState('');
  const [text,setText] = useState('');
  const [width,setWidth] = useState(390);
  const [interactive,setInteractive] = useState(task.request.source !== 'washai');
  const busy = useRef(false);
  const perform = async (action: string, extra: Record<string,unknown> = {}) => {
    if (!task || busy.current) return;
    busy.current = true;
    try {
      const response = await fetch('/api/source-browser',{ method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,id:sessions.get(task.request.source),...extra}) });
      const result = await response.json();
      if (currentBrowserTask()?.id !== task.id) return;
      if (!response.ok) { if (response.status === 410) sessions.delete(task.request.source); throw new Error(result.error || '网页加载失败。'); }
      sessions.set(task.request.source,result.id);
      setError('');
      if (result.ready) task.finish({url:result.url,html:result.html});
      else if (result.screenshot) { setScreenshot(`data:image/jpeg;base64,${result.screenshot}`); setInteractive(true); }
    } catch (cause) {
      if (currentBrowserTask()?.id === task.id) {
        const message = cause instanceof Error ? cause.message : '网页连接失败。';
        if (task.request.source === 'washai') task.fail(new Error(message));
        else setError(message);
      }
    }
    finally { busy.current = false; }
  };
  useEffect(() => {
    if (!task) return;
    void Promise.resolve().then(() => perform('start',{request:task.request}));
    const timer = setInterval(() => { if (sessions.has(task.request.source)) void perform('snapshot'); },1500);
    return () => { clearInterval(timer); };
    // Each task owns a navigation; action callbacks use the same task until completion.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[task?.id]);
  if (!interactive) return null;
  return <Modal visible transparent onRequestClose={() => task.fail(new Error('已取消网页验证。'))}>
    <View style={styles.backdrop}><ScrollView style={styles.panel} contentContainerStyle={styles.panelContent}>
      <View style={styles.row}><Text style={styles.title}>{task.request.name} · {task.request.purpose}</Text><BrowserButton label="取消" onPress={() => task.fail(new Error('已取消网页验证。'))}/></View>
      <Text style={styles.hint}>点击下方网页中的输入框，再输入验证码并提交。验证通过后自动继续。网页会话临时保存在开发服务中。</Text>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <View style={styles.image} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
        {screenshot ? <Pressable accessibilityRole="button" accessibilityLabel="验证网页，点击输入框或提交按钮" onPress={event => { void perform('click',{x:event.nativeEvent.locationX / width * 390,y:event.nativeEvent.locationY / width * 390}); }}><Image source={{uri:screenshot}} style={{width:'100%',aspectRatio:390/650}} /></Pressable> : <Text style={styles.hint}>正在加载网页…</Text>}
      </View>
      <View style={styles.row}><TextInput placeholderTextColor={theme.muted} accessibilityLabel="网页输入内容" value={text} onChangeText={setText} placeholder="点击网页输入框后，在这里输入" style={styles.input}/><BrowserButton label="输入" onPress={() => { void perform('type',{text}); setText(''); }}/></View>
      <View style={styles.row}><BrowserButton label="提交 ↵" onPress={() => { void perform('key',{key:'Enter'}); }}/><BrowserButton label="删除" onPress={() => { void perform('key',{key:'Backspace'}); }}/><BrowserButton label="上滚" onPress={() => { void perform('scroll',{direction:-1}); }}/><BrowserButton label="下滚" onPress={() => { void perform('scroll',{direction:1}); }}/><BrowserButton label="重试" onPress={() => { void perform('start',{request:task.request}); }}/></View>
    </ScrollView></View>
  </Modal>;
}
const createStyles = (theme: AppTheme) => StyleSheet.create({backdrop:{flex:1,backgroundColor:'#0008',alignItems:'center',justifyContent:'center',padding:12},panel:{backgroundColor:theme.background,borderRadius:16,width:'100%',maxWidth:430,maxHeight:'100%'},panelContent:{padding:12},title:{flex:1,fontWeight:'700',color:theme.ink},row:{flexDirection:'row',alignItems:'center',gap:6,flexWrap:'wrap'},button:{minHeight:44,padding:10,justifyContent:'center',backgroundColor:theme.secondary,borderRadius:8},hint:{fontSize:12,lineHeight:18,paddingVertical:8,color:theme.muted},error:{color:theme.danger,fontSize:12},image:{width:'100%',maxWidth:390,alignSelf:'center',backgroundColor:'white'},input:{flex:1,minHeight:44,minWidth:140,borderWidth:1,borderColor:theme.line,borderRadius:8,padding:8,color:theme.ink}});
