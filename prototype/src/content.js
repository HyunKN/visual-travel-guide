const ID_LISTS = ['scenes', 'targets', 'questions', 'answers', 'sources', 'assets', 'cards', 'testPresets', 'comparisonCases', 'continuations'];
const nonempty = (value) => typeof value === 'string' && value.trim().length > 0;
const webUrl = (value) => {
  try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
};

/** Reject broken content before rendering, including plausible but mismatched answers. */
export function validateContent(data) {
  const errors = [];
  const require = (condition, message) => { if (!condition) errors.push(message); };
  const maps = {};
  require(data?.schemaVersion === 2, '지원하지 않는 schemaVersion (v2 필요)');
  require(nonempty(data?.contentVersion), 'contentVersion 누락');
  for (const key of ID_LISTS) {
    const items = Array.isArray(data?.[key]) ? data[key] : [];
    require(Array.isArray(data?.[key]), `${key} 목록 누락`);
    maps[key] = Object.fromEntries(items.map((item) => [item.id, item]));
    require(items.every((item) => nonempty(item.id)) && new Set(items.map((item) => item.id)).size === items.length, `${key} ID 누락/중복`);
  }
  const belongs = (items, id) => Array.isArray(items) && items.includes(id);
  for (const asset of Object.values(maps.assets)) {
    for (const key of ['alt', 'creatorCredit', 'licenseLabel', 'modificationNote', 'checkedAt']) require(nonempty(asset[key]), `${asset.id}: ${key} 누락`);
    for (const key of ['sourceUrl', 'licenseUrl', 'licenseEvidenceUrl', 'downloadUrl']) require(webUrl(asset[key]), `${asset.id}: ${key} URL 오류`);
    require(nonempty(asset.localPath) && /^assets\/[a-z0-9-]+\.(jpg|webp)$/.test(asset.localPath), `${asset.id}: 자산 경로 오류`);
    require(Number.isInteger(asset.width) && asset.width > 0 && Number.isInteger(asset.height) && asset.height > 0, `${asset.id}: 사진 크기 오류`);
    require(/^[a-f0-9]{64}$/.test(asset.sha256 ?? ''), `${asset.id}: 해시 누락`);
    require(asset.capturedAt === null || /^\d{4}-\d{2}-\d{2}$/.test(asset.capturedAt ?? ''), `${asset.id}: 촬영일 오류`);
    require(nonempty(asset.captureDateNote), `${asset.id}: 촬영일 근거 누락`);
  }
  for (const source of Object.values(maps.sources)) {
    require(webUrl(source.url), `${source.id}: 출처 URL 오류`);
    for (const key of ['title', 'publisher', 'checkedAt', 'claimNote']) require(nonempty(source[key]), `${source.id}: ${key} 누락`);
  }
  for (const scene of Object.values(maps.scenes)) {
    require(!!maps.assets[scene.assetId], `${scene.id}: 사진 없음`);
    require(nonempty(scene.title) && nonempty(scene.areaLabel), `${scene.id}: 장면 설명 누락`);
    require(Array.isArray(scene.targetIds) && scene.targetIds.length > 0, `${scene.id}: 대상 없음`);
    for (const id of scene.targetIds ?? []) require(belongs(maps.targets[id]?.sceneIds, scene.id), `${scene.id}: 대상 ${id} 불일치`);
    require(scene.wholeTargetId === null || (belongs(scene.targetIds, scene.wholeTargetId) && maps.targets[scene.wholeTargetId]?.kind === 'building'), `${scene.id}: 전체 건물 오류`);
    require(Array.isArray(scene.regions), `${scene.id}: 영역 목록 없음`);
    const regions = scene.regions ?? [];
    require(new Set(regions.map((r) => r.id)).size === regions.length, `${scene.id}: 영역 ID 중복`);
    for (const region of regions) {
      require([region.x, region.y, region.width, region.height].every(Number.isFinite) && region.x >= 0 && region.y >= 0 && region.width > 0 && region.height > 0 && region.x + region.width <= 1 && region.y + region.height <= 1, `${scene.id}/${region.id}: 영역 범위 오류`);
      require(Array.isArray(region.targetIds) && region.targetIds.length === 1, `${scene.id}/${region.id}: 부분 대상은 하나여야 함`);
      for (const id of region.targetIds ?? []) require(belongs(scene.targetIds, id) && maps.targets[id]?.kind === 'part', `${scene.id}/${region.id}: 부분 대상 불일치`);
    }
    for (let i = 0; i < regions.length; i++) for (let j = i + 1; j < regions.length; j++) {
      const a = regions[i], b = regions[j];
      const overlap = a.x <= b.x + b.width && b.x <= a.x + a.width && a.y <= b.y + b.height && b.y <= a.y + a.height;
      require(!overlap || a.targetIds?.[0] === b.targetIds?.[0], `${scene.id}: 서로 다른 부분 영역 중첩`);
    }
  }
  for (const target of Object.values(maps.targets)) {
    require(['building', 'part'].includes(target.kind), `${target.id}: 종류 오류`);
    require(nonempty(target.displayName) && nonempty(target.neutralLabel), `${target.id}: 대상명 누락`);
    require(Array.isArray(target.sceneIds) && target.sceneIds.length > 0, `${target.id}: 장면 연결 없음`);
    for (const id of target.sceneIds ?? []) require(belongs(maps.scenes[id]?.targetIds, target.id), `${target.id}: 장면 불일치`);
    require(target.parentTargetId === null || maps.targets[target.parentTargetId]?.kind === 'building', `${target.id}: 부모 건물 오류`);
    const overview = maps.answers[target.overviewAnswerId];
    require(overview?.targetId === target.id && overview?.questionId === null, `${target.id}: 기본 설명 불일치`);
    require(Array.isArray(target.questionIds), `${target.id}: 질문 목록 없음`);
    for (const id of target.questionIds ?? []) require(maps.questions[id]?.targetId === target.id, `${target.id}: 질문 대상 불일치`);
  }
  for (const answer of Object.values(maps.answers)) {
    const target = maps.targets[answer.targetId];
    require(!!target, `${answer.id}: 답변 대상 없음`);
    require(['draft', 'reviewed', 'unsupported'].includes(answer.reviewStatus), `${answer.id}: 검수 상태 오류`);
    if (answer.questionId === null) require(target?.overviewAnswerId === answer.id, `${answer.id}: 개요 역참조 불일치`);
    else {
      const q = maps.questions[answer.questionId];
      require(q?.targetId === answer.targetId && q?.answerId === answer.id, `${answer.id}: 질문 답변 불일치`);
    }
    require(Array.isArray(answer.sourceIds) && answer.sourceIds.length > 0 && answer.sourceIds.every((id) => maps.sources[id]), `${answer.id}: 출처 없음`);
    if (answer.reviewStatus === 'reviewed') require(nonempty(answer.shortText) && nonempty(answer.checkedAt), `${answer.id}: 검수 본문/날짜 누락`);
  }
  for (const q of Object.values(maps.questions)) {
    require(nonempty(q.label) && belongs(maps.targets[q.targetId]?.questionIds, q.id), `${q.id}: 질문 연결 오류`);
    require(maps.answers[q.answerId]?.questionId === q.id && maps.answers[q.answerId]?.targetId === q.targetId, `${q.id}: 답변 연결 오류`);
  }
  const contexts = new Set();
  for (const card of Object.values(maps.cards)) {
    const scene = maps.scenes[card.sceneId], answer = maps.answers[card.answerId];
    require(!contexts.has(card.contextKey), '같은 맥락에 카드 중복');
    contexts.add(card.contextKey);
    require(nonempty(card.prompt) && nonempty(card.contextKey), `${card.id}: 카드 문구/맥락 없음`);
    require(scene?.assetId === card.assetId && belongs(scene?.targetIds, card.targetId), `${card.id}: 카드 장면 불일치`);
    require(answer?.targetId === card.targetId && answer?.questionId === card.questionId && answer?.reviewStatus === 'reviewed', `${card.id}: 카드 답변 불일치`);
  }
  const reviewedOverview = (targetId) => {
    const target = maps.targets[targetId], answer = maps.answers[target?.overviewAnswerId];
    return answer?.targetId === targetId && answer.questionId === null && answer.reviewStatus === 'reviewed' && nonempty(answer.shortText);
  };
  const reviewed = (item) => item.reviewStatus === 'reviewed' && nonempty(item.checkedAt);
  const sourceIdsValid = (ids) => Array.isArray(ids) && ids.length > 0 && ids.every((id) => maps.sources[id]);
  for (const item of Object.values(maps.comparisonCases)) {
    require(!!maps.scenes[item.inputSceneId], `${item.id}: 비교 입력 장면 없음`);
    require(reviewed(item), `${item.id}: 비교 자료 미검수`);
    const options = Array.isArray(item.options) ? item.options : [];
    require(options.length === 2, `${item.id}: 후보는 정확히 2개`);
    require(options.every((o) => nonempty(o.id)) && new Set(options.map((o) => o.id)).size === options.length, `${item.id}: 옵션 ID 누락/중복`);
    require(new Set(options.map((o) => o.targetId)).size === options.length, `${item.id}: 후보 대상 중복`);
    for (const option of options) {
      const reference = maps.scenes[option.referenceSceneId];
      require(reference && reference.id !== item.inputSceneId && belongs(reference.targetIds, option.targetId), `${item.id}/${option.id}: 참고 장면 불일치`);
      require(maps.targets[option.targetId]?.kind === 'building' && reviewedOverview(option.targetId), `${item.id}/${option.id}: 검수 건물 설명 없음`);
      const clues = Array.isArray(option.clues) ? option.clues : [];
      require(clues.length >= 1 && clues.length <= 2 && clues.every((clue) => nonempty(clue.text) && sourceIdsValid(clue.sourceIds)), `${item.id}/${option.id}: 구별 근거 오류`);
    }
  }
  const origins = new Set();
  for (const item of Object.values(maps.continuations)) {
    require(!!maps.targets[item.fromTargetId] && !origins.has(item.fromTargetId), `${item.id}: 출발 대상 없음/중복`);
    origins.add(item.fromTargetId);
    require(item.fromTargetId !== item.toTargetId && belongs(maps.scenes[item.toSceneId]?.targetIds, item.toTargetId) && reviewedOverview(item.toTargetId), `${item.id}: 다음 관람 목적지 오류`);
    require(nonempty(item.intro) && ['nearby', 'related'].includes(item.relation) && sourceIdsValid(item.sourceIds) && reviewed(item), `${item.id}: 다음 관람 근거/검수 오류`);
  }
  for (const preset of Object.values(maps.testPresets)) {
    require(!!maps.scenes[preset.sceneId] && preset.contentVersion === data.contentVersion, `${preset.id}: 설정 장면/버전 오류`);
    require(nonempty(preset.contextKey) && typeof preset.cardVisible === 'boolean', `${preset.id}: 설정 오류`);
    const card = Object.values(maps.cards).find((item) => item.contextKey === preset.contextKey);
    if (preset.cardVisible && card) require(card.sceneId === preset.sceneId, `${preset.id}: 다른 장면 카드`);
    const navigation = Array.isArray(preset.navigationScenes) ? preset.navigationScenes : [];
    require(navigation.length > 0 && new Set(navigation.map((item) => item.sceneId)).size === navigation.length, `${preset.id}: 허용 장면 없음/중복`);
    for (const item of navigation) {
      require(!!maps.scenes[item.sceneId] && nonempty(item.contextKey) && typeof item.cardVisible === 'boolean' && typeof item.selectableInNewExplore === 'boolean', `${preset.id}: 허용 장면 설정 오류`);
      const navCard = Object.values(maps.cards).find((c) => c.contextKey === item.contextKey);
      require(!item.cardVisible || !navCard || navCard.sceneId === item.sceneId, `${preset.id}: 허용 장면 카드 불일치`);
    }
    const start = navigation.find((item) => item.sceneId === preset.sceneId);
    require(start?.contextKey === preset.contextKey && start?.cardVisible === preset.cardVisible, `${preset.id}: 시작 설정과 허용 장면 불일치`);
    const comparison = maps.comparisonCases[preset.comparisonCaseId];
    require(preset.comparisonCaseId === null || (comparison?.inputSceneId === preset.sceneId && Array.isArray(comparison.options) && comparison.options.every((o) => navigation.some((n) => n.sceneId === o.referenceSceneId))), `${preset.id}: 비교 설정 불일치`);
  }
  require(Object.keys(maps.scenes).length > 0 && Object.keys(maps.testPresets).length > 0, '실행할 장면/설정 없음');
  return errors;
}

/** Normalize only the start entry; destinations keep their explicit context/card settings. */
export function configurePreset(index, presetId, overrides = {}) {
  const source = index.testPresets.get(presetId);
  if (!source) return null;
  const preset = structuredClone(source);
  const context = overrides.contextKey ?? preset.contextKey;
  const card = overrides.cardVisible ?? preset.cardVisible;
  const allowedContexts = new Set([source.contextKey, 'before-visit']);
  if (source.sceneId === 'C01') allowedContexts.add('gyeonghoeru-area');
  if (!allowedContexts.has(context) || typeof card !== 'boolean') return null;
  const contextCard = [...index.cards.values()].find((c) => c.contextKey === context);
  if (card && contextCard && contextCard.sceneId !== source.sceneId) return null;
  preset.contextKey = context; preset.cardVisible = card;
  Object.assign(preset.navigationScenes.find((n) => n.sceneId === preset.sceneId), { contextKey: context, cardVisible: card });
  return preset;
}

export function indexContent(data) {
  return Object.fromEntries(ID_LISTS.map((key) => [key, new Map(data[key].map((item) => [item.id, item]))]));
}

export function fitImage(width, height, imageWidth, imageHeight) {
  const scale = Math.min(width / imageWidth, height / imageHeight);
  return { width: imageWidth * scale, height: imageHeight * scale, x: (width - imageWidth * scale) / 2, y: (height - imageHeight * scale) / 2 };
}

export function pointInImage(px, py, width, height, imageWidth, imageHeight) {
  if (![width, height, imageWidth, imageHeight].every((n) => Number.isFinite(n) && n > 0)) return null;
  const fit = fitImage(width, height, imageWidth, imageHeight);
  const x = (px - fit.x) / fit.width, y = (py - fit.y) / fit.height;
  return x >= 0 && x <= 1 && y >= 0 && y <= 1 ? { x, y } : null;
}

export function hitTarget(scene, point) {
  if (!point) return null;
  const ids = new Set(scene.regions.filter((r) => point.x >= r.x && point.x <= r.x + r.width && point.y >= r.y && point.y <= r.y + r.height).flatMap((r) => r.targetIds));
  return ids.size === 1 ? [...ids][0] : null;
}

export function answerProblem(index, targetId, answerId, questionId = null) {
  const answer = index.answers.get(answerId);
  if (!answer || answer.targetId !== targetId || answer.questionId !== questionId || answer.reviewStatus !== 'reviewed' || !nonempty(answer.shortText)) return 'missing-answer';
  if (!answer.sourceIds?.length || answer.sourceIds.some((id) => !webUrl(index.sources.get(id)?.url))) return 'missing-source';
  return null;
}
