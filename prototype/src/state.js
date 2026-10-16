import { answerProblem, hitTarget, reviewedQuestions } from './content.js';

export function initialState(preset) {
  return { screen: 'H', presetId: preset.id, sceneId: preset.sceneId, contextKey: preset.contextKey, cardVisible: preset.cardVisible, targetId: null, questionId: null, answerId: null, point: null, entryOrigin: null, error: null, comparisonCaseId: null, comparisonOptionId: null };
}

export function explorationScenes(state, preset, index) {
  return preset.navigationScenes.filter((n) => n.sceneId !== state.sceneId && n.selectableInNewExplore && index.scenes.has(n.sceneId)).slice(0, 3);
}

export function comparisonForScene(state, preset, index) {
  const item = index.comparisonCases.get(preset.comparisonCaseId);
  return item?.reviewStatus === 'reviewed' && item.inputSceneId === state.sceneId ? item : null;
}

export function availableContinuation(state, preset, index) {
  return [...index.continuations.values()].find((item) => {
    const scene = index.scenes.get(item.toSceneId), target = index.targets.get(item.toTargetId);
    return item.fromTargetId === state.targetId && item.fromTargetId !== item.toTargetId && item.reviewStatus === 'reviewed'
      && preset.navigationScenes.some((n) => n.sceneId === item.toSceneId) && scene?.targetIds.includes(item.toTargetId)
      && !answerProblem(index, target?.id, target?.overviewAnswerId) && item.sourceIds?.length > 0
      && item.sourceIds.every((id) => index.sources.has(id));
  });
}

export function transition(state, action, index, preset = index.testPresets.get(state.presetId)) {
  const scene = index.scenes.get(state.sceneId);
  if (!scene || !preset) return state;
  const clear = { ...state, targetId: null, questionId: null, answerId: null, point: null, entryOrigin: null, error: null, comparisonCaseId: null, comparisonOptionId: null };
  const inputComparison = comparisonForScene(state, preset, index);
  const currentComparison = state.comparisonCaseId === preset.comparisonCaseId ? index.comparisonCases.get(state.comparisonCaseId) : null;
  const moveTo = (sceneId) => {
    const navigation = preset.navigationScenes.find((n) => n.sceneId === sceneId);
    return navigation ? { ...clear, sceneId, contextKey: navigation.contextKey, cardVisible: navigation.cardVisible } : null;
  };
  const openAnswer = (targetId, answerId, questionId = null, origin = state.entryOrigin, destination = state) => {
    if (!index.scenes.get(destination.sceneId)?.targetIds.includes(targetId)) return state;
    const error = answerProblem(index, targetId, answerId, questionId);
    return { ...destination, targetId, answerId: error ? null : answerId, questionId, entryOrigin: origin, screen: error ? 'E' : 'A', error };
  };
  switch (action.type) {
    case 'view': return { ...clear, screen: 'V' };
    case 'home': return { ...clear, screen: 'H' };
    case 'compare': return state.screen === 'V' && inputComparison ? { ...clear, screen: 'C', comparisonCaseId: inputComparison.id } : state;
    case 'choose-candidate': {
      if (state.screen !== 'C' || !currentComparison || !canRestore(state, preset, index)) return state;
      const option = currentComparison.options.find((o) => o.id === action.optionId);
      const destination = option && moveTo(option.referenceSceneId);
      const target = index.targets.get(option?.targetId);
      return destination && target ? openAnswer(target.id, target.overviewAnswerId, null, 'candidate', { ...destination, comparisonCaseId: currentComparison.id, comparisonOptionId: option.id }) : state;
    }
    case 'compare-again': {
      if (!currentComparison || !canRestore(state, preset, index)) return state;
      const destination = moveTo(currentComparison.inputSceneId);
      return destination ? { ...destination, screen: 'C', comparisonCaseId: currentComparison.id, comparisonOptionId: state.comparisonOptionId } : state;
    }
    case 'no-candidate': return state.screen === 'C' && currentComparison ? { ...clear, screen: 'E', comparisonCaseId: currentComparison.id, error: 'no-candidate' } : state;
    case 'retry-comparison-photo': {
      if (!currentComparison || !canRestore(state, preset, index)) return state;
      const destination = moveTo(currentComparison.inputSceneId);
      return destination ? { ...destination, screen: 'V', comparisonCaseId: currentComparison.id } : state;
    }
    case 'new-explore': return ['A', 'Q', 'E'].includes(state.screen) ? { ...state, screen: 'N' } : state;
    case 'choose-scene': {
      if (state.screen !== 'N') return state;
      const destination = explorationScenes(state, preset, index).find((n) => n.sceneId === action.sceneId);
      return destination ? { ...clear, screen: 'V', sceneId: destination.sceneId, contextKey: destination.contextKey, cardVisible: destination.cardVisible } : state;
    }
    case 'open-continuation': {
      if (state.screen !== 'A') return state;
      const item = availableContinuation(state, preset, index);
      if (!item || item.id !== action.continuationId) return state;
      const destination = moveTo(item.toSceneId), target = index.targets.get(item.toTargetId);
      return destination ? openAnswer(target.id, target.overviewAnswerId, null, 'continuation', destination) : state;
    }
    case 'point': {
      if (inputComparison) return state;
      if (!action.point || ![action.point.x, action.point.y].every((n) => Number.isFinite(n) && n >= 0 && n <= 1)) return state;
      const targetId = hitTarget(scene, action.point);
      return { ...clear, screen: 'V', point: action.point, targetId, entryOrigin: 'photo', error: targetId ? null : 'unsupported-part' };
    }
    case 'text-target': return !inputComparison && scene.targetIds.includes(action.targetId) ? { ...clear, screen: 'V', targetId: action.targetId, entryOrigin: 'text' } : state;
    case 'confirm': {
      if (inputComparison) return state;
      const target = index.targets.get(state.targetId);
      return target ? openAnswer(target.id, target.overviewAnswerId) : state;
    }
    case 'whole': {
      if (inputComparison) return state;
      const target = index.targets.get(scene.wholeTargetId);
      return target ? openAnswer(target.id, target.overviewAnswerId, null, 'whole') : state;
    }
    case 'questions': return state.targetId && reviewedQuestions(index, state.targetId).length ? { ...state, screen: 'Q', error: null } : state;
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
  if (!state || state.presetId !== preset.id || !['H', 'V', 'A', 'Q', 'E', 'N', 'C'].includes(state.screen)) return false;
  const start = preset.navigationScenes.find((n) => n.sceneId === preset.sceneId);
  if (start?.contextKey !== preset.contextKey || start?.cardVisible !== preset.cardVisible) return false;
  const navigation = preset.navigationScenes.find((n) => n.sceneId === state.sceneId);
  if (!navigation || state.contextKey !== navigation.contextKey || state.cardVisible !== navigation.cardVisible) return false;
  const scene = index.scenes.get(state.sceneId);
  if (!scene) return false;
  if (state.comparisonCaseId !== null) {
    const comparison = index.comparisonCases.get(state.comparisonCaseId);
    if (state.comparisonCaseId !== preset.comparisonCaseId || comparison?.reviewStatus !== 'reviewed') return false;
    const option = comparison.options.find((o) => o.id === state.comparisonOptionId);
    const input = state.screen === 'C' || state.screen === 'V' || state.error === 'no-candidate';
    if (input) {
      if (state.sceneId !== comparison.inputSceneId || state.targetId !== null || state.questionId !== null || state.answerId !== null || state.point !== null || state.entryOrigin !== null) return false;
      if (state.screen === 'C') return state.error === null && (state.comparisonOptionId === null || !!option);
      return state.comparisonOptionId === null && ((state.screen === 'V' && state.error === null) || (['E', 'N'].includes(state.screen) && state.error === 'no-candidate'));
    }
    if (!option || option.targetId !== state.targetId || option.referenceSceneId !== state.sceneId || state.entryOrigin !== 'candidate' || state.point !== null) return false;
  } else if (state.comparisonOptionId !== null || state.screen === 'C') return false;
  if (state.comparisonCaseId === null && comparisonForScene(state, preset, index) && !['H', 'V'].includes(state.screen)) return false;
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
