/* global __dirname */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const base=path.resolve(__dirname,'../../../../.codex-build/app-recognition-tests/recognition');
const selection=require(path.join(base,'storySelection.js')),outputs=require(path.join(base,'modelOutputs.js'));
function harness(stories=[]){
  const slots=[],places=[];let cursor=0;
  const jsx=(type,props)=>({type,props}),exports={};
  const modules={
    'react/jsx-runtime':{jsx,jsxs:jsx},react:{useState:v=>{const i=cursor++;if(!(i in slots))slots[i]=v;return [slots[i],n=>{slots[i]=n;}];}},
    'react-native':{View:'View',StyleSheet:{create:x=>x}},'../../ui/Text':{Text:'Text'},'../../ui/Action':{Action:'Action'},'../../ui/theme':{textStyles:{}},
    '../place-content/content':{content:{listBuildings:()=>[{id:'geunjeongjeon',name:'근정전'}]}},'./storySelection':selection,'./modelOutputs':outputs,
  };
  const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'TopicSelection.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  vm.runInNewContext(code,{exports,require:name=>{assert.ok(name in modules,name);return modules[name];}});
  const nodes=x=>Array.isArray(x)?x.flatMap(nodes):!x||typeof x!=='object'?[]:[x,...nodes(x.props?.children)];
  const render=()=>{cursor=0;return nodes(exports.TopicSelection({result:null,onPlace:id=>places.push(id),stories}));};
  const choose=label=>render().find(n=>n.type==='Action'&&n.props.label===label).props.onPress();
  return {render,choose,places,evidenceForTopics:exports.evidenceForTopics};
}
test('manual elements are available with no model, and selecting them does not navigate to a guessed place',()=>{
  const h=harness();assert.deepEqual(h.render().filter(n=>n.type==='Action').map(n=>n.props.label),['건물','현판','단청','잡상']);
  h.choose('잡상');assert.equal(h.places.length,0);
  assert.ok(h.render().some(n=>n.props?.children?.join?.('')==='잡상 설명을 준비 중이에요.'));
});
test('building topic asks for an explicit place and only its button performs navigation',()=>{
  const h=harness();h.choose('건물');assert.deepEqual(h.places,[]);h.choose('근정전');assert.deepEqual(h.places,['geunjeongjeon']);
});
test('raw high scores and focus logits never manufacture accepted visual presence or identity',()=>{
  const h=harness();const e=h.evidenceForTopics({status:'analyzed',analysis:{focus:{state:'unvalidated'},partScores:[{label:'japsang',probability:1}]}});
  assert.equal(e.building,null);assert.equal(e.elements.japsang,'uncertain');assert.equal(e.focus.state,'uncertain');
  assert.equal(h.evidenceForTopics({status:'analyzed',analysis:{focus:{state:'unavailable'}}}).focus.state,'unavailable');
});
test('generic story presentation cannot leak a co-detected place-specific account',()=>{
  const specific={id:'place',topic:'dancheong',scope:'place',placeId:'gyotaejeon',reviewed:true,title:'교태전 설명',body:'장소별 문장',sourceIds:['source']};
  const h=harness([specific,{...specific,id:'generic',scope:'generic',placeId:undefined,title:'단청 일반 설명',body:'검수된 일반 문장'}]);
  h.choose('단청');const text=h.render().filter(n=>n.type==='Text').map(n=>n.props.children);
  assert.ok(text.includes('일반 설명'));assert.ok(text.includes('검수된 일반 문장'));assert.ok(!text.includes('장소별 문장'));
});
