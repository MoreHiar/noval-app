const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const {test}=require('node:test');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const {allowedBrowserUrl,browserPageReady,browserPagePresentation}=require('../src/sources/browser-policy.ts');
const {loadBrowserPage,currentBrowserTask,latestBrowserRequest}=require('../src/sources/browser-session.ts');
const request={source:'biquting',name:'笔趣庭',url:'https://m.biquting.org/search.html',selector:'.tit',purpose:'搜索'};
test('browser scope blocks local, third-party and unsafe URLs and verification never becomes a result',()=>{
  for(const url of ['http://m.biquting.org','https://m.biquting.org.evil.test','https://127.0.0.1','https://user:secret@m.biquting.org','https://m.biquting.org:1234','javascript:alert(1)'])assert.equal(allowedBrowserUrl('biquting',url),false);
  assert.equal(allowedBrowserUrl('linovelib','https://www.bilinovel.net/search.html'),true);
  assert.equal(allowedBrowserUrl('washai','https://book.washai.net/book/bookclass.html?k=test'),true);
  assert.equal(allowedBrowserUrl('washai','https://book.washai.net.evil.test/book/bookclass.html'),false);
  assert.equal(allowedBrowserUrl('washai','https://evil.test'),false);
  assert.equal(browserPageReady('验证码',true,'暂无搜索结果'),false);
  assert.equal(browserPageReady('Just a moment...',true,''),false);
  assert.equal(browserPageReady('搜索',false,'暂无搜索结果'),true);
});
test('browser queue serializes manual tasks, propagates abort, and validates snapshot origin',async()=>{
  const controller=new AbortController();
  const one=loadBrowserPage(request,controller.signal),two=loadBrowserPage(request);
  const first=currentBrowserTask().id;controller.abort();
  await assert.rejects(one,{name:'AbortError'});assert.notEqual(currentBrowserTask().id,first);
  currentBrowserTask().finish({url:'https://evil.test',html:'<p>bad</p>'});await assert.rejects(two,/地址/);
  assert.equal(currentBrowserTask(),null);
  const valid=loadBrowserPage(request);currentBrowserTask().finish({url:request.url,html:'<div class="tit">书</div>'});assert.equal((await valid).url,request.url);
  const cancel=loadBrowserPage(request);currentBrowserTask().fail(new Error('用户取消'));await assert.rejects(cancel,/取消/);
  assert.equal(currentBrowserTask(),null);
});

test('automatic checks stay in the background and a completed check never opens verification',()=>{
  const page={url:'https://book.washai.net/book/bookclass.html?k=test',html:'',title:'Just a moment...',found:false,text:'Checking your browser',manual:false,challenge:true};
  assert.equal(browserPagePresentation(page,0),'background');
  assert.equal(browserPagePresentation(page,10000),'background');
  assert.equal(browserPagePresentation({...page,title:'搜索',found:true,challenge:false},24000),'ready');
  assert.equal(browserPagePresentation({...page,manual:true},5000),'background');
  assert.equal(browserPagePresentation({...page,manual:true},6000),'interactive');
  assert.equal(browserPagePresentation(page,25000),'interactive');
  assert.equal(browserPagePresentation({...page,title:'正在加载',challenge:false},60000),'background');
});

test('washai session metadata survives idle gaps and queued chapters do not replace the active document',async()=>{
  const oneRequest={source:'washai',name:'书海阁',url:'https://book.washai.net/book/123/1.html',selector:'#readPageBootstrap',purpose:'加载章节'};
  const twoRequest={...oneRequest,url:'https://book.washai.net/book/123/2.html'};
  const first=loadBrowserPage(oneRequest);
  const firstSession=latestBrowserRequest('washai');
  const second=loadBrowserPage(twoRequest);
  assert.equal(latestBrowserRequest('washai'),firstSession);
  currentBrowserTask().finish({url:oneRequest.url,html:'第一章'});
  await first;
  assert.equal(latestBrowserRequest('washai').request.url,twoRequest.url);
  const secondSession=latestBrowserRequest('washai');
  currentBrowserTask().finish({url:twoRequest.url,html:'第二章'});
  await second;
  assert.equal(currentBrowserTask(),null);
  assert.equal(latestBrowserRequest('washai'),secondSession);
  assert.deepEqual(Object.keys(secondSession).sort(),['id','request']);
});
test('browser API rejects cross-site calls, expired tokens and disallowed source domains before launching',async()=>{
  const {handleSourceBrowser}=require('../src/server/source-browser.ts');
  const invoke=(body,headers={})=>handleSourceBrowser(new Request('http://localhost/api/source-browser',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)}));
  assert.equal((await invoke({action:'start',request},{origin:'https://evil.test'})).status,403);
  assert.equal((await invoke({action:'snapshot',id:'unknown'})).status,410);
  const response=await invoke({action:'start',request:{...request,url:'https://127.0.0.1'}});assert.equal(response.status,502);assert.match((await response.json()).error,/公网/);
});

test('browser API retains its isolated session through manual input and returns a ready DOM',async t=>{
  const {chromium}=require('playwright'),dns=require('node:dns/promises');
  t.mock.method(dns,'lookup',async()=>[{address:'8.8.8.8',family:4}]);
  let currentUrl='',ready=false,closed=false;
  const actions=[];
  const page={on(){},mainFrame:()=>({}),goto:async url=>{currentUrl=url;},url:()=>currentUrl,
    evaluate:async()=>({title:ready?'搜索':'验证码',found:ready,text:'',url:currentUrl,html:ready?'<div class="tit">书</div>':'<input name="code">'}),
    screenshot:async()=>Buffer.from('image'),mouse:{click:async(x,y)=>actions.push(['click',x,y]),wheel:async()=>{}},keyboard:{insertText:async text=>actions.push(['type',text]),press:async key=>{actions.push(['key',key]);ready=true;}}};
  const context={newPage:async()=>page,route:async()=>{},close:async()=>{closed=true;}};
  t.mock.method(chromium,'launch',async()=>({newContext:async()=>context}));
  const {handleSourceBrowser}=require('../src/server/source-browser.ts');
  const invoke=body=>handleSourceBrowser(new Request('http://localhost/api/source-browser',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}));
  let result=await(await invoke({action:'start',request})).json();assert.equal(result.ready,false);const id=result.id;
  assert.equal((await invoke({action:'click',id,x:-1,y:0})).status,502);
  await invoke({action:'click',id,x:20,y:30});await invoke({action:'type',id,text:'user-entered'});
  result=await(await invoke({action:'key',id,key:'Enter'})).json();assert.equal(result.ready,true);assert.match(result.html,/书/);
  assert.deepEqual(actions,[['click',20,30],['type','user-entered'],['key','Enter']]);
  await invoke({action:'close',id});assert.equal(closed,true);assert.equal((await invoke({action:'snapshot',id})).status,410);
});

test('washai web browser reuses its context without screenshots or dialogs during automatic checks',async t=>{
  const {chromium}=require('playwright'),dns=require('node:dns/promises');
  t.mock.method(dns,'lookup',async()=>[{address:'8.8.8.8',family:4}]);
  let clock=100000,currentUrl='',ready=false,manual=false,contexts=0,screenshots=0;
  t.mock.method(Date,'now',()=>clock);
  const page={on(){},mainFrame:()=>({}),goto:async url=>{currentUrl=url;},url:()=>currentUrl,
    evaluate:async()=>({title:ready?'搜索':'Just a moment...',found:ready,text:'',url:currentUrl,html:ready?'<div id="bookList">书</div>':'检查中',manual,challenge:!ready}),
    screenshot:async()=>{screenshots++;return Buffer.from('image');}};
  const context={newPage:async()=>page,route:async()=>{},close:async()=>{}};
  const {handleSourceBrowser}=require('../src/server/source-browser.ts');
  globalThis.novalSourceBrowser.browser=undefined;
  t.mock.method(chromium,'launch',async()=>({newContext:async()=>{contexts++;return context;}}));
  const invoke=async body=>(await handleSourceBrowser(new Request('http://localhost/api/source-browser',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}))).json();
  const request={source:'washai',name:'书海阁',url:'https://book.washai.net/book/bookclass.html?k=test',selector:'#bookList',purpose:'搜索'};
  let result=await invoke({action:'start',request});const id=result.id;
  assert.equal(result.needsInteraction,false);assert.equal(screenshots,0);
  clock+=10000;result=await invoke({action:'snapshot',id});
  assert.equal(result.needsInteraction,false);assert.equal(screenshots,0);
  manual=true;result=await invoke({action:'snapshot',id});
  assert.equal(result.needsInteraction,true);assert.equal(screenshots,1);
  ready=true;manual=false;result=await invoke({action:'snapshot',id});assert.equal(result.ready,true);
  result=await invoke({action:'start',id,request:{...request,url:request.url.replace('k=test','k=next')}});
  assert.equal(result.ready,true);assert.equal(contexts,1);assert.equal(screenshots,1);
  await invoke({action:'close',id});
});
