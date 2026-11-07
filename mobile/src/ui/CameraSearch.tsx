import { router } from 'expo-router';
import { useRef } from 'react';
import { StyleSheet, View, type GestureResponderEvent } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withSpring, useReducedMotion } from 'react-native-reanimated';
import { TapArea } from './TapArea';
import { Text } from './Text';
import { color } from './theme';

/** Eye-tracker Pill reference adapted to touch: no hover or camera permission on press-in. */
export function CameraSearch() {
  const x=useSharedValue(0), y=useSharedValue(0),reduced=useReducedMotion();
  const pill=useRef<View>(null),bounds=useRef({width:116,height:60}),start=useRef({x:0,y:0}),moved=useRef(false);
  const gaze=useAnimatedStyle(()=>({transform:[{translateX:x.get()},{translateY:y.get()}]}));
  const reset=()=>{x.set(withSpring(0,{reduceMotion:ReduceMotion.System}));y.set(withSpring(0,{reduceMotion:ReduceMotion.System}));};
  const track=(e:GestureResponderEvent)=>{if(reduced)return;const b=bounds.current;x.set(Math.max(-3,Math.min(3,(e.nativeEvent.locationX-b.width/2)/15)));y.set(Math.max(-2,Math.min(2,(e.nativeEvent.locationY-b.height/2)/10)));};
  return <TapArea buttonRef={pill} accessibilityRole="button" accessibilityLabel="사진으로 찾기, 카메라 또는 갤러리" style={s.pill}
    onLayout={e=>{bounds.current=e.nativeEvent.layout;}}
    onTouchStart={e=>{start.current={x:e.nativeEvent.pageX,y:e.nativeEvent.pageY};moved.current=false;track(e);}}
    onPressIn={track} onAccessibilityTap={()=>router.push('/photo-input')}
    onTouchMove={e=>{if(Math.hypot(e.nativeEvent.pageX-start.current.x,e.nativeEvent.pageY-start.current.y)>10)moved.current=true;track(e);}}
    onTouchEnd={()=>requestAnimationFrame(()=>{moved.current=false;})}
    onTouchCancel={()=>{moved.current=true;reset();requestAnimationFrame(()=>{moved.current=false;});}} onBlur={reset}
    onPressOut={reset} onPress={()=>{if(!moved.current)router.push('/photo-input');}}>
    <View pointerEvents="none" style={s.camera} accessible={false}><View style={s.top}/><Animated.View style={[s.eyes,gaze]}><View style={s.eye}/><View style={s.eye}/></Animated.View></View>
    <Text pointerEvents="none" style={s.label}>사진으로 찾기</Text>
  </TapArea>;
}
const s=StyleSheet.create({
  pill:{minWidth:116,minHeight:60,borderRadius:32,alignItems:'center',justifyContent:'center',gap:4,paddingHorizontal:12,paddingVertical:8,backgroundColor:color.subtle,borderWidth:1,borderColor:color.line},
  camera:{width:29,height:21,borderRadius:7,borderWidth:1.2,borderColor:color.ink,alignItems:'center',justifyContent:'center'},
  top:{position:'absolute',top:-4,left:8,width:11,height:4,borderTopLeftRadius:3,borderTopRightRadius:3,backgroundColor:color.ink},
  eyes:{flexDirection:'row',gap:5},eye:{width:3.5,height:7,borderRadius:3,backgroundColor:color.ink},label:{fontSize:12,lineHeight:18,color:color.ink,fontWeight:'700'},
});
