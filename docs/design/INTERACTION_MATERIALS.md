# 재질·입력 반응·전환의 재사용 기준

조사일: 2026-10-15, 입력 반응 보완 조사: 2026-10-16. 공통 방향은 [DESIGN](../DESIGN.md), 시나리오는 [SCREENS](../prototype/SCREENS.md)가 원본이다. 이 문서는 컴포넌트를 고를 때의 분류, 상태, 구현 연결을 관리한다. Apple 공식 설명과 프로젝트가 정한 수치·웹 근사를 구분한다.

## 1. 공식 자료에서 확인한 내용

| 자료와 확인 방법 | 확인한 핵심 | 적용 판단 |
| --- | --- | --- |
| [Apple HIG · Materials](https://developer.apple.com/design/human-interface-guidelines/materials), 브라우저 본문 열람 | Liquid Glass는 콘텐츠 위의 조작·탐색층이다. Regular는 가독성을 조절하며, Clear는 시각 자료 위에서 사용한다. 밝은 배경 위 Clear에는 35% 어둡게 하는 면을 고려하되 충분히 어두운 배경에서는 필요하지 않을 수 있다. | 사진·해설·홈 배경 전체를 유리로 만들지 않는다. 현재 웹은 Regular의 역할을 참고한 한 가지 재질만 사용한다. |
| [WWDC25 · Meet Liquid Glass](https://developer.apple.com/videos/play/wwdc2025/219/), 공식 transcript의 Dynamics / Adaptivity / Principles 열람 | 빛의 굴절, 배경에 반응하는 명암·그림자, 누른 지점의 발광, 탄성, 접근성 대응이 함께 작동한다. 유리 위 유리를 겹치지 않는다. | blur와 흰 테두리만으로 네이티브 구현을 재현했다고 부르지 않는다. 카메라 아이콘 안의 별도 돌출 면은 제거한다. |
| [Applying Liquid Glass to custom views](https://developer.apple.com/documentation/swiftui/applying-liquid-glass-to-custom-views), 브라우저 본문 열람 | `glassEffect`, `.interactive()`는 touch·pointer 반응을 제공한다. `GlassEffectContainer`와 `glassEffectID`는 여러 유리 형태의 결합·전환을 다룬다. 많은 효과는 성능 부담이 된다. | 입력 반응과 사진 전환을 분리한다. 포인터를 쫓는 조명은 웹 표현 선택이며 Apple의 광학·포인터 계산을 복제한 것이 아니다. |
| [WWDC25 · Build a SwiftUI app with the new design](https://developer.apple.com/videos/play/wwdc2025/323/), 공식 transcript의 Controls / Custom components 열람 | 표준 버튼의 캡슐 형태, 의미가 있는 강조색, 상호작용의 확대·탄성·빛 반응, 조작부와 콘텐츠의 관계를 설명한다. | 둥근 형태는 버튼에 우선 사용한다. 큰 사진까지 같은 캡슐·카드 형태로 통일하지 않는다. |

WWDC의 초기 Clear 설명과 이후 HIG의 어두운 배경 예외를 동일한 절대 규칙으로 기록하지 않는다. 최신 HIG의 조건부 지침을 적용한다. 공식 영상 전체를 재생해 촉감·속도를 측정한 결과가 아니라 본문·transcript 조사다. 네이티브 기기에서의 비교 관찰은 남아 있다.

[WWDC25 Platforms State of the Union](https://developer.apple.com/videos/play/wwdc2025/102/)의 공식 transcript도 확인했다. Apple은 터치할 때 버튼이 위로 부풀고 빛나며 조금 늘어나는 반응을 설명한다. 이번 구현은 이를 참고해 기존 수축을 확대·탄성 복귀로 바꿨다. 아래 배율과 시간은 직접 정한 값이다.

## 2. 재사용 요소 분류

아래 ID는 프로젝트 내 설계 언어다. Apple의 컴포넌트 이름이 아니다.

| ID / 요소 | 쓰는 곳 | 시각·동작 계약 | 현재 구현 |
| --- | --- | --- | --- |
| M01 콘텐츠 면 | 사진, 해설, 3D 배경 | 흰 바탕. 장식용 민트·누런 배경·카드 그림자 없음. 텍스트를 읽을 때 움직이지 않음 | 홈·해설 |
| M02 유리 조작부 | 메뉴, 뒤로, 홈, 재생·다음 | 주변 콘텐츠가 은은하게 통과하는 밝은 면, 얇은 명암 경계, 읽히는 진한 아이콘 | `.glass`, `.icon-button` |
| M03 주요 행동 | 궁금한 부분 알아보기 | 맑은 무채색 유리 면·짙은 남색 라벨·작은 주홍 카메라 아이콘. 아이콘 자체에 또 유리 면을 넣지 않음 | `.primary.glass.home-action` |
| M04 사진 탐색 | 하단 호기심 사진·질문 | 사진은 화면 폭, 글은 20px 안쪽. 사진 하단과 흰 글 영역을 부드럽게 연결. hover해도 사진 전체가 늘어나지 않음 | `.curiosity-card`, `.discovery-icon` |
| I01 포인터 접근 | 마우스로 버튼 위에 올림 | 활성 유리 버튼의 경계·광택 반응. 포인터 이동에 조명 위치 변경. 필수 정보는 hover에 숨기지 않음 | `hover:hover` + `pointer:fine`, `pointermove` |
| I02 누름·복귀 | 터치, 왼쪽 마우스, Space/Enter | 즉시 부풀고 포인터 방향으로 변형, 해제 때 현재 속도를 유지한 감쇠 복귀. 행동은 원래 click으로 실행하며 애니메이션 종료를 기다리지 않음 | `bindPressFeedback` |
| I03 취소·이탈 | pointercancel, 영역 밖 이동, blur | pointerleave는 스프링으로 복귀. pointercancel·blur·설정 변경은 즉시 초기화. 취소를 성공 동작처럼 연출하지 않음 | `bindPressFeedback` |
| I04 키보드 초점 | Tab/Shift+Tab | 외곽선으로 위치 표시. 키보드 초점을 마우스 hover와 혼동하지 않음 | `:focus-visible` |
| T01 사진 연결 | 같은 사진의 선택→설명, 탐색 사진→설명 | 원본 비율 유지, 같은 자산일 때만 위치·크롭 이동. 빠른 재이동 시 이전 overlay 정리 | `takePhotoSnapshot`, `animateScreen` |
| T02 모형 이야기 | 1안 홈 | 정면 중심의 얕은 사선 시작 → 약 2초 뒤 약한 회전 → 가까이 → 다른 모형. 재생·정지·다음 제공. 축약 모형임을 안내 | `mountPalaceStory` |
| T03 메뉴 확장 | 메뉴에서 설정·선택 | 현재는 native dialog의 초점·Escape·닫기. 버튼에서 유리 면이 합쳐지는 morph는 별도 후보 | 미구현 후보, 구현됨으로 표시하지 않음 |

## 3. 입력 상태표

| 상태 | 보이는 피드백 | 실행·복구 규칙 |
| --- | --- | --- |
| 기본 | 차분한 재질·진한 라벨 | 자동 맥동·계속 도는 광택 없음 |
| Hover | 얇은 경계 강조·국소 광택 | mouse/fine pointer에서만 적용. 터치에 hover를 필수로 요구하지 않음 |
| Pressed | 누른 지점 발광·볼록 경계. 긴 버튼 목표 가로 1.04 / 세로 1.12, 원형 1.12. 입력 위치에 따라 추가 변형. 접촉 즉시 작은 변위·속도를 넣어 프레임보다 짧은 탭도 반응 | 오른쪽 클릭은 누름 연출 제외. 콘텐츠 사진은 고정 |
| Released | 현재 위치·속도에서 기본/hover 목표로 감쇠 복귀 | stiffness 340·damping 24·질량 1은 프로젝트 조정값. 고정 ms 시퀀스가 아니라 정지 임계값까지 계산. Apple 측정값·물리 시뮬레이션이 아님 |
| Cancelled / pointerleave / blur | 영역 이탈은 탄성 복귀, 취소·blur는 초기화 | 눌린 채 남지 않음. 스크롤 제스처를 가로채지 않음 |
| Focus-visible | 3px 외곽선, 4px 간격 | Enter/Space로 같은 행동. 초점 표시가 테두리 안에서 잘리지 않음 |
| Disabled | 낮은 강조, 기본 커서 | native `disabled`로 행동 차단. hover·누름 효과 없음 |
| Selected | 문구·`aria-pressed`와 테두리·면 | 일시적 pressed와 지속적 selected를 구분 |
| 동작 줄이기 | 명암 피드백 유지, 확대·탄성·사진 비행 중지 | OS 설정을 기본으로 따르고 메뉴에서 명시적으로 바꾼 값은 해당 탭 sessionStorage에 유지 |
| 투명도 줄이기 / 대비 증가 | 불투명 흰 면·진한 경계 | 대응 media query가 지원되는 브라우저에서 적용. OS 연동은 실기기 검증 필요 |

실제 클릭의 결과와 장식 피드백은 독립적이어야 한다. 짧은 진동이나 소리를 구현했다고 표시하지 않는다. 터치 누름은 진동 효과를 뜻하지 않는다.

## 4. 웹 구현과 네이티브의 차이

| 기능 | 현재 웹 | 네이티브 참고 / 남은 범위 |
| --- | --- | --- |
| 배경 투과·부드러운 경계 | Chromium에서 캡슐 가장자리 변위 맵 + SVG feDisplacementMap을 backdrop-filter에 연결. 다른 엔진은 CSS blur | 단일 2D 변위 근사이며 네이티브 광학·배경 분석과 같지 않음 |
| 배경별 가독성 | 밝은 면·진한 글자, 명시적 fallback | 실시간 배경 분석에 의한 vibrant color·자동 밝기 전환 없음 |
| 입력 빛 | pointer 위치의 CSS radial highlight | 주변 유리에 빛이 전달되는 시스템 없음 |
| 탄성 | 위치·속도를 유지하는 감쇠 스프링 + RAF 비균일 scale/translate | SwiftUI 기본 버튼의 native 물성·haptics가 아님 |
| 형태 결합 | 없음 | `GlassEffectContainer`·`glassEffectID`는 향후 네이티브 구현 검토 시 사용 |
| 접근성 | focus, reduced motion / transparency, contrast / forced colors 대응 | Safari·Android·실제 OS 설정 전파는 별도 검사 |

유리 가장자리에는 얇은 명암 경계와 안쪽 그림자를 사용한다. 지원 엔진에서는 배경 픽셀을 휘는 SVG 변위 필터도 적용한다. 맵은 원형 볼록 단면의 법선과 공기/유리 굴절률 비율을 참고한 2D 근사다. 전체 광선 추적·주변광 반사 계산은 아니다. 흰 배경에는 휘어 보일 무늬가 없으므로 광학 비교는 사진 위 맑은 버튼에서도 수행한다.

제품과 문서에서 현재 결과는 **Liquid Glass 원칙을 참고한 웹 구현**으로 부른다. 네이티브 Liquid Glass 구현 완료, 실제 물방울 시뮬레이션, 자동 가독성 보장을 주장하지 않는다.

## 5. 코드 재사용

재질 원본은 [glass.css](../../prototype/src/glass.css), 광학 원본은 [glass-optics.js](../../prototype/src/glass-optics.js), 스프링 계산은 [spring.js](../../prototype/src/spring.js), 입력·전환 원본은 [motion.js](../../prototype/src/motion.js), 화면 배치는 [app-design.css](../../prototype/src/app-design.css)다. 새 화면에서는 복사한 버튼 CSS를 추가하지 말고 아래 역할을 조합한다.

```html
<button class="glass icon-button" aria-label="메뉴">…</button>
<button class="primary glass">궁금한 부분 알아보기</button>
<div class="glass glass-container">조작 패널 내용</div>
```

렌더링한 DOM에 `bindPressFeedback(root)`와 `bindGlassOptics(root)`를 한 번 연결한다. 반환된 정리 함수를 다음 DOM 교체 전에 호출해 RAF·리스너·observer·SVG를 정리한다. 같은 DOM에 중복 호출하지 않는다. 현재 앱은 화면을 교체한 뒤 새 DOM에 연결한다. `.glass`는 재질만, `.icon-button`과 `.primary`는 크기·배치 역할이다. `.glass`를 설명 문단·사진·페이지 배경에 붙이지 않는다.

| 토큰 / 수치 | 현재 값 | 조정 목적 |
| --- | --- | --- |
| `--glass-fill` | 흰색 alpha .06 | 배경과 분리하면서 약한 투과 |
| 주요 행동 fill | 무채색 `rgb(255 255 255 / .08)` | 사용자가 선호한 맑은 유리, 짙은 라벨과 조합 |
| `--glass-blur` | 2px fallback / SVG 뒤 .25px | 작은 조작부의 배경 세부 완화 |
| `--glass-ink` | `#243247` | 주 행동 포함 남색 글자. 비교용 어두운 면만 흰 글자 |
| `--glass-feedback-ms` | 140ms | 광택의 짧은 응답 |
| 누름 / 복귀 | stiffness 340 / damping 24 | 위치·속도를 유지하며 물방울처럼 복귀 |
| 원형 버튼 | 최소 44×44 CSS px | 프로젝트의 모바일 조작 기준 |

모든 수치는 프로젝트 초기값이다. 실기기 측정 후 조정하며 Apple의 공식 px·ms 기준이라고 인용하지 않는다.

## 6. 홈 두 안의 적용 계약

- **1안:** 흰 화면과 흰 3D 무대가 이어진다. 별도 민트 카드·넓은 유색 그림자를 제거했다. 첫 프레임은 정면 중심의 얕은 사선(-0.18 rad)이다. 자동 움직임이 켜져 있을 때만 잠시 후 깊이를 드러낸다.
- **2안:** 상단 대표 풍경은 근정전, S3 하단 탐색은 십장생 굴뚝이다. 두 사진 모두 화면 폭으로 펼치며 원본 파일을 수정하지 않고 CSS 표시만 조절한다. 출처는 각각 표시한다.
- 상단은 장소를 소개하는 대표 사진이다. 실제 선택 흐름은 진행자의 S1~S3 자료를 유지하므로 주 행동 아래에서 다음 탐색 장면을 안내한다. 대표 사진이 현재 인식·촬영 결과로 오해되지 않게 한다.
- 사진이 다른 경우 T01로 서로 변신시키지 않는다. 해당 사진을 실제로 선택한 것 같은 연출을 피한다.

## 7. 재사용 전 확인

밝은 하늘·어두운 기와·복잡한 문양 위에서 각각 라벨과 초점을 읽을 수 있어야 한다. 마우스 hover → 누름 → 밖으로 이동, 터치 누름 → 스크롤 취소, 키보드 Tab → Space/Enter → Escape를 확인한다. 동작 줄이기에서는 확대 없이 피드백이 남고, 320px·200% 글자에서는 주 행동이 가려지지 않아야 한다.

페이지 전체를 유리로 감싸거나, 광택·그림자·색띠를 반복하거나, 사진을 모두 둥근 타일로 만드는 것은 [ANTI_SLOP](../prototype/ANTI_SLOP.md)의 재검토 대상이다. 자동 검사·화면 확인·실기기 확인은 [검증 기록](../../prototype/VERIFICATION.md)에 각각 남긴다.

## 8. GitHub 구현과 탄성 조사 (2026-10-16)

사용자가 연녹색과 깜빡이는 반응을 지적해 README뿐 아니라 아래 커밋의 실제 소스·LICENSE도 읽었다. 이름이 Liquid Glass인 저장소라도 네이티브 구현과 같다고 판단하지 않는다.

| 자료 / 고정 버전 | 소스에서 확인한 점 | 이번 선택 |
| --- | --- | --- |
| [rdev/liquid-glass-react · index.tsx](https://github.com/rdev/liquid-glass-react/blob/ac48eab18d1f7f444ae30002d240cae29c863a21/src/index.tsx), MIT | 포인터 방향에 따른 비균일 확대와 위치 변형을 별도로 계산. README는 Safari·Firefox의 displacement 미지원 명시 | React 패키지를 도입하지 않고 방향에 따른 변형 원리를 참고. 해당 저장소의 컴포넌트 소스를 앱에 복사하지 않음 |
| [winaviation/liquid-web · 버튼](https://github.com/winaviation/liquid-web/blob/8661faf0ad30ebd66437bab28b1ac209b9ff531f/lg-button-component.js), MIT | 값·목표·속도·강성·감쇠를 가진 스프링과 프레임별 계산. README의 realtime/fixed 시간 차이 | 고정 키프레임 대신 연속 스프링. 우리 코드는 단위 질량 감쇠 진동의 해석식으로 작성하고 긴 프레임 dt를 제한 |
| [DevSam7t3/liquid-glass · spring.ts](https://github.com/DevSam7t3/liquid-glass/blob/3092b5b57f2b8a4253e3bf15a2c7a39e75394d1b/src/spring.ts), MIT | 스프링의 target 변경과 velocity 유지, 정지 임계값. README는 SVG backdrop의 Chromium 제한 명시 | 광학과 운동을 서로 독립된 모듈로 구성. 라이브러리 전체 설치 없음 |
| [kube.io · CSS/SVG 굴절의 원리](https://kube.io/blog/liquid-glass-css-svg/) | 표면 곡선·변위 벡터·SVG 배경 필터·정반사, Chrome 중심 실험의 제약 | 형상별 변위 맵을 크기 변경 때 생성하고 재사용. 실제 사진 원본을 수정하거나 DOM 전체를 복제하지 않음 |
| [Motion · transitions](https://motion.dev/docs/react-transitions) | stiffness/damping/mass 스프링이 기존 속도를 반영함 | 연속 입력과 목표 변경에도 속도를 초기화하지 않는 것이 쫀득한 느낌의 핵심이라고 판단 |

이전 구현의 원인: 누름·해제를 별도 키프레임으로 취소/재시작하고 이탈 때 기본값으로 즉시 돌아갔다. 클릭 후 화면 DOM도 즉시 교체했으며 새 main에 opacity .4→1을 적용했다. 수정은 main의 opacity 전환 제거, 포인터 추종, 연속 스프링, 접촉 즉시 변위·속도 부여다. 실제 이동은 계속 즉시 수행하므로 빠른 주 행동의 복귀 전체를 보이려고 탐색을 지연하지 않는다. 반복 비교는 [materials.html](../../prototype/materials.html)에서 한다.

## 9. 배색 결정 (2026-10-16)

사용자가 색상 방향으로 **기와 먹색·짙은 남색 + 작은 주홍**을 선택했다. 이어 재질 비교 이미지에서 오른쪽 맑은 유리를 선호해 주 행동도 맑은 무채색 면과 남색 글자로 변경했다. 먹청색·적갈색 면은 비교 화면에 유지한다. 연녹색·민트 UI는 제외하며 로고와 모형을 녹색 위주로 만들지 않는다. 실제 사진 속 원래 색은 유지한다. 이 배색은 시각 시안이며 공식 문화유산 색상값이 아니다.

`materials.html`은 동일 사진/흰 배경에서 색과 탄성을 반복 비교하는 검토용 화면이다. 맑은 유리를 흰 배경 위에서만 보고 굴절 품질을 판단하지 않는다. 구현됨·브라우저 표시 확인·실기기 체감/성능 검증은 각각 [검증 기록](../../prototype/VERIFICATION.md)에 남긴다.

## 10. SVG 구현 추가 조사와 다음 검증 (2026-10-16, 변경 전 기록)

상태: 소스·명세 조사 당시의 기록. 이후 적용 결과는 11절을 우선한다. 아래의 9px 띠·이전 filter 좌표계는 교체 전 코드다. 사용자가 현재 재질에서 Liquid Glass를 느끼지 못한다고 지적했다. 필터 URL 연결과 계산 스타일 확인만으로 실제 굴절 표시를 검증했다고 판단하지 않는다.

### 입력 픽셀을 어디서 얻는가

| 방식 | 처리 | 장점과 제약 |
| --- | --- | --- |
| 실제 backdrop + SVG | `backdrop-filter: url(#lens)`가 실제 뒤쪽 렌더를 입력으로 받음 | 뒤 콘텐츠 변화를 자동으로 반영. SVG filter graph의 브라우저별 구현 제약을 확인해야 함 |
| 명시적 사진 복사본 + SVG | 원본 사진과 정렬한 장식 레이어에 `filter: url(#lens)`를 적용. 라벨은 필터 밖 | 임의 DOM의 backdrop 참조를 피함. 사진의 cover crop·위치·스크롤·누름 transform을 일치시켜야 함. 페이지 전체를 자동 복제하는 해결책은 아님 |

[MDN feDisplacementMap](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feDisplacementMap)의 식은 `P(x + scale * (R - .5), y + scale * (G - .5))`다. 따라서 현 구현 `scale=14`는 각 축에서 최대 약 7 CSS px 변위이며 14px 변위를 보장하지 않는다. `filter`는 자신이 그리는 픽셀을, `backdrop-filter`는 뒤의 픽셀을 처리한다. 버튼에 `filter`만 붙이면 배경 대신 글자도 왜곡할 수 있다.

### 실제 소스 비교

| 고정 소스 | 확인한 차이 | 우리 앱에 참고할 부분 |
| --- | --- | --- |
| [Meapri FilterChain](https://github.com/Meapri/liquid-glass-web/blob/1613f8311dbc31bc2331afcfe51a143c56dd6308/src/core/FilterChain.ts), [SurfaceField](https://github.com/Meapri/liquid-glass-web/blob/1613f8311dbc31bc2331afcfe51a143c56dd6308/src/core/SurfaceField.ts) | 명시적 pixel 좌표·padding, blur 후 변위, 별도 specular map을 screen 합성. 내부 띠 경계를 피하려고 연속 표면 기울기를 계산 | 굴절 맵과 반사광 맵을 구분. 선형 테두리 그림자만으로 두께를 표현하지 않음 |
| [LeonardSEO LiquidGlass](https://github.com/LeonardSEO/liquid-glass-react/blob/b857e5cd1ce3daf5599fc9a838364e591aa0c0e5/src/LiquidGlass.tsx) | filter/primitive units와 feImage 크기를 pixel 단위로 명시. RGB별 변위 후 합산을 선택적으로 제공. 라벨·tint·specular 층 분리 | 좌표계 정합을 먼저 확인. 색수차는 필수가 아니라 작은 선택 효과로 취급 |
| [tomagranate core](https://github.com/tomagranate/liquid-glass/blob/efe48923a08c026b77158f3df0317f83571a038d/src/core/liquid-glass.ts) | 실제 backdrop 대신 명시적 배경 복사본에 일반 SVG filter. 작은 렌더 영역과 배경 위치 정렬 관리 | 우리가 관리하는 사진 영역에서 비교할 후보. 라이브 3D canvas·임의 DOM 전체에 동일하게 적용할 수 있다고 추정하지 않음 |

세 저장소는 MIT LICENSE를 확인했다. 소스를 채택할 경우 해당 copyright·license를 보존한다. 이번 조사는 설치·코드 복사·의존성 추가를 하지 않았다. Meapri 공개 데모 페이지는 열어 구성·조작 항목을 확인했으나 굴절 OFF/ON 픽셀 비교나 성능 측정은 하지 않았다. README의 GPU 단일 패스·모든 브라우저 지원 같은 문구는 우리 검증 결과로 전환하지 않는다.

### 현재 코드에서 확인할 점

- 현재 맵은 가장자리 최대 9px 띠에서만 변위를 만들고 중앙은 중립이다. 중앙이 평평한 것 자체가 오류는 아니며 렌즈 표면과 강도를 비교해야 한다. 사인 함수가 띠의 양끝에서 다시 0이 되므로 내부 경계가 보이는지도 확인한다.
- `glass-optics.js`는 0×0 SVG host에 feImage의 width/height를 100%로 두고 filter/primitive units를 명시하지 않는다. 대안들은 pixel 좌표를 명시한다. 현재 맵이 올바르게 해석되는지는 미확인이며 이것을 확정된 장애 원인으로 부르지 않는다.
- 홈 주 버튼은 대표 사진 아래의 흰 영역에 있다. 배경 복사본 방식도 실제 뒤가 흰색이면 사진 굴절을 만들지 않아야 한다. 효과를 보이게 하려고 존재하지 않는 풍경을 버튼 안에 넣지 않는다. 광학 실험은 우선 사진 위 메뉴 버튼 또는 별도 비교 화면에서 한다.
- SVG로 굴절·반사광을 만들 수 있지만 현재 spring의 전체 scale 변화만으로 국소 물방울 변형을 재현하지는 못한다. 윤곽 변형을 넣을 때는 사진 굴절층·하이라이트·clip의 형상을 함께 바꾸고 라벨은 읽을 수 있게 유지한다.

### 브라우저와 검증 순서

[WebKit 245510](https://bugs.webkit.org/show_bug.cgi?id=245510)은 조사 시 NEW이며 SVG backdrop 관련 구현 PR 논의가 있다. PR 존재를 Safari 배포 지원으로 해석하지 않는다. Firefox도 [2018607](https://bugzilla.mozilla.org/show_bug.cgi?id=2018607)은 RESOLVED INCOMPLETE여서 지원 완료 증거가 아니다. 일반 SVG filter 지원과 backdrop 내부의 특정 primitive 지원은 별개다. Chrome/Safari/Firefox 모두 정확한 버전·장치와 결과를 남겨야 한다.

1. 같은 크기·같은 사진 위치에서 OFF / 일반 blur / SVG backdrop / 사진 복사본 SVG를 비교한다. 색과 shadow는 고정한다. 격자와 실제 궁궐 사진을 각각 사용한다.
2. 직선이 유리 경계에서 휘고 글자층은 선명한지 캡처로 확인한다. 좌표계·padding·맵 입력을 명시하고 필터 문자열만으로 통과 처리하지 않는다.
3. 사진 교체·스크롤·리사이즈·누름 확대에서도 복사본이 원본과 어긋나지 않는지 확인한다. 정지 시 지속 RAF나 전체 페이지 복제가 필요한 설계는 피한다.
4. 광학이 확인된 뒤 누름/해제의 표면·반사광·탄성 변화를 결합한다. 짧은 탭·취소·키보드·동작 줄이기와 실제 기기 가독성/프레임을 따로 검사한다.

조사 당시 권고는 **두 SVG 경로를 작은 비교 화면에서 먼저 검증**하는 것이었다. 사진 복사본은 모바일 호환성 후보이며 기본 경로로 확정하지 않았다. 이 조사 단계에서는 앱 화면·버튼 구현을 변경하지 않았다.

## 11. CSS + SVG 볼록 컨테이너 적용 (2026-10-16)

사용자 조건은 볼록 표면, 외곽 14px 곡면, 은은하지만 보이는 굴절, 얇은 테두리 하이라이트와 유리용 Canvas 제외다. [glass-map.js](../../prototype/src/glass-map.js)는 직선 가장자리의 linearGradient와 모서리당 16개 radialGradient 부채꼴로 RGB 변위 맵을 만든다. 원형 단면과 굴절률 1/1.5를 참고한 곡선을 gradient stop으로 근사한다. 평평한 중앙은 중립 RGB 50%이며 외곽에서 안쪽을 샘플링한다. `feDisplacementMap scale=10`이므로 각 축 최대 샘플 변위는 5 CSS px다. 곡면 폭 14px와 변위 5px는 다른 값이다.

[glass-optics.js](../../prototype/src/glass-optics.js)는 `filterUnits`·`primitiveUnits`·`feImage` 크기를 CSS pixel 좌표로 명시하고 `feImage → feComposite → feDisplacementMap`을 실제 backdrop에 연결한다. Canvas·픽셀 버퍼·사진 복제·추가 라이브러리는 사용하지 않는다. 맵 생성은 최초 연결과 ResizeObserver의 크기 변경 때만 수행하며, 같은 폭·높이·radius는 필터를 공유한다. 누름 스프링은 입력 중 별도 RAF로 동작한다. 브라우저의 필터 합성 비용이 사라지는 것은 아니며 실기기 자원 사용량은 미측정이다.

재사용은 `.glass` + 크기/배치 역할 클래스, 패널은 `.glass-container`를 사용한다. 현재 최대 1000×320px의 작은 조작부용이며 큰 페이지 면에는 적용하지 않는다. radius가 14px 이상인 둥근 요소를 권장한다. 작은 radius는 곡면을 radius까지 줄인다. 글자에는 filter를 걸지 않고 실제 뒤쪽 픽셀만 처리한다. 광택과 포인터 하이라이트는 1px 마스크 띠에만 표시한다. 반경의 원형 모서리에서는 16개 부채꼴 근사에 따른 미세한 방향 차이가 있을 수 있다.

현재 경로는 Chromium + URL backdrop 지원 검사로 제한하며 Safari·Firefox는 CSS 기본 유리 재질로 돌아간다. 대비 증가·투명도 줄이기·강제 색상에서는 불투명 면을 우선한다. 기능 검사 통과를 실제 렌더 지원으로 보장하지 않으며 비교 화면의 ON/OFF와 사진·격자로 판별한다. 홈 주 버튼 뒤가 흰색이면 사진 굴절이 생기지 않는 것이 정상이다.

[materials.html](../../prototype/materials.html)의 ‘배경 굴절’은 fill·테두리·하이라이트·그림자는 고정하고 변위만 켜고 끈다. Chromium 화면의 사진/격자 ON/OFF에서 외곽 픽셀 변화와 중앙의 안정성을 확인했다. 상세 환경·검사와 한계는 [검증 기록](../../prototype/VERIFICATION.md)에 남긴다. 이는 네이티브 Liquid Glass 재현 완료나 실기기 성능 검증이 아니다.
