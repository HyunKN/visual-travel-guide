import {useState} from 'react';
import {StyleSheet,View} from 'react-native';
import {Text} from '../../ui/Text';
import {Action} from '../../ui/Action';
import {textStyles} from '../../ui/theme';
import {content} from '../place-content/content';
import {emptyStoryEvidence,resolveStory,selectStory,TOPICS,TOPIC_NAMES,type StoryEvidence,type Topic,type RegisteredStory} from './storySelection';
import type {RecognitionResult} from './recognition';
import {isBuildingId,type BuildingId} from './modelOutputs';

export function evidenceForTopics(result:RecognitionResult|null):StoryEvidence{
  // Raw scores are diagnostic proposals. No acceptance/focus threshold has been validated.
  const evidence=emptyStoryEvidence(result?.status==='analyzed'&&result.analysis.focus.state!=='unavailable'?'uncertain':'unavailable');
  if(result?.status==='analyzed')return {...evidence,elements:{signboard:'uncertain',dancheong:'uncertain',japsang:'uncertain'}};
  return evidence;
}
/** Parent keys this component by photo/request; explicit topic choice asserts interest only. */
export function TopicSelection({result,onPlace,stories=[]}:{result:RecognitionResult|null;onPlace:(id:BuildingId)=>void;stories?:readonly RegisteredStory[]}){
  const [topic,setTopic]=useState<Topic|null>(null);
  const selection=selectStory(evidenceForTopics(result),topic,false);
  const destination=resolveStory(selection,stories);
  const suggestions = result?.status === 'analyzed'
    ? [...result.analysis.buildingScores].sort((a, b) => b.probability - a.probability)
    : [];
  const places = suggestions.length
    ? suggestions.flatMap(({ label }) => {
        const place = content.getBuilding(label);
        return place.status === 'ok' ? [place.data] : [];
      })
    : content.listBuildings();
  return <View style={s.section}>
    <Text accessibilityRole="header" style={textStyles.heading}>어느 부분이 궁금하세요?</Text>
    <View style={s.topics}>{TOPICS.map(id=><Action key={id} label={TOPIC_NAMES[id]} selected={topic===id} onPress={()=>setTopic(id)}/>)}</View>
    {selection.mode==='choose_place'&&<View style={s.section}>
      <Text style={textStyles.body}>{suggestions.length ? '사진에서 나온 건물 후보예요. 장소를 직접 확인해 주세요.' : '장소를 골라 주세요.'}</Text>
      {places.map(place => {
        const id = place.id;
        return isBuildingId(id) && <Action key={id} label={place.name} onPress={() => onPlace(id)} />;
      })}
    </View>}
    {selection.mode==='show_story'&&destination.kind==='unavailable'&&<Text accessibilityLiveRegion="polite" style={textStyles.body}>{topic?TOPIC_NAMES[topic]:''} 설명을 준비 중이에요.</Text>}
    {destination.kind==='story'&&<View style={s.section}>
      <Text style={textStyles.source}>일반 설명</Text>
      <Text accessibilityRole="header" style={textStyles.heading}>{destination.story.title}</Text>
      <Text selectable style={textStyles.body}>{destination.story.body}</Text>
    </View>}
  </View>;
}
const s=StyleSheet.create({section:{gap:12},topics:{flexDirection:'row',flexWrap:'wrap',gap:8}});
