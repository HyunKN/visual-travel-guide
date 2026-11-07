import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { TapArea } from './TapArea';
import { Text } from './Text';
import { color } from './theme';

/** Eye-tracker Pill reference adapted to touch: no hover or camera permission on press-in. */
export function CameraSearch() {
  const x=useSharedValue(0), y=useSharedValue(0);
  const gaze=useAnimatedStyle(()=>({transform:[{translateX:x.get()},{translateY:y.get()}]}));
  const reset=()=>{x.set(withSpring(0,{reduceMotion:ReduceMotion.System}));y.set(withSpring(0,{reduceMotion:ReduceMotion.System}));};
  return <TapArea accessibilityRole="button" accessibilityLabel="사진으로 찾기, 카메라 또는 갤러리" style={s.pill}
    onPressIn={e=>{x.set(Math.max(-3,Math.min(3,(e.nativeEvent.locationX-54)/15)));y.set(2);}}
    onPressOut={reset} onPress={()=>router.push('/photo-input')}>
    <View style={s.camera} accessible={false}><View style={s.top}/><Animated.View style={[s.eyes,gaze]}><View style={s.eye}/><View style={s.eye}/></Animated.View></View>
    <Text style={s.label}>사진으로 찾기</Text>
  </TapArea>;
}
const s=StyleSheet.create({
  pill:{minWidth:116,minHeight:60,borderRadius:32,alignItems:'center',justifyContent:'center',gap:4,paddingHorizontal:12,paddingVertical:8,backgroundColor:color.subtle,borderWidth:1,borderColor:color.line},
  camera:{width:29,height:21,borderRadius:7,borderWidth:1.2,borderColor:color.ink,alignItems:'center',justifyContent:'center'},
  top:{position:'absolute',top:-4,left:8,width:11,height:4,borderTopLeftRadius:3,borderTopRightRadius:3,backgroundColor:color.ink},
  eyes:{flexDirection:'row',gap:5},eye:{width:3.5,height:7,borderRadius:3,backgroundColor:color.ink},label:{fontSize:12,lineHeight:18,color:color.ink,fontWeight:'700'},
});
