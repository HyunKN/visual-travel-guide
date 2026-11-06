import { useLocalSearchParams } from 'expo-router';
import SceneScreen from '../../features/place-messages/SceneScreen';
export default function SceneRoute() {
  const { sceneId, messageId, draftId } = useLocalSearchParams<{ sceneId?: string | string[]; messageId?: string | string[]; draftId?: string | string[] }>();
  const id = typeof sceneId === 'string' ? sceneId : '';
  return <SceneScreen key={id} sceneId={id} messageId={typeof messageId === 'string' ? messageId : undefined} draftId={typeof draftId==='string'?draftId:undefined} />;
}
