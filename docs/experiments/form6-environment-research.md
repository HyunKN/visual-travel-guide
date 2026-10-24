# 양식 6 · 개발 환경 비교와 선정

조사·검수일: 2026-10-24. 범위: 사용자 승인한 React Native + Expo·Android 시작 구성을 위한 도구 조합과 실행 방식 선정. **선정·공식 배포물 확인·로컬 설치 확인·앱 실행 확인을 구분한다.** 앱 생성, 의존성 설치, Android 빌드, 실기기 모델 실행은 이번에 수행하지 않았다.

관련 원본: [구조 설계](../ARCHITECTURE.md), [데이터·입출력 설계](form6-data-contract-review.md), [기존 React Native·추론 연동 조사](react-native-adoption-research.md). 조사 에이전트의 중간 결과를 받은 뒤 담당자가 npm registry와 버전 고정 배포 파일을 직접 재확인했다. 도중 외부 도구 인증/TLS 오류가 있었으나 Python HTTPS와 웹 조회로 아래 근거를 확보했다. 비밀정보·전체 환경변수·기기 식별자는 수집하지 않았다.

## 1. 여러 방식 비교

| 선택지 | 장점 | 우리에게 남는 비용·위험 | 판정 |
| --- | --- | --- | --- |
| Expo Go | UI를 빠르게 띄울 수 있음 | 임의 네이티브 추론 모듈을 넣어 검증하는 앱이 아님 | UI 참고에 한정, 모델 연결 검증용 제외 |
| Expo Development Build + 로컬 Android 빌드 | 네이티브 모듈을 포함하고 Windows에서 로그·의존성을 직접 확인 | JDK·Android SDK 구성과 네이티브 호환 디버깅 필요 | **첫 개발·모델 연결 실험 방식으로 선정** |
| Expo Development Build + EAS 클라우드 | 로컬 빌드 도구 부담 감소 | 계정·업로드·빌드 대기·서명 정책이 추가되고 네이티브 호환 문제는 남음 | 초기 기본 방식에서 제외, 이후 배포 필요 시 검토 |
| Expo 없이 RN 네이티브 프로젝트 직접 관리 | Android 설정을 직접 제어 | Expo plugin 문제 일부는 피할 수 있으나 RN/추론 바인딩 호환과 유지 부담은 남음 | 승인된 Expo 방식에서 실제 장애가 확인된 경우 비교 |

Development Build와 EAS는 다른 선택 축이다. 로컬 `expo run:android`는 EAS 가입·서버를 필수로 하지 않는다([개발 빌드 안내](https://docs.expo.dev/develop/development-builds/introduction/), [로컬 빌드](https://docs.expo.dev/guides/local-app-overview/)). Windows의 일반 Expo CLI 빌드와 `eas build --local`도 구분한다. 후자는 Windows 공식 지원 대상이 아니므로 이번 기본 명령으로 쓰지 않는다([EAS local 제한](https://docs.expo.dev/build-reference/local-builds/)).

## 2. SDK 조합 대조

각 패키지의 latest를 독립적으로 섞지 않는다. 아래는 실제 공개 템플릿과 배포 파일에서 읽은 값이다. 표 전체가 모델 호환 테스트 결과인 것은 아니다.

| 후보 | 대조한 공식 템플릿·앱 패키지 | 네이티브 구성 | 판단 |
| --- | --- | --- | --- |
| SDK 58 | blank-typescript 58.0.28 → Expo ~58.0.19, RN 0.88.0, React 19.3.0, TS ~6.0.3 | Gradle 9.4.1, AGP 9.2.1, compile SDK 37, target SDK 36, Build Tools 37.0.0 | 조사 시 Expo latest. 다만 모델 연결과 동시에 AGP 9 변경을 검증해야 하므로 첫 기준에서 보류 |
| **SDK 57** | **blank-typescript 57.0.33 → Expo ~57.0.31, RN 0.86.3, React 19.2.3, TS ~6.0.3** | **Gradle 9.3.1, AGP 8.12.0, compile/target SDK 36, Build Tools 36.0.0** | **첫 연결 실험 기준으로 선정.** 최신보다 안정적이라고 입증한 것은 아니며 추가 빌드 체계 변경을 줄이려는 판단 |
| SDK 56 | 확인한 blank-typescript 56.0.22 → Expo ~56.0.8, RN 0.85.3, React 19.2.3, TS ~6.0.3 | 이번 비교에서 상세 Android 묶음까지 선정하지 않음 | 기존 패치 성공 보고가 있어도 공식 무수정 호환 증거가 아님. 단순히 오래됐다는 이유로 선택하지 않음 |

배포 근거: [SDK 57 template](https://registry.npmjs.org/expo-template-blank-typescript/57.0.33), [SDK 58 template](https://registry.npmjs.org/expo-template-blank-typescript/58.0.28), [SDK 56 template](https://registry.npmjs.org/expo-template-blank-typescript/56.0.22). Android 값은 [57 wrapper](https://unpkg.com/expo-template-bare-minimum@57.0.33/android/gradle/wrapper/gradle-wrapper.properties), [58 wrapper](https://unpkg.com/expo-template-bare-minimum@58.0.28/android/gradle/wrapper/gradle-wrapper.properties), [RN 0.86.3 catalog](https://unpkg.com/react-native@0.86.3/gradle/libs.versions.toml), [RN 0.88.0 catalog](https://unpkg.com/react-native@0.88.0/gradle/libs.versions.toml)에서 확인했다. UNPKG 링크는 해당 버전 npm 배포 파일의 미러이며 GitHub main과 혼동하지 않는다. 실제 생성 프로젝트와 Gradle resolution을 다시 확인해야 한다.

SDK 57의 사용 가능 문서가 있다는 사실을 장기 지원·보안 보증으로 확대하지 않는다([버전 고정 공식 문서](https://docs.expo.dev/versions/v57.0.0/)). 배포 시점의 유지·지원 상태를 재확인한다. SDK 57에서 모델 연결이 실패했다고 SDK 58 또는 SDK 56으로 무작정 바꾸지 않고, plugin 등록·RN 초기화·전처리·모델 연산·빌드 도구 원인을 나눈다.

## 3. 양식 6에 옮길 환경 표

**표의 선정 값은 첫 실험을 재현할 기준이지 설치 완료 목록이 아니다.** 템플릿의 `~` 범위와 실제 설치된 patch는 구분한다. 앱 생성 시 주요 직접 의존성은 아래 선정값으로 맞추고 설치 전체 결과는 lockfile로 고정한다.

| 항목 | 선정 기준 | 현재 확인 상태 |
| --- | --- | --- |
| 개발 PC | Windows + PowerShell, 기존 편집 환경 사용 | 현재 셸에서 명령 실행 확인 |
| 언어 | TypeScript 6.0.3, strict 타입 검사 | registry 배포 존재 확인, 제품 앱 설치 없음 |
| 앱 묶음 | Expo 57.0.31 / RN 0.86.3 / React 19.2.3 | 공식 템플릿과 package metadata 대조, 설치·빌드 없음 |
| 생성 도구 | create-expo-app 5.0.0 + template 57.0.33 | registry 확인, 생성 미실행 |
| Node / npm | Node 24.11.1 / npm 11.6.2를 첫 재현 기준으로 사용 | `node --version`, `npm --version` 현재 출력 확인. RN 0.86.3 engines의 Node 24.3 이상 범위에 포함 |
| Java | JDK 17 계열을 프로젝트 빌드용으로 별도 지정, vendor/patch는 설치 때 기록 | 현재 `java -version`은 21.0.2. 17로 바꾸거나 설치하지 않았음 |
| Android SDK | compile/target API 36, Build Tools 36.0.0, NDK 27.1.12297006 | RN 배포 catalog 확인. 로컬 설치 미확인 |
| Gradle / AGP | wrapper 9.3.1 / plugin 8.12.0 | 공식 템플릿·RN catalog 기준. 실제 빌드 resolution 미확인 |
| Android 최소 OS | 템플릿 기술 하한 minSdk 24 | 앱의 검증된 지원 기기/OS 범위가 아님. 모델 런타임이 하한을 높일 수 있음 |
| 개발 앱 | expo-dev-client, 로컬 `expo run:android` | Development Build 구성 미실행 |
| 필수 사진 모듈 | expo-image-picker, expo-image-manipulator, expo-file-system, expo-asset | SDK 57 대응 범위를 확인. RGB 텐서 생성까지 보장하는 목록이 아님 |
| 콘텐츠 검사 | Zod 4.6.7을 개발 의존성 선정, 별도 ID·파일·출처 검사 | registry 배포 존재 확인, 구현·설치 없음 |
| 진단 | expo-doctor 1.21.5, expo install --check, TypeScript 검사 | 도구 배포 확인, 앱 대상 실행 없음 |
| 형상관리 | 기존 GitHub 저장소, `codex/` 작업 브랜치 → PR 검토 → main | 기존 운영 유지. 앱 package-lock·Gradle wrapper·필요한 config/plugin은 형상관리, 키·기기 식별자 제외 |
| 제품 모델/런타임 | 미선정. ORT RN 1.24.3은 검토 후보 | 배포 존재·Gradle 내용 확인, Android 실행 없음 |
| 시험 기기 | Android 실제 기기, 모델명·OS·메모리·ABI 기록 예정 | 사용자 기종 미정. 에뮬레이터 결과로 현장 성능을 주장하지 않음 |

JDK 17 선정은 [Expo Windows 설치 안내](https://docs.expo.dev/workflow/android-studio-emulator/)의 권고와 일치한다. JDK 21이 반드시 실패한다는 뜻이 아니다. 기존 시스템 Java를 제거·전역 변경하지 않고 프로젝트용 선택을 분리한다. IDE 자체 버전은 아직 확인하지 못했으며 Android Studio의 stable 배포를 설치할 때 버전을 기록한다. 실제 실행 도구 버전이 없는 상태에서 ‘환경 구축 완료’로 쓰지 않는다.

확인한 [Expo 57 모듈 대응표](https://unpkg.com/expo@57.0.31/bundledNativeModules.json): dev-client `~57.0.20`, image-picker `~57.0.20`, image-manipulator `~57.0.21`, file-system `~57.0.7`, asset `~57.0.20`, location `~57.0.22`. 실제 설치 patch는 `expo install` 결과와 lockfile에 기록한다. 위치 모듈은 해당 기능 구현 때 추가하며, 지도·3D·전역 상태·클라우드·DB 라이브러리를 일괄 설치하지 않는다.

## 4. 인식 연결의 남은 위험

[ORT RN 1.24.3 배포 metadata](https://registry.npmjs.org/onnxruntime-react-native/1.24.3)의 peerDependencies `*`는 RN 최신 전체 호환 보증이 아니다. [동일 배포물 Android Gradle](https://unpkg.com/onnxruntime-react-native@1.24.3/android/build.gradle)에는 AGP 7.4.2 참조와 네이티브 ORT/Extensions의 `latest.integration`이 있다. 따라서 npm package-lock만으로 실제 Android 추론 엔진까지 고정했다고 말할 수 없다.

기존 조사에서 RN 0.86 Bridgeless 초기화 문제와 Expo plugin 문제를 구분했다. SDK 57을 선정했다고 그 문제가 해결된 것은 아니다. 모델 연결 실험에서는 최종 Gradle 의존성 트리·네이티브 엔진 버전·ABI·모델 해시·입력 전처리·취소와 복귀를 기록한다. 필요한 패치의 출처·범위·되돌리기·유지 비용을 설명할 수 없거나, 동적 네이티브 버전을 고정하지 못하면 제품 채택을 보류한다.

## 5. 1차 검수 — 요구·공식 문서 대조

| 검토 | 결과 |
| --- | --- |
| 온디바이스 네이티브 라이브러리를 쓸 수 있는가 | Expo Go 제외, Development Build 선정. 지원 경로 확인이며 모델 실행 성공 아님 |
| 서버 운영부터 만들지 않는 사용자 방향과 일치하는가 | 로컬 Android 빌드·JSON 콘텐츠. EAS/서버DB를 필수로 하지 않음 |
| 버전들을 각 패키지 latest로 섞었는가 | 템플릿 57.0.33의 묶음으로 좁힘. registry latest58과 채택57을 명시적으로 구분 |
| Node/JDK가 실제 PC와 일치하는가 | Node/npm은 출력 확인, Java는 현재21·계획17을 구분 |
| SDK를 고르면 모델 호환이 해결되는가 | 아니며 네이티브 연결의 별도 실험 조건을 유지 |

## 6. 2차 검수 — 배포물·반례 대조

| 발견·반례 | 수정·판정 |
| --- | --- |
| 최신 SDK 58이면 무조건 적절하다는 판단 | AGP 9·compile SDK 37 추가 변수를 확인하여 첫 기준은57로 선정. 안정성 실측 우월 주장은 삭제 |
| npm 버전만 고정하면 재현 가능하다는 판단 | ORT 배포 Gradle에서 latest.integration을 직접 확인. 실제 native resolution 고정을 통과 조건에 추가 |
| Windows의 로컬 빌드 두 방식을 혼동 | Expo CLI 로컬 빌드 선정, EAS --local을 기본 경로에서 제외 |
| minSdk24를 검증된 모든 Android 지원이라고 표현 | 템플릿 기술 하한과 실제 시험 기기 지원 범위를 분리 |
| SDK나 JDK 미탐지를 미설치로 단정 | adb/sdkmanager는 PATH에서 미탐지, Android Studio/SDK는 기본 경로에서 미발견. 다른 위치 설치 여부는 미확인으로 기록 |
| 개발용 번들 실행을 사용자 테스트 배포 완료로 표현 | Development Build·사용자용 독립 실행 APK·release 성능 검증을 별도 단계로 구분 |

검수 판정: 환경 선정 근거와 문서 수준의 모순을 보완했다. **앱 호환성·실기기 성능의 검수 통과는 아니다.** 버전 경로와 공식 배포 값은 조회했으며 설치·빌드·추론은 미실행이다.

## 7. 다음 실행과 완료 조건

아래는 계획이며 이번에 실행한 명령이 아니다. 앱 생성 위치는 기존 prototype을 덮지 않는 새 하위 경로로 정한다. 도구 설치·앱 구현은 다음 작업에서 진행한다.

1. JDK17·Android Studio·SDK36·Build Tools·NDK를 준비하고 프로젝트에서 선택된 Java·SDK·wrapper를 확인한다. 목표 Android 기기 정보와 실험 지연/메모리 허용 기준을 기록한다.
2. 고정 생성 도구와 템플릿으로 앱을 만든다: `npx create-expo-app@5.0.0 <새-앱-경로> --template expo-template-blank-typescript@57.0.33`. 템플릿 범위가 더 새 patch로 풀릴 수 있으므로 §3의 주요 버전과 lockfile을 대조한다.
3. `npx expo install expo-dev-client expo-image-picker expo-image-manipulator expo-file-system expo-asset` 후 실제 버전을 기록한다. `npx expo install --check`, `npx expo-doctor@1.21.5`, `npx tsc --noEmit`를 실행한다. 이 명령 성공이 인식 성공은 아니다.
4. `npx expo run:android --device`로 로컬 개발 앱의 첫 화면·권한·사진 입력·취소를 확인한다. 네이티브 생성 파일을 직접 수정해야 하면 config plugin 또는 관리할 소스의 소유를 먼저 정하고 prebuild로 덮어쓰지 않도록 한다.
5. 고정 모델·전처리·라벨로 사진 한 장의 적재/추론/후보 반환을 PC 결과와 대조한다. 실제 네이티브 의존성 버전을 기록하고 연속 입력·취소·백그라운드 복귀를 확인한다. 임의 성능 목표를 결과 후에 만들지 않는다.
6. 타인에게 보낼 테스트 앱은 Metro 연결이 필요한 개발 앱과 구분해 독립 실행 APK를 만들고 설치·오프라인 자료 조회를 확인한다. 서명·배포 방식은 그 단계에서 확정한다. 실제 성능 측정은 release 계열 빌드에서 따로 한다.

양식 6에는 §3 표를 선정 환경으로 옮기고 ‘설치/실행 미검증’을 붙인다. 목표 기기·JDK patch·IDE 버전·모델 런타임을 빈칸 대신 ‘실험/설치 시 확정’으로 남긴다. 해당 항목이 미정이어도 시스템 설계 초안을 작성할 수 있지만 환경 구축 완료나 제출 Word 완성을 의미하지 않는다.
