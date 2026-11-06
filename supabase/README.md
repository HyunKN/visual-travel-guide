# 공통 사진의 공개 글 (#34)

[App 기능 지도](https://github.com/HyunKN/visual-travel-guide/issues/27) · [공유 이슈](https://github.com/HyunKN/visual-travel-guide/issues/34) · [설계](../docs/design/APP_SPRINT1_SPEC.md)

서비스 프로젝트는 아직 준비되지 않았다. 앱은 설정이 없으면 전송하지 않는다. [migration](migrations/202611070001_place_messages.sql)은 공개를 명시한 글만 받는다. 개인 글·초안·사용자 사진은 이 스키마에 없다. 모바일과 별도로 아래 SQL을 로컬 PostgreSQL 엔진에서 검사할 수 있다. 서버 프로세스·클라우드 계정이 필요하지 않다.

기기 게시 경계는 [publication.ts](../mobile/src/features/public-messages/publication.ts), [RPC adapter](../mobile/src/features/public-messages/remote.ts), [SQLite 저장소](../mobile/src/features/local-notes/store.ts)에 구현했다. 게시를 누른 시점의 본문·위치·revision·작성자·서비스·요청 ID를 한 트랜잭션으로 보호한다. `createPublisher().deliver(noteId)`는 상태 확인 후 같은 요청을 재전송하며 중복 호출을 합친다. Supabase SDK·SecureStore 세션·작성 화면의 공개 및 철회 행동에 연결했다. 실제 프로젝트 인증·전송은 아직 실행하지 않았다.

미확인 요청이 있으면 새 게시·나만 보기 저장·초안/기기 삭제를 거부한다. 수정 초안은 별도로 보존한다. 서버가 철회를 확인하기 전에는 비공개 전환을 완료하지 않는다. 공개 글의 수정이 거부돼도 이전 공개 사본이 사라졌다고 표시하지 않는다. DB schema 1→2 migration은 기존 개인 글을 보존한다.

```powershell
cd supabase/tests
npm ci --ignore-scripts
npm test
```

먼저 `mobile/` 의존성이 설치돼 있어야 한다. pretest가 실제 앱의 게시·SQLite 코드를 컴파일하고, 서버 정책과 앱↔SQL 전달 검사를 실행한다. 후자는 실제 SQLite와 PostgreSQL을 사용하지만 네트워크·Supabase Auth·Android의 검사를 대신하지 않는다.

**본인이 준비할 것:** 공유를 검증할 때 [Supabase Dashboard](https://supabase.com/dashboard)에서 별도의 개발 프로젝트를 만든다. 본인 조직·지역·플랜을 확인하고 DB 비밀번호를 직접 보관한다. Authentication에서 [Anonymous Sign-Ins](https://supabase.com/docs/guides/auth/auth-anonymous)를 활성화한다. 프로젝트 URL/이름만 알려주면 연결 대상 확인이 가능하다. DB 비밀번호·secret/service-role 키·세션 토큰을 전달하지 않는다. Android 앱에는 프로젝트 URL과 클라이언트용 publishable key만 사용한다.

**개발자가 이어갈 순서:**

1. 대상이 비어 있는 **개발 프로젝트**인지 대조한 후 SQL Editor 또는 migration 절차로 migrations/의 0001(place_messages) → 0002(read_snapshot) → 0003(home_preview) 순서로 각각 한 번 적용한다. 이 저장소에서 원격 적용은 수행하지 않았다. Data API에 내부 `vtg` 스키마를 추가하지 않는다. 기본 테이블은 RLS·권한으로 직접 접근을 막고 호출용 RPC만 제공한다.
2. mobile의 git 제외 파일 `.env.local`에 `EXPO_PUBLIC_SUPABASE_URL`과 `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`를 본인이 설정한다. HTTPS의 기본 supabase.co 프로젝트 주소와 sb_publishable_ 키만 허용한다. 비밀 키나 세션은 넣지 않는다. SecureStore가 포함된 새 개발 APK를 직접 빌드·설치한 뒤 Metro를 직접 다시 시작해 설정을 반영한다. 작성 화면의 공개하기→소유권 한계 확인→익명 세션 저장→요청 저장/전송으로 이어진다. 세션이 유실된 기존 글에 새 익명 사용자를 자동 부여하지 않는다.
3. 비로그인/실제 익명 사용자 A·B를 **독립 세션**으로 검사한다. A 게시 → B가 같은 장면에서 읽기 → B의 A 글 변경·철회 거부 → B 신고 → 서버 관리자 숨김 → 비로그인/B 읽기 불가. A의 철회 결과·불확실한 재시도·기기 재시작도 확인한다. 통과 증거를 이슈에 남긴 뒤 사용자 확인을 받는다.

**서버 함수:** `vtg_markers`(본문 없는 페이지), `vtg_read`(한 글), `vtg_write`(게시·수정·철회), `vtg_request_status`(본인 요청 재확인), `vtg_report`(타인 글 신고). 요청값·결과 버전으로 재전송을 구분한다. 관리자 숨김은 서버에서만 하며 신고 자체가 자동 차단을 일으키지 않는다. 노출한 RPC에는 테이블 소유자 권한이 필요하므로 관리 전용 migration 역할로 적용하고 앱에 해당 권한을 주지 않는다.

로컬 테스트는 PostgreSQL 권한·함수·저장만 검증한다. 실제 Supabase Auth·PostgREST·속도·남용 방지·서로 다른 Android 기기에서의 전달은 미검증이다.

세션 구현: SDK의 자동 영속화·백그라운드 refresh를 끄고 명시적 행동마다 세션 복원/갱신→기기 보관→RPC를 직렬화한다. 토큰은 SecureStore의 작은 조각과 commit pointer로 보호하며 SQLite·로그·route에 넣지 않는다. 안전 저장 실패 시 전송하지 않고 갱신된 세션을 메모리에 유지해 재저장을 시도한다. 앱 재설치·영구 세션 손실의 소유권 복구는 제공하지 않는다. 공개 목록/사진 병합과 신고 UI를 연결했으며 실제 A/B 전달 검사는 남아 있다.

공개 읽기: sceneMessages는 세션 없는 별도 client로 snapshot→marker/본문을 읽으며 개인 본문은 원격으로 보내지 않는다. 서버 기준 페이지와 기기 개인 글을 최대 60개씩 합치며 같은 ID는 하나만 표시한다. 공개 목록이 실패하면 개인 글과 오류 상태를 표시한다. 다른 사람의 공개 글에서 신고 이유를 고른 뒤 안전한 익명 세션으로 접수하며 서버 확인 전 성공을 표시하지 않는다. 대상 프로젝트에서 migration 0002 적용 후 공개 글이 개인 표식과 함께 나타나는지, A/B 신고·숨김·삭제/철회 후 재조회도 확인한다.

홈 미리보기는 vtg_home_preview(읽기 전용 RPC)로 지원 scene의 최신 공개 글 최대 1개만 받는다. 비로그인 읽기를 사용하고 기기 개인 글은 조회하지 않는다. 설정/공개 글 없음/오류일 때 홈 미리보기는 생략한다. 실제 사용자가 글을 숨김/철회한 뒤 홈을 다시 열어 해당 미리보기가 사라지는지도 확인한다.

SDK 연결부는 mobile/src/features/public-messages/sdkGateway.ts에 있다. 앱의 안전한 세션 보관은 nativeService가 담당하고 gateway는 실제 SDK Auth·공개/인증 RPC와 JSON HTTP의 deadline을 담당한다. mobile의 test:messages는 실제 SDK에 합성 HTTP 응답을 주입해 인증 헤더 분리·갱신·본문 전송 정지·빈 응답·서버 오류 구분을 검사한다. 이는 실제 원격 서비스 검사와 별개다.
