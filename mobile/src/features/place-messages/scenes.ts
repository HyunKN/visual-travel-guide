import scenes from './scenes.json';
import { content } from '../place-content/content';
export function getScene(sceneId: string) {
  const scene = scenes.find(s => s.id === sceneId);
  if (!scene) return null;
  const place = content.getBuilding(scene.placeId), photo = content.getPhoto(scene.placeId);
  return place.status === 'ok' && photo && scene.id === place.data.sceneId
    && photo.id === scene.assetId && place.data.assetId === scene.assetId && photo.sha256 === scene.imageSha256
    ? { ...scene, name: place.data.name, photo } : null;
}
