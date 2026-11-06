import { Tabs } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Text } from '../../ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function BrowseTabs() {
  const insets = useSafeAreaInsets();
  return <Tabs screenOptions={{headerShown:false}} tabBar={({state,navigation})=><View style={{flexDirection:'row',backgroundColor:'#FFFFFF',borderTopWidth:1,borderColor:'#DFE3E7',paddingBottom:insets.bottom}}>
    {state.routes.map((route,i)=><Pressable key={route.key} accessibilityRole="tab" accessibilityState={{selected:i===state.index}}
      onPress={()=>navigation.navigate(route.name)} style={{flex:1,minHeight:60,justifyContent:'center',alignItems:'center'}}>
      <Text style={{color:i===state.index?'#243247':'#526071',fontWeight:i===state.index?'700':'400',fontSize:16}}>{route.name==='index'?'둘러보기':'내 글'}</Text>
    </Pressable>)}</View>}>
    <Tabs.Screen name="index" /><Tabs.Screen name="my-notes" />
  </Tabs>;
}
