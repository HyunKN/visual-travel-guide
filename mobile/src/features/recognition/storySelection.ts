import {MODEL_OUTPUT_CONTRACT,type BuildingId,type FocusId,type PartId} from './modelOutputs';

export type Topic='building'|PartId;
export type Presence='accepted_present'|'accepted_absent'|'uncertain'|'unavailable';
export type StoryEvidence=Readonly<{
  building:BuildingId|null;
  elements:Readonly<Record<PartId,Presence>>;
  focus:Readonly<{state:'unavailable'|'uncertain'|'other'}|{state:'single'|'multiple';candidates:readonly FocusId[]}>;
}>;
export type StorySelection=Readonly<{
  mode:'show_story'|'choose_topic'|'choose_place';
  primaryTopic:Topic|null;
  buildingId:BuildingId|null;
  secondaryTopics:readonly Topic[];
  scope:'generic'|'place';
  visualPresenceConfirmed:boolean;
  reason:string;
}>;
export const TOPICS:readonly Topic[]=['building',...MODEL_OUTPUT_CONTRACT.partLabels];
export const TOPIC_NAMES:Record<Topic,string>={building:'건물',signboard:'현판',dancheong:'단청',japsang:'잡상'};
export function emptyStoryEvidence(focus:'unavailable'|'uncertain'='unavailable'):StoryEvidence{
  return {building:null,elements:{signboard:'unavailable',dancheong:'unavailable',japsang:'unavailable'},focus:{state:focus}};
}
/** Only a separately validated policy may supply accepted evidence and enable automatic. */
export function selectStory(evidence:StoryEvidence,userTopic:Topic|null=null,automatic=false):StorySelection{
  const {building,elements,focus}=evidence;
  if(building!==null&&!MODEL_OUTPUT_CONTRACT.buildingLabels.includes(building))throw new Error('Unsupported building');
  if(userTopic!==null&&!TOPICS.includes(userTopic))throw new Error('Unsupported topic');
  if(Object.keys(elements).some(id=>!(MODEL_OUTPUT_CONTRACT.partLabels as readonly string[]).includes(id))||
    Object.values(elements).some(state=>!['accepted_present','accepted_absent','uncertain','unavailable'].includes(state)))throw new Error('Invalid element evidence');
  if('candidates' in focus&&(new Set(focus.candidates).size!==focus.candidates.length||
    focus.candidates.some(id=>!MODEL_OUTPUT_CONTRACT.focusLabels.includes(id))||
    (focus.state==='single'?focus.candidates.length!==1:focus.candidates.length<2)))throw new Error('Invalid focus evidence');
  const available:Topic[]=[...(building?['building' as const]:[]),...MODEL_OUTPUT_CONTRACT.partLabels.filter(p=>elements[p]==='accepted_present')];
  function result(mode:StorySelection['mode'],topic:Topic|null,reason:string):StorySelection{
    return {mode,primaryTopic:topic,buildingId:topic==='building'?building:null,
      secondaryTopics:available.filter(p=>p!==topic),scope:topic==='building'&&building?'place':'generic',
      visualPresenceConfirmed:topic==='building'?building!==null:topic!==null&&elements[topic]==='accepted_present',reason};
  }
  if(userTopic)return userTopic==='building'&&!building?result('choose_place',null,'user_chose_building_identity_unknown'):result('show_story',userTopic,'explicit_user_choice');
  if(!automatic)return result('choose_topic',null,'automatic_policy_not_validated');
  if(focus.state==='unavailable')return result('choose_topic',null,'focus_unavailable');
  if(focus.state!=='single'||focus.candidates.length!==1||focus.candidates[0]==='other_subject')return result('choose_topic',null,'multiple_other_or_uncertain_focus');
  const mapping:Record<Exclude<FocusId,'other_subject'>,Topic>={building_overview:'building',signboard_detail:'signboard',dancheong_detail:'dancheong',japsang_detail:'japsang'};
  const topic=mapping[focus.candidates[0]];
  if(topic==='building'&&!building)return result('choose_place',null,'overview_identity_unknown');
  if(!available.includes(topic))return result('choose_topic',null,'focus_presence_conflict');
  return result('show_story',topic,'accepted_focus_and_identity_or_presence');
}

export type RegisteredStory=Readonly<{id:string;topic:PartId;scope:'generic'|'place';placeId?:BuildingId;reviewed:boolean;title:string;body:string;sourceIds:readonly string[]}>;
export type StoryDestination=Readonly<{kind:'place';placeId:BuildingId}|{kind:'story';story:RegisteredStory}|{kind:'unavailable'}>;
/** Co-detected buildings/parts never establish ownership of an individual object. */
export function resolveStory(selection:StorySelection,stories:readonly RegisteredStory[]=[]):StoryDestination{
  if(selection.mode!=='show_story'||!selection.primaryTopic)return {kind:'unavailable'};
  if(selection.primaryTopic==='building')return selection.buildingId?{kind:'place',placeId:selection.buildingId}:{kind:'unavailable'};
  const story=stories.find(s=>s.topic===selection.primaryTopic&&s.scope==='generic'&&!s.placeId&&s.reviewed&&s.title.trim()&&s.body.trim()&&s.sourceIds.length>0);
  return story?{kind:'story',story}:{kind:'unavailable'};
}
