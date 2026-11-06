import type { LocationPort } from './controller';

// Lazy import permits direct browsing in an older development APK; missing native APIs become errors.
export const nativeLocation: LocationPort = {
  async requestPermission() {
    const api = await import('expo-location');
    const permission = await api.requestForegroundPermissionsAsync();
    return { granted: permission.granted, canAskAgain: permission.canAskAgain };
  },
  async servicesEnabled() {
    const api = await import('expo-location');
    return api.hasServicesEnabledAsync();
  },
  async getCurrentPosition() {
    const api = await import('expo-location');
    const sample = await api.getCurrentPositionAsync({ accuracy: api.Accuracy.Balanced });
    return { latitude: sample.coords.latitude, longitude: sample.coords.longitude,
      accuracy: sample.coords.accuracy, timestamp: sample.timestamp };
  },
};
