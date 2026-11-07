import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Text } from '../../ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TapArea } from '../../ui/TapArea';
import { color, textStyles } from '../../ui/theme';
import { CameraSearch } from '../../ui/CameraSearch';
import { Fragment } from 'react';

export default function BrowseTabs() {
  const insets = useSafeAreaInsets();
  return <Tabs screenOptions={{headerShown:false}} tabBar={({state,navigation})=><View style={[styles.bar,{paddingBottom:insets.bottom}]}>
    {state.routes.map((route,i)=><Fragment key={route.key}>{i===1&&<View style={styles.camera}><CameraSearch/></View>}<TapArea accessibilityRole="tab" accessibilityState={{selected:i===state.index}}
      onPress={()=>{const event=navigation.emit({type:'tabPress',target:route.key,canPreventDefault:true});if(!event.defaultPrevented)navigation.navigate(route.name);}}
      onLongPress={()=>navigation.emit({type:'tabLongPress',target:route.key})} containerStyle={styles.tab} style={styles.target}>
      <View style={[styles.indicator,i===state.index&&styles.activeIndicator]} accessible={false}/>
      <Text style={[textStyles.action,i!==state.index&&styles.inactive]}>{route.name==='index'?'둘러보기':'내 글'}</Text>
    </TapArea></Fragment>)}</View>}>
    <Tabs.Screen name="index" /><Tabs.Screen name="my-notes" />
  </Tabs>;
}
const styles=StyleSheet.create({
  bar:{flexDirection:'row',backgroundColor:color.page,borderTopWidth:StyleSheet.hairlineWidth,borderColor:color.line},
  tab:{flex:1},target:{minHeight:60,paddingHorizontal:12,paddingVertical:10,justifyContent:'center',alignItems:'center',gap:6},
  indicator:{width:18,height:2,backgroundColor:'transparent'},activeIndicator:{backgroundColor:color.accent},
  inactive:{color:color.secondary,fontWeight:'400'},
  camera:{paddingVertical:6},
});
