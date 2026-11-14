/* global __dirname */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const contract=require('../../../../.codex-build/app-message-tests/place-messages/contract.js');
const {editorAction}=require('../../../../.codex-build/app-message-tests/public-messages/editorAction.js');
const {recoveryOptions}=require('../../../../.codex-build/app-message-tests/public-messages/recovery.js');
function harness({saved=true,body='원문',originalFails=false,saveFails=false,saveWait}={}){
  const slots=[],effects=[],writes=[],closes=[],alerts=[],dispatches=[];let cursor=0,prevention;
  const initial={id:'note',sceneId:'scene',u:.2,v:.7,body,visibility:saved?'public':null,revision:1};
  const publication=saved?{state:'published',serverVersion:1,payload:{p_withdraw:false}}:null;
  const slot=initial=>{const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],next=>{slots[i]=typeof next==='function'?next(slots[i]):next;}];};
  const store={getPublication:async()=>publication,getSavedNote:async()=>{if(originalFails)throw new Error('disk');return saved?initial:null;},
    saveDraft:async d=>{if(saveWait)await saveWait;if(saveFails)throw new Error('disk');writes.push({...d});},cancelEdit:async id=>writes.push({cancel:id})};
  const jsx=(type,props)=>({type,props}),exports={};
  const modules={
    'react/jsx-runtime':{jsx,jsxs:jsx},
    react:{useState:slot,useRef:v=>slot({current:v})[0],useEffect:(fn,deps)=>{const i=cursor++;if(!slots[i]||deps.some((d,j)=>d!==slots[i][j])){slots[i]=deps;effects.push(fn);}}},
    'react-native':{Alert:{alert:(...args)=>alerts.push(args)},AppState:{addEventListener:()=>({remove(){}})},BackHandler:{addEventListener:()=>({remove(){}})},KeyboardAvoidingView:'KeyboardAvoidingView',Platform:{OS:'android'},ScrollView:'ScrollView',TextInput:'TextInput',View:'View',StyleSheet:{create:x=>x}},
    'expo-router/react-navigation':{usePreventRemove:(_enabled,callback)=>{prevention=callback;}},'expo-router':{useNavigation:()=>({dispatch:action=>dispatches.push(action)})},
    '../../navigation/home':{isHomeAction:action=>action.type==='RESET'&&action.nubiIntent==='home'},
    '../../ui/PhotoReading':{PhotoReadingText:'Text',PhotoReadingAction:'Action',photoReadingSurface:'#fff'},
    '../place-messages/contract':contract,'./device':{accountNotes:()=>store},
    '../public-messages/nativeService':{publicServiceConfigured:true,getPublicService:()=>({savePrivate:async d=>{writes.push({private:d});return null;}})},
    '../public-messages/recovery':{recoveryOptions},'../public-messages/editorAction':{editorAction},
    '../../ui/theme':{color:{},layout:{},textStyles:{}},'../public-messages/feedback':{},'../../ui/PhotoGlass':{},'../../ui/Action':{},
  };
  const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'Editor.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  vm.runInNewContext(code,{exports,requestAnimationFrame:fn=>fn(),require:name=>{assert.ok(name in modules,name);return modules[name];}});
  const nodes=x=>Array.isArray(x)?x.flatMap(nodes):!x||typeof x!=='object'?[]:[x,...nodes(x.props?.children)];
  const render=()=>{cursor=0;return nodes(exports.default({initial,onClose:v=>closes.push(v)}));};
  const flush=async()=>{for(const effect of effects.splice(0))effect();await new Promise(resolve=>setImmediate(resolve));};
  return {writes,closes,alerts,dispatches,render,flush,remove:action=>prevention({data:{action}}),action:(tree,label)=>tree.find(n=>n.type==='Action'&&n.props.label===label)};
}
test('editor blocks Unicode input/paste above 100 and exposes its actual n/100 counter',async()=>{
  const h=harness({saved:false,body:''});h.render();await h.flush();let tree=h.render();
  tree.find(n=>n.type==='TextInput').props.onChangeText('🙂'.repeat(101));tree=h.render();
  assert.equal(tree.find(n=>n.type==='TextInput').props.value,'🙂'.repeat(100));
  assert.ok(tree.some(n=>n.props?.accessibilityLabel==='100자 입력, 최대 100자'));
  assert.equal(h.writes.at(-1).body,'🙂'.repeat(100));
});
test('saved-note editing exposes cancel instead of draft deletion and returns to reading',async()=>{
  const h=harness();h.render();await h.flush();const tree=h.render();
  assert.equal(h.action(tree,'초안 버리기'),undefined);assert.equal(h.action(tree,'공개 철회'),undefined);
  h.action(tree,'수정 취소').props.onPress();await h.flush();
  assert.equal(h.writes.at(-1).cancel,'note');assert.equal(h.closes.at(-1),true);
});
test('private selection uses one confirmed private-save action rather than a separate withdrawal button',async()=>{
  const h=harness();h.render();await h.flush();let tree=h.render();
  h.action(tree,'나만 보기').props.onPress();tree=h.render();
  const save=h.action(tree,'나만 보기로 저장');assert.equal(save.props.disabled,false);save.props.onPress();
  h.alerts.at(-1)[2].find(button=>button.text==='저장').onPress();await h.flush();
  assert.equal(h.writes.at(-1).private.visibility,'private');assert.equal(h.closes.length,1);
});
test('legacy long text is not truncated on opening, can shrink, and remains unsavable until 100',async()=>{
  const h=harness({body:'한'.repeat(200)});h.render();await h.flush();let tree=h.render();
  assert.equal(tree.find(n=>n.type==='TextInput').props.value.length,200);assert.equal(h.writes.length,0);
  tree.find(n=>n.type==='TextInput').props.onChangeText('한'.repeat(199));tree=h.render();
  assert.equal(tree.find(n=>n.type==='TextInput').props.value.length,199);
  assert.equal(h.action(tree,'공개 글에 반영').props.disabled,true);
});
test('failure to load the original still permits a protected close without discarding changes',async()=>{
  const h=harness({originalFails:true});h.render();await h.flush();const tree=h.render();
  const close=h.action(tree,'닫기');assert.equal(close.props.disabled,false);
  close.props.onPress();await h.flush();
  assert.equal(h.writes.at(-1).body,'원문');assert.equal(h.closes.at(-1),false);
  assert.equal(h.writes.some(row=>row.cancel),false);
});

for(const saved of [false,true])test(`Home protects ${saved?'saved-note edits':'a new draft'} and replays the original root action`,async()=>{
  const h=harness({saved});h.render();await h.flush();let tree=h.render();
  tree.find(n=>n.type==='TextInput').props.onChangeText('홈으로 나가기 전 수정');tree=h.render();await h.flush();
  const action={type:'RESET',target:'root',nubiIntent:'home'};
  h.remove(action);await h.flush();
  assert.equal(h.writes.at(-1).body,'홈으로 나가기 전 수정');
  assert.equal(h.writes.some(row=>row.cancel),false);
  assert.equal(h.closes.at(-1),false);assert.equal(h.dispatches[0],action);
});

test('Home waits for draft persistence, ignores repeated taps, and never navigates on storage failure',async()=>{
  let release;const wait=new Promise(resolve=>{release=resolve;});
  const h=harness({saveFails:true,saveWait:wait});h.render();await h.flush();h.render();
  h.remove({type:'RESET',nubiIntent:'home'});h.remove({type:'RESET',nubiIntent:'home'});
  assert.equal(h.dispatches.length,0);assert.equal(h.closes.length,0);
  release();await h.flush();const tree=h.render();
  assert.equal(h.dispatches.length,0);assert.equal(h.closes.length,0);
  assert.equal(tree.find(n=>n.type==='TextInput').props.value,'원문');
  assert.ok(tree.some(n=>n.props?.children==='저장소에 변경을 반영하지 못했어요. 입력은 그대로 있어요.'));
});

test('ordinary Back during saved editing still cancels changes and returns to the original reader',async()=>{
  const h=harness();h.render();await h.flush();h.render();
  h.remove({type:'GO_BACK'});await h.flush();
  assert.equal(h.writes.at(-1).cancel,'note');assert.equal(h.closes.at(-1),true);
  assert.equal(h.dispatches.length,0);
});

test('Home dispatches once and only after delayed storage succeeds',async()=>{
  let release;const wait=new Promise(resolve=>{release=resolve;});
  const h=harness({saveWait:wait});h.render();await h.flush();h.render();
  const action={type:'RESET',nubiIntent:'home'};h.remove(action);h.remove({...action});
  assert.equal(h.dispatches.length,0);assert.equal(h.writes.length,0);
  release();await h.flush();
  assert.equal(h.writes.length,1);assert.equal(h.dispatches.length,1);assert.equal(h.dispatches[0],action);
});
