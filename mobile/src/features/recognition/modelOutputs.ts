/** Hash-bound training handoff; this describes data, not a validated acceptance policy. */
export const MODEL_OUTPUT_CONTRACT = {
  version:'nubi-three-head-20261118',
  modelVersion:'nubi-final-5edc57b66551-onnx-fp32-v1',
  preprocessingVersion:'fit-pad-rgb256-v1',
  modelSha256:'5edc57b665514ec771008ffd62bf15579461f8959abd5d46e9fef219b49e8a15',
  encoderSha256:'f46080a52fb816062f1f767309ce50d2d278a00860cd3aa66a05b18c403fac05',
  onnxSha256:'b5a040e0339c3be06ee2d62956f75a9c132e71b7f41755ebd02890f0ca7ab560',
  input:{name:'image',view:'fit_pad',profile:'fit_pad256',dtype:'float32',shape:[1,3,256,256],layout:'NCHW',width:256,height:256,color:'RGB',
    exif:'transpose-before-rgb',resize:'bilinear-contain-round-ties-to-even',padRgb:[123,117,104],padPlacement:'floor-center',
    mean:[.48145466,.4578275,.40821073],std:[.26862954,.26130258,.27577711]},
  buildingLabels:['geunjeongjeon','gyotaejeon','gwanghwamun'],
  partLabels:['signboard','dancheong','japsang'],
  focusLabels:['building_overview','signboard_detail','dancheong_detail','japsang_detail','other_subject'],
  automaticPolicyValidated:false,
} as const;
export type BuildingId=typeof MODEL_OUTPUT_CONTRACT.buildingLabels[number];
export type PartId=typeof MODEL_OUTPUT_CONTRACT.partLabels[number];
export type FocusId=typeof MODEL_OUTPUT_CONTRACT.focusLabels[number];
export function isBuildingId(value:string):value is BuildingId{
  return (MODEL_OUTPUT_CONTRACT.buildingLabels as readonly string[]).includes(value);
}
export type Score<Label extends string>=Readonly<{label:Label;logit:number;probability:number}>;
export type ModelAnalysis=Readonly<{
  buildingScores:readonly Score<BuildingId>[];
  partScores:readonly Score<PartId>[];
  focus:Readonly<{state:'unavailable'}|{state:'unvalidated';scores:readonly Score<FocusId>[]}>
  automaticPolicyValidated:false;
}>;
const record=(v:unknown):v is Record<string,unknown>=>typeof v==='object'&&v!==null;
function labels(value:unknown,expected:readonly string[]){
  return Array.isArray(value)&&value.length===expected.length&&value.every((v,i)=>v===expected[i]);
}
function logits(value:unknown,length:number):value is number[]{
  return Array.isArray(value)&&value.length===length&&value.every(v=>typeof v==='number'&&Number.isFinite(v));
}
/** Per-head semantics only. No 0.5 diagnostic threshold becomes accepted evidence. */
export function decodeModelOutputs(value:unknown):ModelAnalysis|null{
  const c=MODEL_OUTPUT_CONTRACT;
  if(!record(value)||value.contractVersion!==c.version||value.modelSha256!==c.modelSha256||value.encoderSha256!==c.encoderSha256||
    !labels(value.buildingLabels,c.buildingLabels)||!labels(value.partLabels,c.partLabels)||!labels(value.focusLabels,c.focusLabels)||
    !logits(value.buildingLogits,3)||!logits(value.partLogits,3)||
    !(value.focusLogits===null||logits(value.focusLogits,5)))return null;
  const buildings=value.buildingLogits,parts=value.partLogits;
  const maximum=Math.max(...buildings);
  const exp=buildings.map(v=>Math.exp(v-maximum)),sum=exp.reduce((a,b)=>a+b,0);
  const sigmoid=(v:number)=>v>=0?1/(1+Math.exp(-v)):Math.exp(v)/(1+Math.exp(v));
  const focus=value.focusLogits;
  return {
    buildingScores:c.buildingLabels.map((label,i)=>({label,logit:buildings[i],probability:exp[i]/sum})),
    partScores:c.partLabels.map((label,i)=>({label,logit:parts[i],probability:sigmoid(parts[i])})),
    focus:focus===null?{state:'unavailable'}:{state:'unvalidated',scores:c.focusLabels.map((label,i)=>({label,logit:focus[i],probability:sigmoid(focus[i])}))},
    automaticPolicyValidated:false,
  };
}
