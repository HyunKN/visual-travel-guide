# 콘텐츠·상태·구현 경계

상태: 구현 전 계약. 실제 자료·코드·API를 이미 확보했다는 뜻이 아니다. 화면 동작은 [SCREENS](SCREENS.md), 자료 검수와 작업별 산출물은 [TASKS](TASKS.md)를 따른다.

## 1. 첫 구현 제안

- `prototype/` 아래 독립적인 모바일 웹을 만든다. 기존 문서/Wiki용 Python 스크립트와 앱 실행 환경을 섞지 않는다.
- Vanilla JavaScript ES modules + HTML/CSS, 개발 서버는 [Vite](https://vite.dev/guide/)를 작업 P02의 기본 제안으로 삼는다. 공식 문서의 vanilla 구성을 참고하며 실제 설치 버전·Node 요구 버전·lockfile은 구현 시 확인하고 고정한다. 앱 framework, DB, 이미지 모델 SDK는 필요하지 않다.
- 정적 JSON/JS 자료 → 무결성 검증 → 메모리의 선택 상태 → 화면 렌더링으로 연결한다. 외부 API나 서버 저장소가 없다.
- 핵심 검사는 자료 참조 관계와 사용자 행동 경계에 둔다. 기존 앱 테스트는 없다. 상태 전환은 Node의 test runner 등 선택한 도구로, 통합 흐름은 브라우저로 확인한다. 동일 동작을 여러 도구에 중복 작성하지 않는다.
- 계획상 모듈 책임: 자료 로드/검사, 선택·이동 상태, 화면/접근성, 테스트 설정. 처음부터 화면마다 패키지·서비스·저장소를 만들지 않는다.
- P02 완료 시 실제 파일 위치와 작동한 실행·검사 명령을 프로젝트 README에 기록한다. 현재 실행 가능한 앱 명령은 없다.

## 2. 콘텐츠 묶음

| 자료 | 필수 속성 | 규칙 |
| --- | --- | --- |
| Dataset | schemaVersion, contentVersion, scenes, targets, questions, answers, sources, assets | 모든 ID는 종류 안에서 유일. 참조는 존재해야 함 |
| Scene | id, title, areaLabel, assetId, wholeTargetId, regions, targetIds | 하나의 준비된 관찰 장면. 실제 좌표/GPS가 아님 |
| Region | id, targetIds, x, y, width, height | 원본 이미지 기준 0~1 사각형. 범위를 벗어나거나 크기 0이면 잘못된 자료 |
| Target | id, kind, displayName, neutralLabel, sceneIds, parentTargetId, overviewAnswerId, questionIds | kind는 building/part. 부분의 parent는 실제 지원 건물 또는 null |
| Question | id, targetId, label, answerId | 준비된 질문. 같은 문구라도 대상 연결이 다르면 별도 ID |
| Answer | id, targetId, questionId 또는 null, shortText, moreText, sourceIds, reviewStatus, checkedAt | overview는 questionId=null. 질문 답변은 연결된 question과 target 모두 일치 |
| Source | id, title, url, publisher, checkedAt, claimNote | 설명의 어떤 사실을 뒷받침하는지 기록. 기관 홈 링크만으로 대체하지 않음 |
| Asset | id, localPath, alt, width, height, sourceUrl, creatorCredit, licenseLabel, licenseUrl, modificationNote, checkedAt | 원본 출처·표시 의무·재사용 조건을 확인. 해설 이용 조건과 사진 이용 조건은 별개 |
| Card | id, contextKey, sceneId, targetId, questionId 또는 null, answerId, assetId, prompt | 모든 연결이 같은 대상을 가리킴. 맥락당 0~1개 |
| TestPreset | id, sceneId, contextKey, cardVisible, contentVersion | 시나리오 준비용. 사용자가 풀어야 할 정답·개인정보는 넣지 않음 |

`reviewStatus`는 draft/reviewed/unsupported 중 하나. reviewed는 사실·대상·출처 검수를 뜻하며 실기기 동작 통과를 뜻하지 않는다. 설명 본문을 관찰 참여자에게 보일 수 있는 것은 reviewed뿐이다. 개발 fixture는 문화유산 사실을 담지 않는 별도 명시 자료다. 테스트용 잘못된 자료는 관찰용 콘텐츠와 분리한다. JSON이면 주석 대신 필드를 사용한다.

표는 언어에 종속되지 않는 계약이다. 특정 타입 라이브러리나 DB 스키마를 요구하지 않는다. 필수 값이 없을 때 허구의 기본 설명으로 보정하지 않는다.

## 3. 초기 콘텐츠 슬롯과 선정 조건

| 슬롯 | 필요한 장면 | 사용 목적 | 선정 완료 조건 |
| --- | --- | --- | --- |
| C01 | 건물 외관 전체가 보이는 장면 | S1 이름·전체 설명 | 건물 ID·이름·해설 근거, 전체 사진 이용 가능 |
| C02 | 문양 또는 구조물과 주변 건물의 관계가 보이는 장면 | S2 부분 탐색·지정 | 부분이 스마트폰에서도 구별되며 의미/용도 출처 확보 |
| C03 | 처음 보면 지나치기 쉬운 세부 요소가 있는 다른 장면 | S3 호기심 카드 | 앞선 질문의 학습을 피할 다른 대상, 정확한 카드 문구와 설명 |

건물명·부분명은 아직 고정하지 않는다. 문·바닥·돌담·지붕 장식 등은 후보 유형이며 검증된 설명을 확보한 대상만 사용한다. 출처가 부족하면 질문을 사실 확인 가능한 범위로 바꾸거나 그 대상을 제외한다. 공식 명칭이 불명확한 부분에 임의의 전통 용어를 붙이지 않는다.

준비량 제안은 장면 3개 내외, 대상 3~5개, 설명 4~6개다. 장면 수를 채우느라 검수가 끝나지 않은 자료를 넣지 않는다. P01은 C01 하나, P06은 최종 S1~S3 묶음을 담당한다.

### 콘텐츠 검수 순서

1. 문화유산 관리기관·공공기관 등 신뢰할 수 있는 원문에서 **특정 대상의 특정 주장**을 확인한다. 자료의 최신 주소와 접근 여부를 확인한다.
2. 사진의 촬영 위치와 표시한 부분이 설명 대상과 같은지 확인한다. 일반적인 문양 설명을 특정 건물 장식의 의미로 오인하지 않는다.
3. 사진의 저장·수정·크롭·공개 사용 가능 조건과 attribution을 확인한다. 열람 가능하다는 이유만으로 다운로드·배포 가능으로 판단하지 않는다.
4. 원문 장문 복사 대신 근거에 맞는 짧은 설명을 작성하고 claimNote에 사실별 근거를 연결한다. 추정·해석은 그 성격을 표시한다.
5. 검수한 사람 또는 AI의 확인 범위와 날짜를 작업 기록에 남긴다. 공개 자료에 참여자 이름을 넣지 않는다.
6. 사실·대상·출처의 검수가 끝나면 reviewed로 바꾼다. 화면의 영역 크기·구별 가능성·카드와 설명의 대응은 P06 화면 확인과 P07 실기기 검사에서 별도 증거로 남긴다.

자료 확보에 실패한 C02는 P03의 합성 개발 fixture까지는 막지 않지만 S2 관찰 시작을 막는다. 합성 fixture는 `개발용 예시` 표시와 별도 preset으로 관리하고 문화유산 사실·사용자 관찰 성공 증거로 쓰지 않는다.

## 4. 부분 선택 좌표

사진은 잘리지 않는 `contain` 방식으로 보여준다. 영역은 화면 전체나 컨테이너 비율이 아니라 **원본 이미지 비율**로 저장한다.

원본 크기 W×H, 표시 컨테이너 Cw×Ch이면:

```text
scale = min(Cw / W, Ch / H)
renderW = W * scale; renderH = H * scale
offsetX = (Cw - renderW) / 2; offsetY = (Ch - renderH) / 2
nx = (pointerX - containerLeft - offsetX) / renderW
ny = (pointerY - containerTop  - offsetY) / renderH
```

- nx/ny가 0~1 밖이면 사진 여백이므로 선택하지 않는다.
- 이미지를 불러오기 전이거나 원본 크기가 없으면 좌표 선택을 비활성화하고 대체 경로를 표시한다.
- 지정 영역 내부 여부만 판정한다. 영역 밖을 가까운 곳으로 자동 이동시키지 않는다.
- part 영역의 일치 target ID를 중복 제거해 하나이면 미리보기, 0이면 미지원 부분으로 처리한다. 2~3개가 실제로 모호한 자료는 C가 구현된 버전에서만 사용한다. C를 보류한 버전에서는 중첩을 자료 검사 오류로 처리한다. 3개 초과 중첩은 항상 자료 오류다.
- wholeTarget은 전체 건물 행동으로 명시적으로 선택한다. part 영역 선택과 자동 경쟁시키지 않는다.
- 화면 크기·가로세로 변경 때 표시 사각형을 다시 계산한다. 저장 좌표는 바꾸지 않는다. 사진과 overlay가 동일한 변환을 사용한다.
- 이미지 경계·영역 경계, contain 여백, 기기 회전, 작은 화면을 기능 검사에 포함한다. 키보드 사용자는 동일 target ID를 텍스트 목록에서 선택한다.

## 5. 메모리 상태와 불변 조건

필요한 상태: presetId, sceneId, contextKey, screen, selection(좌표·region 후보·선택 target), selectedQuestionId, answerId, entryOrigin, 화면 이동 기록. 자유 질문 대안은 이번 기본 범위에 포함하지 않으며 그 상태를 미리 추가하지 않는다.

1. A의 targetId와 answer.targetId가 항상 같다. question을 골랐다면 question.targetId와 answer.questionId도 일치해야 한다.
2. scene이 바뀌면 이전 선택·질문·답변이 남지 않는다.
3. target이 바뀌면 이전 질문·답변이 남지 않는다.
4. 이름·설명·출처·강조 영역은 동일한 선택 상태에서 계산한다. 각 화면에 따로 복사해 서로 어긋나게 하지 않는다.
5. 홈 카드가 가리키는 scene/target/question/answer는 검증된 연결이어야 한다. 첫 버전은 `card.sceneId === preset.sceneId`로 제한한다. 다른 장면 연결이나 잘못된 카드는 숨기고 개발 검사에서 실패시킨다.
6. 사용자 입력이나 URL에서 주어진 ID를 그대로 신뢰하지 않는다. 검증된 자료에 없는 ID는 안전한 오류·초기 상태로 보낸다.
7. 준비된 내용의 부재와 프로그램의 자료 오류를 구분한다. 전자는 E의 지원 한계, 후자는 검사 실패와 복구 가능한 오류다.
8. 새로고침은 개인정보나 질문 이력을 복구하지 않는다. 앱은 localStorage·계정·외부 분석 도구를 사용하지 않는다.

## 6. 입력 → 처리 → 저장 → 표시

```text
테스트 preset 선택
  → scene/context 확인 → 메모리에 저장 → H
사진의 위치/전체/텍스트 대안 선택
  → 지원 영역 조회 → selection 갱신 → 미리보기 또는 C
대상 확인
  → overviewAnswer 참조 검증 → target/answer 갱신 → A
준비된 질문 선택
  → target/question/answer 참조 검증 → question/answer 갱신 → A
호기심 카드 선택
  → 카드 연결 검증 → scene/target/question/answer 갱신 → A
```

영구 저장과 API 응답 단계는 없다. 이미지·정적 파일을 제공하는 개발/정적 서버와 질문을 처리하는 서비스는 구분한다. 배포한다면 외부 출처 클릭 및 호스팅 접속 기록은 해당 서비스의 동작이며, 앱에서 질문·위치·관찰 내용을 수집하지 않는다.

## 7. 실행과 전달 경계

- 같은 PC의 데스크톱 브라우저에서 먼저 확인한다. 스마트폰 접근은 승인된 LAN 개발 서버 또는 정적 호스팅을 사용하며 실제 접근 방법은 구현 시 검증한다.
- 사용자에게 링크를 전달하는 것과 인터넷에 공개 배포하는 것은 별도 작업이다. 배포 환경·접근 권한을 정하기 전 임의 서비스에 게시하지 않는다.
- P07의 실행 안내는 실제로 작동한 명령, 설치한 버전, LAN/공개 여부, 기기 조건을 명시한다. 원격 동기화·오프라인 설치·PWA는 추가하지 않는다.
- 정식 앱 구현으로 넘어갈 때 이 구조를 그대로 확장해야 하는 것은 아니다. 프로토타입에서 검증한 UX 요구와 콘텐츠 계약을 재사용할지 따로 판단한다.
