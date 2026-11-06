# 공통 사진의 공개 글 (#34)

[App 기능 지도](https://github.com/HyunKN/visual-travel-guide/issues/27) · [공유 이슈](https://github.com/HyunKN/visual-travel-guide/issues/34) · [설계](../docs/design/APP_SPRINT1_SPEC.md)

서비스는 아직 없으며 현재 Android 앱은 글을 전송하지 않는다. [migration](migrations/202611070001_place_messages.sql)은 공개를 명시한 글만 받는다. 개인 글·초안·사용자 사진은 이 스키마에 없다. 모바일과 별도로 아래 SQL을 로컬 PostgreSQL 엔진에서 검사할 수 있다. 서버 프로세스·클라우드 계정이 필요하지 않다.

```powershell
cd supabase/tests
npm ci --ignore-scripts
npm test
```

**본인이 준비할 것:** 공유를 검증할 때 [Supabase Dashboard](https://supabase.com/dashboard)에서 별도의 개발 프로젝트를 만든다. 본인 조직·지역·플랜을 확인하고 DB 비밀번호를 직접 보관한다. Authentication에서 [Anonymous Sign-Ins](https://supabase.com/docs/guides/auth/auth-anonymous)를 활성화한다. 프로젝트 URL/이름만 알려주면 연결 대상 확인이 가능하다. DB 비밀번호·secret/service-role 키·세션 토큰을 전달하지 않는다. Android 앱에는 프로젝트 URL과 클라이언트용 publishable key만 사용한다.

**개발자가 이어갈 순서:**

1. 대상이 비어 있는 **개발 프로젝트**인지 대조한 후 SQL Editor 또는 migration 절차로 이 파일을 한 번 적용한다. 이 저장소에서 원격 적용은 수행하지 않았다. Data API에 내부 `vtg` 스키마를 추가하지 않는다. 기본 테이블은 RLS·권한으로 직접 접근을 막고 호출용 RPC만 제공한다.
2. 앱에 안전한 익명 세션 저장, 첫 공개 전 소유권 복구 한계 안내, 로컬 게시 요청 기록(requestId·동의한 revision·snapshot)을 연결한다. 네트워크 타임아웃 후 `vtg_request_status`로 같은 요청을 먼저 확인한다. 키만 넣는다고 현재 앱의 ‘공개하기’가 활성화되지는 않는다.
3. 비로그인/실제 익명 사용자 A·B를 **독립 세션**으로 검사한다. A 게시 → B가 같은 장면에서 읽기 → B의 A 글 변경·철회 거부 → B 신고 → 서버 관리자 숨김 → 비로그인/B 읽기 불가. A의 철회 결과·불확실한 재시도·기기 재시작도 확인한다. 통과 증거를 이슈에 남긴 뒤 사용자 확인을 받는다.

**서버 함수:** `vtg_markers`(본문 없는 페이지), `vtg_read`(한 글), `vtg_write`(게시·수정·철회), `vtg_request_status`(본인 요청 재확인), `vtg_report`(타인 글 신고). 요청값·결과 버전으로 재전송을 구분한다. 관리자 숨김은 서버에서만 하며 신고 자체가 자동 차단을 일으키지 않는다. 노출한 RPC에는 테이블 소유자 권한이 필요하므로 관리 전용 migration 역할로 적용하고 앱에 해당 권한을 주지 않는다.

로컬 테스트는 PostgreSQL 권한·함수·저장만 검증한다. 실제 Supabase Auth·PostgREST·속도·남용 방지·서로 다른 Android 기기에서의 전달은 미검증이다.
