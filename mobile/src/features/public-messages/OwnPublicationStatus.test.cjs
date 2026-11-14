/* global __dirname */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');

function view(read){
  let status,focus;const exports={},jsx=(type,props)=>({type,props});
  const modules={
    'react/jsx-runtime':{jsx,jsxs:jsx},react:{useState:initial=>[status??initial,next=>{status=next;}],useCallback:fn=>fn},
    'expo-router':{useFocusEffect:fn=>{focus=fn;}},'../../ui/Text':{Text:'Text'},'../../ui/theme':{textStyles:{}},
    './nativeService':{getPublicService:()=>({ownPublicationState:read})},
  };
  const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'OwnPublicationStatus.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  vm.runInNewContext(code,{exports,require:name=>{assert.ok(name in modules);return modules[name];}});
  const render=()=>exports.OwnPublicationStatus({item:{id:'note',sceneId:'scene',revision:1,kind:'published'}}).props.children[0];
  render();return {render,focus:()=>focus(),status:()=>status};
}

test('own list status uses current server moderation, withdrawal and absence instead of a past publication receipt',async()=>{
  for(const [state,label] of [[{kind:'found',hidden:true,visible:true},'관리자에 의해 숨겨짐'],[{kind:'found',hidden:false,visible:false},'공개 철회됨'],[{kind:'found',hidden:false,visible:true},'공개됨'],[{kind:'missing'},'서버 글 없음']]){
    const h=view(async(scene,id)=>{assert.equal(scene,'scene');assert.equal(id,'note');return state;});
    h.focus();await Promise.resolve();await Promise.resolve();await Promise.resolve();await Promise.resolve();
    assert.equal(h.render(),label);
  }
});

test('failed lookup never claims public, and leaving the screen invalidates a late moderation response',async()=>{
  const failed=view(async()=>{throw new Error('offline');});failed.focus();
  await Promise.resolve();await Promise.resolve();await Promise.resolve();await Promise.resolve();
  assert.equal(failed.render(),'공개 상태를 확인하지 못했어요.');
  let resolve;const pending=view(()=>new Promise(r=>{resolve=r;}));
  const leave=pending.focus();await Promise.resolve();leave();resolve({kind:'found',hidden:true,visible:true});
  await Promise.resolve();await Promise.resolve();await Promise.resolve();
  assert.equal(pending.status(),'공개 상태 확인 중');
});

test('native owner-state service reads only the current account/service/scene and discards results after account changes',async()=>{
  const exports={},calls=[];let current=true,job={ownerId:'owner',serviceId:'project',payload:{p_scene:'scene'}};
  let onRead=()=>{};
  const write=async(name,args)=>{calls.push({name,args});onRead();return [{id:'note',scene_id:'scene',version:1,u:.2,v:.4,body:'글',visible:true,hidden:true}];};
  const modules={
    './session':require('../../../../.codex-build/app-message-tests/public-messages/session.js'),
    '../auth/nativeAuth':{memoConfig:{url:'project'},authRuntime:()=>({gateway:{write},author:{run:async(_,unused,work)=>work('owner')},social:{expire:()=>{}}})},
    '../auth/accountScope':{captureAccount:()=>({ownerId:'owner'}),accountIsCurrent:()=>current,accountRpc:(_,rpc)=>rpc},
    './remote':{},'./publication':{},'../local-notes/device':{accountNotes:()=>({getPublication:async()=>job})},'./sceneMessages':{},
    './recovery':require('../../../../.codex-build/app-message-tests/public-messages/recovery.js'),
  };
  const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'nativeService.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  vm.runInNewContext(code,{exports,require:name=>{assert.ok(name in modules,`unexpected import ${name}`);return modules[name];}});
  const service=exports.getPublicService();assert.equal((await service.ownPublicationState('scene','note')).hidden,true);
  assert.equal(calls[0].name,'vtg_owner_state');assert.equal(calls[0].args.p_id,'note');
  for(const bad of [{...job,ownerId:'other'},{...job,serviceId:'other'},{...job,payload:{p_scene:'other'}}]){
    const saved=job;job=bad;await assert.rejects(service.ownPublicationState('scene','note'));job=saved;
  }
  assert.equal(calls.length,1);
  onRead=()=>{current=false;};await assert.rejects(service.ownPublicationState('scene','note'));
  assert.equal(calls.length,2);
});
