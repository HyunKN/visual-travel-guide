import { useEffect, useRef, useState } from 'react';
import { BackHandler, Image, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { router, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { cancelAnimation, ReduceMotion, useAnimatedStyle, useSharedValue, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { content } from './content';
import { photos } from './photos';
import { Action } from '../../ui/Action';
import { TapArea } from '../../ui/TapArea';
import { Text } from '../../ui/Text';
import { SearchIcon } from '../../ui/SearchIcon';
import { PhotoGlass } from '../../ui/PhotoGlass';
import { photoReadingSurface } from '../../ui/PhotoReading';
import { color, layout, textStyles } from '../../ui/theme';
import HomePreview from '../public-messages/HomePreviewCard';
import type { Rect } from '../place-messages/geometry';
import { editorialNotes } from '../local-notes/device';
import { deckDirection, emptyEditorialState, nextEditorial } from './editorial';

let fallbackEditorial = emptyEditorialState;

type Place = ReturnType<typeof content.listBuildings>[number];
function openPlace(id:string,entryId?:string) { router.push({pathname:'/places/[placeId]',params:{placeId:id,...(entryId?{entryId}:{})}}); }

function StoryCard({id}:{id:string}) {
  const story=content.listEditorialStories().find(story=>story.entry.id===id);
  const [size,setSize]=useState({width:0,height:0}),[frame,setFrame]=useState<Rect>({x:0,y:0,width:0,height:0});
  const [failed,setFailed]=useState(false);
  if(!story)return null;
  const {entry,photo,place}=story;
  const source=photos[photo.file],asset=Image.resolveAssetSource(source);
  const scale=Math.max(size.width/asset.width,size.height/asset.height);
  const image={x:(size.width-asset.width*scale)/2,y:(size.height-asset.height*scale)/2,width:asset.width*scale,height:asset.height*scale};
  return <TapArea accessibilityRole="button" accessibilityLabel={`추천 이야기, ${place.name}, ${entry.title}`} onPress={()=>openPlace(place.id,entry.id)}
    style={s.story} onLayout={e=>setSize(e.nativeEvent.layout)}>
    {!failed&&<Image source={source} resizeMode="cover" style={s.fillPhoto} onError={()=>setFailed(true)} accessible={false}/>}
    <View style={s.storyGlass} onLayout={e=>setFrame(e.nativeEvent.layout)}>
      {!failed&&<PhotoGlass source={source} image={image} frame={frame} stageClip={{x:0,y:0,...size}} tint={.12}/>}
      <View style={s.storyReading}><Text style={s.placeName}>{place.name}</Text><Text style={s.storyTitle}>{entry.title}</Text></View>
    </View>
  </TapArea>;
}

function DeckPhoto({place}:{place:Place}) {
  const photo=content.getPhoto(place.id),[failed,setFailed]=useState(false);
  return <View style={s.deckPhoto}>
    {photo&&!failed?<Image source={photos[photo.file]} style={s.fillPhoto} resizeMode="cover" accessible={false} onError={()=>setFailed(true)}/>:
      <Text style={textStyles.source}>사진을 표시할 수 없어요.</Text>}
    <View style={s.photoLabel}><Text style={textStyles.action}>{place.name}</Text></View>
  </View>;
}

function BackCard({place,depth,offset,progress,advancing}:{place:Place;depth:number;offset:SharedValue<number>;progress:SharedValue<number>;advancing:boolean}) {
  const movement=useAnimatedStyle(()=>{
    const d=advancing?depth+1-progress.get():depth-Math.min(1,Math.abs(offset.get())/240);
    return {zIndex:10-depth,transform:[{translateX:d*10},{translateY:d*13},{rotate:`${d*2}deg`},{scale:1-d*.035}]};
  });
  return <Animated.View pointerEvents="none" importantForAccessibility="no-hide-descendants" style={[s.deckCard,s.front,movement]}><DeckPhoto place={place}/></Animated.View>;
}
function PlaceDeck({places}:{places:Place[]}) {
  const [index,setIndex]=useState(0),[direction,setDirection]=useState(1);
  const [flight,setFlight]=useState<{place:Place;direction:number;depth:number;start:number}|null>(null);
  const locked=useRef(false),alive=useRef(true),dragged=useRef(false);
  const touch=useRef({x:0,y:0,lastX:0,lastTime:0,velocity:0});
  const offset=useSharedValue(0),progress=useSharedValue(1);
  const animated=useAnimatedStyle(()=>({zIndex:10,transform:[
    {translateX:flight?10*(1-progress.get()):offset.get()},
    {translateY:flight?13*(1-progress.get()):0},
    {rotate:`${flight?2*(1-progress.get()):offset.get()/30}deg`},
    {scale:flight?1-.035*(1-progress.get()):1},
  ]}));
  const flying=useAnimatedStyle(()=>{
    const t=progress.get(),depth=flight?.depth??1;
    const side=flight?.direction??1,start=flight?.start??0;
    const outward=-side*170;
    const x=t<.5?start+(outward-start)*t*2:outward+(depth*10-outward)*(t-.5)*2;
    return {zIndex:t<.5?20:10-depth,transform:[{translateX:x},{translateY:depth*13*t},{rotate:`${side*8*Math.sin(t*Math.PI)+depth*2*t}deg`},{scale:1-depth*.035*t}]};
  });
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;cancelAnimation(offset);cancelAnimation(progress);};},[offset,progress]);
  function complete() {if(alive.current){setFlight(null);locked.current=false;}}
  function swap(next=1) {
    if(locked.current||places.length<2)return;
    locked.current=true;
    const depth=next===1?Math.min(2,places.length-1):1;
    setFlight({place:places[index%places.length],direction:next,depth,start:offset.get()});
    setIndex(i=>(i+next+places.length)%places.length);setDirection(1);offset.set(0);progress.set(0);
    progress.set(withTiming(1,{duration:420,reduceMotion:ReduceMotion.System},done=>{if(done)scheduleOnRN(complete);}));
  }
  const settle=()=>{offset.set(withSpring(0,{reduceMotion:ReduceMotion.System}));requestAnimationFrame(()=>{dragged.current=false;});};
  if(!places.length)return <Text style={textStyles.body}>지금은 장소를 불러올 수 없어요.</Text>;
  const place=places[index%places.length];
  return <View>
    <View style={s.deck}
      onTouchStart={e=>{const p=e.nativeEvent;touch.current={x:p.pageX,y:p.pageY,lastX:p.pageX,lastTime:p.timestamp,velocity:0};dragged.current=false;}}
      onMoveShouldSetResponderCapture={e=>{const p=e.nativeEvent,start=touch.current,dx=p.pageX-start.x,dy=p.pageY-start.y;return !locked.current&&places.length>1&&Math.abs(dx)>10&&Math.abs(dx)>Math.abs(dy)*1.3;}}
      onResponderGrant={()=>{dragged.current=true;cancelAnimation(offset);}}
      onResponderMove={e=>{const p=e.nativeEvent,start=touch.current,elapsed=p.timestamp-start.lastTime;start.velocity=elapsed>0?(p.pageX-start.lastX)/elapsed:start.velocity;start.lastX=p.pageX;start.lastTime=p.timestamp;setDirection(p.pageX<=start.x?1:-1);offset.set(p.pageX-start.x);}}
      onResponderRelease={e=>{const p=e.nativeEvent,start=touch.current,v=p.timestamp-start.lastTime<100?start.velocity:0,next=deckDirection(p.pageX-start.x,p.pageY-start.y,v);if(next)swap(next);else settle();requestAnimationFrame(()=>{dragged.current=false;});}}
      onResponderTerminate={settle} onResponderTerminationRequest={()=>true}>
      {Array.from({length:Math.min(2,places.length-1)},(_,i)=>{const depth=Math.min(2,places.length-1)-i,p=places[(index+direction*depth+places.length)%places.length];return p.id===flight?.place.id?null:<BackCard key={p.id} depth={depth} place={p} offset={offset} progress={progress} advancing={flight?.direction===1}/>;})}
      <Animated.View style={[s.deckCard,s.front,animated]}>
        <TapArea accessibilityRole="button" accessibilityLabel={`${place.name} 사진, 누르면 다음 장소`} onPress={()=>{if(!dragged.current)swap();}} style={s.deckTap}><DeckPhoto key={place.id} place={place}/></TapArea>
      </Animated.View>
      {flight&&<Animated.View pointerEvents="none" importantForAccessibility="no-hide-descendants" style={[s.deckCard,s.front,flying]}><DeckPhoto place={flight.place}/></Animated.View>}
    </View>
    <View style={s.deckActions}><Action label="이전" disabled={!!flight||places.length<2} onPress={()=>swap(-1)}/><Text accessibilityLiveRegion="polite" style={textStyles.source}>{index+1} / {places.length}</Text><Action label="다음" disabled={!!flight||places.length<2} onPress={()=>swap(1)}/></View>
    <Action label={`${place.name} 둘러보기`} variant="soft" disabled={!!flight} onPress={()=>openPlace(place.id)}/>
  </View>;
}

export default function HomeScreen() {
  const insets=useSafeAreaInsets(),input=useRef<TextInput>(null),searchButton=useRef<View>(null),navigation=useNavigation();
  const [story,setStory]=useState<string|null>(null),storyJob=useRef(Promise.resolve()),alive=useRef(true),initialVisit=useRef(false);
  useEffect(()=>{
    alive.current=true;
    const visit=()=>{
      storyJob.current=storyJob.current.then(async()=>{
        const ids=content.listEditorialStories().map(story=>story.entry.id);
        let id:string|null;
        try{const next=await editorialNotes.nextEditorial(ids);id=next.id;fallbackEditorial=next.state;}
        catch{const next=nextEditorial(ids,fallbackEditorial);id=next.id;fallbackEditorial=next.state;}
        if(alive.current)setStory(id);
      });
    };
    if(!initialVisit.current){initialVisit.current=true;visit();}
    let selected=true;
    const unsubscribe=navigation.addListener('state',()=>{const state=navigation.getState();if(!state)return;const next=state.routes[state.index]?.name==='index';if(next&&!selected)visit();selected=next;});
    return()=>{alive.current=false;unsubscribe();};
  },[navigation]);
  const [searching,setSearching]=useState(false),[query,setQuery]=useState('');
  const [searchVisible,setSearchVisible]=useState(false);
  const [dev,setDev]=useState(false),[headerWidth,setHeaderWidth]=useState(350);
  const reveal=useSharedValue(0),searchStyle=useAnimatedStyle(()=>({width:48+Math.max(0,headerWidth-48)*reveal.get()}));
  useEffect(()=>()=>cancelAnimation(reveal),[reveal]);
  const places=content.listBuildings(),results=content.searchBuildings(query);
  function collapsed(){setSearchVisible(false);}
  const toggle=()=>{if(searching){input.current?.blur();setSearching(false);setQuery('');reveal.set(withTiming(0,{duration:180,reduceMotion:ReduceMotion.System},done=>{if(done)scheduleOnRN(collapsed);}));requestAnimationFrame(()=>searchButton.current?.focus());}else{setSearchVisible(true);setSearching(true);reveal.set(withTiming(1,{duration:220,reduceMotion:ReduceMotion.System}));}};
  const closeSearch=useRef(toggle);useEffect(()=>{closeSearch.current=toggle;});
  useEffect(()=>{if(!searching)return;const back=BackHandler.addEventListener('hardwareBackPress',()=>{if(!navigation.isFocused())return false;closeSearch.current();return true;});return()=>back.remove();},[searching,navigation]);
  return <ScrollView style={s.page} keyboardShouldPersistTaps="handled" contentContainerStyle={[s.reading,{paddingTop:insets.top,paddingBottom:24}]}>
    <View style={s.mast} onLayout={e=>setHeaderWidth(e.nativeEvent.layout.width-40)}>
      <View style={[s.brand,searchVisible&&s.hiddenBrand]} importantForAccessibility={searchVisible?'no-hide-descendants':'auto'}><Image source={require('../../../assets/brand/palace.png')} resizeMode="contain" style={s.logo} accessible={false}/><Text style={s.brandText} accessibilityRole="header">궁금한 궁</Text></View>
      <Animated.View style={[s.searchShell,searchVisible&&s.expandedSearch,searchStyle]}>
        <TapArea buttonRef={searchButton} accessibilityRole="button" accessibilityLabel={searching?'검색 닫기':'장소 이름 검색'} accessibilityState={{expanded:searching}} style={s.searchButton} onPress={toggle}><SearchIcon/></TapArea>
        {searching&&<><TextInput ref={input} autoFocus showSoftInputOnFocus accessibilityLabel="장소 이름" placeholder="장소 검색" placeholderTextColor={color.secondary}
          value={query} onChangeText={setQuery} style={s.input} returnKeyType="search" underlineColorAndroid="transparent" selectionColor={color.accent} cursorColor={color.ink}/><Action label="닫기" onPress={toggle}/></>}
      </Animated.View>
    </View>
    {searching&&<View style={s.searchPanel}>
      {results.map(p=><Action key={p.id} label={p.name} style={s.start} onPress={()=>{input.current?.blur();openPlace(p.id);}}/>)}
      {!results.length&&<Text accessibilityLiveRegion="polite" style={textStyles.source}>일치하는 장소가 없어요.</Text>}
    </View>}
    {story&&<View style={s.recommendation}><Text style={textStyles.heading} accessibilityRole="header">추천 이야기</Text><StoryCard key={story} id={story}/></View>}
    <View style={s.section}><View style={s.sectionHead}><Text style={textStyles.heading} accessibilityRole="header">장소 둘러보기</Text><Action label="주변 장소" onPress={()=>router.push('/nearby')}/></View><PlaceDeck places={places}/></View>
    <HomePreview/>
    {__DEV__&&<View style={s.dev}><Action label="개발 메뉴" onPress={()=>setDev(x=>!x)}/>{dev&&<><Action label="쪽지 읽기 예시" onPress={()=>router.push('/place-message-preview')}/><Action label="개발 실행 확인" onPress={()=>router.push('/development-check')}/></>}</View>}
  </ScrollView>;
}
const s=StyleSheet.create({
  page:{backgroundColor:color.subtle},reading:{width:'100%',maxWidth:layout.readingWidth,alignSelf:'center'},
  fillPhoto:{position:'absolute',left:0,top:0,width:'100%',height:'100%'},
  mast:{paddingHorizontal:20,paddingVertical:12,minHeight:76,backgroundColor:color.page,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12,borderBottomWidth:1,borderColor:color.line},
  brand:{flex:1,flexDirection:'row',alignItems:'center',gap:10},logo:{width:44,height:36},brandText:{...textStyles.heading,fontSize:22},searchButton:{width:48,height:48,borderRadius:24,backgroundColor:color.subtle,alignItems:'center',justifyContent:'center'},
  hiddenBrand:{opacity:0,position:'absolute'},searchShell:{minHeight:48,borderRadius:24,backgroundColor:color.subtle,flexDirection:'row',alignItems:'center',overflow:'hidden'},
  expandedSearch:{marginLeft:'auto'},
  searchPanel:{backgroundColor:color.page,paddingHorizontal:20,paddingBottom:16,gap:4,borderBottomWidth:1,borderColor:color.line},input:{...textStyles.body,fontFamily:'SpoqaHanSans',flex:1,minHeight:48,minWidth:0},start:{alignItems:'flex-start'},
  recommendation:{padding:20,gap:14,backgroundColor:color.page},story:{minHeight:260,backgroundColor:color.subtle,borderRadius:24,overflow:'hidden',justifyContent:'flex-end',padding:10},
  storyGlass:{paddingHorizontal:18,paddingVertical:16,borderRadius:20,overflow:'hidden',gap:5,backgroundColor:color.page},placeName:{...textStyles.source,color:color.ink},storyTitle:{fontSize:24,lineHeight:34,fontWeight:'700',color:color.ink},
  storyReading:{backgroundColor:photoReadingSurface,borderRadius:10,padding:8,gap:5},
  section:{marginTop:12,padding:20,backgroundColor:color.page,borderTopWidth:1,borderBottomWidth:1,borderColor:color.line,gap:8},sectionHead:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:8},
  deck:{height:270,marginTop:8,marginBottom:8,marginRight:24},deckCard:{position:'absolute',height:232,borderRadius:22,backgroundColor:color.page,borderWidth:2,borderColor:color.page,overflow:'hidden',boxShadow:'0px 6px 18px rgba(0,0,0,0.12)'},front:{left:0,right:0,top:0},deckTap:{height:'100%'},
  deckPhoto:{flex:1,justifyContent:'flex-end',alignItems:'flex-start',backgroundColor:color.subtle,padding:12},photoLabel:{paddingHorizontal:14,paddingVertical:8,borderRadius:16,backgroundColor:'rgba(255,255,255,.94)'},
  deckActions:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:6},dev:{marginTop:24,paddingHorizontal:20},
});
