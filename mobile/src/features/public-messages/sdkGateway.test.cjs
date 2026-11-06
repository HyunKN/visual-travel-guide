const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Buffer}=require('node:buffer');
const {createSdkGateway,boundedJsonFetch}=require('../../../../.codex-build/app-message-tests/public-messages/sdkGateway.js');
const {createAuthorSession}=require('../../../../.codex-build/app-message-tests/public-messages/session.js');
const {PublicationRejected}=require('../../../../.codex-build/app-message-tests/public-messages/publication.js');
// Deliberately fabricated tokens. No account, secret files or network are used.
const owner='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const token=exp=>[Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),
  Buffer.from(JSON.stringify({sub:owner,role:'authenticated',exp})).toString('base64url'),'synthetic-signature'].join('.');
const jwt=token(Math.floor(Date.now()/1000)+3600);
const user={id:owner,aud:'authenticated',role:'authenticated',is_anonymous:true};
const authReply={access_token:jwt,refresh_token:'synthetic-refresh',token_type:'bearer',expires_in:3600,user};
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
test('real SDK signs in, saves before authenticated RPC and keeps public reads anonymous',async()=>{
  let saved=null,posts=0,publicReads=0;
  const gateway=createSdkGateway('https://synthetic.supabase.co','sb_publishable_synthetic',async(input,init)=>{
    const path=new URL(String(input)).pathname,headers=new Headers(init.headers);
    if(path==='/auth/v1/signup'){assert.equal(JSON.parse(init.body).data!==undefined,true);return json(authReply);}
    if(path==='/auth/v1/user')return json(user);
    if(path==='/rest/v1/rpc/vtg_write'){
      assert.ok(saved);assert.equal(headers.get('Authorization'),'Bearer '+jwt);posts++;return json(1);
    }
    if(path==='/rest/v1/rpc/vtg_snapshot'){
      assert.notEqual(headers.get('Authorization'),'Bearer '+jwt);publicReads++;return json('2026-11-07T00:00:00Z');
    }
    throw new Error('Unexpected synthetic request');
  });
  const author=createAuthorSession({read:async()=>saved,write:async s=>{saved=s;}},gateway.auth);
  await author.run(null,true,()=>gateway.write('vtg_write',{p_request:'synthetic-request'}));
  await gateway.read('vtg_snapshot',{},new AbortController().signal);
  await author.run(owner,false,()=>gateway.write('vtg_write',{p_request:'same-synthetic-request'}));
  assert.equal(saved.ownerId,owner);assert.equal(posts,2);assert.equal(publicReads,1);
});
test('real SDK refreshes expired session and persists rotated tokens before RPC',async()=>{
  const expired={ownerId:owner,accessToken:token(Math.floor(Date.now()/1000)-3600),refreshToken:'synthetic-old'};
  let saved=expired,refreshes=0;
  const gateway=createSdkGateway('https://synthetic.supabase.co','sb_publishable_synthetic',async(input,init)=>{
    const url=new URL(String(input));
    if(url.pathname==='/auth/v1/token'){
      assert.equal(url.searchParams.get('grant_type'),'refresh_token');
      assert.equal(JSON.parse(init.body).refresh_token,'synthetic-old');refreshes++;
      return json({...authReply,refresh_token:'synthetic-rotated'});
    }
    if(url.pathname==='/rest/v1/rpc/vtg_request_status'){assert.equal(saved.refreshToken,'synthetic-rotated');return json(null);}
    throw new Error('Unexpected synthetic request');
  });
  const author=createAuthorSession({read:async()=>saved,write:async s=>{saved=s;}},gateway.auth);
  await author.run(owner,false,()=>gateway.write('vtg_request_status',{}));
  assert.equal(refreshes,1);
});
test('real SDK preserves known SQL conflicts, treats 5xx as uncertainty, and handles empty report response',async()=>{
  let status=400;
  const gateway=createSdkGateway('https://synthetic.supabase.co','sb_publishable_synthetic',async()=>{
    return status===204?new Response(null,{status:204}):json({code:'P0001',message:'request_conflict'},status);
  });
  await assert.rejects(gateway.write('vtg_write',{}),error=>error instanceof PublicationRejected);
  status=503;
  await assert.rejects(gateway.write('vtg_write',{}),error=>!(error instanceof PublicationRejected));
  status=204;assert.equal(await gateway.write('vtg_report',{}),null);
});
test('deadline covers body stall; already-cancelled requests never reach transport',async()=>{
  let entered=false;
  const bounded=boundedJsonFetch(async()=>({status:200,statusText:'OK',headers:new Headers(),text:()=>new Promise(()=>{})}),15);
  await assert.rejects(bounded('https://synthetic.invalid'),error=>error.name==='AbortError');
  const controller=new AbortController();controller.abort();
  const cancelled=boundedJsonFetch(async()=>{entered=true;return json(null);},15);
  await assert.rejects(cancelled('https://synthetic.invalid',{signal:controller.signal}));assert.equal(entered,false);
});
