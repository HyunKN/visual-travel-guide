# 공통 사진의 공개 글 (#34)

[App 기능 지도](https://github.com/HyunKN/visual-travel-guide/issues/27) · [공유 이슈](https://github.com/HyunKN/visual-travel-guide/issues/34) · [설계](../docs/design/APP_SPRINT1_SPEC.md)

서비스 프로젝트는 아직 준비되지 않았다. 앱은 설정이 없으면 전송하지 않는다. [migration](migrations/202611070001_place_messages.sql)은 공개를 명시한 글만 받는다. 개인 글·초안·사용자 사진은 이 스키마에 없다. 모바일과 별도로 아래 SQL을 로컬 PostgreSQL 엔진에서 검사할 수 있다. 서버 프로세스·클라우드 계정이 필요하지 않다.

기기 게시 경계는 [publication.ts](../mobile/src/features/public-messages/publication.ts), [RPC adapter](../mobile/src/features/public-messages/remote.ts), [SQLite 저장소](../mobile/src/features/local-notes/store.ts)에 구현했다. 게시를 누른 시점의 본문·위치·revision·작성자·서비스·요청 ID를 한 트랜잭션으로 보호한다. `createPublisher().deliver(noteId)`는 상태 확인 후 같은 요청을 재전송하며 중복 호출을 합친다. Supabase SDK·SecureStore 세션·작성 화면의 공개 및 철회 행동에 연결했다. 실제 프로젝트 인증·전송은 아직 실행하지 않았다.

미확인 요청이 있으면 새 게시·나만 보기 저장·초안/기기 삭제를 거부한다. 수정 초안은 별도로 보존한다. 서버에서 철회 또는 본인 공개 사본 없음을 확인하기 전에는 비공개 전환을 완료하지 않는다. 공개 글의 수정이 거부돼도 이전 공개 사본이 사라졌다고 표시하지 않는다. DB schema 1→2→3 migration은 기존 개인 글·동의 요청을 보존한다.

```powershell
cd supabase/tests
npm ci --ignore-scripts
npm test
```

먼저 `mobile/` 의존성이 설치돼 있어야 한다. pretest가 실제 앱의 게시·SQLite 코드를 컴파일하고, 서버 정책과 앱↔SQL 전달 검사를 실행한다. 후자는 실제 SQLite와 PostgreSQL을 사용하지만 네트워크·Supabase Auth·Android의 검사를 대신하지 않는다.

**본인이 준비할 것:** 공유를 검증할 때 [Supabase Dashboard](https://supabase.com/dashboard)에서 별도의 개발 프로젝트를 만든다. 본인 조직·지역·플랜을 확인하고 DB 비밀번호를 직접 보관한다. Authentication에서 [Anonymous Sign-Ins](https://supabase.com/docs/guides/auth/auth-anonymous)를 활성화한다. 프로젝트 URL/이름만 알려주면 연결 대상 확인이 가능하다. DB 비밀번호·secret/service-role 키·세션 토큰을 전달하지 않는다. Android 앱에는 프로젝트 URL과 클라이언트용 publishable key만 사용한다.

**개발자가 이어갈 순서:**

1. 대상이 비어 있는 **개발 프로젝트**인지 대조한 후 SQL Editor 또는 migration 절차로 migrations/의 0001(place_messages) → 0002(read_snapshot) → 0003(home_preview) → 0004(rate_limit_feedback) → 0005(owner_state) 순서로 각각 한 번 적용한다. 기존 개발 프로젝트라면 적용 이력을 확인해 미적용 파일만 실행한다. 이 저장소에서 원격 적용은 수행하지 않았다. Data API에 내부 `vtg` 스키마를 추가하지 않는다. 기본 테이블은 RLS·권한으로 직접 접근을 막고 호출용 RPC만 제공한다.
2. mobile의 git 제외 파일 `.env.local`에 `EXPO_PUBLIC_SUPABASE_URL`과 `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`를 본인이 설정한다. HTTPS의 기본 supabase.co 프로젝트 주소와 sb_publishable_ 키만 허용한다. 비밀 키나 세션은 넣지 않는다. SecureStore가 포함된 새 개발 APK를 직접 빌드·설치한 뒤 Metro를 직접 다시 시작해 설정을 반영한다. 작성 화면의 공개하기→소유권 한계 확인→익명 세션 저장→요청 저장/전송으로 이어진다. 세션이 유실된 기존 글에 새 익명 사용자를 자동 부여하지 않는다.
3. 비로그인/실제 익명 사용자 A·B를 **독립 세션**으로 검사한다. A 게시 → B가 같은 장면에서 읽기 → B의 A 글 변경·철회 거부 → B 신고 → 서버 관리자 숨김 → 비로그인/B 읽기 불가. A의 철회 결과·불확실한 재시도·기기 재시작도 확인한다. 통과 증거를 이슈에 남긴 뒤 사용자 확인을 받는다.

**서버 함수:** `vtg_markers`(본문 없는 페이지), `vtg_read`(한 글), `vtg_write`(게시·수정·철회), `vtg_request_status`(본인 요청 재확인), `vtg_report`(타인 글 신고). 요청값·결과 버전으로 재전송을 구분한다. 관리자 숨김은 서버에서만 하며 신고 자체가 자동 차단을 일으키지 않는다. 노출한 RPC에는 테이블 소유자 권한이 필요하므로 관리 전용 migration 역할로 적용하고 앱에 해당 권한을 주지 않는다.

제한 응답: [0004](migrations/202611070004_rate_limit_feedback.sql)는 원래 write/report 함수를 내부 `vtg.write_base/report_base`로 옮기고 같은 공개 RPC에 피드백을 덧붙인다. 소유자·버전·idempotency·철회 규칙은 원본을 재사용한다. 내부 함수/계산 helper는 앱 역할에 EXECUTE를 주지 않는다. 기존 제한(5회/분·50회/일, 신고 10회/시간)의 해당 순위 이벤트가 만료되는 시각을 계산하며, 분/일 제한이 겹치면 더 늦은 시각을 쓴다. 같은 요청 재확인·중복 신고와 공개 철회는 계속 가능하다.

정확한 `rate_limited` 예외만 [PostgreSQL DETAIL](https://www.postgresql.org/docs/current/plpgsql-errors-and-messages.html)로 `{"retryAt":"UTC ISO 시각"}`을 전달하고 [PostgREST](https://docs.postgrest.org/en/stable/references/errors.html)의 기존 P0001/HTTP 400 형식을 유지한다. 초 경계 뒤로 올려 너무 이른 재시도를 안내하지 않는다. 추가 요청에 따라 기준 시각은 바뀔 수 있다. 앱은 완료된 이 오류에서만 시각을 검증해 공개/신고 화면에 기기 현지 시각으로 표시한다. 구 서버·잘못된 details는 일반 제한 안내로 대체하며 임의 서버 문구를 표시하지 않는다. 5xx·통신 실패는 기존 불확실 상태를 유지한다.

이 안내는 현재 시도의 `DeliveryResult.rateLimit`에만 있고 DB의 consent/job·본문·서버 version은 바꾸지 않는다. 초안·기존 공개 사본을 유지하며 자동 재전송/예약/새 요청 생성은 하지 않는다. 재진입 후 시각 안내의 보존은 보장하지 않으며, 다시 공개할 때 서버가 재판정한다. 새 공유 설정에서는 0005까지 적용하고 제한 응답·철회를 실제 프로젝트/Android에서 추가 검증한다.

### 버전 충돌에서 복구

[0005](migrations/202611070005_owner_state.sql)의 `vtg_owner_state(scene,id)`는 인증된 본인 글만 관리 목적으로 읽는다. 숨김·철회 상태를 포함하지만 일반 공개 읽기에는 노출하지 않는다. 타인/없는 ID는 모두 빈 결과이며 owner ID를 입력으로 받지 않는다. [Supabase 함수 권한 지침](https://supabase.com/docs/guides/database/functions)에 따라 빈 search_path·완전한 테이블 경로·명시적 EXECUTE 제한을 적용한다. 앱 역할의 기본 테이블 권한은 추가하지 않는다.

`createConflictRecovery.inspect`는 서버 본문을 메모리에서만 보여주며 초안을 덮거나 쓰기 요청을 만들지 않는다. 사용자가 반영/철회를 확인하면 `act`가 같은 소유자 세션에서 다시 조회한다. 본문·위치·version·노출/숨김 상태가 달라졌으면 중단한다. 일치할 때만 현재 version을 기대값으로 한 새 request/동의 snapshot을 SQLite에 원자적으로 기록한다. 이후 `vtg_write`도 version/소유권을 검사하므로 그 사이의 수정은 다시 충돌한다. 숨김 글은 재공개를 막고 철회만 허용한다. 철회 payload에는 현재 초안 본문을 넣지 않는다. 응답 유실은 새 요청을 만들지 않고 같은 요청으로 확인한다.

이미 철회됐거나 본인 사본이 없으면 명시적으로 개인 저장할 수 있다. SQLite schema 3의 `stateSource='observation'`은 현재 비공개 상태를 조회한 근거이며, 실패한 요청의 성공 영수증이 아니다. 원래 request/payload/revision은 유지하고 관측 version과 개인 글 저장을 한 트랜잭션에 묶는다. 실패하면 둘 다 되돌린다. 일반 서버 응답은 `stateSource='request'`이며 재공개 때 새 요청으로 전환한다. 관측 후 다른 세션이 다시 공개하는 것을 영구 차단하는 계약은 아니다. 익명 세션을 잃은 글의 소유권 복구도 제공하지 않는다.

실제 확인: 같은 소유자의 별도 세션에서 수정 → 원래 편집기 충돌 → 서버 글 확인 → 다른 세션에서 다시 수정 시 반영 중단 → 재확인/명시적 반영. 숨김 후 재공개 거부/철회, 다른 세션의 선행 철회 후 개인 저장, 네트워크 오류·앱 재시작 후 초안/요청 보존도 검사한다. 실제 프로젝트/Android에서는 아직 실행하지 않았다.

로컬 테스트는 PostgreSQL 권한·함수·저장만 검증한다. 실제 Supabase Auth·PostgREST·속도·남용 방지·서로 다른 Android 기기에서의 전달은 미검증이다.

세션 구현: SDK의 자동 영속화·백그라운드 refresh를 끄고 명시적 행동마다 세션 복원/갱신→기기 보관→RPC를 직렬화한다. 토큰은 SecureStore의 작은 조각과 commit pointer로 보호하며 SQLite·로그·route에 넣지 않는다. 안전 저장 실패 시 전송하지 않고 갱신된 세션을 메모리에 유지해 재저장을 시도한다. 앱 재설치·영구 세션 손실의 소유권 복구는 제공하지 않는다. 공개 목록/사진 병합과 신고 UI를 연결했으며 실제 A/B 전달 검사는 남아 있다.

공개 읽기: sceneMessages는 세션 없는 별도 client로 snapshot→marker/본문을 읽으며 개인 본문은 원격으로 보내지 않는다. 서버 기준 페이지와 기기 개인 글을 최대 60개씩 합치며 같은 ID는 하나만 표시한다. 공개 목록이 실패하면 개인 글과 오류 상태를 표시한다. 다른 사람의 공개 글에서 신고 이유를 고른 뒤 안전한 익명 세션으로 접수하며 서버 확인 전 성공을 표시하지 않는다. 대상 프로젝트에서 migration 0002 적용 후 공개 글이 개인 표식과 함께 나타나는지, A/B 신고·숨김·삭제/철회 후 재조회도 확인한다.

홈 미리보기는 vtg_home_preview(읽기 전용 RPC)로 지원 scene의 최신 공개 글 최대 1개만 받는다. 비로그인 읽기를 사용하고 기기 개인 글은 조회하지 않는다. 설정/공개 글 없음/오류일 때 홈 미리보기는 생략한다. 실제 사용자가 글을 숨김/철회한 뒤 홈을 다시 열어 해당 미리보기가 사라지는지도 확인한다.

SDK 연결부는 mobile/src/features/public-messages/sdkGateway.ts에 있다. 앱의 안전한 세션 보관은 nativeService가 담당하고 gateway는 실제 SDK Auth·공개/인증 RPC와 JSON HTTP의 deadline을 담당한다. mobile의 test:messages는 실제 SDK에 합성 HTTP 응답을 주입해 인증 헤더 분리·갱신·본문 전송 정지·빈 응답·서버 오류 구분을 검사한다. 이는 실제 원격 서비스 검사와 별개다.
