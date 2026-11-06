const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createReaderPresentation}=require('../../../../.codex-build/app-message-tests/place-messages/presentation.js');
const {createMessageReader}=require('../../../../.codex-build/app-message-tests/place-messages/reader.js');
const loading=id=>({kind:'loading',id});
const found=id=>({kind:'found',id,message:{id,sceneId:'scene',anchor:{u:.3,v:.7},createdAt:'2026-11-07T00:00:00Z',body:`body ${id}`}});
test('opening pins one side; incoming content or viewport changes do not restart or relocate it',()=>{
  const p=createReaderPresentation();p.sync(loading('one'),'bottom');const token=p.snapshot().token;
  p.sync(found('one'),'top');assert.equal(p.snapshot().side,'bottom');assert.equal(p.snapshot().token,token);
  assert.equal(p.finish(token),false);assert.equal(p.snapshot().phase,'open');assert.equal(p.snapshot().reader.message.body,'body one');
});
test('close during entry retains the displayed body, rejects old entry completion and then hides once',()=>{
  const p=createReaderPresentation();p.sync(found('one'),'top');const opening=p.snapshot().token;
  p.sync(null,'bottom');const closing=p.snapshot().token;
  assert.equal(p.snapshot().phase,'closing');assert.equal(p.snapshot().reader.message.body,'body one');
  assert.equal(p.finish(opening),false);assert.equal(p.snapshot().phase,'closing');
  assert.equal(p.finish(closing),true);assert.equal(p.snapshot().phase,'hidden');assert.equal(p.finish(closing),false);
});
test('repeated close does not restart the exit or extend an invisible blocking surface',()=>{
  const p=createReaderPresentation();p.sync(found('one'),'top');p.sync(null,'bottom');const exiting=p.snapshot();
  p.sync(null,'bottom');p.sync(null,'top');assert.equal(p.snapshot(),exiting);
  p.finish(exiting.token);assert.equal(p.snapshot().phase,'hidden');
});
test('new reader during exit invalidates the old completion and keeps the new body visible',()=>{
  const p=createReaderPresentation();p.sync(found('one'),'top');p.sync(null,'top');const exiting=p.snapshot().token;
  p.sync(found('two'),'bottom');const opening=p.snapshot().token;
  assert.equal(p.finish(exiting),false);assert.equal(p.snapshot().reader.id,'two');assert.equal(p.snapshot().side,'bottom');
  p.finish(opening);assert.equal(p.snapshot().phase,'open');
});
test('adjacent message and reloading the same message keep the open placement without new entry motion',()=>{
  const p=createReaderPresentation();p.sync(found('one'),'bottom');p.finish(p.snapshot().token);const token=p.snapshot().token;
  p.sync(loading('two'),'top');p.sync(found('two'),'top');
  assert.equal(p.snapshot().phase,'open');assert.equal(p.snapshot().token,token);assert.equal(p.snapshot().side,'bottom');assert.equal(p.snapshot().reader.id,'two');
});
test('off-page deep-link anchor survives same-message revalidation/error and is never reused for another ID',()=>{
  const p=createReaderPresentation();p.sync(found('outside-current-page'),'bottom');p.finish(p.snapshot().token);
  const anchor=p.snapshot().anchor;
  p.sync(loading('outside-current-page'),'top');assert.deepEqual(p.snapshot().anchor,anchor);
  p.sync({kind:'error',id:'outside-current-page'},'top');assert.deepEqual(p.snapshot().anchor,anchor);
  p.sync(loading('another-id'),'top');assert.equal(p.snapshot().anchor,null);
});
test('background/route/editor handoff immediately hides and invalidates pending motion callbacks',()=>{
  for(const closeFirst of [true,false]){
    const p=createReaderPresentation();p.sync(found('one'),'top');if(closeFirst)p.sync(null,'top');const token=p.snapshot().token;
    p.hide();assert.equal(p.snapshot().phase,'hidden');assert.equal(p.finish(token),false);
    p.sync(found('two'),'bottom');assert.equal(p.finish(token),false);assert.equal(p.snapshot().reader.id,'two');
  }
});
test('idle sync and unsubscribe do not invent a reader or notify detached listeners',()=>{
  const p=createReaderPresentation();let calls=0;const off=p.subscribe(()=>calls++);
  p.sync(null,'top');p.hide();assert.equal(calls,0);off();p.sync(found('one'),'top');assert.equal(calls,0);
});
test('actual read controller cancels immediately; late network body cannot reopen a fully exited presentation',async()=>{
  let resolve;const work=new Promise(r=>{resolve=r;});
  const controller=createMessageReader({list:async()=>({items:[],nextCursor:null}),read:()=>work});
  const p=createReaderPresentation(),off=controller.subscribe(()=>p.sync(controller.snapshot().reader,'top'));
  await controller.load('scene');
  const reading=controller.open('one');assert.equal(p.snapshot().phase,'opening');
  controller.close();assert.equal(controller.snapshot().reader,null);p.finish(p.snapshot().token);
  resolve({kind:'found',message:found('one').message});await reading;
  assert.equal(controller.snapshot().reader,null);assert.equal(p.snapshot().phase,'hidden');off();
});
