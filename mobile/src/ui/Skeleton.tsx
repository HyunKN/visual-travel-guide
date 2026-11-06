import {useEffect,useState} from 'react';
import {AccessibilityInfo,AppState,View,type ViewStyle} from 'react-native';
import Animated,{cancelAnimation,useAnimatedStyle,useSharedValue,withRepeat,withTiming} from 'react-native-reanimated';

/** Native adaptation of Skullet's image/text bones and pulse, not its DOM runtime.
 * Upstream notice and pinned source: assets/licenses/skullet-* */
export function Skeleton({variant='text'}:{variant?:'text'|'preview'}) {
  const opacity=useSharedValue(1),[reduced,setReduced]=useState(true),[active,setActive]=useState(AppState.currentState==='active');
  useEffect(()=>{
    let mounted=true,changes=0;
    const motion=AccessibilityInfo.addEventListener('reduceMotionChanged',value=>{changes++;setReduced(value);});
    void AccessibilityInfo.isReduceMotionEnabled().then(value=>{if(mounted&&!changes)setReduced(value);},()=>{});
    const lifecycle=AppState.addEventListener('change',s=>setActive(s==='active'));
    return ()=>{mounted=false;motion.remove();lifecycle.remove();};
  },[]);
  useEffect(()=>{
    cancelAnimation(opacity);
    opacity.value=reduced||!active?1:withRepeat(withTiming(.55,{duration:600}),-1,true);
    return ()=>cancelAnimation(opacity);
  },[active,reduced,opacity]);
  const animated=useAnimatedStyle(()=>({opacity:opacity.value}));
  const bone:ViewStyle={backgroundColor:'#DCE1E6',borderRadius:4};
  return <View accessible accessibilityLabel="불러오는 중" accessibilityRole="progressbar" accessibilityState={{busy:true}} style={{minHeight:88}}>
    <Animated.View importantForAccessibility="no-hide-descendants" style={[animated,{flexDirection:'row',gap:16,paddingVertical:8}]}>
      {variant==='preview'&&<View style={[bone,{width:72,height:72,borderRadius:8}]}/>}
      <View style={{flex:1,gap:12,paddingTop:4}}>
        <View style={[bone,{width:'40%',height:14}]}/><View style={[bone,{width:'96%',height:17}]}/><View style={[bone,{width:'72%',height:17}]}/>
      </View>
    </Animated.View>
  </View>;
}
