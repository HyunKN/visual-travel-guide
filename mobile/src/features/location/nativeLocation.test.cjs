// Verifies the actual Expo adapter's request contract, not native GPS reception.
/* global __dirname */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');

test('explicit map location uses one high-accuracy request and forwards only measurement fields',async()=>{
  const calls=[],exports={};let imports=0;
  const api={Accuracy:{Balanced:3,High:4},getCurrentPositionAsync:async options=>{
    calls.push(options);return {coords:{latitude:37.5785,longitude:126.977,accuracy:5,altitude:30,heading:90},timestamp:100_000};
  }};
  const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'nativeLocation.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(code,{exports,require:name=>{assert.equal(name,'expo-location');imports++;return api;}});
  assert.equal(imports,0);assert.equal(calls.length,0);
  const fix=await exports.nativeLocation.getCurrentPosition();
  assert.equal(calls.length,1);assert.equal(calls[0].accuracy,api.Accuracy.High);
  assert.deepEqual(JSON.parse(JSON.stringify(fix)),{latitude:37.5785,longitude:126.977,accuracy:5,timestamp:100_000});
});
