import catalog from '../place-content/catalog.json';
import { content } from '../place-content/content';
import { photoInput } from '../photo-input/nativePhotoInput';
import { createRecognition } from './recognition';
import { createDeviceRuntime } from './deviceRuntime';

const contentVersion = String(catalog.version);
export const recognition = createRecognition({
  runtime: createDeviceRuntime(contentVersion),
  getContext: () => ({ photo: photoInput.getPhoto(), contentVersion, supportedTargetIds: content.listBuildings().map(p => p.id) }),
});
