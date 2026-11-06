# Android 앱

관광객을 위한 장소 탐색 가이드 서비스의 Android 제품 개발 경로다. 기존 [웹 프로토타입](../prototype/README.md)과 독립적으로 설치한다. [개발 착수 계획](../docs/experiments/sprint1-development-readiness.md)의 T17 일부 → T02를 먼저 수행한다. 관련 작업은 [Issue #21](https://github.com/HyunKN/visual-travel-guide/issues/21)이다.

## 이번 구현의 범위

R3 선택을 반영한 이야기 홈과 불투명한 ‘둘러보기 / 내 글’ 탭을 적용 중이다. [상세 설계](../docs/design/APP_SPRINT1_SPEC.md)와 [공통 UI #36](https://github.com/HyunKN/visual-travel-guide/issues/36)에서 화면 기준·남은 검수를 확인한다. 새 화면의 Android 시각·접근성 확인은 아직 하지 않았다. 앱·에뮬레이터·개발 서버는 사용자가 직접 실행한다.

Expo SDK 57 + React Native + TypeScript의 로컬 Development Build다. [App 기능 지도 #27](https://github.com/HyunKN/visual-travel-guide/issues/27)에서 진행 순서와 상태를 관리한다. 근정전·교태전·광화문 선택 → 이야기 → 공통 사진 → 위치 선택 → 자유 글 → 기기 저장/복귀를 구현했다. 개인 촬영 사진은 보관하지 않는다. 위치는 사용자 요청 시에만 읽는다. 모델 미탑재 시 직접 선택할 수 있다.

실제 장면은 기기의 개인 글과 설정된 프로젝트의 공개 글을 함께 읽는다. 공개 설정이 없으면 기기의 개인 글만 읽는다. 개발 빌드의 ‘쪽지 읽기 예시’만 겹친 표식·모서리 예시를 제공한다. 추천은 제외했다. 공개 선택은 초안에 보존되며 Supabase 설정이 없으면 전송하지 않는다. 공개용 SQL·권한 검사와 실제 서비스 연결은 [공유 설정 안내](../supabase/README.md)를 참고한다.

기존 AI·검색과 비교할 사용자 가치 가설은 [PRODUCT](../docs/PRODUCT.md#개발-핵심-원칙-사용자가-선택할-이유)를 따른다. 직접 선택·사진 입력은 같은 장소의 설명과 이후 흔적 경험을 잇기 위한 기반이다. 출처를 따라 읽는 이야기 초안과 관람 포인트를 제공하지만, 사용자가 기존 검색보다 흥미를 느끼고 실제 대상을 다시 보는지는 아직 검증하지 않았다. 사람 비교·실기기·모델 연결의 결과를 이 구현으로 대신하지 않는다.

## 설치와 실행

기준: Node 24.11.1 / npm 11.6.2. 앱의 실제 의존성은 `package-lock.json`으로 고정한다. SDK 57 공식 템플릿 `expo-template-blank-typescript@57.0.33`에서 시작했으며 Expo 57.0.31 / RN 0.86.3 / React 19.2.3 / TypeScript 6.0.3을 사용한다. Android package는 `com.visualtravelguide.app`이다.

```powershell
cd mobile
npm ci
npm run typecheck
npm run test:content
npm run test:photo
npm run test:messages
npm run lint
npm run check:dependencies
npm run check:android-bundle
npx expo-doctor@1.21.5
```

`check:android-bundle`은 Android 파일 내보내기만 검사한다. Expo 57의 mockServer export 경로를 사용하므로 HTTP 포트를 열거나 앱을 실행하지 않는다. Git 제외 `.codex-build/android-bundle-check`에 Hermes 묶음/에셋을 만들고, 임시 파일은 같은 폴더 체계 안에 둔다. 환경 파일과 외부 서비스 설정을 제외한 기본 구성 검사이며 실제 기기 검증을 대신하지 않는다.

Android SDK·Java와 실행 중인 Emulator 또는 USB 디버깅 기기가 필요하다. 2026-11-02 이 PC의 도구·캐시는 `D:\Android`로 이동했다. 프로젝트 소스는 C:에 유지한다. SDK는 `D:\Android\Sdk`, 가상 기기는 `D:\Android\User\avd`, Gradle/JDK는 `D:\Android\Gradle`에 있다. Android Studio는 `D:\Android\android-studio`에 있다.

### Windows 네이티브 빌드 경로

2026-11-07 검사에서 `expo prebuild --platform android --no-install`도 Android 생성 폴더를 지우고 다시 만드는 것을 확인했다. 기존 native 수동 수정과 app build/.cxx Junction을 먼저 확인한다. 이번 작업은 기존 APK·캐시를 보존하고 `D:\Android\Projects\visual-travel-guide\app-build-20261107-s1`·`app-cxx-20261107-s1`에 새 출력을 둔다. `D:\Android\vtg`는 C: 저장소를 가리키는 폴더 Junction이다. 새 드라이브나 소스 이동이 아니다.

Windows에서 Ninja 오브젝트 경로 260자 초과를 재현해 `plugins/withWindowsObjectPaths.cjs`를 추가했다. Expo 생성 시 app Gradle의 CMake에 `CMAKE_OBJECT_PATH_MAX=240`을 적용해 긴 경로를 해시하도록 한다. 생성 파일을 수동 편집하지 않는다. PowerShell에서는 `'-Pandroid.builder.sdkDownload=false'`처럼 점이 포함된 Gradle 인수를 인용한다. 이 옵션은 SDK 자동 설치를 막으며, `--offline`은 Gradle 라이브러리 조회도 캐시로 제한한다. 새 모듈 의존성이 캐시에 없으면 offline 빌드는 실패할 수 있다.

### 이번 PC에서 준비된 APK 사용

2026-11-07 x86_64 개발 APK 빌드·메타데이터 검사는 통과했다. 설치/실행은 사용자가 한다. 이미 준비된 APK를 쓸 때는 prebuild와 재빌드를 반복할 필요가 없다. Android Studio에서 에뮬레이터를 켠 후 아래 devices 출력에 device가 보일 때 설치한다. -r은 기존 기기 데이터를 지우는 명령이 아니다.

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

### 이번 변경을 직접 확인하기

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

이 PC의 기존 x86_64 빌드에는 짧은 경로가 필요했던 이력이 있다. Ninja 경로 길이 오류가 나면 드라이브를 새로 만들거나 파일을 옮기지 말고 [기존 빌드 근거](VERIFICATION.md)를 확인한다. 최신 native build-only 검사와 APK 정보는 VERIFICATION의 2026-11-07 기록을 따른다.

1. 홈 ‘마당의 돌은 자리를 알려줘요’ → 같은 제목의 근정전 이야기 → ‘쪽지 보기’. 처음 확대 사진과 ‘전체 사진’ 전환을 비교한다.
2. ‘글 남기기’ → 사진을 눌러 위치 선택 → ‘글 쓰기’. 공개 범위 미선택인지 확인한다. 한글 두 줄 입력 → ‘나만 보기’ → ‘저장’. 표식을 열고 본문을 확인한다.
3. ‘내 글’에서 편집 도중 닫아 초안으로 남긴다. 앱을 종료했다 다시 열어 ‘이어 쓰기’를 확인한다. ‘초안 버리기’는 편집 전 저장한 글을 지우지 않아야 한다.
4. ‘사진에서 보기’로 돌아가 같은 표식·본문인지 확인한다. 다른 새 글에서 ‘공개’를 선택하면 전송되지 않고 초안만 남아야 한다.
5. ‘주변 장소’는 키 없이도 목록에서 직접 선택 가능해야 한다. 실제 지도 타일·GPS는 아래 설정 후 별도 확인한다.

지도 연결(#31): 본인 Google Cloud 프로젝트에서 [Maps SDK for Android](https://developers.google.com/maps/documentation/android-sdk/get-api-key)를 활성화하고 Android 앱 패키지 `com.visualtravelguide.app`·사용하는 서명 인증서 SHA-1 및 해당 SDK로 키를 제한한다. Google Cloud 결제 연결이 필요한 경우 본인이 요금·할당량을 확인하고 결정한다. 키 값은 채팅/저장소에 넣지 않고 빌드 세션의 `VTG_ANDROID_MAPS_KEY`로 제공한 뒤 prebuild·새 Android 빌드에 반영한다. 이 변수를 쓸 때는 공개할 용도의 config 출력물을 게시하지 않는다. 개발용 좌표는 [OpenStreetMap](https://www.openstreetmap.org/copyright) 건물 도형의 경계 상자 중심이며 위치 인증이 아니다.

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
9. `src/features/location/`: 출처 있는 좌표·위치 판정과 지도 표시.
10. `src/features/recognition/`: 앱 요청·취소·응답 검증과 미탑재 runtime 연결 지점.

## 콘텐츠·사진 입력 경계

이야기는 국가유산청 궁능유적본부의 장소별 공식 설명을 확인해 풀어 쓴 앱 초안이다. `catalog.json`의 `reviewed`는 출처와 내용 대조를 마쳤다는 개발 검수 표식이며 사용자 어투 평가나 전문가 감수를 뜻하지 않는다. 공식 사진 3장의 출처·이용 조건·원본 해시는 같은 파일의 `assets`에 있다. 원본 파일은 변경하지 않고 화면에서 중앙 크롭한다. 공공누리 제1유형 출처는 장소 설명 하단에 표시한다. 이 자료를 모델 학습 성능의 근거로 사용하지 않는다.

사진 화면은 시스템 카메라 또는 Android 사진 선택기를 연다. 갤러리 전체 접근 권한을 요청하지 않으며 영상·음성 입력, 업로드·갤러리 저장은 제공하지 않는다. `expo-image-picker` 추가 후에는 native 재생성·개발 APK 재빌드가 필요하다. Expo Go나 기존 APK의 JavaScript 갱신만으로 확인하지 않는다. [SDK 57 API](https://docs.expo.dev/versions/v57.0.0/sdk/imagepicker/)를 기준으로 구현했다.

`selectPhoto`는 읽을 수 있는 사진만 새 `photoId`로 등록하며, 거부·취소·실패에서는 이전 선택을 유지한다. `releasePhoto`는 일치하는 핸들만 해제한다. 화면을 닫으면 대기 중 응답을 무시하고 선택 참조를 해제한다. 원본과 선택기가 만든 캐시 파일을 직접 지우지 않으며 캐시는 OS가 관리한다. 사진 URI는 앱 안에서만 사용하고 로그·공개 기록에 넣지 않는다. Activity 재생성 후 `getPendingResultAsync`로 얻은 사진은 원래 입력 경로를 추정하지 않고 `origin: unknown`으로 전달한다. 선택 참조는 앱 종료 후 보존을 보장하지 않는다.

조회 6개 검사는 `test:content`, 사진 상태·오류·경합 8개 검사는 `test:photo`로 실행한다. 실제 시스템 카메라·사진 선택기 동작은 이 단위 검사와 별개이며 [검증 기록](VERIFICATION.md) 및 해당 Issue에 결과를 남긴다. 새 테스트는 구현을 미러링하기보다 다른 장소 혼입·이전 입력 손실·원본 삭제·늦은 응답의 위험을 확인한다.

## 사진 인식 연결 경계

사진 인식의 앱 쪽 요청 흐름은 `src/features/recognition/`에 있다. `createRequest` → `recognize`가 현재 사진·콘텐츠 버전을 고정하고, `cancelRecognition`은 화면의 기다림과 결과 적용을 취소한다. 30초는 개발용 대기 상한이며 추론 성능 목표가 아니다. 취소·시간 초과 뒤에도 adapter의 Promise가 실제 네이티브 작업 종료를 알릴 때까지 새 추론은 `BUSY`다. 화면 이탈·백그라운드 전환·사진 교체/해제에서도 이전 결과를 적용하지 않는다. 사진 파일은 삭제하지 않는다.

`nativeRecognition.ts`의 runtime은 아직 `null`이다. 현재 앱은 `MODEL_NOT_READY`와 직접 선택 경로를 제공하며, 테스트의 가짜 모델을 제품에 연결하지 않는다. #21에서 artifact·전처리·매핑·정책 검증 근거를 받으면 `RecognitionRuntime`을 구현해 이 한 곳에 연결한다. adapter는 실제 계산이 끝나기 전에 Promise를 완료시키면 안 된다. 결과 ID·버전·순위·점수 유한성·지원 장소·출처를 검사하고, 정책 검증이 없으면 `identified`를 `uncertain`으로 보류한다. 위치는 인식 입력에 넣지 않는다. 앱 쪽 14개 경합·실패 검사는 `npm run test:recognition`이며 실제 추론·Android 화면 검사를 대신하지 않는다.

## 데이터 계약

현재 계약은 [Sprint 1 상세 설계](../docs/design/APP_SPRINT1_SPEC.md) §4~8을 따른다. 사용자 사진은 장소 찾기의 임시 입력이다. 글은 불변 공통 사진 ID와 원본 기준 u/v에 연결하며 개인 사진 사본은 만들지 않는다. 초안의 공개 범위는 기본값이 없다. 16KiB 상한 안에서 본문과 줄바꿈을 보존한다. ‘공개’를 고른 초안도 서버가 확인하기 전에는 공개 글이 아니다.

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
