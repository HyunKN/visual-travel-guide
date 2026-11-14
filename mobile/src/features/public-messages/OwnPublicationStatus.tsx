import {useCallback,useState} from 'react';
import {useFocusEffect} from 'expo-router';
import {Text} from '../../ui/Text';
import {textStyles} from '../../ui/theme';
import {getPublicService} from './nativeService';
import type {LocalItem} from '../local-notes/store';

/** Visible list rows read current moderation state; never replace a write receipt. */
export function OwnPublicationStatus({item}:{item:LocalItem}){
  const [status,setStatus]=useState('공개 상태 확인 중');
  useFocusEffect(useCallback(()=>{
    let active=true;setStatus('공개 상태 확인 중');
    void Promise.resolve().then(()=>getPublicService().ownPublicationState(item.sceneId,item.id)).then(state=>{
      if(active)setStatus(state.kind==='missing'?'서버 글 없음':state.hidden?'관리자에 의해 숨겨짐':!state.visible?'공개 철회됨':'공개됨');
    },()=>{if(active)setStatus('공개 상태를 확인하지 못했어요.');});
    return ()=>{active=false;};
  },[item.sceneId,item.id]));
  return <Text accessibilityLiveRegion="polite" style={textStyles.source}>{status}{item.kind==='draft'?' · 수정 중':''}</Text>;
}
