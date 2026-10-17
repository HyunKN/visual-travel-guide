import './style.css';
import './app-design.css';
import './glass.css';
import './browse.css';
import fontLicenseUrl from './fonts/LICENSE.txt?url';
import { browsePreset, searchTargets } from './browse.js';
import { bindGlassOptics } from './glass-optics.js';
import { bindScrollIndicator } from './scroll-indicator.js';
import { validateContent, indexContent, configurePreset, fitImage, pointInImage, reviewedQuestions } from './content.js';
import { initialState, transition, canRestore, explorationScenes, comparisonForScene, availableContinuation } from './state.js';
import { takePhotoSnapshot, animateScreen, bindPressFeedback, motionEnabled, setMotionPreference } from './motion.js';

const app = document.querySelector('#app');
const base = import.meta.env.BASE_URL;
const escape = (value = '') => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const icon = (name) => {
  const paths = {
    back: '<path d="m14 6-6 6 6 6"/>',
    arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    look: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
    home: '<path d="m3 10 9-7 9 7v10h-6v-6H9v6H3Z"/>',
    change: '<path d="M4 8h15l-4-4M20 16H5l4 4"/>',
    menu: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    camera: '<path d="M4 7h4l2-3h4l2 3h4v13H4Z"/><circle cx="12" cy="13" r="4"/>',
  };
  return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? ''}</svg>`;
};
// Original silhouette: two swept roofs above Gwanghwamun's three archways.
const gateLogo = `<svg class="gate-logo" viewBox="0 0 80 64" aria-hidden="true">
  <path d="M8 41h64v19H8Z" fill="#e4e5e7" stroke="#343d4c" stroke-width="1.5"/>
  <path d="M18 60V51a5 5 0 0 1 10 0v9m6 0V49a6 6 0 0 1 12 0v11m6 0V51a5 5 0 0 1 10 0v9" fill="#fff" stroke="#343d4c" stroke-width="1.6"/>
  <path d="M17 28h46v11H17Zm6-17h34v12H23Z" fill="#8c3f39"/>
  <path d="M20 29v9m10-9v9m10-9v9m10-9v9m10-9v9M26 12v10m14-10v10m14-10v10" stroke="#b76150" stroke-width="3"/>
  <path d="M12 9q8 4 15-5h26q7 9 15 5l-5 9H17Z" fill="#263345"/>
  <path d="M5 24q9 6 17-3h36q8 9 17 3l-6 11H11Z" fill="#263345"/>
  <path d="M16 18h48M10 35h60" stroke="#8c3f39" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M27 4h26M22 21h36" stroke="#6f7c8f" stroke-width="2" stroke-linecap="round"/>
  <path d="M6 41h68M6 61h68" stroke="#343d4c" stroke-width="2" stroke-linecap="round"/>
  <path d="M36 28h8v5h-8Z" fill="#d7b96f"/>
</svg>`;
const brand = `${gateLogo}<span>궁금한 궁</span>`;
let data, index, activeIndex, preset, state, runId;
let imageReady = false, imageFailed = false, zoomed = false, expandedTargets = false, imageRetry = 0, navObserver;
let fault = 'none', invalidUrl = false, observer;
let textScale = 'normal';
let glassMode = 'auto';
let homeDesign = 'photo', disposeStory, disposePress, disposeOptics, disposeScrollIndicator, storyGeneration = 0;
let restoring = false, restoreGeneration = 0;

function rememberView() {
  if (!state || restoring || location.hash === '#test' || history.state?.runId !== runId) return;
  const scroller = app.querySelector('.photo-scroll');
  const focused = document.activeElement;
  const attribute = ['data-action', 'data-target', 'data-question', 'data-scene', 'data-option', 'data-continuation', 'data-result', 'id'].find((name) => focused?.hasAttribute(name));
  const ui = { y: window.scrollY, zoomed, expandedTargets, photoX: scroller?.scrollLeft ?? 0, photoY: scroller?.scrollTop ?? 0,
    focus: attribute ? { attribute, value: focused.getAttribute(attribute) } : null,
    details: [...app.querySelectorAll('details[open]')].map((d) => d.className) };
  history.replaceState({ ...history.state, runId, state, ui }, '', urlFor(preset));
}

function restoreView(ui = {}) {
  const nonnegative = (n) => Number.isFinite(n) ? Math.max(0, n) : 0;
  const generation = ++restoreGeneration;
  restoring = true;
  zoomed = ui.zoomed === true; expandedTargets = ui.expandedTargets === true;
  render({ focus: false, snapshot: null });
  for (const detail of app.querySelectorAll('details')) detail.open = Array.isArray(ui.details) && ui.details.includes(detail.className);
  requestAnimationFrame(() => {
    if (generation !== restoreGeneration) return;
    const scroller = app.querySelector('.photo-scroll');
    if (scroller) { scroller.scrollLeft = nonnegative(ui.photoX); scroller.scrollTop = nonnegative(ui.photoY); }
    const allowed = ['data-action', 'data-target', 'data-question', 'data-scene', 'data-option', 'data-continuation', 'data-result', 'id'];
    const focus = allowed.includes(ui.focus?.attribute) ? [...app.querySelectorAll(`[${ui.focus.attribute}]`)].find((el) => el.getAttribute(ui.focus.attribute) === ui.focus.value) : null;
    (focus ?? app.querySelector('h1') ?? app.querySelector('main'))?.focus({ preventScroll: true });
    window.scrollTo(0, nonnegative(ui.y));
    restoring = false;
    rememberView();
  });
}

function urlFor(p, test = false) {
  const url = new URL(location.href);
  url.search = '';
  url.searchParams.set('preset', p.id);
  url.searchParams.set('context', p.contextKey);
  url.searchParams.set('card', p.cardVisible ? '1' : '0');
  url.searchParams.set('design', homeDesign);
  url.hash = test ? 'test' : '';
  return url;
}

function startRun(nextPreset) {
  restoreGeneration++; restoring = false;
  preset = browsePreset(index, nextPreset);
  runId = crypto.randomUUID();
  state = initialState(preset);
  zoomed = false; expandedTargets = false; imageRetry = 0;
  history.replaceState({ runId, state, depth: 0 }, '', urlFor(preset));
  render();
}

function configureFault(value) {
  fault = value;
  activeIndex = indexContent(structuredClone(data));
  if (value === 'missing-answer') for (const answer of activeIndex.answers.values()) answer.shortText = '';
  if (value === 'missing-source') activeIndex.sources.clear();
}

function dispatch(action) {
  const snapshot = takePhotoSnapshot(app, action.type === 'card' ? '.curiosity-card img' : undefined);
  const next = transition(state, action, activeIndex, preset);
  if (next === state) return;
  restoreGeneration++; restoring = false;
  rememberView();
  const sameScreen = ['point', 'text-target'].includes(action.type) || (next.screen === state.screen && next.sceneId === state.sceneId && next.targetId === state.targetId && next.answerId === state.answerId && next.questionId === state.questionId);
  if (next.sceneId !== state.sceneId) { zoomed = false; expandedTargets = false; imageRetry = 0; }
  state = next;
  const replace = ['point', 'text-target', 'search-query'].includes(action.type);
  const depth = (history.state?.depth ?? 0) + (replace ? 0 : 1);
  history[replace ? 'replaceState' : 'pushState']({ runId, state, depth }, '', urlFor(preset));
  render({ focus: !sameScreen, snapshot: sameScreen ? null : snapshot });
  rememberView();
  if (['point', 'text-target'].includes(action.type)) {
    const preview = app.querySelector('.selection-title');
    if (preview) { preview.tabIndex = -1; preview.focus(); }
  }
}

function shell(content, title, home = false) {
  const nav = state && location.hash !== '#test';
  const tab = state?.screen === 'H' ? 'home' : state?.screen === 'S' ? 'search' : state?.navTab;
  const headerTitle = state?.screen === 'N' ? '사진으로 찾기' : state?.screen === 'S' ? '검색' : title;
  return `<div class="app-shell ${home ? 'home-shell' : ''}"><header class="topbar">${home ? `<div class="brand">${brand}</div><button class="icon-button glass" data-action="menu" aria-label="메뉴">${icon('menu')}</button>` : `<button class="icon-button glass" data-action="back" aria-label="뒤로가기">${icon('back')}</button><span class="topbar-title">${escape(headerTitle)}</span><button class="icon-button glass" data-action="${state?.screen === 'S' ? 'new-explore' : 'search'}" aria-label="${state?.screen === 'S' ? '사진으로 찾기' : '검색 열기'}">${icon(state?.screen === 'S' ? 'camera' : 'look')}</button>`}</header><main id="main" tabindex="-1" aria-label="${escape(title)}">${content}</main><footer class="app-footer"><span class="red-dot" aria-hidden="true"></span>준비된 사진과 설명을 사용하는 프로토타입</footer>${nav ? `<nav class="bottom-nav glass" aria-label="하단 탐색">${[['home', 'home', '홈'], ['search', 'look', '검색'], ['new-explore', 'camera', '사진으로 찾기']].map(([action, name, label]) => `<button data-action="${action}" ${tab === (action === 'new-explore' ? 'photo' : action) ? 'aria-current="page"' : ''}>${icon(name)}<span>${label}</span></button>`).join('')}</nav><div class="scroll-position" aria-hidden="true"><div class="scroll-position-thumb glass"></div></div>` : ''}
  <dialog class="design-menu" aria-labelledby="design-menu-title"><div class="menu-heading"><h2 id="design-menu-title">화면 둘러보기</h2><button class="icon-button" data-action="close-menu" aria-label="메뉴 닫기">×</button></div><p>같은 흐름을 두 가지 화면으로 살펴보세요.</p><div class="design-options"><button data-design="story" aria-pressed="${homeDesign === 'story'}">1안 · 3D 궁궐</button><button data-design="photo" aria-pressed="${homeDesign === 'photo'}">2안 · 사진 두 개</button></div><label class="check-label motion-choice"><span>움직임 효과</span><input type="checkbox" id="motion-effects" ${motionEnabled() ? 'checked' : ''}/></label><p class="form-hint">처음에는 기기의 동작 줄이기 설정을 따라요. 여기서 원하는 쪽으로 바꿀 수 있어요.</p><a class="materials-link" href="./materials.html" target="_blank" rel="noopener noreferrer">색과 버튼 반응 비교 ↗<span class="sr-only"> 새 탭</span></a><a class="materials-link" href="${escape(fontLicenseUrl)}" target="_blank" rel="noopener noreferrer">서체: 스포카 한 산스 · 이용 조건 ↗<span class="sr-only"> 새 탭</span></a><p class="form-hint">준비된 장면을 쓰며 실제 위치나 카메라는 사용하지 않아요.</p></dialog></div>`;
}

function photo({ interactive = false, compact = false, zoomable = interactive } = {}) {
  const scene = index.scenes.get(state.sceneId), asset = index.assets.get(scene.assetId);
  const broken = fault === 'image' ? 'unavailable-photo.jpg' : asset.localPath;
  const src = `${base}${broken}${imageRetry ? `?retry=${imageRetry}` : ''}`;
  const tag = interactive ? 'button' : 'div';
  const credit = comparisonForScene(state, preset, index)
    ? `<details class="photo-credit"><summary>사진 출처 · 이용 조건</summary><p>${escape(asset.creatorCredit)}</p><a href="${escape(asset.sourceUrl)}" target="_blank" rel="noopener noreferrer">원본 출처<span class="sr-only"> (새 탭)</span> ↗</a><a href="${escape(asset.licenseUrl)}" target="_blank" rel="noopener noreferrer">${escape(asset.licenseLabel)}<span class="sr-only"> (새 탭)</span> ↗</a></details>`
    : `<a href="${escape(asset.sourceUrl)}" target="_blank" rel="noopener noreferrer">사진: ${escape(asset.creatorCredit)}<span class="sr-only"> · 공공누리 제1유형, 새 탭</span> ↗</a>`;
  return `<div class="photo-wrap ${compact ? 'compact-photo' : ''}"><div class="photo-scroll"><${tag} class="photo-canvas ${zoomed && zoomable ? 'zoomed' : ''}" style="--ratio:${asset.width}/${asset.height}" ${interactive ? 'type="button" aria-label="사진에서 궁금한 곳 선택" data-photo-tap' : ''}>
    <img class="scene-photo" data-shared-photo src="${escape(src)}" alt="${escape(asset.alt)}" width="${asset.width}" height="${asset.height}" ${compact ? '' : 'fetchpriority="high"'} /><div class="overlay" aria-hidden="true"></div></${tag}></div>
    <div class="image-failure" hidden><p>사진을 불러오지 못했어요.</p><button class="text-button" data-action="retry">사진 다시 불러오기</button><p>${interactive ? '‘글로 대상 고르기’에서도 선택할 수 있어요.' : '사진 출처를 확인하거나 다시 시도해 주세요.'}</p></div>
    ${zoomable ? `<div class="photo-toolbar">${credit}<button class="text-button" data-action="zoom" aria-pressed="${zoomed}">${zoomed ? '전체 크기로 보기' : '사진 확대'}</button></div>` : ''}
  </div>`;
}

function searchForm(home = false) {
  return `<form class="search-form ${home ? 'home-search' : ''}" role="search" aria-label="콘텐츠 검색"><button type="submit" class="search-submit" aria-label="검색 실행">${icon('look')}</button><label class="sr-only" for="search-input">건물이나 궁금한 부분 검색</label><input id="search-input" name="query" type="search" maxlength="120" autocomplete="off" value="${escape(state.query)}" placeholder="${home ? '건물·문양·궁금한 부분 검색' : '건물 이름이나 궁금한 단어'}"/>${home ? `<button class="search-camera" type="button" data-action="new-explore" aria-label="사진으로 찾기">${icon('camera')}</button>` : ''}</form>`;
}

function homeScreen() {
  const card = [...index.cards.values()][0], asset = card && index.assets.get(card.assetId);
  const heroAsset = index.assets.get('photo-geunjeongjeon'), story = homeDesign === 'story';
  return shell(`${invalidUrl ? '<p class="notice">설정을 확인할 수 없어 첫 화면으로 돌아왔어요.</p>' : ''}${fault !== 'none' ? '<p class="notice">오류 복구 리허설 중이에요. 사람 관찰에 사용하지 마세요.</p>' : ''}
    ${searchForm(true)}<section class="home-hero ${story ? 'story-hero' : 'photo-hero'}">
      ${story ? `<div class="palace-stage" role="img" aria-label="경복궁 건축에서 영감을 받은 3D 일러스트"><img class="story-fallback" src="${escape(base + heroAsset.localPath)}" alt=""/><span class="model-note">궁궐을 그린 3D 일러스트</span></div><div class="story-progress" aria-hidden="true"><span></span><span></span><span></span></div><div class="story-controls"><button class="glass story-pause" aria-label="이야기 멈추기">Ⅱ</button><button class="glass story-next" aria-label="다음 장면">${icon('arrow')}</button></div>` : `<img class="hero-photo" data-shared-photo src="${escape(base + heroAsset.localPath)}" alt="${escape(heroAsset.alt)}" width="${heroAsset.width}" height="${heroAsset.height}" fetchpriority="high"/>`}
      <div class="context">눈앞의 궁궐, 조금 더 가까이</div><div class="hero-copy"><h1 tabindex="-1">그냥 지나치기엔<br>궁금한 것들.</h1><p class="home-copy ${story ? 'story-caption' : ''}">이 건물은 어떤 곳일까요?<br>작은 문양에는 어떤 뜻이 담겼을까요?</p>
      <button class="primary glass home-action" data-action="new-explore"><span class="camera-orb">${icon('camera')}</span><span>사진으로 궁금한 곳 알아보기</span>${icon('arrow')}</button></div>
    </section><a class="hero-credit" href="${escape(heroAsset.sourceUrl)}" target="_blank" rel="noopener noreferrer">${story ? '직접 그린 일러스트 · 실제 조사·복원 모형이 아니에요. 사진 출처' : '사진: 국가유산청 궁능유적본부'} ↗<span class="sr-only"> 새 탭</span></a>
    ${card ? `<section class="curiosity"><h2 class="section-label">잠깐, 이런 것도 있어요</h2><button class="curiosity-card" data-action="card" data-card="${escape(card.id)}"><img src="${escape(base + asset.localPath)}" alt="" width="${asset.width}" height="${asset.height}"/><span class="curiosity-text"><span>${escape(card.prompt)}</span><span class="card-link">더 알아보기 ${icon('arrow')}</span></span></button><a class="card-credit" href="${escape(asset.sourceUrl)}" target="_blank" rel="noopener noreferrer">사진: 한국민족문화대백과사전 · 한국학중앙연구원<span class="sr-only"> (새 탭)</span> ↗</a></section>` : ''}<p class="prototype-note">촬영·인식 대신 준비된 사진과 설명으로 둘러봐요.</p>`, '홈', true);
}

function searchResults() {
  const query = state.query.trim(), all = searchTargets(activeIndex, query);
  const results = query ? all : all.filter(r => r.target.kind === 'building');
  return `<p class="result-count" role="status">${query ? `검색 결과 ${results.length}개` : '둘러볼 수 있는 곳'}</p><div class="search-list">${results.map(({ target, sceneId, answer }) => {
    const asset = index.assets.get(index.scenes.get(sceneId).assetId);
    return `<article class="search-item"><button class="search-result" data-result="${escape(target.id)}"><img src="${escape(base + asset.localPath)}" alt="" width="${asset.width}" height="${asset.height}" loading="lazy"/><span><strong>${escape(target.displayName)}</strong><span>${escape(answer.shortText.slice(0, 76))}${answer.shortText.length > 76 ? '…' : ''}</span></span>${icon('arrow')}</button><a class="search-credit" href="${escape(asset.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escape(asset.creatorCredit)} · ${escape(asset.licenseLabel)}<span class="sr-only"> (새 탭)</span> ↗</a></article>`;
  }).join('') || '<section class="search-empty"><h2>아직 준비된 설명이 없어요.</h2><p>다른 단어로 검색하거나 사진에서 찾아보세요.</p><button class="secondary" data-search-photo>사진으로 찾아보기</button></section>'}</div>`;
}

function searchScreen() {
  return shell(`${searchForm()}<div class="screen-heading"><h1 tabindex="-1">무엇이 궁금한가요?</h1><p>이름을 알면 검색하고,<br>이름을 모르면 사진으로 찾아보세요.</p></div><div class="search-topics" aria-label="검색어 예시">${['경회루', '문양', '바닥'].map(word => `<button data-query="${word}">${word}</button>`).join('')}</div><p class="search-scope">준비된 건물·부분 설명 안에서 검색해요.</p><section id="search-results" aria-label="검색 결과">${searchResults()}</section>`, '검색');
}

function bindSearch() {
  const form = app.querySelector('.search-form'), input = form?.elements.query;
  const results = app.querySelector('#search-results');
  const update = () => {
    state = transition(state, { type: 'search-query', query: input.value }, activeIndex, preset);
    rememberView();
    if (results) results.innerHTML = searchResults();
  };
  form?.addEventListener('submit', event => {
    event.preventDefault();
    if (state.screen === 'H') {
      const query = input.value;
      dispatch({ type: 'search' });
      const next = app.querySelector('#search-input');
      next.value = query;
      next.dispatchEvent(new Event('input', { bubbles: true }));
      next.focus();
    } else update();
  });
  if (state.screen !== 'S') return;
  input.addEventListener('input', event => { if (!event.isComposing) update(); });
  input.addEventListener('compositionend', update);
  for (const button of app.querySelectorAll('[data-query]')) button.addEventListener('click', () => {
    input.value = button.dataset.query; update(); input.focus();
  });
  results.addEventListener('click', event => {
    const result = event.target.closest('[data-result]');
    if (result) dispatch({ type: 'open-search-result', targetId: result.dataset.result });
    if (event.target.closest('[data-search-photo]')) dispatch({ type: 'new-explore' });
  });
}

function newExploreScreen() {
  const choices = explorationScenes(state, preset, index);
  return shell(`<div class="screen-heading"><p class="eyebrow">사진으로 찾기</p><h1 tabindex="-1">눈앞의 무엇이<br>궁금한가요?</h1><p>건물 전체도, 작은 문양도 살펴보세요.</p></div><p class="photo-input-note">${icon('camera')}촬영 대신 아래 예시 사진을 골라 체험해요.</p><h2 class="photo-list-title">준비된 사진</h2><div class="explore-list">${choices.map(choice => {
    const scene = index.scenes.get(choice.sceneId), asset = index.assets.get(scene.assetId);
    return `<section class="explore-item"><button class="explore-choice" data-scene="${escape(scene.id)}"><img src="${escape(base + asset.localPath)}" alt="${escape(asset.alt)}" width="${asset.width}" height="${asset.height}" loading="lazy"/><span>${escape(scene.title)} ${icon('arrow')}</span></button><a class="explore-credit" href="${escape(asset.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escape(asset.creatorCredit)} · ${escape(asset.licenseLabel)}<span class="sr-only"> (새 탭)</span> ↗</a></section>`;
  }).join('')}</div>`, '사진으로 찾기');
}

function viewScreen() {
  const scene = index.scenes.get(state.sceneId), target = index.targets.get(state.targetId);
  if (comparisonForScene(state, preset, index)) return shell(`<div class="screen-heading"><p class="eyebrow">사진 속 건물 확인하기</p><h1 tabindex="-1">이 건물은 무엇일까요?</h1><p>사진과 준비된 후보를 비교해 볼 수 있어요.</p></div>${photo({ zoomable: true })}<button class="primary" data-action="compare">이 사진으로 알아보기 ${icon('arrow')}</button><p class="prototype-note">실제 AI 분석 없이 준비된 후보 두 개를 보여드려요.</p>`, '건물 후보 알아보기');
  return shell(`<div class="screen-heading"><p class="eyebrow">사진 속에서 찾아보기</p><h1 tabindex="-1">어디가 궁금한가요?</h1><p>궁금한 곳을 눌러보세요.<br>골라본 뒤에도 다시 바꿀 수 있어요.</p></div>
    ${photo({ interactive: true })}
    <div class="selection" aria-live="polite">${state.error === 'unsupported-part' ? '<p class="selection-title">이 부분은 아직 준비된 설명이 없어요.</p><p>다른 부분을 골라볼 수 있어요.</p><button class="secondary" data-action="view">다시 고르기</button>' : target ? `<p class="selection-kicker">선택한 곳</p><p class="selection-title">${escape(target.neutralLabel)}</p><button class="primary" data-action="confirm">이 부분 알아보기 ${icon('arrow')}</button><button class="text-button" data-action="view">다시 고르기</button>` : '<p class="selection-empty">사진에서 한 곳을 골라주세요.</p>'}</div>
    ${scene.wholeTargetId ? '<button class="secondary whole-action" data-action="whole">건물 전체 알아보기</button>' : ''}
    <div class="text-alternative"><button class="text-button" data-action="targets" aria-expanded="${expandedTargets}" aria-controls="target-list">글로 대상 고르기</button><div id="target-list" ${expandedTargets ? '' : 'hidden'}><p>사진으로 고르기 어렵다면 여기서 선택하세요.</p>${scene.targetIds.map((id) => `<button class="target-row" data-target="${escape(id)}">${escape(index.targets.get(id).neutralLabel)} ${icon('arrow')}</button>`).join('')}</div></div>`, '궁금한 곳 선택');
}

function comparisonScreen() {
  const comparison = activeIndex.comparisonCases.get(state.comparisonCaseId);
  return shell(`<div class="screen-heading"><p class="eyebrow">준비된 후보 비교</p><h1 tabindex="-1">어느 건물과 닮았나요?</h1><p>실제 인식 결과가 아닌 준비된 후보예요. 보이는 특징을 비교해 보세요.</p></div>
    <h2 class="photo-label">알아보는 사진</h2>${photo({ zoomable: true })}
    <div class="comparison-list">${comparison.options.map((option) => {
      const target = index.targets.get(option.targetId), asset = index.assets.get(index.scenes.get(option.referenceSceneId).assetId);
      return `<article class="comparison-option"><p class="photo-label">비교용 사진</p><img class="comparison-reference" src="${escape(base + asset.localPath)}" alt="${escape(asset.alt)}" width="${asset.width}" height="${asset.height}" loading="lazy"/>
        <h2>${escape(target.displayName)}</h2>${state.comparisonOptionId === option.id ? '<p class="previous-choice">이전에 고른 후보</p>' : ''}<ul>${option.clues.map((clue) => `<li>${escape(clue.text)}<span class="clue-sources">${clue.sourceIds.map((id) => activeIndex.sources.get(id)).filter(Boolean).map((source) => `<a href="${escape(source.url)}" target="_blank" rel="noopener noreferrer">특징 근거<span class="sr-only"> · ${escape(source.title)} (새 탭)</span> ↗</a>`).join('') || '근거를 확인할 수 없어요.'}</span></li>`).join('')}</ul>
        <a class="explore-credit" href="${escape(asset.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escape(asset.creatorCredit)} · ${escape(asset.licenseLabel)}<span class="sr-only"> (새 탭)</span> ↗</a>
        <button class="primary" data-option="${escape(option.id)}" aria-label="${escape(target.displayName)} · 이 건물이에요">이 건물이에요 ${icon('arrow')}</button></article>`;
    }).join('')}</div><button class="secondary" data-action="no-candidate">둘 다 아닌 것 같아요</button><button class="text-button" data-action="retry-comparison-photo">사진 다시 보기</button>`, '건물 후보 비교');
}

function answerScreen() {
  const target = index.targets.get(state.targetId), answer = activeIndex.answers.get(state.answerId), q = index.questions.get(state.questionId), asset = index.assets.get(index.scenes.get(state.sceneId).assetId);
  const questions = reviewedQuestions(activeIndex, state.targetId);
  if (!answer) return errorScreen();
  const sources = [...new Map(answer.sourceIds.map((id) => {
    const source = activeIndex.sources.get(id);
    return [source.url, source];
  })).values()];
  return shell(`${photo({ compact: true })}<article class="answer-body"><p class="eyebrow">${state.entryOrigin === 'card' ? '조금 더 들여다보기' : '선택한 곳 알아보기'}</p><h1 tabindex="-1">${escape(target.displayName)}</h1>${q ? `<h2 class="question-heading">${escape(q.label)}</h2>` : ''}<p class="answer-text">${escape(answer.shortText)}</p>
    ${answer.moreText ? `<details class="more-answer"><summary>더 읽기</summary><p>${escape(answer.moreText)}</p></details>` : ''}
    <div class="sources"><p>설명 출처</p>${sources.map((source) => `<a href="${escape(source.url)}" target="_blank" rel="noopener noreferrer">${escape(source.title)}<span class="sr-only"> (새 탭)</span><span aria-hidden="true">↗</span></a>`).join('')}
    <details class="photo-credit"><summary>사진 출처 · 이용 조건</summary><p>${escape(asset.creatorCredit)}</p><a href="${escape(asset.sourceUrl)}" target="_blank" rel="noopener noreferrer">원본 출처<span class="sr-only"> (새 탭)</span> ↗</a><a href="${escape(asset.licenseUrl)}" target="_blank" rel="noopener noreferrer">${escape(asset.licenseLabel)}<span class="sr-only"> (새 탭)</span> ↗</a><p>${escape(asset.capturedAt ?? '촬영일 미상')} · ${escape(asset.modificationNote)}</p></details></div>
    ${state.entryOrigin === 'candidate' ? '<p class="prototype-note">선택한 후보의 비교용 사진과 설명이에요. 처음 사진의 건물로 확정한 것은 아니에요.</p>' : ''}<div class="answer-actions">${questions.length ? `<button class="related-row" data-action="questions">관련 질문 더 보기 ${icon('arrow')}</button>` : '<p class="empty-questions">아직 준비된 추가 질문이 없어요.</p><button class="text-button" data-action="unsupported-question">궁금한 내용이 없어요</button>'}${state.questionId ? '<button class="text-button" data-action="overview">기본 설명으로</button>' : ''}${state.comparisonCaseId ? '<button class="text-button" data-action="compare-again">후보 다시 비교하기</button>' : ''}${index.scenes.get(state.sceneId).regions.length ? `<button class="text-button" data-action="view">${icon('change')}같은 사진에서 다른 부분 보기</button>` : ''}<button class="primary" data-action="new-explore">다른 대상 알아보기 ${icon('arrow')}</button></div>${continuationCard()}</article>`, target.displayName);
}

function continuationCard() {
  const item = availableContinuation(state, preset, activeIndex);
  if (!item) return '';
  const scene = index.scenes.get(item.toSceneId), asset = index.assets.get(scene.assetId), target = index.targets.get(item.toTargetId);
  return `<section class="continuation"><h2>${item.relation === 'nearby' ? '이 근처에서 이어서 볼까요?' : '이런 곳도 살펴보세요'}</h2><p class="form-hint">테스트에서 정한 구역의 예시입니다. 실제 위치 확인·길찾기 기능이 아니에요.</p><button class="continuation-choice" data-continuation="${escape(item.id)}" aria-label="${escape(target.displayName)} 살펴보기"><img src="${escape(base + asset.localPath)}" alt="${escape(asset.alt)}" width="${asset.width}" height="${asset.height}" loading="lazy"/><span class="continuation-name">${escape(target.displayName)}</span><span class="continuation-intro">${escape(item.intro)}</span><span class="card-link">살펴보기 ${icon('arrow')}</span></button><a class="explore-credit" href="${escape(asset.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escape(asset.creatorCredit)} · ${escape(asset.licenseLabel)}<span class="sr-only"> (새 탭)</span> ↗</a>${item.sourceIds.map((id) => `<a class="explore-credit" href="${escape(activeIndex.sources.get(id).url)}" target="_blank" rel="noopener noreferrer">위치·관계 근거: ${escape(activeIndex.sources.get(id).title)}<span class="sr-only"> (새 탭)</span> ↗</a>`).join('')}</section>`;
}

function questionScreen() {
  const target = index.targets.get(state.targetId);
  const questions = reviewedQuestions(activeIndex, target.id);
  return shell(`<div class="screen-heading"><p class="eyebrow">${escape(target.displayName)}</p><h1 tabindex="-1">더 궁금한 게 있나요?</h1><p>준비된 질문 중에서 골라보세요.</p></div>${photo({ compact: true })}<div class="question-list">${questions.length ? questions.map((q) => `<button class="question-row" data-question="${escape(q.id)}">${escape(q.label)}${icon('arrow')}</button>`).join('') : '<p class="empty-questions">아직 준비된 추가 질문이 없어요.</p>'}</div><button class="secondary" data-action="unsupported-question">찾는 질문이 없어요</button><button class="text-button" data-action="overview">기본 설명으로</button>${state.comparisonCaseId ? '<button class="text-button" data-action="compare-again">후보 다시 비교하기</button>' : ''}<button class="text-button" data-action="new-explore">다른 대상 알아보기</button>`, '관련 질문');
}

function errorScreen() {
  if (state.error === 'no-candidate') return shell('<section class="error-content"><h1 tabindex="-1">닮은 건물이 없나요?</h1><p>이번 사진에 준비된 후보가 맞지 않을 수 있어요. 다시 비교하거나 다른 대상을 살펴볼 수 있어요.</p><button class="primary" data-action="compare-again">후보 다시 보기</button><button class="secondary" data-action="retry-comparison-photo">사진 다시 보기</button><button class="text-button" data-action="new-explore">다른 대상 알아보기</button></section>', '해당하는 후보 없음');
  const messages = {
    'unsupported-question': ['이 질문에 대한 설명은 아직 준비되지 않았어요.', '이번에는 준비된 설명과 질문만 볼 수 있어요. 남은 궁금증은 관찰이 끝난 뒤 진행자에게 알려주세요.'],
    'missing-answer': ['설명을 불러올 수 없어요.', '준비된 자료를 확인해야 해요. 다른 부분을 고르거나 홈으로 돌아갈 수 있어요.'],
    'missing-source': ['출처를 확인할 수 없어요.', '근거를 확인하지 못한 설명은 표시하지 않아요. 다른 부분을 고르거나 홈으로 돌아갈 수 있어요.'],
  };
  const [title, text] = messages[state.error] ?? ['이 부분은 아직 준비되지 않았어요.', '다른 부분을 골라보세요.'];
  return shell(`<section class="error-content"><div class="error-symbol" aria-hidden="true">?</div><h1 tabindex="-1">${title}</h1><p>${text}</p>${state.targetId && !state.error?.startsWith('missing') ? '<button class="primary" data-action="overview">기본 설명으로</button>' : ''}${state.comparisonCaseId ? '<button class="secondary" data-action="compare-again">후보 다시 비교하기</button>' : ''}${index.scenes.get(state.sceneId).regions.length ? '<button class="secondary" data-action="view">같은 사진에서 다른 부분 보기</button>' : ''}<button class="secondary" data-action="new-explore">다른 대상 알아보기</button><button class="text-button" data-action="home">홈으로</button></section>`, title);
}

function testScreen() {
  return shell(`<div class="screen-heading"><p class="eyebrow">진행자용 · 관찰 시작 전 설정</p><h1 tabindex="-1">테스트 준비</h1><p>참여자에게는 이 설정 화면을 보여주지 마세요.</p></div><form id="test-form"><label for="preset">준비된 장면</label><select id="preset" name="preset">${data.testPresets.map((p) => `<option value="${p.id}" ${p.id === preset.id ? 'selected' : ''}>${p.id} · ${index.scenes.get(p.sceneId).title}</option>`).join('')}</select><label for="context">방문 맥락</label><select id="context" name="context"><option value="scene" ${state.contextKey !== 'before-visit' ? 'selected' : ''}>구역을 정한 현장 모사</option><option value="before-visit" ${state.contextKey === 'before-visit' ? 'selected' : ''}>방문 전 체험</option></select><label class="check-label"><input id="card" name="card" type="checkbox" ${preset.cardVisible ? 'checked' : ''}/>준비된 호기심 카드 표시</label><p class="form-hint">현재 장면·맥락에 카드가 있을 때만 하나를 보여줘요.</p><label for="text-scale">글자 크기 리허설</label><select id="text-scale" name="textScale"><option value="normal">기본 크기</option><option value="large">200% 글자 크기</option></select><label for="fault">오류 복구 리허설</label><select id="fault" name="fault"><option value="none">정상 · 사람 관찰용</option><option value="image">사진 로드 실패</option><option value="missing-answer">답변 누락</option><option value="missing-source">출처 누락</option></select><p class="form-hint">오류 설정은 사람이 보는 테스트에 몰래 사용하지 않아요.</p><button class="primary" type="submit">새 테스트 시작 ${icon('arrow')}</button></form><p class="version">콘텐츠 ${escape(data.contentVersion)}<br>개인정보·위치·사용 이력을 저장하지 않아요.</p>`, '테스트 준비');
}

function bindPhoto() {
  const img = app.querySelector('.scene-photo'), canvas = app.querySelector('.photo-canvas');
  imageReady = false; imageFailed = false;
  if (!img) return;
  const zoom = app.querySelector('[data-action="zoom"]');
  if (zoom) zoom.disabled = true;
  const loaded = () => { imageReady = true; imageFailed = false; if (zoom) zoom.disabled = false; app.querySelector('.image-failure').hidden = true; canvas.hidden = false; updateOverlay(); };
  const failed = () => { imageFailed = true; imageReady = false; if (zoom) zoom.disabled = true; canvas.hidden = true; app.querySelector('.image-failure').hidden = false; };
  img.addEventListener('load', loaded); img.addEventListener('error', failed);
  if (img.complete) img.naturalWidth ? loaded() : failed();
  observer = new ResizeObserver(updateOverlay); observer.observe(canvas);
  if (canvas.matches('[data-photo-tap]')) canvas.addEventListener('click', (event) => {
    if (event.detail === 0) { expandedTargets = true; render({ focus: false }); app.querySelector('.target-row')?.focus(); return; }
    if (!imageReady || imageFailed) return;
    const rect = canvas.getBoundingClientRect(), asset = index.assets.get(index.scenes.get(state.sceneId).assetId);
    const point = pointInImage(event.clientX - rect.left, event.clientY - rect.top, rect.width, rect.height, asset.width, asset.height);
    if (point) dispatch({ type: 'point', point });
  });
}

function updateOverlay() {
  const overlay = app.querySelector('.overlay'), canvas = app.querySelector('.photo-canvas');
  if (!overlay || !canvas || !imageReady) return;
  const scene = index.scenes.get(state.sceneId), asset = index.assets.get(scene.assetId), rect = canvas.getBoundingClientRect();
  const fit = fitImage(rect.width, rect.height, asset.width, asset.height);
  const regions = state.targetId ? scene.regions.filter((r) => r.targetIds.includes(state.targetId)) : [];
  overlay.innerHTML = regions.map((r) => `<span class="region" style="left:${fit.x + r.x * fit.width}px;top:${fit.y + r.y * fit.height}px;width:${r.width * fit.width}px;height:${r.height * fit.height}px"></span>`).join('') + (state.point ? `<span class="marker" style="left:${fit.x + state.point.x * fit.width}px;top:${fit.y + state.point.y * fit.height}px"></span>` : '');
}

function render({ focus = true, snapshot } = {}) {
  const oldPhoto = snapshot === undefined && focus ? takePhotoSnapshot(app) : snapshot;
  disposeStory?.(); disposeStory = null;
  disposePress?.(); disposeOptics?.(); disposeScrollIndicator?.();
  const generation = ++storyGeneration;
  const previousScroll = app.querySelector('.photo-scroll');
  const photoScroll = previousScroll ? { x: previousScroll.scrollLeft, y: previousScroll.scrollTop } : null;
  observer?.disconnect();
  const isTest = location.hash === '#test';
  app.innerHTML = isTest ? testScreen() : ({ H: homeScreen, S: searchScreen, V: viewScreen, A: answerScreen, Q: questionScreen, E: errorScreen, N: newExploreScreen, C: comparisonScreen }[state.screen] ?? errorScreen)();
  document.title = `${isTest ? '테스트 준비' : app.querySelector('h1')?.textContent.replace(/\s+/g, ' ') ?? '경복궁'} · 궁금한 궁`;
  navObserver?.disconnect();
  const nav = app.querySelector('.bottom-nav');
  if (nav) {
    const reserve = () => document.documentElement.style.setProperty('--nav-height', `${nav.getBoundingClientRect().height}px`);
    navObserver = new ResizeObserver(reserve); navObserver.observe(nav); reserve();
  }
  if (focus) { app.querySelector('h1')?.focus(); window.scrollTo(0, 0); }
  for (const el of app.querySelectorAll('[data-action]')) el.addEventListener('click', () => {
    const type = el.dataset.action;
    if (type === 'menu') { app.querySelector('.design-menu').showModal(); return; }
    if (type === 'close-menu') { app.querySelector('.design-menu').close(); return; }
    if (type === 'back') { rememberView(); if ((history.state?.depth ?? 0) > 0 && location.hash !== '#test') history.back(); else dispatch({ type: 'home' }); return; }
    if ((type === 'home' && state.screen === 'H') || (type === 'new-explore' && state.screen === 'N')) return;
    if (type === 'search' && state.screen === 'S') { app.querySelector('#search-input')?.focus(); return; }
    if (type === 'targets') { expandedTargets = !expandedTargets; render({ focus: false }); app.querySelector('[data-action="targets"]')?.focus(); return; }
    if (type === 'zoom') { zoomed = !zoomed; render({ focus: false }); app.querySelector('[data-action="zoom"]')?.focus(); return; }
    if (type === 'retry') { imageRetry++; render({ focus: false }); return; }
    dispatch({ type, cardId: el.dataset.card });
    if (type === 'search') app.querySelector('#search-input')?.focus();
  });
  for (const el of app.querySelectorAll('[data-target]')) el.addEventListener('click', () => dispatch({ type: 'text-target', targetId: el.dataset.target }));
  for (const el of app.querySelectorAll('[data-question]')) el.addEventListener('click', () => dispatch({ type: 'question', questionId: el.dataset.question }));
  for (const el of app.querySelectorAll('[data-scene]')) el.addEventListener('click', () => dispatch({ type: 'choose-scene', sceneId: el.dataset.scene }));
  for (const el of app.querySelectorAll('[data-option]')) el.addEventListener('click', () => dispatch({ type: 'choose-candidate', optionId: el.dataset.option }));
  for (const el of app.querySelectorAll('[data-continuation]')) el.addEventListener('click', () => dispatch({ type: 'open-continuation', continuationId: el.dataset.continuation }));
  bindSearch();
  app.querySelector('.photo-scroll')?.addEventListener('scroll', rememberView, { passive: true });
  for (const detail of app.querySelectorAll('details')) detail.addEventListener('toggle', rememberView);
  for (const el of app.querySelectorAll('[data-design]')) el.addEventListener('click', () => {
    homeDesign = el.dataset.design;
    startRun(preset);
  });
  app.querySelector('#motion-effects').addEventListener('change', (event) => setMotionPreference(event.target.checked));
  const form = app.querySelector('#test-form');
  if (form) {
    form.querySelector('[type="submit"]').insertAdjacentHTML('beforebegin', '<label for="glass-mode">재질 대체 리허설</label><select id="glass-mode" name="glassMode"><option value="auto">기본 · 지원되는 재질</option><option value="plain">불투명 대체 · 효과 없이 조작 확인</option></select><p class="form-hint">대체 화면 리허설은 실제 Safari나 실기기 검사 결과가 아니에요.</p>');
    form.elements.glassMode.value = glassMode;
    form.insertAdjacentHTML('afterbegin', '<label for="home-design">홈 화면</label><select id="home-design" name="homeDesign"><option value="story">1안 · 3D 궁궐</option><option value="photo">2안 · 사진 두 개</option></select>');
    form.elements.homeDesign.value = homeDesign;
    form.elements.fault.value = fault;
    form.elements.textScale.value = textScale;
    form.elements.preset.addEventListener('change', () => {
      const nextPreset = index.testPresets.get(form.elements.preset.value);
      form.elements.context.value = nextPreset.contextKey === 'before-visit' ? 'before-visit' : 'scene';
      form.elements.card.checked = nextPreset.cardVisible;
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const p = index.testPresets.get(form.elements.preset.value);
      configureFault(form.elements.fault.value);
      homeDesign = form.elements.homeDesign.value;
      textScale = form.elements.textScale.value;
      glassMode = form.elements.glassMode.value;
      document.documentElement.dataset.glassFallback = glassMode === 'plain' ? 'true' : 'false';
      document.documentElement.style.fontSize = textScale === 'large' ? '200%' : '';
      invalidUrl = false;
      startRun(configurePreset(index, p.id, { contextKey: form.elements.context.value === 'before-visit' ? 'before-visit' : p.contextKey === 'before-visit' ? 'gyeonghoeru-area' : p.contextKey, cardVisible: form.elements.card.checked }));
    });
  }
  bindPhoto();
  const contextBadge = app.querySelector('.home-hero .context');
  if (contextBadge) {
    const offset = Math.max(0, contextBadge.getBoundingClientRect().height - 40);
    app.querySelector('.home-hero').style.setProperty('--story-offset', `${offset}px`);
    const stage = app.querySelector('.palace-stage'), copy = app.querySelector('.hero-copy');
    if (stage && copy && parseFloat(getComputedStyle(document.documentElement).fontSize) > 24) {
      const available = copy.getBoundingClientRect().top - stage.getBoundingClientRect().top - 16;
      stage.style.height = `${Math.max(140, Math.min(300, available))}px`;
    }
  }
  // Apply the shared control material consistently across primary actions and navigation.
  app.querySelectorAll('button.primary, button.icon-button').forEach((button) => button.classList.add('glass'));
  disposeScrollIndicator = bindScrollIndicator(app);
  disposePress = bindPressFeedback(app);
  disposeOptics = bindGlassOptics(app);
  if (focus) animateScreen(app, oldPhoto);
  const stage = app.querySelector('.palace-stage');
  if (stage) import('./palace-story.js').then(({ mountPalaceStory }) => {
    if (generation !== storyGeneration || !stage.isConnected) return;
    disposeStory = mountPalaceStory(stage, { pause: app.querySelector('.story-pause'), next: app.querySelector('.story-next'), caption: app.querySelector('.story-caption'), dots: [...app.querySelectorAll('.story-progress span')] });
  }).catch(() => { if (stage.isConnected) stage.dataset.unavailable = 'true'; });
  if (!focus && photoScroll) {
    const scroller = app.querySelector('.photo-scroll');
    if (scroller) { scroller.scrollLeft = photoScroll.x; scroller.scrollTop = photoScroll.y; }
  }
  if (!restoring) rememberView();
}

async function init() {
  try {
    const response = await fetch(`${base}content.json`);
    if (!response.ok) throw new Error('콘텐츠를 읽지 못함');
    data = await response.json();
    const problems = validateContent(data);
    if (problems.length) throw new Error(`자료 무결성: ${problems.join(', ')}`);
    index = indexContent(data); configureFault('none');
    const params = new URLSearchParams(location.search), id = params.get('preset') ?? 'S1';
    homeDesign = params.get('design') === 'story' ? 'story' : 'photo';
    const defaultPreset = data.testPresets[0];
    const selected = index.testPresets.get(id);
    invalidUrl = !selected;
    const selectedPreset = selected ?? defaultPreset;
    const overrides = {};
    const context = params.get('context');
    if (context) {
      overrides.contextKey = context;
    }
    if (params.has('card')) {
      const value = params.get('card');
      if (['0', '1'].includes(value)) overrides.cardVisible = value === '1'; else invalidUrl = true;
    }
    const configured = configurePreset(index, selectedPreset.id, overrides);
    if (!configured) invalidUrl = true;
    const p = browsePreset(index, configured ?? configurePreset(index, selectedPreset.id));
    const test = location.hash === '#test';
    preset = p; state = initialState(p); runId = crypto.randomUUID();
    history.replaceState({ runId, state, depth: 0 }, '', urlFor(p, test));
    history.scrollRestoration = 'manual';
    window.addEventListener('scroll', rememberView, { passive: true });
    app.addEventListener('focusin', rememberView);
    window.addEventListener('popstate', (event) => {
      if (event.state?.runId === runId && canRestore(event.state.state, preset, activeIndex) && location.hash !== '#test') { state = event.state.state; restoreView(event.state.ui); }
      else { state = initialState(preset); zoomed = false; expandedTargets = false; history.replaceState({ runId, state, depth: 0 }, '', urlFor(preset)); render(); }
    });
    window.addEventListener('hashchange', () => { if (location.hash === '#test') render(); });
    render();
  } catch (error) {
    console.error(error);
    app.innerHTML = shell('<section class="error-content"><h1 tabindex="-1">준비된 자료를 불러올 수 없어요.</h1><p>자료를 확인한 뒤 다시 시도해 주세요.</p><button class="primary" id="reload">다시 시도</button></section>', '자료 오류', true);
    app.querySelector('#reload').addEventListener('click', () => location.reload());
  }
}

init();
