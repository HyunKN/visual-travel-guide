import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerTintColor: '#172A43',
          headerStyle: { backgroundColor: '#FFFFFF' },
          contentStyle: { backgroundColor: '#FFFFFF' },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Visual Travel Guide' }} />
        <Stack.Screen name="development-check" options={{ title: '화면 이동 확인' }} />
        <Stack.Screen name="place-message-preview" options={{ title: '근정전' }} />
        <Stack.Screen name="places/[placeId]" options={{ title: '장소' }} />
        <Stack.Screen name="sources/[sourceId]" options={{ title: '출처' }} />
        <Stack.Screen name="photo-input" options={{ title: '사진' }} />
      </Stack>
    </>
  );
}
