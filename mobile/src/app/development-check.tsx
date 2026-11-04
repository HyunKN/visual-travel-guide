import { ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function DevelopmentCheckScreen() {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
      <Text accessibilityRole="header" style={styles.title}>상세 화면에 도착했습니다</Text>
      <Text style={styles.description}>
        상단 뒤로가기 또는 Android 시스템 뒤로가기로 시작 화면에 돌아갈 수 있습니다.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, gap: 20 },
  title: { color: '#172A43', fontSize: 28, fontWeight: '700' },
  description: { color: '#465466', fontSize: 17, lineHeight: 26 },
});
