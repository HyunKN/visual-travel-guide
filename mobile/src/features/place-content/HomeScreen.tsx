import { useEffect, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
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
import { color, layout, textStyles } from '../../ui/theme';
import HomePreview from '../public-messages/HomePreviewCard';
import type { Rect } from '../place-messages/geometry';

type Place = ReturnType<typeof content.listBuildings>[number];
function openPlace(id:string,entryId?:string) { router.push({pathname:'/places/[placeId]',params:{placeId:id,...(entryId?{entryId}:{})}}); }

function StoryCard() {
  const entry=content.getEntry('geunjeongjeon-2','geunjeongjeon');
  const photo=content.getPhoto('geunjeongjeon');
  const [size,setSize]=useState({width:0,height:0}),[frame,setFrame]=useState<Rect>({x:0,y:0,width:0,height:0});
  const [failed,setFailed]=useState(false);
  if(entry.status!=='ok'||!photo)return null;
  const source=photos[photo.file],asset=Image.resolveAssetSource(source);
  const scale=Math.max(size.width/asset.width,size.height/asset.height);
  const image={x:(size.width-asset.width*scale)/2,y:(size.height-asset.height*scale)/2,width:asset.width*scale,height:asset.height*scale};
  return <TapArea accessibilityRole="button" accessibilityLabel={`추천 이야기, 근정전, ${entry.data.title}`} onPress={()=>openPlace('geunjeongjeon',entry.data.id)}
    style={s.story} onLayout={e=>setSize(e.nativeEvent.layout)}>
    {!failed&&<Image source={source} resizeMode="cover" style={s.fillPhoto} onError={()=>setFailed(true)} accessible={false}/>}
    <View style={s.storyGlass} onLayout={e=>setFrame(e.nativeEvent.layout)}>
      {!failed&&<PhotoGlass source={source} image={image} frame={frame} tint={.72}/>}
      <Text style={s.placeName}>근정전</Text><Text style={s.storyTitle}>{entry.data.title}</Text>
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

function BackCard({place,depth,offset}:{place:Place;depth:number;offset:SharedValue<number>}) {
  const movement=useAnimatedStyle(()=>{
    const d=depth-Math.min(1,Math.abs(offset.get())/240);
    return {transform:[{translateX:d*10},{translateY:d*13},{rotate:`${d*2}deg`},{scale:1-d*.035}]};
  });
  return <Animated.View pointerEvents="none" importantForAccessibility="no-hide-descendants" style={[s.deckCard,s.front,movement]}><DeckPhoto place={place}/></Animated.View>;
}
function PlaceDeck({places}:{places:Place[]}) {
  const [index,setIndex]=useState(0),locked=useRef(false),alive=useRef(true);
  const offset=useSharedValue(0);
  const animated=useAnimatedStyle(()=>({transform:[{translateX:offset.get()},{rotate:`${offset.get()/30}deg`}],opacity:1-Math.min(.75,Math.abs(offset.get())/500)}));
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;cancelAnimation(offset);};},[offset]);
  function complete(direction:number) {
    if(!alive.current)return;
    setIndex(i=>(i+direction+places.length)%places.length);offset.set(0);locked.current=false;
  }
  function swap(direction=1) {
    if(locked.current||places.length<2)return;
    locked.current=true;
    offset.set(withTiming(-direction*340,{duration:260,reduceMotion:ReduceMotion.System},done=>{if(done)scheduleOnRN(complete,direction);}));
  }
  const start=useRef({x:0,y:0,time:0});
  const settle=()=>offset.set(withSpring(0,{reduceMotion:ReduceMotion.System}));
  if(!places.length)return <Text style={textStyles.body}>지금은 장소를 불러올 수 없어요.</Text>;
  const place=places[index%places.length];
  return <View>
    <View style={s.deck} onTouchStart={e=>{start.current={x:e.nativeEvent.pageX,y:e.nativeEvent.pageY,time:Date.now()};}}
      onMoveShouldSetResponderCapture={e=>{const dx=Math.abs(e.nativeEvent.pageX-start.current.x);return !locked.current&&places.length>1&&dx>10&&dx>Math.abs(e.nativeEvent.pageY-start.current.y)*1.3;}}
      onResponderMove={e=>offset.set(e.nativeEvent.pageX-start.current.x)} onResponderTerminate={settle}
      onResponderRelease={e=>{const dx=e.nativeEvent.pageX-start.current.x,v=Math.abs(dx)/Math.max(1,Date.now()-start.current.time);if(Math.abs(dx)>42||v>.5)swap(dx<0?1:-1);else settle();}}>
      {Array.from({length:Math.min(2,places.length-1)},(_,i)=>{const depth=Math.min(2,places.length-1)-i,p=places[(index+depth)%places.length];return <BackCard key={p.id} depth={depth} place={p} offset={offset}/>;})}
      <Animated.View style={[s.deckCard,s.front,animated]}>
        <TapArea accessibilityRole="button" accessibilityLabel={`${place.name} 사진, 누르면 다음 장소`} onPress={()=>swap()} style={s.deckTap}><DeckPhoto key={place.id} place={place}/></TapArea>
      </Animated.View>
    </View>
    <View style={s.deckActions}><Action label="이전" disabled={places.length<2} onPress={()=>swap(-1)}/><Text accessibilityLiveRegion="polite" style={textStyles.source}>{index+1} / {places.length}</Text><Action label="다음" disabled={places.length<2} onPress={()=>swap(1)}/></View>
    <Action label={`${place.name} 둘러보기`} variant="soft" onPress={()=>openPlace(place.id)}/>
  </View>;
}

export default function HomeScreen() {
  const insets=useSafeAreaInsets(),input=useRef<TextInput>(null);
  const [searching,setSearching]=useState(false),[query,setQuery]=useState('');
  const [dev,setDev]=useState(false),[headerWidth,setHeaderWidth]=useState(350);
  const reveal=useSharedValue(0),searchStyle=useAnimatedStyle(()=>({width:48+Math.max(0,headerWidth-48)*reveal.get()}));
  const places=content.listBuildings(),results=content.searchBuildings(query);
  const toggle=()=>{if(searching){input.current?.blur();setSearching(false);setQuery('');reveal.set(0);}else{setSearching(true);reveal.set(withTiming(1,{duration:220,reduceMotion:ReduceMotion.System}));}};
  return <ScrollView style={s.page} keyboardShouldPersistTaps="handled" contentContainerStyle={[s.reading,{paddingTop:insets.top,paddingBottom:24}]}>
    <View style={s.mast} onLayout={e=>setHeaderWidth(e.nativeEvent.layout.width-40)}>
      <View style={[s.brand,searching&&s.hiddenBrand]} importantForAccessibility={searching?'no-hide-descendants':'auto'}><Image source={require('../../../assets/brand/palace.png')} resizeMode="contain" style={s.logo} accessible={false}/><Text style={s.brandText} accessibilityRole="header">궁금한 궁</Text></View>
      <Animated.View style={[s.searchShell,searchStyle]}>
        <TapArea accessibilityRole="button" accessibilityLabel={searching?'검색 닫기':'장소 이름 검색'} accessibilityState={{expanded:searching}} style={s.searchButton} onPress={toggle}><SearchIcon/></TapArea>
        {searching&&<><TextInput ref={input} autoFocus showSoftInputOnFocus accessibilityLabel="장소 이름" placeholder="장소 검색" placeholderTextColor={color.secondary}
          value={query} onChangeText={setQuery} style={s.input} returnKeyType="search" underlineColorAndroid="transparent"/><Action label="닫기" onPress={toggle}/></>}
      </Animated.View>
    </View>
    {searching&&<View style={s.searchPanel}>
      {results.map(p=><Action key={p.id} label={p.name} style={s.start} onPress={()=>{input.current?.blur();openPlace(p.id);}}/>)}
      {!results.length&&<Text accessibilityLiveRegion="polite" style={textStyles.source}>일치하는 장소가 없어요.</Text>}
    </View>}
    <View style={s.recommendation}><Text style={textStyles.heading} accessibilityRole="header">추천 이야기</Text><StoryCard/></View>
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
  searchPanel:{backgroundColor:color.page,paddingHorizontal:20,paddingBottom:16,gap:4,borderBottomWidth:1,borderColor:color.line},input:{...textStyles.body,fontFamily:'SpoqaHanSans',flex:1,minHeight:48,minWidth:0},start:{alignItems:'flex-start'},
  recommendation:{padding:20,gap:14,backgroundColor:color.page},story:{minHeight:260,backgroundColor:color.subtle,borderRadius:24,overflow:'hidden',justifyContent:'flex-end',padding:10},
  storyGlass:{paddingHorizontal:18,paddingVertical:16,borderRadius:20,overflow:'hidden',gap:5,backgroundColor:color.page},placeName:{...textStyles.source,color:color.ink},storyTitle:{fontSize:24,lineHeight:34,fontWeight:'700',color:color.ink},
  section:{marginTop:12,padding:20,backgroundColor:color.page,borderTopWidth:1,borderBottomWidth:1,borderColor:color.line,gap:8},sectionHead:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:8},
  deck:{height:270,marginTop:8,marginBottom:8,marginRight:24},deckCard:{position:'absolute',height:232,borderRadius:22,backgroundColor:color.page,borderWidth:2,borderColor:color.page,overflow:'hidden',boxShadow:'0px 6px 18px rgba(0,0,0,0.12)'},front:{left:0,right:0,top:0},deckTap:{height:'100%'},
  deckPhoto:{flex:1,justifyContent:'flex-end',alignItems:'flex-start',backgroundColor:color.subtle,padding:12},photoLabel:{paddingHorizontal:14,paddingVertical:8,borderRadius:16,backgroundColor:'rgba(255,255,255,.94)'},
  deckActions:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:6},dev:{marginTop:24,paddingHorizontal:20},
});
