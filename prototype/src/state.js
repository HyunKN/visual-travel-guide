import { answerProblem, hitTarget } from './content.js';

export function initialState(preset) {
  return { screen: 'H', presetId: preset.id, sceneId: preset.sceneId, contextKey: preset.contextKey, cardVisible: preset.cardVisible, targetId: null, questionId: null, answerId: null, point: null, entryOrigin: null, error: null, comparisonCaseId: null, comparisonOptionId: null };
}

export function explorationScenes(state, preset, index) {
  return preset.navigationScenes.filter((n) => n.sceneId !== state.sceneId && n.selectableInNewExplore && index.scenes.has(n.sceneId)).slice(0, 3);
}

export function transition(state, action, index, preset = index.testPresets.get(state.presetId)) {
  const scene = index.scenes.get(state.sceneId);
  if (!scene || !preset) return state;
  const clear = { ...state, targetId: null, questionId: null, answerId: null, point: null, entryOrigin: null, error: null, comparisonCaseId: null, comparisonOptionId: null };
  const openAnswer = (targetId, answerId, questionId = null, origin = state.entryOrigin, destination = state) => {
    if (!index.scenes.get(destination.sceneId)?.targetIds.includes(targetId)) return state;
    const error = answerProblem(index, targetId, answerId, questionId);
    return { ...destination, targetId, answerId: error ? null : answerId, questionId, entryOrigin: origin, screen: error ? 'E' : 'A', error };
  };
  switch (action.type) {
    case 'view': return { ...clear, screen: 'V' };
    case 'home': return { ...clear, screen: 'H' };
    case 'new-explore': return ['A', 'Q', 'E'].includes(state.screen) ? { ...state, screen: 'N' } : state;
    case 'choose-scene': {
      if (state.screen !== 'N') return state;
      const destination = explorationScenes(state, preset, index).find((n) => n.sceneId === action.sceneId);
      return destination ? { ...clear, screen: 'V', sceneId: destination.sceneId, contextKey: destination.contextKey, cardVisible: destination.cardVisible } : state;
    }
    case 'point': {
      if (!action.point || ![action.point.x, action.point.y].every((n) => Number.isFinite(n) && n >= 0 && n <= 1)) return state;
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
  if (!state || state.presetId !== preset.id || !['H', 'V', 'A', 'Q', 'E', 'N'].includes(state.screen)) return false;
  const start = preset.navigationScenes.find((n) => n.sceneId === preset.sceneId);
  if (start?.contextKey !== preset.contextKey || start?.cardVisible !== preset.cardVisible) return false;
  const navigation = preset.navigationScenes.find((n) => n.sceneId === state.sceneId);
  if (!navigation || state.contextKey !== navigation.contextKey || state.cardVisible !== navigation.cardVisible) return false;
  const scene = index.scenes.get(state.sceneId);
  if (!scene || state.comparisonCaseId !== null || state.comparisonOptionId !== null) return false; // P03 adds candidate states.
  if (state.targetId && !scene.targetIds.includes(state.targetId)) return false;
  if (state.point !== null && (!state.point || ![state.point.x, state.point.y].every((n) => Number.isFinite(n) && n >= 0 && n <= 1))) return false;
  if (state.questionId && index.questions.get(state.questionId)?.targetId !== state.targetId) return false;
  if (state.answerId && answerProblem(index, state.targetId, state.answerId, state.questionId)) return false;
  if (['A', 'Q', 'N'].includes(state.screen)) return (!!state.targetId && !!state.answerId && state.error === null) || (state.screen === 'N' && validError(state));
  if (state.screen === 'H') return !state.targetId && !state.answerId && !state.questionId && !state.point && state.error === null;
  if (state.screen === 'V') return state.answerId === null && state.questionId === null && [null, 'unsupported-part'].includes(state.error) && (state.error !== 'unsupported-part' || !state.targetId);
  return validError(state);
}

function validError(state) {
  if (state.error === 'unsupported-question') return !!state.targetId;
  return ['missing-answer', 'missing-source'].includes(state.error) && !!state.targetId && state.answerId === null;
}
