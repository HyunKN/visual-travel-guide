/* global __dirname */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const editorial=require('../../../../.codex-build/app-content-tests/editorial.js');

function harness(asset={width:2000,height:1151}){
  const pushes=[],slots=[],frames=[];let cursor=0;
  const jsx=(type,props)=>({type,props});
  const slot=initial=>{const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],next=>{slots[i]=typeof next==='function'?next(slots[i]):next;}];};
  const places=[{id:'first',name:'첫 장소'},{id:'second',name:'둘째 장소'},{id:'third',name:'셋째 장소'}];
  function Image(){} Image.resolveAssetSource=()=>asset;
  const modules={
    'react/jsx-runtime':{jsx,jsxs:jsx},
    react:{useEffect:()=>{},useState:slot,useRef:initial=>slot({current:initial})[0]},
    'react-native':{Image,View:'View',ScrollView:'ScrollView',StyleSheet:{create:x=>x,absoluteFill:{position:'absolute',left:0,right:0,top:0,bottom:0}}},
    'expo-router':{router:{push:r=>pushes.push(r)}},
    'react-native-safe-area-context':{},
    'react-native-reanimated':{__esModule:true,default:{View:'Animated.View'},ReduceMotion:{System:'system'},useAnimatedStyle:()=>({}),useSharedValue:initial=>slot({value:initial,get(){return this.value;},set(v){this.value=v;}})[0],withSpring:v=>v,withTiming:v=>v,cancelAnimation:()=>{}},
    'react-native-worklets':{scheduleOnRN:fn=>fn()},
    './content':{content:{listEditorialStories:()=>[{entry:{id:'story',title:'이야기'},place:places[0],photo:{file:'photo'}}],getPhoto:()=>({file:'photo'})}},
    './photos':{photos:{photo:1}},'./editorial':editorial,
    '../../ui/Action':{Action:'Action'},'../../ui/TapArea':{TapArea:'TapArea'},'../../ui/Text':{Text:'Text'},'../../ui/SearchIcon':{},
    '../../ui/theme':{color:{page:'#FFFFFF'},layout:{},textStyles:{}},
    '../../ui/PhotoGlass':{PhotoGlass:'PhotoGlass'},'../../ui/PhotoReading':{photoReadingSurface:'rgba(255,255,255,.64)'},
    '../public-messages/HomePreviewCard':{},'../local-notes/device':{},
  };
  const exports={};
  const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'HomeScreen.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  // Expose private components only inside this isolated test, without changing app exports.
  vm.runInNewContext(code+'\nexports.qa={PlaceDeck,StoryCard,DeckPhoto};',{exports,requestAnimationFrame:fn=>frames.push(fn),require:name=>{assert.ok(name in modules,`unexpected import ${name}`);return modules[name];}});
  const nodes=x=>Array.isArray(x)?x.flatMap(nodes):!x||typeof x!=='object'?[]:[x,...nodes(x.props?.children)];
  return {pushes,places,nodes,Image,render:()=>{cursor=0;return exports.qa.PlaceDeck({places});},story:()=>{cursor=0;return exports.qa.StoryCard({id:'story'});},photo:()=>{cursor=0;return exports.qa.DeckPhoto({place:places[0]});}};
}

test('place card tap opens its detail immediately, while a horizontal swipe never navigates',()=>{
  const h=harness(),tree=h.render();
  const card=h.nodes(tree).find(n=>n.type==='TapArea');
  card.props.onPress();assert.equal(h.pushes.length,1);assert.equal(h.pushes[0].params.placeId,'first');
  h.pushes.length=0;
  const deck=h.nodes(tree).find(n=>n.props?.onTouchStart),event=(x,y,t)=>({nativeEvent:{pageX:x,pageY:y,timestamp:t}});
  deck.props.onTouchStart(event(100,100,0));
  assert.equal(deck.props.onMoveShouldSetResponderCapture(event(30,100,100)),true);
  deck.props.onResponderGrant();deck.props.onResponderMove(event(30,100,100));deck.props.onResponderRelease(event(0,100,150));
  card.props.onPress();assert.equal(h.pushes.length,0);
  assert.ok(h.nodes(h.render()).some(n=>n.props?.accessibilityLabel==='둘째 장소 둘러보기'));
});

test('editorial photo opens the exact story destination and its fade does not intercept touches',()=>{
  const h=harness(),tree=h.story();tree.props.onPress();
  assert.equal(h.pushes[0].params.placeId,'first');assert.equal(h.pushes[0].params.entryId,'story');
  assert.ok(h.nodes(tree).some(n=>n.props?.style?.experimental_backgroundImage&&n.props.pointerEvents==='none'));
});

test('all three bundled photo sizes override native Image intrinsic dimensions in both home layouts',()=>{
  const scenes=require('../place-messages/scenes.json');
  const flat=x=>Object.assign({},...(Array.isArray(x)?x.flat(Infinity):[x]));
  const pixels=(value,total)=>value==='100%'?total:value;
  for(const scene of scenes)for(const width of [320,390,640])for(const kind of ['story','photo']){
    const asset={width:scene.imageWidth,height:scene.imageHeight},h=harness(asset),tree=h[kind]();
    const image=h.nodes(tree).find(n=>n.type===h.Image);
    // RN Image.android.js prepends source dimensions before the supplied style.
    const native=Object.assign({},asset,flat(image.props.style));
    const height=kind==='story'?320:232;
    assert.equal(pixels(native.width,width),width,`${scene.id} ${kind}: source width leaked into viewport`);
    assert.equal(pixels(native.height,height),height,`${scene.id} ${kind}: source height leaked into viewport`);
    if(kind==='photo')assert.equal(tree.props.style.padding??0,0,'photo percentages must fill the outer card without padding offsets');
  }
});

test('restored title glass samples the same centred cover crop for all three photos and viewport sizes',()=>{
  for(const scene of require('../place-messages/scenes.json'))for(const width of [320,390,640]){
    const h=harness({width:scene.imageWidth,height:scene.imageHeight});
    h.story().props.onLayout({nativeEvent:{layout:{width,height:320}}});
    let tree=h.story();
    const panel=h.nodes(tree).find(n=>n.type==='View'&&n.props.onLayout);
    panel.props.onLayout({nativeEvent:{layout:{x:20,y:180,width:width-40,height:116}}});tree=h.story();
    const glass=h.nodes(tree).find(n=>n.type==='PhotoGlass').props;
    assert.ok(glass.image.width>=width&&glass.image.height>=320);
    assert.ok(Math.abs(glass.image.x+glass.image.width/2-width/2)<1e-8);
    assert.ok(Math.abs(glass.image.y+glass.image.height/2-160)<1e-8);
    assert.equal(glass.frame.width,width-40);assert.equal(glass.stageClip.width,width);
  }
});
