import { answerProblem } from './content.js';

// A scenario selects the starting scene, never the routes available in the app.
export function browsePreset(index, start) {
  const defaults = [...index.testPresets.values()].flatMap(p => p.navigationScenes);
  const navigationScenes = [...index.scenes.values()].map(scene => {
    const navigation = defaults.find(n => n.sceneId === scene.id && n.contextKey !== 'before-visit')
      ?? defaults.find(n => n.sceneId === scene.id);
    return { ...navigation, sceneId: scene.id, selectableInNewExplore: true };
  });
  Object.assign(navigationScenes.find(n => n.sceneId === start.sceneId), { contextKey: start.contextKey, cardVisible: start.cardVisible });
  return { ...start, mode: 'browse', navigationScenes };
}

export function allowsComparison(preset, id, index) {
  return index.comparisonCases.get(id)?.reviewStatus === 'reviewed'
    && (preset.mode === 'browse' || preset.comparisonCaseId === id);
}

const normalize = value => String(value).normalize('NFKC').toLocaleLowerCase('ko').trim();
export function searchTargets(index, query = '') {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  return [...index.targets.values()].filter(target => !answerProblem(index, target.id, target.overviewAnswerId)).flatMap(target => {
    // Search opens a named reference; the unidentified input remains in photo exploration.
    const sceneId = target.sceneIds.find(id => ![...index.comparisonCases.values()].some(c => c.inputSceneId === id));
    if (!sceneId) return [];
    const answer = index.answers.get(target.overviewAnswerId);
    const text = normalize([target.displayName, target.neutralLabel, answer.shortText,
      ...(target.questionIds ?? []).map(id => index.questions.get(id)?.label ?? '')].join(' '));
    return words.every(word => text.includes(word)) ? [{ target, sceneId, answer }] : [];
  });
}
