# Android 앱 개발 검증

## 2026-11-08 사진 안 작성·홈 탐색·Android 유리 (#32/33/36)

- 기준선: `568b83b`에선 검수 이야기 하나가 홈에 고정됐고, 쪽지 입력에 별도 native Modal을 썼다. 사용자 보고는 이전 화면의 흐름이 작동했고 PC 입력과 탭 후 화면 키보드가 작동하지 않았다는 것이다. [13개 요구의 설계·수용 기준](../docs/design/APP_SPRINT1_SPEC.md)과 이번 변경 후 기기 결과를 구분한다.
- 적용: 홈 재방문에 검수 이야기 9개 순환(상세에서 복귀 시 같은 이야기 유지), 양방향 터치 카드·검색 캡슐·하단 사진 찾기. 읽기/작성은 공통 사진과 같은 화면에서 유지하며 작성 중 사진 배치를 고정한다. 글자·조작 아래만 밝히고 나머지 사진을 남긴다. 사진이 차지하는 공간과 실제 키보드 입력 결과는 기기에서 확인한다.
- **자동 검사 128/128:** 콘텐츠·추천 11, 사진 입력 8, 인식 연결 규약 14, 메시지·저장·위치 등 88, 유리 좌표·네이티브 호환 7. 검수 후보 제외·덱 순환·SQLite 파일 재열기/기존 초안 보존·수평 제스처 판정·모듈 없는 환경·클립 정렬을 포함한다. 타입 검사·전체 lint 통과. HTTP 서버 없는 Android/Hermes export 통과(1,747 modules, 31 assets). 모델 추론이나 실제 터치·한글 입력을 수행한 검사는 아니다.
- **네이티브 패키징 통과:** 기존 D: SDK·Gradle 캐시로 x86_64 `:app:assembleDebug --offline`, SDK 자동 다운로드 비활성. 5m 8s, 493개 작업 중 56개 실행. Kotlin 컴파일, 생성된 Expo 모듈 목록의 `PhotoGlassModule` 등록, APK `classes2.dex`의 모듈·View, 유일한 ABI `x86_64`, APK의 세 JPEG와 원본 바이트 일치를 확인했다.
- 개발 APK: `D:\Android\Projects\visual-travel-guide\app-build-20261107-s1\outputs\apk\debug\app-debug.apk`, 98,212,119 bytes, SHA-256 `509d7ed9f2c2ba637b97e72bcde92084ea0a805f3a2c4da247f8f4fee8fb5bbc`. 이는 에뮬레이터용 debug APK이고 Metro가 필요하다. ARM 실기기용 배포 파일이나 모델 추론 결과가 아니다.
- **기기 미확인:** AI가 앱·에뮬레이터·Metro를 시작하거나 APK를 설치하지 않았다. AGSL은 지원 기기의 GPU에서 실행 시 컴파일되므로 Kotlin/패키징 성공이 실제 굴절 표시를 보증하지 않는다. 한글 IME·PC 타이핑·표식 원위치·카드 넘김·글자 200%·TalkBack·사진 가독성은 [수동 확인 순서](README.md#이번-변경을-직접-확인하기)를 따른다. 새 화면이 더 흥미로운지도 사용자 비교 전이다.

## 2026-11-07 에뮬레이터 사용자 피드백: 홈·쪽지·키보드 (#32/33/36)

- 최종 코드: TypeScript·lint(경고/오류 0), 오프라인 Android/Hermes export 통과. 1,743 modules / 31 assets, 로고 PNG 포함, 결과 파일 `entry-65282343ec9986bd94f60fdb70bb1f06.hbc`. 새 APK나 사용자의 Metro 실행 결과가 아니다.

- 이전 빌드: 사용자가 VTG_API_36의 R3 홈과 Metro 8083 번들 화면을 제공했고, 안내한 흐름은 작동한다고 보고했다. 동시에 PC 키보드 입력 불가·입력창 탭 후 화면 키보드 미표시를 보고했다. 한글 입력, 공개 전달 또는 전체 인수의 통과 근거가 아니다.
- 이번 변경: 상단 추천을 분리하고 로컬 이름 검색/터치 카드/중앙 사진 찾기를 연결했다. 사용자가 제공한 배색과 실제 광화문 사진으로 홈 심벌을 다시 그렸으며 이미지 원본을 확인했다. 공통 사진에는 1~4배 핀치·이동/버튼, 14dp 표식·48dp 터치, 사진 위 작성(표시 후 focus)과 기록 편집 복귀를 연결했다. PhotoGlass는 사진만 합성하는 외곽 굴절 근사다.
- 좌표 검사 중 작은 축을 중앙 고정한 경우까지 핀치 중심이 이동하리라는 테스트의 잘못된 기댓값을 발견했다. 양축을 움직일 수 있는 경우와 한 축을 중앙 고정하는 경우를 나누어 같은 저장 anchor가 유지되는지 검사했다. 검색 2개·좌표 3개 회귀를 추가했다.
- 자동: 콘텐츠 8/8, 메시지·저장·위치·SDK 등 87/87. 사용자 실행 전에는 키보드가 고쳐졌다거나 최종 UI가 승인됐다고 하지 않는다. 기기 설정 파일은 읽기만 했고 앱·에뮬레이터·개발 서버를 시작/재시작하거나 APK를 설치하지 않았다. 실제 앱·한국어 IME·광학 정렬·접근성·핀치·카드 체감/발견 효과는 [수동 확인 순서](README.md#이번-변경을-직접-확인하기)를 따른다.

## 2026-11-07 위치의 오차·측정 시각 (#31 보완)

- US-17 AC-01과 실제 `nearby.tsx`를 대조했다. 지도/거리/오차 원은 준비돼 있지만 측정 시각과 수치 오차가 읽을 수 있는 정보로 빠져 있었다. 기존 위치 안내 계약의 누락 보완이며 위치 추적·위치 기반 인식·새 권한은 추가하지 않았다. 사용자가 오차와 오래된 관측을 알고 직접 장소를 선택할 수 있게 하려는 것이며 사용자 가치 효과는 미검증이다.
- `locationDetails`는 `classify`가 good인 fix의 실제 timestamp/accuracy만 반환한다. UI 검사 시각(checkedAt)을 측정 시각으로 바꾸지 않으며 시각 표현이 불가능한 값도 거부한다. 화면은 기기 현지 측정 시각과 오차를 같은 Text에 표시한다. 1m 미만은 그대로 구분하고 나머지 소수 오차는 m 단위로 올려 근삿값으로 표시한다. 위경도 숫자·사진 URI·추론 결과를 이 정보에 넣지 않는다.
- 기존 controller가 만료/취소/이탈/백그라운드에서 fix를 내려놓으면 표시도 사라진다. 새 위치 조회·저장/전송·타이머·지도 설정 변경은 없다. 위치 거부/미설정 지도에서도 기존 직접 선택 목록을 유지한다. [Expo 57 위치](https://docs.expo.dev/versions/v57.0.0/sdk/location/)의 timestamp/accuracy와 기존 프로젝트 시간·정확도 기준을 사용한다.
- 추가 회귀 3개: 실제 관측 시각/소수 오차와 원본 불변, 오래된/미래/부정확/잘못된 값·Date 범위 밖에서 메타데이터 비노출, 실제 controller 재검사/만료/clear와 연결해 시각을 새로 꾸미지 않고 표시를 제거하는 동작. `test:messages` **84/84**, typecheck·lint(오류/경고 0), Android JS/Hermes 컴파일 **1,737 modules·30 assets** 통과. Node SQLite experimental/기존 색상 환경 경고 외 실패 없음. 콘텐츠/사진/모델·SQL은 영향이 없어 이번에 반복하지 않았다.
- **미실행:** 실제 Android의 현지 시각/줄바꿈/200%/TalkBack, GPS의 오차·취득 시각, 지도 공급자 연결. 앱·에뮬레이터·개발 HTTP 서버·새 APK 빌드/설치·의존성 다운로드는 하지 않았다. 사람이 ‘현재 위치 확인’ 후 측정 시각/오차→만료 또는 백그라운드 복귀 시 정보 제거→직접 선택 유지를 확인한다. 실제 지도/기기 실행 전 #31 인수 조건을 완료로 바꾸지 않는다.
- 상세 명세의 기존 위치 표시 계약을 보완했으며 모델·좌표 출처·공통 아키텍처는 유지한다. 다른 스레드의 미커밋 문서와 개인 제출 파일은 변경 묶음에 포함하지 않는다.

## 2026-11-07 읽는 중 재확인과 본문 유지 (#32·36 보완)

- 설계/코드 대조: 장면은 읽는 동안 30초마다 일반 `open(id)`를 호출했다. 이 함수는 현재 본문을 loading으로 바꾸므로 지연 중 ScrollView의 본문이 Skeleton으로 교체되는 경로였다. 긴 글의 스크롤 이동·본문 선택·TalkBack 중단 가능성은 코드상 위험이며 실제 Android에서 재현한 현상으로 보고하지 않는다. 유리 광학 효과·서비스 설정 완료와도 별개다.
- `diagnosing-bugs` 절차에서 `node --test --test-name-pattern='background revalidation' src/features/place-messages/messages.test.cjs`로 기존 컴파일된 controller에 지연 응답을 주입했다. 수정 전 **1개 실패: loading !== found**를 확인했다. 모달/좌표 없이도 본문 제거가 재현돼 이번 원인은 controller의 선택/재검증 경로 혼용으로 좁혔다. native 렌더·스크롤 자체의 실패를 재현한 검사는 아니다.
- `open(id,'revalidate')`를 주기 조회에 연결했다. 같은 글의 대기 중에는 기존 message와 `checking` 상태를 유지하며, 읽기면은 본문 아래에 필요한 재확인 상태만 표시한다. 중복·다른 ID·닫힌/오류/이용불가 상태의 자동 조회는 무시한다. 정상 응답은 새 본문으로 갱신하고 checking을 지운다. 삭제/숨김은 unavailable, 네트워크/잘못된 응답은 error로 바꿔 옛 본문을 내린다. 이후 오류 재시도는 명시적 버튼을 사용한다. adapter가 보낸 checking 필드는 받지 않는다.
- 회귀 4개: 대기 중 본문 유지/수정 응답 적용, 중복 재확인과 명시적 다른 글 선택, 삭제·오류·잘못된 scene 및 수동 재시도, 실제 controller+presentation의 긴 본문·token/앵커 유지·닫기/장면 이동 후 늦은 응답 무효화. 최초 빨간 검사를 같은 경로에서 재실행해 통과했다. 임시 로그·추가 의존성·fixture 제품 노출은 없다.
- 실행: `test:messages` **81/81**, TypeScript·lint(오류/경고 0), Android JS/Hermes 컴파일 **1,737 modules·30 assets** 통과. 기존 Node SQLite experimental/색상 환경 경고 외 실패 없음. SQL/공유 저장 계약은 바뀌지 않아 SQL 검사는 이번 회차에 반복하지 않았다. 이전 3f0b3c6의 정책/SQLite↔SQL 6/6 근거와 구분한다.
- **미실행:** 앱·에뮬레이터·개발 HTTP 서버·새 native 빌드/설치·실제 Android 스크롤/TalkBack·원격 Supabase. 사람이 최신 JS로 긴 글을 열어 중간까지 읽고 30초 주기 전후의 위치·문자 선택을 비교해야 한다. 공개 서비스 연결 후 지연 응답·B의 철회/관리자 숨김·조회 실패에서도 본문 유지/제거와 닫기가 맞는지 확인한다. 상태 검사 통과로 스크롤 유지나 사용자 가치·최종 디자인을 인수하지 않는다.
- 상세 설계의 읽기/재검증 계약만 보완했다. 사진 좌표·저장·원격 DTO·공통 아키텍처는 유지한다. #32 사람 완료와 #36 1/4는 그대로이며 다른 스레드의 미커밋 문서는 포함하지 않는다.

## 2026-11-07 공개 글 충돌 복구 (#34·33 보완)

- 관찰: 기존 `editorAction`은 conflict에서 반영·철회·개인 저장을 모두 막았다. 기존 소유권/초안 보호·version 계약 안에서 복구 경로를 보완했다. 새 계정 복구·자동 병합·추천 정책은 추가하지 않았다. 기존 AI/검색보다 흔적 발견이 유용하다는 가설은 별도 사용자 비교가 필요하며 이번 실패 복구 검사로 입증하지 않는다.
- `vtg_owner_state`(migration 0005)는 본인 서버 글의 version·본문·위치·노출/숨김만 인증된 관리 조회로 반환한다. 타인/없는 ID는 같은 빈 결과, 비로그인은 EXECUTE 불가다. 숨김 글의 일반 공개 읽기와 기본 테이블 직접 접근은 계속 차단한다.
- `createConflictRecovery.inspect/act`와 편집기를 연결했다. 서버 글은 메모리에서만 별도 표시하고 초안을 대입하지 않는다. 반영/철회/개인 저장을 명시적으로 확인한 뒤 서버를 재조회한다. 상태가 달라지면 요청 생성 전 중단하고 다시 확인한다. 새 요청도 서버 expected-version을 검사하며, 철회에는 초안 본문을 넣지 않는다. 숨김 재공개를 막고, 응답 유실은 같은 request/동의로 확인한다. 세션 유실 시 자동 익명 재가입은 하지 않는다.
- SQLite schema 3은 기존 v1/v2 글·동의 snapshot을 보존하며 `stateSource`를 추가한다. 이미 철회/본인 사본 없음을 조회한 개인 저장은 `observation`으로 남기고 실패한 request의 성공 영수증으로 바꾸지 않는다. 원본 request/payload/revision을 보존하며 관측 version·개인 저장을 원자적으로 처리한다. 이후 재공개는 새 request 근거로 바뀐다. 다른 세션의 향후 재공개를 영구 방지하는 기능은 아니다.
- 실행: 메시지/실제 SDK 합성 HTTP **77/77**, PostgreSQL 엔진 정책·실제 SQLite↔SQL **6/6**. 새 복구 9개와 SQL 2개: 재반영·서버 재수정·숨김·철회·없는 사본·잘못된 owner/service/scene·stale draft·migration/개인 저장 rollback·응답 유실 후 같은 요청 확인. SQL은 기존 게시 후 upgrade와 비로그인/다른 사용자/owner 없는 인증·숨김/철회 접근도 검사했다. SDK 인증 헤더 분리 검사에 관리 조회를 추가했다.
- TypeScript·lint(오류/경고 0), Android JS/Hermes 컴파일 **1,737 modules·30 assets** 통과. Node SQLite experimental 및 기존 색상 환경 경고는 있었으며 검사 실패는 없었다. 실제 Supabase Auth/PostgREST·원격 migration 0005·Android 복구 화면·기기 DB migration/프로세스 종료·최종 사용자 인수는 **미실행**이다. 로컬 엔진/합성 HTTP 통과는 실제 전달 검증이 아니다.
- 앱·에뮬레이터·개발 HTTP 서버·새 native APK 빌드/설치·의존성 다운로드는 실행하지 않았다. [공유 안내](../supabase/README.md#버전-충돌에서-복구)에 0001→0005 적용과 실제 충돌 재현 순서를 갱신했다. #34·33의 사람 완료 상태는 유지한다. 공통 소유권/흐름은 유지하며 세부 계약을 기존 명세·공유 안내에 기록했다. 다른 스레드의 공통 ARCHITECTURE 등 미커밋 변경은 포함하지 않는다.

## 2026-11-07 공유 제한의 재시도 시각 (#34 보완)

- 남은 조건 대조에서 SQL의 `rate_limited`에 재시도 시각이 없는 것을 확인했다. 기존 상세 설계 §7의 누락을 구현했으며 새 횟수 정책/제품 기능을 추가하지 않았다. 읽기 전용 프로세스 조회에서는 adb·emulator/qemu·Node 실행 항목이 없었으므로 기존 기기 실행 증거를 재사용하지 않았다.
- migration 0004는 원래 write/report 규칙을 내부 함수로 유지하고 공개 RPC 거절에 retryAt만 추가한다. owner lock, 내부 EXECUTE 차단, 기존 데이터·replay·철회·중복 신고를 보존한다. 횟수를 초과한 이벤트 수도 고려해 해당 순위의 만료 시각을 계산한다. 분/일 조건이 겹치면 늦은 시각, 신고는 시간별 기준이다. 시간은 초 경계 뒤로 올린 UTC ISO 값이다.
- SDK는 완료된 HTTP 400/P0001/rate_limited에서만 제한 정보를 파싱한다. 형식·달력·크기를 검증하고 그 외 details는 UI에 보내지 않는다. 5xx는 같은 본문이어도 불확실 상태다. Editor/신고는 기기 현지 재시도 시각 또는 일반 제한 안내를 표시하며, 초안·기존 공개 version·동의 snapshot을 유지한다. 안내는 이번 시도의 반환값이며 자동 재전송/예약과 SQLite schema 변경은 없다.
- 실행: 앱 메시지/SDK 검사 68/68, 실제 PostgreSQL 엔진 정책·SQLite↔SQL 검사 4/4. SQL에서 기존 게시 후 upgrade·분/일/시간 제한·동일 요청·중복 신고·철회·기간 만료·권한을 확인했고, 앱 SQLite↔SQL의 공개 수정 제한에서 새 초안/기존 공개 본문 보존도 확인했다. 실제 SDK 합성 HTTP에서 details 전달·잘못된 피드백·5xx 구분과 요청 추가 없음 검사도 통과했다.
- TypeScript·lint(오류/경고 0), Android JS/Hermes 컴파일(1,736 modules·30 assets), 문서/diff 검사 통과. 실제 Supabase Auth/PostgREST·원격 migration·Android 안내 표시/동작은 미실행이며 로컬 엔진/가짜 HTTP 통과가 이를 대체하지 않는다.
- 앱·에뮬레이터·개발 HTTP 서버·새 APK 빌드/설치·새 의존성 다운로드는 실행하지 않았다. 프로젝트 준비 후 0001→0004 적용 및 A/B 직접 API·Android 제한/철회 안내를 확인한다. #34 완료 체크는 유지한다. 공개 RPC/소유권·화면 흐름 책임은 같으며 상세 SQL/반환 계약은 supabase/README에 기록해 공통 ARCHITECTURE는 수정하지 않았다.

## 2026-11-07 사진 입력·작성·쪽지 표시와 모션 (#32·36 부분 적용)

- 사진 입력·공통 장면 조작·작성면에 같은 Action·토큰·글자 규칙을 확장했다. 선택 사진 읽기 실패는 현재 photoId가 일치할 때만 표시하고, 읽기/작성의 native focus 대상은 공통 버튼 내부 Pressable ref로 유지했다. UI 교체로 사진·초안·공개 선택·좌표·서버 계약을 바꾸지 않았다.
- `createReaderPresentation(sync/finish/hide)`는 요청과 독립된 표시 상태다. 닫기는 controller.close로 즉시 무효화하고 마지막 표시만 퇴장 동안 유지한다. 같은 쪽지의 loading/본문/오류 갱신은 진입을 재시작하지 않으며 방향과 재확인 중 anchor를 유지한다. 다른 ID에는 이전 anchor를 재사용하지 않는다.
- `useReaderMotion`: native Modal onShow 뒤 진입 220ms opacity+8dp, 닫힘 140ms. 감소 설정에서는 이동/지속시간 제거. 닫는 동안 배경 터치·접근을 차단하며 완료 후에만 표식/대체 대상으로 focus를 돌린다. 이탈·백그라운드·편집 전환은 즉시 hide하여 이전 완료 콜백을 폐기한다. 뒤로가기가 이미 읽기 요청을 취소했는데 모션이 새 요청을 다시 여는 경로를 만들지 않는다.
- 유리 후보 복제 이미지는 변형 전 card frame을 기준으로 배치하고 모션 이동을 반대로 보정한다. 측정용 native View는 flatten하지 않는다. 기존 blur 12·흰 tint·불투명 대체를 유지했다. 실제 카드 배경 정렬/큰 글자/Native Modal/접근성·성능·광학 굴절 검증은 미실행이다.
- 표시 상태 회귀 9개 추가: 진입 중 닫기·반복 닫기·퇴장 중 재열기·오래된 완료·동일/다른 글 갱신·현재 페이지 밖 글 앵커·즉시 hide·실제 읽기 controller의 늦은 응답 차단. `test:messages` 65/65, content 6/6·photo 8/8·recognition 14/14로 합계 93/93 통과. TypeScript·lint(오류/경고 0), Android JS/Hermes 컴파일(1,735 modules·30 assets) 통과. 상태/로직·컴파일 검사이며 native 모션 실행 증거는 아니다.
- 새 의존성/자산 다운로드·새 APK 빌드/설치·앱·에뮬레이터·개발 HTTP 서버 실행은 하지 않았다. 실제 Android에서는 진입 직후 닫기/연타/뒤로·현재 페이지 밖 링크 재확인·회전·200% 글자·긴 본문·동작 감소·불투명 전환·복제 배경 정렬·TalkBack/외부 키보드 focus와 편집 전환을 확인해야 한다.
- #32의 기기 검수와 #36의 1/4는 유지한다. 사용자 비교·최종 시각 승인은 미검증이다. 기존 상세 설계의 표시/모션 계약을 구현했으며 공통 ARCHITECTURE/모델·서비스 계약은 변경하지 않았다.

## 2026-11-07 R3 홈·이야기·내 글 공통화 (#36 부분 적용)

- k-style 원본/프로젝트 R3 CSS·상세 설계를 대조하고 `ui/theme`, `TapArea`, `Action`을 추가했다. Spoqa 400/700·흰색/먹청색·20dp 여백·28/38 이야기·17/29 본문·14/21 출처·48dp 이상 조작을 공유한다. 새로운 폰트/이미지/의존성은 추가하지 않았다. 원본 vendor/MIT는 보존했다.
- 홈 대표 사진의 원본 비율, 이야기 입구·장소 선택·실제 공개 미리보기, 상세의 첫 이야기 → 쪽지 → 나머지 펼침, 내 글의 로딩/빈/실패·초안/공개 상태·편집/위치/삭제 구성을 적용했다. 사진 오류에서 같은 면의 재시도, 내 글 화면 이탈 뒤 늦은 편집 응답 차단을 추가했다. 하단바는 불투명이고 선택 표식·tabPress/longPress 이벤트를 유지한다.
- TapArea는 크기/터치를 축소하지 않는 opacity 1→.96(100ms)/복귀(140ms), ReduceMotion.System, focus 테두리·disabled 정리를 사용한다. React Compiler 호환 get/set API로 구현했다. 기본 텍스트 3색의 흰 배경 명목 대비는 12.95/6.42/4.90, 눌림 합성 시 11.47/5.83/4.57로 계산했다. 실제 픽셀/가독성/접근성 통과 판정은 아니다.
- 실행 검사: content 6/6 + photo 8/8 + recognition 14/14 + messages 56/56 = 84/84. typecheck·lint(오류/경고 0), Android JS/Hermes 컴파일(1,733 modules·30 assets) 통과. 스타일 상수를 그대로 복제한 테스트는 추가하지 않았다. 기능 로직 검사와 UI 코드 컴파일이며 새 화면의 실제 터치/표시를 실행한 검사는 아니다.
- 앱·에뮬레이터·개발 HTTP 서버·새 APK 빌드/설치는 실행하지 않았다. 사용자 Android에서 360/390/430dp와 글자 100/200%, 사진 재시도·이야기 선택/펼침/스크롤 복귀·내 글 이어쓰기/삭제·키보드·동작 감소·TalkBack/포커스 순서를 확인해야 한다. #36 완료 체크 1/4를 유지한다.
- 사진 입력·공통 사진/유리 쪽지의 전체 스타일·모션·광학 효과는 후속 적용/기기 검수가 남는다. 최종 UI 승인·사용자 비교 우수성·기능 인수를 주장하지 않는다. 기존 디자인 기준의 적용이어서 공통 설계/ARCHITECTURE는 바꾸지 않았다.

## 2026-11-07 위치 요청·복구 경계 (#31 보완)

- `createLocationController`와 `nativeLocation`으로 foreground 권한·서비스 사용 가능 여부·단일 위치 조회를 분리했다. `clear/refreshAge`를 취소·화면 이탈·백그라운드/복귀에 연결하고 15초 대기 상한 뒤의 응답을 무효화한다. OS 위치 요청의 강제 중단이나 기기 동작을 단위 검사로 보장하지 않는다.
- 유효한 위치에서만 근정전·교태전·광화문을 가까운 순서로 정렬하고 근사 직선 거리를 표시한다. 약한/오래된/없는 위치는 거리를 숨긴 목록으로 복구한다. 좌표는 건물 도형의 중심이며 입구·도보 경로·방문 인증이 아니다. 권한 재요청 불가와 위치 서비스 꺼짐에 각각 설정 버튼을 추가했다. 실제 설정 창과 권한 복귀는 Android 검수 전이다.
- `test:messages` 56/56 통과(위치 controller 12 + 좌표/거리/정렬 3 포함). 기존 저장·장면·공유 검사도 함께 통과했다. 가짜 권한/위치·시계로 취소 시점 3종, timeout 이후 성공/실패, 재요청 경합, 정확도/시각 경계, 타이머 중단 뒤 만료 재검사, 권한·서비스 오류를 확인했다.
- typecheck·lint(오류/경고 0), `check:android-bundle`(1,730 modules, 30 assets) 통과. 렌더 중 시각 조회는 사용하지 않고 controller가 검증한 시각을 상태에 포함한다. 실제 Android UI 실행/접근성·권한창·GPS·지도 타일·설정 연결·새 APK 설치/빌드는 미실행이다. 앱·에뮬레이터·개발 HTTP 서버는 실행하지 않았다.
- 사용자 확인: 주변 장소 진입 때 자동 권한창 없음 → 직접 장소 선택 → 현재 위치 버튼의 허용/거부/재요청 불가 → 기기 위치 서비스 끔/설정 복귀 → 확인 중 취소·화면 이탈·앱 백그라운드 → 실제 좌표/정확도/만료와 거리 순서. 지도 타일은 별도 Google Maps 키 및 새 native 빌드 후 확인한다. #31 완료 체크는 기기 증거 수신 전 유지한다.
- 기존 Sprint 1 위치 계약을 구현/보완했으며 인식에 위치를 결합하지 않았다. 사용자 가치 비교와 현장 방문 검증은 미실행이다. 계약·구조 결정 변경이 없어 공통 설계/ARCHITECTURE는 수정하지 않았다.

## 2026-11-07 인식 요청·취소 경계 (#30 부분 구현)

- `createRequest/recognize/cancelRecognition`과 사진 화면 연결: 요청·사진·콘텐츠 ID 일치, 한 번에 한 native 작업, 30초 UI 대기 상한. 취소/시간 초과는 native 종료가 아니며 실제 Promise 종료 전 재요청은 BUSY다. 화면 이탈·백그라운드 전환·사진 교체/해제에서 적용을 무효화한다.
- adapter 반환의 지원 장소·rank·유한 score·정렬·모델/전처리/정책 버전을 검사한다. 미검증 정책은 identified를 허용하지 않는다. photo-only이며 파일 삭제·업로드·위치 결합은 없다. 실제 adapter는 작업이 끝난 뒤에만 Promise를 완료해야 한다.
- 실행 결과: `test:recognition` 14/14, `test:photo` 8/8, `test:content` 6/6, typecheck 및 lint(경고 0) 통과. 취소 직후 응답, 취소/timeout 후 native 잠금 유지, 늦은 성공/실패, 중복 요청, 입력·버전 교체, 잘못된 결과와 정책 보류를 가짜 runtime으로 확인했다.
- `check:android-bundle` 통과: 1,728 modules, 30 assets, Android Hermes 묶음 생성. 컴파일 검사이며 Android에서 코드를 실행한 증거는 아니다. native dependency 변경·APK 재빌드/설치·앱/에뮬레이터/개발 HTTP 서버 실행은 하지 않았다.
- `nativeRecognition.ts`는 runtime=null이므로 현재 제품은 MODEL_NOT_READY 안내와 직접 선택을 제공한다. 모델 artifact·실제 decode/preprocessing/inference·PC↔Android parity·기기 시간/메모리·화면 이벤트/접근성 검수는 미실행이다. #30 완료/사람 확인으로 집계하지 않는다.
- 사용자가 실행해 확인할 최소 경로: 사진 선택 → 장소 찾기 → 미탑재 안내 → 장소 직접 선택 → 기존 이야기 화면. 실제 취소·30초 대기·확정 결과 이동은 runtime 연결 후 기기에서 추가 검증한다. 공통 설계 계약을 구현한 변경이며 ARCHITECTURE/설계 수치는 바꾸지 않았다.

## 2026-11-07 Android JS/Hermes 내보내기 (#35 준비)

- native Debug APK에는 최신 JS 묶음 생성 검사가 별도로 필요하다. 설치된 Expo 57 CLI의 export→instantiateMetro에서 mockServer=true 분기를 확인했다. runServer는 해당 분기에서 listen 이전에 반환하므로 HTTP 서버/포트를 열지 않는다. 출력의 Starting Metro Bundler는 파일 내보내기 엔진 시작이며 expo start/앱 실행이 아니다.
- Android export 성공: 1,726 modules, 30 assets, Hermes entry bytecode 4,635,928 bytes. HBC SHA-256 713dd9dff9d130c9fdc41f99b49e0c09eab40624794b38a2b77e83497a5cea5f. D:/Android/Projects/visual-travel-guide/android-export-20261107에 보관. 전체 산출물 6,993,668 bytes. 사진 3개·Router 리소스를 포함하며 앱의 Spoqa TTF는 앞서 확인한 native APK 리소스다.
- 재현 명령 `npm run check:android-bundle` 추가. 첫 sandbox 실행은 Hermes가 AppContainer 임시 경로의 hbc에 쓰지 못해 실패했다. 자식 프로세스 TEMP/TMP를 Git 제외 .codex-build/android-bundle-temp로 지정해 재실행 성공했다. 기본 출력은 .codex-build/android-bundle-check. 스크립트 lint·diff 검사 통과.
- 위 해시는 D:에 생성한 실행 산출물의 식별값이다. 반복 명령의 C: 산출물과 해시는 달랐으며 바이트 단위 재현성을 통과했다고 판정하지 않았다. 두 실행의 컴파일 성공과 재현 가능한 검사 절차를 확인한 것이다.
- 환경 파일 읽기/CLI 네트워크/telemetry를 끄고 외부 서비스 설정 없는 기준으로 컴파일했다. 실제 Supabase 연결 상태나 JavaScript를 기기에서 실행한 결과는 아니다. 앱 설치·앱/에뮬레이터/개발 HTTP 서버 시작 없음. 모델·지도 키·실서비스·사용자 검증은 남아 있다.

## 2026-11-07 새 네이티브 APK 빌드 (#35 준비)

- 소스 기준 76ccf14 + Windows object path plugin. prebuild는 통과했으나 Android 생성 폴더를 다시 만들었고 app build/.cxx Junction을 복원했다. 기존 APK/캐시는 보존하고 새 대상은 D:/Android/Projects/visual-travel-guide/app-build-20261107-s1 및 app-cxx-20261107-s1이다. D:/Android/vtg는 C: 저장소를 가리키는 폴더 Junction이다. 새 드라이브 생성·소스 이동 없음.
- 오프라인 첫 시도는 PowerShell의 점 포함 -P 인수 분리로 실패해 인용했다. 다음은 Play Services location 21.0.1 메타데이터/아카이브가 캐시에 없어 실패했다. SDK 자동 설치를 막은 채 누락 Gradle 라이브러리를 D: 캐시에 받은 빌드는 Kotlin/Java를 통과했지만 Ninja 오브젝트 상대 경로 309자로 실패했다. 로그 1~4는 .codex-build/app-sprint1-20261107-build*.log에 보존한다.
- CMake 경로 제한 180만으로는 긴 출력 디렉터리 때문에 해시가 적용되지 않았다. Windows 전용 Expo plugin으로 CMAKE_OBJECT_PATH_MAX=240을 설정하고 더 짧은 D:/Android/vtg에서 재생성·빌드했다. 문제 오브젝트 경로가 309→169자로 줄어든 것을 build.ninja에서 확인했다. plugin 중복 적용/예상 밖 구조 차단 검사 및 JS lint 통과.
- 최종 명령: 아래 README의 SDK 자동 설치 금지·오프라인·x86_64·최대 worker 2 명령. Kotlin incremental을 끄고 in-process로 실행해 C:/D: 캐시 fallback을 피했다. BUILD SUCCESSFUL in 9m 29s, 473 tasks(441 executed/32 up-to-date). 마지막 실행은 캐시를 재사용한 것이며 전체 준비 시간은 아니다. Java 탐지·deprecated API·Gradle 경고가 남아 무경고 빌드로 해석하지 않는다.
- APK: mobile/android/app/build/outputs/apk/debug/app-debug.apk → D: 출력 폴더. 96,688,076 bytes, SHA-256 90db726260b3c14483394dfe169cbaac5588cddb7a52d729af1515507c3f3914. com.visualtravelguide.app / 0.1.0(1), minSdk24/target36, ABI x86_64만 포함. TTF 400/700, SQLite .so 및 SQLite/SecureStore/Location/Maps 클래스 포함 확인.
- aapt/최종 Manifest: CAMERA와 foreground COARSE/FINE_LOCATION 포함, RECORD_AUDIO 없음, allowBackup=false. 설치·앱/에뮬레이터/Metro 실행은 하지 않았다. 이 APK는 Metro가 필요한 Development Build이며 JS 화면·모델·서버·실기기 성능·ARM 지원을 검증한 결과가 아니다.

## 2026-11-07 실제 SDK·주입 HTTP 검사 (#34)

- Native 연결에서 SDK gateway를 분리하고 실제 Supabase JS 2.119.0에 HTTP 응답을 주입했다. 가짜 SDK로 대체하지 않았다. 테스트용 JWT/refresh 문자열은 합성 자료이며 실제 계정·키·환경 파일을 읽거나 네트워크를 호출하지 않았다.
- 메시지 전체 43/43(추가 SDK 검사 4개), 기존 SQL 통합 2/2, 타입·린트 통과. 익명 가입→보관 후 인증 RPC, 만료 토큰 갱신/회전→보관 후 RPC, 공개 읽기에 작성자 토큰 미포함을 확인했다.
- 검사 중 서버 5xx의 P0001 본문을 확정 거부로 잘못 취급하는 동작과 이미 취소된 요청의 미처리 Promise 거부를 재현해 수정했다. HTTP deadline은 헤더 수신이 아니라 JSON 본문 소비까지 유지하며 빈 204 신고 응답도 처리한다.
- HTTP 요청 1회당 15초이며 SDK의 내부 재시도까지 포함한 전체 사용자 작업의 15초 상한을 입증한 것은 아니다. 실제 Supabase Auth·PostgREST·Android Fetch/SecureStore·두 기기 전달은 여전히 미검증. Android 앱·Metro·에뮬레이터·서버 실행 없음.

## 2026-11-07 R3 홈 공개 쪽지·뼈대 로딩 (#36)

- 홈 장소 선택 아래 공개 글 최대 1개의 사진·본문 미리보기를 연결했다. 누르면 해당 sceneId/messageId로 이동하고 뒤로 홈에 복귀한다. 개인 글·개발 fixture·인기/추천 수를 사용하지 않는다. 설정 없음/공개 글 없음/오류이면 생략하고 홈 탐색을 유지한다.
- homePreview의 늦은 응답·이탈·재조회·잘못된 장소/본문/개수 검사 4개 추가, 메시지 전체 39/39 통과. SQL 통합 2/2에서 비로그인 미리보기와 숨김 제외 확인. Windows 대소문자 충돌로 처음 타입/린트가 실패해 표시 컴포넌트를 HomePreviewCard로 구분했다.
- Skullet 770cba4의 React Skeleton과 constants·MIT를 확인하고 이미지/텍스트 뼈대·1200ms pulse를 RN View/Reanimated로 각색했다. 출처와 라이선스는 assets/licenses에 보관한다. 브라우저 DOM 측정 코드를 RN에서 실행하지 않는다. 실제 비동기 대기 중인 홈 미리보기·쪽지 본문에만 표시하며 동작 감소/앱 비활성 때 정지한다.
- 새 네이티브 의존성·데이터셋 다운로드는 없다. 실제 Supabase/Android 홈 표시·서체·모션·큰 글자·TalkBack은 미검증이며 #36 최종 시각 승인이 아니다. 대상 개발 프로젝트에 migration 0003(home_preview)까지 순서대로 적용해야 한다.

## 2026-11-07 공유 경계 회귀 보완 (#34)

- 새 회귀 검사로 중복/페이지 밖 공개 응답을 오류로 표시하면서 표식을 남기는 문제를 재현했다. 거절된 응답은 전체 폐기하도록 수정했다. 개인 글만 유지하며 오류 상태를 표시한다.
- `editorAction`을 작성 화면에 연결해 미확인 게시·철회 결과 확인이 현재 초안의 빈 본문·나만 보기 선택에 막히지 않도록 했다. 공개 수정 거부 후에도 철회 경로를 제공하며 공개 상태를 못 읽으면 저장/버리기를 허용하지 않는다. 게시 호출 도중 오류가 나면 기기에 보존된 job을 다시 읽어 다음 행동을 결정한다.
- 작성자 작업 큐 안에서 최신 게시 job을 읽도록 변경해 대기 중 호출이 이전 요청 상태를 재사용하지 않게 했다. 메시지/회귀 검사 35/35, SQL 통합 2/2, 타입·린트 통과. Android 화면 검증은 실행하지 않았고 실제 서비스 설정·A/B 검증은 남는다.

## 2026-11-07 공개 읽기·신고 연결 (#34 후속)

- 공통 사진의 제품 경로에 개인 글/공개 글 병합과 비로그인 RPC 읽기를 연결했다. 공개 응답은 본문·좌표·페이지를 검사하며, 서버 snapshot·마이크로초 시각·ID 순서로 60개씩 이동한다. 공개 실패는 개인 글을 유지하며 오류를 표시한다. 공개 글이 사라지면 이전 개인 사본으로 대체하지 않는다.
- 다른 사람의 공개 글에서 4개 신고 사유 선택→익명 세션→서버 접수 결과를 연결했다. 화면 복귀/foreground에 재검증하고 읽는 글은 활성 상태에서 30초마다 재확인한다. 실시간 갱신은 아니며 통신 실패 때 최신 상태를 단정하지 않는다.
- 메시지 검사 32/32, SQL 통합 2/2, 타입·린트 통과. 145개 혼합 페이지 중복/누락, 개인 본문 비전송, 잘못된 공개 응답, 숨김 후 읽기 불가, 갱신 중 닫기의 경합을 검사했다. PostgreSQL 검사는 실제 앱 조회 adapter를 사용한다.
- 실제 Supabase 프로젝트·Auth·PostgREST 네트워크·Android 표시/신고/앱 복귀·두 기기 전달은 미실행. 두 번째 migration인 read_snapshot도 대상 개발 프로젝트에 적용해야 한다. 사용자 확인 전 #34는 열린 상태로 유지한다.

## 2026-11-07 익명 세션·작성 화면 연결 (#34 후속)

- Supabase JS 2.119.0·SecureStore 57.0.4 추가. 동적 Expo 설정 때문에 install의 자동 플러그인 추가 단계가 종료 코드 1을 반환했고, app.json에 SecureStore 플러그인을 명시한 뒤 실제 Expo config의 플러그인 포함·Android backup 비활성을 확인했다.
- 작성 화면에 설정된 프로젝트의 공개·철회·미확인 요청 재확인을 연결했다. 설정 없으면 기존 비활성 동작을 유지한다. 실제 프로젝트 접속·사용자 생성·게시 요청은 실행하지 않았다.
- `test:messages` 26/26: 추가 세션 검사 4개로 안전 저장 중단, 조각 손실, 저장 실패 후 동일 작성자 재시도, 동시 호출, 만료·읽기 오류·다른 소유자, refresh 후 저장 실패를 확인했다. 기존 SQLite↔서버 SQL 2/2, 타입·린트 통과.
- 안전 세션은 기기 암호화 저장소에만 저장하고, 매번 복원/갱신·보관을 마친 뒤 RPC를 수행한다. 새 SDK의 실제 네트워크 인증 및 SecureStore native 동작은 이 주입 검사로 판정하지 않는다. Android 새 빌드·세션 복원·화면·공개 목록 병합·신고·A/B 검증이 남았다. 앱·에뮬레이터·Metro를 시작하지 않았다.

## 2026-11-07 공개 요청의 내구성 (#34 후속)

- `test:messages` 22/22. 추가된 6개는 공개 동의/원자적 요청 저장, v1 migration, 응답 유실 후 파일 DB 재열기, 수정 초안 보호, 동일 요청 재시도/중복 누르기, 잘못된 작성자·서비스 차단, 기기 확인 저장 실패, 공개 철회·개인 전환, 수정 거부 후 기존 공개 사본 보호를 검사했다.
- `supabase/tests/npm test` 2/2. 실제 앱 SQLite 저장소·게시 controller·RPC adapter와 migration SQL을 함께 호출해 게시→응답 유실→같은 요청 상태 확인→철회→개인 저장을 검사했다. 네트워크 연결이나 실제 Supabase Auth 세션은 사용하지 않았다.
- typecheck·lint 통과. 앱·에뮬레이터·Metro·DB 서버 실행 없음. 공개 UI는 계속 비활성이다. 익명 세션의 안전한 저장·설정·게시 UI·공개 읽기 병합·신고와 실제 A/B 전달 검사가 남아 있어 #34는 완료하지 않는다.

## 2026-11-07 R3 홈·공통 사진·기기 저장

- [상세 설계](../docs/design/APP_SPRINT1_SPEC.md) 기준. 세 곳의 이미지 해시와 좌표, 겹침·페이지 이동, 오래된 읽기 무효화, 실제 SQLite 파일 재열기·rollback·초안 보존, 거리/위치 품질을 호스트에서 검사했다. `test:messages` 16/16, 기존 콘텐츠 6/6·사진 8/8, typecheck·lint 통과. 저장 시각이 같은 글 61개도 페이지에서 중복되거나 누락되지 않았다.
- [공유 migration·권한 테스트](../supabase/README.md)는 별도 in-process PostgreSQL 1/1 통과. 로컬 역할로 검사했으며 실제 Supabase 세션/원격 전달/Android에서의 게시 증거가 아니다. 공개 선택 초안은 기기 안에만 남는다.
- SQLite 57.0.4, Location 57.0.23, react-native-maps 1.27.2를 lockfile에 추가했다. Expo 앱 설정에서 Android 백업 비활성, 지도 키 미설정 상태, 신규 플러그인 목록을 검사했다. 공식 TTF 두 파일은 upstream Git blob hash를 대조했다. 새 native 빌드·폰트 렌더·Android GPS/지도 타일·기기 재실행·TalkBack/큰 글자는 미실행이다.
- 온라인 Expo 의존성 검사는 기존 expo/constant(s)/dev-client/image-picker/router 다섯 패키지의 새 패치 권장으로 종료 코드 1. 설치된 SDK 로컬 기준의 offline check는 통과했으나 온라인 검사 대체가 아니다. 기존 Windows native 빌드 보정은 함께 바꾸지 않았다. npm 설치 시 전체 트리 audit 20건(높음 5)이 표시됐으며 이 변경으로 생긴 취약점 수로 해석하지 않는다.
- 사용자가 직접 하는 [새 APK 검사 순서](README.md#이번-변경을-직접-확인하기)와 [이슈 지도](https://github.com/HyunKN/visual-travel-guide/issues/27)를 따른다. 이번 변경에서 AI가 Android 앱·에뮬레이터·Metro·DB 서버를 실행하지 않았다.

## 2026-11-05 장소 설명·사진 입력 (#28·#29)

범위: [#28](https://github.com/HyunKN/visual-travel-guide/issues/28) 직접 선택·설명·복귀와 [#29](https://github.com/HyunKN/visual-travel-guide/issues/29) 사진 입력. 진행 원본은 해당 Issue이며 이 기록은 검사 시점의 근거다. Story·Sprint 완료 SP, 사용자 가치, 모델 인식 성능의 증거가 아니다.

- 콘텐츠 조회 `npm run test:content` 6/6, 사진 상태 `npm run test:photo` 8/8, `npm run typecheck`, `npm run lint`, `npm run check:dependencies` 통과. SDK 57.0.31·RN 0.86.3에 `expo-image-picker ~57.0.20`을 SDK 호환 설치 명령으로 추가했다. 사진 API·설정은 [SDK 57 공식 문서](https://docs.expo.dev/versions/v57.0.0/sdk/imagepicker/)와 설치된 타입/소스를 대조했다.
- `expo prebuild --platform android --no-install`은 기존 생성 폴더를 다시 만들었다. D:의 기존 앱 build/.cxx 대상은 보존하고 동일 Junction을 복원했다. V:는 이번에 만들지 않은 기존 저장소 연결이다. C:/V:가 섞인 RN codegen의 `different roots` 오류를 두 번 재현했다. 작업 폴더만 V:로 맞추는 것으로는 해소되지 않았다.
- RN Gradle plugin 0.86.3의 `File.cliPath`가 다른 드라이브에도 `relativeTo`를 호출하는 것을 확인해 [한정 설치 보정](scripts/fix-windows-gradle-path.cjs)을 추가했다. 같은 드라이브는 기존 상대 경로를 유지하고 다른 드라이브는 절대 경로를 사용한다. 적용과 재적용 검사를 수행했으며 이후 실제 codegen 단계와 APK 빌드를 통과했다. 생성된 Android 소스나 전역 설정을 직접 수정하지 않았다. Kotlin incremental cache도 경로 충돌을 보고했지만 빌드 도구의 non-daemon fallback으로 컴파일됐다. 무경고 빌드나 완전한 경로 문제 해결을 뜻하지 않는다.
- V: 작업 경로·D: SDK/Gradle, x86_64 `:app:assembleDebug --max-workers=2` 성공: 19m 28s, 455 tasks 중 425 executed / 30 up-to-date. 캐시를 재사용한 개발 빌드다. APK 90,058,037 bytes, SHA-256 `98d118a362a00de655d433617e66e96fdd2963a821e0e0f5c75a18b91a58968a`, package `com.visualtravelguide.app`, ABI x86_64. aapt에서 CAMERA와 RECORD_AUDIO 미포함을 확인했다. `adb install -r` 성공.
- 새 APK·Metro localhost:8083·`emulator-5554` API 36에서 세 장소 선택 → 각 장소의 첫 이야기 → 출처 → Android 뒤로가기 → 상세 스크롤 위치 유지 → 홈 스크롤 위치 유지를 모두 통과했다. 없는 장소 ID는 오류에서 지원 장소 선택으로 복귀했다. 사진의 원본 높이/크기가 화면을 넘던 문제를 수정하고 홈·상세 캡처에서 사진과 제목·본문 표시를 확인했다.
- 원문 열기는 Chrome의 `FirstRunActivity` 진입과 Android 뒤로가기 후 앱 출처 화면·홈 복귀를 확인했다. 브라우저 초기 설정을 대신 승인하지 않았으며 원문 네트워크 로딩은 판정하지 않았다.
- 사진 입력은 시스템 권한 거부 후 안내, 갤러리 선택 → 미리보기, 재선택 취소 → 이전 사진 유지, 가상 카메라 촬영 → Done → 앱 미리보기, 촬영 취소 → 이전 사진 유지, 선택 해제 → 재선택 → 해제 → 홈 복귀를 확인했다. 권한을 더 이상 요청할 수 없을 때 `설정 열기`가 표시됨도 확인했다. 테스트로 바꾼 CAMERA 고정 거부 플래그를 제거하고 기존 허용 상태를 복구했다.
- 에뮬레이터의 `Pictures/VTG_QA/app29-fixture.jpg`는 이번 검사에서 넣은 근정전 공식 사진이다. 재선택·해제 후 원본 SHA-256이 `fccf05b39ca410d775ea11b00d2d53877556593d1e38c9babe792a1e94cc51bd`로 그대로임을 확인했다. 사람 확인에 쓸 수 있도록 이 테스트 사진은 남겼다. 카메라 사진은 에뮬레이터의 가상 장면이며 실제 관광지 촬영 증거가 아니다.
- `확인 대기` 라벨을 생성·적용할 수 있음을 GitHub connector로 확인했다. 최신 Workflow에 따라 기능을 구현하고 AI 검사를 통과해도 Issue를 열린 상태로 두고 사람이 확인한 뒤 종료한다. 기능 최종 완료 수·Story SP를 자동으로 올리지 않는다.
- 원본 근거는 Git 제외 `.codex-build/app-28-qa/`, `app-29-qa/`, `app-29-build*.log`다. 공식 사진 원본과 출처/이용 조건/해시는 `src/features/place-content/catalog.json`에 있다. 촬영일을 모르는 자료는 추정하지 않고 null로 남겼다.
- 기존 근정전 메시지 시안 진입 → 흔적 열기 → 추천수 표시 → 닫기 → 같은 사진 복귀와 개발 실행 확인 화면의 이동·뒤로가기 회귀 검사도 통과했다. 새 입력 기능이 실제 글 저장·공유를 추가한 것은 아니다.
- 실기기·ARM 빌드, 독립 실행 release APK, Android Activity 강제 종료 후 입력 복구의 실제 기기 검사, 모델 추론·위치·실제 글 저장/공유, 사람의 어투·흥미 비교는 미실행이다. 복구 결과 변환은 단위 검사만 통과했다. 사진 선택기에 새 모듈이 필요한 만큼 기존 APK에 JS만 갱신한 상태는 이 APK 검사의 대체가 아니다.

## 2026-11-04 앱 빌드 산출물 D: 이동

- 새 `mobile/android/app/build`(1,175,150,088 bytes, 1,008개 파일)와 `mobile/android/app/.cxx`(131,561,196 bytes, 141개 파일)를 `D:\Android\Projects\visual-travel-guide\app-build-rebuild-20261104`, `app-cxx-rebuild-20261104`에 각각 복사했다. 파일별 상대 경로·크기와 APK SHA-256을 대조한 뒤 기존 위치에 각 D: 폴더를 가리키는 NTFS Junction을 만들었다.
- 연결 후 V: 가상 경로에서 x86_64 `:app:assembleDebug` 증분 빌드 성공(455 tasks 중 19 executed / 436 up-to-date). 에뮬레이터 `emulator-5554`의 기존 개발 앱 시작 화면과 Metro 응답을 확인했다. 새로 설치하거나 버튼을 다시 누른 검사는 아니다. 로그·UI tree: Git 제외 `.codex-build/android-build-d-drive-20261104.log`, `vtg-d-storage.xml`.
- 증분 빌드가 일부 중간 파일을 바꾸어, 이동 전 원본은 별도 D: `app-build-before-link-20261104`, `app-cxx-before-link-20261104`에 추가 보관했다. 파일별 경로·크기와 APK 해시를 대조한 후 C: 중복 두 폴더만 제거했다. 이 검사는 APK 외 모든 파일의 해시를 전수 비교한 것은 아니다.
- C: 여유 약 9.57 → 10.78 GiB, D: 약 361.1 → 358.87 GiB(시점별 값). SDK·AVD·Gradle은 원래부터 D:였다. 앱 소스와 JavaScript `node_modules`는 C:에 유지한다. native 폴더 재생성이나 의존성 재설치는 Junction을 제거할 수 있으므로 재생성 후 다시 확인한다. 새 부팅·빈 캐시 빌드·실기기·제품 기능은 이 검사 범위가 아니다.

## 2026-11-04 native 재생성·재빌드·재설치 확인

- 기존 `mobile/android`를 `.codex-build/android-prebuild-backup-20261104`에 보관하고 native 폴더가 없는 상태에서 Expo prebuild `--platform android --no-install`을 실행해 새 폴더를 생성했다. 기존 `app/build` Junction과 D: 대상 및 기존 APK를 보존했다. package.json 변경은 없었다.
- C:의 긴 경로에서 x86_64 debug 빌드는 `ninja: ... Filename longer than 260 characters`로 실패했다. 실패한 앱 `.cxx`와 autolinking 생성물은 같은 폴더에서 이름을 바꿔 보관한 뒤 `subst V:`로 저장소를 짧은 가상 경로에 연결해 재시도했다. V:는 C: 저장소를 가리키는 가상 드라이브이며 별도 디스크가 아니다.
- V: 경로, D: SDK·Gradle에서 `:app:assembleDebug -PreactNativeArchitectures=x86_64 --max-workers=2` 성공: 455 tasks 중 76 executed / 379 up-to-date, 9m 44s. 앞선 실패 시 생성된 Gradle·모듈 캐시를 재사용했으며 완전히 빈 캐시 빌드는 아니다. 새 APK는 89,552,093 bytes, SHA-256 `83bb16130f6ea294a63f013d86a7105eb32b7d3bd771fece913f884d2ca22a33`, package `com.visualtravelguide.app`, x86_64다.
- `adb install -r` Success, `emulator-5554`에서 Metro 연결 후 시작 화면과 상세 버튼 시각 표시, UI tree 기준 탭 → 상세 문구 → Android 시스템 뒤로가기 → 시작 화면 복귀를 확인했다. 근거는 Git 제외 `.codex-build/android-rebuild-20261104.log`, `android-rebuild-shortpath-20261104.log`, `vtg-rebuild-home.png`, `vtg-rebuild-home.xml`, `vtg-rebuild-detail.xml`, `vtg-rebuild-back.xml`이다. 시안 버튼은 표시만 확인했으며 해당 기능을 이번 재설치 검사로 판정하지 않는다.
- 새 `mobile/android/app/build`는 D: Junction이 아닌 C: 실제 폴더다. 11/4 검사 직후 C: 잔여 약 9.5 GiB, D: 약 361 GiB였다. V: 연결은 이 빌드의 상승 권한 실행 컨텍스트에서 확인됐으나 일반 터미널에서는 보이지 않았다. 빌드 캐시 및 보관 파일 정리는 수행하지 않았다. 실기기·제품 기능·서버·모델 검증은 별도다.

## 2026-11-04 근정전 메시지 읽기 시안

- 기존 Development Build와 Metro에서 시안에 진입했다. 공통 사진을 중앙 크롭해 화면을 채우고, 사진·흔적·쪽지의 흐린 배경이 같은 좌표를 사용한다. K-style 토큰 일부를 네이티브 스타일에 옮겼으며 별도 의존성은 추가하지 않았다.
- 에뮬레이터 `VTG_API_36`에서 흔적 3개 표시, 첫 글 열기, 추천 `24 → 25 → 24`, 닫기 후 같은 흔적 위치, 두 번째 글과 Android 뒤로가기, 기존 임시 상세 이동·복귀를 확인했다. 캡처에서 사진·쪽지·본문이 보이는 것도 확인했다. 근거는 Git 제외 `.codex-build/place-scene-qa/`의 `explore.png`, `message.png`, `recommended.png`다.
- 후속 표식 시안에서 갈색 막대 대신 먹청색 반투명 원과 흰 말풍선을 적용했다. 에뮬레이터에서 새 표식 3개 표시, 첫 글 열기·닫기, 터치 범위 유지 확인. 최신 캡처는 같은 폴더의 `navy-markers.png`, `navy-marker-selected.png`다. TypeScript와 ESLint를 다시 통과했다.
- TypeScript 및 ESLint 통과. Android 개발 번들 생성·로드 확인. 별도로 시도한 Hermes 배포용 export는 임시 폴더 쓰기 거부로 완료하지 못했다. 첫 개발 클라이언트 연결의 activity 예외는 앱 프로세스를 종료한 뒤 한 번만 연결해 재시도했고 후속 시연은 완료했다.
- 예시 글·추천수는 세션 안에서만 동작한다. 사용자 글 작성·영구 저장·공유·추천 집계, 다른 기기와 큰 글자·TalkBack, 재빌드 및 배포는 미검증이다. US-14 전체 AC를 충족한 결과로 기록하지 않는다.

## 2026-11-04 개발 서버 재연결·버튼 표시 수정

- 에뮬레이터 `emulator-5554`는 `device`였지만 PC의 `127.0.0.1:8081/status` 연결은 실패했고 adb reverse 목록도 비어 있었다. `npm run start:emulator`와 `adb reverse tcp:8081 tcp:8081`로 복구한 뒤 `packager-status:running`과 앱 시작 화면 로드를 확인했다. 개발 중에는 Metro를 계속 실행해야 한다.
- 시작 화면 버튼은 UI tree에 있으나 캡처에서 보이지 않는 이전 현상을 다시 재현했다. 설치된 Expo Router의 Link/Slot 스타일 병합 경로를 확인하고 `Link asChild`로 감싼 Pressable을 직접 `router.push`하는 Pressable로 변경했다. 상태별 버튼 스타일은 그대로 유지했다. 이 변경으로 표시가 복구됐으며 Router 전체의 결함으로 일반화하지 않는다.
- 같은 화면 영역에서 먹청색 버튼 픽셀은 수정 전 0 → 수정 후 136,113개였다. 캡처에서 버튼 배경·글자가 보이는 것을 직접 확인했다. 실제 탭 → 상세 문구 → 시스템 뒤로가기 → 시작 문구를 UI tree로 확인했다.
- 근거: Git 제외 `.codex-build/vtg-current.png`, `vtg-current-fixed.png`, `vtg-current.xml`, `vtg-detail-fixed.xml`, `vtg-back-fixed.xml`. `npm run typecheck`, `npm run lint` 통과.
- 기존 APK와 Metro의 JavaScript 갱신으로 확인했다. native 재생성·전체 APK 재빌드·재설치, 실기기·제품 기능 검증은 이번에 수행하지 않았다. 아래 11/2의 버튼 시각 미확인 기록은 당시 상태이며 이번 재검사로 해소됐다.

## 2026-11-02 에뮬레이터 설치·화면 검증

- 사용자가 켜둔 Android 16 / x86_64 에뮬레이터를 adb `device` 상태로 확인했다. D:의 Studio·Emulator 프로세스로 동작한다. 이전 가속 진단 실패와 별개로 이번에는 실제 부팅·앱 실행이 확인됐다. 가속 설정이 무엇으로 해결됐는지는 확인하지 않았다.
- 기존 debug APK(아래 SHA-256과 동일)를 `adb install -r`로 설치해 Success를 확인했다. 이번에 네이티브 APK를 재빌드하지 않았다.
- 처음의 `unexpected end of stream on http://127.0.0.1:8081`은 Metro가 IPv6 `::1`에 바인딩되고 IPv4 adb reverse가 응답을 받지 못하는 상태에서 재현됐다. Node `--dns-result-order=ipv4first` + localhost 전용 Metro에서 IPv4 status 응답과 앱 로드를 확인했다. LAN 모드는 자동 승인 검토가 노출 범위를 지적해 거절했고 사용하지 않았다.
- 추가로 전체 node_modules의 D: Junction 때문에 Router가 빈 시작 화면을 표시하고 asset 요청이 `mobile/D:/Android/...` 경로로 실패했다. JavaScript 의존성을 실제 C: node_modules로 복구하고, 큰 Android build/.cxx 캐시 22개만 D: Junction으로 유지해 해결했다. D:의 기존 패키지 복사본은 보존했다. 아래 이동 직후의 전체 node_modules 연결 기록보다 이번 수정이 최신이다.
- 화면: 시작 화면의 `Android 개발 실행 확인` → `임시 상세 화면 열기` → `상세 화면에 도착했습니다` → Android 시스템 뒤로가기 → 시작 화면을 UI tree로 확인했다.
- force-stop 후 MainActivity 재실행은 Development Build 서버 선택 화면을 표시했다. 최근 서버 `http://127.0.0.1:8081` 선택 후 시작 화면 복귀를 확인했다. 서버 선택 없이 독립 실행되는 배포 앱으로 검증한 것은 아니다.
- UI tree와 home/detail 스크린샷은 Git 제외 `.codex-build/emulator-qa/`에 저장했다. 확인 중 crash buffer는 비어 있었다. `npm run typecheck`, `npm run lint` 통과. `npm run start:emulator`에 재현 명령을 추가했다.
- 시각 확인 제한: 시작 화면의 상세 버튼은 UI tree에 존재하고 좌표 탭으로 상세 이동도 됐지만, 두 번 캡처한 스크린샷에는 버튼이 보이지 않았다. 버튼의 시각적 렌더링은 통과로 처리하지 않으며 추가 확인이 필요하다.
- Android Studio UI에서의 실행 확인, D: 이동 후 native 재생성·전체 재빌드, 실기기·모델·사진·GPS 검증은 남아 있다. T02 전체 완료로 표시하지 않는다.

## 2026-11-02 도구·캐시 D: 이동

- 사용자 선택: 프로젝트 소스는 C: 유지, Android 도구·캐시만 D:로 이동.
- SDK `D:\Android\Sdk`, 도구 사용자/AVD `D:\Android\User`, Gradle/JDK `D:\Android\Gradle`. 기존 `.codex-build/android-sdk`, `android-user`, `gradle`은 복사 검증 후 제거했다.
- 각각 23,195 / 278 / 41,459개 파일의 상대 경로·크기를 전수 대조했다. D:의 adb·JDK17·Gradle 9.3.1 실행, AVD의 D: 경로 조회와 qcow2 backing 경로를 확인했다. 해시 전수 비교나 앱 전체 재빌드는 수행하지 않았다.
- `mobile/node_modules` 및 `mobile/android/app/build`는 검증 후 `D:\Android\Projects\visual-travel-guide` 아래의 동명 용도 폴더로 전환하고 C:에는 Junction을 두었다. 소스·lockfile은 유지했다. `npm run typecheck`, `npm run lint`, `git diff --check` 통과.
- Studio의 SDK 설정과 JDK 목록의 SDK 경로를 D:로 변경했다. 사용자 Android/Gradle 환경변수와 Studio 캐시 경로를 D:로 설정했다. 전역 JAVA_HOME/PATH는 변경하지 않았다. 기존 Codex/터미널 프로세스는 환경변수가 갱신되지 않으므로 [실행 안내](README.md)의 세션 설정 스크립트를 사용한다.
- C: 여유 공간은 이동 전 약 7.7GB → 이동 후 약 26.8GB, D:는 약 360.7GB. 시점별 측정이며 다른 프로세스 사용량에 따라 달라진다.
- 이전 C: Studio 캐시는 자동 승인 검토가 설정·DB 삭제 위험을 지적해 정리를 거절했으므로 보존했다. D: Studio 프로세스와 D: 캐시의 `log/idea.log` 갱신을 확인했다. UI에서 SDK 설정 적용은 별도 확인이 필요하다. C:의 이전 Studio 프로그램 설치본도 이번 이동에서 제거하지 않았다.
- `emulator -accel-check`는 여전히 6(가속 드라이버 사용 불가)이다. 이동 완료와 에뮬레이터 부팅·앱 재빌드·설치·화면 검증을 구분한다. 아래는 이동 전 빌드 기록이다.

확인: 2026-11-01~11-02 (KST). 범위는 T17의 초기 계약 초안과 T02의 앱 생성·빌드 준비다. 전체 T17·T02, 제품 Story 또는 Sprint 완료를 뜻하지 않는다.

## 기준과 보존 범위

- 사용자 요청: 「프로토타입과 테스트 작업」의 개발 인계를 이 채팅에서 이어받아 실제 개발 시작.
- 기준 계획: [Sprint 1 개발 착수 검토](../docs/experiments/sprint1-development-readiness.md), 원격 main `e98b542`의 Planning·Backlog를 읽어 대조.
- 작업 브랜치: `codex/android-bootstrap`, 시작 HEAD `efb121e`. 원격 문서의 새 커밋은 fetch·열람했으며 공유 중인 로컬 문서를 덮어쓰는 병합은 하지 않았다.
- 기존 미커밋 `.gitignore`, `docs/ARCHITECTURE.md`, `docs/PRODUCT.md`, `docs/PRODUCT_BACKLOG_DRAFT.md`, `docs/README.md`, 두 Sprint 실험 문서는 보존했다. 이번 편집은 `mobile/` 생성과 `docs/README.md`의 Android 개발 안내 두 문장이다.
- commit·push·Issue 본문 수정·클라우드 생성은 수행하지 않았다.

## 환경

| 항목 | 확인한 값 |
| --- | --- |
| PC | Windows build 26200, Intel Core i5-1135G7, 메모리 약 16 GB |
| Node / npm | 24.11.1 / 11.6.2 |
| 앱 | Expo 57.0.31, RN 0.86.3, React 19.2.3, TypeScript 6.0.3 |
| 생성 도구 | create-expo-app 5.0.0, blank-typescript template 57.0.33 |
| Java | 기존 Oracle JDK 21.0.2에서 첫 Gradle 실행. Gradle이 Kotlin toolchain용 Temurin JDK 17.0.20.1+1을 로컬 Gradle 캐시에 자동 설치 |
| Android | API 36, Build Tools 36.0.0, NDK 27.1.12297006, CMake 3.22.1, platform-tools 37.0.1, Emulator 37.2.13 |
| 도구 전달 | Google repository XML의 command-line tools Windows archive를 다운로드. SHA-1이 XML의 `57d04f2d75eb8e8fffc5000a987e5de4b5a63e9d`와 일치 |
| 도구 경로 | 저장소 `.codex-build/android-sdk`, `.codex-build/android-user`, `.codex-build/gradle`. 전역 PATH·Java·Windows 기능 변경 없음 |
| AVD | `VTG_API_36`, Pixel 7 profile, API 36 Google APIs x86_64 |
| 앱 식별 | `com.visualtravelguide.app`, version 0.1.0 |

## 수행한 검사

| 검사 | 결과 | 한계·증거 |
| --- | --- | --- |
| 공식 템플릿 생성·SDK 호환 의존성 설치 | 통과 | npm의 선택 peer 자동 설치가 SDK 58 패키지를 끌어온 충돌을 SDK 57 대응 버전 지정으로 해소 |
| `npx expo prebuild --platform android --no-install` | 통과 | native 소스 생성이며 APK 빌드 성공과 구분 |
| `npm run typecheck` | 통과 | TypeScript strict, 화면 2개 |
| `npm run lint` | 통과 | Expo ESLint flat config |
| `npm run check:dependencies` | 통과 | Dependencies are up to date |
| `npx expo-doctor@1.21.5` | 통과 | 21/21. 초기 expo-font 중복은 SDK 57 패키지로 해결 |
| `npx expo export --platform android --output-dir ../.codex-build/mobile-export` | 통과 | 1,240 modules, Android Hermes bundle 생성. 설치·화면 표시 증거 아님 |
| lockfile의 `npm ci` + Windows postinstall | 통과 | 794 packages 설치와 우회 자동 적용. 재실행 시 already applied 확인 |
| Gradle `:app:assembleDebug`, x86_64 | 통과 | 짧은 앱·SDK·Gradle 경로에서 BUILD SUCCESSFUL. 455 tasks: 42 executed / 413 up-to-date. 마지막 실행 8m 33s는 캐시 재사용 결과이며 총 준비 시간이 아님 |
| APK metadata·ABI·해시 | 통과 | aapt와 ZIP 내 .so 목록 대조. 아래 산출물 정보 참조 |
| Emulator `-accel-check` | 실패 | `accel: 6`, `Android Emulator hypervisor driver is not installed on this machine` |
| 소프트웨어 모드 Emulator 부팅 | 실패 | `-accel off -cores 1 -gpu swiftshader`로 시도, exit -1073741819. `adb devices`에 실행 가능한 기기 없음 |
| 설치·화면 이동·시스템 뒤로가기·종료/재실행 | 미실행 | 실행 가능한 Emulator 또는 실제 Android 필요 |
| 모델·사진·GPS·개인 저장·Supabase·사람 관찰 | 미실행 | 이번 최소 앱 범위 밖. 모델 bundle 미전달 상태를 이어받음 |

원본 로그와 도구·번들은 Git 제외 `.codex-build/`에 보관한다. 대표 로그는 `android-prebuild.log`, `android-build.log`, `mobile-npm-ci.log`, `emulator-software.log`, `npm-audit.json`이다. 로그 전체를 공개 저장소에 복사하지 않는다.

### 생성한 개발 APK

- 위치: `mobile/android/app/build/outputs/apk/debug/app-debug.apk` (Git 제외).
- package `com.visualtravelguide.app`, versionName `0.1.0`, versionCode `1`.
- aapt의 native-code와 ZIP의 `.so` 경로 모두 **x86_64만 포함**한다. 실제 Android ARM 기기용 빌드가 아니다.
- minSdk 24 / targetSdk 36 / compileSdk 36은 빌드 메타데이터다. 모든 해당 OS 기기에서 동작했다는 뜻이 아니다.
- 크기: 89,552,093 bytes. 모델을 포함하지 않는 debug Development Build이며 출시 크기·성능 비교값이 아니다.
- SHA-256: `6b39c3a054d3269d61c03f04a2128d5d7387ccbece79cd14c112809f8df49589`.
- Development Build이므로 앱 화면에는 Metro 연결이 필요하다. 독립 실행 배포 APK로 검증하지 않았다.
- 빌드 직후 `adb devices`의 연결 목록은 비어 있고 `-accel-check`는 계속 6이었다. 설치·뒤로가기·재실행은 미실행 상태다.

## 빌드 오류와 프로젝트 안의 수정

첫 Gradle 빌드는 settings 단계에서 `Unexpected JSON token ... JSON input: Active code page: 65001`로 실패했다. 이 PC의 HKLM Command Processor AutoRun에 chcp 명령이 있음을 값 노출 없이 확인했고, `cmd /c echo JSON_CONTROL`에는 시작 문구가 붙지만 `cmd /d /c echo JSON_CONTROL`에는 붙지 않음을 재현했다.

Expo autolinking 57.0.16의 `Os.kt`가 Windows 명령에 `cmd /c`를 붙이는 코드와, 그 표준 출력을 JSON으로 읽는 `SettingsManager.kt`를 직접 대조했다. [postinstall 스크립트](scripts/fix-windows-autolinking.cjs)가 `cmd /d /c`로 바꾸도록 했다. `/d`는 [Microsoft 문서](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/cmd)의 AutoRun 비활성화 옵션이다. 레지스트리와 전역 사용자 환경은 수정하지 않았다. 실제 재빌드 결과는 위 표에 반영한다.

이후 앱 C++ 빌드에서는 `RNGestureHandlerDetectorShadowNode.cpp.o`의 전체 경로가 Ninja의 260자 제한을 초과했다. 비어 있는 V:에 이 저장소를 `subst`로 연결했다. 앱만 짧은 경로로 바꾸자 다음으로 Gradle 캐시의 `ComponentDescriptorFactory.h` 경로에서 같은 제한이 확인돼 SDK·Gradle 캐시도 V:로 맞췄다. 이전 절대 경로가 남는 앱·네이티브 모듈의 `.cxx`와 autolinking 생성 캐시만 지워 다시 생성했다. 삭제 전 각 실제 절대 경로가 저장소의 `mobile/` 안이며 링크가 아님을 검사했다. 원본 소스·사용자 문서를 이동하지 않았다. 재부팅 후에도 같은 명령으로 연결할 수 있도록 [실행 안내](README.md#설치와-실행)에 반영했다.

첫 의존성 다운로드 중 파일 크기가 약 5분 동안 증가하지 않고 Gradle이 SSL response body를 기다리는 상태도 확인했다. 저장소 전용 Gradle daemon을 중지하고 캐시를 유지해 재시도하자 다운로드가 진행됐다. 진단용 JVM 옵션을 PowerShell에서 전달할 때는 `'-Dorg.gradle.internal.http.socketTimeout=30000'`처럼 인자 전체를 따옴표로 감싼다.

## 남은 필수 확인

CPU virtualization·SLAT은 켜져 있지만 `HypervisorPresent=False`이고 Emulator 가속 드라이버가 없다. Android 공식 권장 경로는 [Windows Hypervisor Platform 활성화와 재부팅](https://developer.android.com/studio/run/emulator-acceleration#vm-windows-whpx)이다. 관리자 권한·사용자 재부팅이 필요하므로 임의 실행하지 않았다.

Windows feature 자체의 Enabled/Disabled 조회는 관리자 권한 부족으로 실패했다. 위 진단을 feature가 꺼져 있다는 직접 확인으로 확대하지 않는다. 사용자 확인 후 활성화·재부팅과 `-accel-check` 재검사가 필요하다.

1. Windows 기능 켜기/끄기에서 **Windows 하이퍼바이저 플랫폼**을 켜고 사용자 작업을 저장한 뒤 재부팅한다. 또는 USB 디버깅이 켜진 실제 Android를 연결한다.
2. `emulator -accel-check` 성공과 `adb devices`의 device 상태를 확인한다.
3. APK를 설치하고 Metro 연결 → 시작 화면 → 임시 상세 → 시스템 뒤로가기 → 종료/재실행을 실제 수행한다. UI tree·스크린샷·crash log로 결과를 남긴다.
4. native 생성 폴더가 없는 상태에서 재생성·빌드·재설치해 T02의 재현성을 확인한다. 실기기 확인은 별도이며 에뮬레이터로 대체하지 않는다.

## 의존성 audit

`npm audit --json`은 29건(critical 0, high 5, moderate 22, low 2)을 보고했다. high는 Expo CLI·Router와 전이 의존성 decode-uri-component/query-string/zod에 걸쳐 집계되어 있다. 중복된 의존 경로의 집계이지 29개의 독립 앱 취약점을 입증한 검사는 아니다. Router 경로의 npm 제안은 SDK 58 major 변경이어서 자동 적용하지 않았다. 원본은 `.codex-build/npm-audit.json`에 있다. 현재 검사만으로 출시 안전성을 판단하지 않으며 외부 배포 전 호환 가능한 수정 버전·실제 노출 경로를 확인한다.
