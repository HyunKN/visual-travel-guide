import { Image } from 'react-native';
import type { ImagePickerOptions } from 'expo-image-picker';
import { createPhotoInput } from './photoInput';

// Load the native adapter only for photo input. A missing/stale development APK
// must not prevent the independent place-reading route from opening.
const picker = () => import('expo-image-picker');
export const photoInput = createPhotoInput({
  requestCameraPermission: async () => (await picker()).requestCameraPermissionsAsync(),
  async pick(source) {
    const module = await picker();
    const options: ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: false, quality: 1, exif: false, base64: false };
    return source === 'camera'
      ? module.launchCameraAsync(options)
      : module.launchImageLibraryAsync({ ...options, allowsMultipleSelection: false });
  },
  recover: async () => (await picker()).getPendingResultAsync(),
  readSize: uri => Image.getSize(uri),
});
