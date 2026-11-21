/* global __dirname */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
function harness(recognize,iosModel=null){
  const slots=[],effects=[],routes=[],cancelled=[];let cursor=0;
  let photo={photoId:'photo-a',uri:'file:///a.jpg'},serial=0,focusEffect,blur;
  const state=initial=>{const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],n=>{slots[i]=typeof n==='function'?n(slots[i]):n;}];};
  const memo=(fn,deps)=>{const i=cursor++;if(!slots[i]||deps.some((v,j)=>v!==slots[i].deps[j]))slots[i]={fn,deps};return slots[i].fn;};
  const effect=(fn,deps)=>{const i=cursor++;if(!slots[i]||deps.some((v,j)=>v!==slots[i][j])){slots[i]=deps;effects.push(fn);}};
  const jsx=(type,props,key)=>({type,props,key}),exports={};
  const modules={
    'react/jsx-runtime':{jsx,jsxs:jsx},react:{useState:state,useRef:v=>state({current:v})[0],useCallback:memo,useEffect:effect},
    'expo-router':{Stack:{},router:{push:r=>routes.push(r)},useFocusEffect:fn=>effect(()=>{
      focusEffect=fn;
      blur=fn();
    },[fn])},
    'react-native':{ScrollView:'ScrollView',Image:'Image',AppState:{currentState:'active',addEventListener:()=>({remove(){}})},StyleSheet:{create:x=>x}},
    'react-native-safe-area-context':{useSafeAreaInsets:()=>({bottom:0})},'../../ui/Text':{Text:'Text'},'../../ui/Action':{Action:'Action'},'../../ui/theme':{color:{},layout:{},textStyles:{}},
    './nativePhotoInput':{photoInput:{getPhoto:()=>photo,recoverPhoto:async()=>({kind:'selected',photo}),selectPhoto:async()=>({kind:'selected',photo:photo={photoId:'photo-b',uri:'file:///b.jpg'}})}},
    '../recognition/nativeRecognition':{recognition:{createRequest:id=>({requestId:`r${++serial}`,photoId:id,contentVersion:'1'}),cancelRecognition:id=>cancelled.push(id),recognize}},
    '../recognition/deviceRuntime':{iosModel},
    '../place-content/content':{content:{getBuilding:id=>({
      status:'ok',data:{id,name:{geunjeongjeon:'근정전',gyotaejeon:'교태전'}[id],overview:'소개'},
    })}},
  };
  const file=path.join(__dirname,'../photo-input/PhotoInputScreen.tsx');
  const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  vm.runInNewContext(code,{exports,require:name=>{assert.ok(name in modules,name);return modules[name];}});
  const nodes=x=>Array.isArray(x)?x.flatMap(nodes):!x||typeof x!=='object'?[]:[x,...nodes(x.props?.children)];
  const render=()=>{cursor=0;return nodes(exports.default());};
  const flush=async()=>{for(const fn of effects.splice(0))fn();await new Promise(resolve=>setImmediate(resolve));};
  const press=label=>render().find(n=>n.type==='Action'&&n.props.label===label).props.onPress();
  return {render,flush,press,routes,cancelled,blur:()=>blur(),refocus:()=>{blur=focusEffect();}};
}
const analyzed=(input,buildingScores)=>({...input,status:'analyzed',analysis:{buildingScores}});
test('a selected photo analyzes automatically, shows the leading suggestion and retains it on back',async()=>{
  const seen=[];
  const h=harness(async input=>{
    seen.push(input.photoId);
    return analyzed(input,[{label:'gyotaejeon',probability:.2},{label:'geunjeongjeon',probability:.8}]);
  });
  h.render();await h.flush();
  assert.deepEqual(seen,['photo-a']);
  assert.equal(h.routes.length,0);
  assert.ok(h.render().some(n=>n.type==='Action'&&n.props.label==='근정전 이야기 보기'));
  assert.equal(h.render().some(n=>n.type==='Action'&&n.props.label==='교태전'),false);
  h.press('다른 후보 보기');h.press('교태전');
  assert.equal(h.routes[0].params.origin,'manual-topic');assert.equal(h.routes[0].params.placeId,'gyotaejeon');
  h.blur();
  h.refocus();
  assert.ok(h.render().some(n=>n.type==='Action'&&n.props.label==='근정전 이야기 보기'));
  h.press('갤러리에서 선택');await h.flush();
  assert.deepEqual(seen,['photo-a','photo-b']);
  assert.equal(h.render().some(n=>n.type==='Action'&&n.props.label==='교태전'),false);
});
test('late results for a replaced photo never replace the latest suggestion',async()=>{
  const release=[];
  const h=harness(input=>new Promise(resolve=>release.push(label=>resolve(analyzed(input,[{label,probability:1}])))));
  h.render();await h.flush();h.press('갤러리에서 선택');await h.flush();
  release[1]('gyotaejeon'); release[0]('geunjeongjeon');await h.flush();
  assert.equal(h.routes.length,0);
  const labels=h.render().filter(n=>n.type==='Action').map(n=>n.props.label);
  assert.ok(labels.includes('교태전 이야기 보기'));assert.equal(labels.includes('근정전 이야기 보기'),false);
  assert.equal(h.cancelled.length,1);
});
test('the iPhone build can open model import before choosing a photo',async()=>{
  const h=harness(async input=>({...input,status:'error',code:'MODEL_NOT_READY'}),{});
  h.render();await h.flush();
  h.press('사진 인식 모델 설정');
  assert.deepEqual(h.routes,['/development-check']);
});
