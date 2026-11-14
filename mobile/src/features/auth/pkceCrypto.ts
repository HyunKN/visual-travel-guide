type CryptoPort={random:(array:ArrayBufferView)=>ArrayBufferView;sha256:(data:BufferSource)=>Promise<ArrayBuffer>};
/** Add only the two primitives GoTrue PKCE uses. Existing WebCrypto methods are
 * preserved; unsupported signing/verification methods are never invented. */
export function installPkceCrypto(target:object,port:CryptoPort){
  const existing=Reflect.get(target,'crypto');
  const crypto=existing&&typeof existing==='object'?existing:{};
  if(typeof crypto.getRandomValues!=='function')Object.defineProperty(crypto,'getRandomValues',{value:(array:ArrayBufferView)=>port.random(array),configurable:true});
  const subtle=crypto.subtle&&typeof crypto.subtle==='object'?crypto.subtle:{};
  if(typeof subtle.digest!=='function')Object.defineProperty(subtle,'digest',{value:(algorithm:string|{name:string},data:BufferSource)=>{
    const name=typeof algorithm==='string'?algorithm:algorithm.name;
    if(name!=='SHA-256')throw new Error('Unsupported PKCE digest');return port.sha256(data);
  },configurable:true});
  if(!crypto.subtle)Object.defineProperty(crypto,'subtle',{value:subtle,configurable:true});
  if(!existing)Object.defineProperty(target,'crypto',{value:crypto,configurable:true});
}
export async function prepareNativePkce(){
  const crypto=await import('expo-crypto');
  installPkceCrypto(globalThis,{
    random:array=>crypto.getRandomValues(array as Uint8Array),
    sha256:data=>crypto.digest(crypto.CryptoDigestAlgorithm.SHA256,data),
  });
  if(typeof TextEncoder==='undefined')throw new Error('Secure login encoding unavailable');
}
