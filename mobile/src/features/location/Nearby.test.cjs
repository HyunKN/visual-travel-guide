// Exercises the screen's real AppState listener, including pre-refresh controller objects.
/* global __dirname */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');

function screen(modern,{development=true,hasMap=false,initialState={kind:'locating'}}={}){
  const slots=[],effects=[],pushes=[];let cursor=0,listener,focus,state=initialState,suspends=0;
  const controller={snapshot:()=>state,subscribe:()=>()=>{},refreshAge:()=>{},clear:()=>{state={kind:'idle'};}};
  if(modern)controller.suspend=()=>{suspends++;};
  const jsx=(type,props)=>({type,props}),exports={};
  const slot=initial=>{const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],value=>{slots[i]=value;}];};
  const modules={
    'react/jsx-runtime':{jsx,jsxs:jsx},
    react:{useState:slot,useRef:value=>slot({current:value})[0],useMemo:fn=>fn(),useEffect:fn=>effects.push(fn),useCallback:fn=>fn,useSyncExternalStore:(_,snapshot)=>snapshot()},
    'react-native':{View:'View',ScrollView:'ScrollView',StyleSheet:{create:x=>x},Platform:{OS:'android'},TurboModuleRegistry:{get:()=>hasMap?{}:null},AppState:{currentState:'active',addEventListener:(_,fn)=>{listener=fn;return {remove:()=>{}};}}},
    'react-native-safe-area-context':{useSafeAreaInsets:()=>({bottom:0})},
    'expo-router':{router:{push:route=>pushes.push(route)},Stack:{Screen:'Screen'},useFocusEffect:fn=>{focus=fn;}},
    '../ui/Text':{Text:'Text'},'../ui/theme':{color:{}},
    '../features/local-notes/Editor':{Action:'Action',s:{}},
    '../features/location/location':{nearbyPlaces:()=>[{placeId:'geunjeongjeon',distanceMeters:null}],locationDetails:()=>null},
    '../features/location/controller':{createLocationController:()=>controller},
    '../features/location/nativeLocation':{nativeLocation:{}},
    '../features/place-content/content':{content:{getBuilding:id=>({status:'ok',data:{id,name:'근정전'}})}},
    '../features/location/PalaceMap':{__esModule:true,default:'Map'},
    '../features/location/mapContract':{mapCredits:[],createMapLoad:callback=>require('../../../../.codex-build/app-message-tests/location/mapContract.js').createMapLoad(callback,()=>()=>{})},
  };
  const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../../app/nearby.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  vm.runInNewContext(code,{exports,__DEV__:development,console:{warn:()=>{}},require:name=>{assert.ok(name in modules,`unexpected import ${name}`);return modules[name];}});
  const render=()=>{cursor=0;return exports.default();};
  const text=tree=>{if(typeof tree==='string')return [tree];if(!tree||typeof tree!=='object')return [];const children=tree.props?.children;return (Array.isArray(children)?children:[children]).flatMap(text);};
  render();focus();
  const nodes=tree=>Array.isArray(tree)?tree.flatMap(nodes):!tree||typeof tree!=='object'?[]:[tree,...nodes(tree.props?.children)];
  const action=(tree,label)=>{const found=nodes(tree).find(n=>n.type==='Action'&&n.props.label===label);assert.ok(found,`missing action ${label}`);return found.props;};
  return {background:()=>listener('background'),render,text,state:()=>state,suspends:()=>suspends,action,nodes,pushes,
    load:async()=>{render();effects.splice(0).forEach(fn=>fn());await Promise.resolve();await Promise.resolve();return render();}};
}

test('AppState background never calls a missing suspend on a controller retained by Fast Refresh',()=>{
  const h=screen(false);
  assert.doesNotThrow(()=>h.background());
  assert.equal(h.state().kind,'idle');
  assert.ok(h.text(h.render()).includes('위치 확인이 중단됐어요. 다시 시도해주세요.'));
});

test('AppState uses current controller suspension without falsely cancelling a permission dialog',()=>{
  const h=screen(true);h.background();
  assert.equal(h.suspends(),1);assert.equal(h.state().kind,'locating');
  assert.equal(h.text(h.render()).filter(t=>t==='위치 확인이 중단됐어요. 다시 시도해주세요.').length,0);
});

test('development failure uses the real map failure callback, preserves direct place navigation, and retry restores the map',async()=>{
  const h=screen(true,{hasMap:true,initialState:{kind:'idle'}});
  let tree=await h.load();
  h.nodes(tree).find(n=>n.type==='Map').props.onReady();
  h.action(tree,'개발 메뉴').onPress();tree=h.render();
  assert.equal(h.action(tree,'지도 로딩 실패 재현').disabled,false);
  h.action(tree,'지도 로딩 실패 재현').onPress();tree=h.render();
  assert.equal(h.nodes(tree).some(n=>n.type==='Map'),false);
  assert.ok(h.text(tree).some(t=>t.includes('데이터 또는 Wi-Fi 연결을 확인해주세요.')));
  assert.ok(h.text(tree).includes('개발 테스트 · 지도 로딩 실패'));
  h.action(tree,'근정전').onPress();
  assert.equal(h.pushes[0].params.placeId,'geunjeongjeon');
  h.action(tree,'지도 다시 시도').onPress();tree=await h.load();
  assert.ok(h.nodes(tree).some(n=>n.type==='Map'));
  assert.equal(h.text(tree).includes('개발 테스트 · 지도 로딩 실패'),false);
});

test('production has no failure injection menu; a real unavailable map still permits direct selection with imprecise location',async()=>{
  const h=screen(true,{development:false,initialState:{kind:'imprecise'}});
  const tree=await h.load();
  assert.equal(h.nodes(tree).some(n=>n.props?.label==='개발 메뉴'),false);
  assert.ok(h.text(tree).includes('위치가 정확하지 않아요.'));
  h.action(tree,'근정전').onPress();assert.equal(h.pushes[0].params.placeId,'geunjeongjeon');
});
