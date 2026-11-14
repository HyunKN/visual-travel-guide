# 누비 Nubi · Android 개발 앱

누비의 React Native·Expo Development Build다. 기존 [웹 프로토타입](../prototype/README.md)과 독립적으로 설치한다. 진행 순서·기능별 확인·남은 개발의 원본은 [App 기능 지도 #27](https://github.com/HyunKN/visual-travel-guide/issues/27), 실제 모델 연결은 [#30](https://github.com/HyunKN/visual-travel-guide/issues/30)이다. 앱·에뮬레이터·Metro는 사용자가 직접 실행한다.

## 이번 구현의 범위

R3를 기준으로 ‘누비 Nubi’ 이야기 홈과 불투명한 ‘홈 / 내 글’ 탭을 구현했다. 홈의 공개 글은 ‘남긴 흔적’, 사진에서 새 글을 시작하는 버튼은 ‘나도 한 줄 남기기’다. 설명·출처·지도·사진에서는 상단 집 버튼으로 홈에 돌아간다. [상세 설계](../docs/design/APP_SPRINT1_SPEC.md)와 [공통 UI #36](https://github.com/HyunKN/visual-travel-guide/issues/36)에서 구현과 미확인 배치·최종 디자인을 구분한다. 2026-11-14 사용자 결정으로 TalkBack 수동 검사는 현재 인수 범위에서 제외한다.

Expo SDK 57 + React Native + TypeScript의 로컬 Development Build다. [App 기능 지도 #27](https://github.com/HyunKN/visual-travel-guide/issues/27)에서 진행 순서와 상태를 관리한다. 근정전·교태전·광화문 선택 → 이야기 → 공통 사진 → 위치 선택 → 자유 글 → 기기 저장/복귀를 구현했다. 개인 촬영 사진은 보관하지 않는다. 위치는 사용자 요청 시에만 읽는다. 모델 미탑재 시 직접 선택할 수 있다.

가이드는 로그인 없이 사용한다. 홈 공개 미리보기는 서버가 최대 64자로 제한한 발췌만 보여주며, 미리보기 탭·내 글·공통 사진의 메모 읽기/작성·직접 링크는 Google·네이버 소셜 로그인부터 진행한다. 첫 로그인 성공 시 계정을 만들며 별도 회원가입 화면은 없다. 카카오·이메일 가입은 보류한다. 보호 화면은 로그인 세션의 검증과 안전한 저장 뒤에만 열린다. 로그인은 공개 동의가 아니며 공개 범위 기본 선택도 없다. 기존 개발 프로젝트에서 Google·네이버 로그인·재인증·취소와 계정 분리는 사용자 에뮬레이터 확인을 받았다. 새 프로젝트의 제공자 설정과 실기기 통합은 별도다. [인증 설계](../docs/design/APP_SPRINT1_SPEC.md#7-공개권한관리-34)와 [공유 설정 안내](../supabase/README.md)를 따른다.

기기 글·초안·게시 요청은 프로젝트와 사용자 ID별 SQLite 파일로 분리한다. 이전 공유 기기 DB는 열거나 변경·자동 귀속하지 않으며, 기존 글의 명시적 가져오기는 후속 범위다. 로그인 화면에서 뒤로/가이드로 돌아가기를 누르면 가이드로 복귀하고, 공급자 브라우저만 닫으면 로그인 선택으로 돌아가 다른 수단을 다시 고를 수 있다. 성공하면 원래 메모 화면을 연다. 진행 중 OAuth에서 앱 프로세스가 종료되면 해당 시도는 폐기하고 다시 로그인한다. 로그아웃은 화면을 즉시 잠그고 SecureStore의 로그아웃 표식을 먼저 확정한다. 홈 상단의 장소 이야기는 검수 콘텐츠 순환이며 개인화가 아니다.

공개 글이 충돌하면 ‘서버 상태 확인’으로 본인 서버 글과 현재 초안을 따로 확인한다. 명시적으로 반영/철회할 때 다시 조회하고, 상태가 바뀌었으면 중단한다. 숨김 글은 재공개하지 않으며, 철회됐거나 본인 공개 사본이 없음을 확인하면 ‘나만 보기’를 선택해 저장할 수 있다. 이 복구에는 서버 migration 0005와 동일한 작성자 세션이 필요하다. 기기 SQLite schema 3은 기존 글·동의 snapshot을 보존하면서 요청 결과와 관측 근거를 구분한다. 실제 Android 연결 근거와 개별 복구 경로의 미확인 사항은 [검증 기록](VERIFICATION.md)·해당 Issue에서 구분한다.

기존 AI·검색과 비교할 사용자 가치 가설은 [PRODUCT](../docs/PRODUCT.md#개발-핵심-원칙-사용자가-선택할-이유)를 따른다. 직접 선택·사진 입력은 같은 장소의 설명과 이후 흔적 경험을 잇기 위한 기반이다. 출처를 따라 읽는 이야기 초안과 관람 포인트를 제공하지만, 사용자가 기존 검색보다 흥미를 느끼고 실제 대상을 다시 보는지는 아직 검증하지 않았다. 사람 비교·실기기·모델 연결의 결과를 이 구현으로 대신하지 않는다.

## 설치와 실행

기준: Node 24.11.1 / npm 11.6.2. 앱의 실제 의존성은 `package-lock.json`으로 고정한다. SDK 57 공식 템플릿 `expo-template-blank-typescript@57.0.33`에서 시작했으며 Expo 57.0.31 / RN 0.86.3 / React 19.2.3 / TypeScript 6.0.3을 사용한다. Android package와 로그인 scheme은 `com.visualtravelguide.app` / `visual-travel-guide`다. 화면 이름은 누비 Nubi지만 기존 개발 APK의 런처 이름은 아직 Visual Travel Guide다.

### 이미 설치된 개발 앱을 실행할 때

1. Android Studio Device Manager에서 에뮬레이터를 직접 켠다.
2. 아무 PowerShell에서 아래 명령을 실행한다. `adb devices`에 `emulator-5554 device` 같은 행이 있어야 한다. SDK가 다른 곳에 있으면 실행 파일 경로를 바꾼다.

```powershell
& "D:\Android\Sdk\platform-tools\adb.exe" devices
& "D:\Android\Sdk\platform-tools\adb.exe" reverse tcp:8083 tcp:8083
```

3. 저장소 루트의 다른 PowerShell에서 다음을 실행하고 터미널을 켜둔다. 이 프로젝트의 8083 서버가 이미 실행 중이면 새로 시작하지 않는다.

```powershell
cd mobile
node --dns-result-order=ipv4first node_modules/expo/bin/cli start --dev-client --localhost --port 8083
```

4. 에뮬레이터에서 앱을 직접 열고 `http://127.0.0.1:8083` 개발 서버를 선택한다. 같은 서버에서 JS·문구 변경만 받으려면 Metro 터미널의 `r`로 새로고침한다. 네이티브 모듈 변경이 없으면 재설치하지 않는다.

`no devices/emulators found`는 기기 연결부터 확인하고, `EADDRINUSE`는 같은 포트의 기존 서버를 먼저 확인한다. 다른 서버를 임의 종료하지 않는다. 검은 화면이 에뮬레이터 전체인지 앱에서만 나타나는지 구분하며, 새 APK·초기화를 기본 해결책으로 삼지 않는다.

### 새 checkout에서 의존성을 준비할 때

```powershell
cd mobile
npm ci
```

기존 `node_modules`와 개발 APK를 사용하는 매 실행마다 설치·전체 검사를 반복하지 않는다. 새 환경의 APK 준비·네이티브 변경 시 빌드는 아래 절차를 따른다.

### 변경한 기능에 맞춰 검사할 때

| 명령 (`mobile/`에서 실행) | 대상 |
| --- | --- |
| `npm run typecheck` / `npm run lint` | 코드 변경의 타입·린트 |
| `npm run test:content` | 장소/이야기·홈 사진/카드 |
| `npm run test:photo` | 사진 입력·권한/복구 |
| `npm run test:recognition` | 인식 요청·취소·응답 계약. 실제 모델 추론과 구분 |
| `npm run test:messages` | 읽기·기기 저장·공유·로그인·위치 계약 |
| `npm run test:navigation` | 홈 복귀·초안 보호·편집 Back·위치 저장 중 입력 |
| `npm run check:android-bundle` | 설치/실행 없이 Android JS·Hermes·자산 내보내기 |

이미 통과한 결과는 재사용하고 [핵심 기능 변경의 영향 범위만 재검사](../docs/DEVELOPMENT.md#핵심-기능-변경-시에만-재검사)한다. 문구·스타일·문서 변경 때문에 앱 테스트·빌드·기기 확인을 추가하지 않는다. SDK/패키지를 변경할 때는 `npm run check:dependencies`와 환경 진단을 별도로 선택한다.

`check:android-bundle`은 Android 파일 내보내기만 검사한다. Expo 57의 mockServer export 경로를 사용하므로 HTTP 포트를 열거나 앱을 실행하지 않는다. Git 제외 `.codex-build/android-bundle-check`에 Hermes 묶음/에셋을 만들고, 임시 파일은 같은 폴더 체계 안에 둔다. 환경 파일과 외부 서비스 설정을 제외한 기본 구성 검사이며 실제 기기 검증을 대신하지 않는다.

유리 렌더러 경계 검사는 `node --test src/ui/PhotoGlass.test.cjs`다. 등록 사진·카드·stage 좌표와 이전 APK의 대체 표시를 검사하며 Android GPU 실행 검사는 아니다. `modules/photo-glass`는 지원 Android(API 33 이상, hardware Canvas)에서 등록된 세 사진만 굴절시키는 로컬 Expo View다. 새 의존성 다운로드 없이 기존 JPEG를 APK assets로 포함한다. 이 네이티브 코드에는 새 개발 APK 설치가 필요하며 Metro reload만으로 반영되지 않는다. 모듈 없는 기존 APK·미지원 환경에서는 단일 사진과 밝은 바탕으로 대체한다.

Android SDK·Java와 실행 중인 Emulator 또는 USB 디버깅 기기가 필요하다. 2026-11-02 이 PC의 도구·캐시는 `D:\Android`로 이동했다. 프로젝트 소스는 C:에 유지한다. SDK는 `D:\Android\Sdk`, 가상 기기는 `D:\Android\User\avd`, Gradle/JDK는 `D:\Android\Gradle`에 있다. Android Studio는 `D:\Android\android-studio`에 있다.

### Windows 네이티브 빌드 경로

2026-11-07 검사에서 `expo prebuild --platform android --no-install`도 Android 생성 폴더를 지우고 다시 만드는 것을 확인했다. 기존 native 수동 수정과 app build/.cxx Junction을 먼저 확인한다. 이번 작업은 기존 APK·캐시를 보존하고 `D:\Android\Projects\visual-travel-guide\app-build-20261107-s1`·`app-cxx-20261107-s1`에 새 출력을 둔다. `D:\Android\vtg`는 C: 저장소를 가리키는 폴더 Junction이다. 새 드라이브나 소스 이동이 아니다.

Windows에서 Ninja 오브젝트 경로 260자 초과를 재현해 `plugins/withWindowsObjectPaths.cjs`를 추가했다. Expo 생성 시 app Gradle의 CMake에 `CMAKE_OBJECT_PATH_MAX=240`을 적용해 긴 경로를 해시하도록 한다. 생성 파일을 수동 편집하지 않는다. PowerShell에서는 `'-Pandroid.builder.sdkDownload=false'`처럼 점이 포함된 Gradle 인수를 인용한다. 이 옵션은 SDK 자동 설치를 막으며, `--offline`은 Gradle 라이브러리 조회도 캐시로 제한한다. 새 모듈 의존성이 캐시에 없으면 offline 빌드는 실패할 수 있다.

### 이번 PC에서 준비된 APK 사용

MapLibre 지도·유리 렌더러·소셜 로그인용 Crypto/WebBrowser 모듈을 포함한 x86_64 개발 APK의 빌드·패키징 검사가 통과했다. 크기는 123,182,571 bytes, SHA-256은 `e3eaf3df79bf3211c70558dd47462bb90204a36e2614dc77a009d508197b25c3`다([검증 기록](VERIFICATION.md)). 아래 순서에는 재빌드가 필요 없다. 실제 지도·소셜 로그인에는 인터넷과 제공자 설정이 필요하다. Android Studio에서 에뮬레이터를 켠 뒤 **아무 PowerShell**에서 아래 두 줄을 실행한다. 첫 명령에 `emulator-5554 device`처럼 `device` 상태가 보여야 설치할 수 있다. `install -r`은 기존 앱 데이터를 유지하는 업데이트 설치다. 이전 APK를 설치했어도 이번 네이티브 모듈을 확인하려면 한 번 업데이트한다.

```powershell
& "D:\Android\Sdk\platform-tools\adb.exe" devices
& "D:\Android\Sdk\platform-tools\adb.exe" install -r "D:\Android\Projects\visual-travel-guide\app-build-20261107-s1\outputs\apk\debug\app-debug.apk"
```

이 앱은 Metro가 필요한 Development Build다. 이 프로젝트의 8083 서버가 이미 켜져 있다면 다시 시작하지 않는다. 없으면 별도 PowerShell에서 다음을 직접 실행한다.

```powershell
cd C:\Users\hi\Desktop\projects_2026\visual-travel-guide\mobile
node --dns-result-order=ipv4first node_modules/expo/bin/cli start --dev-client --localhost --port 8083
```

다른 PowerShell에서 `adb reverse tcp:8083 tcp:8083`을 실행한 뒤 에뮬레이터의 앱 아이콘을 직접 눌러 localhost:8083 서버를 선택한다. 기기 연결이 없거나 포트가 다른 서버에 사용 중이면 그 원인을 먼저 확인한다. 최신 source의 공개 기능은 Supabase 설정이 있어야 동작한다. 실제 실행·데이터 복원·디자인 검수는 아래 순서로 수행한다.

### 네이티브 모듈을 변경해 새 APK가 필요할 때

SQLite·지도 모듈과 Android 폰트를 추가했다. 이전 APK에 JS만 갱신하면 이 변경을 확인할 수 없다. Android Studio Device Manager에서 `VTG_API_36`을 직접 켠 후 저장소 루트에서 아래 순서로 진행한다. 이미 설치한 이 PC에서는 npm ci를 반복할 필요가 없다. `--clean`을 추가하지 않아도 생성 폴더가 재생성될 수 있으므로 기존 native 수정·Junction을 먼저 확인한다. 앱 build/.cxx가 계속 D:를 가리키는지 prebuild 전후에 확인한다. 아래 run:android 명령은 앱을 설치·실행하므로 AI는 실행하지 않았다. build-only 검사는 아래 별도 명령으로 통과했다.

```powershell
. .\scripts\use-android-tools.ps1
Set-Location mobile
adb devices
# emulator-5554 device 같은 행이 보일 때 진행
Get-Item .\android\app\build, .\android\app\.cxx | Select-Object Name, LinkType, Target
npx expo prebuild --platform android --no-install
Get-Item .\android\app\build, .\android\app\.cxx | Select-Object Name, LinkType, Target
adb reverse tcp:8083 tcp:8083
# 별도 PowerShell의 mobile 폴더에서, 이 프로젝트의 Metro가 없을 때만 실행:
# node --dns-result-order=ipv4first node_modules/expo/bin/cli start --dev-client --localhost --port 8083
npx expo run:android --device --port 8083 --no-bundler
```

이 PC의 기존 x86_64 빌드에는 짧은 경로가 필요했던 이력이 있다. Ninja 경로 길이 오류가 나면 드라이브를 새로 만들거나 파일을 옮기지 말고 [기존 빌드 근거](VERIFICATION.md)를 확인한다. 최신 native build-only 검사와 APK 정보는 VERIFICATION의 소셜 로그인 네이티브 모듈 포함 기록을 따른다.

아래는 기능별 확인 기준이다. 이미 통과한 항목은 해당 Issue의 근거를 재사용하며, 이 목록을 이유로 매 실행마다 전체 재검사를 요청하지 않는다.

1. 홈 좌상단 ‘누비’ 로고와 구분된 상단 이야기, 하단 중앙 ‘사진으로 찾기’를 확인한다. 추천 사진은 영역 폭을 채우고 아래쪽이 흰색 그라데이션으로 이어져야 한다. 돋보기에서 ‘교태’를 입력해 결과로 이동하고 복귀한다. 장소 카드 탭은 해당 설명으로 이동하며, 양방향 swipe/이전·다음은 카드만 교체한다. 사진이 카드 중앙을 채우고 한쪽 여백이 남지 않는지 확인한다. 세로 스크롤·짧은 드래그 취소와 구분한다. 추천 이야기를 열었다 뒤로 돌아오면 같은 이야기가 남고, 내 글→홈 재진입이나 앱 새 실행에서는 다른 이야기가 나와야 한다(후보가 여러 개인 경우). 이야기 → ‘사진 속 쪽지 보기’에서 두 손가락 확대·이동 또는 확대/축소 버튼을 쓰고 ‘전체 사진’으로 복원한다.
2. 메모 진입에서 로그인 gate가 먼저 보이고 취소 시 가이드로 돌아오는지 확인한다. 제공자 설정 후 로그인 성공 → 원래 메모 화면 → ‘나도 한 줄 남기기’ → 위치 선택 → ‘글 쓰기’ 순서로 진행한다. 공개 범위 미선택, 한글 두 줄 입력 → ‘나만 보기’ → ‘저장’. 확대 후 같은 위치/본문인지 확인한다.
3. 새 글 작성 중 ‘닫기’ 또는 상단 집 버튼으로 나가면 초안을 보관하고 ‘내 글’에서 이어 쓴다. 저장된 글 편집의 ‘수정 취소’는 변경을 버리고 원문 읽기로 돌아간다. 편집 내용을 보관하고 홈으로 나가려면 상단 집 버튼을 사용한다. ‘초안 버리기’는 신규 작성에만 표시하며 저장된 글을 삭제하는 동작과 구분한다.
4. ‘사진에서 보기’로 돌아가 같은 표식·본문인지 확인한다. 다른 새 글에서 ‘공개’ 선택만으로 전송되지 않고 초안으로 남아야 한다. ‘공개하기’에서 동의를 확인한 뒤에만 전송한다. 같은 기기에서 A 로그아웃 → B 로그인 → A 복귀 시 글·초안·게시 요청이 섞이지 않아야 한다.
5. ‘주변 장소’에서 경복궁 지도·건물 높이 표현과 지도 출처를 확인한다. 지도 확대/회전/기울임 → 지원 장소 선택 → 설명 진입 → 복귀 → ‘경복궁 보기’를 확인한다. ‘현재 위치 확인’을 직접 눌러 위치·오차·측정 시각과 거부/만료 상태를 확인한다. 인터넷을 끊어 지도 실패/재시도 시에도 장소 목록에서 직접 설명을 열 수 있어야 한다. 기존 APK에서는 지도 모듈을 사용할 수 없으므로 새 개발 APK가 필요하다.

키보드는 홈 검색과 쪽지 입력을 각각 확인한다. PC 키보드 실제 입력, 입력창 탭 후 화면 키보드 표시, 한글 조합·줄바꿈, Back으로 키보드만 닫기, 다시 입력·저장 순서다. 입력창/사진/저장 버튼이 가려지면 글자 크기와 키보드 종류를 함께 기록한다. 에뮬레이터 자체 검색창에서도 같은 문제가 생기는지 비교하되 명령어의 입력 주입을 PC 키보드 통과 근거로 쓰지 않는다. 키보드/AVD 설정은 사용자가 확인한다.

유리는 밝은 하늘·복잡한 단청·어두운 부분, 확대 4배와 전체 사진에서 카드 중앙 정렬·외곽 굴절·여백 잘림·본문 가독성을 확인한다. ‘불투명’ 전환도 유지돼야 한다. 360dp·글자 200%·긴 글·동작 감소에서 읽기/작성/닫기/저장이 가능해야 한다. TalkBack 검수는 사용자 결정으로 제외했다. 빌드 성공이나 HTML 시안 검사는 이 기기 확인을 대체하지 않는다.

지도 연결(#31): 2026-11-08 사용자 선택으로 MapLibre React Native + OpenFreeMap Liberty를 사용한다. Google Cloud 프로젝트·지도 API 키는 필요하지 않다. 기존 APK에는 MapLibre가 없어 새 development build를 설치해야 한다. [MapLibre Expo 설정](https://maplibre.org/maplibre-react-native/docs/setup/expo/)과 [OpenFreeMap 설정](https://openfreemap.org/quick_start/)을 따른다. 지도 스타일·타일은 화면을 볼 때 네트워크로 받고, 지역 전체 다운로드나 자체 지도 서버는 구성하지 않는다. 기본 높이 표현은 공급 데이터이며 실측 높이·정교한 궁궐 모형으로 보장하지 않는다. 지도 안의 출처 표기를 유지한다. 지원 장소 좌표는 [OpenStreetMap](https://www.openstreetmap.org/copyright) 건물 도형의 경계 상자 중심이며 위치 인증이 아니다.

```powershell
# 저장소 루트에서 현재 PowerShell 세션에 적용한다.
. .\scripts\use-android-tools.ps1
Set-Location mobile
npm run android -- --device
```

위 Java 경로는 이번 Gradle 실행에서 자동 설치된 Temurin 17.0.20.1+1의 **이 PC 경로**다. 다른 PC에서는 실제 설치한 JDK 17 경로를 지정한다. 기존 전역 Oracle JDK 21은 유지했다. 도구 설치와 빌드·기기 실행 결과는 [검증 기록](VERIFICATION.md)에서 구분한다.

설치 대상 없이 Emulator용 x86_64 APK만 빌드할 때는 위 환경을 설정한 후 `mobile/`에서 다음을 실행한다. 실제 기기의 arm64 빌드·실행 결과로 간주하지 않는다.

```powershell
npx expo prebuild --platform android --no-install
$env:NODE_ENV = 'development'
./android/gradlew.bat -p android :app:assembleDebug -PreactNativeArchitectures=x86_64 --max-workers=2 --console=plain
```

가상 기기를 직접 실행할 때는 저장소 루트에서 다음을 사용한다. Windows Hypervisor Platform이 준비되어 있어야 한다.

```powershell
$env:ANDROID_AVD_HOME = Join-Path $env:ANDROID_USER_HOME 'avd'
& "$env:ANDROID_HOME/emulator/emulator.exe" -accel-check
& "$env:ANDROID_HOME/emulator/emulator.exe" -avd VTG_API_36 -no-snapshot-load
```

`npm run android`는 네이티브 생성·빌드·설치와 Metro 시작을 수행한다. 다음 실행부터 `npm start`로 Metro를 켜고 설치한 개발 앱에 연결할 수 있다. Expo Go 및 EAS cloud build는 이 확인의 대체 경로가 아니다. 다른 사람에게 독립 실행 APK를 전달하는 단계는 별도다.

`android/`·`ios/`는 app 설정에서 생성하는 산출물로 Git에서 제외한다. 직접 수정하지 않고 `app.json`과 필요한 config plugin을 소스로 관리한다. 재생성은 미커밋 네이티브 수정을 보존하지 않으므로 확인 후 실행한다.

JavaScript 의존성은 실제 `mobile/node_modules`에 둔다. 전체 node_modules를 다른 드라이브로 연결하면 Expo Router가 화면 루트와 asset 경로를 잘못 찾는 것을 실행 검증에서 재현했다. 용량이 큰 패키지의 Android `build`/`.cxx` 폴더는 D: 캐시를 가리키는 Junction을 사용한다. 11/4 `mobile/android/app/build`와 `.cxx`도 `D:\Android\Projects\visual-travel-guide\app-build-rebuild-20261104`와 `app-cxx-rebuild-20261104`를 각각 가리키도록 옮겼고 증분 빌드를 확인했다. native 재생성이나 의존성 재설치 후에는 연결이 없어져 C:에 다시 생길 수 있으므로 경로와 여유 공간을 확인한다. 이동 전 원본은 D:의 `app-build-before-link-20261104`와 `app-cxx-before-link-20261104`에 보관했다.

설치된 개발 앱을 Android 에뮬레이터에서 다시 열 때는 저장소 루트에서 환경 스크립트를 적용한 뒤 `mobile/`에서 `npm run start:emulator`를 사용한다. IPv4 localhost만 사용하므로 LAN에 서버를 열지 않는다. 별도 터미널에서 `adb reverse tcp:8081 tcp:8081`을 실행한 뒤 개발 앱의 최근 서버 `http://127.0.0.1:8081`을 선택한다. 이 PC에서는 기본 localhost가 IPv6 `::1`로 열려 IPv4 adb reverse가 EOF 오류를 반환했다. `start:emulator`는 Node의 IPv4 우선 옵션으로 이를 해결한다. 앱을 종료 후 다시 실행하면 개발 서버 선택 화면이 먼저 나타날 수 있다.

11/4 재생성 후 C: 긴 경로 빌드는 Ninja 260자 제한으로 실패했다. 같은 저장소를 V:로 연결한 짧은 경로에서 D: SDK·Gradle과 기존 캐시를 사용한 x86_64 빌드·에뮬레이터 재설치·실행은 통과했다. V:는 별도 디스크가 아니며 이 검사에서 연결을 유지했다. 기록과 재현 조건은 [검증 기록](VERIFICATION.md)을 따른다. ARM 실기기 빌드는 별도다.

Windows에서 `npm ci`의 postinstall은 Expo autolinking의 `cmd /c`를 `cmd /d /c`로 수정한다. 이 PC의 machine AutoRun이 출력하는 `Active code page: 65001`이 JSON에 섞여 빌드가 실패하는 것을 재현했다. `/d`는 해당 하위 명령에서만 AutoRun을 끄며 레지스트리는 수정하지 않는다. 수정 위치는 `expo-modules-autolinking@57.0.16`의 `Os.kt`이고 [스크립트](scripts/fix-windows-autolinking.cjs)가 중복 적용과 예상 밖 원문을 검사한다. Expo 업그레이드 시 upstream 수정 여부를 대조하고 필요 없으면 스크립트를 제거한다.

SDK 57 사진 선택기를 추가한 빌드에서는 Expo가 네이티브 모듈을 C: 실제 경로로 해석하고 앱 codegen을 V:로 해석해 RN Gradle plugin 0.86.3의 `File.cliPath`가 `different roots`로 실패했다. [설치 보정](scripts/fix-windows-gradle-path.cjs)은 같은 드라이브의 기존 상대 경로 처리는 유지하고, 다른 드라이브일 때만 절대 경로를 넘긴다. 버전·예상 원문을 검사하고 재적용을 허용한다. 생성된 Android 코드를 직접 수정하지 않는다. RN 업그레이드 때 upstream과 대조해 제거 여부를 검토한다. 이것은 긴 경로 제한 전체를 해결하는 변경이 아니다.

## 코드 읽는 순서

1. `app.json`, `package.json`: 앱 식별자·SDK·개발 명령.
2. `src/app/_layout.tsx`: Expo Router의 native Stack과 화면 제목.
3. `src/features/place-content/PlaceScreens.tsx`: 장소 선택·설명·출처 화면. `src/app/`에서는 화면을 라우트로 내보낸다.
4. `src/app/development-check.tsx`: 임시 상세와 뒤로가기 확인.
5. `src/features/place-messages/`: 사진 좌표 변환(geometry), 요청 경합 방지(reader), 사진·쪽지 화면(SceneScreen). 개발 예시는 별도 경로다.
6. `src/features/place-content/catalog.json` → `content.ts`: 장소·설명·출처·사진의 ID 관계와 검수 여부를 확인하는 조회 함수. 없는 자료는 다른 장소로 대체하지 않는다.
7. `src/features/photo-input/photoInput.ts` → `nativePhotoInput.ts` → `PhotoInputScreen.tsx`: 임시 사진 계약 → SDK 연결 → 미리보기 화면. 입력과 추론의 책임을 나눈다.
8. `src/features/local-notes/`: 저장 규칙(store), Expo SQLite 연결(device), 작성 화면(Editor).
9. `src/features/location/`: 좌표·거리 판정(location), 요청·취소·만료(controller), Expo 연결(nativeLocation), 지도(PalaceMap).
10. `src/features/recognition/`: 앱 요청·취소·응답 검증과 미탑재 runtime 연결 지점.

## 콘텐츠·사진 입력 경계

이야기는 국가유산청 궁능유적본부의 장소별 공식 설명을 확인해 풀어 쓴 앱 초안이다. `catalog.json`의 `reviewed`는 출처와 내용 대조를 마쳤다는 개발 검수 표식이며 사용자 어투 평가나 전문가 감수를 뜻하지 않는다. 공식 사진 3장의 출처·이용 조건·원본 해시는 같은 파일의 `assets`에 있다. 원본 파일은 변경하지 않고 화면에서 중앙 크롭한다. 공공누리 제1유형 출처는 장소 설명 하단에 표시한다. 이 자료를 모델 학습 성능의 근거로 사용하지 않는다.

사진 화면은 시스템 카메라 또는 Android 사진 선택기를 연다. 갤러리 전체 접근 권한을 요청하지 않으며 영상·음성 입력, 업로드·갤러리 저장은 제공하지 않는다. `expo-image-picker` 추가 후에는 native 재생성·개발 APK 재빌드가 필요하다. Expo Go나 기존 APK의 JavaScript 갱신만으로 확인하지 않는다. [SDK 57 API](https://docs.expo.dev/versions/v57.0.0/sdk/imagepicker/)를 기준으로 구현했다.

`selectPhoto`는 읽을 수 있는 사진만 새 `photoId`로 등록하며, 거부·취소·실패에서는 이전 선택을 유지한다. `releasePhoto`는 일치하는 핸들만 해제한다. 화면을 닫으면 대기 중 응답을 무시하고 선택 참조를 해제한다. 원본과 선택기가 만든 캐시 파일을 직접 지우지 않으며 캐시는 OS가 관리한다. 사진 URI는 앱 안에서만 사용하고 로그·공개 기록에 넣지 않는다. Activity 재생성 후 `getPendingResultAsync`로 얻은 사진은 원래 입력 경로를 추정하지 않고 `origin: unknown`으로 전달한다. 선택 참조는 앱 종료 후 보존을 보장하지 않는다.

조회 6개 검사는 `test:content`, 사진 상태·오류·경합 8개 검사는 `test:photo`로 실행한다. 실제 시스템 카메라·사진 선택기 동작은 이 단위 검사와 별개이며 [검증 기록](VERIFICATION.md) 및 해당 Issue에 결과를 남긴다. 새 테스트는 구현을 미러링하기보다 다른 장소 혼입·이전 입력 손실·원본 삭제·늦은 응답의 위험을 확인한다.

## 현재 위치 연결 경계

지도는 MapLibre 렌더러를 앱에 포함하고 OpenFreeMap 서버에서 스타일·타일을 받는다. 등록 장소의 좌표·설명은 앱 자료다. 받아둔 지도가 캐시에 남을 수 있어 인터넷 끄기만으로 지도 로딩 실패를 재현했다고 판정하지 않는다. 실패 화면은 데이터 또는 Wi-Fi 연결 확인과 ‘지도 다시 시도’를 제공하며, 아래 장소 선택으로 설명을 열 수 있다. 오류 안내는 인터넷 단절을 유일한 원인으로 단정하지 않는다.

개발 APK에서 실패 복구를 확인하려면 Metro `r` → 주변 장소에서 지도 표시 대기 → 화면 아래 **개발 메뉴 → 지도 로딩 실패 재현**을 누른다. 실제 지도 실패와 같은 `map.load.fail('render')` 경로를 사용하며 ‘개발 테스트 · 지도 로딩 실패’ 표식을 표시한다. 장소 이름을 누르면 지도 대신 해당 설명으로 이동해야 한다. 돌아와 **지도 다시 시도**를 누르면 테스트 표식이 사라지고 정상 지도 로드를 다시 시도한다. 설정·캐시·GPS를 변경하거나 실패 모드를 영구 저장하지 않는다. 이 버튼은 `__DEV__`에서만 표시되며 실제 네트워크 장애나 현장 GPS 검사를 대신하지 않는다.

‘현재 위치 확인’ 또는 유효한 위치가 없을 때 ‘내 위치로’를 누르면 foreground 권한 → 위치 서비스 확인 → 단일 위치 조회를 수행한다. 명시적인 조회에는 `Accuracy.High`를 요청한다. 기존 `Balanced`보다 정확도를 우선하는 요청이며 GPS 수신이나 특정 오차를 보장하지 않는다. 권한·설정 창으로 앱이 비활성이 되면 기존 단일 요청은 유지하되, 앱 복귀 전에는 다음 조회 단계나 결과 적용으로 진행하지 않는다. 화면 이탈·취소·15초 대기 상한은 요청과 대기 중 결과를 폐기한다. OS의 이미 시작한 단일 위치 요청을 강제로 종료한다고 보장하지 않는다. 위치 구독·백그라운드 추적·영구 저장·서버 전송은 없다.

에뮬레이터의 위치는 실제 노트북 GPS와 구분한다. 시간 초과가 나면 에뮬레이터 오른쪽 `⋯ → Location → Single points`에서 테스트할 곳을 고르고 `Set location`으로 새 좌표를 보낸 뒤 앱에서 다시 요청한다. 필요하면 앱의 위치 요청 중에 좌표를 다시 보낸다. 경복궁을 검색해 사용할 수 있으며 이 결과는 가상 위치 연결 검사다. 오래된 마지막 위치를 현재 위치로 사용하거나 실제 현장 GPS 검증으로 세지 않는다. [Android Emulator 위치 조작](https://developer.android.com/studio/run/emulator-extended-controls#location).

`Set location`으로 새 측정이 전달되지 않으면 별도 PowerShell에서 아래 명령을 **앱의 위치 요청이 진행 중일 때** 실행해 검사한다. `OK`는 에뮬레이터 콘솔의 명령 접수이며 앱의 위치 수신 성공을 뜻하지 않는다. 실제 측정 시각·오차와 지도 위치가 갱신됐는지 확인한다. [콘솔 위치 명령](https://developer.android.com/studio/run/emulator-console#geographic-location).

```powershell
& "D:\Android\Sdk\platform-tools\adb.exe" -s emulator-5554 emu geo fix 126.97699045 37.57854455
```

좌표 시각 60초 이내·accuracy 100m 이내일 때만 지도 표식·정확도 원·직선 거리와 가까운 순서를 제공한다. 만료 타이머와 foreground 복귀 시 재검사로 오래된 좌표를 제거한다. 거리는 출처 있는 건물 중심까지의 근사 직선 거리이며 입구·도보 경로나 방문 인증이 아니다. 거부·위치 서비스 꺼짐·오차·timeout에서도 모든 지원 장소를 직접 선택할 수 있다. 다시 묻기 불가에서는 앱 권한 설정, 위치 서비스 꺼짐에서는 기기 위치 설정을 여는 버튼을 제공한다. 설정 복귀 후 자동 권한 요청은 하지 않는다.

`createLocationController`의 요청·취소·만료 검사는 기존 `npm run test:messages`에 포함된다. adapter는 [Expo 57 Location](https://docs.expo.dev/versions/v57.0.0/sdk/location/), 설정 버튼은 [RN 0.86 Linking](https://reactnative.dev/docs/0.86/linking)과 [Android 위치 설정 Intent](https://developer.android.com/reference/android/provider/Settings#ACTION_LOCATION_SOURCE_SETTINGS)를 기준으로 작성했다. 실제 권한창·설정 복귀·GPS·OpenFreeMap 타일·입체 건물은 사용자 Android 확인이 필요하다. 지도나 네트워크를 사용할 수 없어도 위치 확인/직접 장소 선택을 유지한다.

## R3와 Android 실행 피드백 반영

`src/ui/theme.ts`는 k-style 기반 간격과 원본 Spoqa 400/700을 유지하고 사용자 피드백에 따라 먹색·회색을 쓴다. 원본 CSS/MIT는 `docs/design/place-messages/vendor/`에 보존한다. 홈은 광화문 심벌/이름 검색, 독립 추천 이야기, 터치로 교체하는 장소 사진, 실제 공개 글 미리보기 순이다. 사진 찾기는 하단 중앙 캡슐이다. 상세는 첫 이야기 → 쪽지 입구 → 나머지 이야기 펼침으로 구성한다. 개인 글 관리는 간결한 목록이며 편집은 원래 공통 사진에서 이어진다.

홈 추천 사진은 전체 폭·아래쪽 페이드를 유지하며 제목 뒤의 기존 PhotoGlass를 사용한다. bundled Image는 사용자 style에 폭·높이가 없으면 원본 치수를 기본 적용하므로 `absoluteFill`만으로 사진 크기를 정하지 않는다. 추천/카드 사진에 명시적인 100% 폭·높이를 적용하고 카드 사진 부모의 padding을 이름 레이블 margin으로 옮긴다. PhotoGlass의 cover rect는 같은 사진 viewport와 원본 치수에서 계산한다. 세 원본 사진×320/390/640dp의 크기 계약·유리 중앙 정렬은 `test:content`가 확인하며, 이 검사는 실제 GPU 화면 인수와 구분한다.

`TapArea`는 100/140ms opacity 피드백, OS 동작 감소 설정, 키보드 focus 테두리를 제공한다. scale 후보 대신 크기가 바뀌지 않는 피드백부터 적용했다. 터치 영역을 줄이거나 요청/저장 완료를 애니메이션 뒤로 미루지 않는다. `Action`은 이 경계를 써서 primary/quiet/soft/danger와 radio·busy/disabled 상태를 공유한다. 내 글 로딩은 실제 SQLite 조회 동안만 Skullet 각색 뼈대를 표시한다. 하단바는 불투명 흰색이며 두 목적지와 선택 표시를 유지한다.

사진 입력·공통 사진의 조작·작성면도 같은 Action/색/글자 규칙을 사용한다. 읽기는 `presentation.ts`의 표시 상태와 `useReaderMotion.ts`의 native 모션을 요청 controller와 분리했다. 닫기는 요청을 즉시 취소하고 마지막 표시만 140ms 퇴장 동안 유지한다. 진입은 native Modal onShow 뒤 220ms opacity/8dp이며 OS 동작 감소에서는 이동·시간을 제거한다. 닫는 중 다시 열거나 늦은 완료가 와도 이전 token으로 새 글을 닫지 못한다. 화면 이탈/백그라운드/편집 전환은 즉시 숨기고, 일반 닫힘 뒤에만 선택 표식으로 focus를 돌린다.

쪽지 배치 방향은 열린 동안 유지하며, 같은 글 재확인 중에는 마지막으로 확인한 anchor를 유지한다. 추천·읽기·작성의 PhotoGlass는 클립된 사진 복제본의 배율을 외곽에서 달리하는 굴절 근사다. 읽기 동작의 복제 사진은 쪽지 이동 반대 방향으로 보정한다. 광학 품질·배경 정렬·Android 성능은 실화면 검수 대상이다.

쪽지 키보드 확인: 먼저 홈 돋보기와 사진 위 쪽지 양쪽에서 영어/한글 입력을 비교한다. 쪽지에서만 안 되면 입력창 cursor와 화면 키보드 표시 여부를 구분한다. 두 곳 모두 PC 입력이 안 되면 에뮬레이터의 Android 설정 검색창에서도 비교한다. 이 PC의 VTG_API_36 설정에서 2026-11-07 읽은 값은 `hw.keyboard=no`였으며 설정을 바꾸지 않았다. 필요하면 Android Studio Device Manager → 가상 기기 편집 → 고급 설정 → **Enable Keyboard Input**을 사용자가 확인한다. 켜면 화면 키보드가 기본적으로 숨을 수 있다. [Android 공식 AVD 속성](https://developer.android.com/studio/run/managing-avds). 이 값만으로 앱 포커스/한글 IME 실패의 원인을 확정하지 않는다.

현재 적용은 #36의 일부다. 실제 Android 큰 글자·사진·눌림/읽기 모션·포커스·스크롤/뒤로·키보드의 미확인 항목은 남겨두고, 검사 실행 여부는 핵심 기능 변경 시에만 재검사하는 개발 규칙을 따른다. TalkBack 수동 검사는 이번 범위에서 제외한다. 다른 글 전환 fade/BUGI 형태 연결은 미적용 비교 후보이며, 유리 쪽지 광학·실기기 검증도 남아 있다. 타입·번들 성공을 시각 승인이나 Liquid Glass 완성으로 보지 않는다.

## 사진 인식 연결 경계

사진 인식의 앱 쪽 요청 흐름은 `src/features/recognition/`에 있다. `createRequest` → `recognize`가 현재 사진·콘텐츠 버전을 고정하고, `cancelRecognition`은 화면의 기다림과 결과 적용을 취소한다. 30초는 개발용 대기 상한이며 추론 성능 목표가 아니다. 취소·시간 초과 뒤에도 adapter의 Promise가 실제 네이티브 작업 종료를 알릴 때까지 새 추론은 `BUSY`다. 화면 이탈·백그라운드 전환·사진 교체/해제에서도 이전 결과를 적용하지 않는다. 사진 파일은 삭제하지 않는다.

`nativeRecognition.ts`의 runtime은 아직 `null`이다. 현재 앱은 `MODEL_NOT_READY`와 직접 선택 경로를 제공하며, 테스트의 가짜 모델을 제품에 연결하지 않는다. #21에서 artifact·전처리·매핑·정책 검증 근거를 받으면 `RecognitionRuntime`을 구현해 이 한 곳에 연결한다. adapter는 실제 계산이 끝나기 전에 Promise를 완료시키면 안 된다. 결과 ID·버전·순위·점수 유한성·지원 장소·출처를 검사하고, 정책 검증이 없으면 `identified`를 `uncertain`으로 보류한다. 위치는 인식 입력에 넣지 않는다. 앱 쪽 14개 경합·실패 검사는 `npm run test:recognition`이며 실제 추론·Android 화면 검사를 대신하지 않는다.

## 데이터 계약

공개/신고 제한은 `public-messages/remote.ts`의 검증된 거절 → `DeliveryResult.rateLimit` → `feedback.ts` 안내로 전달한다. SQL migration 0004 이후 응답은 재시도 가능 UTC 시각을 포함하며 기기 현지 시각으로 표시한다. 이전/잘못된 응답은 일반 안내, 5xx/통신 실패는 불확실 상태를 유지한다. 안내만으로 자동 재전송하거나 초안/기존 공개 사본을 삭제하지 않는다. 제한 시간 안내는 현재 시도에만 있고 기기 DB schema·동의 snapshot은 바꾸지 않는다. [서버 계약·설정](../supabase/README.md)을 함께 본다.

현재 계약은 [Sprint 1 상세 설계](../docs/design/APP_SPRINT1_SPEC.md) §4~8을 따른다. 사용자 사진은 장소 찾기의 임시 입력이다. 글은 불변 공통 사진 ID와 원본 기준 u/v에 연결하며 개인 사진 사본은 만들지 않는다. 초안의 공개 범위는 기본값이 없다. 새 저장·공개는 공백/줄바꿈 포함 최대 100자(Unicode code point)이며 입력창의 `최대 100자`·`n/100` 표시와 초과 입력 차단을 적용한다. 기존 긴 글은 16KiB 안전 상한 내에서 읽기/수정 취소를 보존한다. 앱의 나만 보기 전환도 새 개인 저장이므로 100자 이내로 줄여야 하며, 서버의 기존 요청 재실행/철회 호환과 구분한다. ‘공개’를 고른 초안도 서버가 확인하기 전에는 공개 글이 아니다.

내 글 목록은 공개 성공이 확인된 동의 스냅샷과 현재 기기 내용·좌표·공개 범위가 같은 경우 `kind=published`로 읽어 ‘공개됨·편집·사진에서 보기’를 표시한다. 편집에서 `수정 취소`를 누르면 원문을 복원하고 같은 사진의 읽기로 돌아오며, 늦은 저장 방지를 위한 revision 증가만으로 미완료 초안이라 표시하지 않는다. `초안 버리기`는 원문 없는 신규 작성에만 표시한다. 공개 결과가 미확정이면 변경을 임의 폐기하지 않는다. `나만 보기로 저장`은 기존 공개 글 철회를 서버에서 확인한 뒤 개인 글을 저장하며 별도 철회 버튼은 두지 않는다. 이번 변경은 JavaScript와 서버 RPC 계약 변경이며 APK 재설치는 필요 없다.

기기의 공개 성공 영수증은 서버의 현재 숨김 상태와 별개다. 내 글의 보이는 공개 항목은 기존 `vtg_owner_state`를 계정/장면 검증 뒤 읽어 공개됨·관리자에 의해 숨겨짐·공개 철회됨·서버 글 없음을 표시한다. 조회 중/실패에는 현재 공개 중이라고 단정하지 않는다. 화면을 나가면 늦은 응답을 무시하며, 서버 조회로 로컬 초안·공개 동의·request를 덮지 않는다.

## 검증

자동 검사와 Android 실행·뒤로가기·재실행 결과는 [VERIFICATION](VERIFICATION.md)에 기록한다. 모델 적재·실기기·정확도·공유·사용자 비교는 각각 실제 실행 증거가 필요하다.

설정 근거: [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/), [Router 설치](https://docs.expo.dev/router/installation/), [로컬 개발 빌드](https://docs.expo.dev/guides/local-app-development/), [Android Emulator](https://developer.android.com/studio/run/emulator-commandline).


최신 Windows build-only 재현(앱 설치/실행 없음): 저장소 루트에서 도구를 적용하고 D: 폴더 연결과 app build/.cxx의 기존 대상이 유효한지 확인한 후 실행한다. prebuild 직후에는 Junction을 다시 연결해야 한다.

```powershell
. .\scripts\use-android-tools.ps1
$env:NODE_ENV = 'development'
Set-Location D:\Android\vtg\mobile
.\android\gradlew.bat -p android :app:assembleDebug '-PreactNativeArchitectures=x86_64' '-Pandroid.builder.sdkDownload=false' '-Pkotlin.incremental=false' '-Pkotlin.compiler.execution.strategy=in-process' --max-workers=2 --offline --console=plain
```
