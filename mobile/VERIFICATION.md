# Android 앱 개발 검증

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
