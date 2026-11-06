import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerTintColor: '#172A43',
          headerTitleStyle: { fontFamily: 'SpoqaHanSans', fontWeight: '700' },
          headerStyle: { backgroundColor: '#FFFFFF' },
          contentStyle: { backgroundColor: '#FFFFFF' },
        }}
      >
        <Stack.Screen name="(browse)" options={{ headerShown: false }} />
        <Stack.Screen name="development-check" options={{ title: '화면 이동 확인' }} />
        <Stack.Screen name="place-message-preview" options={{ title: '근정전' }} />
        <Stack.Screen name="places/[placeId]" options={{ title: '장소' }} />
        <Stack.Screen name="sources/[sourceId]" options={{ title: '출처' }} />
        <Stack.Screen name="photo-input" options={{ title: '사진' }} />
        <Stack.Screen name="scenes/[sceneId]" options={{ title: '공통 사진' }} />
      </Stack>
    </>
  );
}
