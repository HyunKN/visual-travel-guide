# 개발 문서 안내서

이 문서는 각 개발 문서의 목적, 읽는 순서, 작성·갱신 시점을 안내한다. 프로젝트 규칙의 원본은 이 저장소이며, Wiki는 같은 내용을 탐색하기 쉽게 게시하는 공간으로 사용한다.

## 현재 상태

- Windows에서 iPhone을 무료로 테스트하는 후속 경로는 [iOS 무료 기기 테스트](operations/IOS_FREE_DEVICE_TESTING.md)에 기록했다. 진행 원본은 [#37](https://github.com/HyunKN/visual-travel-guide/issues/37)이며, 사용자가 나중에 재개하기로 한 작업이다.

- 2026-11-04 App 기능의 입구는 [GitHub 기능 지도 #27](https://github.com/HyunKN/visual-travel-guide/issues/27)이다. [개발 경계](design/APP_FEATURE_BOUNDARIES.md)는 책임·입출력을, 기능 이슈 #28~35는 연결·작성된/예정 함수·테스트·완료 조건과 개발 순서를 관리한다.

- 2026-11-06 [App UI 구성 레퍼런스](design/APP_UI_REFERENCE.md), [여섯 화면 HTML](design/app-ui-reference/index.html), [캡처·수정 전후 보고서](design/app-ui-reference/review.html)에 구조·화면 검토와 15개 HTML 검사 결과를 보존했다. 실제 앱의 최종 UI·사용자 승인·기업 앱보다 우수하다는 검증 결과와 구분하며 [#36](https://github.com/HyunKN/visual-travel-guide/issues/36)에 연결한다.

- 2026-11-04 [공통 장소 메시지 구현 설계](design/PLACE_MESSAGES.md)는 리뷰 목록 대신 장소 사진 위 흔적을 발견하는 사용자 방향을 다룬다. [치수·상태 도면](design/place-messages/layout.html), TypeScript 좌표·타입 참고 코드와 검증 결과를 포함한다. 코드의 수학적 확인과 Android UI·실제 공유 검증은 구분한다.

- 2026-10-29: 사용자가 기본 탐색과 기록·흔적 경험을 Sprint 1 안에 연결하도록 요청했다. [Sprint 1 범위·일정 조정안](experiments/sprint1-scope-replan.md)은 잔여 66시간의 산정 가정, 기능 재배치, 위험 판단일, 완료 조건을 담는다. 기존 백로그·양식 6의 변경 검토이며 최종 추정·구현·공유 서비스 선정 완료를 뜻하지 않는다.

- 문서 운영 규칙: 이 문서 묶음에서 정의했다.
- 제품·UI는 프로토타입 기준과 후속 제품 계획을 구분한다. [구조 문서](ARCHITECTURE.md)는 현재 프로토타입 구현과 양식 6 기반 실제 제품 설계 초안을 함께 담는다. 2026-10-23 공식 사진 확보·PC 후보 모델 실행 근거를 연결했으며 제품의 기술 선정·구현·성능 검증 완료를 뜻하지 않는다.
- 앱 코드와 실행 명령: [prototype](../prototype/README.md)의 독립 모바일 웹에 있다. 정적 자료와 메모리 상태로 동작한다.
- Android 제품은 [mobile](../mobile/README.md)에서 개발한다. 장소 선택·설명·공통 사진 쪽지·계정별 기기 저장·Google/네이버 공개 공유·사진 입력·지도/GPS를 연결했다. 기능별 사용자 에뮬레이터 확인과 미확인 항목은 [App 지도 #27](https://github.com/HyunKN/visual-travel-guide/issues/27)에서 구분한다. 실제 모델 연결·실기기 통합·최종 UI 승인은 남아 있다.
- Sprint·전체 계획·실제 개발 결과는 [Sprint·WBS 현황판](operations/SPRINT_PROGRESS.html)에서 함께 본다. 기존 Story·Task·추정·완료 기준을 재사용하며 인수 완료율과 착수율을 구분한다.
- Android 검사 결과는 [읽기용 검증 보고서](operations/ANDROID_VERIFICATION.html)로 확인한다. 원본 `mobile/VERIFICATION.md`가 바뀌면 `python scripts/render_android_verification.py`로 HTML을 다시 생성한다. 변환에는 `markdown-it-py`가 필요하며 새 Android 검사를 실행하는 명령은 아니다.
- 학습용 사진의 파일별 출처·저작자·이용조건·접근 방법과 수집 도구는 사용자 요청으로 Git 제외 내부 자료에 보관한다. 내부 진입점은 `local-assets/datasets/source-registry/INDEX.html`이다. 공개용 문서에는 수집 경계와 익명 집계만 남기며 확보·시각 검수·학습/평가 분할·학습 완료를 구분한다.
- 2026-11-03 [데이터 수집 경계·설계 논의](experiments/data-collection-scope.md)에 사용자 방향, 요소 인식 후 건물 후보를 좁히는 구상, 메모 연결 단위, 수집 자료와 검증 계획을 정리했다. 현판·처마의 지원 목록과 부위별 메모 방식은 미확정이며 기존 백로그·Sprint 완료 상태를 변경하지 않는다.
- 실제 제품 방향: 설치형 Android 앱·기기 내 추론 우선, TypeScript + React Native + Expo를 사용한다. [구조](ARCHITECTURE.md)와 [App 기능 경계](design/APP_FEATURE_BOUNDARIES.md)에 책임을 나눈다. 기록·공유는 구현하고 사용자 에뮬레이터 확인을 받았으며 실제 Android 모델 런타임은 #30, 최종 통합·실기기·관찰은 #35에서 이어간다.
- 제품 데이터: 검수 장소/설명 JSON·공통 사진은 앱에 포함한다. 기기 초안/개인 글은 계정별 SQLite, 인증 세션은 SecureStore, 공개 사본·신고·관리 상태는 Supabase에서 관리한다. [현재 명세](design/APP_SPRINT1_SPEC.md)와 [기기/공개 저장 경계](design/APP_FEATURE_BOUNDARIES.md)를 우선하고 과거 DB 미사용 초안과 구분한다.
- 문서 검사·Wiki 자동 게시: GitHub Actions 설정을 추가했다. 실제 실행 결과와 장애 처리 방법은 [WIKI](WIKI.md)를 확인한다.
- 프로토타입: [검토한 모바일 배치](prototype/UI_LAYOUT_REVIEW.html)에 따라 검색·전체 사진 탐색·후보 비교·설명·다음 관람·공통 이동을 연결했다. 시나리오는 관찰 과제이며 앱을 잠그지 않는다. [검증 기록](../prototype/VERIFICATION.md)의 브라우저·자동 검사와 [세 사용자 테스트 결과](prototype/OBSERVATION_RESULTS.md)의 실제 기록·미검증 사항을 구분한다.
- 기존 웹 프로토타입의 기술 구성은 Vanilla JavaScript + Vite다. 흰 바탕·둥근 UI·기와 먹청색 중심을 적용했다. R01·R02·R03 기록을 분석했으며 발견된 모바일·사용성 문제의 수정 후 검증과 현장 효과는 남아 있다.

## Sprint 제출 문서

- [Sprint 1 Planning 공개본](sprints/SPRINT1_PLANNING.md): 제출용 Planning 6차 작성본의 항목과 표를 옮기고 개인 식별 정보는 제외했다.

## 각 문서는 무엇이고, 언제 쓰는가?

| 문서 | 쉬운 설명 | 처음 쓰는 시점 | 다시 읽고 고치는 시점 |
| --- | --- | --- | --- |
| [PRODUCT · 제품 목표](PRODUCT.md) | 누구를 위해 무엇을 만들고, 이번에는 어디까지 만들지 정하는 문서 | 첫 기능을 설계하기 전 | 목표, 만들 기능, 먼저 할 일이 바뀔 때 |
| [DESIGN · 화면 설계](DESIGN.md) | 화면이 어떻게 보이고, 사용자가 누르거나 선택하면 어떻게 바뀌는지 정하는 문서 | 첫 화면을 설계할 때 | 화면 모습이나 사용 방법을 만들고 바꿀 때 |
| [재질·입력 반응 분류](design/INTERACTION_MATERIALS.md) | Liquid Glass 공식 조사와 재사용 요소·상태·코드 연결 | 공통 조작부를 만들 때 | 재질·hover·누름·전환·접근성 대응을 바꿀 때 |
| [DEVELOPMENT · 개발 순서](DEVELOPMENT.md) | AI와 설계·구현·확인을 어떤 순서로 진행하고 어디에 기록할지 정한 작업 안내서 | 첫 구현을 시작하기 전 | 작업 순서나 기록 방법이 바뀔 때 |
| [THREADS · 채팅 사용 안내](THREADS.md) | 채팅마다 맡을 일과 새 채팅으로 넘겨줄 정보를 정리한 안내서 | 여러 채팅으로 작업하기 전 | 채팅을 나누거나 작업을 넘기는 방법이 바뀔 때 |
| [WIKI · 문서 게시 안내](WIKI.md) | 저장소 문서를 Wiki에 올리고, 게시 결과를 확인하고, 실패하면 다시 올리는 방법 | Wiki 게시를 설정할 때 | 게시 방법이나 문서 위치가 바뀔 때 |
| [QUALITY · 완료 점검표](QUALITY.md) | 무엇을 확인하고 어떤 결과를 남겨야 작업을 끝냈다고 말할 수 있는지 정하는 문서 | 작업의 완료 조건을 정할 때 | 기능을 만들고 확인하거나, 완료 조건이 바뀔 때 |
| [ARCHITECTURE · 프로그램 구조](ARCHITECTURE.md) | 각 개발 파트가 무엇을 맡고 어떤 정보를 서로 주고받는지 설명하는 설계도 | 첫 구현의 구조를 정할 때 | 개발 파트의 역할이나 연결 방식이 바뀔 때 |
| [Sprint 0 자료·모델 실험](experiments/sprint0-recognition.md) | 확보한 사진·후보 모델 실행 결과·재현 환경과 남은 한계. [모바일 웹 실행 조사](experiments/mobile-web-inference-options.md) 연결 | 제품 인식 구조를 선택하기 전 | 자료·모델·전처리·실행 환경을 바꿔 비교할 때 |
| [React Native 구성 선택 조사](experiments/react-native-adoption-research.md) | 실제 개발팀·1인 개발 사례와 Expo·네이티브 추론 연동 위험, 후속 시작 구성 채택 기록 | React 계열 앱 구성을 정하기 전 | 호환 버전·실기기 검증·선택 근거가 달라질 때 |
| [양식 6 데이터·입출력 설계](experiments/form6-data-contract-review.md) | JSON 필드·ID 관계·로컬 함수·취소/복귀 계약의 대안 비교와 1차·2차 설계 검수 | 제품 데이터·호출 계약을 구현하기 전 | 지원 범위·계약·자료 갱신 정책을 바꿀 때 |
| [양식 6 개발 환경 조사](experiments/form6-environment-research.md) | 공식 배포물 기준 버전 조합·빌드 방식 비교와 설치/실행 미확인 경계 | Android 개발 환경을 구성하기 전 | SDK·네이티브 런타임·빌드 도구를 바꿀 때 |
| [GLOSSARY · 용어 사전](GLOSSARY.md) | 프로젝트에서 쓰는 단어와 줄임말의 뜻을 정리한 사전 | 주요 단어의 뜻을 정할 때 | 새 단어가 생기거나 이름·뜻이 바뀔 때 |
| [CODING_STANDARDS · 코드 작성 약속](CODING_STANDARDS.md) | 코드를 작성하고 검토할 때 함께 지킬 약속 | 첫 코드 작성 규칙을 정할 때 | 자주 나온 검토 의견을 공통 약속으로 정할 때 |
| ADR · 설계 결정 기록 (`docs/adr/`) | 여러 방법 중 왜 이 방법을 골랐는지, 어떤 점을 고려했는지 남기는 기록. [ADR 0001 — 쪽지는 공통 장소 사진에 고정](adr/0001-shared-place-photo-anchors.md) | 중요한 설계 방법을 선택할 때 | 그 결정과 관련된 설계를 바꿀 때 |
| [AGENTS · AI 작업 안내](../AGENTS.md) | AI에게 지금 작업에서 어떤 문서를 읽고 어떤 규칙을 지켜야 하는지 안내하는 문서 | 개발 문서를 처음 정리할 때 | AI가 읽어야 할 문서나 문서 위치가 바뀔 때 |
| [Issue tracker · 작업 기록 설정](agents/issue-tracker.md) | AI가 작업을 어느 GitHub Issue에 기록하고 서로 어떻게 연결할지 안내하는 설정 | 스킬을 프로젝트에 연결할 때 | 작업을 기록하는 곳이나 연결 방법이 바뀔 때 |
| [Domain · 용어·결정 문서 위치](agents/domain.md) | AI가 용어 사전과 설계 결정 기록을 어디서 찾고 어떻게 참고할지 안내하는 설정 | 스킬을 프로젝트에 연결할 때 | 용어 사전이나 설계 결정 기록의 위치가 바뀔 때 |

처음에는 PRODUCT → DESIGN → DEVELOPMENT → QUALITY 순으로 읽는다. 이후에는 [AGENTS.md](../AGENTS.md)의 작업별 조건에 따라 필요한 문서만 읽는다. 이 안내서는 문서 추가·이동·역할 변경 때 함께 갱신한다.

사용자에게 직접 읽거나 작성하도록 전달하는 문서는 간단한 HTML로 제공한다. 개발·AI용 명세와 운영 문서는 기존 Markdown 체계를 유지한다.

이번 사용자 요청에 따라 세 테스트의 분석은 HTML을 추가하지 않고 [관찰 결과·Product Backlog 반영 근거](prototype/OBSERVATION_RESULTS.md) 한 문서에 모았다. 빈 기록지·진행 방법과 실제 결과를 구분하며, 결과 문서는 전체 제출용 Product Backlog를 대체하지 않는다.

제품 개발 범위·우선순위를 검토할 때는 [Product Backlog 최신 공개 요약](PRODUCT_BACKLOG_DRAFT.md)을 읽는다. 확정한 Sprint 1 재계획을 반영한 7개 Epic·17개 Story·70 SP와 우선순위·공통 DoD를 관리한다. Sprint 1 상위 12개는 50 SP, Sprint 2는 13 SP, Should 7 SP는 후순위 미배치다. SP는 상대 추정이며 계획·규칙 채택과 제품 구현·AC 통과를 구분한다. 기존 파일명과 Wiki 주소는 유지하고 개인정보가 있는 Word 원본·개별 US 제출 문서는 공개하지 않는다.

양식 6 설계·PC 실험 근거와 이후 실제 Android 연결 검증은 [Sprint 0 이슈](https://github.com/HyunKN/visual-travel-guide/issues/21)에서 추적한다. 설계·조사 완료와 도구 설치·앱 빌드·실기기 검증을 구분하며, 다음 행동·실행 증거는 해당 이슈에서 갱신한다.

양식 6의 그림은 [다이어그램 원본과 미리보기](diagrams/form6-20261025/README.md)에서 확인한다. 논리 아키텍처, 두 핵심 시퀀스, JSON의 논리 ERD와 편집·재생성 원본을 함께 보관한다.

프로토타입 단계의 수행·종료 근거는 [프로토타입 상위 Issue](https://github.com/HyunKN/visual-travel-guide/issues/4), [사람 관찰·백로그 반영 Issue](https://github.com/HyunKN/visual-travel-guide/issues/13), [구현·검증 PR](https://github.com/HyunKN/visual-travel-guide/pull/5)에서 확인한다. Wiki에서는 이 안내서와 익명 관찰 결과·최신 백로그 공개 요약·QA 방법을 탐색할 수 있다. 원본 참여자 기록·개인정보가 있는 제출 보고서는 공개 문서와 게시 대상에 포함하지 않는다. 이후 실제 개발은 최신 백로그에 따라 별도 작업으로 추적하며, 프로토타입 Issue를 계속 확장하지 않는다.

## 프로토타입 설계를 읽을 때

사용자가 직접 읽고 작성할 관찰 문서는 [HTML 테스트 안내와 기록지](prototype/TEST_GUIDE.html)를 사용한다. S1~S5 안내·작성란·HTML 저장·인쇄를 한 문서에 제공한다. 개발 명세와 절차 관리는 기존 Markdown에 유지하며, 사용자용 HTML의 내용도 함께 갱신한다.

보완 사진·질문·구별 단서·다음 관람 연결의 근거는 [P01 자료 준비 묶음](prototype/content-preparation/README.md)에 있다. P02에서 런타임 v2에 병합했다. 진행자 정답·순서는 publicDir 밖의 준비 묶음에 유지한다. P06에서 전체 시나리오·이미지 최적화를 확인한다.

2026-10-16 [보완 개발 설계](prototype/FLOW_EXTENSION_DESIGN.md)의 v2·N·이력·후보·질문·다음 관람을 구현했다. 사람과 실행할 때는 [관찰 실행 안내](prototype/OBSERVATION_RUNBOOK.md)와 [빈 기록지](prototype/OBSERVATION_RECORD.md)를 사용한다. [검증 기록](../prototype/VERIFICATION.md)은 제작자 검사를, [관찰 결과](prototype/OBSERVATION_RESULTS.md)는 제공된 R01·R02·R03 및 보충 설명을 다룬다. 실제 작업 상태는 기존 P Issue에서 관리한다.

[설계 시작점](prototype/README.md)에서 범위를 확인한 뒤 화면 구현은 SCREENS, 자료·상태는 DATA, 관찰은 TESTING, 작업 선택은 TASKS, Sol 인계는 HANDOFF를 읽는다. 기능 상세를 버전 관리하는 부속자료이며 별도의 진행 TODO가 아니다. 발행 전 작업안은 Issue로 옮기고 실제 URL을 연결한다.

시각 설계는 [실제 UI·전통 굿즈 참고](prototype/VISUAL_REFERENCES.md)와 [AI slop 방지·Worst 예시](prototype/ANTI_SLOP.md)를 함께 읽는다. 참고 자료와 제외 사례를 누적하며, 합의한 규칙의 원본은 DESIGN으로 유지한다.

## 기록의 원본

| 기록 | 원본 위치 |
| --- | --- |
| 공통 제품·설계·개발 규칙 | `docs/`의 해당 문서 |
| 버전 관리하는 상세 설계·관찰 절차·인계문 | `docs/prototype/`. 상위 Issue에서 해당 버전을 연결 |
| 기능 명세와 사용자 과업 | GitHub 상위 Issue |
| 작은 구현 단위, 완료 기준, 의존 관계 | GitHub 하위 Issue. 지원하지 않는 도구에서는 Issue 간 링크 |
| 변경 내용, 실행한 검사, 수동 확인, 미확인 사항 | 해당 PR. PR 전에는 작업 완료 보고 |
| 관찰 결과와 개선 우선순위 | 관련 Issue 또는 후속 Issue |
| 문서 열람과 진행 상황 탐색 | Wiki: 원본 문서의 게시본과 Issue·PR 링크 |

진행 상태를 별도의 TODO 문서에 복제하지 않는다. 문서의 기준을 바꾸는 결정은 해당 원본에 반영하고, 배경 Issue·PR이 있으면 연결한다.

2026-11-02 사용자 요청으로 [Sprint·WBS 현황판](operations/SPRINT_PROGRESS.html)을 추가했다. 새 백로그나 독립 WBS 번호를 만드는 대신 기존 계획과 Issue/PR·PR 전 검증 기록을 한 화면에 보여주는 로컬 스냅샷으로 사용한다. 2026-11-04부터 개발현황 채팅에서 개발 스레드 1·2의 최신 기록과 실제 저장소·검증 근거를 대조해 같은 파일의 `progress-data`에 확인일·Task 상태·AC 결과·근거를 갱신한다. 스레드의 설계 결정과 구현·실행 검증을 구분하며 기존 AC와 최신 결정의 차이는 정합성 검토 대상으로 표시한다. 부분 작업에 임의의 완료 퍼센트를 주거나 초기 추정을 실제 잔여 시간으로 바꾸지 않는다. 원격 Issue와 로컬 결과가 다르면 함께 표시하며, 자동 동기화·주기 실행을 구성했다는 뜻이 아니다. 원격 갱신·계획 변경은 기존 운영 규칙과 사용자의 요청 범위를 따른다.

## Wiki 게시

`docs/` 수정 → PR 검토 → main 병합 → Wiki 게시 순서다. 작업 브랜치에서는 같은 브랜치의 문서를 읽는다. Wiki에는 마지막으로 게시된 main 버전이 보인다.

- `docs/README.md`를 Wiki의 Development-Home으로 게시하고, PRODUCT·DESIGN 등 공통 문서를 개별 페이지로 연결한다. 기존 Home과 보고서는 보존하고 개발 문서 입구를 연결한다.
- `AGENTS.md`, `docs/agents/`, PR 양식은 저장소의 운영 파일로 유지한다. Wiki Home에서 필요할 때 원본으로 연결한다.
- 게시본에는 원본 파일 링크와 게시 기준 커밋을 표시한다. Wiki에서 발견한 수정 사항도 저장소 원본에 먼저 반영한다.
- 상대 링크는 Wiki 페이지 링크 또는 커밋 기준 저장소 링크로 변환한다. `_Sidebar.md`에는 게시 대상과 Issue·PR 링크를 표시한다.
- 자동화는 지정된 페이지만 관리하고 기존 Wiki 페이지를 보존한다. 게시 실패 시 직전 게시본을 유지하며, 재시도 방법은 WIKI에 기록한다.

자동 게시의 대상과 검사 명령, 실패 시 처리 방법은 [WIKI](WIKI.md)가 기준이다. 설정 작업과 검증 결과는 [AI Workflow 설정 Issue](https://github.com/HyunKN/visual-travel-guide/issues/1)에 기록한다.

Sprint 1의 제출 기준 계획과 Task·10/31 진행 기록은 [Sprint Planning](sprints/SPRINT1_PLANNING.md)과 [Sprint Backlog](sprints/SPRINT1_BACKLOG.md)에서 확인한다. 공개본은 개인정보를 제외하며 실제 개발 완료와 검증 통과를 의미하지 않는다.
