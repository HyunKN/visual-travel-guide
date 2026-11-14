/* global __dirname */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const routerPath=path.join(__dirname,'../../node_modules/expo-router/build/react-navigation/routers');
const {CommonActions,StackRouter,TabRouter}=require(path.join(routerPath,'index.js'));
function load(file,modules){
  const exports={};
  const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  vm.runInNewContext(code,{exports,require:name=>{assert.ok(name in modules,name);return modules[name];}});
  return exports;
}
const home=load('home.ts',{'expo-router/react-navigation':{CommonActions}});

test('Home removes every detail and explicitly selects index even when launched from My Notes or a deep link',()=>{
  const root=StackRouter({initialRouteName:'(browse)'});
  const options={routeNames:['(browse)','places/[placeId]','sources/[sourceId]','scenes/[sceneId]'],routeParamList:{},routeGetIdList:{}};
  for(const names of [['(browse)','places/[placeId]','sources/[sourceId]','scenes/[sceneId]'],['scenes/[sceneId]']]){
    const state=root.getRehydratedState({index:names.length-1,routes:names.map(name=>({name,state:name==='(browse)'?{index:1,routes:[{name:'index'},{name:'my-notes'}]}:undefined}))},options);
    const action=home.homeAction(state.key);
    assert.equal(action.target,state.key);assert.equal(home.isHomeAction(action),true);
    const next=root.getRehydratedState(root.getStateForAction(state,action,options),options);
    assert.equal(next.routes.length,1);assert.equal(next.routes[0].name,'(browse)');
    const tabs=TabRouter({}),child=tabs.getRehydratedState(next.routes[0].state,{routeNames:['index','my-notes'],routeParamList:{},routeGetIdList:{}});
    assert.equal(child.routes[child.index].name,'index');
    assert.equal(root.getStateForAction(next,CommonActions.goBack(),options),null);
  }
  assert.equal(home.isHomeAction(CommonActions.goBack()),false);
  assert.equal(home.isHomeAction(CommonActions.reset({index:0,routes:[{name:'other'}]})),false);
});

test('the shared header exposes a 48dp Home button that targets the root navigator',()=>{
  const actions=[],jsx=(type,props)=>({type,props});
  const {HomeButton}=load('../ui/HomeButton.tsx',{
    'react/jsx-runtime':{jsx,jsxs:jsx},'react-native':{View:'View',StyleSheet:{create:x=>x}},
    'expo-router':{useNavigation:parent=>{assert.equal(parent,'/');return {getState:()=>({key:'root'}),dispatch:a=>actions.push(a)};}},
    '../navigation/home':home,'./TapArea':{TapArea:'TapArea'},'./theme':{color:{ink:'#292929',page:'#fff'}},
  });
  const button=HomeButton();assert.equal(button.props.accessibilityLabel,'홈으로');
  assert.equal(button.props.style.width,48);assert.equal(button.props.style.height,48);
  button.props.onPress();assert.equal(actions[0].target,'root');assert.equal(home.isHomeAction(actions[0]),true);
  const Stack=Object.assign('Stack',{Screen:'Screen'});
  const {default:Root}=load('../app/_layout.tsx',{
    'react/jsx-runtime':{jsx,jsxs:jsx},'expo-router':{Stack},'expo-status-bar':{StatusBar:'StatusBar'},
    '../ui/theme':{color:{}},'../features/auth/MemoGate':{AuthBootstrap:'AuthBootstrap'},'../ui/HomeButton':{HomeButton},
  });
  const root=Root(),stack=root.props.children.find(n=>n?.props?.screenOptions);
  assert.equal(stack.props.screenOptions.headerRight().type,HomeButton);
  assert.equal(stack.props.children.find(n=>n.props.name==='(browse)').props.options.headerShown,false);
});

test('the installed removal engine preserves Home intent and visits multiple protected scenes only once',()=>{
  const {shouldPreventRemove}=load('../../node_modules/expo-router/build/react-navigation/core/useOnPreventRemove.js',{
    react:{},'./NavigationBuilderContext':{},'./NavigationProvider':{},
  });
  const routes=[{key:'browse'},{key:'first-scene'},{key:'second-scene'}],next=[{key:'new-home'}];
  const saved=[];let pending;
  const emitter={emit:({target,data})=>{
    if(target==='browse')return {defaultPrevented:false};
    assert.equal(home.isHomeAction(data.action),true);saved.push(target);pending=data.action;
    return {defaultPrevented:true};
  }};
  assert.equal(shouldPreventRemove(emitter,{},routes,next,home.homeAction('root')),true);
  assert.equal(saved[0],'second-scene');
  assert.equal(shouldPreventRemove(emitter,{},routes,next,pending),true);
  assert.equal(saved[1],'first-scene');
  assert.equal(shouldPreventRemove(emitter,{},routes,next,pending),false);
  assert.equal(saved.length,2);
});
