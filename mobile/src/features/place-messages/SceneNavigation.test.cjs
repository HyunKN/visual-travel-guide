/* global __dirname */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');

function harness({moving=false,saveFails=false,phase='open',saveWait,renderScene=false}={}){
  const effects=[],dispatches=[],writes=[],errors=[],anchors=[];let prevention,closed=0,index=0;
  const draft={id:'draft',sceneId:'scene',body:'이동 중',u:.2,v:.3,revision:4};
  const controller={snapshot:()=>({reader:null,list:{kind:'idle'}}),subscribe(){},close:()=>{closed++;}};
  const presentation={snapshot:()=>({phase,reader:{kind:'loading',id:'note'},anchor:{u:.2,v:.3}}),subscribe(){}};
  const jsx=(type,props)=>({type,props}),exports={};
  const modules={
    'react/jsx-runtime':{jsx,jsxs:jsx},
    react:{useCallback:f=>f,useEffect:f=>effects.push(f),useMemo:f=>f(),useRef:v=>({current:v}),useSyncExternalStore:(_s,get)=>get(),
      useState:initial=>{const i=index++,v=i===3&&moving?{u:.8,v:.9}:i===5&&moving?draft:renderScene&&i===2?true:renderScene&&i===6?{width:300,height:500}:renderScene&&i===17?true:typeof initial==='function'?initial():initial;return [v,next=>{if(i===10)errors.push(next);if(i===3)anchors.push(next);}];}},
    'react-native':{View:'View',StyleSheet:{create:x=>x}},'expo-router':{Stack:{},useFocusEffect(){},useNavigation:()=>({dispatch:a=>dispatches.push(a)})},
    'expo-router/react-navigation':{usePreventRemove:(enabled,callback)=>{prevention={enabled,callback};}},
    '../../navigation/home':{isHomeAction:a=>a.type==='RESET'&&a.nubiIntent==='home'},
    'react-native-safe-area-context':{useSafeAreaInsets:()=>({bottom:0})},
    '../place-content/photos':{photos:{}},'./scenes':{getScene:()=>renderScene?{name:'장소',imageWidth:2000,imageHeight:1000,photo:{file:'photo',credit:'출처',license:'허용'}}:null},
    './geometry':{originalView:()=>({zoom:1,x:0,y:0}),imageRect:()=>({x:0,y:0,width:300,height:500}),zoomedRect:r=>r,project:a=>({x:a.u*300,y:a.v*500}),unproject:p=>({u:p.x/300,v:p.y/500}),layoutMarkers:()=>[]},
    './usePhotoGestures':{usePhotoGestures:()=>({})},'./reader':{createMessageReader:()=>controller},
    '../local-notes/device':{accountNotes:()=>({messages:{},saveDraft:async d=>{if(saveWait)await saveWait;if(saveFails)throw new Error('disk');writes.push(d);}})},
    '../public-messages/nativeService':{productSceneMessages:()=>({})},'./presentation':{createReaderPresentation:()=>presentation},
    './useReaderMotion':{useReaderMotion:()=>({})},'../../ui/theme':{color:{},layout:{},textStyles:{}},
  };
  for(const name of ['../../ui/Text','../../ui/PhotoGlass','../../ui/PhotoReading','../local-notes/Editor','../../ui/Skeleton','react-native-reanimated','../../ui/Action','../public-messages/publication','../public-messages/feedback','./SketchTraceMarker'])modules[name]={};
  const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'SceneScreen.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  vm.runInNewContext(code,{exports,require:name=>{assert.ok(name in modules,name);return modules[name];}});
  const tree=exports.default({sceneId:'scene'});
  // Register the actual close handler; native/event effects are intentionally not run.
  for(const effect of effects)if(effect.toString().includes('closeReader.current = close'))effect();
  const nodes=x=>Array.isArray(x)?x.flatMap(nodes):!x||typeof x!=='object'?[]:[x,...nodes(x.props?.children)];
  return {dispatches,writes,errors,anchors,nodes:nodes(tree),get closed(){return closed;},get enabled(){return prevention.enabled;},remove:a=>prevention.callback({data:{action:a}}),flush:()=>new Promise(resolve=>setImmediate(resolve))};
}

test('Home leaves an open reader in one action, while ordinary Back only closes the reader',()=>{
  const h=harness(),action={type:'RESET',nubiIntent:'home'};
  assert.equal(h.enabled,true);h.remove(action);
  assert.equal(h.dispatches[0],action);assert.equal(h.closed,0);
  h.remove({type:'GO_BACK'});assert.equal(h.closed,1);assert.equal(h.dispatches.length,1);
});

test('Home preserves a changed photo point before leaving the positioning screen',async()=>{
  const h=harness({moving:true,phase:'hidden'}),action={type:'RESET',nubiIntent:'home'};
  assert.equal(h.enabled,true);h.remove(action);assert.equal(h.dispatches.length,0);await h.flush();
  assert.equal(h.writes[0].u,.8);assert.equal(h.writes[0].v,.9);assert.equal(h.writes[0].revision,5);
  assert.equal(h.dispatches[0],action);
});

test('a positioning draft storage failure keeps the current scene and offers retry',async()=>{
  const h=harness({moving:true,phase:'hidden',saveFails:true});h.remove({type:'RESET',nubiIntent:'home'});await h.flush();
  assert.equal(h.dispatches.length,0);assert.equal(h.writes.length,0);assert.match(h.errors.at(-1),/초안을 저장하지 못했어요/);
});

test('a photo tap cannot replace the selected point while Home is waiting for storage',async()=>{
  let release;const saveWait=new Promise(resolve=>{release=resolve;});
  const h=harness({moving:true,phase:'hidden',renderScene:true,saveWait});
  const point=h.nodes.find(n=>n.props?.accessibilityLabel==='사진에서 위치 선택');
  assert.ok(point);h.remove({type:'RESET',nubiIntent:'home'});
  point.props.onPress({nativeEvent:{locationX:30,locationY:40}});
  assert.equal(h.anchors.length,0);assert.equal(h.dispatches.length,0);
  release();await h.flush();
  assert.equal(h.writes[0].u,.8);assert.equal(h.writes[0].v,.9);assert.equal(h.dispatches.length,1);
});
