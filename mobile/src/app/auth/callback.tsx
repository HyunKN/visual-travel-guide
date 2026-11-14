import {router} from 'expo-router';
import {View} from 'react-native';
import {Action} from '../../ui/Action';
import {Text} from '../../ui/Text';
import {textStyles} from '../../ui/theme';
import {authRuntime,memoConfig} from '../../features/auth/nativeAuth';
// Live callbacks are consumed only by the browser promise holding the matching
// attempt/verifier. A cold callback never starts a token exchange or restores a route.
export default function AuthCallback(){
  return <View style={{flex:1,padding:20,justifyContent:'center',gap:12}}><Text style={textStyles.body}>로그인 화면에서 다시 시도해 주세요.</Text><Action label="가이드로 돌아가기" onPress={()=>{if(memoConfig)authRuntime().social.cancelSignIn();router.replace('/');}}/></View>;
}
