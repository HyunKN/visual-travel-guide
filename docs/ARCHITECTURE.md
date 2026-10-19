# 구조와 데이터 흐름

상태: 첫 프로토타입은 정적 자료와 브라우저 메모리 상태를 사용하는 모바일 웹으로 구현했다. [실행·버전·코드 읽는 순서](../prototype/README.md)와 [검증 범위](../prototype/VERIFICATION.md)를 연결한다. 아래 책임은 별도 서버나 패키지가 아니라 작은 ES 모듈로 나뉜다.

## 첫 흐름의 책임과 연결

2026-10-17: `browse.js`의 `browsePreset`은 시나리오의 시작점만 유지하고 검수된 전체6장면을 탐색 가능하게 만든다. `searchTargets`는 이름·중립 라벨·기본 설명·준비된 질문을 로컬 문자열로 검색한다. 검색은 외부 API·LLM이 아니다. state에 S(검색), query, navTab을 추가하고, 검색 결과의 대상·참고 사진·답변 연결 및 history 복원을 검사한다. JSON의 이전 제한 preset은 회귀용 입력이며 실제 앱에서는 그대로 사용하지 않는다.

모바일 shell은 상단 뒤로/검색과 하단 홈/검색/사진 탐색을 제공한다. 이력의 실행 ID·depth와 snapshot을 함께 보관해 앱 내부 뒤로를 복원하고, 이력이 없는 직접 진입은 홈으로 보낸다. 하단 조작부의 실제 높이를 관찰해 확대 글자에서도 본문 아래 공간을 확보한다.

| 책임 | 입력 | 출력 | 지켜야 할 관계 |
| --- | --- | --- | --- |
| 준비된 자료 제공 | 테스트 장면·맥락 | 사진·지원 영역·전체 대상·카드 | 검수된 자료와 개발 fixture 구분 |
| 선택 관리 | 전체/부분 선택, 필요 시 후보 확인 | 선택한 대상 또는 미지원 | 장면·대상 변경 시 관련 질문·답변 초기화 |
| 설명 조회 | 대상·관련 질문 또는 카드 | 명칭·설명·출처 또는 누락 상태 | 대상·질문·답변이 같은 연결을 가리킴 |
| 화면 표시 | 선택·설명·맥락 상태 | 홈·지정·설명·관련 질문·복구 | 표시 규칙은 DESIGN을 따름 |

```text
준비된 장면·대상·설명 자료
  → 홈 → 사진에서 전체/부분 지정 → 필요 시 후보 확인
  → 선택 대상의 기본 설명·출처 → 선택적인 관련 질문·답변
       ↑
  홈의 호기심 카드
```

구현 파일은 [content.js](../prototype/src/content.js)의 `validateContent`·좌표 변환·대상 조회, [state.js](../prototype/src/state.js)의 `transition`·`canRestore`, [main.js](../prototype/src/main.js)의 화면·메모리 이력·복구다. [정적 콘텐츠](prototype/content/content.json)는 Vite `publicDir`에서 제공한다. 자료 계약·좌표·초기화 불변 조건은 [DATA](prototype/DATA.md)를 따른다. 질문 처리 API·데이터베이스·사진 분석 서비스는 없다. 이미지 파일 제공과 질문에 답하는 API를 혼동하지 않는다.

표현 모듈은 [motion.js](../prototype/src/motion.js)의 버튼·사진 이동과 [palace-story.js](../prototype/src/palace-story.js)의 선택적 3D다. 3D는 1안 홈에서만 동적 import하며 콘텐츠의 대상 선택·설명 출처를 변경하지 않는다. 다른 화면으로 이동할 때 pending import의 세대를 확인하고 이미 시작한 RAF·observer·이벤트·GPU 자원을 정리한다. 모형은 장식용 일러스트로, 학습 데이터나 실제 건물 검수의 근거가 아니다.

입력 반응은 [spring.js](../prototype/src/spring.js)의 연속 위치·속도 계산을 사용한다. [glass-map.js](../prototype/src/glass-map.js)는 외곽 14px의 볼록 단면을 SVG gradient 변위 맵으로 만든다. [glass-optics.js](../prototype/src/glass-optics.js)는 작은 조작부의 backdrop에 연결하고 크기 변경 때만 갱신하며 같은 크기의 필터를 공유한다. 유리에는 Canvas·픽셀 버퍼를 사용하지 않는다. 렌더 교체 전 입력 RAF·이벤트와 광학 observer·SVG를 해제한다. 세션의 움직임 설정만 sessionStorage에 저장하며 사용자 관찰 이력은 저장하지 않는다. [재질 비교 화면](../prototype/materials.html)은 별도 Vite 진입점이며 앱의 대상 선택 상태에 연결되지 않는다.

## 구조를 바꿀 때

v2 이동은 [state.js](../prototype/src/state.js)의 `explorationScenes`·`transition`이 허용 목적지 scene/context/card를 함께 선택한다. 후보는 case/option/reference/target, 다음 관람은 `availableContinuation`의 검수·목적지·출처를 함께 검사한다. A→N은 출발 선택을 보존하고 N→V는 초기화한다. 홈은 현재 장면·runId를 유지한다. [main.js](../prototype/src/main.js)의 `rememberView`·`restoreView`는 browser history의 UI snapshot을 runId·`canRestore` 검사 후 복원한다. 화면 ID가 같아도 대상/답변이 달라지면 새 제목으로 포커스·스크롤을 옮긴다. 외부 저장·분석 수집은 추가하지 않았다. 원본·파생본은 [콘텐츠 안내](prototype/content/README.md)를 따른다.

1. 변경할 책임, 입력·출력, 소비자를 적는다.
2. 기존 상태 전환과 설명의 대상 일치 규칙에 미치는 영향을 확인한다.
3. 실제 데이터 전송·보관 또는 외부 서비스가 생기면 경계와 실패 시 동작을 추가한다.
4. 되돌리기 어렵고 대안 간 중요한 절충이 있었던 결정은 맥락·선택·이유를 `docs/adr/NNNN-short-title.md`에 기록한다. 현재 ADR은 없다.

작은 독립 구현 단위는 이 경계를 가로질러 사용자가 확인할 수 있는 흐름으로 나눈다. 관련 용어는 [GLOSSARY](GLOSSARY.md), 동작 판정은 [QUALITY](QUALITY.md)가 기준이다.
