const ID_LISTS = ['scenes', 'targets', 'questions', 'answers', 'sources', 'assets', 'cards', 'testPresets'];
const nonempty = (value) => typeof value === 'string' && value.trim().length > 0;
const webUrl = (value) => {
  try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
};

/** Reject broken content before rendering, including plausible but mismatched answers. */
export function validateContent(data) {
  const errors = [];
  const require = (condition, message) => { if (!condition) errors.push(message); };
  const maps = {};
  require(data?.schemaVersion === 1, '지원하지 않는 schemaVersion');
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
      require(Array.isArray(region.targetIds) && region.targetIds.length === 1, `${scene.id}/${region.id}: 후보 비교는 미구현`);
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
  for (const preset of Object.values(maps.testPresets)) {
    require(!!maps.scenes[preset.sceneId] && preset.contentVersion === data.contentVersion, `${preset.id}: 설정 장면/버전 오류`);
    require(nonempty(preset.contextKey) && typeof preset.cardVisible === 'boolean', `${preset.id}: 설정 오류`);
    const card = Object.values(maps.cards).find((item) => item.contextKey === preset.contextKey);
    if (preset.cardVisible && card) require(card.sceneId === preset.sceneId, `${preset.id}: 다른 장면 카드`);
  }
  require(Object.keys(maps.scenes).length > 0 && Object.keys(maps.testPresets).length > 0, '실행할 장면/설정 없음');
  return errors;
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
