import { StyleSheet, View } from 'react-native';
import { color } from './theme';
export function SearchIcon() {
  return <View accessible={false} style={s.icon}><View style={s.lens}/><View style={s.handle}/></View>;
}
const s=StyleSheet.create({icon:{width:24,height:24},lens:{position:'absolute',left:2,top:2,width:15,height:15,borderWidth:1.7,borderColor:color.ink,borderRadius:8},handle:{position:'absolute',left:17,top:15,width:1.7,height:8,backgroundColor:color.ink,transform:[{rotate:'-42deg'}]}});
