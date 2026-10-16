import { answerProblem, hitTarget } from './content.js';

export function initialState(preset) {
  return { screen: 'H', presetId: preset.id, sceneId: preset.sceneId, contextKey: preset.contextKey, cardVisible: preset.cardVisible, targetId: null, questionId: null, answerId: null, point: null, entryOrigin: null, error: null };
}

export function transition(state, action, index) {
  const scene = index.scenes.get(state.sceneId);
  const clear = { ...state, targetId: null, questionId: null, answerId: null, point: null, error: null };
  const openAnswer = (targetId, answerId, questionId = null, origin = state.entryOrigin) => {
    if (!scene.targetIds.includes(targetId)) return { ...clear, screen: 'E', error: 'missing-answer' };
    const error = answerProblem(index, targetId, answerId, questionId);
    return { ...state, targetId, answerId: error ? null : answerId, questionId, entryOrigin: origin, screen: error ? 'E' : 'A', error };
  };
  switch (action.type) {
    case 'view': return { ...clear, screen: 'V' };
    case 'home': return { ...clear, screen: 'H' };
    case 'point': {
      if (!action.point) return state;
      const targetId = hitTarget(scene, action.point);
      return { ...clear, screen: 'V', point: action.point, targetId, entryOrigin: 'photo', error: targetId ? null : 'unsupported-part' };
    }
    case 'text-target': return scene.targetIds.includes(action.targetId) ? { ...clear, screen: 'V', targetId: action.targetId, entryOrigin: 'text' } : state;
    case 'confirm': {
      const target = index.targets.get(state.targetId);
      return target ? openAnswer(target.id, target.overviewAnswerId) : state;
    }
    case 'whole': {
      const target = index.targets.get(scene.wholeTargetId);
      return target ? openAnswer(target.id, target.overviewAnswerId, null, 'whole') : state;
    }
    case 'questions': return state.targetId ? { ...state, screen: 'Q', error: null } : state;
    case 'question': {
      const q = index.questions.get(action.questionId);
      return q?.targetId === state.targetId ? openAnswer(q.targetId, q.answerId, q.id) : { ...state, screen: 'E', error: 'unsupported-question' };
    }
    case 'overview': {
      const target = index.targets.get(state.targetId);
      return target ? openAnswer(target.id, target.overviewAnswerId) : state;
    }
    case 'unsupported-question': return { ...state, screen: 'E', error: 'unsupported-question' };
    case 'card': {
      const card = [...index.cards.values()].find((item) => item.contextKey === state.contextKey && item.sceneId === state.sceneId);
      return state.cardVisible && card ? openAnswer(card.targetId, card.answerId, card.questionId, 'card') : state;
    }
    default: return state;
  }
}

export function canRestore(state, preset, index) {
  if (!state || state.presetId !== preset.id || state.sceneId !== preset.sceneId || state.contextKey !== preset.contextKey || state.cardVisible !== preset.cardVisible || !['H', 'V', 'A', 'Q', 'E'].includes(state.screen)) return false;
  const scene = index.scenes.get(state.sceneId);
  if (state.targetId && !scene.targetIds.includes(state.targetId)) return false;
  if (state.screen === 'A') return !answerProblem(index, state.targetId, state.answerId, state.questionId);
  if (state.screen === 'Q') return !!index.targets.get(state.targetId);
  return true;
}
