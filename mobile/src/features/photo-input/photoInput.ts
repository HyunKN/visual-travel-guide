export type PhotoOrigin = 'camera' | 'library' | 'unknown';
export type Photo = { photoId: string; uri: string; width: number; height: number; mimeType: string | null; origin: PhotoOrigin };
type Asset = { uri: string; width: number; height: number; mimeType?: string; type?: string | null };
export type PickerResult = { canceled: boolean; assets: Asset[] | null } | { code: string };
export type PhotoResult = { kind: 'selected'; photo: Photo } | { kind: 'cancelled' } | { kind: 'error'; reason: 'permission' | 'unreadable' | 'picker' | 'busy'; canAskAgain?: boolean };
export type PhotoInputPort = {
  requestCameraPermission(): Promise<{ granted: boolean; canAskAgain: boolean }>;
  pick(source: 'camera' | 'library'): Promise<PickerResult>;
  recover(): Promise<PickerResult | null>;
  readSize(uri: string): Promise<{ width: number; height: number }>;
};

/** One ephemeral input. Release drops our handle; it never deletes a gallery or camera file. */
export function createPhotoInput(port: PhotoInputPort) {
  let active: Photo | null = null;
  let busy = false;
  let serial = 0;
  let generation = 0;
  async function accept(result: PickerResult, origin: PhotoOrigin, started: number): Promise<PhotoResult> {
    if ('code' in result) return { kind: 'error', reason: 'picker' };
    if (result.canceled) return { kind: 'cancelled' };
    const asset = result.assets?.[0];
    if (!asset || !/^(file|content):\/\//.test(asset.uri) || (asset.type && asset.type !== 'image')
      || (asset.mimeType && !asset.mimeType.startsWith('image/'))) return { kind: 'error', reason: 'unreadable' };
    try {
      const size = await port.readSize(asset.uri);
      if (!Number.isFinite(size.width) || !Number.isFinite(size.height) || size.width <= 0 || size.height <= 0) return { kind: 'error', reason: 'unreadable' };
      // The screen may have been closed while Android was choosing/decoding the photo.
      if (started !== generation) return { kind: 'cancelled' };
      const photo: Photo = { photoId: `photo-${Date.now()}-${++serial}`, uri: asset.uri, ...size, mimeType: asset.mimeType ?? null, origin };
      active = photo;
      return { kind: 'selected', photo };
    } catch { return { kind: 'error', reason: 'unreadable' }; }
  }
  return {
    getPhoto: () => active,
    async selectPhoto(source: 'camera' | 'library'): Promise<PhotoResult> {
      if (busy) return { kind: 'error', reason: 'busy' };
      busy = true;
      const started = generation;
      try {
        if (source === 'camera') {
          const permission = await port.requestCameraPermission();
          if (!permission.granted) return { kind: 'error', reason: 'permission', canAskAgain: permission.canAskAgain };
        }
        if (started !== generation) return { kind: 'cancelled' };
        return await accept(await port.pick(source), source, started);
      } catch { return { kind: 'error', reason: 'picker' }; }
      finally { busy = false; }
    },
    async recoverPhoto(): Promise<PhotoResult | null> {
      if (busy) return null;
      busy = true;
      const started = generation;
      try {
        const result = await port.recover();
        return result ? await accept(result, 'unknown', started) : null;
      } catch { return { kind: 'error', reason: 'picker' }; }
      finally { busy = false; }
    },
    releasePhoto(photoId: string) { if (active?.photoId === photoId) active = null; },
    dispose() { generation++; active = null; },
  };
}
