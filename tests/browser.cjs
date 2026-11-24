const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const {test}=require('node:test');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const {allowedBrowserUrl,browserPageReady}=require('../src/sources/browser-policy.ts');
const {loadBrowserPage,currentBrowserTask}=require('../src/sources/browser-session.ts');
const request={source:'biquting',name:'笔趣庭',url:'https://m.biquting.org/search.html',selector:'.tit',purpose:'搜索'};
test('browser scope blocks local, third-party and unsafe URLs and verification never becomes a result',()=>{
  for(const url of ['http://m.biquting.org','https://m.biquting.org.evil.test','https://127.0.0.1','https://user:secret@m.biquting.org','https://m.biquting.org:1234','javascript:alert(1)'])assert.equal(allowedBrowserUrl('biquting',url),false);
  assert.equal(allowedBrowserUrl('linovelib','https://www.bilinovel.net/search.html'),true);
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
