import { useNavigation } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { homeAction } from '../navigation/home';
import { TapArea } from './TapArea';
import { color } from './theme';

export function HomeButton() {
  const navigation = useNavigation('/');
  return <TapArea accessibilityRole="button" accessibilityLabel="홈으로" style={styles.target}
    onPress={() => { const key = navigation.getState()?.key; if (key) navigation.dispatch(homeAction(key)); }}>
    <View accessible={false} pointerEvents="none" style={styles.icon}>
      <View style={styles.roof} /><View style={styles.walls} /><View style={styles.door} />
    </View>
  </TapArea>;
}

const styles = StyleSheet.create({
  target: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  icon: { width: 24, height: 22 },
  roof: { position: 'absolute', top: 3, left: 4, width: 16, height: 16,
    borderTopWidth: 1.8, borderLeftWidth: 1.8, borderColor: color.ink, transform: [{ rotate: '45deg' }] },
  walls: { position: 'absolute', left: 4, top: 10, width: 16, height: 11,
    borderWidth: 1.8, borderTopWidth: 0, borderColor: color.ink, borderBottomLeftRadius: 1, borderBottomRightRadius: 1 },
  door: { position: 'absolute', left: 9, bottom: 1, width: 6, height: 6,
    borderWidth: 1.8, borderBottomWidth: 0, borderColor: color.ink, backgroundColor: color.page },
});
