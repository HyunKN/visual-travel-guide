import { useLocalSearchParams } from 'expo-router';
import SceneScreen from '../../features/place-messages/SceneScreen';
import {MemoGate} from '../../features/auth/MemoGate';
export default function SceneRoute() {
  const { sceneId, messageId, draftId } = useLocalSearchParams<{ sceneId?: string | string[]; messageId?: string | string[]; draftId?: string | string[] }>();
  const id = typeof sceneId === 'string' ? sceneId : '';
  return <MemoGate><SceneScreen key={id} sceneId={id} messageId={typeof messageId === 'string' ? messageId : undefined} draftId={typeof draftId==='string'?draftId:undefined} /></MemoGate>;
}
