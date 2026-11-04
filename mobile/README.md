# Android 앱

관광객을 위한 장소 탐색 가이드 서비스의 Android 제품 개발 경로다. 기존 [웹 프로토타입](../prototype/README.md)과 독립적으로 설치한다. [개발 착수 계획](../docs/experiments/sprint1-development-readiness.md)의 T17 일부 → T02를 먼저 수행한다. 관련 작업은 [Issue #21](https://github.com/HyunKN/visual-travel-guide/issues/21)이다.

## 이번 구현의 범위

Expo SDK 57 + React Native + TypeScript의 로컬 Development Build를 준비한다. 시작 화면 → 임시 상세 화면 → Android 뒤로가기, 종료 후 재실행이 첫 확인 대상이다. 화면은 설치·이동 확인용이며 제품 UI·US-01 완료나 사용자 가치 검증을 의미하지 않는다. 사진·모델·위치·저장·Supabase 기능은 아직 연결하지 않았다.

2026-11-04 읽기 시안: 개발용 시작 화면의 `근정전 메시지 시안`에서 공통 사진, 흔적 3개, 반투명 쪽지, 추천 토글을 확인할 수 있다. [메시지 설계](../docs/design/PLACE_MESSAGES.md)의 첫 시연 범위다. 글과 추천수는 화면 확인용이며 공유·작성·영구 저장은 미연결이다. 사진은 [프로토타입 자료의 동일 원본](../docs/prototype/content/assets/geunjeongjeon.jpg)으로 국가유산청 궁능유적본부, 공공누리 제1유형이다. 원본 파일은 변경하지 않고 화면에 맞춰 중앙 크롭해 표시한다.

기존 AI·검색과 비교할 사용자 가치 가설은 [PRODUCT](../docs/PRODUCT.md#개발-핵심-원칙-사용자가-선택할-이유)를 따른다. 이번 환경 작업은 이후 실제 흐름의 검증을 가능하게 하는 지원 작업이므로 별도 사용자 비교는 하지 않는다.

## 설치와 실행

기준: Node 24.11.1 / npm 11.6.2. 앱의 실제 의존성은 `package-lock.json`으로 고정한다. SDK 57 공식 템플릿 `expo-template-blank-typescript@57.0.33`에서 시작했으며 Expo 57.0.31 / RN 0.86.3 / React 19.2.3 / TypeScript 6.0.3을 사용한다. Android package는 `com.visualtravelguide.app`이다.

```powershell
cd mobile
npm ci
npm run typecheck
npm run lint
npm run check:dependencies
npx expo-doctor@1.21.5
```

Android SDK·Java와 실행 중인 Emulator 또는 USB 디버깅 기기가 필요하다. 2026-11-02 이 PC의 도구·캐시는 `D:\Android`로 이동했다. 프로젝트 소스는 C:에 유지한다. SDK는 `D:\Android\Sdk`, 가상 기기는 `D:\Android\User\avd`, Gradle/JDK는 `D:\Android\Gradle`에 있다. Android Studio는 `D:\Android\android-studio`에 있다.

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

## 코드 읽는 순서

1. `app.json`, `package.json`: 앱 식별자·SDK·개발 명령.
2. `src/app/_layout.tsx`: Expo Router의 native Stack과 화면 제목.
3. `src/app/index.tsx`: 개발용 시작 화면과 상세 진입.
4. `src/app/development-check.tsx`: 임시 상세와 뒤로가기 확인.
5. `src/features/place-message-preview/PlaceMessagePreview.tsx`: 사진과 흔적의 좌표, 쪽지와 추천 토글을 확인하는 Android 시안.

## 다음 기능을 연결할 최소 데이터 계약

아래는 기존 착수 계획에서 가져온 **초기 계약 초안**이다. 이번 화면 두 개가 아래 기능을 구현했다는 뜻은 아니다. 세부 schema·저장 방식은 해당 기능을 연결할 때 검증한다.

| 경계 | 계약과 지켜야 할 조건 |
| --- | --- |
| 장소 | `locationId`는 콘텐츠·인식 라벨·개인 기록·공개 글의 동일 장소를 연결한다. 첫 지원 대상은 근정전·교태전·광화문. 사람이 직접 고른 결과는 인식 결과와 구분한다. |
| 입력 사진 | `photoId`, `source`(camera/gallery), 임시 로컬 URI를 갖는다. 개인 기록으로 저장할 때 영구 사본을 만들며 사용자 사진·로컬 URI는 원격 DTO에 넣지 않는다. |
| 인식 | `requestId`·`photoId`·콘텐츠 버전이 현재 입력과 일치하는 응답만 반영한다. 상태는 identified/uncertain/cancelled/error. 재선택·취소 뒤 늦게 도착한 결과를 폐기한다. 판단 정책이 검증되기 전에는 점수를 정답 확률·확정 답으로 노출하지 않는다. |
| 개인 기록 | `privateRecordId`·`locationId`·영구 사진 사본·감상은 비공개 로컬 저장. 실패 시 입력을 보존하며 앱 재실행 뒤 복원 여부를 검사한다. |
| 공개 글 | `publicTraceId`·작성자·`locationId`·선택한 짧은 텍스트·공개 상태·중복 요청 ID를 사용한다. 공개 동의 기본값 false. 개인 저장과 공개 동의를 분리하고, 공개·수정·삭제 권한은 서버에서 검사한다. |

50자 계산 규칙·익명 사용자 복구·판단 임계값은 아직 확정하지 않았다. 해당 기능 구현 전 정하며 이번 환경 작업에서 임의로 채우지 않는다.

## 검증

자동 검사와 Android 실행·뒤로가기·재실행 결과는 [VERIFICATION](VERIFICATION.md)에 기록한다. 모델 적재·실기기·정확도·공유·사용자 비교는 각각 실제 실행 증거가 필요하다.

설정 근거: [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/), [Router 설치](https://docs.expo.dev/router/installation/), [로컬 개발 빌드](https://docs.expo.dev/guides/local-app-development/), [Android Emulator](https://developer.android.com/studio/run/emulator-commandline).
