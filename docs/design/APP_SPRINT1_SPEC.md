# Sprint 1 App 상세 설계 v1

작성: 2026-11-07. 작업 원본: [App 지도 #27](https://github.com/HyunKN/visual-travel-guide/issues/27). 사용자 요청: 세부 설계를 먼저 정리하고 이슈별 실제 개발을 진행한다.

## 1. 적용 기준과 결정

이 문서는 **구현 기준**이며 구현 완료·실기기 검증·Sprint 인수 기록이 아니다. 기능별 진행은 Issue에만 집계한다. 최신 사용자 결정과 아래 계약을 기준으로 개발하며, 검증에서 변경이 필요하면 이유·영향을 해당 Issue에 남긴다. 모델 파일·서버·지도 키 등의 공급 준비를 설계 완료와 혼동하지 않는다.

2026-11-07 사용자가 선택했다:

- R3: 이야기 중심 홈, 불투명한 ‘둘러보기 / 내 글’ 하단바. 공통 사진은 중앙 확대(cover)로 시작하고 ‘전체 사진’(contain)으로 전환한다.
- 새 글마다 ‘공개 / 나만 보기’를 직접 선택하며 기본 선택은 없다. 초안은 항상 기기에 보호한다. 공개 전에 비공개 글 저장을 거치는 별도 동작은 요구하지 않는다.
- 추천·취소·집계·인기순은 후속으로 보류한다. Sprint 1 제품 화면에서 가짜 추천수·추천 버튼을 제거한다. 이전 HTML/개발 시안은 과거 fixture임을 유지한다.

기존 방향: 원본 Spoqa Han Sans, 흰 바탕·먹청색·작은 주홍, 실제 장소 사진, 쪽지의 투명 흰색/연회색 Liquid Glass 방향, 이모티콘·태그라인·불필요한 보조 레이블 제외. [UI 사양](APP_UI_REFERENCE.md), [공통 사진 ADR](../adr/0001-shared-place-photo-anchors.md)을 따른다. 모션 값은 구현 출발값이며 시각·접근성 검수에 따라 조정한다.

### 이전 문서와의 차이

| 과거 표현 | 이번 개발 기준 | 인수에 미치는 영향 |
| --- | --- | --- |
| 개인 사진 위 위치·사진 사본 저장 | 공통 scene 좌표와 텍스트만 저장 | 사진 간 위치 정합·자동 원본 복제 없음 |
| 50자 짧은 글 | 자유 텍스트, UTF-8 16,384bytes 기술 상한 | 줄바꿈·한글·emoji 입력 허용. 제출 양식의 50자 AC는 변경 논의 이력과 대조하고 자동 통과 처리 금지 |
| 비공개 저장 후 공개 | 한 작성 화면에서 공개 범위 선택 후 실행 | 초안 보호와 공개 동의를 분리 |
| contain만 허용 | cover/contain 공통 변환 | 화면 밖 표식은 전체 보기에서 찾으며 저장 좌표는 변하지 않음 |
| 추천수·인기 혼합 | 추천 보류, 안정적인 최신순 페이지 | 실제 공유 전 예시 추천수를 제품 데이터로 쓰지 않음 |

기존 Story·SP·공수·제출 파일은 수정하지 않는다. 12 Story/50 SP 계획의 범위·검증 부담을 줄였다고 주장하지 않는다. 기존 일정·AC/DoD의 남은 조건은 #35에서 별도로 대조한다.

## 2. 화면·이동·복귀

| 화면 / 책임 | 입력과 정상 동작 | 실패·빈 상태·복귀 |
| --- | --- | --- |
| 홈 / #28·36 | 검수 콘텐츠의 편집 순서로 첫 이야기, 직접 장소 선택, 사진으로 찾기. 공개 쪽지 미리보기 최대 1개 | 원격 글 실패가 장소 탐색을 막지 않음. 공개 글 없으면 해당 미리보기 생략. 개인화·주변·인기 허위 표시 없음 |
| 이야기 / #28·36 | placeId·선택 entryId. 처음 선택한 이야기 펼침, 나머지는 제목으로 펼침, 사진·출처·쪽지 진입 | 잘못된 ID/소속 불일치 안내. 뒤로 오면 같은 entry·펼침·스크롤 유지 |
| 사진 입력 / #29·30 | camera/library → 미리보기 → 명시적 ‘장소 찾기’ | 취소는 이전 사진 유지, 새 사진은 이전 인식 무효화. 모델 미준비는 직접 선택 제공 |
| 공통 사진 / #32 | sceneId, 선택 messageId?, cover/contain, 페이지. 상세에서 진입 | 사진 실패 시 표식·위치 선택 중지, 재시도. 글 0개면 사진·쓰기 가능. 삭제 글은 이용불가+닫기 |
| 쪽지 읽기 / #32·34 | 큰 사진 유지, 하나의 글, 닫기. 다른 사람 글은 신고, 내 글은 편집·관리 | 긴 글 본문만 스크롤, 닫기는 고정. Android 뒤로는 쪽지를 먼저 닫고 다음 뒤로는 장면 이탈 |
| 위치 선택 / #32·33 | ‘글 남기기’ 후에만 사진 터치 활성. 임시 anchor 1개, 다시 눌러 이동, ‘글 쓰기’ | 사진 밖 입력 무시. 선택 전 쓰기 비활성. 취소하면 기존 탐색 좌표·모드 복원 |
| 작성 / #33·34 | 텍스트 하나·위치 변경·공개 범위·완료. 공개는 ‘공개하기’, 개인은 ‘저장’ | 기본 공개 범위 없음. 공백/상한/미선택 차단, 입력 유지. 키보드 위 완료 행. 뒤로 시 초안 저장 후 이탈 |
| 내 글 / #33 | 기기 초안·기록 최신순, 상태와 본문 일부. 공개 여부 식별, 같은 위치로 열기 | 첫 빈 상태는 ‘남긴 글이 없어요’와 둘러보기. 로딩·실패를 빈 목록으로 바꾸지 않음 |
| 주변 장소 / #31 | 홈의 명시적 위치 행동 → 현재 위치·지원 장소 3곳의 2D 지도 | 권한 거부·지도 실패 때 직접 선택 유지. 위치를 방문 인증/사진 촬영 위치로 단정하지 않음 |

모든 화면 이동은 Expo Router. route에는 ID·선택 entry 정도만 넣고 사진 URI·본문·세션 token을 넣지 않는다. 같은 프로세스의 stack 복귀는 스크롤/장면 모드를 보존한다. 프로세스 재실행은 기기 저장 글·초안만 복원하며 임시 사진·미저장 탐색 상태는 복원을 보장하지 않는다. 공개 deep link의 좌표가 cover 밖이면 contain으로 전환한 뒤 해당 글을 연다.

## 3. 치수·색·모션·접근성

- 화면 좌우 20dp, 큰 구획 24/32dp, 버튼 최소 48×48dp, 아이콘 약 24dp, 표식 그림 28dp. 하단바 최소 60dp + safe bottom. 앱바 최소 56dp. 큰 글자에서 높이를 늘린다.
- 이야기 28/38 Bold, 구획 21/30 Bold, 본문 17/29 Regular, 행동 16/24 Bold, 필요한 출처 14/21. OS 글자 배율을 막지 않는다.
- primary #243247, secondary #526071, base #FFFFFF, subtle #F3F5F7, accent #B45440. 출처·오류·공개 범위는 불필요한 도움말이 아니라 필요한 정보다.
- 쪽지 좌우/안쪽 20dp, radius 20, 최대 너비 560dp, 선택 표식 반대편 위/아래 배치. 최대 가용 높이에서 닫기/관리 행을 확보하고 본문만 스크롤한다. 열림 중 위치를 자동 변경하지 않는다.
- 유리 후보: 사진과 동일 변환의 배경 blur + 흰 tint, 얇은 테두리·그림자. 읽기 대비가 안 나오면 불투명 흰 면. Android 굴절 표현은 별도 검증하며 단순 blur를 최종 광학 효과 완료로 세지 않는다. 하단바·작성면은 불투명.
- 일반 눌림 100/140ms, 쪽지 진입 220ms opacity+8dp, 닫힘 140ms. BUGI 형태 연결은 비교 후보로 보관하고 기본 읽기 흐름을 막지 않는다. 모션 완료와 저장 완료를 분리한다.
- 로딩은 실제 지연 영역만 같은 크기의 뼈대. OS 동작 감소에서 반복/이동/scale 제거. 투명도 대체 설정은 별도이며 Android OS 자동 연동을 가정하지 않는다.
- 읽기/작성은 native modal 경계로 배경 접근·터치를 막는다. 최초 focus는 제목/닫기, 닫은 뒤 선택 표식(삭제됐으면 장면 제목). TalkBack 순서·뒤로·외부 키보드는 Android 검사 대상이다.

## 4. 데이터와 모듈 경계

콘텐츠는 기존 catalog를 재사용한다. ID와 자산 경로를 별도 장소 목록으로 복제하지 않는다. 아래는 저장/전송 계약이며 구체 파일·작성된 함수는 각 Issue에서 갱신한다.

| 자료 | 필드·불변 조건 |
| --- | --- |
| PlaceScene | id, placeId, assetId, imageWidth/Height, sha256. catalog의 place.sceneId/assetId와 일치. 사진 구도 교체는 새 ID |
| Anchor | 유한 u/v 각각 0..1, 원본 사진 기준. 기기 px·GPS·개인 photoId를 저장하지 않음 |
| Note | UUID id, sceneId, anchor, body, revision, createdAt/updatedAt. 공개 상태는 로컬과 서버 확인을 구분 |
| Draft | 같은 noteId, draft body/anchor, visibility null/private/public, revision, updatedAt. 공개 내용과 독립 |
| Publication | noteId, ownerId, requestId, submittedRevision, serverVersion?, state private/pending/published/uncertain/withdrawing/conflict |
| PublicMessage | id, sceneId, anchor, body, version, createdAt/updatedAt. 작성자 권한은 서버 내부 ownerId로 판단 |
| MarkerPage | items(본문 없음), nextCursor 또는 null. scene/snapshot/createdAt/id를 포함한 검증된 커서 |

본문은 plain text다. trim은 빈 글 판정에만 사용하고 저장할 줄바꿈/공백을 임의 삭제하지 않는다. UTF-8 바이트 수를 RN·서버에서 일치시킨다. 16KiB는 글 형식을 강요하기 위한 값이 아니라 저장·전송 보호값이다. 초과 붙여넣기를 조용히 잘라 버리지 않는다. 서버도 같은 제한을 적용한다.

모듈: place-content(읽기 JSON) / photo-input(임시 photo) / recognition(요청·runtime adapter) / location(위치) / place-messages(장면·geometry·읽기) / local-notes(DB·초안) / public-messages(auth·원격). 화면은 SQL·인증·모델을 직접 실행하지 않고 해당 기능 함수를 호출한다. 범용 framework 계층은 추가하지 않는다.

## 5. 공통 장면·좌표·읽기 #32

- 세 장소 모두 기존 실제 사진과 불변 scene metadata를 연결한다. metadata hash·비율은 자동 검사하고 잘못된 scene/place 조합은 오류다.
- `imageRect(imageSize, stageSize, fit)`가 단일 진실이다. cover는 max 비율, contain은 24dp 보호 여백을 뺀 min 비율. Image·복제 blur·marker·역변환에 같은 rect 사용.
- 표시 좌표 = rect.xy + (u/v × rect.wh). 이미지 밖/viewport 밖 입력은 거부. 작성 모드에서만 stage 기준 터치를 역변환한다. edge glyph 좌표는 유지하고 48dp hit 영역만 안으로 이동한 뒤 충돌을 묶는다.
- cover 밖 표식은 억지로 가장자리에 모으지 않는다. ‘전체 사진’으로 발견 가능. contain에서 모든 표식이 접근 가능해야 한다. 초기 자유 pinch/pan은 제외하며 두 fit 전환만 지원한다.
- 페이지당 최대 60개, 최신 createdAt DESC/id DESC. snapshot cutoff와 keyset cursor 사용. 로컬 글/초안은 별도 원본으로 병합하고 같은 공개 id는 하나만 표시한다.
- 48dp hit box + 8dp 간격 충돌은 안정적 ID 순서로 그룹화. 저장 좌표를 바꾸지 않는다. 그룹을 열면 같은 패널의 이전/다음 글로 이동(리뷰 목록 아님), 선택된 원본 위치도 표시한다.
- 사진 로드 성공 전에 표식을 표시하지 않는다. 목록/본문 각각 loading/empty/ready/offline/error/unavailable을 구분한다. 새 scene·새 선택·취소 후 늦은 응답은 request generation으로 폐기한다.
- production 기본 저장소는 실제 local/public adapter만 사용한다. 개발 fixture는 개발용 경로에서만 명시적으로 사용하며 사용자 글처럼 홈에 노출하지 않는다.
- reader 닫힘은 fit·페이지·선택 그룹을 유지한다. 화면 크기 변경은 같은 anchor 재투영. 알 수 없는 ID·다른 scene 본문은 표시하지 않는다.

예정 함수: getScene, imageRect, project, unproject, layoutMarkers, createMessageReader(list/read/cancel), SceneScreen/MessageReader. 순수 geometry·상태 동작과 RN 렌더를 분리한다.

## 6. 작성·기기 저장 #33

기기 저장은 Expo SDK 57 호환 expo-sqlite를 사용한다. 검수 콘텐츠 JSON은 DB로 옮기지 않는다. 앱 전용 DB에 notes/drafts/publication_jobs와 schema version을 둔다. private body·사진 URI·위치는 서버 로그에 보내지 않는다. [SQLite 공식 API](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/)를 기준으로 adapter를 작성하고 native 추가 후 새 개발 빌드를 사용자가 설치/실행해야 한다.

1. 작성 진입 때 UUID를 한 번 생성한다. 초안 revision은 입력마다 증가하며 500ms debounce 후 저장한다. 저장 큐를 직렬화해 늦은 이전 저장이 최신 글을 덮지 못하게 한다.
2. 위치/공개 범위도 초안에 저장한다. 새 글 visibility는 null, 기존 초안 재개는 사용자가 이미 고른 값을 복원한다. 저장된 개인/공개 글 편집은 해당 기존 값을 명확히 표시한다.
3. 화면 이탈 전에 최신 초안을 flush한다. 실패하면 현재 화면·입력을 유지하고 재시도/명시적 폐기를 제공한다. 프로세스 강제 종료 전 500ms 이내 입력까지 보장하지 않는다.
4. ‘나만 보기’ 저장은 notes upsert와 draft 정리를 한 트랜잭션으로 처리한다. 동일 id 재시도는 중복 글을 만들지 않는다. 실패하면 성공 표시·이탈을 하지 않는다.
5. ‘공개’는 먼저 동일 내용·공개 요청 의도를 로컬에 원자적으로 보존하고 #34에 전달한다. 이는 내부 내구성 처리이며 비공개 저장을 먼저 누르게 하지 않는다.
6. local revision과 서버 version을 분리한다. 공개 글 편집은 로컬 초안이며 ‘공개 글에 반영’ 전까지 서버 본문을 바꾸지 않는다.
7. 삭제는 명시적 확인 후 해당 개인 글·초안을 제거한다. 공개 사본이 있으면 ‘공개 철회’와 ‘기기에서 삭제’를 구분한다. 철회가 불확실하면 job/owner 대응 정보를 유지한다.
8. DB open/migration 실패는 빈 내 글로 위장하지 않는다. 복구 가능한 오류와 재시도 제공, DB 자동 삭제/초기화 금지. migration은 버전별 transaction, parameter binding 사용.

예정 함수: createDraft, saveDraft, flushDraft, listLocalNotes, saveLocalNote, getLocalNote, deleteLocalNote. DB 접근은 단일 직렬 큐로 관리해 트랜잭션 밖 쓰기가 끼지 않게 한다. Node SQLite 임시 파일 검사는 SQL/복원을 검증하고 Android expo-sqlite 검사를 대신하지 않는다.

## 7. 공개·권한·관리 #34

Supabase 기존 선택을 유지한다. 읽기는 로그인 없이, 첫 공개 시 익명 Auth로 소유자 확보. 앱 재설치·세션 유실 후 본인 글 관리 복구는 Sprint 1에서 제공하지 않으며 **첫 공개 전에 이 한계를 명확히 안내**한다. 계정 연결·복구 기능을 암묵적으로 추가하지 않는다. 세션은 native 안전 저장 adapter로 관리하고 DB/로그/route에 token을 남기지 않는다. 익명 인증은 인증 없는 쓰기 권한이 아니다. [익명 Auth](https://supabase.com/docs/guides/auth/auth-anonymous), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

- 테이블: registered_scenes(읽기), public_messages(소유자·scene FK·u/v·body·version·moderation), publication_requests(재시도 식별·payload hash·결과), message_reports(신고자·사유·시각). private/draft 테이블을 원격에 만들지 않는다.
- 앱은 publishable key만 사용. service-role·DB password는 앱/저장소에 넣지 않는다. 서버는 owner=auth.uid(), scene 존재/게시 가능, finite 좌표, 본문 byte·공백 제한을 검증한다.
- 공개 읽기는 visible만. 숨김/삭제는 일반 목록·단건에서 제외한다. 작성자 관리 조회는 본인만. 타인 수정/삭제 거부, owner/createdAt/moderation 임의 변경 금지. RLS뿐 아니라 column grant/RPC 입력도 제한한다.
- 쓰기는 publish/update/withdraw RPC로 묶고 client 직접 DML을 제한한다. request UUID+owner+payload hash가 같으면 이전 결과 반환, 다른 payload 재사용은 conflict. version 조건부 수정으로 오래된 편집 덮어쓰기 거부.
- publish timeout은 uncertain. 같은 requestId 상태 조회 후 결정하며 새 UUID로 자동 재게시하지 않는다. 조회에서 아직 미확인인 동안 로컬 초안을 유지한다. 중복 버튼도 같은 job을 사용한다.
- 공개 → 나만 보기: 철회 확인 후에만 private로 표시. 오프라인이면 ‘철회 확인 중’이며 공개되지 않는다고 약속하지 않는다. 철회 후 재공개는 새 requestId와 증가 version, 같은 noteId로 명시 처리.
- 신고는 인증된 세션에서 messageId+사유(스팸/불쾌한 내용/개인정보/기타)를 전달. 같은 작성자의 같은 글 중복 신고는 하나. 일반 사용자는 신고 내역을 읽지 못한다. 관리자의 숨김은 서버 전용 권한으로 수행한다. 신고만으로 자동 숨김하지 않는다.
- 서버 기술 보호값: 작성/수정 5회/분·50회/일, 신고 10회/시간/사용자부터 테스트. 초과는 재시도 가능 시각과 명시 오류. 사용자 정체성 기반 제한의 익명 재가입 우회 한계를 기록하고 공개 배포 전 abuse 설정을 확인한다.
- 앱 메모리에서만 공개 글 캐시. 화면 재진입/앱 foreground에서 재검증, 읽는 중 삭제는 unavailable. 오프라인의 마지막 내용을 최신 공개 상태라고 표시하지 않는다. Realtime은 초기 범위에 추가하지 않는다.

예정 함수: ensureAuthorSession, list/read/publish/update/withdraw/reconcile, reportMessage. 관리자는 Supabase 관리 경로로 숨기며 앱에 관리자 UI를 만들지 않는다. 사용자 소유 프로젝트 지정·익명 Auth 활성화·migration과 A/B 서버 검사가 필요하다. 로컬 fake adapter 통과로 공유 인수 불가.

## 8. 사진·모델·위치 #29~31

사진 입력은 기존 #29 계약을 유지한다. 개인 사진 원본 삭제·자동 업로드·영구 복사는 없다. 갤러리 저장은 별도 사용자 선택 기능이며 Sprint 1 구현에 자동 추가하지 않는다.

인식은 [기존 상세 계약](../experiments/form6-data-contract-review.md#42-인식과-결과-출처)을 재사용한다. requestId/photoId/contentVersion 일치, 한 번에 한 native inference, 재입력·취소 후 늦은 결과 폐기. 모델 미준비/불일치/읽기 실패/시간 초과/보류를 구분하고 직접 선택을 유지한다. 정책 미검증 상태는 identified를 반환하지 않는다.

- 모델 수신물: ONNX와 external data, hash/버전, 입출력 shape/dtype, EXIF/RGB/resize/crop/normalization, label↔place 매핑, scoreKind/정렬/보류 정책, 참조 입력 텐서·출력·허용 오차. 빠진 항목은 #21/30 준비 미충족이다.
- PC↔Android 동일 텐서 → 실제 이미지 전처리 parity → 지원/미지원 독립 평가 순서. runtime decoder·전처리 backend는 수신 규격과 native spike로 검증 후 고정한다. 소스만 보고 호환 완료로 보고하지 않는다.
- UI 대기 상한은 개발 보호값 30초, 즉시 취소 가능. timeout은 native 계산 종료가 아니며 종료 전 새 native 추론을 시작하지 않는다. latency 성능 목표와 별개다.
- Sprint 1 인식은 photo-only. 위치 보정 실험·정책이 없는 동안 위치를 모델 판정에 섞지 않는다.

위치는 사용자 행동 시 foreground 권한만 요청한다. expo-location SDK 57, requestForegroundPermissionsAsync/getCurrentPositionAsync를 adapter 뒤에 둔다. 15초 대기 상한, 늦은 결과 무효화. 관측 시각 60초 이내·accuracy 100m 이내부터 현재 위치 안내에 사용하고 나머지는 stale/imprecise 상태로 분리한다. 이 값은 방문 인증·인식 임곗값이 아니다. [Location API](https://docs.expo.dev/versions/v57.0.0/sdk/location/).

검수된 좌표+출처가 있는 장소만 지도·거리 계산에 사용한다. react-native-maps의 2D 지도에 현재 위치/정확도와 지원 장소 marker를 표시하고 같은 placeId 설명으로 이동한다. [SDK 57 지도 문서](https://docs.expo.dev/versions/v57.0.0/sdk/map-view/)에 따른 공급자 설정·제한된 Android 키·새 빌드가 필요하다. 지도 키/타일 실패를 가짜 지도로 감추지 않고 목록·직접 선택으로 복구한다. 지도 설정과 장소 좌표가 미확보이면 #31 인수는 남는다. 위치 기록을 영구 저장/서버 전송하지 않는다.

## 9. 검증 계약과 개발 순서

| Issue | 자동 검사 | 사용자가 실행한 Android/서비스에서 확인할 것 |
| --- | --- | --- |
| #28·36 | ID/출처/선택 entry 불일치, route 기본값 | 홈 첫 행동, 같은 이야기 복귀, 글자 200%, 폰트·대비·유리 효과 |
| #29·30 | 취소·재선택·늦은 응답·버전 불일치·오류 매핑 | 권한·원본 보호·실제 ONNX와 참조 parity·실기기 지연/메모리 |
| #31 | 거부·stale·imprecise·timeout·거리 계산·소속 | 실제 GPS/지도·정확도·직접 선택 복구. 주입 좌표는 별도 근거 |
| #32 | 3scene/asset hash, cover/contain 왕복, 모서리·밖 입력, 60개 밀집·순서 독립, 취소·다른 scene·사라진 글 | 사진/표식 일치, 긴 글·200%·TalkBack·하드웨어 뒤로·focus·사진 실패 |
| #33 | 실제 임시 DB 재열기, 한글/줄바꿈·16KiB, 오래된 draft·중복 저장·rollback·migration 실패 | 앱 종료 후 복원·키보드·뒤로·저장 실패 입력 보호·공개 선택 |
| #34 | payload/상태 전이·idempotency·version conflict | 독립 A/B/비로그인 직접 API로 조회·쓰기 권한·숨김·신고·불확실 재시도 확인 |
| #35 | 앞 단계 회귀·버전 고정·전체 시나리오 준비 | 실제 두 사용자 전달, 최소 2명 비교 관찰, 기존 AC/DoD와 변경 이력 대조 |

좌표 검사는 서로 다른 가로/세로 사진, 320/360/390/600 viewport, 원본 corners/중앙/경계 밖/NaN, 같은 점·연쇄 밀집을 포함한다. 기대치는 투영 왕복 오차 1e-10 이내, ID 유실/중복 0, 그룹 간 touch 간격 8dp 이상. 화면 크기가 48dp 이하인 측정 전 상태는 렌더를 보류한다.

코드 검사는 기존 npm typecheck/lint/test:content/test:photo와 신규 기능 검사로 한다. 앱·에뮬레이터·서버는 AI가 시작/재시작하지 않는다. 필요한 새 개발 빌드·실행 절차를 사용자에게 전달한다. 자동 검사 통과는 실제 화면·서비스 완료가 아니며 Issue는 사람 확인 전 열린 상태로 둔다.

개발 순서: 이 명세·이슈 정리 → #32 → #33 → #34. #29 사람 확인과 #30 모델 수신·#31 위치/지도 설정은 별도 선행 준비. #36 공통 토큰·승인 화면을 기능별로 연결하고 최종 시각 검수 후 #35 인수한다. 새 추정·WBS 번호를 만들지 않는다. 준비되지 않은 기능을 fixture로 대체하여 완료하지 않는다.

## 10. 구현 시작 판정

문제: 기본 UI와 과거 설계의 모순으로 다음 행동·데이터 소유권·완료 기준이 불분명했다. 사용자 선택과 공통 계약으로 정리했다. 사용자 가치 가설은 같은 사진에서 타인의 시선을 발견해 실제 장소를 다시 보는 경험이며 효과는 아직 미검증이다.

규칙·코드로 처리: 콘텐츠 ID, 좌표·그룹·상태·저장·권한. 확률적 판단: 모델 결과만. 별도 준비/검사: 모델 artifact/정책, Supabase 프로젝트, 지도 설정·좌표, native 광학/폰트·기기 성능. 기술 선택의 장점은 기존 기능·설계 자산 재사용과 실패 경계 분리이며, 새 native 의존성/실기기 확인 비용을 수용한다.

**시작 판정:** 사용자 제품 선택을 반영한 App 상세 계약 v1로 #32·33 구현 가능. #30·31·34는 adapter/검사 준비와 외부 준비를 분리하며 각각 실제 연결 후에만 인수 가능. ‘모든 기술 불확실성이 해소됐다’거나 Sprint 전체가 끝났다는 판정이 아니다. 사용자 관찰은 현재 기본 UI와 동일 콘텐츠·같은 과업에서 발견/오류/도움 요청/기록 부담/재관찰을 비교한다.
