// Tests the actual button callbacks with native map views stubbed; not GPS or GPU output.
/* global __dirname */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');

function screen(input){
  const slots=[];let cursor=0,requests=0;const focuses=[];
  const jsx=(type,props)=>({type,props}),exports={};
  const modules={
    'react/jsx-runtime':{jsx,jsxs:jsx},
    react:{useState:initial=>{const i=cursor++;if(!(i in slots))slots[i]=initial;return [slots[i],value=>{slots[i]=value;}];},useRef:value=>({current:value}),useMemo:fn=>fn(),useEffect:()=>{}},
    'react-native':{View:'View',StyleSheet:{create:x=>x}},
    '@maplibre/maplibre-react-native':{Camera:'Camera',GeoJSONSource:'Source',Layer:'Layer',Map:'Map'},
    '../../ui/Action':{Action:'Action'},'../../ui/Text':{Text:'Text'},'../../ui/TapArea':{TapArea:'TapArea'},
    '../../ui/theme':{color:{},textStyles:{}},'../place-content/content':{content:{getBuilding:()=>({status:'missing'})}},
    './mapContract':require('../../../../.codex-build/app-message-tests/location/mapContract.js'),
  };
  const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'PalaceMap.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  vm.runInNewContext(code,{exports,require:name=>{assert.ok(name in modules,`unexpected import ${name}`);return modules[name];}});
  const props={fix:null,checkedAt:100_000,locating:false,focusRequest:null,onFocus:target=>focuses.push(target),onLocate:()=>requests++,open:()=>{},onReady:()=>{},onFailure:()=>{},...input};
  function render(){cursor=0;return exports.default(props);}
  function find(tree,type){if(!tree||typeof tree!=='object')return [];const children=tree.props?.children;return [...(tree.type===type?[tree.props]:[]),...(Array.isArray(children)?children:[children]).flatMap(child=>find(child,type))];}
  return {render,find,requests:()=>requests,focuses,props};
}

test('my-location is usable without a fix once the map is ready and starts a location request',()=>{
  const h=screen();const tree=h.render();
  assert.equal(h.find(tree,'Action').find(a=>a.label==='내 위치로').disabled,true);
  h.find(tree,'Map')[0].onDidFinishRenderingMapFully();
  const button=h.find(h.render(),'Action').find(a=>a.label==='내 위치로');
  assert.equal(button.disabled,false);assert.equal(button.busy,false);
  button.onPress();assert.equal(h.requests(),1);assert.equal(h.focuses.length,0);
});

test('my-location reuses only a fresh fix; expired fixes request again and pending requests show busy',()=>{
  const fix={latitude:37.5,longitude:127,accuracy:10,timestamp:100_000};
  for(const checkedAt of [100_000,160_001]){
    const h=screen({fix,checkedAt});h.find(h.render(),'Map')[0].onDidFinishRenderingMapFully();
    h.find(h.render(),'Action').find(a=>a.label==='내 위치로').onPress();
    assert.equal(h.requests(),checkedAt===100_000?0:1);
    assert.equal(h.focuses.length,checkedAt===100_000?1:0);
    if(h.focuses.length)assert.equal(h.focuses[0].kind,'location');
  }
  const h=screen({locating:true});h.find(h.render(),'Map')[0].onDidFinishRenderingMapFully();
  assert.equal(h.find(h.render(),'Action').find(a=>a.label==='위치 확인 중').busy,true);
});
