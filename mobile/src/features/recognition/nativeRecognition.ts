import catalog from '../place-content/catalog.json';
import { content } from '../place-content/content';
import { photoInput } from '../photo-input/nativePhotoInput';
import { createRecognition } from './recognition';

// One service across screen mounts. No fake runtime or policy before #21 artifact handoff.
export const recognition = createRecognition({
  runtime: null,
  getContext: () => ({ photo: photoInput.getPhoto(), contentVersion: String(catalog.version), supportedTargetIds: content.listBuildings().map(p => p.id) }),
});
