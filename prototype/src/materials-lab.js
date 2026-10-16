import './style.css';
import './app-design.css';
import './glass.css';
import './materials-lab.css';
import { bindPressFeedback, motionEnabled, setMotionPreference } from './motion.js';
import { bindGlassOptics } from './glass-optics.js';

const root = document.querySelector('#materials');
root.innerHTML = `<header><a href="./">궁금한 궁으로 돌아가기</a><h1>맑은 유리, 14px의 곡면</h1><p>표면은 볼록하게, 가운데는 맑게. 배경의 선이 가장자리에서 어떻게 휘는지 비교해보세요.</p></header>
  <label class="motion-choice"><span>배경 굴절</span><input type="checkbox" id="optics-effects" checked></label>
  <p class="lab-note" id="optics-status" aria-live="polite">SVG 굴절 켜짐 · 곡면 14px · 최대 변위 5px · Canvas 없음</p>
  <section class="optics-scenes" aria-label="배경 굴절 비교">
    <div class="optics-scene optics-grid"><div class="grid-caption" aria-hidden="true">궁의 선을 따라<br>가까이 들여다보기</div><div class="glass glass-container optics-lens"><strong>같은 선, 다른 깊이</strong><span>테두리를 통과하는 선을 살펴보세요</span></div><span class="scene-caption">격자 위에서</span></div>
    <div class="optics-scene optics-photo"><div class="glass glass-container optics-lens"><strong>기와 끝에 머무는 빛</strong><span>가장자리의 사진을 살펴보세요</span></div><span class="scene-caption">근정전 사진 위에서</span></div>
  </section>
  <label class="motion-choice"><span>움직임 효과</span><input type="checkbox" id="motion-effects" ${motionEnabled() ? 'checked' : ''}></label>
  <p class="lab-note">처음에는 기기의 동작 줄이기 설정을 따라요. 켜면 늘어남과 탄성 복귀를 비교할 수 있어요.</p>
  <section class="palette-grid">${[
    ['navy','01 · 기와 먹청','먹색 지붕에서 가져온 짙은 남색. 작은 주홍 포인트와 조합.'],
    ['red','02 · 단청 석간주','기둥의 적갈색을 주 행동에 사용. 배경과 본문은 흰색·무채색.'],
    ['clear','03 · 맑은 유리','면은 투명·무채색, 라벨은 남색. 사진 위에서 굴절을 비교.'],
  ].map(([id,name,copy]) => `<article><div class="lab-scene"><span class="lab-scene-label">사진 위에서</span><button class="primary glass" data-palette="${id}">궁금한 부분 알아보기 <span aria-hidden="true">↗</span></button><button class="glass lab-round" aria-label="${name} 원형 버튼">•••</button></div><h2>${name}</h2><p>${copy}</p><div class="lab-white"><button class="primary glass" data-palette="${id}">궁금한 부분 알아보기 <span aria-hidden="true">↗</span></button></div><p class="lab-note">흰 배경 위에서</p><output aria-live="polite" class="lab-result">눌러서 반응을 확인하세요.</output></article>`).join('')}</section>
  <p class="lab-note">프로토타입 비교용 배색이며 문화유산의 공식 색상값은 아니에요. 사진: 궁능유적본부, 출처는 앱의 대표 사진과 같아요. Safari·Firefox에서는 굴절 대신 기본 유리 재질을 사용해요.</p>`;
document.querySelector('#motion-effects').addEventListener('change', event => setMotionPreference(event.target.checked));
const opticsChoice = document.querySelector('#optics-effects');
const updateOpticsStatus = () => {
  root.dataset.optics = opticsChoice.checked ? 'on' : 'off';
  const lens = root.querySelector('.optics-lens');
  const active = lens.dataset.glassOptics === 'svg-vector' && getComputedStyle(lens).backdropFilter.includes('url(');
  document.querySelector('#optics-status').textContent = !opticsChoice.checked
    ? '굴절 꺼짐 · 색·테두리·하이라이트는 그대로'
    : active ? 'SVG 굴절 켜짐 · 곡면 14px · 최대 변위 5px · Canvas 없음'
      : 'SVG 굴절 미적용 · 브라우저 지원·접근성 설정에 따른 기본 재질';
};
opticsChoice.addEventListener('change', updateOpticsStatus);
for (const button of root.querySelectorAll('button')) button.addEventListener('click', () => {
  const result = button.closest('article').querySelector('output');
  const count = Number(result.dataset.count ?? 0) + 1; result.dataset.count = count;
  result.textContent = `${count}회 눌렀어요. 버튼을 계속 움직여볼 수 있어요.`;
});
// Bounded inspection evidence for this lab only. No analytics or network transmission.
let sampleFrame = 0;
root.addEventListener('pointerdown', event => {
  const button = event.target.closest('button');
  if (!button) return;
  cancelAnimationFrame(sampleFrame);
  const samples = []; let start;
  const record = now => {
    start ??= now;
    samples.push({ ms: Math.round(now - start), transform: button.style.transform || 'none', pressed: button.classList.contains('is-pressed') });
    if (now - start < 950) sampleFrame = requestAnimationFrame(record);
    else { button.dataset.motionSamples = JSON.stringify(samples); sampleFrame = 0; }
  };
  sampleFrame = requestAnimationFrame(record);
});
const disposePress = bindPressFeedback(root), disposeOptics = bindGlassOptics(root);
updateOpticsStatus();
window.addEventListener('pagehide', () => { cancelAnimationFrame(sampleFrame); disposePress(); disposeOptics(); }, { once: true });
