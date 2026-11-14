import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { color } from '../ui/theme';
import {AuthBootstrap} from '../features/auth/MemoGate';
import { HomeButton } from '../ui/HomeButton';

export default function RootLayout() {
  return (
    <>
      <AuthBootstrap/>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerTintColor: color.ink,
          headerTitleStyle: { fontFamily: 'SpoqaHanSans', fontWeight: '700', fontSize: 17 },
          headerStyle: { backgroundColor: color.page },
          headerShadowVisible: false,
          headerRight: () => <HomeButton />,
          contentStyle: { backgroundColor: color.page },
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
