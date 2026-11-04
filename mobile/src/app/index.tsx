import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
      <Text accessibilityRole="header" style={styles.title}>Android 개발 실행 확인</Text>
      <Text style={styles.description}>
        앱 설치와 화면 이동을 확인하는 개발용 화면입니다.
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/place-message-preview')}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Text style={styles.buttonText}>근정전 메시지 시안</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/development-check')}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Text style={styles.buttonText}>임시 상세 화면 열기</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, gap: 20 },
  title: { color: '#172A43', fontSize: 28, fontWeight: '700' },
  description: { color: '#465466', fontSize: 17, lineHeight: 26 },
  button: { backgroundColor: '#172A43', borderRadius: 12, minHeight: 48, padding: 16 },
  pressed: { opacity: 0.75 },
  buttonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '600', textAlign: 'center' },
});
