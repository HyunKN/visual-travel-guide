const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID,webcrypto}=require('node:crypto');
const {DatabaseSync}=require('node:sqlite');
const {Buffer}=require('node:buffer');
const {createStore,migrate}=require('../../../../.codex-build/app-message-tests/local-notes/store.js');
const {createAuthorSession,AuthenticationRequired}=require('../../../../.codex-build/app-message-tests/public-messages/session.js');
const {createPublisher}=require('../../../../.codex-build/app-message-tests/public-messages/publication.js');
const {createPublicationRemote}=require('../../../../.codex-build/app-message-tests/public-messages/remote.js');
const {createSessionVault}=require('../../../../.codex-build/app-message-tests/public-messages/sessionVault.js');
const {createSdkGateway}=require('../../../../.codex-build/app-message-tests/public-messages/sdkGateway.js');
const {createSocialAuth,callbackCode,authCallback}=require('../../../../.codex-build/app-message-tests/auth/socialAuth.js');
const {setAccountScope,captureAccount,accountDatabaseName,bindAccountStore,accountRpc}=require('../../../../.codex-build/app-message-tests/auth/accountScope.js');
const {installPkceCrypto}=require('../../../../.codex-build/app-message-tests/auth/pkceCrypto.js');
const {redirectAuthCallback}=require('../../../../.codex-build/app-message-tests/auth/callbackRouting.js');
const service='https://synthetic.supabase.co',a='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',b='bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
const sample=ownerId=>({ownerId,accessToken:'synthetic-access',refreshToken:'synthetic-refresh',permanent:true});
function secrets(){const data=new Map();return {data,get:async k=>data.get(k)??null,set:async(k,v)=>{data.set(k,v);},remove:async k=>{data.delete(k);}};}
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
function setup(browser,options={}){
  const secret=options.secret??secrets(),vault=createSessionVault(secret,'social-test',randomUUID);
  const author=createAuthorSession(vault,{restore:options.restore??(async s=>s)});let exchanges=0;
  const gateway={oauth:async(provider,redirect)=>{assert.ok(['google','custom:naver'].includes(provider));return 'https://synthetic.invalid/auth?redirect='+encodeURIComponent(redirect);},
    exchange:async()=>{exchanges++;if(options.exchange) return options.exchange();return sample(options.owner??a);},clear:async()=>{}};
  const auth=createSocialAuth(service,gateway,author,browser,()=>options.nonce??'new-attempt',options.now??Date.now);
  return {auth,author,vault,secret,exchanges:()=>exchanges};
}
const success=(url)=>Promise.resolve({type:'success',url:new URL(url).searchParams.get('redirect')+'&code=synthetic-code'});

test('warm callbacks leave the original memo route mounted; cold callback strips secrets and never exchanges',()=>{
  assert.equal(redirectAuthCallback(authCallback+'?attempt=a&code=synthetic',false),null);
  assert.equal(redirectAuthCallback(authCallback+'#access_token=synthetic',true),'/auth/callback');
  assert.equal(redirectAuthCallback('/places/geunjeongjeon',false),'/places/geunjeongjeon');
});

test('callback rejects wrong origin/path, credentials, fragments, duplicate/nonmatching nonce and query tokens',()=>{
  assert.deepEqual(callbackCode(authCallback+'?attempt=n&code=c','n'),{code:'c',flowId:undefined});
  for(const url of ['https://auth/callback?attempt=n&code=c','visual-travel-guide://auth/other?attempt=n&code=c',
    'visual-travel-guide://user:pass@auth/callback?attempt=n&code=c',authCallback+'?attempt=n&code=c#access_token=bad',
    authCallback+'?attempt=old&code=c',authCallback+'?attempt=n&attempt=n&code=c',authCallback+'?attempt=n&code=c&code=c',authCallback+'?attempt=n&code=c&access_token=bad'])assert.throws(()=>callbackCode(url,'n'));
});

test('only a completed durable permanent login exposes account scope; concurrent login does not exchange twice',async()=>{
  const browser=deferred(),s=setup(()=>browser.promise);
  const login=s.auth.signIn('google');assert.equal(s.auth.snapshot().kind,'signing-in');assert.throws(captureAccount);
  await s.auth.signIn('custom:naver');browser.resolve({type:'success',url:authCallback+'?attempt=new-attempt&code=one'});await login;
  assert.equal(s.exchanges(),1);assert.equal(s.auth.snapshot().ownerId,a);assert.equal(captureAccount().ownerId,a);
  assert.equal((await s.vault.read()).ownerId,a);
});

test('old callback is ignored without consuming the new verifier; cancellation and expired login exchange nothing',async()=>{
  const fresh=deferred();let calls=0;
  const s=setup(async()=>++calls===1?{type:'success',url:authCallback+'?attempt=old&code=old'}:fresh.promise);
  const login=s.auth.signIn('custom:naver');while(calls<2)await new Promise(r=>setImmediate(r));
  assert.equal(s.exchanges(),0);assert.equal(s.auth.snapshot().kind,'signing-in');
  fresh.resolve({type:'success',url:authCallback+'?attempt=new-attempt&code=fresh'});await login;assert.equal(s.exchanges(),1);
  const cancelled=setup(async()=>({type:'cancel'}));await cancelled.auth.signIn('google');assert.equal(cancelled.exchanges(),0);assert.equal(cancelled.auth.snapshot().kind,'guest');
  let now=0;const expired=setup(async(_url,redirect)=>{now=300001;return success(_url,redirect);},{now:()=>now});
  await expired.auth.signIn('custom:naver');assert.equal(expired.exchanges(),0);assert.equal(expired.auth.snapshot().kind,'error');
});

test('browser cancel and dismiss stay quiet after deadline and the next explicit login may succeed',async()=>{
  for(const type of ['cancel','dismiss']){
    let now=0,cancel=true;
    const s=setup(async url=>{if(cancel){now=300001;return {type};}return success(url);},{now:()=>now});
    await s.auth.signIn('google');assert.equal(s.auth.snapshot().kind,'guest');assert.equal(s.auth.snapshot().message,undefined);assert.equal(s.exchanges(),0);
    cancel=false;await s.auth.signIn('custom:naver');assert.equal(s.auth.snapshot().kind,'authenticated');assert.equal(s.exchanges(),1);
  }
});

test('only current-attempt access_denied without a server code is quiet cancellation, including mirrored Supabase envelopes',async()=>{
  const prefix=authCallback+'?attempt=new-attempt';
  for(const suffix of ['&error=access_denied','&error=access_denied&error_description=opaque',
    '#error=access_denied&error_description=opaque&sb=',
    '&error=access_denied&error_description=#error=access_denied&sb=',
    '&error=access_denied&error_description=opaque#error=access_denied&error_description=opaque&sb=']){
    const s=setup(async()=>({type:'success',url:prefix+suffix}));
    await s.auth.signIn('custom:naver');assert.equal(s.auth.snapshot().kind,'guest',suffix);assert.equal(s.auth.snapshot().message,undefined);assert.equal(s.exchanges(),0);
  }
});

test('malformed or server-error denial envelopes never become cancellation or exchange a code',async()=>{
  const prefix=authCallback+'?attempt=new-attempt';
  const bad=[
    'https://auth/callback?attempt=new-attempt&error=access_denied',
    'visual-travel-guide://auth/other?attempt=new-attempt&error=access_denied',
    'visual-travel-guide://u:p@auth/callback?attempt=new-attempt&error=access_denied',
    authCallback+'?attempt=&error=access_denied',authCallback+'#error=access_denied&attempt=new-attempt',
    prefix+'&attempt=new-attempt&error=access_denied',prefix+'&error=access_denied&error=access_denied',
    prefix+'&error=access_denied&code=synthetic',prefix+'&error=access_denied#access_token=synthetic',
    prefix+'&error=access_denied#error=access_denied&error_description=other&sb=',
    prefix+'&error=access_denied&error_description=a#error=access_denied&error_description=b&sb=',
    prefix+'&error=access_denied#error_description=a&sb=',
    prefix+'&error=access_denied#error=server_error&sb=',prefix+'&error=access_denied#sb=unexpected',
    prefix+'&error=access_denied#error=access_denied&error=access_denied&sb=',
    prefix+'&error=access_denied&error_code=',prefix+'&error=access_denied&error_code=signup_disabled',
    prefix+'&error=access_denied&error_code=user_banned',prefix+'&error=access_denied&error_code=provider_email_needs_verification',
    prefix+'&error=access_denied&error_code=user_cancelled',prefix+'&error=server_error&error_description=access_denied',
    prefix+'&error_description=access_denied',prefix+'&code=synthetic&error=access_denied',
  ];
  for(const url of bad){const s=setup(async()=>({type:'success',url}));await s.auth.signIn('google');assert.equal(s.auth.snapshot().kind,'error',url);assert.equal(s.exchanges(),0,url);}
});

test('late current denial is quiet but valid stale denial/server errors keep the active login waiting',async()=>{
  let now=0;
  const late=setup(async()=>{now=300001;return {type:'success',url:authCallback+'?attempt=new-attempt&error=access_denied'};},{now:()=>now});
  await late.auth.signIn('custom:naver');assert.equal(late.auth.snapshot().kind,'guest');assert.equal(late.auth.snapshot().message,undefined);assert.equal(late.exchanges(),0);
  for(const envelope of ['error=access_denied','error=access_denied&error_description=#error=access_denied&sb=','error=access_denied&error_code=user_banned']){
    const fresh=deferred();let calls=0;
    const s=setup(async()=>++calls===1?{type:'success',url:authCallback+'?attempt=old&'+envelope}:fresh.promise);
    const login=s.auth.signIn('google');while(calls<2)await new Promise(r=>setImmediate(r));
    assert.equal(s.auth.snapshot().kind,'signing-in',envelope);assert.equal(s.exchanges(),0);
    fresh.resolve({type:'success',url:authCallback+'?attempt=new-attempt&code=current'});await login;
    assert.equal(s.auth.snapshot().kind,'authenticated');assert.equal(s.exchanges(),1);
  }
});

test('stale callbacks stay bounded by deadline and malformed stale envelopes cannot bypass validation',async()=>{
  let now=0;
  const expired=setup(async()=>{now=300001;return {type:'success',url:authCallback+'?attempt=old&error=access_denied'};},{now:()=>now});
  await expired.auth.signIn('google');assert.equal(expired.auth.snapshot().kind,'error');assert.equal(expired.exchanges(),0);
  for(const suffix of ['&attempt=old&error=access_denied','&error=access_denied&code=synthetic','&error=access_denied#access_token=synthetic',
    '&error=access_denied&error_code=#error=access_denied&sb=',
    '&error=access_denied&error_description=nonempty#error=access_denied&sb=']){
    const s=setup(async()=>({type:'success',url:authCallback+'?attempt=old'+suffix}));
    await s.auth.signIn('google');assert.equal(s.auth.snapshot().kind,'error',suffix);assert.equal(s.exchanges(),0);
  }
});

test('unknown browser results, missing URLs, network and exchange failures remain errors',async()=>{
  for(const result of [{type:'success'},{type:'unknown'},{type:'locked'},{type:'opened'}]){
    const s=setup(async()=>result);await s.auth.signIn('google');assert.equal(s.auth.snapshot().kind,'error');assert.equal(s.exchanges(),0);
  }
  const offline=setup(async()=>{throw new Error('network');});await offline.auth.signIn('google');assert.equal(offline.auth.snapshot().kind,'error');assert.equal(offline.exchanges(),0);
  const exchange=setup(success,{exchange:async()=>{throw new Error('exchange');}});await exchange.auth.signIn('google');assert.equal(exchange.auth.snapshot().kind,'error');assert.equal(exchange.exchanges(),1);
});

test('logout locks synchronously, discards an in-flight result and tombstones restart session recovery',async()=>{
  const s=setup(success);await s.auth.signIn('google');
  const entered=deferred(),release=deferred();const old=s.author.run(a,false,async()=>{entered.resolve();await release.promise;return 'old memo';});
  await entered.promise;const logout=s.auth.signOut();assert.equal(s.auth.snapshot().kind,'signing-out');assert.throws(captureAccount);
  await logout;assert.equal(await s.vault.read(),null);release.resolve();await assert.rejects(old);
  const restarted=setup(success,{secret:s.secret});await restarted.auth.restore();assert.equal(restarted.auth.snapshot().kind,'guest');
});

test('logout tombstone failure stays locked and can be explicitly retried',async()=>{
  const secret=secrets();let fail=false;const s=setup(success,{secret:{...secret,set:async(k,v)=>{if(fail&&v==='signed-out')throw Error('disk');return secret.set(k,v);}}});
  await s.auth.signIn('google');fail=true;await s.auth.signOut();assert.throws(captureAccount);assert.equal(s.auth.snapshot().logoutPending,true);
  fail=false;await s.auth.signOut();assert.equal(await s.vault.read(),null);
});
test('temporary restore failure retains saved session and offers a safe restore retry',async()=>{
  const secret=secrets(),first=setup(success,{secret});await first.auth.signIn('google');let offline=true;
  const restarted=setup(success,{secret,restore:async s=>{if(offline)throw Error('offline');return s;}});
  await restarted.auth.restore();assert.equal(restarted.auth.snapshot().restorePending,true);assert.throws(captureAccount);assert.equal((await restarted.vault.read()).ownerId,a);
  offline=false;await restarted.auth.restore();assert.equal(restarted.auth.snapshot().ownerId,a);
});
test('leaving a memo gate cancels only pending OAuth; saved-session restoration may complete on the guide',async()=>{
  const secret=secrets(),first=setup(success,{secret});await first.auth.signIn('google');
  const response=deferred(),restart=setup(success,{secret,restore:()=>response.promise});const restoring=restart.auth.restore();
  restart.auth.cancelSignIn();assert.equal(restart.auth.snapshot().kind,'restoring');response.resolve(sample(a));await restoring;assert.equal(restart.auth.snapshot().ownerId,a);
  const callback=deferred(),pending=setup(()=>callback.promise),login=pending.auth.signIn('google');
  const cancelling=pending.auth.cancelSignIn();callback.resolve({type:'success',url:authCallback+'?attempt=new-attempt&code=late'});await login;await cancelling;assert.equal(pending.exchanges(),0);assert.equal(pending.auth.snapshot().kind,'guest');
});
test('cancelling while the accepted session pointer is being written commits a tombstone after that write',async()=>{
  const secret=secrets(),entered=deferred(),release=deferred();
  const s=setup(success,{secret:{...secret,set:async(key,value)=>{if(key==='social-test'&&value!=='signed-out'){entered.resolve();await release.promise;}return secret.set(key,value);}}});
  const login=s.auth.signIn('google');await entered.promise;assert.equal(s.auth.snapshot().kind,'signing-in');
  const cancel=s.auth.cancelSignIn();assert.equal(s.auth.snapshot().kind,'signing-out');assert.throws(captureAccount);
  release.resolve();await login;await cancel;assert.equal(await s.vault.read(),null);
  const restarted=setup(success,{secret});await restarted.auth.restore();assert.equal(restarted.auth.snapshot().kind,'guest');
});

function sqlStore(db){const c={execAsync:async s=>db.exec(s),runAsync:async(s,...v)=>db.prepare(s).run(...v),getFirstAsync:async(s,...v)=>db.prepare(s).get(...v)??null,getAllAsync:async(s,...v)=>db.prepare(s).all(...v)};
  const transaction=async work=>{db.exec('BEGIN');try{await work(c);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}};return {c,transaction,store:createStore(transaction,randomUUID)};}
test('real separate SQLite stores retain A drafts/pending consent while B and stale A handles cannot read or forward them',async t=>{
  const dbA=new DatabaseSync(':memory:'),dbB=new DatabaseSync(':memory:'),legacy=new DatabaseSync(':memory:');t.after(()=>{dbA.close();dbB.close();legacy.close();});
  legacy.exec('CREATE TABLE keep(value TEXT);INSERT INTO keep VALUES(\'legacy remains\')');
  const A=sqlStore(dbA),B=sqlStore(dbB);await A.transaction(migrate);await B.transaction(migrate);
  setAccountScope(service,a);const aScope=captureAccount(),boundA=bindAccountStore(aScope,A.store);
  const draft={...await boundA.createDraft('scene',{u:.2,v:.7}),body:'A private draft',revision:1,visibility:'public'};
  await boundA.saveDraft(draft);await boundA.preparePublication(draft,a,service);
  const queued=boundA.saveDraft({...draft,body:'A queued edit',revision:2});
  setAccountScope(null);setAccountScope(service,b);const boundB=bindAccountStore(captureAccount(),B.store);
  await assert.rejects(queued);assert.deepEqual(await boundB.list(),[]);assert.equal(await boundB.getDraft(draft.id,'scene'),null);
  assert.equal(await boundB.getPublication(draft.id),null);await assert.rejects(boundB.preparePublication(draft,b,service));await assert.rejects(boundA.getDraft(draft.id,'scene'));
  setAccountScope(service,a);const restored=bindAccountStore(captureAccount(),A.store);
  assert.equal((await restored.getDraft(draft.id,'scene')).body,'A queued edit');assert.equal((await restored.getPublication(draft.id)).ownerId,a);
  await assert.rejects(boundA.list());assert.deepEqual(await B.store.list(),[]);
  assert.equal(legacy.prepare('SELECT value FROM keep').get().value,'legacy remains');
  assert.notEqual(accountDatabaseName(service,a),accountDatabaseName(service,b));assert.notEqual(accountDatabaseName(service,a),accountDatabaseName('https://other.supabase.co',a));
  assert.throws(()=>accountDatabaseName(service,'../legacy'));
});
test('expired publish locks before publisher uncertainty handling, preserves request and never expires the next account',async t=>{
  const db=new DatabaseSync(':memory:');t.after(()=>db.close());const A=sqlStore(db);await A.transaction(migrate);
  setAccountScope(service,a);const scope=captureAccount(),store=bindAccountStore(scope,A.store);
  const d={...await store.createDraft('scene',{u:.2,v:.7}),body:'consent stays',revision:1,visibility:'public'};
  const job=await store.preparePublication(d,a,service);let lost=0;
  const onLost=()=>{lost++;setAccountScope(null);};
  const rpc=accountRpc(scope,async()=>{throw new AuthenticationRequired();},onLost);
  await assert.rejects(createPublisher(store,createPublicationRemote(a,service,rpc)).deliver(d.id));
  assert.equal(lost,1);assert.equal((await A.store.getPublication(d.id)).requestId,job.requestId);
  setAccountScope(service,a);const again=captureAccount(),reply=deferred(),late=accountRpc(again,()=>reply.promise,onLost)('vtg_read',{});
  setAccountScope(service,b);reply.resolve(Promise.reject(new AuthenticationRequired()));await assert.rejects(late);
  assert.equal(lost,1);assert.equal(captureAccount().ownerId,b);
});

test('PKCE adapter adds only native random/digest and preserves an existing verification primitive',async()=>{
  const verify=()=>false,target={crypto:{subtle:{verify}}};let random=0;
  installPkceCrypto(target,{random:array=>{random++;return webcrypto.getRandomValues(array);},sha256:data=>webcrypto.subtle.digest('SHA-256',data)});
  target.crypto.getRandomValues(new Uint32Array(4));assert.equal(random,1);assert.equal(target.crypto.subtle.verify,verify);assert.equal(target.crypto.subtle.sign,undefined);
  const result=await target.crypto.subtle.digest('SHA-256',new TextEncoder().encode('abc'));
  assert.equal(Buffer.from(result).toString('hex'),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.throws(()=>target.crypto.subtle.digest('MD5',new Uint8Array()));
});

test('SDK OAuth requests Google account selection and Naver reauthentication; S256, redirect and openid stay intact',async()=>{
  const gateway=createSdkGateway(service,'sb_publishable_synthetic',async()=>{throw Error('No network expected');});
  for(const provider of ['google','custom:naver']){
    const url=new URL(await gateway.oauth(provider,authCallback+'?attempt=n'));
    assert.equal(url.searchParams.get('provider'),provider);assert.equal(url.searchParams.get('code_challenge_method'),'s256');assert.equal(url.searchParams.get('redirect_to'),authCallback+'?attempt=n');
    assert.deepEqual(url.searchParams.getAll('prompt'),[provider==='google'?'select_account':'login']);
    if(provider==='google')assert.notEqual(url.searchParams.get('prompt'),'login');
    assert.notEqual(url.searchParams.get('prompt'),'consent');assert.equal(url.searchParams.has('max_age'),false);
    if(provider==='custom:naver')assert.equal(url.searchParams.get('scopes'),'openid');
  }
});
