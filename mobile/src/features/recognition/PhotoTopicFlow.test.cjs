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
    '../recognition/TopicSelection':{TopicSelection:'TopicSelection'},
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
test('even legacy identified results require an explicit user place choice; a new photo resets topic selection',async()=>{
  const h=harness(async input=>({...input,status:'identified',selectedTargetId:'geunjeongjeon'}));h.render();await h.flush();
  h.press('장소 찾기');await h.flush();assert.equal(h.routes.length,0);
  const topics=h.render().find(n=>n.type==='TopicSelection');assert.ok(topics);assert.match(topics.key,/photo-a/);
  topics.props.onPlace('gyotaejeon');assert.equal(h.routes[0].params.origin,'manual-topic');assert.equal(h.routes[0].params.placeId,'gyotaejeon');
  h.blur();
  h.refocus();
  const restored=h.render().find(n=>n.type==='TopicSelection');
  assert.equal(restored.key,topics.key);
  assert.equal(restored.props.result,topics.props.result);
  h.press('갤러리에서 선택');await h.flush();assert.equal(h.render().some(n=>n.type==='TopicSelection'),false);
  topics.props.onPlace('geunjeongjeon');assert.equal(h.routes.length,1);
  h.press('주제 직접 선택');const next=h.render().find(n=>n.type==='TopicSelection');assert.match(next.key,/photo-b/);assert.equal(next.props.result,null);
});
test('late results for a replaced photo never show old topics or trigger navigation',async()=>{
  let release;const h=harness(input=>new Promise(resolve=>{release=()=>resolve({...input,status:'analyzed',analysis:{}});}));
  h.render();await h.flush();h.press('장소 찾기');h.press('갤러리에서 선택');await h.flush();release();await h.flush();
  assert.equal(h.routes.length,0);assert.equal(h.render().some(n=>n.type==='TopicSelection'),false);assert.equal(h.cancelled.length,1);
});
test('the iPhone build can open model import before choosing a photo',async()=>{
  const h=harness(async()=>{throw new Error('Unexpected recognition');},{});
  h.render();await h.flush();
  h.press('사진 인식 모델 설정');
  assert.deepEqual(h.routes,['/development-check']);
});
