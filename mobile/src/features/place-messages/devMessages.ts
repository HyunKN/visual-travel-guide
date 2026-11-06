import type { Message, Messages } from './contract';
/** Explicit development fixtures. Never supplied by the product scene route. */
export function developmentMessages(sceneId: string): Messages {
  const items: Message[] = [
    { id: 'example-yard', sceneId, anchor: { u: .46, v: .83 }, createdAt: '2026-11-04T00:00:00Z', body: '마당을 걷다 보니 돌 틈이 다 다르더라고요. 고개를 들었을 때 처마가 한꺼번에 보여서 잠깐 멈췄어요.' },
    { id: 'example-roof', sceneId, anchor: { u: .62, v: .41 }, createdAt: '2026-11-04T00:00:01Z', body: '멀리서는 지붕이 먼저 보였는데, 가까이 오니 그 아래 색이 겹쳐 있는 게 눈에 들어와요.' },
    { id: 'example-corner', sceneId, anchor: { u: 0, v: 1 }, createdAt: '2026-11-04T00:00:02Z', body: '모서리 위치와 전체 사진 보기를 확인하는 개발용 글입니다.' },
    { id: 'example-nearby', sceneId, anchor: { u: .461, v: .83 }, createdAt: '2026-11-04T00:00:03Z', body: '같은 위치에 여러 글이 있을 때 한 장씩 읽는 개발용 글입니다.' },
  ];
  return {
    async list(id) { return { items: id === sceneId ? items : [], nextCursor: null }; },
    async read(id, messageId) {
      const message = items.find(m => m.id === messageId && m.sceneId === id);
      return message ? { kind: 'found', message } : { kind: 'unavailable' };
    },
  };
}
