# 양식 6 · 데이터와 입출력 설계 조사·검수

기준일: 2026-10-24. 사용자 요청: 데이터 구조·입출력·개발 환경의 대안을 조사하고 1차·2차 검수 후 적절한 안을 선정한다. 이 문서는 데이터·입출력의 상세 설계와 검토 근거다. [구조 문서](../ARCHITECTURE.md)는 제출용 요약, [환경 조사](form6-environment-research.md)는 개발 도구 선정 근거다. 실행 가능한 앱 코드·콘텐츠 스키마·검사기를 구현한 기록이 아니다.

## 1. 범위와 선택 기준

- 사용자 승인 유지: 설치형 Android, TypeScript + React Native + Expo, 기기 내 추론 우선, 앱에 포함한 JSON 콘텐츠와 별도 이미지·모델 파일. DB·서버·계정·이력 수집을 추가하지 않는다.
- [12개 User Story](../PRODUCT_BACKLOG_DRAFT.md)의 첫 도움·사진 입력·건물 식별·이름/구역 탐색·출처 있는 해설·복귀를 지원한다. US-11·12는 후순위 설계이며 구현 시점을 당기지 않는다.
- 사용자 가치 가설: 올바른 대상의 검수된 설명을 적은 조작으로 보고 원래 탐색으로 복귀한다. 이 문서의 계약 검토는 기존 AI·검색 대비 효과 검증이 아니다. 새 사용자 실험은 이번 설계 문서 작업의 완료 조건이 아니다.
- 현재 프로토타입의 [검사 코드](../../prototype/src/content.js), [파일 검사](../../prototype/scripts/check-content.mjs), [콘텐츠](../prototype/content/content.json)를 확인했다. 그 구조·자료를 제품 검증 완료로 복사하지 않는다.

## 2. 조사한 대안과 선정

아래 판정은 공식 기능을 확인한 뒤 우리 범위에 적용한 설계 판단이다. JSON/SQLite의 실기기 성능 비교는 수행하지 않았다.

| 결정 | 대안 | 선정과 이유 / 포기하는 점 |
| --- | --- | --- |
| JSON 내부 구성 | 건물마다 모든 설명·출처 중첩 / 종류별 배열과 ID 참조 / 매우 잘게 분리한 파일 | **하나의 콘텐츠 묶음 안에 종류별 배열+ID 참조.** 공용 출처 중복과 수정 불일치를 줄인다. 참조 검사가 필요하지만 초기에는 파일 병합 파이프라인을 추가하지 않는다 |
| 조회 책임 | 화면마다 JSON 조회 / 작은 Repository 함수 / SQLite·서버 API | **Repository 함수.** 화면이 출처·대상 연결을 반복 조합하지 않는다. DB 재검토 조건은 구조 문서를 따름 |
| 자료 검사 | TypeScript 타입만 / 수동 검사만 / JSON Schema+Ajv / Zod 스키마+참조 검사 | **Zod 4.6.7을 개발용 콘텐츠 검사에 사용하고 타입을 추론하는 안.** TS와 별도 스키마를 이중 관리하는 부담을 줄인다. 참조·파일 존재·권리 근거 검사는 별도 코드/사람 검수가 필요. 배포 존재를 확인했으며 설치 시 lockfile로 고정. 이번에는 설치하지 않음 |
| 앱의 자료 적재 | 화면 진입마다 읽기 / 앱 시작 때 전부 이미지까지 적재 / JSON 한 번 적재·ID 조회표 구성 | **JSON 한 번, 이미지는 화면에서 필요한 것만.** 모델은 식별을 요청할 때 준비. 첫 화면을 모델 준비가 막지 않음 |
| 이미지 전달 | JSON 경로로 동적 require / 고정 자산 매핑 / 원격 URL만 | **자산 ID → 정적 require 매핑.** 초기 콘텐츠 이미지가 묶이도록 구성. 원격 URL에 매번 의존하지 않는 대신 앱 배포 크기·갱신 비용이 생김 |
| 호출·오류 | HTTP/REST / 값 또는 null·예외 혼용 / 로컬 함수와 구분 가능한 결과 상태 | **로컬 함수+명시적 결과 상태.** 잘못된 ID, 빈 목록, 실행 실패, 취소를 구분. 서버 없는 앱에 HTTP 서버를 만들지 않음 |
| 비동기 제어 | 동시 요청 모두 적용 / 마지막 완료 우선 / 요청 ID 검증+한 번에 한 추론 | **현재 요청 ID와 일치하는 결과만 적용.** 네이티브 실행을 즉시 중단할 수 있는지는 별도 검증. 취소된 결과 폐기와 계산 중단은 다른 동작 |
| 콘텐츠 갱신 | 앱 배포 시 일괄 / 원격 전체 묶음 / 원격 부분 동기화 | **초기에는 앱 배포와 함께 일괄 갱신.** 내용 수정 때 배포가 필요한 단점 수용. 원격 갱신·마이그레이션·동기화는 실제 필요가 생기면 재검토 |

근거: TypeScript 타입은 실행 중 검사로 남지 않는다([공식 설명](https://www.typescriptlang.org/docs/handbook/2/basic-types.html#erased-types)). Zod는 실행 시 검사와 타입 추론을 제공한다([공식 문서](https://zod.dev/)). JSON Schema는 언어 독립 규격으로 유효하지만([규격](https://json-schema.org/draft/2020-12)), 현재 TS 앱 하나에서 사용할 스키마·타입·검사 도구를 별도로 관리할 이점이 작다고 판단했다. Ajv는 대안이지 함께 설치할 도구가 아니다([공식 문서](https://ajv.js.org/json-schema.html)). 앱은 개발용 스키마를 값으로 import하지 않고 타입만 참조한다. 런타임 외부 입력·네이티브 출력은 별도 경계 검사로 확인하며, 앱 번들에 검사 라이브러리가 들어가지 않았는지는 빌드 후 확인한다.

## 3. JSON 데이터 계약 v1

이하 경로·타입은 제품 구현 시 사용할 설계 명칭이며 현재 존재하는 제품 파일이 아니다. 묶음은 `content/catalog.json`, 이미지 매핑은 `content/asset-map.ts`, 스키마는 개발용 `content/catalog.schema.ts`로 구분한다. 실제 앱 루트는 앱 생성 때 정한다. 프로토타입의 `schemaVersion: 2`와 제품 v1은 다른 형식이며 직접 호환되지 않는다.

### 3.1 필드와 관계

표의 필드는 기본적으로 필수다. `?`는 선택 필드, `| null`은 필드가 존재하되 미확인을 표현한다. `Id`는 비어 있지 않은 고정 문자열이며 표시명 변경 시 바꾸지 않는다. 날짜는 ISO 날짜 문자열, 시각은 UTC ISO timestamp, 숫자는 유한값만 허용한다. 빈 목록은 `[]`, 미확인 사실은 임의 숫자·문구로 채우지 않는다.

| 종류 | 필드 / 타입 | 제약·사용처 |
| --- | --- | --- |
| 묶음 | `schemaId: 'gung-content'`, `schemaVersion: 1`, `contentVersion: string`, `locale: 'ko'`, 아래 8개 배열 | `areas, targets, entries, sources, assets, questions, regions, examples`. 후순위 미지원 배열도 빈 배열로 존재. 버전은 자료 변경 때 갱신 |
| Area | `id`, `name: string`, `aliases: string[]`, `parentAreaId: Id|null`, `photoAssetId: Id|null`, `mapAssetId: Id|null` | 최상위 경복궁과 하위 구역. 부모 순환 금지. 건물 목록은 `Target.areaId`로 산출하여 이중 저장하지 않음 |
| Target 공통 | `id`, `kind: 'building' 또는 'part'`, `name: string`, `aliases: string[]`, `areaId: Id`, `overviewEntryId: Id|null`, `heroAssetId: Id|null`, `position: Position|null` | `position`은 `{lat, lon, sourceIds: Id[]}`. 위도 -90~90, 경도 -180~180, 출처 필요. 미확인 좌표는 표시하지 않으며 해당 위치 AC는 미충족으로 남김 |
| Part 추가 | `parentBuildingId: Id` | 부모는 building이어야 함. 종류 일반 지식과 특정 건물 부분을 혼동하지 않음. 기존 굴뚝 부분처럼 제품 부모 건물 범위가 미정이면 자동 이관하지 않음 |
| Entry | `id`, `targetId: Id`, `kind: 'overview' 또는 'context' 또는 'observation' 또는 'answer'`, `title: string`, `summary: string`, `paragraphs: string[]`, `sourceIds: Id[]`, `reviewStatus: 'draft' 또는 'reviewed'`, `checkedAt: date|null`, `assetIds: Id[]`, `event?: Event` | 앱 배포본은 reviewed만 포함, 출처 1개 이상. `Event={kind: 'construction' 또는 'reconstruction' 또는 'restoration' 또는 'historical-event', periodLabel: string}`. 불확실한 시기를 억지로 정수 연도로 바꾸지 않음 |
| Source | `id`, `title`, `publisher`, `url`, `checkedAt`, `claimNote` | 문자열·날짜. URL은 https/http. 어떤 설명의 근거인지 `claimNote`에 기록. 출처 URL 검증과 사실 검수는 별개 |
| Asset | `id`, `assetKey`, `targetIds: Id[]`, `alt`, `width`, `height`, `byteSize`, `sha256`, `sourceId: Id`, `creatorCredit`, `licenseLabel`, `licenseUrl`, `licenseEvidenceUrl`, `modificationNote`, `checkedAt`, `capturedAt: date|null` | 양의 정수 크기·용량, 64자리 해시, 출처/이용 근거 필수. `assetKey`는 정적 자산 매핑 키. 사용자 촬영 사진은 이 배열에 넣지 않음 |
| Question | `id`, `targetId`, `label`, `answerEntryId` | 같은 대상의 reviewed answer를 참조. 자유 입력 없음. US-11 |
| Region | `id`, `assetId`, `partId`, `rect: {x,y,width,height}` | 등록 이미지 원본 기준 정규화 0~1. 폭·높이 양수, 우하단도 1 이하. 해당 part/부모 building이 자산 대상과 일치. US-12 |
| Example | `id`, `label`, `assetId`, `targetId` | 실제로 보여줄 reviewed 개요·사진 존재. 결과 출처는 example. US-01 |

`overviewEntryId: null`인 대상은 자료 준비 과정에 존재할 수 있지만 일반 탐색·예시·모델 라벨에 노출하지 않는다. hero 이미지가 없어도 내용은 사실대로 보여줄 수 있으나, 사진이 필요한 검색·예시·비교 경로의 완료로 보지 않는다. 배포 기능별 필수 자료를 별도 검사한다. 실제 역사·좌표·라이선스 값을 이 문서에서 새로 확정하지 않는다.

관계: Area → Target(1:N), building Target → part Target(1:N), Target → Entry(1:N), Entry → Source(N:M), Asset → Target(N:M), Asset → Region(1:N), Region → part Target(N:1), Question → answer Entry(N:1). ID 참조이며 SQL PK/FK를 구현했다는 뜻이 아니다.

### 3.2 이미지와 모델 파일 연결

React Native의 이미지 `require` 경로는 정적으로 알아낼 수 있어야 하므로 JSON의 문자열을 `require(path)`에 전달하지 않는다([공식 이미지 문서](https://reactnative.dev/docs/images)). `assetKey`마다 정적 require를 적은 매핑을 두고, 누락 키·파일·크기·해시를 개발 환경에서 검사한다. JSON에 base64 이미지·모델 바이트를 넣지 않는다.

모델 계약은 콘텐츠와 분리한 manifest로 관리한다: `modelId, modelVersion, format, assetKey, sha256, byteSize, labelTargetIds, preprocessingVersion, decisionPolicyVersion, contentSchemaId, contentSchemaVersion`. 전처리에는 `inputName, outputName, inputSize, dtype, layout, colorOrder, resizeMode, mean, std`를 선택 모델의 검증된 값으로 고정한다. int8 모델이면 검증한 양자화 파라미터를 추가한다. 구체 값·파일 전달 방식은 모델 연결 실험 후 채운다.

출력 차원·라벨 개수·고유 ID·콘텐츠 연결을 확인한다. 라벨 순서는 모델 출력 순서와 같아야 하며 콘텐츠 배열 정렬 순서를 사용하지 않는다. 콘텐츠 개정 시 라벨과 현재 배포 대상의 호환성을 다시 검사한다. 모델과 콘텐츠 버전 문자열이 동일해야 하는 것은 아니다.

### 3.3 배포·보관 정책

- 초기 콘텐츠 수정은 앱 새 배포에 포함한다. 실행 중 원격 JSON만 교체하는 경로는 만들지 않는다. 번들 자료 읽기가 가능해도 지도 제공 방식·출처 원문 열기·모델 준비까지 모두 오프라인이라는 뜻은 아니다.
- 출처는 기관·제목·확인일을 로컬에서 보여주고, 원문 열기는 외부 브라우저를 사용한다. 연결 실패 시 설명 화면을 보존한다.
- 촬영·선택은 URI로 전달하며 원본을 JSON·로그에 넣지 않는다. 갤러리 원본은 수정·삭제하지 않는다. 디코딩·방향 보정·축소에 필요한 앱 소유 사본만 임시 보관한다.
- 임시 사본은 같은 실행 세션의 화면 이력이 참조하는 동안 유지한다. 참조가 없는 사본은 인식 네이티브 작업이 끝난 뒤 정리한다. 다음 앱 시작 때 이전 세션의 앱 전용 임시 폴더를 정리한다. OS가 먼저 캐시를 지울 수 있으므로 복귀 시 파일 존재를 확인하고 없으면 재선택을 안내한다. 프로세스 종료 뒤 탐색 이력 복원은 이번 기본 범위가 아니다.
- 전체 이미지를 JS base64로 유지하지 않는다. 모델 텐서·세션은 화면 상태에 넣지 않고 인식 연결부가 소유한다. 실제 캐시·메모리 사용량과 취소 후 해제는 기기에서 검증한다([Expo FileSystem](https://docs.expo.dev/versions/latest/sdk/filesystem/)).

## 4. 앱 내부 입출력 계약

### 4.1 공통 방식

호출은 서버 URL이 아닌 로컬 모듈 함수다. Repository 조회는 동기 읽기 전용 결과, 촬영·원문 열기·모델 실행은 Promise 결과로 둔다. 화면은 파일 경로·텐서를 직접 다루지 않는다. 반환 데이터는 readonly로 취급하며 UI 가공으로 원본 콘텐츠를 변경하지 않는다.

조회 결과는 `status: 'ok' | 'not-found' | 'unavailable' | 'error'`로 구분한다. ok만 `data`를 갖고, not-found는 요청한 자료 ID가 없음, unavailable은 등록됐지만 현재 지원·검수 자료가 없음, error는 `code`를 갖는다. 빈 검색 목록과 질문 없음은 정상 ok다. 조회 오류는 `INVALID_ARGUMENT`, `TARGET_MISMATCH`, `CONTENT_UNAVAILABLE`, `ASSET_UNAVAILABLE`로 구분한다. 콘텐츠 저장소가 준비되지 않은 경우는 CONTENT_UNAVAILABLE이며 빈 목록으로 숨기지 않는다. 상태별로 필요한 필드를 나눈 TypeScript discriminated union을 사용한다([공식 문서](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions)).

| 함수 | 입력 | 출력·규칙 | Story |
| --- | --- | --- | --- |
| `getStartOptions()` | 없음 | 실행 가능한 `{kind: camera/library/search/areas/example, exampleId?}` 목록. 구현·기기 권한 상태·자료 준비를 함께 적용, 권한 요청은 실제 행동 때 수행 | US-01 |
| `selectPhoto(source)` | camera 또는 library | Promise: selected `{photoId, uri, width, height, mimeType, origin}` / cancelled / error `{code}`. picker null 필드·URI 읽기 실패는 경계에서 검사 | US-04 |
| `recognize(input)` | §4.2 | Promise: identified / uncertain / cancelled / error | US-05·07 |
| `cancelRecognition(requestId)` | 취소할 요청 ID | 즉시 `{status: accepted 또는 not-active}`. accepted는 결과 적용 무효화이며 네이티브 계산 종료 확인이 아님. 같은 요청을 반복 취소해도 안전 | US-04·07 |
| `findBuildings(query, areaId?)` | 문자열·선택 구역 ID | ok `{query, state: matches/no-match/empty-query, items: BuildingSummary 또는 AreaSummary[], scopeLabel}`. 모르는 areaId는 not-found. 검색 대상은 검수된 지원 건물/구역 | US-02·03 |
| `listAreas(parentAreaId?)` | 선택 부모 구역 ID | AreaSummary[]와 사진·지도 참조. 현재 GPS가 없어도 동작. 지도 표시 방식은 별도 선택 | US-03 |
| `getBuilding(id)` | building ID | 기본 정보·verified position 또는 null·검수 Entry/Source/Asset 참조·이용 가능한 다음 경로. part ID는 타입 불일치 error | US-08·09·10 |
| `getComparison(candidateIds)` | 2개 이상 고유 building ID | 후보별 이름·사진·검수 observation entries와 unavailable 항목. 지원 자료 없는 후보를 다른 후보 특징으로 채우지 않음. 후보 수를 프로토타입처럼 정확히 2개로 고정하지 않음 | US-06 |
| `listQuestions(targetId)` | 대상 ID | QuestionSummary[]. 대상이 없으면 not-found, 질문만 없으면 ok [] | US-11 |
| `getEntry(entryId, targetId)` | 설명과 현재 대상 ID | reviewed Entry+출처. 대상 불일치 error, 미검수 unavailable | US-09·11 |
| `listRegions(assetId)` | 등록 Asset ID | RegionSummary[]; 사용자 사진은 unavailable. 원본 사진 좌표를 촬영 사진에 복사하지 않음 | US-12 |
| `getPart(partId, assetId)` | 부분·등록 사진 ID | 일치하는 부분·검수 설명·출처. 소속/영역 불일치 error | US-12 |
| `openSource(sourceId)` | 출처 ID | Promise: opened 또는 error `{code: SOURCE_NOT_FOUND 또는 SOURCE_OPEN_FAILED}`. opened는 브라우저 열기 요청 성공이며 원문 로딩 성공 보장 아님. 설명 화면 상태 보존 | US-08 |

Summary는 ID·명칭·사진 참조·소속 구역 등 목록에 필요한 값이며 본문·이미지 바이트를 포함하지 않는다. 표의 함수는 앱 내부 책임을 함께 표시한 것으로 모두 Repository 함수인 것은 아니다. 시작 경로·입력·취소·다음 경로의 가능 여부는 Application이 기기/구현 상태와 콘텐츠 조회를 결합한다. `getBuilding`의 콘텐츠 결과에 이를 결합해 실제 제공 가능한 같은 대상의 설명/질문/등록 사진과 검색·구역·사진 입력으로 이어간다. 자동 주변 코스 추천·새 추천 엔진을 추가하지 않는다.

검색은 NFC 정규화·앞뒤 공백 제거·연속 공백 정리·영문 소문자화를 양쪽에 적용한다. 공식명/별칭 정확 일치 → 접두 일치 → 부분 일치 순서, 동점은 고정 ID 순서다. 구역 명칭은 AreaSummary로 구분한다. 빈 검색은 empty-query와 목록 탐색 진입을 제공한다. ‘덕수궁’처럼 결과가 없을 때 지원 범위와 다른 탐색을 안내하지만, 모든 미일치 입력이 범위 밖 장소라고 추론하지 않는다. 자연어 의미 검색·오타 교정은 이번 계약에 추가하지 않는다.

사진 API 근거: [Expo ImagePicker](https://docs.expo.dev/versions/latest/sdk/imagepicker/)는 선택 취소와 선택 자산을 구분한다. [ImageManipulator](https://docs.expo.dev/versions/latest/sdk/imagemanipulator/)의 이미지 변환과 모델 입력 텐서 생성은 별개다. 어떤 라이브러리가 실제 RGB 배열을 생성할지는 모델 연결 실험에서 검증하며 이미지 축소 성공만으로 전처리 완료로 주장하지 않는다.

### 4.2 인식과 결과 출처

입력: `{requestId, photoId, contentVersion, locationContext?}`. photoId는 입력 관리자에 등록된 URI/크기/origin을 참조한다. `locationContext`는 `{latitude, longitude, accuracyMeters, observedAt, relation: confirmed-current-capture}`를 만족할 때만 전달한다. 갤러리 입력은 초기에는 현재 위치를 결합하지 않는다. 카메라 사진도 오래된 좌표·부정확한 좌표를 쓰지 않으며 유효시간·정확도 기준은 위치 보정 실험 전에 정한다. 기준 미검증 동안 photo-only다.

모든 반환은 `requestId, photoId, contentVersion`을 포함한다. 완료 후보는 `{targetId, rank, score}`이며 점수 종류 `scoreKind`와 `modelVersion, preprocessingVersion, decisionPolicyVersion, locationUsed`를 함께 반환한다. 후보 ID는 고유하고 현재 지원 building이어야 하며 rank는 1부터 연속, score는 유한값이어야 한다. 상위 후보 개수와 정렬 방향은 모델 판단 규칙에 고정한다. identified의 selectedTargetId는 1순위 후보와 일치해야 한다. 점수를 정답 확률처럼 UI에 표시하지 않는다.

| 상태 | 추가 필드 | 의미와 후속 행동 |
| --- | --- | --- |
| identified | `candidates` 1개 이상, `selectedTargetId`, 검증 버전 정보 | 검증한 판단 기준을 통과한 모델 결과. 진실 보장이 아님. 사용자 수정 경로 유지 |
| uncertain | `candidates` 0개 이상, `reason: below-policy/no-candidate/policy-unvalidated`, 검증 버전 정보 | 대상 확정 없음. Sprint 1은 재입력, Sprint 2는 준비된 후보 비교 추가 |
| cancelled | `reason: user/superseded` | 결과·선택을 적용하지 않음. 오류 알림으로 처리하지 않음 |
| error | `code`, `retryable: boolean` | 아래 실패에 맞는 안내·복구. 다른 건물 설명으로 넘어가지 않음 |

인식 오류 code: `PHOTO_UNREADABLE`, `IMAGE_UNSUPPORTED`, `MODEL_NOT_READY`, `MODEL_INCOMPATIBLE`, `CONTENT_MISMATCH`, `INFERENCE_FAILED`, `TIMEOUT`, `BUSY`. 각 code는 실제로 감지한 실패에만 사용한다. 사진 입력 경계는 `PERMISSION_DENIED`, `INPUT_UNAVAILABLE`, `PHOTO_UNREADABLE`을 구분하고 취소는 cancelled로 반환한다. 권한 거부 시 사용 가능한 다른 입력/탐색을 제시한다. 사진이 지원 밖 건물인지 항상 알 수 있다고 가정하지 않는다. 판단 기준이 미검증이면 identified를 내지 않고 개발 실험 결과로 구분한다.

`Candidate`와 최종 `Selection`을 분리한다. Selection은 `{targetId, origin: model/user/example, requestId?: string}`이고 사진 출처 camera/library와 별개다. 사용자가 후보를 골랐다고 모델 정답·학습 정답으로 기록하지 않는다. 예시를 실제 인식 요청에 넣지 않는다.

### 4.3 취소·재입력·복귀

1. 현재 식별 요청 ID를 저장한다. 사진 B를 선택하면 A를 무효화하고 후보·선택을 초기화한다.
2. 네이티브 추론은 한 번에 하나만 실행한다. A가 실제 종료되기 전에는 B 미리보기·검색·뒤로가기는 가능하지만 추론 실행을 중복 시작하지 않는다. BUSY를 무한 대기로 숨기지 않는다.
3. 반환 시 요청 ID·사진 ID·콘텐츠 버전이 현재 값과 모두 같아야 적용한다. 취소·타임아웃 뒤 늦게 도착한 성공도 폐기한다.
4. 타임아웃은 화면 기다림을 끝내는 계약이며 네이티브 계산 강제 중단을 보장하지 않는다. 종료 불능 시 세션 재생성·재시작 안내의 가능성을 Android 실험에서 확인한다. 임의의 타임아웃 숫자를 성능 목표로 확정하지 않는다.
5. 화면 이력은 route, targetId, entryId, query, areaId, resultIds, photoId, selection, scrollAnchor, 사진 zoom/pan을 메모리에 보존한다. 사진 탐색으로 돌아가도 식별을 자동 재실행하지 않는다. 새 탐색은 이전 ‘확정 선택’을 이어받지 않는다.
6. 취소한 네이티브 작업이 사용하는 임시 파일은 작업 종료 전 삭제하지 않는다. 앱 재시작·캐시 소실 시 복원 불가능한 사진은 명확히 재선택하도록 한다.

## 5. 1차 검수 · 요구사항과 근거

수행: 기존 12개 Story·ARCHITECTURE·프로토타입 검사 코드와 위 공식 문서를 대조한 설계 검수. 실제 Android 테스트가 아니다.

| 발견 사항 | 반영한 보완 |
| --- | --- |
| ‘이름 검색’만으로 구역 명칭·범위 밖 안내 AC가 빠짐 | building/area 결과 구분, no-match와 지원 범위 안내 명시 |
| 건물 설명 조회만 있고 부분/질문 답변의 소속 검사가 약함 | getEntry/getPart에 현재 대상·사진 일치 검사 명시 |
| 이미지 경로 문자열만 저장하면 RN 정적 번들 요구와 충돌 | assetKey와 정적 매핑을 분리 |
| TS 타입만으로 외부 JSON·네이티브 출력 검증을 보장할 수 없음 | 개발용 스키마 검사와 실제 입출력 경계 검사를 분리 |
| 프로토타입 지원 대상과 제품 모델 라벨이 같다는 보장 없음 | 제품 스키마 분리·이관 재검수·라벨 대응 검사 |
| 홈에서 모델 적재 실패가 전체 앱 실패가 될 위험 | 콘텐츠 탐색과 모델 준비 분리, 실제 가능한 시작 경로만 표시 |

판정: 위 누락을 설계에 반영했다. 새로운 기능 범위·SP·Should 배치를 추가하지 않았다.

## 6. 2차 검수 · 반례로 계약 확인

수행 방식: 1차 수정 후 아래 입력을 계약에 대입하는 수동 설계 walkthrough. ‘기대 결과를 계약으로 표현할 수 있음’을 확인하며 구현 테스트 통과로 집계하지 않는다.

| 사례 | 설계상 판정 / 필요한 구현 검증 |
| --- | --- |
| 경복궁 검색 / 없는 이름 검색 / 빈 검색 | area 결과 / no-match / empty-query를 구분 가능. 검색·표시 자동 검사는 후속 |
| 정상 targetId인데 기본 해설이 draft | unavailable, 예시·모델 지원에서 제외. 출처 없는 사실을 출력하지 않음 |
| 출처 하나를 여러 설명이 참조 | 동일 Source ID 공유 가능. 출처 사실 적합성은 사람 검수 |
| 사진 A 실행 중 B 선택, A가 늦게 성공 | A 결과 폐기·B 미리보기 유지, 중복 추론 없음. 실제 네이티브 종료·BUSY 복구는 미검증 |
| 미확정 후보를 사용자가 선택 | Selection.origin=user, 모델 정확도 성공으로 기록하지 않음 |
| 모델 라벨에 콘텐츠에 없는 ID / NaN 점수 / 출력 차원 불일치 | CONTENT_MISMATCH 또는 MODEL_INCOMPATIBLE. 후보 필터링으로 실패 은폐 금지 |
| 위치 권한 거부·갤러리 사진·오래된 위치 | photo-only, 위치 기다림으로 홈/탐색을 막지 않음 |
| 등록 사진 좌표를 사용자 사진에 사용 | unavailable. US-12를 임의 부위 탐지로 확대하지 않음 |
| 확대 사진에서 뒤로 간 뒤 다시 열기 | 이력의 사진·선택·확대·스크롤 복원. 파일 소실이면 재선택. 터치 충돌은 별도 기기 UI 검증 |
| 오프라인에서 출처 원문 누르기 | 로컬 출처 표시는 유지, 원문 연결 오류와 설명 복귀를 구분 |
| 초기 설치 뒤 콘텐츠만 새 버전으로 바꾸기 | 초기에는 해당 경로 없음. 앱 배포 단위 교체로 참조 버전 혼합 방지 |
| OS가 임시 사본 삭제 / 앱이 강제 종료 | URI 존재 재확인·재선택, 갤러리 원본 삭제 없음. 캐시 보존 보장하지 않음 |

2차에서 추가로 보완한 사항: 취소를 요청 ID로 호출하는 명시적 함수, not-found의 ‘자료 ID’ 의미, 조회 오류 code, 원문 브라우저 열기와 웹페이지 로딩 성공의 구분, Repository와 Application 책임 구분을 계약에 반영했다.

판정: 문서 수준에서 정상·빈 상태·오류·취소·예시·이력·지원 범위 경계를 표현했다. 데이터 검사 구현, 타입 컴파일, Android 빌드·메모리·취소 실험은 미실행이다. 아래 구현 순서에서 이 표를 회귀 시나리오로 옮긴다.

## 7. 문서 인계와 다음 구현

양식 6 §3에는 데이터 필드 표·ID 관계·로컬 함수 표·실패 규칙을 압축해 옮긴다. HTTP Method/URL은 ‘해당 없음 — 앱 내부 호출’로 표시하고 로컬 API 표현에 대한 수업 요구는 제출 담당자가 확인한다. 상세 개발 설계는 이 문서를 연결한다. §4는 환경 조사 문서의 ‘선정’과 ‘설치/실행 확인’을 구분해 사용한다.

다음 실행의 우선순위는 선정한 Android 개발 환경과 작은 모델 연결 실험이다. 콘텐츠 쪽은 제품 스키마/콘텐츠 검사 → 검수한 한 건물의 개요·출처·사진 묶음 → 로컬 조회·예시 결과와 복귀 순서로 진행할 수 있으며, 전체 콘텐츠 완성을 모델 연결 실험의 선행 조건으로 만들지 않는다. 검색·비교·부분 탐색은 해당 Story 배치를 따른다. 이번 조사 때문에 신규 Issue를 만들거나 모델·런타임·인식 기준·전체 개발 완료를 선언하지 않는다.
