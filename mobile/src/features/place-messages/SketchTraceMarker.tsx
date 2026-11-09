import {Image,StyleSheet,View} from 'react-native';
import {Text} from '../../ui/Text';
import {color} from '../../ui/theme';

type Props={variant:'message'|'selected';count?:never}|{variant:'group';count:number};
/** Decorative pixels only. The scene owns the 48dp target, label, ref and anchor. */
export function SketchTraceMarker(props:Props){
  const wide=props.variant==='group'&&props.count>=10;
  const source=props.variant==='message'?require('../../../assets/trace-markers/message.png'):
    props.variant==='selected'?require('../../../assets/trace-markers/selected.png'):
      wide?require('../../../assets/trace-markers/group-wide.png'):require('../../../assets/trace-markers/ring.png');
  return <View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" style={[s.marker,wide&&s.wide]}>
    {props.variant==='group'&&<View style={s.countSurface}/>}
    <Image source={source} accessible={false} resizeMode="contain" style={[s.image,wide&&s.wideImage]}/>
    {props.variant==='group'&&<Text style={s.count}>{props.count}</Text>}
  </View>;
}
const s=StyleSheet.create({
  marker:{minWidth:14,height:14,alignItems:'center',justifyContent:'center',overflow:'visible'},wide:{minWidth:20},
  image:{position:'absolute',width:14,height:14},wideImage:{width:20},
  countSurface:{position:'absolute',left:1,right:1,top:2,bottom:2,borderRadius:6,backgroundColor:'rgba(255,255,255,.64)'},
  count:{fontSize:10,lineHeight:14,paddingHorizontal:3,color:color.ink,includeFontPadding:false,textAlign:'center'},
});
